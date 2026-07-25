import { Router, Response } from 'express';
import { adminMiddleware, AuthRequest } from '../middleware/auth';
import { startCron, stopCron, getCronStatus, runScrapingTasks, runMaintenanceTasks, runner, stopTask, getRunningTasks } from '../managers/cron-manager';
import { getLogs, addSSEClient } from '../config/log-buffer';
import { getDBStatus } from '../config/db';
import uqloadRoutes from '../modules/uqload/uqload.routes';
import ScraperState from '../models/ScraperState';

const router = Router();

router.get('/health', (_req, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      db: getDBStatus() === 1 ? 'connected' : 'disconnected',
    },
    message: null,
  });
});

router.post('/scrape/trigger', adminMiddleware, (req: AuthRequest, res: Response) => {
  const type = (req.body.type as string) || 'series';
  if (type === 'films' || type === 'all') {
    runner('Scraping Films', 'src/scraping/scrape-films.ts');
  }
  if (type === 'series' || type === 'all') {
    runner('Scraping Séries', 'src/scraping/scrape-series.ts');
  }
  res.json({ success: true, data: { status: 'launched', message: `Scraping ${type} lancé` }, message: null });
});

router.post('/maintenance/run', adminMiddleware, (req: AuthRequest, res: Response) => {
  const type = (req.body.type as string) || 'all';

  const scripts: Record<string, { label: string; path: string }> = {
    'dead-links': { label: 'Maintenance Liens', path: 'src/maintenance/maintainer.ts' },
    'tmdb-movies': { label: 'Linking TMDB Films', path: 'src/maintenance/link-movies-tmdb.ts' },
    'tmdb-series': { label: 'Linking TMDB Séries', path: 'src/maintenance/link-series-tmdb.ts' },
  };

  if (type === 'all') {
    runMaintenanceTasks();
    res.json({ success: true, data: { status: 'launched', message: 'Toutes les tâches de maintenance lancées' }, message: null });
    return;
  }

  const script = scripts[type];
  if (!script) {
    res.status(400).json({ success: false, data: null, message: `Type inconnu: ${type}` });
    return;
  }

  runner(script.label, script.path);
  res.json({ success: true, data: { status: 'launched', message: `${script.label} lancé` }, message: null });
});

router.get('/tasks/running', adminMiddleware, (_req: AuthRequest, res: Response) => {
  res.json({ success: true, data: getRunningTasks(), message: null });
});

router.post('/tasks/stop/:name', adminMiddleware, (req: AuthRequest, res: Response) => {
  const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const killed = stopTask(name);
  res.json({ success: true, data: { killed, name }, message: killed ? null : `Aucune tâche en cours: ${name}` });
});

router.post('/cron/start', adminMiddleware, (_req: AuthRequest, res: Response) => {
  startCron();
  res.json({ success: true, data: getCronStatus(), message: null });
});

router.post('/cron/stop', adminMiddleware, (_req: AuthRequest, res: Response) => {
  stopCron();
  res.json({ success: true, data: getCronStatus(), message: null });
});

router.get('/cron/status', adminMiddleware, (_req: AuthRequest, res: Response) => {
  res.json({ success: true, data: getCronStatus(), message: null });
});

router.get('/scraper-state', adminMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const films = await ScraperState.findOne({ name: 'films' });
    const series = await ScraperState.findOne({ name: 'series' });
    res.json({
      success: true,
      data: {
        films: films ? { lastPage: films.lastPage, updatedAt: films.updatedAt } : null,
        series: series ? { lastPage: series.lastPage, updatedAt: series.updatedAt } : null,
      },
      message: null,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, message: e.message });
  }
});

router.get('/logs', adminMiddleware, (req: AuthRequest, res: Response) => {
  const lines = parseInt(req.query.lines as string) || 100;
  res.json({ success: true, data: getLogs(lines), message: null });
});

router.get('/logs/stream', adminMiddleware, (req: AuthRequest, res: Response) => {
  addSSEClient(res);
});

router.get('/settings', adminMiddleware, (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      port: process.env.PORT || '4001',
      mongoUri: process.env.MONGO_URI ? '✓ configuré' : '✗ manquant',
      tmdbToken: process.env.TMDB_TOKEN ? '✓ configuré' : '✗ manquant',
      cronRunning: getCronStatus().running,
    },
    message: null,
  });
});

router.use('/uqload', uqloadRoutes);

export default router;
