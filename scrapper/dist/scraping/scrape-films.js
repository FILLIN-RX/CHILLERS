"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeFilms = scrapeFilms;
const playwright_1 = require("playwright");
const Movie_1 = __importDefault(require("../models/Movie"));
const ScraperState_1 = __importDefault(require("../models/ScraperState"));
const browser_1 = require("../config/browser");
const db_1 = require("../config/db");
const reupload_1 = require("../modules/reupload/reupload");
const scraping_hours_1 = require("../utils/scraping-hours");
const donate_overlay_1 = require("../utils/donate-overlay");
const MAX_EMPTY_RETRIES = 5;
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
async function scrapeFilms() {
    await (0, db_1.connectDB)();
    const browser = await playwright_1.chromium.launch(browser_1.browserConfig);
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    await (0, donate_overlay_1.installDonateOverlayBlocker)(page);
    while (true) {
        await (0, scraping_hours_1.waitForScrapingHours)();
        let currentPage = await getLastPage();
        let hasMorePages = true;
        console.log(`[ScrapeFilms] Démarrage boucle depuis la page ${currentPage}`);
        while (hasMorePages) {
            const url = `https://www.open-otaku.me/?cat=films&page=${currentPage}`;
            console.log(`\n--- Page ${currentPage} ---`);
            await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
            try {
                await page.waitForSelector('.fs-card', { timeout: 30000 });
            }
            catch {
                let retries = 0;
                let pageLoaded = false;
                while (retries < MAX_EMPTY_RETRIES) {
                    retries++;
                    console.log(`Page ${currentPage} vide (tentative ${retries}/${MAX_EMPTY_RETRIES}) — attend 15s puis réessaie...`);
                    await sleep(15000);
                    try {
                        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
                        await page.waitForSelector('.fs-card', { timeout: 30000 });
                        pageLoaded = true;
                        break;
                    }
                    catch { }
                }
                if (!pageLoaded) {
                    console.log(`Page ${currentPage} toujours vide après ${MAX_EMPTY_RETRIES} tentatives — vraie fin, retour page 1`);
                    hasMorePages = false;
                    await saveLastPage(1);
                    break;
                }
            }
            let cards = await page.$$('.fs-card');
            console.log(`Films trouvés : ${cards.length}`);
            for (let i = 0; i < cards.length; i++) {
                let titre = `<film #${i}>`;
                try {
                    let currentCards = await page.$$('.fs-card');
                    let card = currentCards[i];
                    titre = await card.$eval('.fs-card-title', (el) => el.innerText.trim());
                    if (titre.includes("Saison") || titre.includes("Épisode"))
                        continue;
                    const existingFilm = await Movie_1.default.findOne({ titre });
                    if (existingFilm && existingFilm.pageUrl && existingFilm.lien) {
                        console.log(`Déjà traité : ${titre}`);
                        continue;
                    }
                    console.log(`Traitement : ${titre}`);
                    await card.click();
                    await page.waitForLoadState('domcontentloaded');
                    await page.waitForTimeout(1000);
                    const pageUrl = page.url();
                    let year;
                    try {
                        const yearText = await page.$eval('.fs-meta-tag.accent', (el) => el.innerText.trim());
                        const parsed = parseInt(yearText, 10);
                        if (parsed > 1900 && parsed < 2100)
                            year = parsed;
                    }
                    catch { }
                    await page.click('button#fs-quick-download', { force: true });
                    await page.waitForTimeout(10000);
                    let dlLink = await page.$('a#fs-dl-link');
                    let link = dlLink ? await dlLink.getAttribute('href') : "#";
                    if (link && link !== "#") {
                        const updateData = { titre, pageUrl, lien: link };
                        if (year)
                            updateData.year = year;
                        const saved = await Movie_1.default.findOneAndUpdate({ titre }, { $set: updateData }, { upsert: true, returnDocument: 'after' });
                        console.log(`Sauvegardé : ${titre}`);
                        if (saved) {
                            await (0, reupload_1.reuploadMovie)(saved._id.toString(), link, titre);
                        }
                    }
                    await page.goto(url, { waitUntil: 'networkidle' });
                    await page.waitForSelector('.fs-card');
                }
                catch (e) {
                    console.error(`Erreur ${titre}: ${e.message}`);
                    try {
                        await page.goto(url, { waitUntil: 'networkidle' });
                        await page.waitForSelector('.fs-card');
                    }
                    catch (recoveryErr) {
                        console.error(`Récupération échouée: ${recoveryErr.message}`);
                    }
                }
            }
            currentPage++;
            await saveLastPage(currentPage);
        }
        console.log("[ScrapeFilms] Cycle terminé, redémarrage immédiat...");
    }
}
// Exécution directe (sans require.main car tsx ne le set pas correctement)
const isDirectExecution = process.argv[1] && (process.argv[1].includes('scrape-films') || process.argv[1].endsWith('scrape-films.ts') || process.argv[1].endsWith('scrape-films.js'));
if (isDirectExecution) {
    scrapeFilms().catch(console.error);
}
