import { Router, Response } from 'express';
import { adminMiddleware, AuthRequest } from '../../middleware/auth';
import { UqloadClient } from './uqload.client';
import { uploadMoviesBatch, uploadSeriesBatch, uploadSingleMovie, uploadSingleEpisode, stopUpload, isUploadRunning } from './uqload.uploader';
import Movie from '../../models/Movie';
import Serie from '../../models/Serie';

const router = Router();

function getClient(req: AuthRequest): UqloadClient | null {
  const apiKey = process.env.UQLOAD_API_KEY;
  if (!apiKey) return null;
  return new UqloadClient(apiKey);
}

/**
 * GET /uqload/file-info/:code
 * Retourne les infos temps réel d'un fichier Uqload depuis l'API officielle :
 * vues totales, durée, date création, statut, miniature.
 */
router.get('/uqload/file-info/:code', adminMiddleware, async (req: AuthRequest, res: Response) => {
  const client = getClient(req);
  if (!client) {
    res.status(400).json({ success: false, data: null, message: 'UQLOAD_API_KEY non configurée' });
    return;
  }
  try {
    const code = req.params.code as string;
    const info = await client.getFileInfo(code);
    if (!info.result || info.result.length === 0) {
      res.status(404).json({ success: false, data: null, message: 'Fichier introuvable sur Uqload' });
      return;
    }
    const f = info.result[0];
    res.json({
      success: true,
      data: {
        code:       f.file_code,
        title:      f.file_title,
        views:      parseInt(f.file_views, 10) || 0,
        duration:   f.file_length,
        createdAt:  f.file_created,
        public:     f.file_public === '1',
        canPlay:    f.canplay === 1,
        status:     f.status,
        thumbnail:  f.player_img,
        tags:       f.tags || null,
        embedUrl:   `https://uqload.is/embed-${f.file_code}.html`,
      },
      message: null,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, message: e.message });
  }
});


router.post('/uqload/upload/movies', adminMiddleware, async (req: AuthRequest, res: Response) => {
  const client = getClient(req);
  if (!client) {
    res.status(400).json({ success: false, data: null, message: 'UQLOAD_API_KEY non configurée' });
    return;
  }
  if (isUploadRunning()) {
    res.status(409).json({ success: false, data: null, message: 'Un upload est déjà en cours' });
    return;
  }
  const result = await uploadMoviesBatch(client);
  res.json({ success: true, data: result, message: null });
});

router.post('/uqload/upload/series', adminMiddleware, async (req: AuthRequest, res: Response) => {
  const client = getClient(req);
  if (!client) {
    res.status(400).json({ success: false, data: null, message: 'UQLOAD_API_KEY non configurée' });
    return;
  }
  if (isUploadRunning()) {
    res.status(409).json({ success: false, data: null, message: 'Un upload est déjà en cours' });
    return;
  }
  const result = await uploadSeriesBatch(client);
  res.json({ success: true, data: result, message: null });
});

router.post('/uqload/upload/movie/:id', adminMiddleware, async (req: AuthRequest, res: Response) => {
  const client = getClient(req);
  if (!client) {
    res.status(400).json({ success: false, data: null, message: 'UQLOAD_API_KEY non configurée' });
    return;
  }
  try {
    await uploadSingleMovie(client, req.params.id as string);
    res.json({ success: true, data: null, message: 'Upload terminé' });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, message: e.message });
  }
});

router.post('/uqload/upload/serie/:id/episode/:index', adminMiddleware, async (req: AuthRequest, res: Response) => {
  const client = getClient(req);
  if (!client) {
    res.status(400).json({ success: false, data: null, message: 'UQLOAD_API_KEY non configurée' });
    return;
  }
  try {
    await uploadSingleEpisode(client, req.params.id as string, parseInt(req.params.index as string, 10));
    res.json({ success: true, data: null, message: 'Upload terminé' });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, message: e.message });
  }
});

router.post('/uqload/stop', adminMiddleware, (_req: AuthRequest, res: Response) => {
  stopUpload();
  res.json({ success: true, data: null, message: 'Arrêt demandé' });
});

router.get('/uqload/status', adminMiddleware, async (_req: AuthRequest, res: Response) => {
  const client = getClient(_req);
  if (!client) {
    res.json({ success: true, data: { configured: false, message: 'UQLOAD_API_KEY non configurée' }, message: null });
    return;
  }

  try {
    const [accountInfo, moviesPending, seriesPending] = await Promise.all([
      client.getAccountInfo(),
      Movie.countDocuments({ $or: [{ uqloadCode: { $eq: null } }, { uqloadCode: { $exists: false } }] }),
      Serie.countDocuments({ 'episodes.uqloadCode': { $eq: null } }),
    ]);

    res.json({
      success: true,
      data: {
        configured: true,
        isUploading: isUploadRunning(),
        account: {
          login: accountInfo.result.login,
          storageLeft: accountInfo.result.storage_left,
          storageUsed: accountInfo.result.storage_used,
          premium: accountInfo.result.premium === 1,
          premiumExpire: accountInfo.result.premium_expire,
        },
        pending: {
          movies: moviesPending,
          series: seriesPending,
        },
      },
      message: null,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, data: { configured: true, error: e.message }, message: e.message });
  }
});

router.get('/uqload/pending', adminMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const [movies, series] = await Promise.all([
      Movie.find({ $or: [{ uqloadCode: { $eq: null } }, { uqloadCode: { $exists: false } }] })
        .select('titre lien uqloadCode createdAt')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      Serie.find({ 'episodes.uqloadCode': { $eq: null } })
        .select('titre episodes')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
    ]);

    const seriesEpisodes: any[] = [];
    for (const serie of series) {
      for (const ep of serie.episodes || []) {
        if (!ep.uqloadCode) {
          seriesEpisodes.push({ serieTitre: serie.titre, episode: ep.episode, lien: ep.lien, uqloadCode: ep.uqloadCode || null });
        }
      }
    }

    res.json({
      success: true,
      data: {
        movies: movies.map(m => ({ titre: m.titre, lien: m.lien, uqloadCode: m.uqloadCode || null, createdAt: m.createdAt })),
        series: seriesEpisodes.slice(0, 200),
        totalMovies: movies.length,
        totalEpisodes: seriesEpisodes.length,
      },
      message: null,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, message: e.message });
  }
});

/**
 * GET /uqload/files
 * Liste tous les fichiers uploadés sur Uqload avec leurs infos complètes.
 * Query params :
 *   - type   : "movies" | "series" | "all" (défaut: "all")
 *   - page   : numéro de page (défaut: 1)
 *   - limit  : résultats par page (défaut: 50, max: 200)
 *   - search : recherche dans le titre
 */
router.get('/uqload/files', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const type   = (req.query.type   as string) || 'all';
    const page   = Math.max(1, parseInt((req.query.page  as string) || '1',  10));
    const limit  = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));
    const search = (req.query.search as string) || '';
    const skip   = (page - 1) * limit;

    const results: any = {};

    if (type === 'movies' || type === 'all') {
      const movieFilter: any = {
        $or: [
          { uqloadCode: { $exists: true, $ne: '' } },
          { uqloadLink: { $exists: true, $ne: '' } },
        ],
      };
      if (search) movieFilter.titre = { $regex: search, $options: 'i' };

      const [movies, totalMovies] = await Promise.all([
        Movie.find(movieFilter)
          .select('titre tmdbId uqloadCode uqloadLink uqloadQualities uqloadHls streamtapeCode streamtapeLink uploadedAt year posterUrl')
          .sort({ uploadedAt: -1, createdAt: -1 })
          .skip(type === 'all' ? 0 : skip)
          .limit(type === 'all' ? Math.floor(limit / 2) : limit)
          .lean(),
        Movie.countDocuments(movieFilter),
      ]);

      results.movies = {
        total: totalMovies,
        items: movies.map(m => ({
          id: m._id,
          titre: m.titre,
          tmdbId: m.tmdbId,
          year: m.year,
          posterUrl: m.posterUrl,
          uqload: {
            code: m.uqloadCode || null,
            link: m.uqloadLink || null,
            hls:  m.uqloadHls  || null,
            qualities: m.uqloadQualities || [],
          },
          streamtape: {
            code: m.streamtapeCode || null,
            link: m.streamtapeLink || null,
          },
          uploadedAt: m.uploadedAt || null,
        })),
      };
    }

    if (type === 'series' || type === 'all') {
      const serieFilter: any = {
        'episodes.uqloadCode': { $exists: true, $ne: '' },
      };
      if (search) serieFilter.titre = { $regex: search, $options: 'i' };

      const [series, totalSeries] = await Promise.all([
        Serie.find(serieFilter)
          .select('titre tmdbId year posterUrl episodes')
          .sort({ updatedAt: -1 })
          .skip(type === 'all' ? 0 : skip)
          .limit(type === 'all' ? Math.floor(limit / 2) : limit)
          .lean(),
        Serie.countDocuments(serieFilter),
      ]);

      results.series = {
        total: totalSeries,
        items: series.map(s => ({
          id: s._id,
          titre: s.titre,
          tmdbId: s.tmdbId,
          year: s.year,
          posterUrl: s.posterUrl,
          episodes: (s.episodes || [])
            .filter((e: any) => e.uqloadCode || e.uqloadLink)
            .map((e: any) => ({
              label:         e.episode,
              season:        e.season,
              episodeNumber: e.episodeNumber,
              uqload: {
                code: e.uqloadCode  || null,
                link: e.uqloadLink  || null,
              },
              streamtape: {
                code: e.streamtapeCode || null,
                link: e.streamtapeLink || null,
              },
              uploadedAt: e.uploadedAt || null,
            })),
        })),
      };
    }

    res.json({ success: true, data: { page, limit, ...results }, message: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, message: e.message });
  }
});

export default router;
