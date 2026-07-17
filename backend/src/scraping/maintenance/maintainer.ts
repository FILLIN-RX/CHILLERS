import fs from 'fs';
import path from 'path';
import { chromium, Page } from 'playwright';
import { browserConfig } from '../../config/browser';
import { isLinkDead } from '../core/link-checker';
import { createBackup } from '../core/backup';
import { sendNotification } from '../core/notifier';
import { getSpecificEpisodeLink, searchAndNavigateToSeries } from '../../modules/otaku/otaku.service';

const SERIES_FILE = path.join(__dirname, '../core/series.json');
const BASE_URL = 'https://www.open-otaku.me';

async function repairSeriesLinks() {
    console.log("[Maintenance] Démarrage de la vérification des liens...");
    
    // 1. Sauvegarde
    createBackup(SERIES_FILE);

    // 2. Chargement des données
    const allSeries = JSON.parse(fs.readFileSync(SERIES_FILE, 'utf-8'));
    let repairedCount = 0;
    let report: string[] = [];

    // Lancer navigateur
    const browser = await chromium.launch(browserConfig);
    const page = await browser.newPage();

    // 3. Vérification
    for (const serie of allSeries) {
        // Si pageUrl manque, on tente une recherche pour le récupérer
        if (!serie.pageUrl) {
            console.log(`[Maintenance] pageUrl manquant pour ${serie.titre}, recherche en cours...`);
            const navigated = await searchAndNavigateToSeries(page, serie.titre);
            if (navigated) {
                serie.pageUrl = page.url();
            } else {
                report.push(`Échec mise à jour pageUrl: ${serie.titre}`);
                continue; // Impossible de réparer sans URL
            }
        } else {
            // Navigation directe
            await page.goto(serie.pageUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
        }

        for (const episode of serie.episodes) {
            if (await isLinkDead(episode.lien)) {
                console.log(`[Maintenance] Lien mort détecté: ${serie.titre} - ${episode.episode}`);
                
                // Extraire le numéro de l'épisode (ex: "Ép 5" -> "5")
                const epNum = episode.episode.replace('Ép ', '').trim();
                
                const newLink = await getSpecificEpisodeLink(page, epNum);
                
                if (newLink) {
                    episode.lien = newLink;
                    repairedCount++;
                    report.push(`Réparé: ${serie.titre} - ${episode.episode}`);
                    console.log(`[Maintenance] Succès: ${newLink}`);
                } else {
                    report.push(`Échec réparation: ${serie.titre} - ${episode.episode}`);
                    console.log(`[Maintenance] Échec.`);
                }
            }
        }
    }

    await browser.close();

    // 5. Sauvegarde et Notification
    if (repairedCount > 0) {
        fs.writeFileSync(SERIES_FILE, JSON.stringify(allSeries, null, 4), 'utf-8');
        await sendNotification(
            "Maintenance Chillers: Liens réparés",
            `Nombre de liens réparés: ${repairedCount}\n\nDétails:\n${report.join('\n')}`
        );
    }
    
    console.log(`[Maintenance] Terminé. ${repairedCount} liens réparés.`);
}

repairSeriesLinks().catch(console.error);
