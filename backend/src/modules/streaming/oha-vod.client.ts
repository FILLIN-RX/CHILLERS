import axios from 'axios';
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { LRUCache } from 'lru-cache';

const OHA_BASE = 'https://oha.to/vod';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const SOURCE_TTL = 5 * 60_000;
const RESOLVE_MEMORY_TTL = 15 * 60_000;
const RESOLVE_TIMEOUT = 10_000;
const HOP_TIMEOUT = 8_000;
const TOTAL_TIMEOUT = 20_000;
const MAX_HOPS = 12;
const MAX_BODY = 8 * 1024 * 1024;
const PROBE_TIMEOUT = 8_000;

export interface OhaVodSource {
  url: string;
  name?: string;
  quality?: string;
  languages?: string[];
}

export interface OhaVodResolved {
  url: string;
  format?: string;
  referer?: string;
  headers: Record<string, string>;
  embed: string;
}

type HeaderMap = Record<string, string>;

interface ClientFetchDescriptor {
  id: string;
  url: string;
  method?: string;
  headers?: Record<string, unknown>;
}

const sourceCache = new LRUCache<string, OhaVodSource[]>({ max: 800, ttl: SOURCE_TTL });
const resolvedMemory = new LRUCache<string, OhaVodResolved>({ max: 800, ttl: RESOLVE_MEMORY_TTL });
const inFlight = new Map<string, Promise<OhaVodResolved | null>>();

function normalizeHeaders(input: unknown): HeaderMap {
  const out: HeaderMap = {};
  if (!input || typeof input !== 'object') return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return out;
}

function keepRelayHeaders(input: unknown): HeaderMap {
  const allowed = new Set(['referer', 'origin', 'cookie', 'authorization', 'user-agent']);
  const out: HeaderMap = {};
  for (const [key, value] of Object.entries(normalizeHeaders(input))) {
    if (allowed.has(key) && value) out[key] = value;
  }
  return out;
}

function hostKey(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

class CookieJar {
  private readonly byHost = new Map<string, Map<string, string>>();

  absorb(url: string, setCookie: string[]): void {
    if (!setCookie.length) return;
    const host = hostKey(url);
    if (!host) return;
    let store = this.byHost.get(host);
    if (!store) {
      store = new Map();
      this.byHost.set(host, store);
    }
    for (const raw of setCookie) {
      const pair = raw.split(';')[0] || '';
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (name) store.set(name, value);
    }
  }

  headerFor(url: string): string | undefined {
    const host = hostKey(url);
    if (!host) return undefined;
    const store = this.byHost.get(host);
    if (!store?.size) return undefined;
    return [...store.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }
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

function isSafeUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return /^https?:$/.test(parsed.protocol) && !blockedHost(parsed.hostname);
  } catch {
    return false;
  }
}

function safeRedirect(options: { hostname?: string }): void {
  if (options.hostname && blockedHost(options.hostname)) {
    throw new Error('Redirection vers un hôte privé refusée');
  }
}

async function fetchSources(key: string, endpoint: string): Promise<OhaVodSource[]> {
  const cached = sourceCache.get(key);
  if (cached) return cached;
  try {
    const { data } = await axios.get(`${OHA_BASE}/${endpoint}`, {
      timeout: RESOLVE_TIMEOUT,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      validateStatus: (status) => status >= 200 && status < 300,
    });
    const sources = Array.isArray(data?.sources)
      ? data.sources.filter((item: unknown): item is OhaVodSource => {
          const source = item as OhaVodSource | null;
          return !!source && typeof source.url === 'string' && /^https?:\/\//i.test(source.url);
        })
      : [];
    if (sources.length) sourceCache.set(key, sources);
    return sources;
  } catch {
    return [];
  }
}

export function fetchOhaMovieSources(tmdbId: number): Promise<OhaVodSource[]> {
  return fetchSources(`movie:${tmdbId}`, `source/movie/tmdb:${tmdbId}.json`);
}

export function fetchOhaEpisodeSources(
  tmdbId: number,
  season: number,
  episode: number,
): Promise<OhaVodSource[]> {
  const key = `ep:${tmdbId}:${season}:${episode}`;
  return fetchSources(key, `source/series/tmdb:${tmdbId}:${season}:${episode}.json`);
}

function hostScore(url: string): number {
  const scores: Array<[RegExp, number]> = [
    [/dood\./i, 40],
    [/voe\.sx/i, 34],
    [/filemoon/i, 28],
    [/veev\.to/i, 24],
    [/supervideo/i, 20],
    [/mixdrop/i, 16],
    [/streamtape/i, 10],
    [/vidoza/i, 8],
    [/luluvdo/i, 6],
  ];
  return scores.find(([pattern]) => pattern.test(url))?.[1] ?? 0;
}

function qualityScore(quality?: string): number {
  if (!quality) return 0;
  if (/2160|4k/i.test(quality)) return 40;
  if (/1440/i.test(quality)) return 34;
  if (/1080/i.test(quality)) return 30;
  if (/720/i.test(quality)) return 24;
  if (/hd/i.test(quality)) return 18;
  if (/480/i.test(quality)) return 12;
  return 0;
}

export function selectOhaVodSources(sources: OhaVodSource[], language?: string): OhaVodSource[] {
  const wanted = (language || 'fr').toLowerCase();
  return sources
    .filter((source) => {
      const languages = (source.languages || []).map((lang) => String(lang).toLowerCase());
      return languages.includes(wanted);
    })
    .map((source) => ({ source, score: qualityScore(source.quality) + hostScore(source.url) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.source);
}

export function getRememberedOhaVod(embed: string): OhaVodResolved | undefined {
  return resolvedMemory.get(embed);
}

async function resolveDescriptor(embed: string): Promise<ClientFetchDescriptor | null> {
  try {
    const { data } = await axios.get(`${OHA_BASE}/resolve`, {
      params: { url: embed },
      timeout: RESOLVE_TIMEOUT,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      validateStatus: (status) => status >= 200 && status < 300,
    });
    const descriptor = data?.clientFetch as ClientFetchDescriptor | undefined;
    if (!descriptor || typeof descriptor.id !== 'string' || typeof descriptor.url !== 'string') {
      return null;
    }
    if (!isSafeUrl(descriptor.url)) return null;
    return descriptor;
  } catch {
    return null;
  }
}

interface HopResult {
  id: string;
  status: number;
  url: string;
  headers: HeaderMap;
  body: string;
}

interface RawHop {
  status: number;
  url: string;
  headers: HeaderMap;
  setCookie: string[];
  body: Buffer;
}

function isCloudflareChallenge(status: number, body: Buffer): boolean {
  if (status !== 403 && status !== 503) return false;
  const text = body.subarray(0, 12_000).toString('utf8').toLowerCase();
  return (
    text.includes('__cf_chl')
    || text.includes('just a moment')
    || text.includes('challenge-platform')
    || text.includes('enable javascript and cookies')
  );
}

function parseCurlHeaderBlock(raw: string): { status: number; headers: HeaderMap; setCookie: string[] } {
  const blocks = raw.split(/\r?\n\r?\n/).filter((block) => /^HTTP\//i.test(block.trim()));
  const block = blocks[blocks.length - 1] || '';
  const lines = block.split(/\r?\n/);
  const status = Number((lines[0] || '').split(/\s+/)[1]) || 0;
  const headers: HeaderMap = {};
  const setCookie: string[] = [];
  for (const line of lines.slice(1)) {
    const index = line.indexOf(':');
    if (index <= 0) continue;
    const name = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    if (!name || !value) continue;
    if (name === 'set-cookie') {
      setCookie.push(value);
    } else {
      headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
    }
  }
  return { status, headers, setCookie };
}

function curlHop(
  url: string,
  method: string,
  headers: HeaderMap,
  timeoutMs: number,
): Promise<RawHop | null> {
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    const headerFile = path.join(os.tmpdir(), `oha-h-${id}.txt`);
    const bodyFile = path.join(os.tmpdir(), `oha-b-${id}.bin`);
    const args = [
      '-sS',
      '-L',
      '--max-redirs',
      '5',
      '--max-time',
      Math.max(1, timeoutMs / 1000).toFixed(1),
      '--max-filesize',
      String(MAX_BODY),
      '-X',
      method,
      '-D',
      headerFile,
      '-o',
      bodyFile,
      '-w',
      '%{http_code}\n%{url_effective}',
    ];
    for (const [name, value] of Object.entries(headers)) {
      if (value && !/[\r\n]/.test(value)) args.push('-H', `${name}: ${value}`);
    }
    args.push(url);

    const child = spawn(process.env.OHA_CURL_BIN || 'curl', args, {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.on('error', () => resolve(null));
    child.on('close', async (code) => {
      try {
        if (code !== 0) {
          resolve(null);
          return;
        }
        const lines = stdout.trim().split(/\r?\n/);
        const status = Number(lines[lines.length - 2]) || 0;
        const finalUrl = lines[lines.length - 1] || url;
        const [rawHeaders, body] = await Promise.all([
          fs.readFile(headerFile, 'utf8').catch(() => ''),
          fs.readFile(bodyFile).catch(() => Buffer.alloc(0)),
        ]);
        const parsed = parseCurlHeaderBlock(rawHeaders);
        resolve({
          status: parsed.status || status,
          url: finalUrl,
          headers: parsed.headers,
          setCookie: parsed.setCookie,
          body: body.subarray(0, MAX_BODY),
        });
      } catch {
        resolve(null);
      } finally {
        void fs.unlink(headerFile).catch(() => {});
        void fs.unlink(bodyFile).catch(() => {});
      }
    });
  });
}

async function axiosHop(
  url: string,
  method: string,
  headers: HeaderMap,
  timeout: number,
): Promise<RawHop | null> {
  try {
    const response = await axios.request({
      url,
      method,
      headers,
      timeout,
      responseType: 'arraybuffer',
      maxContentLength: MAX_BODY,
      maxBodyLength: MAX_BODY,
      maxRedirects: 5,
      decompress: false,
      validateStatus: () => true,
      beforeRedirect: safeRedirect,
    });
    const responseHeaders = normalizeHeaders(response.headers);
    const rawSetCookie = response.headers['set-cookie'];
    return {
      status: response.status,
      url: response.request?.res?.responseUrl || url,
      headers: responseHeaders,
      setCookie: Array.isArray(rawSetCookie)
        ? rawSetCookie.map(String)
        : rawSetCookie
          ? [String(rawSetCookie)]
          : [],
      body: Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data ?? ''),
    };
  } catch (error) {
    if (process.env.OHA_DEBUG) console.warn('[OHA] hop failed:', (error as Error).message);
    return null;
  }
}

async function performHop(
  descriptor: ClientFetchDescriptor,
  jar: CookieJar,
  deadline: number,
): Promise<HopResult | null> {
  const timeout = Math.min(HOP_TIMEOUT, deadline - Date.now());
  if (timeout <= 0 || !isSafeUrl(descriptor.url)) return null;
  const headers = normalizeHeaders(descriptor.headers);
  headers['accept-encoding'] = 'identity';
  if (!headers['user-agent']) headers['user-agent'] = USER_AGENT;
  const cookie = jar.headerFor(descriptor.url);
  if (cookie) headers.cookie = cookie;

  const method = (descriptor.method || 'GET').toUpperCase();
  let hop = await axiosHop(descriptor.url, method, headers, timeout);

  if (hop && (hop.status === 403 || hop.status === 503)) {
    if (process.env.OHA_DEBUG) console.warn('[OHA] HTTP', hop.status, '— nouvelle tentative via curl');
    const viaCurl = await curlHop(descriptor.url, method, headers, timeout);
    if (viaCurl && !isCloudflareChallenge(viaCurl.status, viaCurl.body)) hop = viaCurl;
  }

  if (!hop) return null;

  jar.absorb(hop.url, hop.setCookie);

  const kept: HeaderMap = {};
  if (hop.setCookie.length) kept['set-cookie'] = hop.setCookie.join(', ');
  for (const key of [
    'content-type',
    'content-length',
    'last-modified',
    'etag',
    'location',
    'cache-control',
    'set-cookie',
  ]) {
    if (hop.headers[key]) kept[key] = hop.headers[key];
  }

  if (process.env.OHA_DEBUG) {
    console.log(
      '[OHA] hop',
      descriptor.url.slice(0, 100),
      '→',
      hop.status,
      hop.url.slice(0, 100),
      'bytes',
      hop.body.length,
      'headers',
      Object.keys(kept).join(','),
    );
  }

  return {
    id: descriptor.id,
    status: hop.status,
    url: hop.url,
    headers: kept,
    body: hop.body.subarray(0, MAX_BODY).toString('base64'),
  };
}

async function submitHop(result: HopResult, deadline: number): Promise<Record<string, unknown> | null> {
  const timeout = Math.min(HOP_TIMEOUT, deadline - Date.now());
  if (timeout <= 0) return null;
  try {
    const { data } = await axios.post(
      `${OHA_BASE}/client-fetch`,
      {
        id: result.id,
        status: result.status,
        url: result.url,
        headers: result.headers,
        body: result.body,
        encoding: 'base64',
      },
      {
        timeout,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        maxBodyLength: MAX_BODY * 2,
        validateStatus: (status) => status >= 200 && status < 300,
      },
    );
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  } catch (error) {
    if (process.env.OHA_DEBUG) {
      const err = error as { message?: string; response?: { status?: number; data?: unknown } };
      console.warn('[OHA] client-fetch failed:', err.message, err.response?.status, JSON.stringify(err.response?.data).slice(0, 500));
    }
    return null;
  }
}

async function runResolution(embed: string): Promise<OhaVodResolved | null> {
  const deadline = Date.now() + TOTAL_TIMEOUT;
  const jar = new CookieJar();
  let descriptor = await resolveDescriptor(embed);
  if (!descriptor) return null;

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (Date.now() >= deadline) return null;
    const result = await performHop(descriptor, jar, deadline);
    if (!result) return null;
    const next = await submitHop(result, deadline);
    if (!next) return null;

    const nextDescriptor = next.clientFetch as ClientFetchDescriptor | undefined;
    if (nextDescriptor && typeof nextDescriptor.url === 'string') {
      if (!isSafeUrl(nextDescriptor.url)) return null;
      descriptor = nextDescriptor;
      continue;
    }

    if (typeof next.url === 'string' && isSafeUrl(next.url)) {
      if (next.live === true) return null;
      const headers = keepRelayHeaders(next.headers);
      const resolved: OhaVodResolved = {
        url: next.url,
        format: typeof next.format === 'string' ? next.format : undefined,
        referer: headers.referer,
        headers,
        embed,
      };
      resolvedMemory.set(embed, resolved);
      return resolved;
    }

    return null;
  }

  return null;
}

export async function resolveOhaVod(
  embed: string,
  opts?: { force?: boolean },
): Promise<OhaVodResolved | null> {
  if (!opts?.force) {
    const remembered = resolvedMemory.get(embed);
    if (remembered) return remembered;
  }

  const pending = inFlight.get(embed);
  if (pending) return pending;

  const task = runResolution(embed).finally(() => inFlight.delete(embed));
  inFlight.set(embed, task);
  return task;
}

export async function probeOhaVod(resolved: OhaVodResolved): Promise<'hls' | 'mp4' | null> {
  if (!isSafeUrl(resolved.url)) return null;
  const headers: HeaderMap = {
    'user-agent': USER_AGENT,
    accept: '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'accept-encoding': 'identity',
    range: 'bytes=0-4095',
    ...resolved.headers,
  };
  if (resolved.referer) {
    headers.referer = resolved.referer;
    try {
      headers.origin = new URL(resolved.referer).origin;
    } catch {}
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
  try {
    const response = await axios.get(resolved.url, {
      headers,
      responseType: 'stream',
      timeout: PROBE_TIMEOUT,
      maxRedirects: 5,
      decompress: false,
      signal: controller.signal,
      validateStatus: (status) => (status >= 200 && status < 400) || status === 416,
      beforeRedirect: safeRedirect,
    });

    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    const chunks: Buffer[] = [];
    let size = 0;
    if (response.data && typeof response.data[Symbol.asyncIterator] === 'function') {
      for await (const chunk of response.data as AsyncIterable<Buffer>) {
        chunks.push(Buffer.from(chunk));
        size += chunk.length;
        if (size >= 4096) break;
      }
    }
    (response.data as { destroy?: () => void } | undefined)?.destroy?.();
    const head = Buffer.concat(chunks).subarray(0, 4096);
    const text = head.toString('utf8').replace(/^\uFEFF/, '');

    if (/mpegurl/i.test(contentType) || text.trimStart().startsWith('#EXTM3U')) return 'hls';
    if (/^video\//i.test(contentType)) return 'mp4';
    if (head.length >= 12 && head.subarray(4, 8).toString('latin1') === 'ftyp') return 'mp4';
    if (/octet-stream/i.test(contentType)) return 'mp4';
    if (/^\s*<(!doctype|html)/i.test(text)) return null;
    return response.status < 400 ? 'mp4' : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
