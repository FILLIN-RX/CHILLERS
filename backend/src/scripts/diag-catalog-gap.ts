/**
 * Diagnostic lecture-seule : pourquoi des titres hosted sont-ils absents des
 * listes ? Comptage des lignes catalogue vs docs avec lien jouable.
 *
 *   npx tsx src/scripts/diag-catalog-gap.ts
 */
import { connectDB } from '../config/db';
import Movie from '../models/Movie';
import Serie from '../models/Serie';
import ProviderCatalogItem from '../models/ProviderCatalogItem';

const PLAYABLE = /^https?:\/\//i;

const linkFilter = (type: 'movie' | 'tv') =>
  type === 'movie'
    ? {
        $or: [
          { lien: { $regex: PLAYABLE } },
          { uqloadLink: { $regex: PLAYABLE } },
          { streamtapeLink: { $regex: PLAYABLE } },
        ],
      }
    : { 'episodes.lien': { $regex: PLAYABLE } };

async function countHosted(type: 'movie' | 'tv') {
  const Model: any = type === 'movie' ? Movie : Serie;
  const hosted = await Model.find({ ...linkFilter(type) }).select('tmdbId episodes').lean();
  const withTmdb = hosted.filter((d: any) => Number.isFinite(Number(d.tmdbId)) && Number(d.tmdbId) > 0);
  const ids = withTmdb.map((d: any) => Number(d.tmdbId));

  const inIndex = await ProviderCatalogItem.distinct('tmdbId', {
    tmdbId: { $in: ids },
    active: true,
    matchStatus: 'matched',
  });
  const inIndexSet = new Set(inIndex.map(Number));
  const missing = ids.filter((id: number) => !inIndexSet.has(id));

  return {
    model: type === 'movie' ? 'films' : 'séries',
    hostedDocs: hosted.length,
    hostedWithTmdb: withTmdb.length,
    tmdbUnique: new Set(ids).size,
    presentInIndex: inIndexSet.size,
    missingFromIndex: new Set(missing).size,
  };
}

async function main() {
  await connectDB();

  const [movieStats, tvStats] = await Promise.all([countHosted('movie'), countHosted('tv')]);

  const mongoRows = await ProviderCatalogItem.countDocuments({ provider: 'mongodb' });
  const mongoMatched = await ProviderCatalogItem.countDocuments({ provider: 'mongodb', matchStatus: 'matched', active: true });
  console.log(`mongodb rows (upserts écrits): ${mongoRows} | active+matched: ${mongoMatched}`);

  const byProvider = await ProviderCatalogItem.aggregate([
    { $group: { _id: { provider: '$provider', matchStatus: '$matchStatus' }, total: { $count: {} } } },
    { $sort: { '_id.provider': 1, '_id.matchStatus': 1 } },
  ]);

  const activeMatched = {
    total: await ProviderCatalogItem.countDocuments({ active: true, matchStatus: 'matched' }),
    inactive: await ProviderCatalogItem.countDocuments({ active: false }),
    unmatched: await ProviderCatalogItem.countDocuments({ matchStatus: 'unmatched' }),
    pending: await ProviderCatalogItem.countDocuments({ matchStatus: 'pending' }),
  };

  console.log('════════════ DIAGNOSTIC CATALOGUE / DISPO ════════════');
  for (const stats of [movieStats, tvStats]) {
    console.log(`\n${stats.model.toUpperCase()}`);
    console.log(`  Docs hosted (avec lien):          ${stats.hostedDocs}`);
    console.log(`  … dont tmdbId résolu:             ${stats.hostedWithTmdb}`);
    console.log(`  … ids TMDB uniques:               ${stats.tmdbUnique}`);
    console.log(`  … présents dans l'index:          ${stats.presentInIndex}`);
    console.log(`  … ABSENTS de l'index (gate-safe): ${stats.missingFromIndex}`);
  }

  console.log('\nPROVIDER CATALOG ITEM');
  console.log(`  active+matched: ${activeMatched.total}`);
  console.log(`  unmatched:      ${activeMatched.unmatched}`);
  console.log(`  pending:        ${activeMatched.pending}`);
  console.log(`  inactive:       ${activeMatched.inactive}`);
  for (const row of byProvider) {
    console.log(`    ${row._id.provider}/${row._id.matchStatus}: ${row.total}`);
  }

  const moviesWithoutTmdb = await Movie.countDocuments({
    $or: [
      { tmdbId: { $exists: false } },
      { tmdbId: null },
      { tmdbId: 0 },
    ],
    ...linkFilter('movie'),
  });
  console.log(`\nFILMS hosted SANS tmdbId (impossibles à lier): ${moviesWithoutTmdb}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
