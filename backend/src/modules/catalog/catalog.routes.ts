import { Router, Request, Response } from 'express';
import { catalogStatus, filterIdsByCatalog, isCatalogFilterActive, listCatalog, CatalogListQuery } from './catalog.service';
import { CatalogItemType, CatalogProvider } from '../../models/ProviderCatalogItem';

const router = Router();

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
