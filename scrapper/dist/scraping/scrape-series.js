"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeSeries = scrapeSeriesDetails;
const axios_1 = __importDefault(require("axios"));
const mongoose_1 = __importDefault(require("mongoose"));
const Serie_1 = __importDefault(require("../models/Serie"));
const ScraperState_1 = __importDefault(require("../models/ScraperState"));
const db_1 = require("../config/db");
const reupload_1 = require("../modules/reupload/reupload");
const scraping_hours_1 = require("../utils/scraping-hours");
const BASE_URL = 'https://www.open-otaku.me';
const MAX_EMPTY_RETRIES = 5;
const CONCURRENCY = 2;
function parseEpisodeLabel(label, defaultSeason = 1) {
    const trimmed = label.trim();
    const sxxExx = trimmed.match(/S(\d+)\s*E\s*(\d+)/i);
    if (sxxExx) {
        const season = parseInt(sxxExx[1], 10);
        const num = parseInt(sxxExx[2], 10);
        return { season, episodeNumber: num, canonical: `S${String(season).padStart(2, "0")}E${String(num).padStart(2, "0")}` };
    }
    const epWord = trimmed.match(/(?:Ép|Ep|Episode)\s*\.?\s*(\d+)/i);
    if (epWord) {
        const num = parseInt(epWord[1], 10);
        return { season: defaultSeason, episodeNumber: num, canonical: `S${String(defaultSeason).padStart(2, "0")}E${String(num).padStart(2, "0")}` };
    }
    return { season: defaultSeason, episodeNumber: 0, canonical: trimmed };
}
function toDownloadUrl(url) {
    if (!url)
        return '';
    if (url.includes('vidzy.'))
        return url.replace('/embed-', '/d/').replace('.html', '_n.html');
    if (url.includes('luluvid.'))
        return url.replace('/embed-', '/d/').replace('.html', '');
    return url;
}
async function getDirectLink(embedUrl) {
    try {
        const dlUrl = toDownloadUrl(embedUrl);
        if (!dlUrl)
            return null;
        const { data } = await axios_1.default.get(`${BASE_URL}/api/dl`, {
            params: { url: dlUrl },
            timeout: 20000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        return data?.success && data?.downloadUrl ? data.downloadUrl : null;
    }
    catch {
        return null;
    }
}
async function fetchSeriesPage(page) {
    try {
        const { data } = await axios_1.default.get(`${BASE_URL}/api/fs-home`, {
            params: { category: 'series', page },
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        return Array.isArray(data?.items) ? data.items : [];
    }
    catch (err) {
        console.error(`[ScrapeSeries] Erreur fetch page ${page}:`, err.message);
        return [];
    }
}
async function fetchWatchDetails(id) {
    try {
        const { data } = await axios_1.default.get(`${BASE_URL}/api/fs-watch`, {
            params: { id },
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        return data || {};
    }
    catch (err) {
        console.error(`[ScrapeSeries] Erreur fetch fs-watch (${id}):`, err.message);
        return null;
    }
}
async function loadState() {
    try {
        const state = await ScraperState_1.default.findOne({ name: 'series' });
        return { lastPage: state?.lastPage || 1 };
    }
    catch {
        return { lastPage: 1 };
    }
}
async function saveState(lastPage) {
    await ScraperState_1.default.findOneAndUpdate({ name: 'series' }, { $set: { lastPage, updatedAt: new Date() } }, { upsert: true });
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function processSerie(item, existingSeries) {
    const titre = item.title.trim();
    const ficheUrl = `${BASE_URL}/?watch_fs=${item.id}`;
    try {
        console.log(`[ScrapeSeries] Traitement : ${titre} (ID: ${item.id})`);
        const watch = await fetchWatchDetails(item.id);
        if (!watch) {
            console.log(`[ScrapeSeries] ⚠️ Données introuvables pour : ${titre}`);
            return;
        }
        let year;
        if (watch.meta?.year) {
            const parsed = parseInt(String(watch.meta.year), 10);
            if (parsed > 1900 && parsed < 2100)
                year = parsed;
        }
        if (!year) {
            const y = titre.match(/(\d{4})/);
            if (y) {
                const p = parseInt(y[1], 10);
                if (p > 1900 && p < 2100)
                    year = p;
            }
        }
        const poster = watch.meta?.poster || item.poster || undefined;
        const rawEps = watch.episodes || {};
        const vfMap = rawEps.vf || {};
        const vostfrMap = rawEps.vostfr || {};
        const version = Object.keys(vfMap).length > 0 ? vfMap : vostfrMap;
        const epNumbers = Object.keys(version).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
        let episodes = [];
        if (existingSeries && existingSeries.episodes && existingSeries.episodes.length > 0) {
            episodes = existingSeries.episodes;
        }
        else {
            const seasonMatch = titre.match(/Saison\s*(\d+)/i);
            const defaultSeason = seasonMatch ? parseInt(seasonMatch[1], 10) : 1;
            const episodeTasks = epNumbers.map(async (num) => {
                const players = version[num] || {};
                const embedUrl = players.vidzy || players.luluvid || Object.values(players)[0] || '';
                if (!embedUrl)
                    return null;
                const link = await getDirectLink(embedUrl);
                if (link) {
                    const { season, episodeNumber, canonical } = parseEpisodeLabel(`Épisode ${num}`, defaultSeason);
                    return { episode: canonical, season, episodeNumber, lien: link };
                }
                return null;
            });
            const resolved = await Promise.all(episodeTasks);
            episodes = resolved.filter((ep) => Boolean(ep));
            for (const ep of episodes) {
                console.log(`  -> ${ep.episode} : ${ep.lien.slice(0, 70)}...`);
            }
        }
        if (episodes.length === 0) {
            console.log(`[ScrapeSeries] ⚠️ Aucun épisode extrait pour : ${titre}`);
            return;
        }
        const serieData = {
            titre,
            pageUrl: ficheUrl,
            episodes,
            ...(year ? { year } : {}),
            ...(poster ? { posterUrl: poster, posterSource: 'tmdb' } : {})
        };
        const saved = await Serie_1.default.findOneAndUpdate({ titre }, { $set: serieData }, { upsert: true, returnDocument: 'after' });
        console.log(`[ScrapeSeries] ✅ Série enregistrée (${episodes.length} ép.) : ${titre}`);
        if (saved) {
            for (let epIdx = 0; epIdx < (saved.episodes || []).length; epIdx++) {
                const ep = saved.episodes[epIdx];
                if (!ep.lien || ep.lien === '#')
                    continue;
                await (0, reupload_1.reuploadEpisode)(saved._id.toString(), ep, epIdx);
            }
        }
    }
    catch (e) {
        console.error(`[ScrapeSeries] ❌ Erreur sur ${titre}:`, e.message);
    }
}
async function scrapeSeriesDetails() {
    console.log('[START] scrapeSeriesDetails() — connexion MongoDB...');
    await (0, db_1.connectDB)();
    console.log('[OK] Scraper Séries ultra-rapide initialisé.');
    let shuttingDown = false;
    process.on('SIGTERM', async () => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        console.log('\n[SIGTERM] Arrêt demandé, déconnexion...');
        await mongoose_1.default.disconnect().catch(() => { });
        process.exit(0);
    });
    while (true) {
        await (0, scraping_hours_1.waitForScrapingHours)();
        let currentPage = (await loadState()).lastPage;
        let hasMorePages = true;
        while (hasMorePages && !shuttingDown) {
            console.log(`\n--- Page Séries ${currentPage} ---`);
            let items = await fetchSeriesPage(currentPage);
            if (items.length === 0) {
                let retries = 0;
                let pageLoaded = false;
                while (retries < MAX_EMPTY_RETRIES) {
                    retries++;
                    console.log(`Page ${currentPage} vide (tentative ${retries}/${MAX_EMPTY_RETRIES}) — attend 5s...`);
                    await sleep(5000);
                    items = await fetchSeriesPage(currentPage);
                    if (items.length > 0) {
                        pageLoaded = true;
                        break;
                    }
                }
                if (!pageLoaded) {
                    console.log(`Page ${currentPage} toujours vide après ${MAX_EMPTY_RETRIES} tentatives — fin du cycle, retour page 1`);
                    hasMorePages = false;
                    await saveState(1);
                    break;
                }
            }
            console.log(`Séries trouvées sur la page : ${items.length}`);
            const validItems = items.filter(it => it.title);
            const titles = validItems.map(it => it.title.trim());
            // Vérification MongoDB en batch
            const existingSeriesList = await Serie_1.default.find({ titre: { $in: titles } }, { titre: 1, pageUrl: 1, episodes: 1 }).lean();
            const existingMap = new Map(existingSeriesList.map(s => [s.titre, s]));
            const toProcess = validItems.filter(it => {
                const existing = existingMap.get(it.title.trim());
                if (existing && existing.pageUrl && existing.episodes && existing.episodes.length > 0) {
                    console.log(`Déjà traitée et complète : ${it.title.trim()}`);
                    return false;
                }
                return true;
            });
            console.log(`Séries à traiter : ${toProcess.length}/${validItems.length}`);
            for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
                if (shuttingDown)
                    break;
                const chunk = toProcess.slice(i, i + CONCURRENCY);
                await Promise.all(chunk.map(it => processSerie(it, existingMap.get(it.title.trim()))));
            }
            currentPage++;
            await saveState(currentPage);
        }
        console.log("[ScrapeSeries] Cycle terminé, redémarrage dans 10s...");
        await sleep(10000);
    }
}
// Exécution directe
const isDirectExecution = process.argv[1] && (process.argv[1].includes('scrape-series') || process.argv[1].endsWith('scrape-series.ts') || process.argv[1].endsWith('scrape-series.js'));
if (isDirectExecution) {
    (async () => {
        while (true) {
            try {
                await scrapeSeriesDetails();
            }
            catch (err) {
                console.log(`[ScrapeSeries] Crash: ${err?.message || err} — redémarrage dans 10s...`);
                await sleep(10000);
            }
        }
    })();
}
