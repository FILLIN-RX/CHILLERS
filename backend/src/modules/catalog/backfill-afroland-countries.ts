/**
 * Récupère les pays de production TMDB pour les films AfroLand liés.
 * À lancer après la synchronisation AfroLand : npx tsx src/modules/catalog/backfill-afroland-countries.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import mongoose from 'mongoose';
import tmdbClient from '../../config/tmdb';
import { connectDB } from '../../config/db';
import ProviderCatalogItem from '../../models/ProviderCatalogItem';

const CONCURRENCY = 5;
const DELAY_MS = 100;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  await connectDB();
  const items = await ProviderCatalogItem.find({
    provider: 'afroland', type: 'movie', active: true, tmdbId: { $ne: null },
  }).select('_id tmdbId country').lean();
  let updated = 0;
  let missing = 0;
  let failed = 0;

  for (let offset = 0; offset < items.length; offset += CONCURRENCY) {
    const batch = items.slice(offset, offset + CONCURRENCY);
    const results = await Promise.all(batch.map(async (item) => {
      try {
        const { data } = await tmdbClient.get(`/movie/${item.tmdbId}`, { params: { language: 'en-US' } });
        const countries = (data.production_countries || [])
          .map((entry: { name?: string }) => entry.name?.trim())
          .filter(Boolean);
        await sleep(DELAY_MS);
        return { id: item._id, country: countries.length ? countries.join(', ') : undefined };
      } catch {
        return { id: item._id, error: true as const };
      }
    }));
    const updates = results.filter((row) => row.country).map((row) => ({
      updateOne: { filter: { _id: row.id }, update: { $set: { country: row.country } } },
    }));
    if (updates.length) await ProviderCatalogItem.bulkWrite(updates, { ordered: false });
    updated += updates.length;
    missing += results.filter((row) => !row.country && !('error' in row)).length;
    failed += results.filter((row) => 'error' in row).length;
    if ((offset + batch.length) % 100 === 0 || offset + batch.length === items.length) {
      console.log(`[AfroLand pays] ${Math.min(offset + batch.length, items.length)}/${items.length} traités; pays trouvés=${updated}; sans pays TMDB=${missing}; échecs=${failed}`);
    }
  }

  await mongoose.disconnect();
  console.log(`[AfroLand pays] terminé: liés=${items.length}, pays enregistrés=${updated}, sans pays TMDB=${missing}, échecs=${failed}`);
}

main().catch(async (error) => {
  console.error('[FATAL] backfill-afroland-countries:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
