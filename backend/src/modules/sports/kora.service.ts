/**
 * Source « kora » — backend commun de goalakor.space et hesgoalltv.net.
 *
 * Les deux sites ne sont que des front-ends du même CDN : `cdn.kora-api.org`.
 * Les réponses JSON sont chiffrées côté client avec AES-256-GCM ; la clé et
 * l'alphabet base64 sont figés dans le JavaScript public des deux sites
 * (fonction `kfDecode`). On rejoue donc le déchiffrement côté serveur pour
 * obtenir la liste des matchs et les canaux de diffusion.
 *
 * Endpoints décodés :
 *   GET /api/v1/matches?lang=en            → tous les matchs du jour
 *   GET /api/v1/matche/{id}/{lang}?t={ts}   → détail + canaux d'un match
 */
import crypto from 'crypto';
import axios from 'axios';
import { LRUCache } from 'lru-cache';
import { randomUUID } from 'crypto';
import type { ResolvedSportsStream, SportsMatch, SportsServer } from './sports.types';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const API_BASE = (process.env.KORA_API_BASE || 'https://cdn.kora-api.org/').replace(/\/?$/, '/');
const API_TIMEOUT_MS = 12_000;

/** Alphabet base64 personnalisé du site (celui des chaînes chiffrées). */
const KORA_ALPHABET = 'MiljRIn9PX1o63wGBYTtFsKmEkSur-pC_U02cvzAdy5e8ZqLDgJ4OhVN7QbHxfWa';
/** Alphabet base64 standard, en ordre ASCII naturel (cible du remapping). */
const NATIVE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** Clé AES-256-GCM extraite du bundle public des front-ends. */
const KORA_AES_KEY = Buffer.from('vqW3n/yB1R+GwSPc4kJs2dCkV7kRmXaNy3lQ/3XkHJI=', 'base64');

const MATCH_CACHE = new LRUCache<string, SportsMatch[]>({ max: 10, ttl: 60_000 });
const STREAM_CACHE = new LRUCache<string, ResolvedSportsStream>({ max: 60, ttl: 5 * 60_000 });

/**
 * Rejoue la fonction `kfDecode` des sites : les charges utiles sont préfixées
 * `k1`, encodées dans un base64 inversé à alphabet personnalisé, puis chiffrées
 * en AES-256-GCM (IV = 12 premiers octets, tag = 16 derniers).
 */
export function koraDecode(payload: string): any {
  if (!payload.startsWith('k1')) return JSON.parse(payload);

  const mapped = payload
    .slice(2)
    .split('')
    .reverse()
    .map((ch) => {
      const idx = KORA_ALPHABET.indexOf(ch);
      if (idx === -1) throw new Error('Charge utile kora invalide');
      return NATIVE_ALPHABET[idx];
    })
    .join('')
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  // Buffer est tolérant aux caractères de bourrage résiduels.
  const raw = Buffer.from(mapped, 'base64');
  const iv = raw.subarray(0, 12);
  const body = raw.subarray(12);
  const tag = body.subarray(body.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', KORA_AES_KEY, iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(body.subarray(0, body.length - 16)), decipher.final()]);
  return JSON.parse(json.toString('utf8'));
}

async function koraGet<T = any>(path: string): Promise<T> {
  const { data } = await axios.get<string>(`${API_BASE}${path}`, {
    timeout: API_TIMEOUT_MS,
    responseType: 'text',
    transformResponse: [(d) => d],
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/plain,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: `${API_BASE}`,
    },
  });
  return koraDecode(typeof data === 'string' ? data : String(data)) as T;
}

function toEpoch(date?: string, time?: string): number | undefined {
  if (!date) return undefined;
  const parsed = Date.parse(`${date}T${(time || '00:00').slice(0, 5)}:00Z`);
  return Number.isNaN(parsed) ? undefined : Math.floor(parsed / 1000);
}

function absoluteMedia(path?: string): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.replace(/^\/+/, '')}`;
}

function mapMatch(raw: any): SportsMatch {
  const homeScore = raw?.home?.score;
  const awayScore = raw?.away?.score;
  const hasScore = homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined;

  return {
    id: `kora:${raw.id}`,
    sourceId: String(raw.id),
    source: 'kora',
    status: raw.status === 1 || raw.stream_open === true ? 'live' : 'upcoming',
    home: raw?.home?.name ?? 'À déterminer',
    away: raw?.away?.name ?? 'À déterminer',
    homeLogo: absoluteMedia(raw?.home?.logo),
    awayLogo: absoluteMedia(raw?.away?.logo),
    league: raw?.league?.name,
    score: hasScore ? `${homeScore} - ${awayScore}` : undefined,
    startTs: toEpoch(raw?.date, raw?.time) ?? toEpoch(raw?.stream_start?.slice(0, 10), raw?.stream_start?.slice(11, 16)),
  };
}

/** Liste unifiée des matchs du jour (live + à venir) pour la source kora. */
export async function getKoraMatches(): Promise<SportsMatch[]> {
  const cached = MATCH_CACHE.get('all');
  if (cached) return cached;

  try {
    const data = await koraGet('api/v1/matches?lang=en');
    const raw: any[] = Array.isArray(data?.matches) ? data.matches : [];
    const list: SportsMatch[] = raw.map(mapMatch);
    MATCH_CACHE.set('all', list);
    return list;
  } catch (err: any) {
    console.warn('[kora] liste des matchs indisponible:', err?.message);
    return [];
  }
}

function edgeHosts(raw: any): string[] {
  const domain = raw?.edge_domain;
  const edges: string[] = Array.isArray(raw?.edges) && raw.edges.length ? raw.edges : ['a11', 'a12', 'a13'];
  if (!domain) return [];
  return edges.map((e) => `https://${e}.${domain}`);
}

/**
 * Construit l'URL d'un canal.
 *
 * - `type` "Frame"/"Landscape" avec `edge === 0` : l'URL de `link` est
 *   directement embarquable.
 * - sinon le player est servi par un edge : `https://{edge}.{domain}/frame.php`
 *   paramétré par le canal, un `p` fixe, un `token` de session et un
 *   timestamp `kt`. Les canaux de ce type n'ont pas toujours de `link`.
 */
function buildChannelUrl(channel: any, edgeHostsList: string[], visitorId: string): string | null {
  const link: string = channel?.link || '';
  const type: string = channel?.type || '';

  if ((type === 'Frame' || type === 'Landscape') && channel?.edge === 0 && link) {
    return link;
  }

  if (edgeHostsList.length === 0) return null;

  const host = edgeHostsList[Math.floor(Math.random() * edgeHostsList.length)];
  const kt = Math.floor(Date.now() / 1000);
  const ch = encodeURIComponent(channel?.ch || '');
  return `${host.replace(/\/frame\.php$/, '')}/frame.php?ch=${ch}&p=12&token=${visitorId}&kt=${kt}`;
}

import { extractDirectStream } from './extractors/stream-extractor';

/** Résout le(s) player(s) de diffusion d'un match kora. */
export async function resolveKoraStream(matchId: string, force = false): Promise<ResolvedSportsStream | null> {
  const id = String(matchId);
  if (!force) {
    const cached = STREAM_CACHE.get(id);
    if (cached) return cached;
  }

  try {
    const detail = await koraGet(`api/v1/matche/${encodeURIComponent(id)}/en?t=${Date.now()}`);
    const match = detail?.match;
    if (!match) return null;

    const hosts = edgeHosts(match);
    const visitorId = randomUUID();
    const channels: any[] = Array.isArray(match.channels) ? match.channels : [];

    const ordered = [
      ...channels.filter((c) => (c?.type === 'Frame' || c?.type === 'Landscape') && c?.edge === 0 && c?.link),
      ...channels.filter((c) => !((c?.type === 'Frame' || c?.type === 'Landscape') && c?.edge === 0 && c?.link)),
    ];

    const servers: SportsServer[] = [];
    let directHls: string | null = null;

    for (const channel of ordered) {
      const url = buildChannelUrl(channel, hosts, visitorId);
      if (!url) continue;

      const serverName = channel?.server_name || 'Serveur';

      // 1. Tenter l'extraction directe du flux HLS .m3u8
      if (!directHls) {
        try {
          const extracted = await extractDirectStream(url, 'https://goalakor.space/');
          if (extracted?.m3u8Url) {
            directHls = extracted.m3u8Url;
            console.log(`[Kora] ✓ Flux HLS direct extrait pour le match ${id}: ${directHls.slice(0, 60)}...`);
            servers.push({
              name: `${serverName} (HLS Direct)`,
              url: directHls,
              type: 'hls',
            });
            continue;
          }
        } catch (extErr: any) {
          console.warn(`[Kora] Échec extraction HLS sur ${url}:`, extErr?.message);
        }
      }

      servers.push({ name: serverName, url, type: 'iframe' });
    }

    if (servers.length === 0) return null;

    const primaryServer = servers.find((s) => s.type === 'hls') || servers[0];
    const resolved: ResolvedSportsStream = {
      url: primaryServer.url,
      type: primaryServer.type || 'iframe',
      servers,
    };

    STREAM_CACHE.set(id, resolved);
    return resolved;
  } catch (err: any) {
    console.warn(`[kora] résolution du flux ${id} impossible:`, err?.message);
    return null;
  }
}

