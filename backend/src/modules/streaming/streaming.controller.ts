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

/**
 * Un lien de téléchargement doit désigner un fichier, jamais une page lecteur.
 * MongoDBProvider renseigne `downloadUrl` avec l'embed Uqload (`…/embed-x.html`) :
 * livré tel quel, le client construit `/api/download/stream?m3u8=<page HTML>`,
 * FFmpeg n'extrait rien et la réponse 200 « chunked » sans Content-Length affiche
 * une taille inconnue sur iOS (-1 ko) puis échoue.
 */
function pickDownloadUrl(result: {
  downloadUrl?: string | null;
  directUrl?: string | null;
  embedUrl: string;
}): string | null {
  const isFileUrl = (u?: string | null) =>
    Boolean(u) && !/\.html?(\?|$)|\/embed-|\/e\/|vidlink\.pro|youtube\.com/i.test(u!);
  if (isFileUrl(result.downloadUrl)) return result.downloadUrl!;
  if (result.directUrl) return result.directUrl;
  return /\.(mp4|m3u8)(\?|$)/i.test(result.embedUrl) ? result.embedUrl : null;
}

export const getMovieStream = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) throw new AppError('Valid TMDB movie ID is required', 400);

    const result = await streamingService.getMovieStream({
      tmdbId: id,
      type: (req.query.type as 'movie' | 'tv' | 'anime') || 'movie',
      title: req.query.title as string | undefined,
      originalTitle: req.query.originalTitle as string | undefined,
      language: ((req.query.language || req.query.lang) as string) || 'fr',
      year: req.query.year ? parseInt(req.query.year as string, 10) : undefined,
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
    const downloadUrl = pickDownloadUrl(result);
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
      originalTitle: req.query.originalTitle as string | undefined,
      season,
      episode,
      language: ((req.query.language || req.query.lang) as string) || 'fr',
      year: req.query.year ? parseInt(req.query.year as string, 10) : undefined,
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
    const downloadUrl = pickDownloadUrl(result);
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
