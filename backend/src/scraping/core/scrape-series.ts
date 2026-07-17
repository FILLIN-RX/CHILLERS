import { chromium } from 'playwright';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import Serie from '../../models/Serie';
import { browserConfig } from '../../config/browser';
import { connectDB } from '../../config/db';

const STATE_FILE = path.join(__dirname, 'state-series.json');

function loadState() {
    try {
        const data = fs.readFileSync(STATE_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return { lastPage: 1 };
    }
}

function saveState(lastPage: number) {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ lastPage }, null, 4));
}

async function scrapeSeriesDetails() {
    await connectDB();

    const browser = await chromium.launch(browserConfig);
    const page = await browser.newPage();

    const state = loadState();
    let currentPage = state.lastPage;
    let hasMorePages = true;

    while (hasMorePages) {
        const url = `https://www.open-otaku.me/?cat=series&page=${currentPage}`;
        console.log(`\n--- Navigation vers ${url} ---`);

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        try {
            await page.waitForSelector('.fs-card', { timeout: 15000 });
        } catch (e) {
            console.log("Fin de la liste.");
            hasMorePages = false;
            break;
        }

        let cards = await page.$$('.fs-card');
        console.log(`Séries trouvées sur la page : ${cards.length}`);

        for (let i = 0; i < cards.length; i++) {
            try {
                let currentCards = await page.$$('.fs-card');
                let card = currentCards[i];
                let titre = await card.$eval('.fs-card-title', (el: any) => el.innerText.trim());

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
                try {
                    await page.goto(url, { waitUntil: 'domcontentloaded' });
                    await page.waitForSelector('.fs-card');
                } catch (recoveryErr) {
                    console.error(`Récupération échouée :`, recoveryErr);
                }
            }
        }
        currentPage++;
        saveState(currentPage);
    }
    await browser.close();
    await mongoose.disconnect();
    console.log("Scraping terminé.");
}

scrapeSeriesDetails().catch(console.error);
