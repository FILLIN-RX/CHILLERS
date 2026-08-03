import { chromium } from 'playwright';
import mongoose from 'mongoose';
import Serie from '../models/Serie';
import ScraperState from '../models/ScraperState';
import { browserConfig } from '../config/browser';
import { connectDB } from '../config/db';
import { reuploadEpisode } from '../modules/reupload/reupload';
import { waitForScrapingHours } from '../utils/scraping-hours';
import { installDonateOverlayBlocker } from '../utils/donate-overlay';

function parseEpisodeLabel(label: string, defaultSeason = 1): { season: number; episodeNumber: number; canonical: string } {
    const trimmed = label.trim();
    const sxxExx = trimmed.match(/S(\d+)\s*E\s*(\d+)/i);
    if (sxxExx) {
        const season = parseInt(sxxExx[1], 10);
        const num = parseInt(sxxExx[2], 10);
        return { season, episodeNumber: num, canonical: `S${String(season).padStart(2, "0")}E${String(num).padStart(2, "0")}` };
    }
    const epWord = trimmed.match(/(?:Ép|Ep|Episode)\s*\.?\s*(\d+)/i);
    if (epWord) {
        const num = parseInt(epWord[1], 10);
        return { season: defaultSeason, episodeNumber: num, canonical: `S${String(defaultSeason).padStart(2, "0")}E${String(num).padStart(2, "0")}` };
    }
    return { season: defaultSeason, episodeNumber: 0, canonical: trimmed };
}

async function loadState(): Promise<{ lastPage: number }> {
    try {
        const state = await ScraperState.findOne({ name: 'series' });
        return { lastPage: state?.lastPage || 1 };
    } catch {
        return { lastPage: 1 };
    }
}

async function saveState(lastPage: number) {
    await ScraperState.findOneAndUpdate(
        { name: 'series' },
        { $set: { lastPage, updatedAt: new Date() } },
        { upsert: true }
    );
}

async function scrapeSeriesDetails() {
    console.log('[START] scrapeSeriesDetails() called — connecting to MongoDB...');
    await connectDB();
    console.log('[OK] MongoDB connected, launching Playwright...');

    const browser = await chromium.launch(browserConfig);
    console.log('[OK] Playwright browser launched');
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    await installDonateOverlayBlocker(page);

    let shuttingDown = false;
    process.on('SIGTERM', async () => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log('\n[SIGTERM] Arrêt demandé, fermeture du navigateur...');
        await browser.close().catch(() => {});
        await mongoose.disconnect().catch(() => {});
        process.exit(0);
    });

    while (true) {
    await waitForScrapingHours();
    let currentPage = (await loadState()).lastPage;
    let hasMorePages = true;

    while (hasMorePages && !shuttingDown) {
        const url = `https://www.open-otaku.me/?cat=series&page=${currentPage}`;
        console.log(`\n--- Navigation vers ${url} ---`);

        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

        try {
            await page.waitForSelector('.fs-card', { timeout: 30000 });
        } catch (e) {
            let retries = 0;
            let pageLoaded = false;
            while (retries < 5) {
                retries++;
                console.log(`Page ${currentPage} vide (tentative ${retries}/5) — attend 15s puis réessaie...`);
                await new Promise(r => setTimeout(r, 15000));
                try {
                    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
                    await page.waitForSelector('.fs-card', { timeout: 30000 });
                    pageLoaded = true;
                    break;
                } catch {}
            }
            if (!pageLoaded) {
                console.log(`Page ${currentPage} toujours vide après 5 tentatives — vraie fin, retour page 1`);
                hasMorePages = false;
                await saveState(1);
                break;
            }
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

                let year: number | undefined;
                try {
                    const watchTitle = await page.$eval('#fs-watch-title', (el: any) => el.innerText.trim());
                    const y = watchTitle.match(/(\d{4})$/);
                    if (y) { const p = parseInt(y[1], 10); if (p > 1900 && p < 2100) year = p; }
                } catch {}
                if (!year) {
                    const y = titre.match(/(\d{4})/);
                    if (y) { const p = parseInt(y[1], 10); if (p > 1900 && p < 2100) year = p; }
                }

                let serieData: any = { 
                    titre: titre, 
                    pageUrl: pageUrl, 
                    episodes: existingSeries ? existingSeries.episodes : [] 
                };
                if (year) serieData.year = year;

                if (serieData.episodes.length === 0) {
                    console.log(`  -> Récupération des épisodes pour : ${titre}`);
                    while (true) {
                        await page.waitForSelector('#fs-episode-select', { state: 'attached', timeout: 10000 });
                        let epTitre = await page.$eval('#fs-episode-select option:checked', (el: any) => el.innerText.trim());
                        await page.click('button#fs-quick-download', { force: true });
                        await page.waitForTimeout(10000);
                        let dlLink = await page.$('a#fs-dl-link');
                        let link = dlLink ? await dlLink.getAttribute('href') : "#";

                        if (link && link !== "#") {
                            const seasonMatch = titre.match(/Saison (\d+)/i);
                            const defaultSeason = seasonMatch ? parseInt(seasonMatch[1], 10) : 1;
                            const { season, episodeNumber, canonical } = parseEpisodeLabel(epTitre, defaultSeason);
                            serieData.episodes.push({
                                episode: canonical,
                                season,
                                episodeNumber,
                                lien: link,
                            });
                        }
                        await page.evaluate(() => {
                            document.querySelector('#fs-donate-overlay')?.remove();
                        });
                        await page.click('button#fs-modal-close');
                        await page.waitForTimeout(2000);
                        let nextBtn = await page.$('button#fs-next-ep');
                        if (!nextBtn || !(await nextBtn.isEnabled())) break;
                        await nextBtn.click();
                        await page.waitForTimeout(5000);
                    }
                }

                const saved = await Serie.findOneAndUpdate(
                    { titre: titre },
                    { $set: serieData },
                    { upsert: true, returnDocument: 'after' }
                );
                console.log(`Série enregistrée dans MongoDB : ${titre}`);

                if (saved) {
                    for (let epIdx = 0; epIdx < (saved.episodes || []).length; epIdx++) {
                        const ep = saved.episodes[epIdx];
                        if (!ep.lien || ep.lien === "#") continue;
                        await reuploadEpisode(saved._id.toString(), ep, epIdx);
                    }
                }

                await page.goto(url, { waitUntil: 'networkidle' });
                await page.waitForSelector('.fs-card');
            } catch (e) {
                console.error(`Erreur sur la série :`, e);
                try {
                    await page.goto(url, { waitUntil: 'networkidle' });
                    await page.waitForSelector('.fs-card');
                } catch (recoveryErr) {
                    console.error(`Récupération échouée :`, recoveryErr);
                }
            }
        }
        currentPage++;
        await saveState(currentPage);
    }
    console.log("[ScrapeSeries] Cycle terminé, redémarrage immédiat...");
  }
}

export { scrapeSeriesDetails as scrapeSeries };

// Exécution directe
const isDirectExecution = process.argv[1] && (process.argv[1].includes('scrape-series') || process.argv[1].endsWith('scrape-series.ts') || process.argv[1].endsWith('scrape-series.js'));
if (isDirectExecution) {
  (async () => {
    while (true) {
      try {
        await scrapeSeriesDetails();
      } catch (err: any) {
        console.log(`[ScrapeSeries] Crash: ${err?.message || err} — redémarrage dans 10s...`);
        await new Promise(r => setTimeout(r, 10000));
      }
    }
  })();
}
