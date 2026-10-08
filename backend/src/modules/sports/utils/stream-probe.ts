/**
 * Sonde de jouabilité : une source sports annonce souvent un player qui n'a rien
 * derrière (match pas encore commencé, chaîne éteinte, page d'erreur). On ne sert
 * donc que ce qu'on a vu répondre, exactement comme la chaîne de providers films.
 */
import axios from 'axios';
import { extractDirectStream } from './stream-extractor';
import type { ResolvedSportsStream, SportsServer } from '../sports.types';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const PROBE_TIMEOUT_MS = 7_000;
const MAX_SERVERS_PROBED = 3;

const BLOCK_MARKERS = [
  'just a moment',
  'attention required',
  'checking your browser',
  'access denied',
  'not allowed',
  'domain protected',
  'unauthorized',
  'error 404',
  'not found',
  'channel is offline',
  'stream is offline',
  'no stream',
  'maintenance',
];

const PLAYER_MARKERS = [
  '<iframe',
  '<video',
  'm3u8',
  'jwplayer',
  'videojs',
  'clappr',
  'hls.js',
  'player',
  'p2p',
  'webrtc',
];

const originOf = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
};

/**
 * Les gabarits de player contiennent un bloc d'erreur masqué (« stream is
 * offline », « Not allowed ») : lire ces mots dans une page de 150 Ko serait un
 * faux négatif. Une page d'erreur de ces hôtes est courte ; on la détecte là,
 * plus dans le titre.
 */
function isErrorPage(html: string, window: string): boolean {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').toLowerCase();
  if (BLOCK_MARKERS.some((m) => title.includes(m))) return true;
  if (html.length >= 6_000) return false;
  return BLOCK_MARKERS.some((m) => window.includes(m));
}

/** Une playlist HLS réelle commence par `#EXTM3U` ; tout le reste n'est pas jouable. */
export async function probeHls(url: string, referer?: string): Promise<boolean> {
  try {
    const { data } = await axios.get<string>(url, {
      timeout: PROBE_TIMEOUT_MS,
      responseType: 'text',
      transformResponse: [(d) => d],
      maxRedirects: 5,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/x-mpegURL,application/vnd.apple.mpegurl,*/*',
        ...(referer ? { Referer: referer, Origin: originOf(referer) } : {}),
      },
    });
    const body = typeof data === 'string' ? data : String(data ?? '');
    if (/#EXTM3U/i.test(body)) return true;
    // Certaines chaînes live ne posent le tag qu'après un jeton : le JSON de
    // manifest d'origine n'est pas jouable par hls.js, on le refuse.
    return false;
  } catch {
    return false;
  }
}

/**
 * Vérifie qu'une page de player existe bien, et en profite pour remonter un HLS
 * natif quand le player en cache un (meilleure lecture que l'iframe).
 */
export async function probeIframe(
  url: string,
  referer?: string,
): Promise<{ type: 'hls'; url: string } | { type: 'iframe' } | null> {
  let html = '';
  try {
    const { data } = await axios.get<string>(url, {
      timeout: PROBE_TIMEOUT_MS,
      responseType: 'text',
      transformResponse: [(d) => d],
      maxRedirects: 5,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...(referer ? { Referer: referer, Origin: originOf(referer) } : {}),
      },
    });
    html = typeof data === 'string' ? data : String(data ?? '');
  } catch {
    return null;
  }

  const lower = `${html.slice(0, 4000)} ${html.slice(-2000)}`.toLowerCase();
  if (isErrorPage(html, lower)) return null;

  const direct = await extractDirectStream(url, referer).catch(() => null);
  if (direct?.m3u8Url && (await probeHls(direct.m3u8Url, direct.referer || url))) {
    return { type: 'hls', url: direct.m3u8Url };
  }

  if (html.length < 200) return null;
  if (!PLAYER_MARKERS.some((m) => lower.includes(m))) return null;
  return { type: 'iframe' };
}

/**
 * Choisit le premier serveur réellement jouable du flux résolu.
 * `null` = la source a bien répondu mais ne diffuse rien pour l'instant.
 */
export async function pickPlayableServer(stream: ResolvedSportsStream): Promise<SportsServer | null> {
  const servers = stream.servers.slice(0, MAX_SERVERS_PROBED);
  if (servers.length === 0 && stream.url) {
    servers.push({ name: stream.type || 'iframe', url: stream.url, type: stream.type });
  }

  let iframeFallback: SportsServer | null = null;

  for (const server of servers) {
    // Un player « domain protected » ne répond qu'au Referer de la page qui
    // l'embarque ; sans lui, la sonde verrait une page d'erreur.
    const referer = server.referer || originOf(server.url);

    if (server.type === 'hls' || /\.m3u8([?#]|$)/i.test(server.url)) {
      if (await probeHls(server.url, referer)) return { ...server, type: 'hls' };
      continue;
    }

    const outcome = await probeIframe(server.url, referer);
    if (!outcome) continue;
    if (outcome.type === 'hls') {
      return { name: server.name, url: outcome.url, type: 'hls', referer: server.url };
    }
    // Player embarqué : rejouable, mais un HLS ailleurs serait meilleur.
    iframeFallback ??= { ...server, type: 'iframe' };
  }

  return iframeFallback;
}
