import { Router, Request, Response } from 'express';
import { catalogStatus, filterIdsByCatalog, isCatalogFilterActive, listCatalog, CatalogListQuery } from './catalog.service';
import { CatalogItemType, CatalogProvider } from '../../models/ProviderCatalogItem';
import ProviderCatalogItem from '../../models/ProviderCatalogItem';
import mongoose from 'mongoose';
import { getAfrolandEpisodes } from '../afroland/afroland.service';

const router = Router();

/** GET /api/catalog/afroland/:sourceId — détails d'une fiche AfroLand non liée à TMDB. */
router.get('/afroland/:sourceId', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.sourceId);
    const identity = mongoose.isValidObjectId(id) ? { _id: id } : { sourceId: id };
    const item = await ProviderCatalogItem.findOne({
      ...identity, provider: 'afroland', active: true,
    }).select('sourceId type title year description posterUrl language country tmdbId card matchStatus').lean();
    if (!item) return res.status(404).json({ success: false, data: null, message: 'Fiche AfroLand introuvable.' });
    const episodes = item.type === 'tv' ? await getAfrolandEpisodes(item.sourceId) : [];
    const bySeason = new Map<number, typeof episodes>();
    for (const episode of episodes) {
      const seasonNumber = episode.season || 1;
      bySeason.set(seasonNumber, [...(bySeason.get(seasonNumber) || []), episode]);
    }
    const seasons = [...bySeason.entries()].sort(([a], [b]) => a - b).map(([seasonNumber, rows]) => ({
      id: seasonNumber,
      name: `Saison ${seasonNumber}`,
      season_number: seasonNumber,
      episode_count: rows.length,
      episodes: rows
        .sort((a, b) => (a.episode || 0) - (b.episode || 0))
        .map((episode, index) => ({
          id: episode.id,
          name: episode.name,
          episode_number: episode.episode || index + 1,
          runtime: undefined,
          still_path: episode.posterUrl,
          overview: episode.description || '',
        })),
    }));
    res.json({ success: true, data: { ...item, seasons }, message: null });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

/** GET /api/catalog/list?provider=&type=&page=&limit=&q=&matched= — JSON du catalogue scrapé. */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const query: CatalogListQuery = {
      provider: req.query.provider ? (req.query.provider as CatalogProvider) : undefined,
      type: req.query.type ? (req.query.type as CatalogItemType) : undefined,
      page: parseInt(String(req.query.page || '1'), 10) || 1,
      limit: parseInt(String(req.query.limit || '24'), 10) || 24,
      q: req.query.q ? String(req.query.q) : undefined,
      matched: req.query.matched ? (req.query.matched as CatalogListQuery['matched']) : undefined,
    };
    const data = await listCatalog(query);
    res.json({ success: true, data, message: null });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

/** GET /api/catalog/status — compteurs par provider + dernier sync. */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const data = await catalogStatus();
    res.json({ success: true, data, message: null });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

/** POST /api/catalog/filter — { type: 'movie'|'tv', ids: number[] } → ids présents dans l'index. */
router.post('/filter', async (req: Request, res: Response) => {
  try {
    const type = req.body?.type === 'tv' ? 'tv' : 'movie';
    const ids: number[] = Array.isArray(req.body?.ids)
      ? req.body.ids.map((n: any) => parseInt(String(n), 10)).filter((n: number) => !isNaN(n))
      : [];
    // Même gate que les grilles : tant que l'index est partiel, répondre « tout
    // est disponible » — sinon cet appel casserait ce que l'app affiche ailleurs.
    const kept = (await isCatalogFilterActive()) ? await filterIdsByCatalog(type, ids) : ids;
    res.json({ success: true, data: { ids: kept }, message: null });
  } catch (err: any) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

export default router;
