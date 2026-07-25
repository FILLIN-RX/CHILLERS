"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchMissingMedia = fetchMissingMedia;
const otaku_service_1 = require("./otaku-service");
const playwright_1 = require("playwright");
const browser_1 = require("../config/browser");
const Movie_1 = __importDefault(require("../models/Movie"));
const Serie_1 = __importDefault(require("../models/Serie"));
async function fetchMissingMedia(title, type, episodeNum) {
    console.log(`[OnDemand] Recherche de : "${title}" (${type})...`);
    const browser = await playwright_1.chromium.launch(browser_1.browserConfig);
    const page = await browser.newPage();
    const navigated = await (0, otaku_service_1.searchAndNavigateToSeries)(page, title);
    if (!navigated) {
        await browser.close();
        return;
    }
    let result = null;
    if (type === 'series' && episodeNum) {
        const link = await (0, otaku_service_1.getSpecificEpisodeLink)(page, episodeNum);
        if (link) {
            result = { titre: title, episode: `Ép ${episodeNum}`, lien: link };
            await Serie_1.default.findOneAndUpdate({ titre: title }, { $push: { episodes: { episode: `Ép ${episodeNum}`, lien: link } } }, { upsert: true });
        }
    }
    else {
        const dlBtn = page.locator('button#fs-quick-download');
        await dlBtn.click({ force: true });
        await page.waitForTimeout(8000);
        const dlLink = page.locator('a#fs-dl-link');
        const link = await dlLink.getAttribute('href');
        result = { titre: title, lien: link };
        await Movie_1.default.findOneAndUpdate({ titre: title }, { $set: { titre: title, pageUrl: page.url(), lien: link } }, { upsert: true });
    }
    await browser.close();
    return result;
}
