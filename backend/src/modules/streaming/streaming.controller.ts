import { Request, Response, NextFunction } from 'express';
import * as streamingService from './streaming.service';
import { AppError } from '../../types';

/** Log visible quand le flux est servi par le module torrents (fallback P2P). */
function logTorrentFallback(provider: string, label: string) {
  if (provider !== 'torrserver') return;
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║ 🧲 [TORRENT-MODULE] Flux P2P (fallback) servi pour : ${label}`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
}

export const getMovieStream = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) throw new AppError('Valid TMDB movie ID is required', 400);

    const result = await streamingService.getMovieStream({
      tmdbId: id,
      type: (req.query.type as 'movie' | 'tv' | 'anime') || 'movie',
      title: req.query.title as string | undefined,
      language: (req.query.language as string) || 'fr',
    });

    if (!result) {
      res.json({
        success: false,
        data: null,
        message: 'Aucun flux disponible. Tous les fournisseurs ont échoué.',
      });
      return;
    }

    logTorrentFallback(result.provider, `movie ${id}`);
    const downloadUrl = result.downloadUrl || result.directUrl || (result.embedUrl.includes('.mp4') ? result.embedUrl : null);
    const directType = result.directType || (result.embedUrl.includes('.m3u8') ? 'hls' : result.embedUrl.includes('.mp4') ? 'mp4' : null);

    res.json({
      success: true,
      data: {
        embedUrl: result.embedUrl,
        downloadUrl,
        directUrl: result.directUrl || null,
        directType,
        referer: result.referer || null,
      },
      provider: result.provider,
      downloadUrl,
      directType,
      message: null,
    });
  } catch (error) {
    next(error);
  }
};

export const getEpisodeStream = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const season = parseInt(req.params.season as string, 10);
    const episode = parseInt(req.params.episode as string, 10);
    if (isNaN(id) || isNaN(season) || isNaN(episode)) {
      throw new AppError('Valid TMDB TV ID, season, and episode are required', 400);
    }

    const result = await streamingService.getEpisodeStream({
      tmdbId: id,
      type: (req.query.type as 'movie' | 'tv' | 'anime') || 'tv',
      title: req.query.title as string | undefined,
      season,
      episode,
      language: (req.query.language as string) || 'fr',
    });

    if (!result) {
      res.json({
        success: false,
        data: null,
        message: 'Aucun flux disponible. Tous les fournisseurs ont échoué.',
      });
      return;
    }

    logTorrentFallback(result.provider, `tv ${id} S${season}E${episode}`);
    const downloadUrl = result.downloadUrl || result.directUrl || (result.embedUrl.includes('.mp4') ? result.embedUrl : null);
    const directType = result.directType || (result.embedUrl.includes('.m3u8') ? 'hls' : result.embedUrl.includes('.mp4') ? 'mp4' : null);

    res.json({
      success: true,
      data: {
        embedUrl: result.embedUrl,
        downloadUrl,
        directUrl: result.directUrl || null,
        directType,
        referer: result.referer || null,
      },
      provider: result.provider,
      downloadUrl,
      directType,
      message: null,
    });
  } catch (error) {
    next(error);
  }
};
