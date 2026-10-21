/**
 * Découvre les séries AfroLandTV via son endpoint de recherche officiel et les
 * place dans le même index TMDB que les autres fournisseurs.
 *
 * Le listing sans filtre renvoie `total_results`; `start` permet de parcourir
 * toutes les pages. Le balayage textuel reste un repli si l'API ne fournit plus
 * ce listing. Les fiches absentes ne sont jamais désactivées par ce script.
 *
 *   npx tsx src/modules/catalog/sync-afroland.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import mongoose from 'mongoose';
import { connectDB } from '../../config/db';
import { discoverAfrolandFeaturePage, discoverAfrolandShowPage } from '../afroland/afroland.service';
import { CatalogUpsertInput, logSyncStats, newSyncRun, upsertCatalogItems } from './catalog-sync.service';

const DELAY_MS = Number(process.env.AFROLAND_CATALOG_DELAY_MS || 250);
// L'API AfroLand plafonne ses réponses à 12 objets malgré max_results.
const PAGE_SIZE = Number(process.env.AFROLAND_CATALOG_PAGE_SIZE || 12);
const MAX_PAGES_PER_QUERY = Number(process.env.AFROLAND_CATALOG_MAX_PAGES || 200);
const SEARCH_TERMS = [
  '', // L'API peut renvoyer le listing complet sans filtre.
  ...'abcdefghijklmnopqrstuvwxyz0123456789',
  'the', 'and', 'love', 'family', 'life', 'city', 'house', 'girl', 'world', 'show',
];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function withRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (attempt === 4) break;
      console.warn(`[AfroLandTV] ${label} échec ${attempt}/4: ${error?.message || String(error)}; nouvel essai`);
      await sleep(DELAY_MS * attempt * 2);
    }
  }
  throw lastError;
}

async function main() {
  await connectDB();
  const stats = newSyncRun('afroland');
  const seen = new Set<string>();
  let successfulQueries = 0;
  let failedQueries = 0;
  let unpagedQueries = 0;
  let fullListingComplete = false;
  let rootListingHasTotal = false;

  for (const term of SEARCH_TERMS) {
    if (term && (fullListingComplete || rootListingHasTotal)) break;
    let startIndex = 0;
    let pageCount = 0;
    let querySeen = 0;
    let totalCount: number | undefined;
    const queryPageIds = new Set<string>();

    while (pageCount < MAX_PAGES_PER_QUERY) {
      try {
        const page = await withRetry(`catalogue séries start=${startIndex}`, () =>
          discoverAfrolandShowPage(term, { startIndex })
        );
        successfulQueries++;
        pageCount++;
        stats.pagesFetched++;
        totalCount = page.totalCount ?? totalCount;
        if (term === '' && totalCount !== undefined) rootListingHasTotal = true;
        const batch: CatalogUpsertInput[] = [];
        let newQueryIds = 0;

        for (const show of page.shows) {
          if (!show.id || !show.name.trim()) continue;
          querySeen++;
          if (!queryPageIds.has(show.id)) {
            queryPageIds.add(show.id);
            newQueryIds++;
          }
          if (seen.has(show.id)) continue;
          seen.add(show.id);
          batch.push({
            provider: 'afroland',
            sourceId: show.id,
            type: 'tv',
            title: show.name.trim(),
            year: show.year,
            description: show.description,
            pageUrl: show.pageUrl || 'https://www.afrolandtv.com/browse',
            posterUrl: show.posterUrl,
            language: 'EN',
            country: show.country,
          });
        }
        await upsertCatalogItems(batch, stats);

        // Fin de pagination annoncée par l'API ou page terminale. Le garde-fou
        // sur les doublons évite une boucle si la pagination est ignorée.
        if (totalCount !== undefined && startIndex + page.shows.length >= totalCount) break;
        if (page.shows.length < PAGE_SIZE || newQueryIds === 0) {
          if (term === '' && page.shows.length > 0) unpagedQueries++;
          break;
        }
        startIndex += page.shows.length;
        await sleep(DELAY_MS);
      } catch (error: any) {
        failedQueries++;
        console.warn(`[AfroLandTV] query="${term || '(catalogue complet)'}" page=${pageCount + 1} en échec: ${error?.message || String(error)}`);
        break;
      }
    }

    if (pageCount >= MAX_PAGES_PER_QUERY) {
      console.warn(`[AfroLandTV] limite de pagination atteinte pour query="${term || '(catalogue complet)'}"`);
    }
    if (term === '') {
      console.log(`[AfroLandTV] listing sans filtre: reçus=${querySeen}, total annoncé=${totalCount ?? 'inconnu'}, uniques importés=${seen.size}`);
      fullListingComplete = totalCount !== undefined && queryPageIds.size >= totalCount;
    } else if (querySeen) {
      console.log(`[AfroLandTV] query="${term}" reçus=${querySeen} uniques=${seen.size}`);
    }
    await sleep(DELAY_MS);
  }

  // AfroLand also has a separate feature-video catalog. Keep only the
  // provider's explicit `feature` type; trailers and episodic videos stay out.
  const featureIds = new Set<string>();
  let featureStart = 0;
  let featureTotal: number | undefined;
  let featurePages = 0;
  while (featurePages < MAX_PAGES_PER_QUERY) {
    try {
      const page = await withRetry(`catalogue films start=${featureStart}`, () =>
        discoverAfrolandFeaturePage({ startIndex: featureStart })
      );
      featurePages++;
      stats.pagesFetched++;
      featureTotal = page.totalCount ?? featureTotal;
      const batch: CatalogUpsertInput[] = [];
      let newPageIds = 0;
      for (const film of page.shows) {
        if (!film.id || !film.name.trim() || film.videoType !== 'feature') continue;
        if (featureIds.has(film.id)) continue;
        featureIds.add(film.id);
        newPageIds++;
        batch.push({
          provider: 'afroland',
          sourceId: film.id,
          type: 'movie',
          title: film.name.trim(),
          year: film.year,
          description: film.description,
          pageUrl: film.pageUrl || 'https://www.afrolandtv.com/browse',
          posterUrl: film.posterUrl,
          language: 'EN',
          country: film.country,
        });
      }
      await upsertCatalogItems(batch, stats);
      if (featureTotal !== undefined && featureStart + page.shows.length >= featureTotal) break;
      if (page.shows.length < PAGE_SIZE || newPageIds === 0) break;
      featureStart += page.shows.length;
      await sleep(DELAY_MS);
    } catch (error: any) {
      failedQueries++;
      console.warn(`[AfroLandTV] listing films page=${featurePages + 1} en échec: ${error?.message || String(error)}`);
      break;
    }
  }
  console.log(`[AfroLandTV] films: ${featureIds.size} distincts, total annoncé=${featureTotal ?? 'inconnu'}`);

  if (successfulQueries === 0) {
    throw new Error(`Aucune requête AfroLandTV n’a abouti (${failedQueries} échecs).`);
  }

  logSyncStats(stats, 0);
  await mongoose.disconnect();
  console.log(`[AfroLandTV] découverte terminée; ${seen.size} séries distinctes récupérées, requêtes en échec=${failedQueries}.`);
  if (unpagedQueries > 0) {
    console.warn('[AfroLandTV] l’API n’a pas exposé de pagination exhaustive pour le listing sans filtre; le balayage des termes complète la découverte mais ne garantit pas les fiches sans correspondance textuelle.');
  }
}

main().catch(async (error) => {
  console.error('[FATAL] sync-afroland:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
