import { Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { AuthRequest } from './admin.middleware';
import * as adminService from './admin.service';
import { clearCache } from '../../config/tmdb';
import { chromium } from 'playwright';
import { appendLog } from '../../config/log-buffer';
import Admin from '../../models/Admin';
import Movie from '../../models/Movie';
import Serie from '../../models/Serie';
import DeadLink from '../../models/DeadLink';
import { startCron, stopCron, getCronStatus, runScrapingTasks, runMaintenanceTasks, runner, stopTask, getRunningTasks } from '../../cron-manager';
import { UqloadClient } from '../uqload/uqload.client';
import { uploadMoviesBatch, uploadSeriesBatch, uploadSingleMovie, uploadSingleEpisode, stopUpload, isUploadRunning } from '../uqload/uqload.uploader';

const JWT_SECRET = process.env.JWT_SECRET || 'chiller-admin-secret-change-me';
const SCRAPER_API_URL = process.env.SCRAPER_API_URL;

async function scraperProxy(req: AuthRequest, res: Response, endpoint: string, method: 'get' | 'post' = 'post') {
  if (!SCRAPER_API_URL) {
    return null;
  }
  try {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : req.query.token;
    const response = await axios({
      method,
      url: `${SCRAPER_API_URL}/api${endpoint}`,
      data: method === 'post' ? req.body : undefined,
      params: method === 'get' ? { ...req.query, token } : { token },
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });
    res.json(response.data);
    return true;
  } catch (e: any) {
    console.error(`[ScraperProxy] Erreur vers ${SCRAPER_API_URL}${endpoint}:`, e.message);
    res.status(502).json({ success: false, data: null, message: `Scraper injoignable: ${e.message}` });
    return true;
  }
}

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

export async function appealDeadLink(req: AuthRequest, res: Response) {
    try {
        const result = await adminService.appealDeadLink(req.params.id as string);
        if (!result.found) {
            res.status(404).json({ success: false, data: null, message: 'Lien introuvable' });
            return;
        }
        res.json({ success: true, data: result, message: result.alive ? 'Lien rétabli !' : 'Toujours mort' });
    } catch (e: any) {
        res.status(500).json({ success: false, data: null, message: e.message });
    }
}

export async function rescrapeDeadLink(req: AuthRequest, res: Response) {
    try {
        const deadLink = await DeadLink.findById(req.params.id).lean();
        if (!deadLink) {
            res.status(404).json({ success: false, data: null, message: 'Lien introuvable' });
            return;
        }

        const headless = req.body.headless !== false;
        const { titre, episode, type } = deadLink;
        appendLog(`[Rescrape] Début — "${titre}" (${episode}, headless: ${headless})`);

        res.json({ success: true, data: { status: 'launched', titre, episode, type }, message: 'Rescrape lancé' });

        setTimeout(async () => {
            try {
                const browser = await chromium.launch({
                    headless,
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
                });
                const page = await browser.newPage();
                page.on('console', msg => appendLog(`[Browser] ${msg.text()}`));

                // Try to navigate directly to pageUrl if available
                let pageUrl: string | null = null;
                if (type === 'series') {
                    const doc = await Serie.findOne({ titre }, 'pageUrl').lean();
                    pageUrl = doc?.pageUrl || null;
                } else {
                    const doc = await Movie.findOne({ titre }, 'pageUrl').lean();
                    pageUrl = doc?.pageUrl || null;
                }

                if (pageUrl) {
                    appendLog(`[Rescrape] Navigation directe vers ${pageUrl}`);
                    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForTimeout(2000);
                } else {
                    const searchUrl = type === 'series' ? 'https://www.open-otaku.me/?cat=series' : 'https://www.open-otaku.me/';
                    appendLog(`[Rescrape] Recherche sur ${searchUrl}`);
                    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForTimeout(2000);

                    const searchBtn = page.locator('#fs-search-icon-btn');
                    if (await searchBtn.count() > 0) {
                        await searchBtn.click();
                        await page.waitForTimeout(1000);
                    }

                    const searchInput = page.locator('input[type="search"], input[type="text"], #fs-search-input, .fs-search-input');
                    if (await searchInput.count() > 0) {
                        await searchInput.first().fill(titre);
                        await page.keyboard.press('Enter');
                        await page.waitForTimeout(3000);
                    } else {
                        await page.goto(`https://www.open-otaku.me/?s=${encodeURIComponent(titre)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        await page.waitForTimeout(3000);
                    }

                    const cards = await page.locator('.fs-card').all();
                    if (cards.length === 0) {
                        appendLog(`[Rescrape] ❌ Aucun résultat pour "${titre}"`);
                        await browser.close();
                        return;
                    }
                    appendLog(`[Rescrape] ${cards.length} résultat(s) trouvé(s)`);

                    let targetCard = cards[0];
                    const searchNorm = titre.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
                    for (const card of cards) {
                        const cardTitle = await card.locator('.fs-card-title').innerText().catch(() => '');
                        const cardNorm = cardTitle.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
                        if (cardNorm === searchNorm) { targetCard = card; break; }
                    }

                    await targetCard.click();
                    await page.waitForLoadState('domcontentloaded');
                    await page.waitForTimeout(2000);
                }

                appendLog(`[Rescrape] Page détail ouverte`);

                let newLink: string | null = null;

                if (type === 'series' && episode) {
                    const epNum = episode.replace(/.*?(\d+)/, '$1');
                    appendLog(`[Rescrape] Recherche épisode ${episode}`);

                    const selected = await page.evaluate((epNum) => {
                        const select = document.querySelector('#fs-episode-select') as HTMLSelectElement | null;
                        if (!select) return false;
                        const option = Array.from(select.options).find(o => o.text.trim().includes(epNum));
                        if (option) {
                            select.value = option.value;
                            select.dispatchEvent(new Event('change'));
                            return true;
                        }
                        return false;
                    }, epNum);

                    if (!selected) {
                        appendLog(`[Rescrape] ❌ Épisode ${episode} non trouvé dans le dropdown`);
                        await browser.close();
                        return;
                    }
                    await page.waitForTimeout(4000);
                }

                const dlBtn = page.locator('button#fs-quick-download, .fs-download-btn, button:has-text("Download")');
                if (await dlBtn.count() > 0) {
                    await dlBtn.first().click({ force: true });
                    appendLog(`[Rescrape] Téléchargement cliqué, attente du lien...`);
                    await page.waitForTimeout(10000);

                    const dlLink = page.locator('a#fs-dl-link');
                    if (await dlLink.count() > 0) {
                        newLink = await dlLink.first().getAttribute('href');
                    }

                    if (!newLink || newLink === '#') {
                        const allLinks = await page.locator('a[href]').all();
                        for (const link of allLinks) {
                            const href = await link.getAttribute('href');
                            if (href && (href.includes('.mp4') || href.includes('vidzy') || href.includes('doodstream'))) {
                                newLink = href;
                                break;
                            }
                        }
                    }
                }

                await browser.close();

                if (!newLink || newLink === '#') {
                    appendLog(`[Rescrape] ❌ Aucun lien trouvé pour "${titre}"`);
                    return;
                }

                appendLog(`[Rescrape] ✅ Nouveau lien: ${newLink.substring(0, 80)}...`);

                if (type === 'series') {
                    const serie = await Serie.findOne({ titre });
                    if (serie) {
                        const ep = serie.episodes.find(e => e.episode === episode);
                        if (ep) {
                            ep.lien = newLink;
                            await serie.save();
                            appendLog(`[Rescrape] ✅ Série mise à jour: ${titre} / ${episode}`);
                        } else {
                            appendLog(`[Rescrape] ⚠ Épisode "${episode}" non trouvé dans la série`);
                        }
                    } else {
                        appendLog(`[Rescrape] ⚠ Série "${titre}" introuvable dans MongoDB`);
                    }
                } else {
                    const updated = await Movie.findOneAndUpdate(
                        { titre },
                        { $set: { lien: newLink } },
                        { new: true }
                    );
                    if (updated) {
                        appendLog(`[Rescrape] ✅ Film mis à jour: ${titre}`);
                    } else {
                        appendLog(`[Rescrape] ⚠ Film "${titre}" introuvable dans MongoDB`);
                    }
                }

                await DeadLink.findByIdAndDelete(req.params.id);
                appendLog(`[Rescrape] ✅ Entrée lien mort supprimée`);

            } catch (e: any) {
                appendLog(`[Rescrape] ❌ Erreur: ${e.message}`);
            }
        }, 100);
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
    if (await scraperProxy(req, res, '/scrape/trigger')) return;
    const type = req.body.type as string || 'series';
    if (type === 'films' || type === 'all') {
        runner('Scraping Films', 'scraping/core/scrape-films.js');
    }
    if (type === 'series' || type === 'all') {
        runner('Scraping Séries', 'scraping/core/scrape-series.js');
    }
    res.json({ success: true, data: { status: 'launched', message: `Scraping ${type} lancé` }, message: null });
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

export async function linkTmdb(req: AuthRequest, res: Response) {
    try {
        const { type, id, tmdbId } = req.body;
        if (!type || !id || !tmdbId) {
            res.status(400).json({ success: false, data: null, message: 'type, id, et tmdbId requis' });
            return;
        }
        if (type !== 'movies' && type !== 'series') {
            res.status(400).json({ success: false, data: null, message: 'type doit être movies ou series' });
            return;
        }
        if (typeof tmdbId !== 'number') {
            res.status(400).json({ success: false, data: null, message: 'tmdbId doit être un nombre' });
            return;
        }

        const updated = type === 'movies'
            ? await Movie.findByIdAndUpdate(id, { $set: { tmdbId } }, { new: true }).lean()
            : await Serie.findByIdAndUpdate(id, { $set: { tmdbId } }, { new: true }).lean();

        if (!updated) {
            res.status(404).json({ success: false, data: null, message: 'Document introuvable' });
            return;
        }

        res.json({ success: true, data: { tmdbId }, message: 'TMDB lié avec succès' });
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
    const label = type === 'movies' ? 'Linking TMDB Films' : 'Linking TMDB Séries';
    runner(label, `scraping/maintenance/${scriptName}`);
    res.json({ success: true, data: { status: 'launched', message: `${label} lancé` }, message: null });
}

export async function cronStart(_req: AuthRequest, res: Response) {
    startCron();
    res.json({ success: true, data: getCronStatus(), message: null });
}

export async function cronStop(_req: AuthRequest, res: Response) {
    stopCron();
    res.json({ success: true, data: getCronStatus(), message: null });
}

export async function cronStatus(_req: AuthRequest, res: Response) {
    res.json({ success: true, data: getCronStatus(), message: null });
}

export async function runningTasks(_req: AuthRequest, res: Response) {
    res.json({ success: true, data: getRunningTasks(), message: null });
}

export async function stopTaskHandler(req: AuthRequest, res: Response) {
    const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
    const killed = stopTask(name);
    res.json({ success: true, data: { killed, name }, message: killed ? null : `Aucune tâche en cours: ${name}` });
}

export async function runMaintenance(req: AuthRequest, res: Response) {
    if (await scraperProxy(req, res, '/maintenance/run')) return;
    const type = req.body.type as string || 'all';

    const scripts: Record<string, { label: string, path: string }> = {
        'dead-links': { label: 'Maintenance Liens', path: 'scraping/maintenance/maintainer.js' },
        'check-all-links': { label: 'Vérification Liens Morts', path: 'scraping/maintenance/check-all-links.js' },
        'tmdb-movies': { label: 'Linking TMDB Films', path: 'scraping/maintenance/link-movies-tmdb.js' },
        'tmdb-series': { label: 'Linking TMDB Séries', path: 'scraping/maintenance/link-series-tmdb.js' },
        'organize': { label: 'Organize Séries Doodstream', path: 'scraping/maintenance/organize-series.js' },
        'sync': { label: 'Sync Séries → MongoDB', path: 'scraping/maintenance/sync-series-to-mongo.js' },
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

function getUqloadClient(): UqloadClient | null {
    const apiKey = process.env.UQLOAD_API_KEY;
    if (!apiKey) return null;
    return new UqloadClient(apiKey);
}

export async function uqloadUploadMovies(req: AuthRequest, res: Response) {
    const client = getUqloadClient();
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
}

export async function uqloadUploadSeries(req: AuthRequest, res: Response) {
    const client = getUqloadClient();
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
}

export async function uqloadUploadMovie(req: AuthRequest, res: Response) {
    const client = getUqloadClient();
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
}

export async function uqloadUploadEpisode(req: AuthRequest, res: Response) {
    const client = getUqloadClient();
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
}

export async function uqloadStop(_req: AuthRequest, res: Response) {
    stopUpload();
    res.json({ success: true, data: null, message: 'Arrêt demandé' });
}

export async function uqloadStatus(_req: AuthRequest, res: Response) {
    const apiKey = process.env.UQLOAD_API_KEY;
    if (!apiKey) {
        res.json({ success: true, data: { configured: false, message: 'UQLOAD_API_KEY non configurée' }, message: null });
        return;
    }
    try {
        const client = new UqloadClient(apiKey);
        const [accountInfo, moviesPending, seriesPending, moviesPendingBoth, episodesPendingBoth] = await Promise.all([
            client.getAccountInfo(),
            Movie.countDocuments({ $or: [{ uqloadCode: { $eq: null } }, { uqloadCode: { $exists: false } }] }),
            Serie.countDocuments({ 'episodes.uqloadCode': { $eq: null } }),
            Movie.countDocuments({
                uqloadCode: { $exists: false },
                $or: [{ fileCode: { $exists: false } }, { fileCode: { $eq: null } }],
            }),
            Serie.countDocuments({
                $or: [
                    { 'episodes.uqloadCode': { $exists: false }, 'episodes.fileCode': { $exists: false } },
                    { 'episodes.uqloadCode': null, 'episodes.fileCode': null },
                ],
            }),
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
                pendingBoth: {
                    movies: moviesPendingBoth,
                    series: episodesPendingBoth,
                },
            },
            message: null,
        });
    } catch (e: any) {
        res.status(500).json({ success: false, data: { configured: true, error: e.message }, message: e.message });
    }
}

export async function uqloadPending(_req: AuthRequest, res: Response) {
    try {
        const [movies, series] = await Promise.all([
            Movie.find({ $or: [{ uqloadCode: { $eq: null } }, { uqloadCode: { $exists: false } }] })
                .select('titre lien uqloadCode fileCode createdAt')
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
                    seriesEpisodes.push({
                        serieTitre: serie.titre,
                        episode: ep.episode,
                        lien: ep.lien,
                        uqloadCode: ep.uqloadCode || null,
                        fileCode: ep.fileCode || null,
                    });
                }
            }
        }

        res.json({
            success: true,
            data: {
                movies: movies.map((m: any) => ({ titre: m.titre, lien: m.lien, uqloadCode: m.uqloadCode || null, fileCode: m.fileCode || null, createdAt: m.createdAt })),
                series: seriesEpisodes.slice(0, 200),
                totalMovies: movies.length,
                totalEpisodes: seriesEpisodes.length,
            },
            message: null,
        });
    } catch (e: any) {
        res.status(500).json({ success: false, data: null, message: e.message });
    }
}

export async function uqloadPendingBoth(_req: AuthRequest, res: Response) {
    try {
        const [movies, series] = await Promise.all([
            Movie.find({
                uqloadCode: { $exists: false },
                $or: [{ fileCode: { $exists: false } }, { fileCode: null }],
            })
                .select('titre lien pageUrl tmdbId createdAt')
                .sort({ createdAt: -1 })
                .limit(200)
                .lean(),
            Serie.find({
                $or: [
                    { 'episodes.uqloadCode': { $exists: false }, 'episodes.fileCode': { $exists: false } },
                    { 'episodes.uqloadCode': null, 'episodes.fileCode': null },
                ],
            })
                .select('titre episodes')
                .sort({ createdAt: -1 })
                .limit(200)
                .lean(),
        ]);

        const seriesEpisodes: any[] = [];
        for (const serie of series) {
            for (const ep of serie.episodes || []) {
                if (!ep.uqloadCode && !ep.fileCode) {
                    seriesEpisodes.push({
                        serieId: serie._id,
                        serieTitre: serie.titre,
                        episode: ep.episode,
                        season: ep.season,
                        episodeNumber: ep.episodeNumber,
                        lien: ep.lien,
                    });
                }
            }
        }

        res.json({
            success: true,
            data: {
                movies: movies.map(m => ({ _id: m._id, titre: m.titre, lien: m.lien, pageUrl: m.pageUrl, tmdbId: m.tmdbId, createdAt: m.createdAt })),
                series: seriesEpisodes.slice(0, 200),
                totalMovies: movies.length,
                totalEpisodes: seriesEpisodes.length,
            },
            message: null,
        });
    } catch (e: any) {
        res.status(500).json({ success: false, data: null, message: e.message });
    }
}
