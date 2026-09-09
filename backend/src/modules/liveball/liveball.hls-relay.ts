import type { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { LRUCache } from 'lru-cache';
import { resolveLiveBallStream } from './liveball.service';

// Relay HLS : le player du navigateur ne consomme plus le CDN liveball
// directement (jeton souvent lié à l'IP → résolution serveur ≠ lecture client).
// Tous les playlists/segments passent par notre backend : le CDN ne voit que
// notre IP, et le navigateur ne fait que des requêtes same-origin (pas de CORS).

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const mimePlaylist = 'application/vnd.apple.mpegurl';
const mimeSegment = 'video/mp2t';

const enc = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
const dec = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

// Cache des segments (URL → buffer). Les playlists, elles, sont servies fraîches
// (rewrite nécessaire + jeton qui peut tourner).
const segmentCache = new LRUCache<string, Buffer>({
  max: 1000,
  ttl: 10 * 60_000,
});

const refererFor = (matchId: string) => `https://liveball.sx/match/${matchId}`;

async function fetchRemote(url: string, matchId: string): Promise<{ buf: Buffer; contentType: string }> {
  const { data, headers } = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 15_000,
    maxRedirects: 10,
    validateStatus: (s) => s >= 200 && s < 400,
    headers: {
      'User-Agent': USER_AGENT,
      Referer: refererFor(matchId),
      Origin: 'https://liveball.sx',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const contentType = String(headers['content-type'] ?? '');
  const buf = Buffer.from(data);

  // Garde-fou anti-challenge : si le CDN renvoie une page HTML (Cloudflare…),
  // ce n'est pas un segment valide.
  if (contentType.includes('text/html') && buf.slice(0, 5).toString() === '<!doc') {
    throw new Error(`Remote returned HTML challenge (${url.slice(0, 80)})`);
  }

  return { buf, contentType };
}

function isSelfReferential(url: URL, req: Request): boolean {
  const selfHosts = ['localhost', '127.0.0.1', '0.0.0.0', 'chillers.onrender.com'];
  if (req.get('host')) selfHosts.push(String(req.get('host')).split(':')[0]);
  return selfHosts.includes(url.hostname);
}

function rewritePlaylist(content: string, baseUrl: string, matchId: string): string {
  const remote = new URL(baseUrl);
  const relay = (raw: string) =>
    `/api/liveball/match/${matchId}/hls/proxy/${enc(new URL(raw, baseUrl).toString())}`;

  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      // URLs d'attributs (#EXT-X-KEY URI="…", #EXT-X-MAP URI="…"…) →
      // on les réécrit aussi pour que HLS.js reste en same-origin.
      if (/\sURI="/.test(line) || line.startsWith('#EXT-X')) {
        return line.replace(/URI="([^"]+)"/g, (_m, u: string) => `URI="${relay(u)}"`);
      }
      if (!trimmed || trimmed.startsWith('#')) return line;
      return relay(trimmed);
    })
    .join('\n');
}

// GET /api/liveball/match/:matchId/hls/playlist.m3u8
// Point d'entrée du player : résout le flux liveball puis sert la master playlist
// réécrite (variants + segments → notre relay).
export const getHlsMasterPlaylist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const matchId = String(req.params.matchId);

    const stream = await resolveLiveBallStream(matchId);
    if (!stream || stream.type !== 'hls') {
      res.status(404).json({ success: false, data: null, message: 'Flux HLS liveball introuvable' });
      return;
    }

    const { buf } = await fetchRemote(stream.url, matchId);
    res.set('Content-Type', mimePlaylist);
    res.set('Cache-Control', 'no-store');
    res.send(rewritePlaylist(buf.toString('utf8'), stream.url, matchId));
  } catch (error) {
    next(error);
  }
};

// GET /api/liveball/match/:matchId/hls/proxy/:encoded
// Proxy générique : serve un playlist (réécrit) ou un segment (mis en cache),
// selon l'extension de l'URL distante encodée en base64url.
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

    // Playlist imbriquée (variant/rendition) → réécris et renvoie.
    if (/\.m3u8([?#]|$)/i.test(remoteUrl)) {
      const { buf } = await fetchRemote(remoteUrl, matchId);
      res.set('Content-Type', mimePlaylist);
      res.set('Cache-Control', 'no-store');
      res.send(rewritePlaylist(buf.toString('utf8'), remoteUrl, matchId));
      return;
    }

    // Segment (.ts / .m4s / fichier chiffré .key …).
    const cached = segmentCache.get(remoteUrl);
    if (cached) {
      res.set('Content-Type', mimeSegment);
      res.set('Cache-Control', 'public, max-age=600');
      res.send(cached);
      return;
    }

    const { buf, contentType } = await fetchRemote(remoteUrl, matchId);
    res.set('Content-Type', contentType.includes('video') || contentType.includes('audio') ? contentType : mimeSegment);
    res.set('Cache-Control', 'public, max-age=600');
    if (buf.length >= 16 * 1024 && buf.length <= 32 * 1024 * 1024) {
      segmentCache.set(remoteUrl, buf);
    }
    res.send(buf);
  } catch (error) {
    next(error);
  }
};