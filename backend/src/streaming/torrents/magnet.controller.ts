/**
 * magnet.controller.ts — endpoint "client-side" du module torrents.
 *
 * GET /api/torrents/magnet?title=...&year=...&type=...&season=...&episode=...
 *
 * But : renvoyer un lien magnet prêt pour le moteur P2P du navigateur
 * (WebTorrent), sans jamais toucher à TorrServer ni FFmpeg — le serveur
 * ne fait que la recherche Prowlarr + l'injection des trackers WebRTC.
 */

import { Request, Response } from 'express';
import { LRUCache } from 'lru-cache';
import { searchTorrents, resolveTorrentLink } from './prowlarr.service';
import { isTorrentsConfigured } from './config';
import { errMessage } from './torrents.utils';

interface MagnetResult {
  magnet: string;
  infoHash: string;
  title: string;
  size: number;
  seeders: number;
  indexer: string;
  torrentBase64?: string;
}

/** Trackers ajoutés au magnet pour maximiser les pairs WebRTC (browser). */
const WEBTORRENT_TRACKERS = [
  'wss://tracker.webtorrent.dev',
  'wss://tracker.openwebtorrent.com',
  'https://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.files.fm:7073',
  'https://tracker.opentrackr.org:1337/announce',
];

const MAGNET_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 h
const magnetCache = new LRUCache<string, MagnetResult>({ max: 300, ttl: MAGNET_CACHE_TTL });

function cacheKey(opts: {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
}): string {
  return `${opts.title}|${opts.year ?? ''}|${opts.season ?? ''}|${opts.episode ?? ''}`;
}

/**
 * Régénère un magnet avec les trackers d'origine + les trackers WebRTC.
 * (Prowlarr fournit souvent des magnets sans annonce — sans tr= WebSocket,
 *  un client navigateur ne découvre aucun pair.)
 */
export function ensureTrackers(magnet: string): string {
  if (!magnet.startsWith('magnet:')) return magnet;

  const trimmed = magnet.replace(/&tr=[^&]*/g, '');
  const trackers = new Set<string>();

  const original = magnet.match(/&tr=([^&]*)/g);
  if (original) {
    for (const t of original) {
      const dec = decodeURIComponent(t.slice(4));
      if (dec) trackers.add(dec);
    }
  }
  for (const t of WEBTORRENT_TRACKERS) trackers.add(t);

  const parts = [...trackers].map((t) => `tr=${encodeURIComponent(t)}`);
  return trimmed.endsWith('&') || trimmed.includes('?') || trimmed.endsWith('?')
    ? `${trimmed}${parts.map((p) => `&${p}`).join('')}`
    : `${trimmed}&${parts.map((p) => `&${p}`).join('').slice(1)}`;
}

export async function getMagnet(req: Request, res: Response) {
  if (!isTorrentsConfigured()) {
    res.status(503).json({ success: false, data: null, message: 'Module torrents désactivé' });
    return;
  }

  const title = String(req.query.title || '').trim();
  if (!title) {
    res.status(400).json({ success: false, data: null, message: 'Paramètre "title" requis' });
    return;
  }

  const year = parseInt(String(req.query.year || ''), 10) || undefined;
  const season = parseInt(String(req.query.season || ''), 10) || undefined;
  const episode = parseInt(String(req.query.episode || ''), 10) || undefined;

  const key = cacheKey({ title, year, season, episode });
  const cached = magnetCache.get(key);
  if (cached) {
    res.json({ success: true, data: cached, message: null, cached: true });
    return;
  }

  try {
    const candidates = await searchTorrents({ title, year, season, episode });
    if (candidates.length === 0) {
      res.json({ success: false, data: null, message: 'Aucun torrent trouvé pour ce titre' });
      return;
    }

    const best = candidates[0];
    const source = await resolveTorrentLink(best);

    const result: MagnetResult = {
      magnet: source.kind === 'link' ? ensureTrackers(source.data) : '',
      infoHash: best.infoHash || '',
      title: best.title,
      size: best.size,
      seeders: best.seeders,
      indexer: best.indexer,
      torrentBase64: source.kind === 'file' ? source.data : undefined,
    };

    if (!result.magnet && !result.torrentBase64) {
      res.status(502).json({ success: false, data: null, message: 'Lien torrent non résolu' });
      return;
    }

    magnetCache.set(key, result);
    console.log(
      `[Magnet] "${title}" → ${result.magnet ? 'magnet' : 'torrent-file'} "${best.title}" (${best.seeders} seeds)`
    );
    res.json({ success: true, data: result, message: null, cached: false });
  } catch (err: unknown) {
    console.error(`[Magnet] Erreur recherche "${title}": ${errMessage(err)}`);
    res.status(502).json({ success: false, data: null, message: 'Échec de la résolution du magnet' });
  }
}