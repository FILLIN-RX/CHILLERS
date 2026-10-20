/**
 * Sync du catalogue animes OpenOtaku → index Mongo (ProviderCatalogItem).
 *
 * Note : les films/séries d'OpenOtaku sont un miroir du catalogue FrenchStream
 * (mêmes newsids, servis via leur API /api/fs-home) — ils sont couverts par
 * sync-frenchstream.ts. Ce script ne récupère que le contenu UNIQUE d'Otaku :
 * les animes (w16.french-manga.net), via /api/anime-categories puis
 * /api/anime-category?path=…&page=… jusqu'à page vide.
 *
 *   npx tsx src/modules/catalog/sync-otaku.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import axios from 'axios';
import mongoose from 'mongoose';
import { connectDB } from '../../config/db';
import { mapFsVersion } from './frenchstream-listing';
import {
  logSyncStats,
  markMissingAfterRun,
  newSyncRun,
  upsertCatalogItem,
} from './catalog-sync.service';

const OO_BASE = 'https://www.open-otaku.me';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DELAY_MS = Number(process.env.CATALOG_SYNC_DELAY_MS || 700);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface OOAnimeItem {
  newsId: string;
  title: string;
  poster?: string;
  version?: string;
  episodes?: string;
  type?: string;
  url?: string;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  // Trois essais : une page perdue ferme une catégorie entière (deux pages
  // vides d'affilée = fin de catégorie), donc une absence de réseau.
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT, Referer: `${OO_BASE}/` },
        timeout: 20000,
      });
      return data as T;
    } catch (err: any) {
      console.warn(`[Otaku] ${url} en erreur (essai ${essai}/3) : ${err.message}`);
      if (essai < 3) await sleep(1500 * essai);
    }
  }
  return null;
}

async function main() {
  await connectDB();

  const stats = newSyncRun('otaku');
  const seenThisRun = new Set<string>();
  // Comme pour FrenchStream : les absences ne sont comptées que si le parcours
  // a couvert tout le site (une catégorie en erreur = passage incomplet).
  let parcoursComplet = true;

  const catsRes = await fetchJson<{ categories: { text: string; href: string }[] }>(
    `${OO_BASE}/api/anime-categories`
  );
  if (!catsRes) parcoursComplet = false;
  const categories = catsRes?.categories || [];
  console.log(`[Otaku] ${categories.length} catégories d'animes`);

  for (const cat of categories) {
    // href = "/xfsearch/manga_genre/<path>/" — l'API attend le chemin complet.
    const catPath = cat.href.replace(/^\/?xfsearch\/manga_genre\//, '').replace(/\/?$/, '/');
    const fullPath = `/xfsearch/manga_genre/${catPath}`;
    let page = 1;
    let emptyPages = 0;

    while (emptyPages < 2 && page <= 500) {
      const data = await fetchJson<{ results: OOAnimeItem[] }>(
        `${OO_BASE}/api/anime-category?path=${encodeURIComponent(fullPath)}&page=${page}`
      );
      if (data === null) parcoursComplet = false;
      const results = data?.results || [];
      stats.pagesFetched++;

      if (results.length === 0) {
        emptyPages++;
        page++;
        continue;
      }
      emptyPages = 0;

      for (const item of results) {
        if (!item?.newsId || !item?.title) continue;
        // Un anime apparaît dans plusieurs genres : upsert uniquement la 1re fois.
        if (seenThisRun.has(item.newsId)) continue;
        seenThisRun.add(item.newsId);

        await upsertCatalogItem(
          {
            provider: 'otaku',
            sourceId: String(item.newsId),
            type: 'anime',
            title: item.title.trim(),
            pageUrl: item.url || `${OO_BASE}/?watch_anime=${item.newsId}`,
            posterUrl: item.poster,
            language: mapFsVersion(item.version),
          },
          stats
        );
      }

      page++;
      await sleep(DELAY_MS);
    }

    if (page > 500) parcoursComplet = false;
    console.log(`[Otaku] "${cat.text}" terminé — uniques=${seenThisRun.size}`);
    await sleep(DELAY_MS);
  }

  const missing = parcoursComplet ? await markMissingAfterRun(stats) : 0;
  if (!parcoursComplet) {
    console.log('[Otaku] Pass interrompu avant la fin du site — absents non comptés.');
  }
  logSyncStats(stats, missing);

  await mongoose.disconnect();
  console.log('[Otaku] Sync terminé.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[FATAL] sync-otaku:', err);
    process.exit(1);
  });
}
