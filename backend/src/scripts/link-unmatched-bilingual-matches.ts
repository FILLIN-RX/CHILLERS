/**
 * Lie automatiquement au plus 10 fiches non liées si le matcher bilingue
 * valide le titre, l'année et l'absence d'homonymes ambigus.
 * Usage: node dist/scripts/link-unmatched-bilingual-matches.js
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });
if (!process.env.MONGO_URI && process.env.MONGODB_URI) {
  process.env.MONGO_URI = process.env.MONGODB_URI;
}

import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import ProviderCatalogItem from '../models/ProviderCatalogItem';
import { matchCatalogItem } from '../modules/catalog/match-tmdb';

const LIMIT = 10;

function yearOf(card: any): number | null {
  const raw = card?.release_date || card?.first_air_date || '';
  const year = Number(String(raw).slice(0, 4));
  return Number.isFinite(year) && year > 1800 ? year : null;
}

async function main() {
  await connectDB();
  try {
    const items = await ProviderCatalogItem.find({ active: true, matchStatus: 'unmatched' })
      .select('provider type title year season pageUrl')
      .sort({ year: -1, lastSeenAt: -1, _id: -1 })
      .limit(LIMIT)
      .lean();

    let linked = 0;
    let skipped = 0;
    console.log(`[BilingualLink] ${items.length} fiche(s), limite=${LIMIT}.`);

    for (const item of items as any[]) {
      const result: any = await matchCatalogItem(item);
      const season = item.season ? ` — saison ${item.season}` : '';
      const sourceLabel = `${item.provider}/${item.type}: ${item.title}${season} (${item.year || 'année inconnue'})`;
      if (!result) {
        skipped++;
        console.log(`IGNORÉ — ${sourceLabel}; pas de correspondance assez sûre.`);
        continue;
      }

      const update: Record<string, unknown> = {
        tmdbId: result.tmdbId,
        card: result.card,
        matchStatus: 'matched',
        matchMethod: result.method,
      };
      if (result.method === 'imdb') update.imdbId = result.imdbId;

      const saved = await ProviderCatalogItem.updateOne(
        { _id: item._id, active: true, matchStatus: 'unmatched' },
        { $set: update }
      );
      if (!saved.modifiedCount) {
        skipped++;
        console.log(`IGNORÉ — ${sourceLabel}; la fiche a changé pendant le traitement.`);
        continue;
      }

      linked++;
      console.log(
        `LIÉ — ${sourceLabel} -> TMDB ${result.tmdbId}: ` +
        `« ${result.localizedTitles?.['fr-FR'] || result.card?.title || result.card?.name || 'titre inconnu'} » / ` +
        `« ${result.localizedTitles?.['en-US'] || result.card?.original_title || result.card?.original_name || 'titre anglais inconnu'} » ` +
        `(${yearOf(result.card) || 'année inconnue'}, ${result.method}).`
      );
    }

    console.log(`[BilingualLink] Terminé : liés=${linked}, ignorés=${skipped}.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('[BilingualLink] Échec:', error?.message || error);
  process.exit(1);
});
