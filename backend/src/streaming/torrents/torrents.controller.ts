/**
 * torrents.controller.ts — routes HTTP du module torrents.
 *
 * - /health   : état Prowlarr + TorrServer (utilisé par Docker/Render)
 * - /stream   : transcodage FFmpeg à la volée → MP4 fragmenté
 * - /download : téléchargement direct proxy depuis TorrServer
 */

import { Request, Response } from 'express';
import axios from 'axios';
import { spawn } from 'child_process';
import {
  PROWLARR_URL,
  PROWLARR_API_KEY,
  TORRSERVER_URL,
  FFMPEG_PATH,
  isTorrentsConfigured,
} from './config';
import { errMessage } from './torrents.utils';

export async function healthCheck(_req: Request, res: Response) {
  if (!isTorrentsConfigured()) {
    res.json({
      success: true,
      enabled: false,
      checks: { prowlarr: false, torrserver: false },
      message: 'Module torrents désactivé (PROWLARR_API_KEY manquante)',
    });
    return;
  }

  const checks = { prowlarr: false, torrserver: false };

  try {
    await axios.get(`${PROWLARR_URL}/api/v1/system/status`, {
      headers: { 'X-Api-Key': PROWLARR_API_KEY },
      timeout: 4000,
    });
    checks.prowlarr = true;
  } catch (err: unknown) {
    const status = axios.isAxiosError(err) ? ` (HTTP ${err.response?.status ?? 'injoignable'})` : '';
    const hint =
      axios.isAxiosError(err) && err.response?.status === 401
        ? ' — clé API incorrecte ou IP bannie (ban ~10 min)'
        : '';
    console.warn(`[Torrents] Prowlarr injoignable${status}${hint}: ${errMessage(err)}`);
  }

  try {
    await axios.post(`${TORRSERVER_URL}/torrents`, { action: 'list' }, { timeout: 4000 });
    checks.torrserver = true;
  } catch (err: unknown) {
    console.warn(`[Torrents] TorrServer injoignable: ${errMessage(err)}`);
  }

  res.json({ success: true, enabled: true, checks });
}

/**
 * Débit cible de sortie (video + audio, en bit/s) — fixé pour que le flux
 * transcodé ait un débit quasi constant. C'est lui qui permet de mapper une
 * requête `Range: bytes=N-` du navigateur vers une position temporelle
 * (seek = bytes ÷ débit). On l'utilise aussi hors seek pour garder un
 * flux homogène d'un seek à l'autre.
 */
const TARGET_BITRATE_BPS = (2500 + 128) * 1000;
const VIDEO_BITRATE = '2500k';

/** Extrait l'offset de départ d'un header Range simple (`bytes=START-`). */
function parseRangeStart(range: string | undefined): number | null {
  if (!range) return null;
  const m = /^bytes=(\d+)-/i.exec(range.trim());
  if (!m) return null;
  return parseInt(m[1], 10);
}

/** Extensions vidéo lues nativement par le navigateur (proxy direct, sans FFmpeg). */
const NATIVE_PLAYABLE = ['.mp4', '.m4v', '.webm', '.mov'];

/**
 * Récupère le nom du fichier indexé d'un torrent depuis TorrServer.
 * Retourne null si indisponible (torrent pas encore prêt).
 */
async function fetchFileName(hash: string, index: number): Promise<string | null> {
  try {
    const res = await axios.post(
      `${TORRSERVER_URL}/torrents`,
      { action: 'get', hash },
      { timeout: 10000 }
    );
    const stats: Array<{ id: number; path: string }> | undefined = res.data?.file_stats;
    const file = stats?.find((f) => f.id === index);
    return file?.path || null;
  } catch {
    return null;
  }
}

function transcodeFfmpegArgs(inputUrl: string, seekSeconds?: number): string[] {
  const seek = seekSeconds && seekSeconds > 0 ? ['-ss', String(seekSeconds)] : [];
  return [
    '-hide_banner',
    '-loglevel', 'error',
    ...seek,
    '-i', inputUrl,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-b:v', VIDEO_BITRATE,
    '-maxrate', VIDEO_BITRATE,
    '-bufsize', '5000k',
    '-g', '48',
    '-keyint_min', '24',
    '-c:a', 'aac',
    '-ar', '44100',
    '-ac', '2',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    '-f', 'mp4',
    'pipe:1',
  ];
}

/** Transcode le flux TorrServer en MP4 fragmenté compatible <video>, avec seek. */
export async function streamFile(req: Request, res: Response) {
  const hash = req.query.hash as string;
  const index = Number(req.query.index) || 0;
  if (!hash) {
    res.status(400).send('Hash requis');
    return;
  }

  const rangeStart = parseRangeStart(req.headers.range);

  // ── 1. Proxy direct (sans FFmpeg) : le navigateur lit nativement
  // mp4/m4v/webm/mov → démarrage instantané, aucun transcodage,
  // indispensable sur les instances à faible RAM (plan free Render).
  const filename = await fetchFileName(hash, index);
  if (filename) {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext && NATIVE_PLAYABLE.includes(`.${ext}`)) {
      console.log(`[Torrents] Proxy direct (natif) : "${filename}" (fichier ${index})`);
      return proxyTorrServerStream(req, res, hash, index, rangeStart);
    }
  }

  // ── 2. Fallback : transcodage FFmpeg pour les conteneurs non natifs
  // (mkv/avi…). Sans `-re` : on lit le flux aussitôt que les pièces P2P
  // arrivent au lieu d'imposer un débit temps réel (cause de blocage).
  const seekSeconds = rangeStart ? Math.floor(rangeStart / (TARGET_BITRATE_BPS / 8)) : undefined;

  const inputUrl = `${TORRSERVER_URL}/stream?link=${hash}&index=${index}&play` +
    (seekSeconds !== undefined ? `&pos=${rangeStart}` : '');

  console.log(
    `[Torrents][FFmpeg] Transcodage à la volée: ${hash} (fichier ${index})` +
      (seekSeconds !== undefined ? ` — seek à ${seekSeconds}s (range ${rangeStart})` : ''),
  );

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Accept-Ranges', 'bytes');

  if (rangeStart !== null) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${rangeStart}-*/*`);
  }

  const ffmpeg = spawn(FFMPEG_PATH, transcodeFfmpegArgs(inputUrl, seekSeconds));

  ffmpeg.stdout.pipe(res);

  ffmpeg.on('error', (err) => {
    console.error('[Torrents][FFmpeg] Erreur:', err.message);
    if (!res.headersSent) res.status(500).send('FFmpeg indisponible sur le serveur');
  });

  ffmpeg.on('close', (code) => {
    console.log(`[Torrents][FFmpeg] Processus terminé (code ${code})`);
    if (!res.writableEnded) res.end();
  });

  req.on('close', () => {
    ffmpeg.kill('SIGKILL');
  });
}

/**
 * Proxifie directement le flux TorrServer vers le navigateur en relayant
 * le header Range (seek natif) — aucun transcodage nécessaire pour les
 * conteneurs supportés nativement par le <video>.
 */
async function proxyTorrServerStream(
  req: Request,
  res: Response,
  hash: string,
  index: number,
  rangeStart: number | null
): Promise<void> {
  const inputUrl = `${TORRSERVER_URL}/stream?link=${hash}&index=${index}&play` +
    (rangeStart !== null ? `&pos=${rangeStart}` : '');

  try {
    const upstream = await axios({
      method: 'get',
      url: inputUrl,
      headers: req.headers.range ? { Range: req.headers.range } : {},
      responseType: 'stream',
      timeout: 0,
      maxRedirects: 5,
    });

    const status = upstream.status === 206 ? 206 : 200;
    res.status(status);
    res.setHeader('Content-Type', String(upstream.headers['content-type'] || 'video/mp4'));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Accept-Ranges', 'bytes');
    if (status === 206 && upstream.headers['content-range']) {
      res.setHeader('Content-Range', String(upstream.headers['content-range']));
    }
    if (upstream.headers['content-length']) {
      res.setHeader('Content-Length', String(upstream.headers['content-length']));
    }

    upstream.data.on('error', () => {
      if (!res.writableEnded) res.end();
    });
    upstream.data.pipe(res);

    req.on('close', () => {
      upstream.data.destroy();
    });
  } catch (err: unknown) {
    console.error(`[Torrents][Proxy] Échec du stream direct: ${errMessage(err)}`);
    if (!res.headersSent) {
      res.status(502).send('TorrServer injoignable pour le stream direct');
    }
  }
}

/** Téléchargement direct du fichier (proxy du flux TorrServer). */
export async function downloadFile(req: Request, res: Response) {
  const hash = req.query.hash as string;
  const index = req.query.index as string | undefined;
  const name = req.query.name as string | undefined;
  if (!hash) {
    res.status(400).send('Hash requis');
    return;
  }

  console.log(`[Torrents][Download] "${name || hash}"`);

  try {
    const response = await axios({
      method: 'get',
      url: `${TORRSERVER_URL}/stream?link=${hash}&index=${index || 0}&play`,
      responseType: 'stream',
      timeout: 0,
    });

    const fileName = name || `video-${hash}.mkv`;
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    response.data.pipe(res);
  } catch (err: unknown) {
    console.error(`[Torrents][Download] Erreur: ${errMessage(err)}`);
    if (!res.headersSent) res.status(500).send('Échec du téléchargement.');
  }
}
