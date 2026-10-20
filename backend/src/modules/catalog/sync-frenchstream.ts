/**
 * Sync du catalogue FrenchStream → index Mongo (ProviderCatalogItem).
 *
 * Batch uniquement : lance ce script une fois pour l'inventaire complet
 * (CATALOG_SYNC_MODE=full), puis le cron quotidien en mode update
 * (défaut) qui remonte les nouveautés et marque les items disparus.
 *
 *   npx tsx src/modules/catalog/sync-frenchstream.ts          # update
 *   CATALOG_SYNC_MODE=full npx tsx .../sync-frenchstream.ts   # inventaire complet
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { connectDB } from '../../config/db';
import mongoose from 'mongoose';
import {
  FS_CATEGORIES,
  FSCard,
  fetchFsListingPage,
  splitSeasonTitle,
} from './frenchstream-listing';
import {
  logSyncStats,
  markMissingAfterRun,
  newSyncRun,
  upsertCatalogItem,
} from './catalog-sync.service';

const MODE = process.env.CATALOG_SYNC_MODE === 'full' ? 'full' : 'update';
/** En mode update : stop après N pages d'affilée où tout est déjà connu. */
const EARLY_STOP_PAGES = Number(process.env.CATALOG_SYNC_EARLY_STOP || 5);
const DELAY_MS = Number(process.env.CATALOG_SYNC_DELAY_MS || 700);
const MAX_PAGES = Number(process.env.CATALOG_SYNC_MAX_PAGES || 100000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function syncCategory(category: string, type: 'movie' | 'tv'): Promise<void> {
  const stats = newSyncRun('frenchstream');
  let page = 1;
  let consecutiveSeenPages = 0;

  console.log(`\n[FrenchStream] Sync ${category} (mode=${MODE})`);

  // Le marquage des « absents » ne vaut que pour un parcours ALLANT AU BOUT de
  // l'archive : arrêté en early-stop ou sur erreur HTTP, tous les items plus
  // profonds seraient comptés manquants — et désactivés au 3e run nocturne.
  let archiveEpuisee = false;

  while (page <= MAX_PAGES) {
    // Un incident réseau sur une page ne doit pas avorter les ~2 000 pages qui
    // restent : trois essais, espacés, avant de renoncer sur cette page.
    let cards: FSCard[] | null = null;
    for (let essai = 1; essai <= 3 && cards === null; essai++) {
      try {
        cards = await fetchFsListingPage(page, category);
      } catch (err: any) {
        console.warn(`[FrenchStream] Page ${page} en erreur (essai ${essai}/3) : ${err.message}`);
        cards = null;
        if (essai < 3) await sleep(1500 * essai);
      }
    }
    if (cards === null) {
      console.error(`[FrenchStream] Page ${page} abandonnée après 3 essais — arrêt du parcours.`);
      break;
    }
    stats.pagesFetched = page;

    if (cards.length === 0) {
      console.log(`[FrenchStream] Page ${page} vide — fin de l'archive ${category}.`);
      archiveEpuisee = true;
      break;
    }

    let pageHasNew = false;
    for (const card of cards) {
      let title = card.title;
      let season = card.season;

      if (type === 'tv') {
        // L'archive séries mélange parfois des films (fiches hors saison) :
        // on ne garde que les fiches "… - Saison N".
        const split = splitSeasonTitle(card.title);
        if (split.season === undefined) continue;
        title = split.base;
        season = split.season;
      }

      const before = stats.created;
      await upsertCatalogItem(
        {
          provider: 'frenchstream',
          sourceId: card.sourceId,
          type,
          title,
          year: card.year,
          season,
          pageUrl: card.pageUrl,
          posterUrl: card.posterUrl,
          language: card.language,
          quality: card.quality,
        },
        stats
      );
      if (stats.created > before) pageHasNew = true;
    }

    if (MODE === 'update') {
      consecutiveSeenPages = pageHasNew ? 0 : consecutiveSeenPages + 1;
      if (consecutiveSeenPages >= EARLY_STOP_PAGES) {
        console.log(
          `[FrenchStream] ${EARLY_STOP_PAGES} pages sans nouveauté — arrêt anticipé (page ${page}).`
        );
        break;
      }
    }

    if (page % 50 === 0) {
      console.log(`[FrenchStream] ${category} page ${page} — créés=${stats.created} vus=${stats.seen}`);
    }
    page++;
    await sleep(DELAY_MS);
  }

  const missing = archiveEpuisee ? await markMissingAfterRun(stats) : 0;
  if (!archiveEpuisee) {
    console.log(`[FrenchStream] ${category} : pass interrompu avant la fin de l'archive — absents non comptés.`);
  }
  logSyncStats(stats, missing);
}

async function main() {
  await connectDB();

  await syncCategory(FS_CATEGORIES.films, 'movie');
  await syncCategory(FS_CATEGORIES.series, 'tv');

  await mongoose.disconnect();
  console.log('\n[FrenchStream] Sync terminé.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[FATAL] sync-frenchstream:', err);
    process.exit(1);
  });
}
