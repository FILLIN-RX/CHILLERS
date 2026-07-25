import { searchAndNavigateToSeries, getSpecificEpisodeLink } from './otaku-service';
import { chromium } from 'playwright';
import { browserConfig } from '../config/browser';
import Movie from '../models/Movie';
import Serie from '../models/Serie';

export async function fetchMissingMedia(title: string, type: 'movie' | 'series', episodeNum?: string) {
  console.log(`[OnDemand] Recherche de : "${title}" (${type})...`);

  const browser = await chromium.launch(browserConfig);
  const page = await browser.newPage();

  const navigated = await searchAndNavigateToSeries(page, title);
  if (!navigated) {
    await browser.close();
    return;
  }

  let result = null;

  if (type === 'series' && episodeNum) {
    const link = await getSpecificEpisodeLink(page, episodeNum);
    if (link) {
      result = { titre: title, episode: `Ép ${episodeNum}`, lien: link };
      await Serie.findOneAndUpdate(
        { titre: title },
        { $push: { episodes: { episode: `Ép ${episodeNum}`, lien: link } } },
        { upsert: true }
      );
    }
  } else {
    const dlBtn = page.locator('button#fs-quick-download');
    await dlBtn.click({ force: true });
    await page.waitForTimeout(8000);
    const dlLink = page.locator('a#fs-dl-link');
    const link = await dlLink.getAttribute('href');
    result = { titre: title, lien: link };

    await Movie.findOneAndUpdate(
      { titre: title },
      { $set: { titre: title, pageUrl: page.url(), lien: link } },
      { upsert: true }
    );
  }

  await browser.close();
  return result;
}
