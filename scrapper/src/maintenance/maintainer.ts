import { chromium } from 'playwright';
import mongoose from 'mongoose';
import { browserConfig } from '../config/browser';
import { isLinkDead } from '../scraping/link-checker';
import { sendNotification } from '../scraping/core/notifier';
import { getSpecificEpisodeLink, searchAndNavigateToSeries } from '../scraping/otaku-service';
import { reuploadEpisode } from '../modules/reupload/reupload';
import { connectDB } from '../config/db';
import Serie, { type IEpisode } from '../models/Serie';

const BASE_URL = 'https://www.open-otaku.me';

function parseEpisodeNumber(label: string | undefined): number | null {
    if (!label) return null;
    const trimmed = label.trim();
    const sxxExx = trimmed.match(/S\d+\s*E\s*(\d+)/i);
    if (sxxExx) return parseInt(sxxExx[1], 10);
    const epWord = trimmed.match(/(?:Ép|Ep|Episode)\s*\.?\s*(\d+)/i);
    if (epWord) return parseInt(epWord[1], 10);
    const bare = trimmed.match(/(\d+)/);
    return bare ? parseInt(bare[1], 10) : null;
}

async function repairSeriesLinks() {
    console.log("[Maintenance] Démarrage de la vérification des liens...");
    await connectDB();

    const allSeries = await Serie.find().lean();
    let repairedCount = 0;
    let report: string[] = [];

    const browser = await chromium.launch(browserConfig);
    const page = await browser.newPage();

    for (const serie of allSeries) {
        if (!serie.pageUrl) {
            console.log(`[Maintenance] pageUrl manquant pour ${serie.titre}, recherche en cours...`);
            const navigated = await searchAndNavigateToSeries(page, serie.titre);
            if (navigated) {
                const newPageUrl = page.url();
                await Serie.updateOne({ _id: serie._id }, { $set: { pageUrl: newPageUrl } });
                serie.pageUrl = newPageUrl;
            } else {
                report.push(`Échec mise à jour pageUrl: ${serie.titre}`);
                continue;
            }
        } else {
            await page.goto(serie.pageUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
        }

        let lastOtakuLink: string | null = null;

        const expectedSeason = (() => {
            const m = serie.titre.match(/Saison (\d+)/i);
            return m ? parseInt(m[1], 10) : null;
        })();
        if (expectedSeason !== null) {
            const seasonUpdates: Record<string, any> = {};
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
                await Serie.updateOne({ _id: serie._id }, { $set: seasonUpdates });
                console.log(`[Maintenance] 🔧 Saison corrigée: ${serie.titre} (${keys.length / 2} épisodes)`);
                report.push(`Saison corrigée: ${serie.titre} (${keys.length / 2} épisodes)`);
            }
        }

        for (const episode of serie.episodes) {
            if (await isLinkDead(episode.lien)) {
                console.log(`[Maintenance] Lien mort détecté: ${serie.titre} - ${episode.episode}`);

                const epNum = parseEpisodeNumber(episode.episode);

                const season =
                    typeof episode.season === "number"
                        ? episode.season
                        : (() => {
                              const m = serie.titre.match(/Saison (\d+)/i);
                              return m ? parseInt(m[1], 10) : 1;
                          })();

                if (epNum === null) {
                    console.log(
                        `[Maintenance] ⚠ Numéro d'épisode introuvable dans "${episode.episode}" pour ${serie.titre}`
                    );
                    continue;
                }

                const newLink = await getSpecificEpisodeLink(page, String(epNum), lastOtakuLink);

                if (newLink) {
                    if (await isLinkDead(newLink)) {
                        console.log(
                            `[Maintenance] ⚠ Otaku a renvoyé un lien encore mort: ${serie.titre} - ${episode.episode} (${newLink.slice(0, 60)}...)`
                        );
                        report.push(
                            `Stale Otaku (lien encore mort): ${serie.titre} - ${episode.episode}`,
                        );
                        continue;
                    }

                    const result = await Serie.updateOne(
                        {
                            _id: serie._id,
                            'episodes.season': season,
                            'episodes.episodeNumber': epNum,
                        },
                        { $set: { 'episodes.$.lien': newLink } }
                    );

                    if (result.matchedCount === 0) {
                        console.log(
                            `[Maintenance] ⚠ Episode introuvable pour maj: ${serie.titre} - S${season}E${String(epNum).padStart(2, '0')}`
                        );
                        report.push(`Match raté (épisode introuvable): ${serie.titre} - ${episode.episode}`);
                    } else {
                        (episode as IEpisode).lien = newLink;
                        lastOtakuLink = newLink;
                        repairedCount++;
                        report.push(`Réparé: ${serie.titre} - ${episode.episode}`);
                        console.log(`[Maintenance] Succès: ${newLink}`);

                        try {
                            const reupload = await reuploadEpisode(
                                String(serie._id),
                                { ...(episode as IEpisode), lien: newLink },
                                allSeries.indexOf(serie),
                            );
                            const uploadedTo: string[] = [];
                            if (reupload.uploadedDoodstream) uploadedTo.push("doodstream");
                            if (reupload.uploadedUqload) uploadedTo.push("uqload");
                            if (uploadedTo.length > 0) {
                                console.log(
                                    `[Maintenance] ↗ Mirror ${uploadedTo.join("+")} OK pour ${serie.titre} ${episode.episode}`
                                );
                                report.push(
                                    `Mirror ${uploadedTo.join("+")}: ${serie.titre} ${episode.episode}`
                                );
                            }
                            if (reupload.errors.length > 0) {
                                report.push(
                                    `Mirror partiel (${reupload.errors.join("; ")}): ${serie.titre} ${episode.episode}`
                                );
                            }
                        } catch (e: any) {
                            console.log(`[Maintenance] Mirror échoué: ${e.message}`);
                            report.push(`Mirror échoué: ${serie.titre} ${episode.episode} (${e.message})`);
                        }
                    }
                } else {
                    report.push(`Échec réparation: ${serie.titre} - ${episode.episode}`);
                    console.log(`[Maintenance] Échec.`);
                }
            }
        }
    }

    await browser.close();

    if (repairedCount > 0) {
        await sendNotification(
            "Maintenance Chillers: Liens réparés",
            `Nombre de liens réparés: ${repairedCount}\n\nDétails:\n${report.join('\n')}`
        );
    }

    console.log(`[Maintenance] Terminé. ${repairedCount} liens réparés.`);
    await mongoose.disconnect();
}

repairSeriesLinks().catch(console.error);
