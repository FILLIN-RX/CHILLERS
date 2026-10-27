/**
 * Relay HLS « URL directe » du lab.
 *
 * Le relay sports existant (`utils/sports.hls-relay.ts`) résout le flux via la
 * chaîne de providers par `source:sourceId` — inutilisable pour les liens du
 * snapshot `report.json`, qui sont des URLs brutes déjà probeées. Ici on part
 * de l'URL encodée, avec le Referer de la fiche, et on rejoue playlist +
 * segments depuis le backend (même origine, pas de CORS, tokens côté serveur).
 */
import type { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import http from 'http';
import https from 'https';
import { LRUCache } from 'lru-cache';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const mimePlaylist = 'application/vnd.apple.mpegurl';
const mimeSegment = 'video/mp2t';

const enc = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
const dec = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50, timeout: 15_000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50, timeout: 15_000 });

const segmentCache = new LRUCache<string, Buffer>({ max: 600, ttl: 60_000 });
/** Referer par origine distante : les segments arrivent sur d'autres chemins. */
const refererByOrigin = new LRUCache<string, string>({ max: 300, ttl: 10 * 60_000 });

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return 'https://placeholder.invalid';
  }
}

function isSelfReferential(url: URL, req: Request): boolean {
  const selfHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
  const host = req.get('host');
  if (host) selfHosts.push(host.split(':')[0]);
  return selfHosts.includes(url.hostname);
}

function decodeTarget(raw: string, req: Request): URL | null {
  let decoded: string;
  try {
    decoded = dec(raw);
  } catch {
    return null;
  }
  let url: URL;
  try {
    url = new URL(decoded);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (isSelfReferential(url, req)) return null;
  return url;
}

async function fetchRemote(
  url: string,
  referer?: string,
  retry = 0
): Promise<{ buf: Buffer; contentType: string }> {
  const pageReferer = referer || originOf(url);
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
        Referer: pageReferer,
        Origin: originOf(pageReferer),
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        Connection: 'keep-alive',
      },
    });

    const contentType = String(headers['content-type'] ?? '');
    const buf = Buffer.from(data);
    if (contentType.includes('text/html') && buf.subarray(0, 15).toString().toLowerCase().includes('<!doc')) {
      throw new Error(`Challenge HTML renvoyé (${url.slice(0, 80)})`);
    }
    return { buf, contentType };
  } catch (err) {
    // Jeton expiré : on retente une fois avec le Referer par défaut de l'origine.
    const status = (err as { response?: { status?: number } })?.response?.status;
    if ((status === 401 || status === 403 || status === 404) && retry === 0 && referer) {
      refererByOrigin.set(originOf(url), '');
      return fetchRemote(url, undefined, retry + 1);
    }
    throw err;
  }
}

function rewritePlaylist(content: string, baseUrl: string): string {
  const relay = (raw: string) => {
    try {
      const resolved = new URL(raw, baseUrl).toString();
      return `/api/sports/lab/proxy/${enc(resolved)}`;
    } catch {
      return raw;
    }
  };

  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#EXT-X') && /\sURI="([^"]+)"/.test(trimmed)) {
        return trimmed.replace(/URI="([^"]+)"/g, (_m, u) => `URI="${relay(u)}"`);
      }
      if (trimmed.startsWith('#')) return trimmed;
      return relay(trimmed);
    })
    .join('\n');
}

function setPlaylistHeaders(res: Response): void {
  res.set('Content-Type', mimePlaylist);
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.set('Access-Control-Allow-Origin', '*');
}

function setSegmentHeaders(res: Response, contentType?: string): void {
  res.set(
    'Content-Type',
    contentType?.includes('video') || contentType?.includes('audio') ? contentType : mimeSegment
  );
  res.set('Cache-Control', 'public, max-age=60, immutable');
  res.set('Access-Control-Allow-Origin', '*');
}

/** GET /api/sports/lab/play?u=<url base64url>&r=<referer base64url> */
export const getLabPlaylist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = String(req.query.u || '');
    const target = decodeTarget(raw, req);
    if (!target) {
      res.status(400).json({ success: false, data: null, message: 'URL invalide' });
      return;
    }

    const refRaw = req.query.r ? String(req.query.r) : '';
    let referer = '';
    try {
      referer = refRaw ? dec(refRaw) : '';
    } catch {
      referer = '';
    }
    const origin = target.origin;
    referer = referer || refererByOrigin.get(origin) || '';
    if (referer) refererByOrigin.set(origin, referer);

    const { buf } = await fetchRemote(target.toString(), referer);
    setPlaylistHeaders(res);
    res.send(rewritePlaylist(buf.toString('utf8'), target.toString()));
  } catch (error) {
    next(error);
  }
};

/** GET /api/sports/lab/proxy/:encoded — segment ou playlist enfant. */
export const getLabProxy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const target = decodeTarget(String(req.params.encoded ?? ''), req);
    if (!target) {
      res.status(400).json({ success: false, data: null, message: 'URL invalide' });
      return;
    }

    const remoteUrl = target.toString();
    const referer = refererByOrigin.get(target.origin) || undefined;

    if (/\.m3u8([?#]|$)/i.test(remoteUrl)) {
      const { buf } = await fetchRemote(remoteUrl, referer);
      setPlaylistHeaders(res);
      res.send(rewritePlaylist(buf.toString('utf8'), remoteUrl));
      return;
    }

    const cached = segmentCache.get(remoteUrl);
    if (cached) {
      setSegmentHeaders(res);
      res.send(cached);
      return;
    }

    const { buf, contentType } = await fetchRemote(remoteUrl, referer);
    setSegmentHeaders(res, contentType);
    if (buf.length >= 8 * 1024 && buf.length <= 32 * 1024 * 1024) {
      segmentCache.set(remoteUrl, buf);
    }
    res.send(buf);
  } catch (error) {
    next(error);
  }
};
