"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.repairSeriesLinks = repairSeriesLinks;
const playwright_1 = require("playwright");
const browser_1 = require("../config/browser");
const db_1 = require("../config/db");
const link_checker_1 = require("../scraping/link-checker");
const otaku_service_1 = require("../scraping/otaku-service");
const Serie_1 = __importDefault(require("../models/Serie"));
async function repairSeriesLinks() {
    await (0, db_1.connectDB)();
    console.log("[Maintenance] Démarrage de la vérification des liens...");
    const browser = await playwright_1.chromium.launch(browser_1.browserConfig);
    const page = await browser.newPage();
    let repairedCount = 0;
    let report = [];
    const allSeries = await Serie_1.default.find({}).lean();
    for (const serie of allSeries) {
        let pageUrl = serie.pageUrl;
        if (!pageUrl) {
            console.log(`[Maintenance] pageUrl manquant pour ${serie.titre}, recherche en cours...`);
            const navigated = await (0, otaku_service_1.searchAndNavigateToSeries)(page, serie.titre);
            if (navigated) {
                pageUrl = page.url();
                await Serie_1.default.updateOne({ _id: serie._id }, { $set: { pageUrl } });
            }
            else {
                report.push(`Échec mise à jour pageUrl: ${serie.titre}`);
                continue;
            }
        }
        else {
            await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
        }
        const episodes = serie.episodes || [];
        for (const episode of episodes) {
            if (!episode.lien || episode.lien === '#') {
                console.log(`[Maintenance] Lien mort détecté: ${serie.titre} - ${episode.episode}`);
                const epNum = episode.episode.replace('Ép ', '').trim();
                const newLink = await (0, otaku_service_1.getSpecificEpisodeLink)(page, epNum);
                if (newLink) {
                    await Serie_1.default.updateOne({ _id: serie._id, 'episodes.episode': episode.episode }, { $set: { 'episodes.$.lien': newLink } });
                    repairedCount++;
                    report.push(`Réparé: ${serie.titre} - ${episode.episode}`);
                    console.log(`[Maintenance] Succès: ${newLink}`);
                }
                else {
                    report.push(`Échec réparation: ${serie.titre} - ${episode.episode}`);
                    console.log(`[Maintenance] Échec.`);
                }
            }
            else {
                const dead = await (0, link_checker_1.isLinkDead)(episode.lien);
                if (dead) {
                    console.log(`[Maintenance] Lien mort détecté: ${serie.titre} - ${episode.episode}`);
                    const epNum = episode.episode.replace('Ép ', '').trim();
                    const newLink = await (0, otaku_service_1.getSpecificEpisodeLink)(page, epNum);
                    if (newLink) {
                        await Serie_1.default.updateOne({ _id: serie._id, 'episodes.episode': episode.episode }, { $set: { 'episodes.$.lien': newLink } });
                        repairedCount++;
                        report.push(`Réparé: ${serie.titre} - ${episode.episode}`);
                        console.log(`[Maintenance] Succès: ${newLink}`);
                    }
                    else {
                        report.push(`Échec réparation: ${serie.titre} - ${episode.episode}`);
                        console.log(`[Maintenance] Échec.`);
                    }
                }
            }
        }
    }
    await browser.close();
    console.log(`[Maintenance] Terminé. ${repairedCount} liens réparés.`);
}
if (require.main === module) {
    repairSeriesLinks().catch(console.error);
}
