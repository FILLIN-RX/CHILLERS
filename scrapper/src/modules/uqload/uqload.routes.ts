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

export default router;
