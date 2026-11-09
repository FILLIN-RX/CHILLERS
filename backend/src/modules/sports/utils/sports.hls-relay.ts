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
import { resolveSportsFluxById, resolveSportsStream } from '../sports.service';

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

/**
 * Le Referer d'un flux est connu dès la playlist maître ; les segments qui
 * suivent arrivent sur une autre URL et doivent voyager avec lui. On le retient
 * le temps de la lecture pour ne pas re-résoudre à chaque requête.
 */
const refererMemory = new LRUCache<string, string>({ max: 200, ttl: 10 * 60_000 });
const memoryKey = (source: string, sourceId: string) => `${source}:${sourceId}`;

/**
 * Cible HLS courante + date de résolution : permet de rafraîchir le jeton en
 * arrière-plan avant qu'il n'expire, sans attendre un 401 en plein segment.
 */
const targetMemory = new LRUCache<string, { url: string; referer?: string; resolvedAt: number }>({
  max: 200,
  ttl: 30 * 60_000,
});
const refreshInFlight = new Map<string, Promise<{ url: string; referer?: string } | null>>();
const REFRESH_AFTER_MS = 15 * 60_000;
const REFRESH_DEBOUNCE_MS = 10_000;

function rememberTarget(source: string, sourceId: string, target: { url: string; referer?: string }): void {
  targetMemory.set(memoryKey(source, sourceId), { ...target, resolvedAt: Date.now() });
  refererMemory.set(memoryKey(source, sourceId), target.referer ?? originOf(target.url));
}

function refreshHlsTarget(
  source: string,
  sourceId: string,
): Promise<{ url: string; referer?: string } | null> {
  const key = memoryKey(source, sourceId);
  const pending = refreshInFlight.get(key);
  if (pending) return pending;

  // Une rafale de segments peut renvoyer 401 juste après un refresh : ne pas
  // relancer la chaîne de providers pour chacun d'eux.
  const current = targetMemory.get(key);
  if (current && Date.now() - current.resolvedAt < REFRESH_DEBOUNCE_MS) {
    return Promise.resolve(current);
  }

  let promise: Promise<{ url: string; referer?: string } | null>;
  promise = resolveHlsTarget(source, sourceId, true)
    .then((fresh) => {
      if (fresh) rememberTarget(source, sourceId, fresh);
      return fresh;
    })
    .catch(() => null)
    .finally(() => {
      if (refreshInFlight.get(key) === promise) refreshInFlight.delete(key);
    });
  refreshInFlight.set(key, promise);
  return promise;
}

function maybeRefreshTarget(source: string, sourceId: string): void {
  const current = targetMemory.get(memoryKey(source, sourceId));
  if (!current || Date.now() - current.resolvedAt < REFRESH_AFTER_MS) return;
  void refreshHlsTarget(source, sourceId);
}


/**
 * URL HLS + Referer du flux réellement servi pour ce couple source/identifiant :
 * la chaîne de providers d'abord (elle a déjà tranché), résolution brute de la
 * source ensuite (identifiant absent du listing agrégé, ex. après rotation).
 */
async function resolveHlsTarget(
  source: string,
  sourceId: string,
  force: boolean
): Promise<{ url: string; referer?: string } | null> {
  // Refresh de jeton : on interroge d'abord le provider exact, sans repasser
  // par la découverte de tous les jumeaux (10-26 s en plein match). La chaîne
  // complète ne sert qu'en dernier recours.
  if (force) {
    const direct = await resolveSportsStream(source, sourceId, true).catch(() => null);
    if (direct?.type === 'hls') {
      const server = direct.servers?.find((s) => s.type === 'hls');
      const url = server?.url ?? direct.url;
      if (url) return { url, referer: server?.referer };
    }
  }

  const resolved = await resolveSportsFluxById(`${source}:${sourceId}`, force).catch(() => null);
  const stream = resolved?.flux.stream;
  if (stream?.type === 'hls') {
    return { url: stream.url, referer: stream.servers[0]?.referer };
  }

  const legacy = await resolveSportsStream(source, sourceId, force);
  if (!legacy) return null;
  if (legacy.type === 'hls') {
    const server = legacy.servers?.find((s) => s.type === 'hls');
    return { url: server?.url ?? legacy.url, referer: server?.referer };
  }
  return null;
}

/**
 * Les CDN de ces flux vérifient le domaine qui les appelle : on rejoue le
 * Referer de la page qui embarque normalement le lecteur, sinon ils renvoient
 * une page d'erreur à la place de la playlist.
 */
async function fetchRemote(
  url: string,
  source: string,
  sourceId: string,
  referer?: string,
  retryCount = 0
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

    if (contentType.includes('text/html') && buf.subarray(0, 5).toString().toLowerCase() === '<!doc') {
      throw new Error(`Challenge HTML renvoyé (${url.slice(0, 80)})`);
    }

    return { buf, contentType };
  } catch (err: any) {
    const status = err?.response?.status;
    if ((status === 401 || status === 403 || status === 404) && retryCount === 0) {
      console.warn(`[Sports Relay] HTTP ${status} sur ${source}/${sourceId}, re-résolution du flux...`);
      const fresh = await refreshHlsTarget(source, sourceId);
      if (fresh?.url && /\.m3u8([?#]|$)/i.test(url)) {
        return fetchRemote(fresh.url, source, sourceId, fresh.referer, retryCount + 1);
      }
    }

    // Glissement transitoire (5xx, 429, socket coupé, timeout sans statut) :
    // une seule reprise après une courte pause — inutile de re-résoudre le
    // flux entier pour une rafale de segments qui n'ont pas abouti.
    const transient = status === undefined || status >= 500 || status === 429;
    if (transient && retryCount === 0) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return fetchRemote(url, source, sourceId, referer, retryCount + 1);
    }
    throw err;
  }
}

/**
 * Variante streaming pour les segments : le client reçoit les octets dès leur
 * arrivée au lieu d'attendre que tout le segment soit téléchargé. Pour un
 * direct, cela retire plusieurs centaines de ms au premier fragment et évite
 * les à-coups quand le CDN ralentit.
 */
async function streamRemote(
  url: string,
  source: string,
  sourceId: string,
  referer?: string,
  retryCount = 0
): Promise<{ stream: any; contentType: string; contentLength?: string }> {
  const pageReferer = referer || originOf(url);
  try {
    const response = await axios.get(url, {
      responseType: 'stream',
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

    const contentType = String(response.headers['content-type'] ?? '');
    if (contentType.includes('text/html')) {
      response.data.destroy?.();
      throw new Error(`Challenge HTML renvoyé (${url.slice(0, 80)})`);
    }

    return {
      stream: response.data,
      contentType,
      contentLength: response.headers['content-length']
        ? String(response.headers['content-length'])
        : undefined,
    };
  } catch (err: any) {
    const status = err?.response?.status;
    if ((status === 401 || status === 403 || status === 404) && retryCount === 0) {
      console.warn(`[Sports Relay] HTTP ${status} sur ${source}/${sourceId}, refresh du segment...`);
      const fresh = await refreshHlsTarget(source, sourceId);
      if (fresh?.url && /\.m3u8([?#]|$)/i.test(url)) {
        return streamRemote(fresh.url, source, sourceId, fresh.referer, retryCount + 1);
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
// Le serveur retenu est celui choisi par la chaîne de providers : le relay ne
// fait que rejouer sa playlist et ses segments depuis le backend.
export const getHlsMasterPlaylist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const source = String(req.params.source);
    const sourceId = String(req.params.matchId);
    const forceRefresh = req.query.refresh === 'true' || req.query.force === '1';

    const target = await resolveHlsTarget(source, sourceId, forceRefresh);
    if (!target) {
      res.status(404).json({ success: false, data: null, message: 'Flux HLS introuvable' });
      return;
    }

    const referer = target.referer || originOf(target.url);
    rememberTarget(source, sourceId, { url: target.url, referer });

    const { buf } = await fetchRemote(target.url, source, sourceId, referer);
    setPlaylistHeaders(res);
    res.send(rewritePlaylist(buf.toString('utf8'), target.url, source, sourceId));
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
    const referer = refererMemory.get(memoryKey(source, sourceId));
    maybeRefreshTarget(source, sourceId);

    if (/\.m3u8([?#]|$)/i.test(remoteUrl)) {
      const { buf } = await fetchRemote(remoteUrl, source, sourceId, referer);
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

    let upstream: { stream: any; contentType: string; contentLength?: string };
    try {
      upstream = await streamRemote(remoteUrl, source, sourceId, referer);
    } catch {
      if (!res.headersSent) {
        res.status(502).json({ success: false, data: null, message: 'Segment indisponible' });
      }
      return;
    }

    setSegmentHeaders(res, upstream.contentType);
    if (upstream.contentLength) res.set('Content-Length', upstream.contentLength);

    // Tee : le client reçoit les octets immédiatement, et on garde une copie
    // bornée pour les rares requêtes simultanées sur le même segment.
    const chunks: Buffer[] = [];
    let size = 0;
    let collect = true;
    upstream.stream.on('data', (chunk: Buffer) => {
      if (!collect) return;
      size += chunk.length;
      if (size > 32 * 1024 * 1024) {
        collect = false;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    upstream.stream.on('end', () => {
      if (collect && size >= 8 * 1024) segmentCache.set(remoteUrl, Buffer.concat(chunks));
    });
    upstream.stream.on('error', () => {
      if (!res.headersSent) res.status(502).end();
      else res.destroy();
    });
    res.on('close', () => upstream.stream.destroy?.());
    upstream.stream.pipe(res);
  } catch (error) {
    next(error);
  }
};
