import { chromium } from 'playwright';
import mongoose from 'mongoose';
import Serie from '../models/Serie';
import ScraperState from '../models/ScraperState';
import { browserConfig } from '../config/browser';
import { connectDB } from '../config/db';
import { UqloadClient } from '../modules/uqload/uqload.client';

async function uploadEpisodeToUqload(client: UqloadClient | null, label: string, lien: string, serieId: string, episodeIndex: number) {
  if (!client) return;
  try {
    console.log(`    -> Upload Uqload: ${label}`);
    const { fileCode, directLink } = await client.uploadByUrlAndGetLink(lien, label);
    const bestQuality = directLink?.versions?.find((v: any) => v.name === 'n') || directLink?.versions?.[0];
    await Serie.updateOne(
      { _id: serieId },
      { $set: { [`episodes.${episodeIndex}.uqloadCode`]: fileCode, [`episodes.${episodeIndex}.uqloadLink`]: bestQuality?.url || null } }
    );
    console.log(`    -> ✅ Uqload: ${label} → ${fileCode}`);
  } catch (e: any) {
    console.log(`    -> ⏭ Uqload ignoré: ${e.message}`);
  }
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

export async function scrapeSeriesDetails() {
  await connectDB();

  const browser = await chromium.launch(browserConfig);
  const page = await browser.newPage();
  const apiKey = process.env.UQLOAD_API_KEY;
  const uqload = apiKey ? new UqloadClient(apiKey) : null;

  const state = await loadState();
  let currentPage = state.lastPage;
  let hasMorePages = true;

  while (hasMorePages) {
    const url = `https://www.open-otaku.me/?cat=series&page=${currentPage}`;
    console.log(`\n--- Navigation vers ${url} ---`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    try {
      await page.waitForSelector('.fs-card', { timeout: 30000 });
    } catch {
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

        const existingSeries = await Serie.findOne({ titre });
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
          titre,
          pageUrl,
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

        const saved = await Serie.findOneAndUpdate(
          { titre },
          { $set: serieData },
          { upsert: true, returnDocument: 'after' }
        );
        console.log(`Série enregistrée dans MongoDB : ${titre}`);

        if (saved && uqload) {
          for (let epIdx = 0; epIdx < (saved.episodes || []).length; epIdx++) {
            const ep = saved.episodes[epIdx];
            if (ep.lien && ep.lien !== '#' && !ep.uqloadCode) {
              await uploadEpisodeToUqload(uqload, `${titre} - ${ep.episode}`, ep.lien, saved._id.toString(), epIdx);
            }
          }
        }

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
    await saveState(currentPage);
  }
  await browser.close();
  await mongoose.disconnect();
  console.log("Scraping séries terminé.");
}

if (require.main === module) {
  scrapeSeriesDetails().catch(console.error);
}
