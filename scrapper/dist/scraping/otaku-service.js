"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchAndNavigateToSeries = searchAndNavigateToSeries;
exports.getSpecificEpisodeLink = getSpecificEpisodeLink;
const playwright_1 = require("playwright");
const browser_1 = require("../config/browser");
const BASE_URL = 'https://www.open-otaku.me';
let browser = null;
async function getBrowser() {
    if (!browser || !browser.isConnected()) {
        browser = await playwright_1.chromium.launch(browser_1.browserConfig);
    }
    return browser;
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
async function getSpecificEpisodeLink(page, episodeNumber) {
    try {
        await page.waitForSelector('#fs-episode-select', { state: 'visible', timeout: 10000 });
        const optionValue = await page.evaluate((epNum) => {
            const select = document.querySelector('#fs-episode-select');
            const option = Array.from(select.options).find(o => o.text.trim().includes('Ép ' + epNum));
            if (option) {
                select.value = option.value;
                select.dispatchEvent(new Event('change'));
                return true;
            }
            return false;
        }, episodeNumber);
        if (!optionValue) {
            console.log(`[Otaku] Épisode "${episodeNumber}" non trouvé dans le dropdown.`);
            return null;
        }
        await page.waitForTimeout(4000);
        const dlBtn = page.locator('button#fs-quick-download, .fs-download-btn, button:has-text("Download")');
        if (await dlBtn.count() > 0) {
            await dlBtn.first().click({ force: true });
            await page.waitForTimeout(8000);
        }
        else {
            console.log("[Otaku] Bouton de téléchargement introuvable.");
            return null;
        }
        const dlLink = page.locator('a#fs-dl-link, a[href*="vidzy"], a[href*="doodstream"]');
        if (await dlLink.count() > 0) {
            const href = await dlLink.first().getAttribute('href');
            if (href && href !== '#')
                return href;
        }
        return null;
    }
    catch (err) {
        console.error(`[Otaku] Erreur lors de l'extraction de l'épisode ${episodeNumber}:`, err);
        return null;
    }
}
