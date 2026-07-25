"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeFilms = scrapeFilms;
const playwright_1 = require("playwright");
const mongoose_1 = __importDefault(require("mongoose"));
const Movie_1 = __importDefault(require("../models/Movie"));
const ScraperState_1 = __importDefault(require("../models/ScraperState"));
const browser_1 = require("../config/browser");
const db_1 = require("../config/db");
const reupload_1 = require("../modules/reupload/reupload");
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
async function scrapeFilms() {
    await (0, db_1.connectDB)();
    const browser = await playwright_1.chromium.launch(browser_1.browserConfig);
    const page = await browser.newPage();
    let currentPage = await getLastPage();
    let hasMorePages = true;
    console.log(`Reprise à la page ${currentPage}`);
    while (hasMorePages) {
        const url = `https://www.open-otaku.me/?cat=films&page=${currentPage}`;
        console.log(`\n--- Navigation vers ${url} ---`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        try {
            await page.waitForSelector('.fs-card', { timeout: 30000 });
        }
        catch {
            console.log("Fin de la liste.");
            hasMorePages = false;
            break;
        }
        let cards = await page.$$('.fs-card');
        console.log(`Films trouvés sur la page : ${cards.length}`);
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
                    console.log(`Film déjà traité : ${titre}`);
                    continue;
                }
                console.log(`Traitement du film : ${titre}`);
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
                    console.log(`Film sauvegardé dans MongoDB : ${titre}`);
                    if (saved) {
                        await (0, reupload_1.reuploadMovie)(saved._id.toString(), link, titre);
                    }
                }
                await page.goto(url, { waitUntil: 'domcontentloaded' });
                await page.waitForSelector('.fs-card');
            }
            catch (e) {
                console.error(`Erreur film ${titre}:`, e.message);
                try {
                    await page.goto(url, { waitUntil: 'domcontentloaded' });
                    await page.waitForSelector('.fs-card');
                }
                catch (recoveryErr) {
                    console.error(`Récupération échouée pour ${titre}:`, recoveryErr.message);
                }
            }
        }
        currentPage++;
        await saveLastPage(currentPage);
    }
    await browser.close();
    await mongoose_1.default.disconnect();
    console.log("Scraping films terminé.");
}
if (require.main === module) {
    scrapeFilms().catch(console.error);
}
