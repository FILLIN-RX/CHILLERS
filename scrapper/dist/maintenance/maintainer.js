"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const mongoose_1 = __importDefault(require("mongoose"));
const browser_1 = require("../config/browser");
const link_checker_1 = require("../scraping/link-checker");
const notifier_1 = require("../scraping/core/notifier");
const otaku_service_1 = require("../scraping/otaku-service");
const reupload_1 = require("../modules/reupload/reupload");
const db_1 = require("../config/db");
const Serie_1 = __importDefault(require("../models/Serie"));
const BASE_URL = 'https://www.open-otaku.me';
function parseEpisodeNumber(label) {
    if (!label)
        return null;
    const trimmed = label.trim();
    const sxxExx = trimmed.match(/S\d+\s*E\s*(\d+)/i);
    if (sxxExx)
        return parseInt(sxxExx[1], 10);
    const epWord = trimmed.match(/(?:Ép|Ep|Episode)\s*\.?\s*(\d+)/i);
    if (epWord)
        return parseInt(epWord[1], 10);
    const bare = trimmed.match(/(\d+)/);
    return bare ? parseInt(bare[1], 10) : null;
}
async function repairSeriesLinks() {
    console.log("[Maintenance] Démarrage de la vérification des liens...");
    await (0, db_1.connectDB)();
    const allSeries = await Serie_1.default.find().lean();
    let repairedCount = 0;
    let report = [];
    const browser = await playwright_1.chromium.launch(browser_1.browserConfig);
    const page = await browser.newPage();
    for (const serie of allSeries) {
        if (!serie.pageUrl) {
            console.log(`[Maintenance] pageUrl manquant pour ${serie.titre}, recherche en cours...`);
            const navigated = await (0, otaku_service_1.searchAndNavigateToSeries)(page, serie.titre);
            if (navigated) {
                const newPageUrl = page.url();
                await Serie_1.default.updateOne({ _id: serie._id }, { $set: { pageUrl: newPageUrl } });
                serie.pageUrl = newPageUrl;
            }
            else {
                report.push(`Échec mise à jour pageUrl: ${serie.titre}`);
                continue;
            }
        }
        else {
            await page.goto(serie.pageUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
        }
        let lastOtakuLink = null;
        const expectedSeason = (() => {
            const m = serie.titre.match(/Saison (\d+)/i);
            return m ? parseInt(m[1], 10) : null;
        })();
        if (expectedSeason !== null) {
            const seasonUpdates = {};
            for (let i = 0; i < serie.episodes.length; i++) {
                const ep = serie.episodes[i];
                if (ep.season !== expectedSeason) {
                    const epNum = ep.episodeNumber || (i + 1);
                    const canon = `S${String(expectedSeason).padStart(2, "0")}E${String(epNum).padStart(2, "0")}`;
                    seasonUpdates[`episodes.${i}.season`] = expectedSeason;
                    seasonUpdates[`episodes.${i}.episode`] = canon;
                    ep.season = expectedSeason;
                    ep.episode = canon;
                }
            }
            const keys = Object.keys(seasonUpdates);
            if (keys.length > 0) {
                await Serie_1.default.updateOne({ _id: serie._id }, { $set: seasonUpdates });
                console.log(`[Maintenance] 🔧 Saison corrigée: ${serie.titre} (${keys.length / 2} épisodes)`);
                report.push(`Saison corrigée: ${serie.titre} (${keys.length / 2} épisodes)`);
            }
        }
        for (const episode of serie.episodes) {
            if (await (0, link_checker_1.isLinkDead)(episode.lien)) {
                console.log(`[Maintenance] Lien mort détecté: ${serie.titre} - ${episode.episode}`);
                const epNum = parseEpisodeNumber(episode.episode);
                const season = typeof episode.season === "number"
                    ? episode.season
                    : (() => {
                        const m = serie.titre.match(/Saison (\d+)/i);
                        return m ? parseInt(m[1], 10) : 1;
                    })();
                if (epNum === null) {
                    console.log(`[Maintenance] ⚠ Numéro d'épisode introuvable dans "${episode.episode}" pour ${serie.titre}`);
                    continue;
                }
                const newLink = await (0, otaku_service_1.getSpecificEpisodeLink)(page, String(epNum), lastOtakuLink);
                if (newLink) {
                    if (await (0, link_checker_1.isLinkDead)(newLink)) {
                        console.log(`[Maintenance] ⚠ Otaku a renvoyé un lien encore mort: ${serie.titre} - ${episode.episode} (${newLink.slice(0, 60)}...)`);
                        report.push(`Stale Otaku (lien encore mort): ${serie.titre} - ${episode.episode}`);
                        continue;
                    }
                    const result = await Serie_1.default.updateOne({
                        _id: serie._id,
                        'episodes.season': season,
                        'episodes.episodeNumber': epNum,
                    }, { $set: { 'episodes.$.lien': newLink } });
                    if (result.matchedCount === 0) {
                        console.log(`[Maintenance] ⚠ Episode introuvable pour maj: ${serie.titre} - S${season}E${String(epNum).padStart(2, '0')}`);
                        report.push(`Match raté (épisode introuvable): ${serie.titre} - ${episode.episode}`);
                    }
                    else {
                        episode.lien = newLink;
                        lastOtakuLink = newLink;
                        repairedCount++;
                        report.push(`Réparé: ${serie.titre} - ${episode.episode}`);
                        console.log(`[Maintenance] Succès: ${newLink}`);
                        try {
                            const reupload = await (0, reupload_1.reuploadEpisode)(String(serie._id), { ...episode, lien: newLink }, allSeries.indexOf(serie));
                            const uploadedTo = [];
                            if (reupload.uploadedDoodstream)
                                uploadedTo.push("doodstream");
                            if (reupload.uploadedUqload)
                                uploadedTo.push("uqload");
                            if (uploadedTo.length > 0) {
                                console.log(`[Maintenance] ↗ Mirror ${uploadedTo.join("+")} OK pour ${serie.titre} ${episode.episode}`);
                                report.push(`Mirror ${uploadedTo.join("+")}: ${serie.titre} ${episode.episode}`);
                            }
                            if (reupload.errors.length > 0) {
                                report.push(`Mirror partiel (${reupload.errors.join("; ")}): ${serie.titre} ${episode.episode}`);
                            }
                        }
                        catch (e) {
                            console.log(`[Maintenance] Mirror échoué: ${e.message}`);
                            report.push(`Mirror échoué: ${serie.titre} ${episode.episode} (${e.message})`);
                        }
                    }
                }
                else {
                    report.push(`Échec réparation: ${serie.titre} - ${episode.episode}`);
                    console.log(`[Maintenance] Échec.`);
                }
            }
        }
    }
    await browser.close();
    if (repairedCount > 0) {
        await (0, notifier_1.sendNotification)("Maintenance Chillers: Liens réparés", `Nombre de liens réparés: ${repairedCount}\n\nDétails:\n${report.join('\n')}`);
    }
    console.log(`[Maintenance] Terminé. ${repairedCount} liens réparés.`);
    await mongoose_1.default.disconnect();
}
repairSeriesLinks().catch(console.error);
