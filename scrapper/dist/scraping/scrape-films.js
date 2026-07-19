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
const uqload_client_1 = require("../modules/uqload/uqload.client");
async function uploadToUqload(client, titre, lien, movieId) {
    if (!client)
        return;
    try {
        console.log(`  -> Upload Uqload: ${titre}`);
        const fileCode = await client.uploadByUrl(lien, titre);
        await new Promise(r => setTimeout(r, 2000));
        const dlResult = await client.getDirectLink(fileCode);
        const bestQuality = dlResult.result.versions.find((v) => v.name === 'n') || dlResult.result.versions[0];
        await Movie_1.default.updateOne({ _id: movieId }, {
            $set: {
                uqloadCode: fileCode,
                uqloadLink: bestQuality?.url || null,
                uqloadQualities: dlResult.result.versions,
                uqloadHls: dlResult.result.hls_direct || null,
            }
        });
        console.log(`  -> ✅ Uqload: ${titre} → ${fileCode}`);
    }
    catch (e) {
        console.log(`  -> ⏭ Uqload ignoré pour ${titre}: ${e.message}`);
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
async function scrapeFilms() {
    await (0, db_1.connectDB)();
    const browser = await playwright_1.chromium.launch(browser_1.browserConfig);
    const page = await browser.newPage();
    const apiKey = process.env.UQLOAD_API_KEY;
    const uqload = apiKey ? new uqload_client_1.UqloadClient(apiKey) : null;
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
                await page.click('button#fs-quick-download', { force: true });
                await page.waitForTimeout(10000);
                let dlLink = await page.$('a#fs-dl-link');
                let link = dlLink ? await dlLink.getAttribute('href') : "#";
                if (link && link !== "#") {
                    await Movie_1.default.findOneAndUpdate({ titre }, { $set: { titre, pageUrl, lien: link } }, { upsert: true });
                    console.log(`Film sauvegardé dans MongoDB : ${titre}`);
                    const movie = await Movie_1.default.findOne({ titre }).lean();
                    if (movie) {
                        await uploadToUqload(uqload, titre, link, movie._id.toString());
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
