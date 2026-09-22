import { Request, Response, NextFunction } from 'express';
import * as streamingService from './streaming.service';
import { AppError } from '../types';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import Movie from '../models/Movie';
import Serie from '../models/Serie';
import { hasPremiumAccess } from '../utils/premium-access';

const JWT_SECRET = process.env.JWT_SECRET || 'chillers-super-secret-key-change-me';

async function isRequestPremium(req: Request): Promise<boolean> {
  try {
    // 1. Vérification par header explicite si injecté par middleware
    if (req.headers['x-is-premium'] === 'true' || req.query.is_premium === 'true') {
      return true;
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded?.id) {
        const user = await User.findById(decoded.id).select('subscription promo role');
        return hasPremiumAccess(user);
      }
    }
  } catch (_) {}
  return false;
}

function getDirectDownloadUrl(embedUrl: string, title?: string, season?: number, episode?: number): string | null {
  if (!embedUrl) return null;

  const isTv = season !== undefined && episode !== undefined;
  const cleanFilename = `${(title || 'video').replace(/[^a-zA-Z0-9_\-]/g, '_')}${isTv ? `_S${season}E${episode}` : ''}.mp4`;

  // 1. Proxies internes délivrant des flux directs MP4
  if (embedUrl.startsWith('/api/doodstream/stream') || embedUrl.startsWith('/api/omnisave/proxy')) {
    return `${embedUrl}&download=1&filename=${encodeURIComponent(cleanFilename)}`;
  }

  // 2. URL directe MP4 externe
  if (/^https?:\/\/.*\.mp4(\?.*)?$/i.test(embedUrl)) {
    return `/api/download/file?url=${encodeURIComponent(embedUrl)}&filename=${encodeURIComponent(cleanFilename)}`;
  }

  return null;
}

export const getMovieStream = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) throw new AppError('Valid TMDB movie ID is required', 400);

    const isPremium = await isRequestPremium(req);
    const title = req.query.title as string | undefined;
    const originalTitle = (req.query.originalTitle || req.query.original_title) as string | undefined;
    const releaseDate = (req.query.releaseDate || req.query.release_date) as string | undefined;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

    // ── Early exit si la date de sortie est future ──
    if (releaseDate) {
      const relTime = new Date(releaseDate).getTime();
      if (!isNaN(relTime) && relTime > Date.now()) {
        res.json({
          success: false,
          unreleased: true,
          releaseDate,
          data: null,
          message: `Ce film n'est pas encore disponible en streaming (sortie le ${releaseDate}).`,
        });
        return;
      }
    }

    // [PAYWALL CHECK]
    const movie = await Movie.findOne({ tmdbId: id });
    if (movie?.isPremium && !isPremium) {
      res.status(403).json({
        success: false,
        code: 'PREMIUM_REQUIRED',
        message: 'Ce film nécessite un abonnement Premium ou un code promo valide.',
      });
      return;
    }

    const result = await streamingService.getMovieStream({
      tmdbId: id,
      type: (req.query.type as 'movie' | 'tv' | 'anime') || 'movie',
      title,
      originalTitle,
      releaseDate,
      year: year || movie?.year,
      language: (req.query.language as string) || 'fr',
      isPremium,
    });

    if (!result || result.isUnreleased) {
      res.json({
        success: false,
        unreleased: !!result?.isUnreleased,
        releaseDate: result?.releaseDate || releaseDate,
        data: null,
        message: result?.isUnreleased
          ? `Ce film n'est pas encore disponible en streaming.`
          : 'Aucun flux disponible. Tous les fournisseurs ont échoué.',
      });
      return;
    }

    const downloadUrl = getDirectDownloadUrl(result.embedUrl, title);

    res.json({
      success: true,
      data: {
        embedUrl: result.embedUrl,
        downloadUrl: downloadUrl ?? result.directUrl ?? null,
        directUrl: result.directUrl ?? null,
        directType: result.directType ?? null,
        quality: isPremium && result.provider === 'frenchstream' ? '1080p' : 'standard',
        isPremiumStream: isPremium && result.provider === 'frenchstream',
      },
      provider: result.provider,
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

    const isPremium = await isRequestPremium(req);
    const title = req.query.title as string | undefined;
    const originalTitle = (req.query.originalTitle || req.query.original_title) as string | undefined;
    const releaseDate = (req.query.releaseDate || req.query.release_date) as string | undefined;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

    // ── Early exit si la date de sortie est future ──
    if (releaseDate) {
      const relTime = new Date(releaseDate).getTime();
      if (!isNaN(relTime) && relTime > Date.now()) {
        res.json({
          success: false,
          unreleased: true,
          releaseDate,
          data: null,
          message: `Cet épisode n'est pas encore disponible en streaming (sortie le ${releaseDate}).`,
        });
        return;
      }
    }

    // [PAYWALL CHECK]
    const serie = await Serie.findOne({ tmdbId: id });
    if (serie?.isPremium && !isPremium) {
      res.status(403).json({
        success: false,
        code: 'PREMIUM_REQUIRED',
        message: 'Cette série nécessite un abonnement Premium ou un code promo valide.',
      });
      return;
    }

    const result = await streamingService.getEpisodeStream({
      tmdbId: id,
      type: (req.query.type as 'movie' | 'tv' | 'anime') || 'tv',
      title,
      originalTitle,
      releaseDate,
      year: year || serie?.year,
      season,
      episode,
      language: (req.query.language as string) || 'fr',
      isPremium,
    });

    if (!result || result.isUnreleased) {
      res.json({
        success: false,
        unreleased: !!result?.isUnreleased,
        releaseDate: result?.releaseDate || releaseDate,
        data: null,
        message: result?.isUnreleased
          ? `Cette série n'est pas encore disponible en streaming.`
          : 'Aucun flux disponible. Tous les fournisseurs ont échoué.',
      });
      return;
    }

    const downloadUrl = getDirectDownloadUrl(result.embedUrl, title, season, episode);

    res.json({
      success: true,
      data: {
        embedUrl: result.embedUrl,
        downloadUrl: downloadUrl ?? result.directUrl ?? null,
        directUrl: result.directUrl ?? null,
        directType: result.directType ?? null,
        quality: isPremium && result.provider === 'frenchstream' ? '1080p' : 'standard',
        isPremiumStream: isPremium && result.provider === 'frenchstream',
      },
      provider: result.provider,
      message: null,
    });
  } catch (error) {
    next(error);
  }
};
