import type { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import http from 'http';
import https from 'https';
import { LRUCache } from 'lru-cache';
import { resolveLiveBallStream, invalidateStreamCache } from './liveball.service';

// Relay HLS : le player du navigateur et mobile ne consomme plus le CDN liveball
// directement (jeton lié à l'IP/referer → résolution serveur ≠ lecture client).
// Tous les playlists/segments passent par notre backend : le CDN ne voit que
// notre IP, et le client bénéficie d'un flux sans CORS avec reprise auto sur coupure.

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const mimePlaylist = 'application/vnd.apple.mpegurl';
const mimeSegment = 'video/mp2t';

const enc = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
const dec = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

// Agents HTTP/HTTPS avec Keep-Alive pour réutiliser les connexions TCP/TLS
// et réduire drastiquement la latence sur le streaming des segments .ts
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50, timeout: 15_000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50, timeout: 15_000 });

// Cache des segments en mémoire (URL → buffer).
// TTL court (60s) adapté au live pour économiser la RAM tout en servant
// les chunks immédiatement sans latence lors des micro-buffering.
const segmentCache = new LRUCache<string, Buffer>({
  max: 600,
  ttl: 60_000,
});

const refererFor = (matchId: string) => `https://liveball.sx/match/${matchId}`;

async function fetchRemote(
  url: string,
  matchId: string,
  retryCount = 0
): Promise<{ buf: Buffer; contentType: string }> {
  try {
    const { data, headers } = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 10_000,
      maxRedirects: 5,
      httpAgent,
      httpsAgent,
      validateStatus: (s) => s >= 200 && s < 400,
      headers: {
        'User-Agent': USER_AGENT,
        Referer: refererFor(matchId),
        Origin: 'https://liveball.sx',
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        Connection: 'keep-alive',
      },
    });

    const contentType = String(headers['content-type'] ?? '');
    const buf = Buffer.from(data);

    // Si le CDN renvoie une page HTML (challenge Cloudflare), c'est une erreur
    if (contentType.includes('text/html') && buf.slice(0, 5).toString() === '<!doc') {
      throw new Error(`Remote returned HTML challenge (${url.slice(0, 80)})`);
    }

    return { buf, contentType };
  } catch (err: any) {
    const status = err?.response?.status;
    // Si le jeton du flux a expiré côté CDN (401 ou 403), on invalide le cache et on tente 1 reconnexion
    if ((status === 401 || status === 403 || status === 404) && retryCount === 0) {
      console.warn(`[LiveBall Relay] CDN returned HTTP ${status} for match ${matchId}. Refreshing stream token...`);
      invalidateStreamCache(matchId);
      const freshStream = await resolveLiveBallStream(matchId, true);
      if (freshStream && freshStream.type === 'hls') {
        // Si c'était la playlist principale qui a échoué, on re-tente avec la nouvelle URL
        if (/\.m3u8([?#]|$)/i.test(url)) {
          return fetchRemote(freshStream.url, matchId, retryCount + 1);
        }
      }
    }
    throw err;
  }
}

function isSelfReferential(url: URL, req: Request): boolean {
  const selfHosts = ['localhost', '127.0.0.1', '0.0.0.0', 'chillers.onrender.com'];
  if (req.get('host')) selfHosts.push(String(req.get('host')).split(':')[0]);
  return selfHosts.includes(url.hostname);
}

function rewritePlaylist(content: string, baseUrl: string, matchId: string): string {
  const relay = (raw: string) => {
    try {
      const resolved = new URL(raw, baseUrl).toString();
      return `/api/liveball/match/${matchId}/hls/proxy/${enc(resolved)}`;
    } catch {
      return raw;
    }
  };

  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Attributs URI dans les tags HLS (#EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA...)
      if (line.startsWith('#EXT-X') && /\sURI="([^"]+)"/.test(line)) {
        return line.replace(/URI="([^"]+)"/g, (_m, u: string) => `URI="${relay(u)}"`);
      }

      // Lignes de commentaires ou directives sans URI
      if (trimmed.startsWith('#')) return line;

      // Lignes contenant les URLs de playlists enfants ou de segments .ts
      return relay(trimmed);
    })
    .join('\n');
}

// GET /api/liveball/match/:matchId/hls/playlist.m3u8
// Point d'entrée du player : résout le flux liveball puis sert la master playlist
// réécrite en temps réel avec les headers low-latency live.
export const getHlsMasterPlaylist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const matchId = String(req.params.matchId);
    const forceRefresh = req.query.refresh === 'true' || req.query.force === '1';

    const stream = await resolveLiveBallStream(matchId, forceRefresh);
    if (!stream || stream.type !== 'hls') {
      res.status(404).json({ success: false, data: null, message: 'Flux HLS liveball introuvable' });
      return;
    }

    const { buf } = await fetchRemote(stream.url, matchId);
    
    // Strict no-cache pour garantir que le player reçoit toujours les derniers segments du direct
    res.set('Content-Type', mimePlaylist);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

    res.send(rewritePlaylist(buf.toString('utf8'), stream.url, matchId));
  } catch (error) {
    next(error);
  }
};

// GET /api/liveball/match/:matchId/hls/proxy/:encoded
// Proxy optimisé : sert un sous-playlist (réécrit en direct) ou un segment vidéo (avec LRU cache et zero-delay)
export const getHlsProxy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const matchId = String(req.params.matchId);
    const encoded = String(req.params.encoded ?? '');

    let remote: URL;
    try {
      remote = new URL(dec(encoded));
    } catch {
      res.status(400).json({ success: false, data: null, message: 'URL relay invalide' });
      return;
    }

    if (remote.protocol !== 'https:' && remote.protocol !== 'http:') {
      res.status(400).json({ success: false, data: null, message: 'Protocole non supporté' });
      return;
    }
    if (isSelfReferential(remote, req)) {
      res.status(403).json({ success: false, data: null, message: 'Boucle relay interdite' });
      return;
    }

    const remoteUrl = remote.toString();

    // 1. Playlist imbriquée (variant / chunklist / rendition) → réécriture en direct (jamais cachée)
    if (/\.m3u8([?#]|$)/i.test(remoteUrl)) {
      const { buf } = await fetchRemote(remoteUrl, matchId);
      res.set('Content-Type', mimePlaylist);
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.send(rewritePlaylist(buf.toString('utf8'), remoteUrl, matchId));
      return;
    }

    // 2. Segment vidéo/audio (.ts / .m4s / .key / .mp4...)
    const cached = segmentCache.get(remoteUrl);
    if (cached) {
      res.set('Content-Type', mimeSegment);
      res.set('Cache-Control', 'public, max-age=60, immutable');
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.send(cached);
      return;
    }

    const { buf, contentType } = await fetchRemote(remoteUrl, matchId);
    const segmentMime =
      contentType.includes('video') || contentType.includes('audio') ? contentType : mimeSegment;

    res.set('Content-Type', segmentMime);
    res.set('Cache-Control', 'public, max-age=60, immutable');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

    // Mise en cache des segments valides (de 8 Ko à 32 Mo)
    if (buf.length >= 8 * 1024 && buf.length <= 32 * 1024 * 1024) {
      segmentCache.set(remoteUrl, buf);
    }

    res.send(buf);
  } catch (error) {
    next(error);
  }
};