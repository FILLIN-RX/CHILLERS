import type { Request, Response } from 'express';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function extractTargetUrl(rawParam: string): string {
  let cur = rawParam.trim();
  while (cur.includes('/api/live/proxy?url=') || cur.includes('proxy%3Furl%3D')) {
    try {
      const decoded = decodeURIComponent(cur);
      const match = decoded.match(/proxy\?url=(https?:\/\/[^\s&]+)/i);
      if (match && match[1]) cur = match[1];
      else break;
    } catch {
      break;
    }
  }
  return cur;
}

/** Garde-fou SSRF : refuse les cibles réseau privées / loopback. */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const a = Number(v4[1]);
  const b = Number(v4[2]);
  if (a === 10 || a === 127 || a === 0 || a >= 224) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function proxyUrl(absoluteUrl: string, referer: string): string {
  return `/api/live/proxy?url=${encodeURIComponent(absoluteUrl)}${
    referer ? `&referer=${encodeURIComponent(referer)}` : ''
  }`;
}

export async function liveProxy(req: Request, res: Response): Promise<void> {
  const urlParam = typeof req.query.url === 'string' ? req.query.url : '';
  if (!urlParam) {
    res.status(400).send('Missing url parameter');
    return;
  }

  const cleanUrl = extractTargetUrl(urlParam);
  let targetUrl: URL;
  try {
    targetUrl = /^https?:\/\//i.test(cleanUrl) ? new URL(cleanUrl) : new URL(cleanUrl, `${req.protocol}://${req.get('host')}`);
  } catch {
    res.status(400).send('Invalid URL parameter');
    return;
  }

  const selfHost = req.get('host')?.split(':')[0];
  const sameOrigin = targetUrl.hostname === selfHost || targetUrl.hostname === 'localhost' || targetUrl.hostname === '127.0.0.1';
  if (!sameOrigin && isBlockedHost(targetUrl.hostname)) {
    res.status(400).send('Forbidden target host');
    return;
  }

  const refererParam = typeof req.query.referer === 'string' ? req.query.referer : '';
  const rangeParam = typeof req.headers.range === 'string' ? req.headers.range : undefined;
  const ifRangeParam = typeof req.headers['if-range'] === 'string' ? req.headers['if-range'] : undefined;

  try {
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Accept: '*/*',
      Referer: refererParam || `${targetUrl.protocol}//${targetUrl.host}/`,
    };
    if (rangeParam) headers.Range = rangeParam;
    if (ifRangeParam) headers['If-Range'] = ifRangeParam;

    const controller = new AbortController();
    const connectTimer = setTimeout(() => controller.abort(), 8_000);
    const upstream = await fetch(targetUrl.toString(), { headers, signal: controller.signal }).finally(() =>
      clearTimeout(connectTimer),
    );

    if (!upstream.ok) {
      res.status(upstream.status).send(`Upstream error: ${upstream.status}`);
      return;
    }

    const contentType = upstream.headers.get('content-type') || '';
    const isM3u8 =
      contentType.includes('mpegurl') ||
      contentType.includes('application/x-mpegURL') ||
      targetUrl.pathname.endsWith('.m3u8');

    if (isM3u8) {
      const text = await upstream.text();
      const baseUrl = targetUrl.href.substring(0, targetUrl.href.lastIndexOf('/') + 1);
      const rewritten = text.split('\n').map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          if (trimmed.startsWith('#EXT-X-KEY') || trimmed.startsWith('#EXT-X-MEDIA')) {
            return trimmed.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
              const absoluteUri = uri.startsWith('http') ? uri : new URL(uri, baseUrl).href;
              return `URI="${proxyUrl(absoluteUri, refererParam)}"`;
            });
          }
          return line;
        }
        const absoluteUrl = trimmed.startsWith('http') ? trimmed : new URL(trimmed, baseUrl).href;
        return proxyUrl(absoluteUrl, refererParam);
      });

      res.status(200);
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(rewritten.join('\n'));
      return;
    }

    res.status(upstream.status);
    res.setHeader('Content-Type', contentType || 'video/MP2T');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range,Accept-Ranges,Content-Length');
    res.setHeader('Cache-Control', rangeParam ? 'no-store' : 'public, max-age=3600');
    for (const name of ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    if (!res.getHeader('Accept-Ranges')) res.setHeader('Accept-Ranges', 'bytes');

    const reader = upstream.body?.getReader();
    if (!reader) {
      res.end();
      return;
    }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    if (!res.headersSent) res.status(502);
    res.end(`Proxy error: ${message}`);
  }
}

export function liveProxyOptions(_req: Request, res: Response): void {
  res.status(204);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.end();
}
