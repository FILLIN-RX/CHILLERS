/**
 * Sources « yasirtv » — kooorah et yallapro.
 *
 * Les deux sites convergent vers le même player (`*.yasirtv.com/playerv5.php`)
 * qui sert du HLS swarmcloud P2P. Ce player n'est pas rejouable depuis notre
 * serveur (segments échangés en WebRTC entre navigateurs) : on expose donc le
 * player en iframe, exactement comme le font les sites d'origine.
 *
 * - kooorah : le programme du jour est publié en clair dans un fichier texte.
 * - yallapro : les articles WordPress listent les canaux, dont l'iframe player.
 */
import crypto from 'crypto';
import axios from 'axios';
import { LRUCache } from 'lru-cache';
import { extractDirectStream } from './utils/stream-extractor';
import type { ResolvedSportsStream, SportsMatch, SportsServer } from './sports.types';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const KOOORAH_SCHEDULE = process.env.KOOORAH_SCHEDULE_URL || 'https://schedule.koora-tv.click/kooratv.txt';
const YALLAPRO_WP = (process.env.YALLAPRO_WP_URL || 'https://to.yallapro.cfd').replace(/\/+$/, '');

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

/** Extrait le premier src d'iframe d'une page (les players sont toujours des iframes). */
export function extractIframe(html: string, base = 'https://placeholder.invalid'): string | null {
  const match = html.match(/<iframe[^>]+src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  const src = match?.[1] || match?.[2] || match?.[3];
  if (!src) return null;
  try {
    return new URL(src, base).toString();
  } catch {
    return null;
  }
}

const shortHash = (value: string) => crypto.createHash('sha1').update(value).digest('hex').slice(0, 12);

/**
 * Certaines pages albaplayer n'embarquent pas d'iframe mais configurent un
 * lecteur HTML5 (Clappr / Video.js) avec une URL m3u8 directe. On la récupère
 * pour la jouer en HLS via notre relay, plutôt que d'abandonner la chaîne.
 */
export function extractM3u8(html: string, base = 'https://placeholder.invalid'): string | null {
  const match = html.match(/https?:\/\/[^\s"'<>\\)]+?\.m3u8(?:\?[^\s"'<>\\)]*)?/i) || html.match(/["']([^"']+\.m3u8[^"']*)["']/i);
  const src = match?.[1] || match?.[0];
  if (!src) return null;
  try {
    return new URL(src, base).toString();
  } catch {
    return null;
  }
}

/* ───────────────────────────── kooorah ───────────────────────────── */

const KOOORAH_LINE = /^(\d{1,2}:\d{2})\s+(.+?)\s+vs\.?\s+(.+?)\s*\|\s*(https?:\/\/\S+)\s*$/;
const KOOORAH_DATE = /Events\s*-\s*(\d{2})\.(\d{2})\.(\d{4})/i;
const ISO3 = /\s+[A-Z]{3}$/;

/** Programme du jour publié par kooorah, parsé depuis le fichier texte. */
export async function getKooorahMatches(): Promise<SportsMatch[]> {
  const cached = MATCH_CACHE.get('kooorah');
  if (cached) return cached;

  try {
    const text = await fetchText(KOOORAH_SCHEDULE, 'https://www.livekora.vip/');

    const dateMatch = text.match(KOOORAH_DATE);
    let dayStart: number | undefined;
    if (dateMatch) {
      // L'entête annonce le fuseau du programme (« GMT +3 »).
      const tz = text.match(/GMT\s*([+-]\d{1,2})/i);
      const offsetHours = tz ? parseInt(tz[1], 10) : 3;
      const iso = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}T00:00:00${offsetHours >= 0 ? '+' : '-'}${String(Math.abs(offsetHours)).padStart(2, '0')}:00`;
      const parsed = Date.parse(iso);
      if (!Number.isNaN(parsed)) dayStart = Math.floor(parsed / 1000);
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const matches: SportsMatch[] = [];

    for (const line of text.split(/\r?\n/)) {
      const parsedLine = line.trim().match(KOOORAH_LINE);
      if (!parsedLine) continue;

      const [, time, rawHome, rawAway, streamUrl] = parsedLine;
      const [h, m] = time.split(':').map((n) => parseInt(n, 10));
      const startTs = dayStart !== undefined ? dayStart + h * 3600 + m * 60 : undefined;

      matches.push({
        id: `kooorah:${shortHash(streamUrl)}`,
        sourceId: streamUrl,
        source: 'kooorah',
        // Le site n'expose pas de statut : on se base sur l'heure de coupure
        // annoncée (le flux est annoncé en ligne 30 min avant).
        status: startTs !== undefined && startTs <= nowSec && startTs + 3 * 3600 > nowSec ? 'live' : 'upcoming',
        home: rawHome.replace(ISO3, '').trim(),
        away: rawAway.replace(ISO3, '').trim(),
        startTs,
      });
    }

    MATCH_CACHE.set('kooorah', matches);
    return matches;
  } catch (err: any) {
    console.warn('[kooorah] programme indisponible:', err?.message);
    return [];
  }
}

/** Remonte la chaîne kooorah → relais player pour obtenir l'iframe finale. */
export async function resolveKooorahStream(sourceId: string, force = false): Promise<ResolvedSportsStream | null> {
  const key = shortHash(sourceId);
  if (!force) {
    const cached = STREAM_CACHE.get(key);
    if (cached) return cached;
  }

  try {
    const page = await fetchText(sourceId, 'https://www.livekora.vip/');
    const iframe = extractIframe(page, sourceId);
    if (!iframe) return null;

    // Tentative de décodage HLS direct
    try {
      const extracted = await extractDirectStream(iframe, 'https://www.livekora.vip/');
      if (extracted?.m3u8Url) {
        console.log(`[Kooorah] ✓ Flux HLS direct extrait: ${extracted.m3u8Url.slice(0, 60)}...`);
        const resolved: ResolvedSportsStream = {
          url: extracted.m3u8Url,
          type: 'hls',
          servers: [
            { name: 'Serveur 1 (HLS Direct)', url: extracted.m3u8Url, type: 'hls' },
            { name: 'Serveur 2 (Miroir)', url: iframe, type: 'iframe' },
          ],
        };
        STREAM_CACHE.set(key, resolved);
        return resolved;
      }
    } catch {}

    const resolved: ResolvedSportsStream = { url: iframe, type: 'iframe', servers: [{ name: 'Serveur 1', url: iframe }] };
    STREAM_CACHE.set(key, resolved);
    return resolved;
  } catch (err: any) {
    console.warn('[kooorah] flux indisponible:', err?.message);
    return null;
  }
}

/* ───────────────────────────── yallapro ──────────────────────────── */

/** Canaux publiés par yallapro, listés via l'API REST WordPress. */
export async function getYallaproMatches(): Promise<SportsMatch[]> {
  const cached = MATCH_CACHE.get('yallapro');
  if (cached) return cached;

  try {
    const raw = await axios.get<any[]>(`${YALLAPRO_WP}/wp-json/wp/v2/posts`, {
      timeout: 12_000,
      params: { per_page: 20, _fields: 'id,link,title,content' },
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    const posts = Array.isArray(raw.data) ? raw.data : [];

    const matches: SportsMatch[] = [];
    for (const post of posts) {
      const title = String(post?.title?.rendered || '').trim();
      if (!title) continue;

      const content = String(post?.content?.rendered || '');
      const playerPage = extractIframe(content, `${YALLAPRO_WP}/`);
      if (!playerPage) continue;

      matches.push({
        id: `yallapro:${post.id}`,
        sourceId: String(playerPage),
        source: 'yallapro',
        status: 'live',
        home: title,
        away: '',
        startTs: Math.floor(Date.now() / 1000),
      });
    }

    MATCH_CACHE.set('yallapro', matches);
    return matches;
  } catch (err: any) {
    console.warn('[yallapro] canaux indisponibles:', err?.message);
    return [];
  }
}

/** Remonte la chaîne yallapro → albaplayer → yasirtv. */
export async function resolveYallaproStream(sourceId: string, force = false): Promise<ResolvedSportsStream | null> {
  if (!force) {
    const cached = STREAM_CACHE.get(sourceId);
    if (cached) return cached;
  }

  try {
    // Le sélecteur `?serv=N` appartient à la page albaplayer, pas au player
    // yasirtv : il faut donc résoudre chaque serveur séparément. Un serveur
    // peut livrer une iframe (player yasirtv) ou un HLS direct (Clappr).
    const withServ = (n: number) => `${sourceId}${sourceId.includes('?') ? '&' : '?'}serv=${n}`;

    const resolvedServers = await Promise.all(
      [1, 2, 3].map(async (n) => {
        const page = await fetchText(withServ(n), `${YALLAPRO_WP}/`);
        const iframe = extractIframe(page, `${YALLAPRO_WP}/`);
        if (iframe) return { name: `Serveur ${n}`, url: iframe, type: 'iframe' as const };
        const m3u8 = extractM3u8(page, withServ(n));
        if (m3u8) return { name: `Serveur ${n}`, url: m3u8, type: 'hls' as const };
        return null;
      })
    );

    // Selon la chaîne, `?serv=N` pointe vers des players différents ou
    // reconduit vers le même : on ne garde que les serveurs réellement distincts.
    const unique = new Map<string, SportsServer>();
    for (const server of resolvedServers) {
      if (server && !unique.has(server.url)) unique.set(server.url, server);
    }
    const servers = Array.from(unique.values());
    if (servers.length === 0) return null;

    const primary = servers[0];
    const resolved: ResolvedSportsStream = { url: primary.url, type: primary.type ?? 'iframe', servers };
    STREAM_CACHE.set(sourceId, resolved);
    return resolved;
  } catch (err: any) {
    console.warn('[yallapro] flux indisponible:', err?.message);
    return null;
  }
}
