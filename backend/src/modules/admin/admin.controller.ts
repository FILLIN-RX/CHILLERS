import { Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AuthRequest } from './admin.middleware';
import * as adminService from './admin.service';
import { clearCache } from '../../config/tmdb';
import Admin from '../../models/Admin';
import Movie from '../../models/Movie';
import Serie from '../../models/Serie';
import { exec } from 'child_process';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'chiller-admin-secret-change-me';

export async function login(req: AuthRequest, res: Response) {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username });
    if (!admin) {
        const adminUser = process.env.ADMIN_USERNAME || 'admin';
        const adminPass = process.env.ADMIN_PASSWORD || 'admin';
        if (username !== adminUser) {
            res.status(401).json({ success: false, data: null, message: 'Identifiants invalides' });
            return;
        }
        const valid = adminPass.startsWith('$2a$')
            ? await bcrypt.compare(password, adminPass)
            : password === adminPass;
        if (!valid) {
            res.status(401).json({ success: false, data: null, message: 'Identifiants invalides' });
            return;
        }
    } else {
        const valid = await bcrypt.compare(password, admin.password);
        if (!valid) {
            res.status(401).json({ success: false, data: null, message: 'Identifiants invalides' });
            return;
        }
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, data: { token, username }, message: null });
}

export async function verify(_req: AuthRequest, res: Response) {
    res.json({ success: true, data: { valid: true, admin: _req.admin }, message: null });
}

export async function dashboard(_req: AuthRequest, res: Response) {
    try {
        const [stats, recent, health] = await Promise.all([
            adminService.getDashboardStats(),
            adminService.getRecentItems(),
            adminService.getHealth(),
        ]);
        res.json({ success: true, data: { ...stats, recent, health }, message: null });
    } catch (e: any) {
        res.status(500).json({ success: false, data: null, message: e.message });
    }
}

export async function logs(req: AuthRequest, res: Response) {
    const lines = parseInt(req.query.lines as string) || 100;
    const type = req.query.type as string || 'all';

    const result: any = {};
    if (type === 'all' || type === 'series') result.series = adminService.getTmdbLinkErrors(lines).series;
    if (type === 'all' || type === 'movies') result.movies = adminService.getTmdbLinkErrors(lines).movies;
    if (type === 'all' || type === 'cron') result.cron = adminService.getCronLogs(lines);

    res.json({ success: true, data: result, message: null });
}

export async function deadLinks(_req: AuthRequest, res: Response) {
    try {
        const links = await adminService.getDeadLinks();
        res.json({ success: true, data: links, message: null });
    } catch (e: any) {
        res.status(500).json({ success: false, data: null, message: e.message });
    }
}

export async function getSettings(_req: AuthRequest, res: Response) {
    const settings = adminService.getSettings();
    res.json({ success: true, data: settings, message: null });
}

export async function updateSettings(req: AuthRequest, res: Response) {
    const { corsOrigin, doodstreamApiKey, notificationEmail } = req.body;

    if (corsOrigin) process.env.CORS_ORIGIN = corsOrigin;
    if (doodstreamApiKey) process.env.DOODSTREAM_API_KEY = doodstreamApiKey;
    if (notificationEmail) process.env.NOTIFICATION_EMAIL = notificationEmail;

    res.json({ success: true, data: { message: 'Paramètres mis à jour (session uniquement)' }, message: null });
}

export async function triggerScrape(req: AuthRequest, res: Response) {
    const type = req.body.type as string || 'series';

    const scriptPath = type === 'films'
        ? path.join(__dirname, '../../scraping/core/scrape-films.js')
        : path.join(__dirname, '../../scraping/core/scrape-series.js');

    exec(`node ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
            res.json({ success: true, data: { status: 'error', message: error.message, output: stderr }, message: null });
            return;
        }
        res.json({ success: true, data: { status: 'done', output: stdout }, message: null });
    });
}

export async function clearTmdbCache(_req: AuthRequest, res: Response) {
    clearCache();
    res.json({ success: true, data: { message: 'Cache TMDB vidé' }, message: null });
}

export async function logStream(_req: AuthRequest, res: Response) {
    const { addSSEClient } = await import('../../config/log-buffer');
    addSSEClient(res);
}

export async function scraperState(_req: AuthRequest, res: Response) {
    try {
        const data = await adminService.getScraperState();
        res.json({ success: true, data, message: null });
    } catch (e: any) {
        res.status(500).json({ success: false, data: null, message: e.message });
    }
}

export async function getSerie(req: AuthRequest, res: Response) {
    try {
        const serie = await Serie.findById(req.params.id).lean();
        if (!serie) {
            res.status(404).json({ success: false, data: null, message: 'Série introuvable' });
            return;
        }
        res.json({ success: true, data: serie, message: null });
    } catch (e: any) {
        res.status(500).json({ success: false, data: null, message: e.message });
    }
}

export async function getMovie(req: AuthRequest, res: Response) {
    try {
        const movie = await Movie.findById(req.params.id).lean();
        if (!movie) {
            res.status(404).json({ success: false, data: null, message: 'Film introuvable' });
            return;
        }
        res.json({ success: true, data: movie, message: null });
    } catch (e: any) {
        res.status(500).json({ success: false, data: null, message: e.message });
    }
}

export async function tmdbStats(_req: AuthRequest, res: Response) {
    try {
        const stats = await adminService.getTmdbStats();
        res.json({ success: true, data: stats, message: null });
    } catch (e: any) {
        res.status(500).json({ success: false, data: null, message: e.message });
    }
}

export async function triggerTmdbLink(req: AuthRequest, res: Response) {
    const type = req.body.type as string || 'series';
    const scriptName = type === 'movies' ? 'link-movies-tmdb.ts' : 'link-series-tmdb.ts';
    const scriptPath = path.join(__dirname, `../../scraping/maintenance/${scriptName}`);

    exec(`npx tsx ${scriptPath}`, { cwd: path.join(__dirname, '../..') }, (error, stdout, stderr) => {
        if (error) {
            res.json({ success: true, data: { status: 'error', message: error.message, output: stderr }, message: null });
            return;
        }
        res.json({ success: true, data: { status: 'done', output: stdout }, message: null });
    });
}

export async function collection(req: AuthRequest, res: Response) {
    try {
        const type = req.query.type as string || 'movies';
        const q = (req.query.q as string || '').trim();
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
        const data = await adminService.searchCollection(type, q, page, limit);
        res.json({ success: true, data, message: null });
    } catch (e: any) {
        res.status(500).json({ success: false, data: null, message: e.message });
    }
}
