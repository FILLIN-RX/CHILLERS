import { Request, Response, NextFunction } from 'express';
import * as streamingService from './streaming.service';
import { AppError } from '../types';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'chillers-super-secret-key-change-me';

async function isRequestPremium(req: Request): Promise<boolean> {
  try {
    // 1. Vérification par header explicite si injecté par middleware
    if (req.headers['x-is-premium'] === 'true' || req.query.is_premium === 'true') {
      return true;
    }

    // 2. Vérification par Token JWT utilisateur
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded?.role === 'admin') return true;
      if (decoded?.id) {
        const user = await User.findById(decoded.id).select('subscription role');
        if (user?.role === 'admin' || user?.subscription?.plan === 'premium') {
          return true;
        }
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

    const result = await streamingService.getMovieStream({
      tmdbId: id,
      type: (req.query.type as 'movie' | 'tv' | 'anime') || 'movie',
      title,
      language: (req.query.language as string) || 'fr',
      isPremium,
    });

    if (!result) {
      res.json({
        success: false,
        data: null,
        message: 'Aucun flux disponible. Tous les fournisseurs ont échoué.',
      });
      return;
    }

    const downloadUrl = getDirectDownloadUrl(result.embedUrl, title);

    res.json({
      success: true,
      data: {
        embedUrl: result.embedUrl,
        downloadUrl,
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

    const result = await streamingService.getEpisodeStream({
      tmdbId: id,
      type: (req.query.type as 'movie' | 'tv' | 'anime') || 'tv',
      title,
      season,
      episode,
      language: (req.query.language as string) || 'fr',
      isPremium,
    });

    if (!result) {
      res.json({
        success: false,
        data: null,
        message: 'Aucun flux disponible. Tous les fournisseurs ont échoué.',
      });
      return;
    }

    const downloadUrl = getDirectDownloadUrl(result.embedUrl, title, season, episode);

    res.json({
      success: true,
      data: {
        embedUrl: result.embedUrl,
        downloadUrl,
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
