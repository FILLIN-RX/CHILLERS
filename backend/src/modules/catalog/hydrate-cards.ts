/**
 * Rattrape les cartes TMDB des items liés avant que le matcher les stocke :
 * les rangées du catalogue se servent de ces cartes, une fiche sans carte est
 * simplement absente des rangées.
 *
 *   npx tsx src/modules/catalog/hydrate-cards.ts
 *   HYDRATE_BATCH=20000 HYDRATE_CONCURRENCY=8 npx tsx ...
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../../.env') });
// `env -var-file` injecte MONGODB_URI ; le serveur lit MONGO_URI.
if (!process.env.MONGO_URI && process.env.MONGODB_URI) process.env.MONGO_URI = process.env.MONGODB_URI;

import mongoose, { AnyBulkWriteOperation } from 'mongoose';
import tmdbClient from '../../config/tmdb';
import { connectDB } from '../../config/db';
import ProviderCatalogItem, {
  CatalogCard,
  IProviderCatalogItem,
} from '../../models/ProviderCatalogItem';

const BATCH_SIZE = Number(process.env.HYDRATE_BATCH || 5000);
const CONCURRENCY = Number(process.env.HYDRATE_CONCURRENCY || 6);
const DELAY_MS = Number(process.env.HYDRATE_DELAY_MS || 120);
const FLUSH_EVERY = Number(process.env.HYDRATE_FLUSH_EVERY || 50);
const LANGUAGE = process.env.CATALOG_CARD_LANGUAGE || 'fr-FR';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cardFor(item: any): Promise<CatalogCard | null> {
  const kinds: ('movie' | 'tv')[] =
    item.type === 'movie' ? ['movie'] : item.type === 'tv' ? ['tv'] : ['tv', 'movie'];
  for (const kind of kinds) {
    try {
      const { data } = await tmdbClient.get(`/${kind}/${item.tmdbId}`, { params: { language: LANGUAGE } });
      await sleep(DELAY_MS);
      return { ...data, media_type: kind, genre_ids: (data.genres || []).map((g: any) => g.id) };
    } catch {
      // id de l'autre média (un film anime est indexé côté séries) : on réessaie.
    }
  }
  return null;
}

async function main() {
  await connectDB();

  let done = 0;
  let filled = 0;
  let failed = 0;

  const queue: AnyBulkWriteOperation<IProviderCatalogItem>[] = [];

  async function flush() {
    if (queue.length === 0) return;
    const ops = queue.splice(0, queue.length);
    try {
      await ProviderCatalogItem.bulkWrite(ops, { ordered: false });
    } catch (err: any) {
      console.error(`[Hydrate] Flush de ${ops.length} écritures en erreur : ${err.message}`);
    }
  }

  async function worker(items: any[]) {
    for (const item of items) {
      done++;
      try {
        const card = await cardFor(item);
        if (card) {
          queue.push({ updateOne: { filter: { _id: item._id }, update: { $set: { card } } } });
          filled++;
          if (filled % 500 === 0) console.log(`[Hydrate] ${done} traités — ${filled} cartes`);
        } else {
          failed++;
        }
        if (queue.length >= FLUSH_EVERY) await flush();
      } catch (err: any) {
        console.error(`[Hydrate] "${item.title}" en erreur : ${err.message}`);
        await sleep(1000);
      }
    }
  }

  // Les types affamés passent d'abord : l'index a été rempli film par film, un
  // tri par firstSeenAt laisserait les rangées séries/animes vides pendant des heures.
  const order = (process.env.HYDRATE_TYPES || 'anime,tv,movie').split(',').map((s) => s.trim());
  for (const type of order) {
    const missing = await ProviderCatalogItem.find({
      matchStatus: 'matched',
      active: true,
      type,
      tmdbId: { $ne: null },
      $or: [{ 'card.id': { $exists: false } }, { 'card.genre_ids': { $exists: false } }],
    } as any)
      .sort({ firstSeenAt: 1 })
      .limit(BATCH_SIZE)
      .lean();
    console.log(`[Hydrate] ${type} : ${missing.length} cartes à récupérer`);

    const parts: any[][] = Array.from({ length: CONCURRENCY }, () => []);
    missing.forEach((item, i) => parts[i % CONCURRENCY].push(item));
    await Promise.all(parts.map(worker));
    await flush();
  }

  console.log(`\n[Hydrate] Terminé : traités=${done} cartes=${filled} introuvables=${failed}`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[FATAL] hydrate-cards:', err);
    process.exit(1);
  });
}
