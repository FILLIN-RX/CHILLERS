import { chromium } from 'playwright';
import mongoose from 'mongoose';
import Movie from '../models/Movie';
import ScraperState from '../models/ScraperState';
import { browserConfig } from '../config/browser';
import { connectDB } from '../config/db';
import { UqloadClient } from '../modules/uqload/uqload.client';

async function uploadToUqload(client: UqloadClient | null, titre: string, lien: string, movieId: string) {
  if (!client) return;
  try {
    console.log(`  -> Upload Uqload: ${titre}`);
    const { fileCode, directLink } = await client.uploadByUrlAndGetLink(lien, titre);
    const bestQuality = directLink?.versions?.find((v: any) => v.name === 'n') || directLink?.versions?.[0];
    await Movie.updateOne(
      { _id: movieId },
      {
        $set: {
          uqloadCode: fileCode,
          uqloadLink: bestQuality?.url || null,
          uqloadQualities: directLink?.versions || [],
          uqloadHls: directLink?.hls_direct || null,
        }
      }
    );
    console.log(`  -> ✅ Uqload: ${titre} → ${fileCode}`);
  } catch (e: any) {
    console.log(`  -> ⏭ Uqload ignoré pour ${titre}: ${e.message}`);
  }
}

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

export async function scrapeFilms() {
  await connectDB();

  const browser = await chromium.launch(browserConfig);
  const page = await browser.newPage();
  const apiKey = process.env.UQLOAD_API_KEY;
  const uqload = apiKey ? new UqloadClient(apiKey) : null;

  let currentPage = await getLastPage();
  let hasMorePages = true;
  console.log(`Reprise à la page ${currentPage}`);

  while (hasMorePages) {
    const url = `https://www.open-otaku.me/?cat=films&page=${currentPage}`;
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
    console.log(`Films trouvés sur la page : ${cards.length}`);

    for (let i = 0; i < cards.length; i++) {
      let titre = `<film #${i}>`;
      try {
        let currentCards = await page.$$('.fs-card');
        let card = currentCards[i];
        titre = await card.$eval('.fs-card-title', (el: any) => el.innerText.trim());

        if (titre.includes("Saison") || titre.includes("Épisode")) continue;

        const existingFilm = await Movie.findOne({ titre });
        if (existingFilm && existingFilm.pageUrl && existingFilm.lien) {
          console.log(`Film déjà traité : ${titre}`);
          continue;
        }

        console.log(`Traitement du film : ${titre}`);
        await card.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        const pageUrl = page.url();

        await page.click('button#fs-quick-download', { force: true });
        await page.waitForTimeout(10000);

        let dlLink = await page.$('a#fs-dl-link');
        let link = dlLink ? await dlLink.getAttribute('href') : "#";

        if (link && link !== "#") {
          await Movie.findOneAndUpdate(
            { titre },
            { $set: { titre, pageUrl, lien: link } },
            { upsert: true }
          );
          console.log(`Film sauvegardé dans MongoDB : ${titre}`);
          const movie = await Movie.findOne({ titre }).lean();
          if (movie) {
            await uploadToUqload(uqload, titre, link, movie._id.toString());
          }
        }

        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.fs-card');
      } catch (e: any) {
        console.error(`Erreur film ${titre}:`, e.message);
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('.fs-card');
        } catch (recoveryErr: any) {
          console.error(`Récupération échouée pour ${titre}:`, recoveryErr.message);
        }
      }
    }
    currentPage++;
    await saveLastPage(currentPage);
  }
  await browser.close();
  await mongoose.disconnect();
  console.log("Scraping films terminé.");
}

if (require.main === module) {
  scrapeFilms().catch(console.error);
}
