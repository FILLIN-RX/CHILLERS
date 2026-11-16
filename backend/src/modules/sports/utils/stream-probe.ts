/**
 * Sonde de jouabilité : une source sports annonce souvent un player qui n'a rien
 * derrière (match pas encore commencé, chaîne éteinte, page d'erreur). On ne sert
 * donc que ce qu'on a vu répondre, exactement comme la chaîne de providers films.
 */
import axios from 'axios';
import { spawn } from 'node:child_process';
import { LRUCache } from 'lru-cache';
import { extractDirectStream } from './stream-extractor';
import type { ResolvedSportsStream, SportsServer } from '../sports.types';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const PROBE_TIMEOUT_MS = 7_000;
const MAX_SERVERS_PROBED = 4;
/**
 * Certaines chaînes répondent une playlist HLS valide… avec un flux noir et
 * silencieux (droits non ouverts, émetteur en panne). La sonde `#EXTM3U` la
 * déclare jouable, le player affiche un écran noir sans jamais basculer sur un
 * miroir sain. On échantillonne donc le premier segment et on écarte les flux
 * entièrement noirs et muets.
 */
const DEAD_FEED_TIMEOUT_MS = 4_500;
const DEAD_FEED_MAX_REDIRECTS = 5;
const DEAD_FEED_MAX_BYTES = 4 * 1024 * 1024;
const BLACK_MIN_DURATION_S = 1.2;
const BLACK_MIN_RATIO = 0.85;
const SILENT_MAX_VOLUME_DB = -75;
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
/** 30 s pour un flux noir (il peut revenir), 60 s pour un flux sain. */
const DEAD_FEED_CACHE_TTL_MS = 60_000;
const deadFeedCache = new LRUCache<string, boolean>({ max: 300, ttl: DEAD_FEED_CACHE_TTL_MS });
/**
 * Fenêtre d'attente des miroirs iframe quand un HLS direct joue déjà. Les
 * iframes mortes coûtent jusqu'au timeout de sonde (7 s) pour rien — on laisse
 * courir leurs promesses, mais on répond sans elles au-delà de ce délai.
 */
const IFRAME_GRACE_MS = 1_500;

/**
 * Ordonne HLS d'abord (stable) AVANT de limiter la sonde : un provider peut
 * empiler des canaux morts en tête (kora pousse 3 iframes 403 avant son HLS)
 * et le `slice(0, MAX)` laissait alors le HLS réel hors sonde.
 */
function prioritizeForProbe(servers: SportsServer[]): SportsServer[] {
  return servers
    .map((server, index) => ({ server, index }))
    .sort((a, b) => {
      const typeA = a.server.type === 'hls' || /\.m3u8([?#]|$)/i.test(a.server.url) ? 0 : 1;
      const typeB = b.server.type === 'hls' || /\.m3u8([?#]|$)/i.test(b.server.url) ? 0 : 1;
      return typeA - typeB || a.index - b.index;
    })
    .map((entry) => entry.server);
}

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

function absoluteUrl(line: string, base: string): string {
  try {
    return new URL(line, base).href;
  } catch {
    return line;
  }
}

/** Récupère une playlist en texte avec le Referer du player d'origine. */
async function fetchPlaylistText(
  url: string,
  referer?: string,
): Promise<{ text: string; finalUrl: string } | null> {
  try {
    const { data, request } = await axios.get<string>(url, {
      timeout: DEAD_FEED_TIMEOUT_MS,
      responseType: 'text',
      transformResponse: [(d) => d],
      maxRedirects: DEAD_FEED_MAX_REDIRECTS,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/x-mpegURL,application/vnd.apple.mpegurl,*/*',
        ...(referer ? { Referer: referer, Origin: originOf(referer) } : {}),
      },
    });
    const text = typeof data === 'string' ? data : String(data ?? '');
    const finalUrl = (request as any)?.res?.responseUrl || url;
    return { text, finalUrl };
  } catch {
    return null;
  }
}

/**
 * Extrait le premier segment d'une playlist (maître ou média), avec sa durée.
 * Les playlists maîtres sont suivies une à une jusqu'à la variante.
 */
async function resolveSegmentSample(
  url: string,
  referer?: string,
  depth = 0,
): Promise<{ segmentUrl: string; duration: number } | null> {
  if (depth > 2) return null;

  const playlist = await fetchPlaylistText(url, referer);
  if (!playlist || !/#EXTM3U/i.test(playlist.text)) return null;

  const lines = playlist.text.split(/\r?\n/);
  if (/#EXT-X-STREAM-INF/i.test(playlist.text)) {
    const variant = lines.find((line) => line.trim() && !line.startsWith('#'));
    if (!variant) return null;
    return resolveSegmentSample(
      absoluteUrl(variant.trim(), playlist.finalUrl),
      referer,
      depth + 1,
    );
  }

  let duration = 2;
  let segment: string | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#EXTINF:')) {
      const value = Number(trimmed.slice('#EXTINF:'.length).split(',')[0]);
      if (Number.isFinite(value) && value > 0) duration = value;
      continue;
    }
    if (trimmed.startsWith('#')) continue;
    segment = trimmed;
    break;
  }

  if (!segment) return null;
  return { segmentUrl: absoluteUrl(segment, playlist.finalUrl), duration };
}

async function fetchSampleBytes(url: string, referer?: string): Promise<Buffer | null> {
  try {
    const { data } = await axios.get<ArrayBuffer>(url, {
      timeout: DEAD_FEED_TIMEOUT_MS,
      responseType: 'arraybuffer',
      maxContentLength: DEAD_FEED_MAX_BYTES,
      maxRedirects: DEAD_FEED_MAX_REDIRECTS,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
        ...(referer ? { Referer: referer, Origin: originOf(referer) } : {}),
      },
    });
    return Buffer.from(data);
  } catch {
    return null;
  }
}

/** Passage noir le plus long détecté par ffmpeg + niveau audio max (null = analyse impossible). */
function analyzeSample(bytes: Buffer): Promise<{ blackDuration: number; maxVolumeDb: number | null } | null> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(
        FFMPEG_PATH,
        [
          '-hide_banner',
          '-loglevel',
          'info',
          '-i',
          'pipe:0',
          '-map',
          '0:v:0',
          '-map',
          '0:a:0?',
          '-vf',
          'blackdetect=d=0.5:pix_th=0.10',
          '-af',
          'volumedetect',
          '-f',
          'null',
          '-',
        ],
        { stdio: ['pipe', 'ignore', 'pipe'] },
      );
    } catch {
      resolve(null);
      return;
    }

    let settled = false;
    let stderr = '';
    const finish = (value: { blackDuration: number; maxVolumeDb: number | null } | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(null);
    }, DEAD_FEED_TIMEOUT_MS);

    child.stderr?.on('data', (chunk) => {
      if (stderr.length < 64 * 1024) stderr += String(chunk);
    });
    child.on('error', () => finish(null));
    child.on('close', () => {
      const durations = [...stderr.matchAll(/black_duration:([\d.]+)/g)]
        .map((match) => Number(match[1]))
        .filter(Number.isFinite);
      const volume = stderr.match(/max_volume:\s*(-?[\d.]+)\s*dB/i);
      finish({
        blackDuration: durations.length ? Math.max(...durations) : 0,
        maxVolumeDb: volume ? Number(volume[1]) : null,
      });
    });
    child.stdin?.on('error', () => {});
    child.stdin?.end(bytes);
  });
}

/**
 * Un flux HLS peut répondre `#EXTM3U` tout en ne diffusant qu'une image noire
 * et du silence (émetteur en panne, droits non ouverts). Échantillonne le
 * premier segment et le déclare mort quand presque toute sa durée est noire et
 * que la piste audio est muette — une simple scène sombre garde son son.
 */
export async function probeDeadFeed(url: string, referer?: string): Promise<boolean> {
  const cached = deadFeedCache.get(url);
  if (cached !== undefined) return cached;

  const sample = await resolveSegmentSample(url, referer).catch(() => null);
  if (!sample) return false;

  const bytes = await fetchSampleBytes(sample.segmentUrl, referer).catch(() => null);
  if (!bytes || bytes.length < 188) return false;

  const analysis = await analyzeSample(bytes);
  if (!analysis) return false;

  const mostlyBlack =
    analysis.blackDuration >= Math.max(BLACK_MIN_DURATION_S, sample.duration * BLACK_MIN_RATIO);
  const silent = analysis.maxVolumeDb === null || analysis.maxVolumeDb <= SILENT_MAX_VOLUME_DB;
  const dead = mostlyBlack && silent;
  deadFeedCache.set(url, dead, { ttl: dead ? 30_000 : DEAD_FEED_CACHE_TTL_MS });
  return dead;
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
 * Vérifie qu'une page de player existe bien et tente d'en remonter le HLS
 * natif. Les iframes ne sont JAMAIS servies : sans HLS extractible, la page
 * de player ne vaut rien pour le lecteur.
 */
export async function probeIframe(
  url: string,
  referer?: string,
): Promise<{ type: 'hls'; url: string } | null> {
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
        'Sec-Fetch-Dest': 'iframe',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        ...(referer ? { Referer: referer, Origin: originOf(referer) } : {}),
      },
    });
    html = typeof data === 'string' ? data : String(data ?? '');
  } catch {
    return null;
  }

  const lower = `${html.slice(0, 4000)} ${html.slice(-2000)}`.toLowerCase();
  if (isErrorPage(html, lower)) return null;

  if (html.length < 200) return null;
  if (!PLAYER_MARKERS.some((m) => lower.includes(m))) return null;

  const direct = await extractDirectStream(url, referer).catch(() => null);
  if (direct?.m3u8Url && (await probeHls(direct.m3u8Url, direct.referer || url))) {
    return { type: 'hls', url: direct.m3u8Url };
  }

  return null;
}

/**
 * Écarte les HLS qui répondent mais ne diffusent qu'un écran noir et muet.
 * Même quand c'est le seul candidat : mieux vaut laisser la chaîne essayer un
 * autre provider que servir un écran noir.
 */
async function removeDeadHlsFeeds(servers: SportsServer[]): Promise<SportsServer[]> {
  const hls = servers.filter((server) => server.type === 'hls');
  if (hls.length === 0) return servers;

  const checks = await Promise.all(
    hls.map(async (server) => ({
      url: server.url,
      dead: await probeDeadFeed(server.url, server.referer || originOf(server.url)).catch(
        () => false,
      ),
    })),
  );
  const deadUrls = new Set(checks.filter((check) => check.dead).map((check) => check.url));
  if (deadUrls.size === 0) return servers;

  for (const server of hls) {
    if (deadUrls.has(server.url)) {
      console.warn(`[sports] flux noir ignoré (${server.name || server.url})`);
    }
  }
  return servers.filter((server) => !deadUrls.has(server.url));
}

/**
 * Choisit tous les serveurs réellement jouables du flux résolu. Seul le HLS
 * est servi : un player iframe n'est pas un flux (choix explicite), il est
 * extrait en HLS s'il en cache un, sinon le serveur tombe. `[]` = la source a
 * bien répondu mais ne diffuse rien de jouable pour l'instant.
 *
 * La sonde est parallélisée : trois serveurs à 7 s chacun en séquentiel
 * dépasserait le budget de la chaîne.
 */
export async function pickPlayableServers(stream: ResolvedSportsStream): Promise<SportsServer[]> {
  const servers = prioritizeForProbe(stream.servers).slice(0, MAX_SERVERS_PROBED);
  if (servers.length === 0 && stream.url) {
    servers.push({ name: stream.type || 'iframe', url: stream.url, type: stream.type });
  }
  if (servers.length === 0) return [];

  const probeOne = async (server: SportsServer): Promise<SportsServer | null> => {
    // Un player « domain protected » ne répond qu'au Referer de la page qui
    // l'embarque ; sans lui, la sonde verrait une page d'erreur.
    const referer = server.referer || originOf(server.url);

    if (server.type === 'hls' || /\.m3u8([?#]|$)/i.test(server.url)) {
      return (await probeHls(server.url, referer)) ? { ...server, type: 'hls' } : null;
    }

    const outcome = await probeIframe(server.url, referer);
    if (!outcome) return null;
    return { name: server.name, url: outcome.url, type: 'hls', referer: server.url };
  };
  const isDirect = (s: SportsServer) => s.type === 'hls' || /\.m3u8([?#]|$)/i.test(s.url);
  const direct = servers.filter(isDirect);
  const frames = servers.filter((s) => !isDirect(s));

  // Les deux familles partent en même temps (durée totale = max des deux,
  // jamais la somme). Un HLS direct qui répond suffit : on n'attend plus les
  // iframes que pour une courte fenêtre — leur extraction native peut ajouter
  // un miroir, mais leurs timeouts ne doivent pas consumer le budget restant
  // de la tentative de chaîne.
  const framesPromise = Promise.all(frames.map(probeOne));
  const directPlayable = (await Promise.all(direct.map(probeOne))).filter(
    (s): s is SportsServer => s !== null,
  );

  if (directPlayable.length > 0) {
    let graceTimer: NodeJS.Timeout | undefined;
    const grace = await Promise.race([
      framesPromise,
      new Promise<null>((resolveGrace) => {
        graceTimer = setTimeout(() => resolveGrace(null), IFRAME_GRACE_MS);
      }),
    ]);
    if (graceTimer) clearTimeout(graceTimer);
    const extra = (grace ?? []).filter((s): s is SportsServer => s !== null);
    return removeDeadHlsFeeds([...directPlayable, ...extra]);
  }

  // Aucun direct jouable : les iframes sont la dernière ressource (extraction
  // du HLS embarqué) et on les attend toutes — sans elles, la source ne sert
  // rien et la chaîne passera au provider suivant.
  const framePlayable = (await framesPromise).filter((s): s is SportsServer => s !== null);
  return removeDeadHlsFeeds([...directPlayable, ...framePlayable]);
}

/**
 * Premier serveur jouable du flux résolu.
 * `null` = la source a bien répondu mais ne diffuse rien pour l'instant.
 */
export async function pickPlayableServer(stream: ResolvedSportsStream): Promise<SportsServer | null> {
  return (await pickPlayableServers(stream))[0] ?? null;
}
