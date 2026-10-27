import type { Request, Response } from 'express';
import axios, { type AxiosResponse } from 'axios';
import crypto from 'crypto';
import {
  getRememberedOhaVod,
  resolveOhaVod,
  type OhaVodResolved,
} from './oha-vod.client';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const PLAYLIST_MIME = 'application/vnd.apple.mpegurl';
const TOKEN_TTL = 6 * 60 * 60_000;
const MAX_PLAYLIST_SIZE = 4 * 1024 * 1024;

function secret(): string {
  return process.env.OHA_RELAY_SECRET
    || process.env.JWT_SECRET
    || 'chillers-oha-relay-v1';
}

type HeaderMap = Record<string, string>;

interface RelayPayload {
  u: string;
  e?: string;
  r?: string;
  h?: HeaderMap;
  k: 'root' | 'child';
  p?: boolean;
  x: number;
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function sign(payload: RelayPayload): string {
  const body = base64url(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token: string): RelayPayload | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as RelayPayload;
    if (!payload || typeof payload.u !== 'string' || typeof payload.x !== 'number') return null;
    if (payload.k !== 'root' && payload.k !== 'child') return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildOhaRelayUrl(
  resolved: OhaVodResolved,
  embed: string,
  type: 'hls' | 'mp4',
): string {
  const payload: RelayPayload = {
    u: resolved.url,
    e: embed,
    r: resolved.referer,
    h: resolved.headers,
    k: 'root',
    p: type === 'hls',
    x: Date.now() + TOKEN_TTL,
  };
  const route = type === 'hls' ? 'hls' : 'file';
  return `/api/stream/oha/${route}?token=${encodeURIComponent(sign(payload))}`;
}

function blockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '::1' || host === '0.0.0.0') return true;
  if (host.includes(':') && /^(fc|fd|fe80)/i.test(host)) return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function safeRedirect(options: { hostname?: string }): void {
  if (options.hostname && blockedHost(options.hostname)) {
    throw new Error('Redirection vers un hôte privé refusée');
  }
}

function originOf(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

function requestHeaders(payload: RelayPayload, req: Request): HeaderMap {
  const headers: HeaderMap = {
    'user-agent': USER_AGENT,
    accept: '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'accept-encoding': 'identity',
    ...(payload.h || {}),
  };
  if (payload.r) {
    headers.referer = payload.r;
    const origin = originOf(payload.r);
    if (origin) headers.origin = origin;
  }
  if (req.headers.range) headers.range = String(req.headers.range);
  if (req.headers['if-range']) headers['if-range'] = String(req.headers['if-range']);
  return headers;
}

function upstream(url: string, payload: RelayPayload, req: Request): Promise<AxiosResponse> {
  return axios.request({
    url,
    method: req.method === 'HEAD' ? 'HEAD' : 'GET',
    headers: requestHeaders(payload, req),
    responseType: 'stream',
    timeout: 25_000,
    maxRedirects: 5,
    decompress: false,
    maxContentLength: -1,
    maxBodyLength: -1,
    validateStatus: (status) => (status >= 200 && status < 400) || status === 416,
    beforeRedirect: safeRedirect,
  });
}

function relayUrlFor(raw: string, baseUrl: string, payload: RelayPayload): string {
  let absolute: string;
  try {
    absolute = new URL(raw, baseUrl).toString();
  } catch {
    return raw;
  }
  if (!/^https?:\/\//i.test(absolute)) return raw;
  const child: RelayPayload = {
    u: absolute,
    r: payload.r,
    h: payload.h,
    k: 'child',
    p: /\.m3u8?(?:[?#]|$)/i.test(absolute),
    x: payload.x,
  };
  return `/api/stream/oha/hls?token=${encodeURIComponent(sign(child))}`;
}

function rewritePlaylist(content: string, baseUrl: string, payload: RelayPayload): string {
  return content
    .split(/\r?\n/)
    .map((line) => {
      if (line.includes('URI="')) {
        return line.replace(/URI="([^"]*)"/g, (_match, uri: string) => `URI="${relayUrlFor(uri, baseUrl, payload)}"`);
      }
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      return relayUrlFor(trimmed, baseUrl, payload);
    })
    .join('\n');
}

function setCors(res: Response): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Range, If-Range');
  res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');
}

function setPlaylistHeaders(res: Response): void {
  setCors(res);
  res.set('Content-Type', PLAYLIST_MIME);
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

function segmentMime(url: string, upstreamType?: string): string {
  const type = String(upstreamType || '').toLowerCase();
  if (type && !type.includes('text/html')) return type;
  if (/\.m4s(?:[?#]|$)/i.test(url)) return 'video/iso.segment';
  if (/\.(ts|m2ts)(?:[?#]|$)/i.test(url)) return 'video/mp2t';
  if (/\.m4a(?:[?#]|$)/i.test(url)) return 'audio/mp4';
  if (/\.aac(?:[?#]|$)/i.test(url)) return 'audio/aac';
  if (/\.vtt(?:[?#]|$)/i.test(url)) return 'text/vtt';
  if (/\.(mp4|m4v)(?:[?#]|$)/i.test(url)) return 'video/mp4';
  return 'application/octet-stream';
}

function copySegmentHeaders(res: Response, response: AxiosResponse, url: string): void {
  setCors(res);
  res.set('Content-Type', segmentMime(url, String(response.headers['content-type'] || '')));
  for (const key of ['content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag', 'cache-control']) {
    const value = response.headers[key];
    if (value) res.set(key, String(value));
  }
}

async function readStream(stream: NodeJS.ReadableStream, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    const buffer = Buffer.from(chunk);
    chunks.push(buffer);
    size += buffer.length;
    if (size >= maxBytes) break;
  }
  return Buffer.concat(chunks).subarray(0, maxBytes);
}

function destroy(response: AxiosResponse): void {
  (response.data as { destroy?: () => void } | undefined)?.destroy?.();
}

export async function handleOhaRelay(req: Request, res: Response): Promise<void> {
  const payload = verify(String(req.query.token || ''));
  if (!payload) {
    res.status(403).json({ success: false, data: null, message: 'Jeton OHA invalide' });
    return;
  }
  if (payload.x < Date.now()) {
    res.status(403).json({ success: false, data: null, message: 'Jeton OHA expiré' });
    return;
  }

  let target = payload.u;
  let effective = payload;

  if (payload.k === 'root' && payload.e) {
    const remembered = getRememberedOhaVod(payload.e);
    if (remembered) {
      target = remembered.url;
      effective = {
        ...payload,
        u: remembered.url,
        r: remembered.referer,
        h: remembered.headers,
        p: remembered.format === 'hls' || /\.m3u8?(?:[?#]|$)/i.test(remembered.url),
      };
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    res.status(400).json({ success: false, data: null, message: 'URL OHA invalide' });
    return;
  }
  if (!/^https?:$/.test(parsed.protocol) || blockedHost(parsed.hostname)) {
    res.status(403).json({ success: false, data: null, message: 'Hôte OHA interdit' });
    return;
  }

  try {
    let response = await upstream(target, effective, req);
    const retryable = response.status === 401 || response.status === 403 || response.status === 404;

    if (retryable && payload.k === 'root' && payload.e) {
      destroy(response);
      const fresh = await resolveOhaVod(payload.e, { force: true });
      if (fresh) {
        target = fresh.url;
        effective = {
          ...payload,
          u: fresh.url,
          r: fresh.referer,
          h: fresh.headers,
          p: fresh.format === 'hls' || /\.m3u8?(?:[?#]|$)/i.test(fresh.url),
        };
        response = await upstream(target, effective, req);
      }
    }

    if (response.status >= 400) {
      destroy(response);
      res.status(response.status === 416 ? 416 : 502).json({
        success: false,
        data: null,
        message: `Flux OHA indisponible (${response.status})`,
      });
      return;
    }

    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    const isPlaylist =
      effective.p === true
      || /\.m3u8?(?:[?#]|$)/i.test(target)
      || contentType.includes('mpegurl');

    if (isPlaylist) {
      if (req.method === 'HEAD') {
        destroy(response);
        setPlaylistHeaders(res);
        res.status(200).end();
        return;
      }
      const buffer = await readStream(response.data, MAX_PLAYLIST_SIZE);
      const content = buffer.toString('utf8');
      if (!content.trimStart().startsWith('#EXTM3U')) {
        res.status(502).json({ success: false, data: null, message: 'Playlist OHA invalide' });
        return;
      }
      const baseUrl = response.request?.res?.responseUrl || target;
      setPlaylistHeaders(res);
      res.status(200).send(rewritePlaylist(content, baseUrl, effective));
      return;
    }

    if (contentType.includes('text/html')) {
      destroy(response);
      res.status(502).json({ success: false, data: null, message: 'Réponse HTML au lieu du média OHA' });
      return;
    }

    copySegmentHeaders(res, response, target);
    res.status(response.status);

    if (req.method === 'HEAD') {
      destroy(response);
      res.end();
      return;
    }

    response.data.on('error', () => res.destroy());
    res.on('close', () => destroy(response));
    response.data.pipe(res);
  } catch {
    if (!res.headersSent) {
      res.status(502).json({ success: false, data: null, message: 'Relay OHA indisponible' });
    } else {
      res.destroy();
    }
  }
}
