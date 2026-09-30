/**
 * Relay HLS générique pour les sources sports.
 *
 * Même raison que le relay LiveBall : quand un flux est lié à l'IP ou au
 * Referer, résoudre l'URL côté backend ne suffit pas — le CDN refuse ensuite la
 * lecture au navigateur. On fait donc transiter playlists et segments par notre
 * backend, qui rejoue la résolution si le jeton expire en cours de lecture.
 */
import type { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import http from 'http';
import https from 'https';
import { LRUCache } from 'lru-cache';
import { resolveSportsStream } from './sports.service';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const mimePlaylist = 'application/vnd.apple.mpegurl';
const mimeSegment = 'video/mp2t';

const enc = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
const dec = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

// Keep-Alive : on réutilise les connexions TCP/TLS pour les rafales de segments.
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50, timeout: 15_000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50, timeout: 15_000 });

const segmentCache = new LRUCache<string, Buffer>({ max: 600, ttl: 60_000 });

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return 'https://placeholder.invalid';
  }
}

async function fetchRemote(
  url: string,
  source: string,
  sourceId: string,
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
        Referer: originOf(url),
        Origin: originOf(url),
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        Connection: 'keep-alive',
      },
    });

    const contentType = String(headers['content-type'] ?? '');
    const buf = Buffer.from(data);

    if (contentType.includes('text/html') && buf.subarray(0, 5).toString().toLowerCase() === '<!doc') {
      throw new Error(`Challenge HTML renvoyé (${url.slice(0, 80)})`);
    }

    return { buf, contentType };
  } catch (err: any) {
    const status = err?.response?.status;
    if ((status === 401 || status === 403 || status === 404) && retryCount === 0) {
      console.warn(`[Sports Relay] HTTP ${status} sur ${source}/${sourceId}, re-résolution du flux...`);
      const fresh = await resolveSportsStream(source, sourceId, true);
      if (fresh?.type === 'hls' && /\.m3u8([?#]|$)/i.test(url)) {
        return fetchRemote(fresh.url, source, sourceId, retryCount + 1);
      }
    }
    throw err;
  }
}

function isSelfReferential(url: URL, req: Request): boolean {
  const selfHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
  if (req.get('host')) selfHosts.push(String(req.get('host')).split(':')[0]);
  return selfHosts.includes(url.hostname);
}

function rewritePlaylist(content: string, baseUrl: string, source: string, sourceId: string): string {
  const relay = (raw: string) => {
    try {
      const resolved = new URL(raw, baseUrl).toString();
      return `/api/sports/match/${source}/${encodeURIComponent(sourceId)}/hls/proxy/${enc(resolved)}`;
    } catch {
      return raw;
    }
  };

  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (line.startsWith('#EXT-X') && /\sURI="([^"]+)"/.test(line)) {
        return line.replace(/URI="([^"]+)"/g, (_m, u: string) => `URI="${relay(u)}"`);
      }
      if (trimmed.startsWith('#')) return line;

      return relay(trimmed);
    })
    .join('\n');
}

function setPlaylistHeaders(res: Response): void {
  res.set('Content-Type', mimePlaylist);
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
}

function setSegmentHeaders(res: Response, contentType?: string): void {
  res.set('Content-Type', contentType?.includes('video') || contentType?.includes('audio') ? contentType : mimeSegment);
  res.set('Cache-Control', 'public, max-age=60, immutable');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
}

// GET /api/sports/match/:source/:matchId/hls/playlist.m3u8
// `?server=N` cible un miroir précis : une même chaîne peut proposer un HLS sur
// un serveur et un player à embarquer sur un autre.
export const getHlsMasterPlaylist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const source = String(req.params.source);
    const sourceId = String(req.params.matchId);
    const forceRefresh = req.query.refresh === 'true' || req.query.force === '1';
    const serverIndex = Number.parseInt(String(req.query.server ?? '0'), 10);

    const stream = await resolveSportsStream(source, sourceId, forceRefresh);
    if (!stream || stream.type !== 'hls') {
      res.status(404).json({ success: false, data: null, message: 'Flux HLS introuvable' });
      return;
    }

    const target = stream.servers[Number.isFinite(serverIndex) ? serverIndex : 0];
    const targetUrl = target?.type === 'hls' ? target.url : stream.url;

    const { buf } = await fetchRemote(targetUrl, source, sourceId);
    setPlaylistHeaders(res);
    res.send(rewritePlaylist(buf.toString('utf8'), targetUrl, source, sourceId));
  } catch (error) {
    next(error);
  }
};

// GET /api/sports/match/:source/:matchId/hls/proxy/:encoded
export const getHlsProxy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const source = String(req.params.source);
    const sourceId = String(req.params.matchId);
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

    if (/\.m3u8([?#]|$)/i.test(remoteUrl)) {
      const { buf } = await fetchRemote(remoteUrl, source, sourceId);
      setPlaylistHeaders(res);
      res.send(rewritePlaylist(buf.toString('utf8'), remoteUrl, source, sourceId));
      return;
    }

    const cached = segmentCache.get(remoteUrl);
    if (cached) {
      setSegmentHeaders(res);
      res.send(cached);
      return;
    }

    const { buf, contentType } = await fetchRemote(remoteUrl, source, sourceId);
    setSegmentHeaders(res, contentType);

    if (buf.length >= 8 * 1024 && buf.length <= 32 * 1024 * 1024) {
      segmentCache.set(remoteUrl, buf);
    }

    res.send(buf);
  } catch (error) {
    next(error);
  }
};
