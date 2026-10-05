/**
 * Source « streamiz » — streamiz.lol.
 *
 * streamiz.lol n'est qu'une coquille publicitaire autour de livetv902.me. Le
 * player de livetv902.me renvoie vers des pages de relais qui, elles, livrent
 * l'iframe du lecteur final. On reproduit les deux sauts.
 */
import crypto from 'crypto';
import axios from 'axios';
import { LRUCache } from 'lru-cache';
import type { ResolvedSportsStream, SportsMatch, SportsServer } from './sports.types';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const STREAMIZ_ROOT = (process.env.STREAMIZ_URL || 'https://streamiz.lol').replace(/\/+$/, '');
const STREAMIZ_PAGE = `${STREAMIZ_ROOT}/vipleaguetv/`;

/**
 * Le programme de livetv902 est exprimé dans le fuseau de la source, qui est
 * décalé par rapport à l'UTC (le même programme apparaît 2h plus tard sur
 * l'API kora, qui est en UTC). Ajuster ici si la source change de fuseau.
 */
const STREAMIZ_TZ_OFFSET_HOURS = Number(process.env.STREAMIZ_TZ_OFFSET ?? 2);

// L'identifiant exposé dans les URL ne doit contenir ni « / » ni « : » :
// on condense donc la sourceId (une URL) en un hash court et stable.
const shortHash = (value: string) => crypto.createHash('sha1').update(value).digest('hex').slice(0, 12);

const MATCH_CACHE = new LRUCache<string, SportsMatch[]>({ max: 10, ttl: 60_000 });
const STREAM_CACHE = new LRUCache<string, ResolvedSportsStream>({ max: 60, ttl: 5 * 60_000 });

async function fetchText(url: string, referer?: string, timeout = 12_000): Promise<string> {
  const { data } = await axios.get<string>(url, {
    timeout,
    responseType: 'text',
    transformResponse: [(d) => d],
    maxRedirects: 5,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      ...(referer ? { Referer: referer } : {}),
    },
  });
  return typeof data === 'string' ? data : String(data);
}

function extractIframe(html: string): string | null {
  const match = html.match(/<iframe[^>]+src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  const src = match?.[1] || match?.[2] || match?.[3];
  if (!src) return null;
  try {
    return new URL(src, 'https://placeholder.invalid').toString();
  } catch {
    return null;
  }
}

const decodeEntities = (s: string) =>
  s
    .replace(/&ndash;|&mdash;/gi, '-')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const ISO3 = /\s+[A-Z]{3}$/;

/** Programme de streamiz, lu dans le tableau de livetv902.me. */
export async function getStreamizMatches(): Promise<SportsMatch[]> {
  const cached = MATCH_CACHE.get('streamiz');
  if (cached) return cached;

  try {
    // streamiz ne sert qu'un iframe : on remonte à la source réelle.
    const shell = await fetchText(STREAMIZ_PAGE);
    const inner = extractIframe(shell);
    const html = inner ? await fetchText(inner, STREAMIZ_PAGE) : shell;

    const nowSec = Math.floor(Date.now() / 1000);
    const today = new Date();
    // Minuit UTC du jour, recalé sur le fuseau de la source.
    const dayStart = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / 1000);

    const matches: SportsMatch[] = [];

    for (const row of html.split(/<tr[\s>]/i).slice(1)) {
      const title = row.match(/class="title"[^>]*>([\s\S]*?)<\/a>/i);
      if (!title) continue;

      const label = decodeEntities(title[1]);
      if (!label || !/ - /.test(label)) continue;

      // Les URLs de relais sont masquées dans un div `id="el<eid>"`.
      const servers = Array.from(row.matchAll(/#(https?:\/\/[^\s"'<]+\.php)/g)).map((m) => m[1]);
      if (servers.length === 0) continue;

      const time = row.match(/class="time"[^>]*>\s*(\d{1,2}:\d{2})/i)?.[1];
      const league = decodeEntities(row.match(/class="cmp"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');

      const [rawHome, rawAway] = label.split(' - ');
      const [h, m] = (time || '00:00').split(':').map((n) => parseInt(n, 10));
      const startTs = dayStart + h * 3600 + m * 60 - STREAMIZ_TZ_OFFSET_HOURS * 3600;

      matches.push({
        id: `streamiz:${shortHash(servers[0])}`,
        sourceId: servers[0],
        source: 'streamiz',
        status: startTs <= nowSec && startTs + 3 * 3600 > nowSec ? 'live' : 'upcoming',
        home: rawHome.replace(ISO3, '').trim(),
        away: (rawAway || '').replace(ISO3, '').trim(),
        league: league || undefined,
        startTs,
      });
    }

    MATCH_CACHE.set('streamiz', matches);
    return matches;
  } catch (err: any) {
    console.warn('[streamiz] programme indisponible:', err?.message);
    return [];
  }
}

import { extractDirectStream } from './utils/stream-extractor';

/** Remonte streamiz → livetv902 → relais → iframe du lecteur. */
export async function resolveStreamizStream(sourceId: string, force = false): Promise<ResolvedSportsStream | null> {
  if (!force) {
    const cached = STREAM_CACHE.get(sourceId);
    if (cached) return cached;
  }

  try {
    const page = await fetchText(sourceId, STREAMIZ_PAGE);
    const iframe = extractIframe(page);
    if (!iframe) return null;

    // Tentative d'extraction directe HLS
    try {
      const extracted = await extractDirectStream(iframe, STREAMIZ_PAGE);
      if (extracted?.m3u8Url) {
        console.log(`[Streamiz] ✓ Flux HLS direct extrait: ${extracted.m3u8Url.slice(0, 60)}...`);
        const resolved: ResolvedSportsStream = {
          url: extracted.m3u8Url,
          type: 'hls',
          servers: [
            { name: 'Serveur 1 (HLS Direct)', url: extracted.m3u8Url, type: 'hls' },
            { name: 'Serveur 2 (Miroir)', url: iframe, type: 'iframe' },
          ],
        };
        STREAM_CACHE.set(sourceId, resolved);
        return resolved;
      }
    } catch {}

    const resolved: ResolvedSportsStream = { url: iframe, type: 'iframe', servers: [{ name: 'Serveur 1', url: iframe }] };
    STREAM_CACHE.set(sourceId, resolved);
    return resolved;
  } catch (err: any) {
    console.warn('[streamiz] flux indisponible:', err?.message);
    return null;
  }
}
