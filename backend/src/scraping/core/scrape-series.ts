import { chromium } from 'playwright';
import mongoose from 'mongoose';
import Serie from '../../models/Serie';
import { browserConfig } from '../config/browser';

async function scrapeSeriesDetails() {
    await connectDB();

    const browser = await chromium.launch(browserConfig);
    const page = await browser.newPage();
    let currentPage = 1; 

    // Simulation de pagination ou navigation via logique existante
    const url = "https://www.open-otaku.me/?cat=series&page=13";
    console.log(`Navigation vers ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    try {
        await page.waitForSelector('.fs-card', { timeout: 20000 });
    } catch (e) {
        console.error("Impossible de charger les cartes de séries.");
        await browser.close();
        return;
    }

    let cards = await page.$$('.fs-card');
    
    for (let i = 0; i < cards.length; i++) {
        try {
            let currentCards = await page.$$('.fs-card');
            let card = currentCards[i];
            let titre = await card.$eval('.fs-card-title', (el: any) => el.innerText.trim());

            // Vérifier MongoDB
            const existingSeries = await Serie.findOne({ titre: titre });
            if (existingSeries && existingSeries.pageUrl && existingSeries.episodes && existingSeries.episodes.length > 0) {
                console.log(`Série déjà traitée et complète : ${titre}`);
                continue;
            }

            console.log(`Traitement de la série : ${titre}`);
            await card.click();
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(1000);
            const pageUrl = page.url();

            let serieData: any = { 
                titre: titre, 
                pageUrl: pageUrl, 
                episodes: existingSeries ? existingSeries.episodes : [] 
            };

            if (serieData.episodes.length === 0) {
                console.log(`  -> Récupération des épisodes pour : ${titre}`);
                while (true) {
                    await page.waitForSelector('#fs-episode-select', { state: 'visible', timeout: 10000 });
                    let epTitre = await page.$eval('#fs-episode-select option:checked', (el: any) => el.innerText.trim());
                    await page.click('button#fs-quick-download', { force: true });
                    await page.waitForTimeout(10000);
                    let dlLink = await page.$('a#fs-dl-link');
                    let link = dlLink ? await dlLink.getAttribute('href') : "#";

                    if (link && link !== "#") {
                        serieData.episodes.push({ episode: epTitre, lien: link });
                    }
                    await page.click('button#fs-modal-close');
                    await page.waitForTimeout(2000);
                    let nextBtn = await page.$('button#fs-next-ep');
                    if (!nextBtn || !(await nextBtn.isEnabled())) break;
                    await nextBtn.click();
                    await page.waitForTimeout(5000);
                }
            }

            // Upsert dans MongoDB
            await Serie.findOneAndUpdate(
                { titre: titre },
                { $set: serieData },
                { upsert: true }
            );
            console.log(`Série enregistrée dans MongoDB : ${titre}`);

            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('.fs-card');
        } catch (e) {
            console.error(`Erreur sur la série :`, e);
        }
    }
    await browser.close();
    await mongoose.disconnect();
}

scrapeSeriesDetails().catch(console.error);
