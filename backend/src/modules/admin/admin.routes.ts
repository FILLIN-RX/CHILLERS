import { Router } from 'express';
import { adminMiddleware } from './admin.middleware';
import * as adminController from './admin.controller';

const router = Router();

router.post('/auth/login', adminController.login);
router.get('/auth/verify', adminMiddleware, adminController.verify);
router.get('/dashboard', adminMiddleware, adminController.dashboard);
router.get('/logs', adminMiddleware, adminController.logs);
router.get('/dead-links', adminMiddleware, adminController.deadLinks);
router.get('/settings', adminMiddleware, adminController.getSettings);
router.put('/settings', adminMiddleware, adminController.updateSettings);
router.post('/scrape/trigger', adminMiddleware, adminController.triggerScrape);
router.post('/clear-cache', adminMiddleware, adminController.clearTmdbCache);
router.get('/logs/stream', adminMiddleware, adminController.logStream);
router.get('/collection', adminMiddleware, adminController.collection);
router.get('/scraper-state', adminMiddleware, adminController.scraperState);
router.get('/serie/:id', adminMiddleware, adminController.getSerie);
router.get('/movie/:id', adminMiddleware, adminController.getMovie);
router.get('/tmdb/stats', adminMiddleware, adminController.tmdbStats);
router.post('/tmdb/link', adminMiddleware, adminController.triggerTmdbLink);

export default router;
