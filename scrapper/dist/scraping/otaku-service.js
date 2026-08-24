"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchOtaku = searchOtaku;
exports.searchAndNavigateToSeries = searchAndNavigateToSeries;
exports.getSpecificEpisodeLink = getSpecificEpisodeLink;
exports.searchAndCache = searchAndCache;
const playwright_1 = require("playwright");
const browser_1 = require("../config/browser");
const Movie_1 = __importDefault(require("../models/Movie"));
const Serie_1 = __importDefault(require("../models/Serie"));
const BASE_URL = 'https://www.open-otaku.me';
let browser = null;
let scrapeInProgress = false;
async function getBrowser() {
    if (!browser || !browser.isConnected()) {
        browser = await playwright_1.chromium.launch(browser_1.browserConfig);
    }
    return browser;
}
function normalize(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
}
async function searchOtaku(title, type = 'movie') {
    const b = await getBrowser();
    const page = await b.newPage();
    await (0, browser_1.setupFastPage)(page);
    try {
        const searchUrl = type === 'series'
            ? `${BASE_URL}/?cat=series`
            : `${BASE_URL}/`;
        console.log(`[Otaku] Searching "${title}" on ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1000);
        const searchBtn = page.locator('#fs-search-icon-btn');
        if (await searchBtn.count() > 0) {
            await searchBtn.click();
            await page.waitForTimeout(500);
        }
        const searchInput = page.locator('input[type="search"], input[type="text"], #fs-search-input, .fs-search-input');
        if (await searchInput.count() > 0) {
            await searchInput.first().fill(title);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1500);
        }
        else {
            await page.goto(`${BASE_URL}/?s=${encodeURIComponent(title)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(1500);
        }
        const cards = await page.locator('.fs-card').all();
        if (cards.length === 0) {
            console.log(`[Otaku] No results for "${title}"`);
            return null;
        }
        let bestCard = cards[0];
        let bestScore = 0;
        const searchNorm = normalize(title);
        for (const card of cards) {
            const cardTitle = await card.locator('.fs-card-title').innerText().catch(() => '');
            const cardNorm = normalize(cardTitle);
            if (cardNorm === searchNorm || cardNorm.includes(searchNorm) || searchNorm.includes(cardNorm)) {
                bestCard = card;
                bestScore = 1;
                break;
            }
            if (cardNorm.slice(0, 10) === searchNorm.slice(0, 10)) {
                bestCard = card;
                bestScore = 0.5;
            }
        }
        if (bestScore === 0) {
            console.log(`[Otaku] No close match for "${title}", using first result`);
        }
        await page.evaluate(() => {
            document.querySelector('#fs-donate-overlay')?.remove();
        }).catch(() => { });
        await bestCard.click({ force: true });
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
        const detailTitle = await page.locator('.fs-card-title, h1, h2').first().innerText().catch(() => title);
        if (type === 'series') {
            const link = await extractEpisodeDownload(page);
            if (link) {
                return { titre: detailTitle, lien: link, source: 'otaku' };
            }
        }
        else {
            const link = await extractMovieDownload(page);
            if (link) {
                return { titre: detailTitle, lien: link, source: 'otaku' };
            }
        }
        console.log(`[Otaku] No download link found for "${title}"`);
        return null;
    }
    catch (err) {
        console.error(`[Otaku] Error searching "${title}":`, err.message);
        return null;
    }
    finally {
        await page.close();
    }
}
async function extractMovieDownload(page) {
    try {
        const dlBtn = page.locator('button#fs-quick-download, .fs-download-btn, button:has-text("Download")');
        if (await dlBtn.count() > 0) {
            await dlBtn.first().click({ force: true });
            const dlLink = await page.waitForSelector('a#fs-dl-link[href]:not([href="#"]):not([href=""]), a[href*="vidzy"], a[href*="doodstream"], a[href*=".mp4"]', { state: 'attached', timeout: 10000 }).catch(() => null);
            if (dlLink) {
                const href = await dlLink.getAttribute('href');
                if (href && href !== '#')
                    return href;
            }
        }
        const allLinks = await page.locator('a[href]').all();
        for (const link of allLinks) {
            const href = await link.getAttribute('href');
            if (href && (href.includes('.mp4') || href.includes('vidzy') || href.includes('doodstream'))) {
                return href;
            }
        }
        return null;
    }
    catch {
        return null;
    }
}
async function extractEpisodeDownload(page) {
    try {
        const dlBtn = page.locator('button#fs-quick-download, .fs-download-btn');
        if (await dlBtn.count() > 0) {
            await dlBtn.first().click({ force: true });
            const dlLink = await page.waitForSelector('a#fs-dl-link[href]:not([href="#"]):not([href=""]), a[href*="vidzy"], a[href*="doodstream"], a[href*=".mp4"]', { state: 'attached', timeout: 10000 }).catch(() => null);
            if (dlLink) {
                const href = await dlLink.getAttribute('href');
                if (href && href !== '#')
                    return href;
            }
        }
        return null;
    }
    catch {
        return null;
    }
}
async function searchAndNavigateToSeries(page, title) {
    try {
        console.log(`[Otaku] Navigating to series: "${title}" via UI search`);
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        const searchBtn = page.locator('#fs-search-icon-btn');
        if (await searchBtn.count() > 0) {
            await searchBtn.click();
            await page.waitForTimeout(1000);
        }
        const searchInput = page.locator('input[type="search"], input[type="text"], #fs-search-input, .fs-search-input');
        if (await searchInput.count() > 0) {
            await searchInput.first().fill(title);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(4000);
        }
        else {
            console.log("[Otaku] Search input not found");
            return false;
        }
        const cards = await page.locator('.fs-card').all();
        if (cards.length === 0) {
            console.log(`[Otaku] No results for "${title}"`);
            return false;
        }
        let targetCard = cards[0];
        for (const card of cards) {
            const cardTitle = await card.locator('.fs-card-title').innerText().catch(() => '');
            if (cardTitle.toLowerCase().includes(title.toLowerCase())) {
                targetCard = card;
                break;
            }
        }
        await targetCard.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);
        return true;
    }
    catch (err) {
        console.error(`[Otaku] Error navigating to "${title}":`, err);
        return false;
    }
}
async function getSpecificEpisodeLink(page, episodeNumber, previousLink) {
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await page.waitForFunction(() => {
                const s = document.querySelector('#fs-episode-select');
                return s && s.options && s.options.length > 0;
            }, { timeout: 15000 });
            const optionFound = await page.evaluate((epNum) => {
                const select = document.querySelector('#fs-episode-select');
                const option = Array.from(select.options).find(o => o.text.trim().includes('Ép ' + epNum));
                if (option) {
                    select.value = option.value;
                    select.dispatchEvent(new Event('change'));
                    return true;
                }
                return false;
            }, episodeNumber);
            if (!optionFound) {
                const texts = await page.evaluate(() => {
                    const s = document.querySelector('#fs-episode-select');
                    return s ? Array.from(s.options, o => o.text) : [];
                });
                console.log(`[Otaku] Épisode "${episodeNumber}" non trouvé. Options: ${JSON.stringify(texts)}`);
                return null;
            }
            await page.waitForTimeout(3000);
            const dlBtn = page.locator('button#fs-quick-download, .fs-download-btn, button:has-text("Download")');
            if (await dlBtn.count() > 0) {
                await dlBtn.first().click({ force: true });
            }
            else {
                console.log("[Otaku] Bouton de téléchargement introuvable.");
                if (attempt < maxRetries) {
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    await page.waitForTimeout(2000);
                    continue;
                }
                return null;
            }
            try {
                await page.waitForFunction((prevLink) => {
                    const a = document.querySelector('a#fs-dl-link, a[href*="vidzy"], a[href*="doodstream"]');
                    if (!a)
                        return false;
                    const href = a.getAttribute('href');
                    return href !== null && href !== '#' && href.length > 10 && href !== prevLink;
                }, previousLink ?? null, { timeout: 30000 });
            }
            catch {
                console.log(`[Otaku] Timeout en attente du lien pour épisode ${episodeNumber}`);
                if (attempt < maxRetries) {
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    await page.waitForTimeout(2000);
                    continue;
                }
                return null;
            }
            const dlLink = page.locator('a#fs-dl-link, a[href*="vidzy"], a[href*="doodstream"]');
            if (await dlLink.count() > 0) {
                const href = await dlLink.first().getAttribute('href');
                if (href && href !== '#')
                    return href;
            }
            if (attempt < maxRetries) {
                await page.reload({ waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(2000);
            }
        }
        catch (err) {
            console.error(`[Otaku] Erreur (tentative ${attempt}) pour épisode ${episodeNumber}:`, err);
            if (attempt < maxRetries) {
                await page.reload({ waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(2000);
                continue;
            }
        }
    }
    return null;
}
async function searchAndCache(title, type = 'movie') {
    if (scrapeInProgress) {
        console.log(`[Otaku] Scrape already in progress, skipping "${title}"`);
        return null;
    }
    scrapeInProgress = true;
    try {
        const result = await searchOtaku(title, type);
        if (result) {
            if (type === 'series') {
                const existing = await Serie_1.default.findOne({ titre: result.titre });
                if (!existing) {
                    await Serie_1.default.create({
                        titre: result.titre,
                        pageUrl: '',
                        episodes: [{ episode: 'Ép 1', lien: result.lien }]
                    });
                    console.log(`[Otaku] Cached Series: ${result.titre}`);
                }
            }
            else {
                const existing = await Movie_1.default.findOne({ titre: result.titre });
                if (!existing) {
                    await Movie_1.default.create({
                        titre: result.titre,
                        pageUrl: '',
                        lien: result.lien
                    });
                    console.log(`[Otaku] Cached Movie: ${result.titre}`);
                }
            }
        }
        return result;
    }
    finally {
        scrapeInProgress = false;
    }
}
