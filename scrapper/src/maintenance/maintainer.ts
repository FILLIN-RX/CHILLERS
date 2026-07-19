import { chromium } from 'playwright';
import { browserConfig } from '../config/browser';
import { connectDB } from '../config/db';
import { isLinkDead } from '../scraping/link-checker';
import { searchAndNavigateToSeries, getSpecificEpisodeLink } from '../scraping/otaku-service';
import Serie from '../models/Serie';

export async function repairSeriesLinks() {
  await connectDB();

  console.log("[Maintenance] Démarrage de la vérification des liens...");

  const browser = await chromium.launch(browserConfig);
  const page = await browser.newPage();
  let repairedCount = 0;
  let report: string[] = [];

  const allSeries = await Serie.find({}).lean();

  for (const serie of allSeries) {
    let pageUrl = serie.pageUrl;

    if (!pageUrl) {
      console.log(`[Maintenance] pageUrl manquant pour ${serie.titre}, recherche en cours...`);
      const navigated = await searchAndNavigateToSeries(page, serie.titre);
      if (navigated) {
        pageUrl = page.url();
        await Serie.updateOne({ _id: serie._id }, { $set: { pageUrl } });
      } else {
        report.push(`Échec mise à jour pageUrl: ${serie.titre}`);
        continue;
      }
    } else {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    }

    const episodes = serie.episodes || [];
    for (const episode of episodes) {
      if (!episode.lien || episode.lien === '#') {
        console.log(`[Maintenance] Lien mort détecté: ${serie.titre} - ${episode.episode}`);
        const epNum = episode.episode.replace('Ép ', '').trim();
        const newLink = await getSpecificEpisodeLink(page, epNum);

        if (newLink) {
          await Serie.updateOne(
            { _id: serie._id, 'episodes.episode': episode.episode },
            { $set: { 'episodes.$.lien': newLink } }
          );
          repairedCount++;
          report.push(`Réparé: ${serie.titre} - ${episode.episode}`);
          console.log(`[Maintenance] Succès: ${newLink}`);
        } else {
          report.push(`Échec réparation: ${serie.titre} - ${episode.episode}`);
          console.log(`[Maintenance] Échec.`);
        }
      } else {
        const dead = await isLinkDead(episode.lien);
        if (dead) {
          console.log(`[Maintenance] Lien mort détecté: ${serie.titre} - ${episode.episode}`);
          const epNum = episode.episode.replace('Ép ', '').trim();
          const newLink = await getSpecificEpisodeLink(page, epNum);

          if (newLink) {
            await Serie.updateOne(
              { _id: serie._id, 'episodes.episode': episode.episode },
              { $set: { 'episodes.$.lien': newLink } }
            );
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
  }

  await browser.close();
  console.log(`[Maintenance] Terminé. ${repairedCount} liens réparés.`);
}

if (require.main === module) {
  repairSeriesLinks().catch(console.error);
}
