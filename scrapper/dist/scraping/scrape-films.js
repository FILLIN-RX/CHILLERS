"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeFilms = scrapeFilms;
const axios_1 = __importDefault(require("axios"));
const Movie_1 = __importDefault(require("../models/Movie"));
const ScraperState_1 = __importDefault(require("../models/ScraperState"));
const db_1 = require("../config/db");
const reupload_1 = require("../modules/reupload/reupload");
const scraping_hours_1 = require("../utils/scraping-hours");
const BASE_URL = 'https://www.open-otaku.me';
const MAX_EMPTY_RETRIES = 5;
const CONCURRENCY = 3;
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
async function fetchFilmsPage(page) {
    try {
        const { data } = await axios_1.default.get(`${BASE_URL}/api/fs-home`, {
            params: { category: 'films', page },
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        return Array.isArray(data?.items) ? data.items : [];
    }
    catch (err) {
        console.error(`[ScrapeFilms] Erreur fetch page ${page}:`, err.message);
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
        console.error(`[ScrapeFilms] Erreur fetch fs-watch (${id}):`, err.message);
        return null;
    }
}
async function getLastPage() {
    try {
        const state = await ScraperState_1.default.findOne({ name: 'films' });
        return state ? state.lastPage : 1;
    }
    catch {
        return 1;
    }
}
async function saveLastPage(page) {
    await ScraperState_1.default.findOneAndUpdate({ name: 'films' }, { $set: { lastPage: page, updatedAt: new Date() } }, { upsert: true });
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function processFilm(item) {
    const titre = item.title.trim();
    const ficheUrl = `${BASE_URL}/?watch_fs=${item.id}`;
    try {
        console.log(`[ScrapeFilms] Traitement : ${titre} (ID: ${item.id})`);
        const watch = await fetchWatchDetails(item.id);
        if (!watch) {
            console.log(`[ScrapeFilms] ⚠️ Données introuvables pour : ${titre}`);
            return;
        }
        const players = watch.players || {};
        // Priorité à Vidzy (compatible direct /api/dl), sinon premier lecteur disponible
        const embedUrl = players.vidzy?.default ||
            players.vidzy?.vff ||
            players.vidzy?.vf ||
            players.vidzy?.vostfr ||
            players.premium?.default ||
            Object.values(players)[0]?.default ||
            '';
        let directLink = null;
        if (embedUrl) {
            directLink = await getDirectLink(embedUrl);
        }
        if (!directLink) {
            console.log(`[ScrapeFilms] ⚠️ Lien direct introuvable pour : ${titre}`);
            return;
        }
        let year;
        if (watch.meta?.year) {
            const parsed = parseInt(String(watch.meta.year), 10);
            if (parsed > 1900 && parsed < 2100)
                year = parsed;
        }
        const poster = watch.meta?.poster || item.poster || undefined;
        const updateData = {
            titre,
            pageUrl: ficheUrl,
            lien: directLink,
            ...(year ? { year } : {}),
            ...(poster ? { posterUrl: poster, posterSource: 'tmdb' } : {})
        };
        const saved = await Movie_1.default.findOneAndUpdate({ titre }, { $set: updateData }, { upsert: true, returnDocument: 'after' });
        console.log(`[ScrapeFilms] ✅ Sauvegardé : ${titre}`);
        if (saved) {
            await (0, reupload_1.reuploadMovie)(saved._id.toString(), directLink, titre);
        }
    }
    catch (err) {
        console.error(`[ScrapeFilms] ❌ Erreur sur ${titre}:`, err.message);
    }
}
async function scrapeFilms() {
    await (0, db_1.connectDB)();
    console.log('[ScrapeFilms] Scraper ultra-rapide initialisé.');
    while (true) {
        await (0, scraping_hours_1.waitForScrapingHours)();
        let currentPage = await getLastPage();
        let hasMorePages = true;
        console.log(`[ScrapeFilms] Démarrage boucle depuis la page ${currentPage}`);
        while (hasMorePages) {
            console.log(`\n--- Page ${currentPage} ---`);
            let items = await fetchFilmsPage(currentPage);
            if (items.length === 0) {
                let retries = 0;
                let pageLoaded = false;
                while (retries < MAX_EMPTY_RETRIES) {
                    retries++;
                    console.log(`Page ${currentPage} vide (tentative ${retries}/${MAX_EMPTY_RETRIES}) — attend 5s...`);
                    await sleep(5000);
                    items = await fetchFilmsPage(currentPage);
                    if (items.length > 0) {
                        pageLoaded = true;
                        break;
                    }
                }
                if (!pageLoaded) {
                    console.log(`Page ${currentPage} toujours vide après ${MAX_EMPTY_RETRIES} tentatives — fin du cycle, retour page 1`);
                    hasMorePages = false;
                    await saveLastPage(1);
                    break;
                }
            }
            console.log(`Films trouvés sur la page : ${items.length}`);
            // Filtrer les éléments invalides ou séries
            const validItems = items.filter((it) => it.title && !it.title.includes('Saison') && !it.title.includes('Épisode'));
            // Vérification MongoDB en batch
            const titles = validItems.map((it) => it.title.trim());
            const existingMovies = await Movie_1.default.find({ titre: { $in: titles } }, { titre: 1, pageUrl: 1, lien: 1 }).lean();
            const existingSet = new Set(existingMovies.filter((m) => m.pageUrl && m.lien).map((m) => m.titre));
            const toProcess = validItems.filter((it) => {
                if (existingSet.has(it.title.trim())) {
                    console.log(`Déjà traité : ${it.title.trim()}`);
                    return false;
                }
                return true;
            });
            console.log(`Films restants à traiter : ${toProcess.length}/${validItems.length}`);
            // Traitement avec concurrence contrôlée
            for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
                const chunk = toProcess.slice(i, i + CONCURRENCY);
                await Promise.all(chunk.map((item) => processFilm(item)));
            }
            currentPage++;
            await saveLastPage(currentPage);
        }
        console.log("[ScrapeFilms] Cycle terminé, redémarrage dans 10s...");
        await sleep(10000);
    }
}
// Exécution directe
const isDirectExecution = process.argv[1] && (process.argv[1].includes('scrape-films') || process.argv[1].endsWith('scrape-films.ts') || process.argv[1].endsWith('scrape-films.js'));
if (isDirectExecution) {
    scrapeFilms().catch(console.error);
}
