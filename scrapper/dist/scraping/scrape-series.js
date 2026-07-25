"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeSeries = scrapeSeriesDetails;
const playwright_1 = require("playwright");
const mongoose_1 = __importDefault(require("mongoose"));
const Serie_1 = __importDefault(require("../models/Serie"));
const ScraperState_1 = __importDefault(require("../models/ScraperState"));
const browser_1 = require("../config/browser");
const db_1 = require("../config/db");
const uqload_client_1 = require("../modules/uqload/uqload.client");
const reupload_1 = require("../modules/reupload/reupload");
async function uploadEpisodeToUqload(client, label, lien, serieId, episodeIndex) {
    if (!client)
        return;
    try {
        console.log(`    -> Upload Uqload: ${label}`);
        const { fileCode, directLink } = await client.uploadByUrlAndGetLink(lien, label);
        const bestQuality = directLink?.versions?.find((v) => v.name === 'n') || directLink?.versions?.[0];
        await Serie_1.default.updateOne({ _id: serieId }, { $set: { [`episodes.${episodeIndex}.uqloadCode`]: fileCode, [`episodes.${episodeIndex}.uqloadLink`]: bestQuality?.url || null } });
        console.log(`    -> ✅ Uqload: ${label} → ${fileCode}`);
    }
    catch (e) {
        console.log(`    -> ⏭ Uqload ignoré: ${e.message}`);
    }
}
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
async function scrapeSeriesDetails() {
    console.log('[START] scrapeSeriesDetails() called — connecting to MongoDB...');
    await (0, db_1.connectDB)();
    console.log('[OK] MongoDB connected, launching Playwright...');
    const browser = await playwright_1.chromium.launch(browser_1.browserConfig);
    console.log('[OK] Playwright browser launched');
    const page = await browser.newPage();
    const apiKey = process.env.UQLOAD_API_KEY;
    const uqload = apiKey ? new uqload_client_1.UqloadClient(apiKey) : null;
    let shuttingDown = false;
    process.on('SIGTERM', async () => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        console.log('\n[SIGTERM] Arrêt demandé, fermeture du navigateur...');
        await browser.close().catch(() => { });
        await mongoose_1.default.disconnect().catch(() => { });
        process.exit(0);
    });
    while (true) {
        let currentPage = (await loadState()).lastPage;
        let hasMorePages = true;
        while (hasMorePages && !shuttingDown) {
            const url = `https://www.open-otaku.me/?cat=series&page=${currentPage}`;
            console.log(`\n--- Navigation vers ${url} ---`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            try {
                await page.waitForSelector('.fs-card', { timeout: 30000 });
            }
            catch (e) {
                let retries = 0;
                let pageLoaded = false;
                while (retries < 5) {
                    retries++;
                    console.log(`Page ${currentPage} vide (tentative ${retries}/5) — attend 15s puis réessaie...`);
                    await new Promise(r => setTimeout(r, 15000));
                    try {
                        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                        await page.waitForSelector('.fs-card', { timeout: 30000 });
                        pageLoaded = true;
                        break;
                    }
                    catch { }
                }
                if (!pageLoaded) {
                    console.log(`Page ${currentPage} toujours vide après 5 tentatives — vraie fin, retour page 1`);
                    hasMorePages = false;
                    await saveState(1);
                    break;
                }
            }
            let cards = await page.$$('.fs-card');
            console.log(`Séries trouvées sur la page : ${cards.length}`);
            for (let i = 0; i < cards.length; i++) {
                try {
                    let currentCards = await page.$$('.fs-card');
                    let card = currentCards[i];
                    let titre = await card.$eval('.fs-card-title', (el) => el.innerText.trim());
                    const existingSeries = await Serie_1.default.findOne({ titre: titre });
                    if (existingSeries && existingSeries.pageUrl && existingSeries.episodes && existingSeries.episodes.length > 0) {
                        console.log(`Série déjà traitée et complète : ${titre}`);
                        continue;
                    }
                    console.log(`Traitement de la série : ${titre}`);
                    await card.click();
                    await page.waitForLoadState('domcontentloaded');
                    await page.waitForTimeout(1000);
                    const pageUrl = page.url();
                    let serieData = {
                        titre: titre,
                        pageUrl: pageUrl,
                        episodes: existingSeries ? existingSeries.episodes : []
                    };
                    if (serieData.episodes.length === 0) {
                        console.log(`  -> Récupération des épisodes pour : ${titre}`);
                        while (true) {
                            await page.waitForSelector('#fs-episode-select', { state: 'attached', timeout: 10000 });
                            let epTitre = await page.$eval('#fs-episode-select option:checked', (el) => el.innerText.trim());
                            await page.click('button#fs-quick-download', { force: true });
                            await page.waitForTimeout(10000);
                            let dlLink = await page.$('a#fs-dl-link');
                            let link = dlLink ? await dlLink.getAttribute('href') : "#";
                            if (link && link !== "#") {
                                const seasonMatch = titre.match(/Saison (\d+)/i);
                                const defaultSeason = seasonMatch ? parseInt(seasonMatch[1], 10) : 1;
                                const { season, episodeNumber, canonical } = parseEpisodeLabel(epTitre, defaultSeason);
                                serieData.episodes.push({
                                    episode: canonical,
                                    season,
                                    episodeNumber,
                                    lien: link,
                                });
                            }
                            await page.evaluate(() => {
                                document.querySelector('#fs-donate-overlay')?.remove();
                            });
                            await page.click('button#fs-modal-close');
                            await page.waitForTimeout(2000);
                            let nextBtn = await page.$('button#fs-next-ep');
                            if (!nextBtn || !(await nextBtn.isEnabled()))
                                break;
                            await nextBtn.click();
                            await page.waitForTimeout(5000);
                        }
                    }
                    const saved = await Serie_1.default.findOneAndUpdate({ titre: titre }, { $set: serieData }, { upsert: true, returnDocument: 'after' });
                    console.log(`Série enregistrée dans MongoDB : ${titre}`);
                    if (saved) {
                        for (let epIdx = 0; epIdx < (saved.episodes || []).length; epIdx++) {
                            const ep = saved.episodes[epIdx];
                            if (!ep.lien || ep.lien === "#")
                                continue;
                            const label = `${titre} - ${ep.episode}`;
                            await (0, reupload_1.reuploadEpisode)(saved._id.toString(), ep, epIdx);
                            if (uqload && !ep.uqloadCode) {
                                await uploadEpisodeToUqload(uqload, label, ep.lien, saved._id.toString(), epIdx);
                            }
                        }
                    }
                    await page.goto(url, { waitUntil: 'domcontentloaded' });
                    await page.waitForSelector('.fs-card');
                }
                catch (e) {
                    console.error(`Erreur sur la série :`, e);
                    try {
                        await page.goto(url, { waitUntil: 'domcontentloaded' });
                        await page.waitForSelector('.fs-card');
                    }
                    catch (recoveryErr) {
                        console.error(`Récupération échouée :`, recoveryErr);
                    }
                }
            }
            currentPage++;
            await saveState(currentPage);
        }
        console.log("[ScrapeSeries] Cycle terminé, redémarrage immédiat...");
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
                await new Promise(r => setTimeout(r, 10000));
            }
        }
    })();
}
