"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const cron_manager_1 = require("../managers/cron-manager");
const log_buffer_1 = require("../config/log-buffer");
const db_1 = require("../config/db");
const uqload_routes_1 = __importDefault(require("../modules/uqload/uqload.routes"));
const ScraperState_1 = __importDefault(require("../models/ScraperState"));
const router = (0, express_1.Router)();
router.get('/health', (_req, res) => {
    res.json({
        success: true,
        data: {
            status: 'ok',
            uptime: process.uptime(),
            db: (0, db_1.getDBStatus)() === 1 ? 'connected' : 'disconnected',
        },
        message: null,
    });
});
router.post('/scrape/trigger', auth_1.adminMiddleware, (req, res) => {
    const type = req.body.type || 'series';
    if (type === 'films' || type === 'all') {
        (0, cron_manager_1.runner)('Scraping Films', 'src/scraping/scrape-films.ts');
    }
    if (type === 'series' || type === 'all') {
        (0, cron_manager_1.runner)('Scraping Séries', 'src/scraping/scrape-series.ts');
    }
    res.json({ success: true, data: { status: 'launched', message: `Scraping ${type} lancé` }, message: null });
});
router.post('/maintenance/run', auth_1.adminMiddleware, (req, res) => {
    const type = req.body.type || 'all';
    const scripts = {
        'dead-links': { label: 'Maintenance Liens', path: 'src/maintenance/maintainer.ts' },
        'tmdb-movies': { label: 'Linking TMDB Films', path: 'src/maintenance/link-movies-tmdb.ts' },
        'tmdb-series': { label: 'Linking TMDB Séries', path: 'src/maintenance/link-series-tmdb.ts' },
    };
    if (type === 'all') {
        (0, cron_manager_1.runMaintenanceTasks)();
        res.json({ success: true, data: { status: 'launched', message: 'Toutes les tâches de maintenance lancées' }, message: null });
        return;
    }
    const script = scripts[type];
    if (!script) {
        res.status(400).json({ success: false, data: null, message: `Type inconnu: ${type}` });
        return;
    }
    (0, cron_manager_1.runner)(script.label, script.path);
    res.json({ success: true, data: { status: 'launched', message: `${script.label} lancé` }, message: null });
});
router.get('/tasks/running', auth_1.adminMiddleware, (_req, res) => {
    res.json({ success: true, data: (0, cron_manager_1.getRunningTasks)(), message: null });
});
router.post('/tasks/stop/:name', auth_1.adminMiddleware, (req, res) => {
    const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
    const killed = (0, cron_manager_1.stopTask)(name);
    res.json({ success: true, data: { killed, name }, message: killed ? null : `Aucune tâche en cours: ${name}` });
});
router.post('/cron/start', auth_1.adminMiddleware, (_req, res) => {
    (0, cron_manager_1.startCron)();
    res.json({ success: true, data: (0, cron_manager_1.getCronStatus)(), message: null });
});
router.post('/cron/stop', auth_1.adminMiddleware, (_req, res) => {
    (0, cron_manager_1.stopCron)();
    res.json({ success: true, data: (0, cron_manager_1.getCronStatus)(), message: null });
});
router.get('/cron/status', auth_1.adminMiddleware, (_req, res) => {
    res.json({ success: true, data: (0, cron_manager_1.getCronStatus)(), message: null });
});
router.get('/scraper-state', auth_1.adminMiddleware, async (_req, res) => {
    try {
        const films = await ScraperState_1.default.findOne({ name: 'films' });
        const series = await ScraperState_1.default.findOne({ name: 'series' });
        res.json({
            success: true,
            data: {
                films: films ? { lastPage: films.lastPage, updatedAt: films.updatedAt } : null,
                series: series ? { lastPage: series.lastPage, updatedAt: series.updatedAt } : null,
            },
            message: null,
        });
    }
    catch (e) {
        res.status(500).json({ success: false, data: null, message: e.message });
    }
});
router.get('/logs', auth_1.adminMiddleware, (req, res) => {
    const lines = parseInt(req.query.lines) || 100;
    res.json({ success: true, data: (0, log_buffer_1.getLogs)(lines), message: null });
});
router.get('/logs/stream', auth_1.adminMiddleware, (req, res) => {
    (0, log_buffer_1.addSSEClient)(res);
});
router.get('/settings', auth_1.adminMiddleware, (_req, res) => {
    res.json({
        success: true,
        data: {
            port: process.env.PORT || '4001',
            mongoUri: process.env.MONGO_URI ? '✓ configuré' : '✗ manquant',
            tmdbToken: process.env.TMDB_TOKEN ? '✓ configuré' : '✗ manquant',
            cronRunning: (0, cron_manager_1.getCronStatus)().running,
        },
        message: null,
    });
});
router.use('/uqload', uqload_routes_1.default);
exports.default = router;
