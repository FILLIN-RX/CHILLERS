/**
 * Synchronise directement le catalogue anime de W16 / French-Manga.
 * OpenOtaku reste utilisé par les anciens outils de lecture et de scraping;
 * l'index anime, lui, est collecté depuis la source W16 qui héberge les fiches.
 * Les catégories se chevauchent : chaque newsId n'est écrit qu'une fois.
 *
 *   npx tsx src/modules/catalog/sync-otaku.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import mongoose from 'mongoose';
import { connectDB } from '../../config/db';
import { mapFsVersion, splitSeasonTitle } from './frenchstream-listing';
import {
  fetchW16ListingPage,
  parseW16AnimeCategoryPaths,
  parseW16AnimeListing,
  W16_BASE_URL,
} from './w16-anime-source';
import {
  CatalogUpsertInput,
  logSyncStats,
  markMissingAfterRun,
  newSyncRun,
  upsertCatalogItems,
} from './catalog-sync.service';

const DELAY_MS = Number(process.env.CATALOG_SYNC_DELAY_MS || 500);
const MAX_PAGES_PER_CATEGORY = Number(process.env.W16_CATALOG_MAX_PAGES || 500);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(pathname: string, page: number): Promise<string | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fetchW16ListingPage(pathname, page);
    } catch (error: any) {
      // W16 répond 404 après la dernière page : c'est une fin normale d'index,
      // pas une interruption réseau qui invalide la synchronisation.
      if (error?.response?.status === 404) return ' ';
      console.warn(`[W16] ${pathname} page=${page} erreur (essai ${attempt}/3): ${error.message}`);
      if (attempt < 3) await sleep(1500 * attempt);
    }
  }
  return null;
}

async function main() {
  await connectDB();

  const stats = newSyncRun('otaku');
  const seen = new Set<string>();
  let traversalComplete = true;
  const homeHtml = await fetchWithRetry('/', 1);
  if (!homeHtml) {
    throw new Error('Impossible de charger la page d’accueil W16 pour découvrir ses catégories.');
  }

  const categories = parseW16AnimeCategoryPaths(homeHtml);
  console.log(`[W16] ${categories.length} index anime à parcourir sur ${W16_BASE_URL}`);

  for (const category of categories) {
    let page = 1;
    let emptyPages = 0;
    let previousPageSignature: string | null = null;
    console.log(`[W16] Catégorie ${category}`);

    while (page <= MAX_PAGES_PER_CATEGORY && emptyPages < 2) {
      const html = await fetchWithRetry(category, page);
      if (!html) {
        traversalComplete = false;
        console.warn(`[W16] Catégorie interrompue; ses fiches absentes ne seront pas désactivées.`);
        break;
      }

      const cards = parseW16AnimeListing(html);
      stats.pagesFetched++;
      if (cards.length === 0) {
        // Une page vide valide marque la fin. On la confirme une seconde fois
        // afin de ne pas confondre un listing temporairement incomplet avec la fin.
        emptyPages++;
        page++;
        await sleep(DELAY_MS);
        continue;
      }
      emptyPages = 0;

      const pageSignature = cards.map((card) => card.sourceId).join('|');
      if (pageSignature === previousPageSignature) {
        console.log(`[W16] ${category} page=${page} répète la page précédente; fin de cet index.`);
        break;
      }
      previousPageSignature = pageSignature;

      const batch: CatalogUpsertInput[] = [];
      for (const card of cards) {
        if (seen.has(card.sourceId)) continue;
        seen.add(card.sourceId);

        const season = splitSeasonTitle(card.title).season;
        batch.push({
          provider: 'otaku',
          sourceId: card.sourceId,
          type: 'anime',
          title: card.title.trim(),
          year: card.year,
          season,
          pageUrl: card.pageUrl,
          posterUrl: card.posterUrl,
          language: mapFsVersion(card.language),
          quality: card.quality,
        });
      }

      await upsertCatalogItems(batch, stats);
      if (page % 25 === 0) {
        console.log(`[W16] page=${page} uniques=${seen.size} créés=${stats.created}`);
      }
      page++;
      await sleep(DELAY_MS);
    }

    if (page > MAX_PAGES_PER_CATEGORY) {
      traversalComplete = false;
      console.warn(`[W16] Limite de ${MAX_PAGES_PER_CATEGORY} pages atteinte pour ${category}.`);
    }
  }

  if (seen.size === 0) {
    traversalComplete = false;
    console.warn('[W16] Aucun anime reçu : le catalogue ne sera pas marqué comme absent.');
  }

  const missing = traversalComplete ? await markMissingAfterRun(stats, 'anime') : 0;
  if (!traversalComplete) {
    console.log('[W16] Parcours incomplet — les fiches non vues restent actives.');
  }
  logSyncStats(stats, missing);
  await mongoose.disconnect();
  console.log('[W16] Synchronisation du catalogue anime terminée.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[FATAL] sync-w16-anime:', error);
    process.exit(1);
  });
}
