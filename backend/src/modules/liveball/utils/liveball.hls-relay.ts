import type { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import http from 'http';
import https from 'https';
import { LRUCache } from 'lru-cache';
import { resolveLiveBallStream, invalidateStreamCache } from '../liveball.service';

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

const LIVEBALL_BASE_DOMAIN = process.env.LIVEBALL_DOMAIN || 'liveball.sx';
const refererFor = (matchId: string) => `https://${LIVEBALL_BASE_DOMAIN}/match/${matchId}`;

const targetMemory = new LRUCache<string, { url: string; resolvedAt: number }>({
  max: 200,
  ttl: 30 * 60_000,
});
const refreshInFlight = new Map<string, Promise<{ url: string } | null>>();
const REFRESH_AFTER_MS = 10 * 60_000;
const REFRESH_DEBOUNCE_MS = 10_000;

function refreshLiveBallStream(
  matchId: string,
): Promise<{ url: string } | null> {
  const pending = refreshInFlight.get(matchId);
  if (pending) return pending;

  const current = targetMemory.get(matchId);
  if (current && Date.now() - current.resolvedAt < REFRESH_DEBOUNCE_MS) {
    return Promise.resolve(current);
  }

  let promise: Promise<{ url: string } | null>;
  promise = (async () => {
    invalidateStreamCache(matchId);
    return resolveLiveBallStream(matchId, true);
  })()
    .then((stream) => {
      if (stream?.type === 'hls') {
        targetMemory.set(matchId, { url: stream.url, resolvedAt: Date.now() });
      }
      return stream;
    })
    .catch(() => null)
    .finally(() => {
      if (refreshInFlight.get(matchId) === promise) refreshInFlight.delete(matchId);
    });
  refreshInFlight.set(matchId, promise);
  return promise;
}

function maybeRefreshLiveBallStream(matchId: string): void {
  const current = targetMemory.get(matchId);
  if (!current || Date.now() - current.resolvedAt < REFRESH_AFTER_MS) return;
  void refreshLiveBallStream(matchId);
}


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
        Origin: `https://${LIVEBALL_BASE_DOMAIN}`,
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
      const freshStream = await refreshLiveBallStream(matchId);
      if (freshStream) {
        // Si c'était la playlist principale qui a échoué, on re-tente avec la nouvelle URL
        if (/\.m3u8([?#]|$)/i.test(url)) {
          return fetchRemote(freshStream.url, matchId, retryCount + 1);
        }
      }
    }
    throw err;
  }
}

/**
 * Segments en streaming : le navigateur démarre sur les premiers octets au
 * lieu d'attendre le téléchargement complet du .ts par le backend.
 */
async function streamRemote(
  url: string,
  matchId: string,
  retryCount = 0
): Promise<{ stream: any; contentType: string; contentLength?: string }> {
  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 10_000,
      maxRedirects: 5,
      httpAgent,
      httpsAgent,
      validateStatus: (s) => s >= 200 && s < 400,
      headers: {
        'User-Agent': USER_AGENT,
        Referer: refererFor(matchId),
        Origin: `https://${LIVEBALL_BASE_DOMAIN}`,
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        Connection: 'keep-alive',
      },
    });

    const contentType = String(response.headers['content-type'] ?? '');
    if (contentType.includes('text/html')) {
      response.data.destroy?.();
      throw new Error(`Remote returned HTML challenge (${url.slice(0, 80)})`);
    }

    return {
      stream: response.data,
      contentType,
      contentLength: response.headers['content-length']
        ? String(response.headers['content-length'])
        : undefined,
    };
  } catch (err: any) {
    const status = err?.response?.status;
    if ((status === 401 || status === 403 || status === 404) && retryCount === 0) {
      console.warn(`[LiveBall Relay] HTTP ${status} for match ${matchId}, refreshing segment...`);
      const freshStream = await refreshLiveBallStream(matchId);
      if (freshStream && /\.m3u8([?#]|$)/i.test(url)) {
        return streamRemote(freshStream.url, matchId, retryCount + 1);
      }
    }
    throw err;
  }
}

function isSelfReferential(url: URL, req: Request): boolean {
  // Hôtes connus du backend (dev local + déploiements) + l'hôte réel de la
  // requête (derrière le proxy/CDN : Railway/Render renvoient le domaine
  // public dans Host, pas l'IP interne). On lit aussi x-forwarded-host.
  const selfHosts = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    'chillers.onrender.com',
    'chillers-production-636d.up.railway.app',
    'chillers-production-8e02.up.railway.app',
  ];
  const hostHeader = String(req.get('host') || '').split(':')[0];
  const fwdHost = String(req.get('x-forwarded-host') || '').split(',')[0].trim();
  if (hostHeader) selfHosts.push(hostHeader);
  if (fwdHost) selfHosts.push(fwdHost);
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
    targetMemory.set(matchId, { url: stream.url, resolvedAt: Date.now() });

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
    maybeRefreshLiveBallStream(matchId);

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

    let upstream: { stream: any; contentType: string; contentLength?: string };
    try {
      upstream = await streamRemote(remoteUrl, matchId);
    } catch {
      if (!res.headersSent) {
        res.status(502).json({ success: false, data: null, message: 'Segment indisponible' });
      }
      return;
    }

    const segmentMime =
      upstream.contentType.includes('video') || upstream.contentType.includes('audio')
        ? upstream.contentType
        : mimeSegment;

    res.set('Content-Type', segmentMime);
    res.set('Cache-Control', 'public, max-age=60, immutable');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    if (upstream.contentLength) res.set('Content-Length', upstream.contentLength);

    const chunks: Buffer[] = [];
    let size = 0;
    let collect = true;
    upstream.stream.on('data', (chunk: Buffer) => {
      if (!collect) return;
      size += chunk.length;
      if (size > 32 * 1024 * 1024) {
        collect = false;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    upstream.stream.on('end', () => {
      if (collect && size >= 8 * 1024) segmentCache.set(remoteUrl, Buffer.concat(chunks));
    });
    upstream.stream.on('error', () => {
      if (!res.headersSent) res.status(502).end();
      else res.destroy();
    });
    res.on('close', () => upstream.stream.destroy?.());
    upstream.stream.pipe(res);
  } catch (error) {
    next(error);
  }
};
