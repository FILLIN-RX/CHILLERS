import { chromium } from 'playwright';
import Movie from '../models/Movie';
import ScraperState from '../models/ScraperState';
import { browserConfig } from '../config/browser';
import { connectDB } from '../config/db';
import { reuploadMovie } from '../modules/reupload/reupload';
import { waitForScrapingHours } from '../utils/scraping-hours';
import { installDonateOverlayBlocker } from '../utils/donate-overlay';

const MAX_EMPTY_RETRIES = 5;

async function getLastPage(): Promise<number> {
  try {
    const state = await ScraperState.findOne({ name: 'films' });
    return state ? state.lastPage : 1;
  } catch {
    return 1;
  }
}

async function saveLastPage(page: number) {
  await ScraperState.findOneAndUpdate(
    { name: 'films' },
    { $set: { lastPage: page, updatedAt: new Date() } },
    { upsert: true }
  );
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function scrapeFilms() {
  await connectDB();

  const browser = await chromium.launch(browserConfig);
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  await installDonateOverlayBlocker(page);

  while (true) {
    await waitForScrapingHours();
    let currentPage = await getLastPage();
    let hasMorePages = true;
    console.log(`[ScrapeFilms] Démarrage boucle depuis la page ${currentPage}`);

    while (hasMorePages) {
      const url = `https://www.open-otaku.me/?cat=films&page=${currentPage}`;
      console.log(`\n--- Page ${currentPage} ---`);

      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

      try {
        await page.waitForSelector('.fs-card', { timeout: 30000 });
      } catch {
        let retries = 0;
        let pageLoaded = false;
        while (retries < MAX_EMPTY_RETRIES) {
          retries++;
          console.log(`Page ${currentPage} vide (tentative ${retries}/${MAX_EMPTY_RETRIES}) — attend 15s puis réessaie...`);
          await sleep(15000);
          try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
            await page.waitForSelector('.fs-card', { timeout: 30000 });
            pageLoaded = true;
            break;
          } catch {}
        }
        if (!pageLoaded) {
          console.log(`Page ${currentPage} toujours vide après ${MAX_EMPTY_RETRIES} tentatives — vraie fin, retour page 1`);
          hasMorePages = false;
          await saveLastPage(1);
          break;
        }
      }

      let cards = await page.$$('.fs-card');
      console.log(`Films trouvés : ${cards.length}`);

      for (let i = 0; i < cards.length; i++) {
        let titre = `<film #${i}>`;
        try {
          let currentCards = await page.$$('.fs-card');
          let card = currentCards[i];
          titre = await card.$eval('.fs-card-title', (el: any) => el.innerText.trim());

          if (titre.includes("Saison") || titre.includes("Épisode")) continue;

          const existingFilm = await Movie.findOne({ titre });
          if (existingFilm && existingFilm.pageUrl && existingFilm.lien) {
            console.log(`Déjà traité : ${titre}`);
            continue;
          }

          console.log(`Traitement : ${titre}`);
          await card.click();
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(1000);

          const pageUrl = page.url();

          let year: number | undefined;
          try {
            const yearText = await page.$eval('.fs-meta-tag.accent', (el: any) => el.innerText.trim());
            const parsed = parseInt(yearText, 10);
            if (parsed > 1900 && parsed < 2100) year = parsed;
          } catch {}

          await page.click('button#fs-quick-download', { force: true });
          await page.waitForTimeout(10000);

          let dlLink = await page.$('a#fs-dl-link');
          let link = dlLink ? await dlLink.getAttribute('href') : "#";

          if (link && link !== "#") {
            const updateData: any = { titre, pageUrl, lien: link };
            if (year) updateData.year = year;
            const saved = await Movie.findOneAndUpdate(
              { titre },
              { $set: updateData },
              { upsert: true, returnDocument: 'after' }
            );
            console.log(`Sauvegardé : ${titre}`);
            if (saved) {
              await reuploadMovie(saved._id.toString(), link, titre);
            }
          }

          await page.goto(url, { waitUntil: 'networkidle' });
          await page.waitForSelector('.fs-card');
        } catch (e: any) {
          console.error(`Erreur ${titre}: ${e.message}`);
          try {
            await page.goto(url, { waitUntil: 'networkidle' });
            await page.waitForSelector('.fs-card');
          } catch (recoveryErr: any) {
            console.error(`Récupération échouée: ${recoveryErr.message}`);
          }
        }
      }
      currentPage++;
      await saveLastPage(currentPage);
    }
    console.log("[ScrapeFilms] Cycle terminé, redémarrage immédiat...");
  }
}

// Exécution directe (sans require.main car tsx ne le set pas correctement)
const isDirectExecution = process.argv[1] && (process.argv[1].includes('scrape-films') || process.argv[1].endsWith('scrape-films.ts') || process.argv[1].endsWith('scrape-films.js'));
if (isDirectExecution) {
  scrapeFilms().catch(console.error);
}
