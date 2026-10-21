/**
 * Prévisualise au plus 10 fiches non liées avec le matcher bilingue, sans
 * modifier MongoDB. L'ordre commence par les années les plus récentes.
 * Usage: npx tsx src/scripts/preview-unmatched-bilingual-matches.ts
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
import { previewCatalogItem } from '../modules/catalog/match-tmdb';

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

    console.log(`[BilingualPreview] ${items.length} fiche(s), limite=${LIMIT}; aucune écriture en base.`);
    for (let index = 0; index < items.length; index++) {
      const item: any = items[index];
      const { result, diagnostics }: any = await previewCatalogItem(item);
      const season = item.season ? ` — saison ${item.season}` : '';
      console.log(`\n${index + 1}. ${item.provider}/${item.type}: ${item.title}${season} (${item.year || 'année inconnue'})`);

      if (!result) {
        console.log('   DÉCISION: aucun candidat assez sûr (aucune liaison proposée).');
        for (const candidate of diagnostics.slice(0, 3)) {
          const french = candidate.titles?.['fr-FR'] || candidate.titles?.['en-US'] || candidate.originalTitle || 'titre absent';
          const english = candidate.titles?.['en-US'] || candidate.originalTitle || 'titre absent';
          const reason = candidate.accepted
            ? 'nom/année acceptés, mais candidats trop proches (ambiguïté)'
            : candidate.reason === 'similarite_faible'
              ? 'titre trop différent'
              : candidate.reason === 'annee_absente'
                ? 'année absente côté fournisseur ou TMDB'
                : candidate.reason?.startsWith('annee_ecart_')
                  ? `écart d’année ${candidate.reason.slice('annee_ecart_'.length)} ans`
                  : candidate.reason || 'contrôle non satisfait';
          console.log(`   Candidat ${candidate.tmdbId}: FR « ${french} » / EN « ${english} », ${candidate.year || '?'}; similarité ${candidate.similarity.toFixed(2)}; ${reason}.`);
        }
        continue;
      }

      const frenchTitle = result.localizedTitles?.['fr-FR'] || (result.method === 'search' ? '' : '');
      const englishTitle = result.localizedTitles?.['en-US'] || '';
      const fallbackTitle = result.card?.title || result.card?.name || result.card?.original_title || result.card?.original_name || 'titre absent';
      console.log(`   TMDB: ${result.tmdbId} (${result.method}), année ${yearOf(result.card) || 'inconnue'}`);
      console.log(`   Titre français: ${frenchTitle || fallbackTitle}`);
      console.log(`   Titre anglais: ${englishTitle || result.card?.original_title || result.card?.original_name || 'non fourni par TMDB'}`);
      console.log(`   DÉCISION: correspondance proposée; aucune liaison enregistrée.`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('[BilingualPreview] Échec:', error?.message || error);
  process.exit(1);
});
