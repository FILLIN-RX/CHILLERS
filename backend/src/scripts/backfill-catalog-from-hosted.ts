/**
 * Reprise des docs hébergés (Movie/Serie avec lien jouable) dont le tmdbId
 * n'est couvert par AUCUNE ligne « active + matched » de l'index providers —
 * la grille n'en montre rien, alors que le titre est servi sur le site.
 *
 *   npx tsx src/scripts/backfill-catalog-from-hosted.ts          # dry-run : compte et montre
 *   npx tsx src/scripts/backfill-catalog-from-hosted.ts --apply  # écrit (idempotent)
 *
 * Les lignes créées portent le provider `mongodb` (docs de notre base, liés au
 * TMDB par tmdbId). Supprimables via db.provider_catalog_items.deleteMany({provider:'mongodb'}).
 */
import { connectDB } from '../config/db';
import tmdbClient from '../config/tmdb';
import ProviderCatalogItem, { normalizeCatalogTitle } from '../models/ProviderCatalogItem';
import Movie from '../models/Movie';
import Serie from '../models/Serie';

const PLAYABLE = /^https?:\/\//i;
const APPLY = process.argv.includes('--apply');
const PROVIDER = 'mongodb';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const HOSTED_MOVIE = {
  $or: [
    { lien: { $regex: PLAYABLE } },
    { uqloadLink: { $regex: PLAYABLE } },
    { uqloadHls: { $regex: PLAYABLE } },
    { streamtapeLink: { $regex: PLAYABLE } },
  ],
};
const HOSTED_TV = { 'episodes.lien': { $regex: PLAYABLE } };

async function collectTodo(type: 'movie' | 'tv'): Promise<number[]> {
  const Model: any = type === 'movie' ? Movie : Serie;
  const docs = await Model.find({ ...(type === 'movie' ? HOSTED_MOVIE : HOSTED_TV) })
    .select('tmdbId')
    .lean();

  const allIds = new Set<number>();
  for (const d of docs as any[]) {
    const id = Number(d?.tmdbId);
    if (Number.isFinite(id) && id > 0) allIds.add(id);
  }
  if (allIds.size === 0) return [];

  // Déjà couvert quelque part : rien à créer (la grille le sert déjà).
  const covered = await ProviderCatalogItem.distinct('tmdbId', {
    active: true,
    matchStatus: 'matched',
    tmdbId: { $in: [...allIds] },
  });
  const coveredSet = new Set((covered as any[]).map(Number));
  return [...allIds].filter((id) => !coveredSet.has(id));
}

function buildCard(type: 'movie' | 'tv', data: any) {
  const base = {
    id: data.id,
    poster_path: data.poster_path,
    backdrop_path: data.backdrop_path,
    overview: data.overview,
    vote_average: data.vote_average,
    vote_count: data.vote_count,
    popularity: data.popularity,
    original_language: data.original_language,
    genre_ids: (Array.isArray(data.genres) ? data.genres : []).map((g: any) => Number(g?.id)).filter(Number.isFinite),
  };
  return type === 'movie'
    ? { ...base, media_type: 'movie', title: data.title, original_title: data.original_title, release_date: data.release_date }
    : { ...base, media_type: 'tv', name: data.name, original_name: data.original_name, first_air_date: data.first_air_date };
}

async function tmdbDetails(type: 'movie' | 'tv', id: number): Promise<any | null> {
  const path = type === 'movie' ? `/movie/${id}` : `/tv/${id}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data } = await tmdbClient.get(path, { params: { language: 'fr-FR' } });
      return data ?? null;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) {
        await sleep(2_000);
        continue;
      }
      return null; // 404 ou panne TMDB : on passe, l'entrée reste absente.
    }
  }
  return null;
}

async function processType(type: 'movie' | 'tv') {
  const todo = await collectTodo(type);
  console.log(`[${type}] à reprendre : ${todo.length}`);

  // Pool contraint (5 travailleurs) : TMDB répond en ~0.3 s/requête
  const concurrency = Math.max(1, Number(process.env.BACKFILL_CONCURRENCY || 5));
  let created = 0;
  let tmdbFailed = 0;
  let index = 0;
  let done = 0;
  const worker = async () => {
    for (;;) {
      const i = index++;
      if (i >= todo.length) return;
      const tmdbId = todo[i];
      const details = await tmdbDetails(type, tmdbId);
      if (!details) {
        tmdbFailed++;
        done++;
        continue;
      }

      const card = buildCard(type, details);
      const title: string = type === 'movie' ? details.title : details.name;
      const yearSource = type === 'movie' ? details.release_date : details.first_air_date;
      const year = yearSource ? Number(String(yearSource).slice(0, 4)) || undefined : undefined;

      const doc = {
        provider: PROVIDER,
        sourceId: `${type}:${tmdbId}`,
        type,
        title: String(title || `#${tmdbId}`),
        normalizedTitle: normalizeCatalogTitle(String(title || '')),
        year,
        description: details.overview || undefined,
        pageUrl: `https://www.themoviedb.org/${type}/${tmdbId}`,
        posterUrl: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : undefined,
        language: details.original_language || undefined,
        tmdbId,
        card,
        matchStatus: 'matched' as const,
        matchMethod: 'manual' as const,
        lastMatchAttemptAt: new Date(),
        manualMatchBy: 'backfill-catalog-from-hosted',
        manualMatchAt: new Date(),
        active: true,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        missingCount: 0,
      };

      if (APPLY) {
        await ProviderCatalogItem.updateOne(
          { provider: PROVIDER, sourceId: doc.sourceId },
          { $set: doc },
          { upsert: true },
        );
      }
      created++;
      done++;
      if (done % 100 === 0) console.log(`[${type}] ${done}/${todo.length}…`);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, todo.length) }, () => worker()),
  );

  console.log(`[${type}] ${APPLY ? 'créés/à jour' : 'créables (dry-run)'} : ${created} | échecs TMDB : ${tmdbFailed}`);
  return { todo: todo.length, created, tmdbFailed };
}

async function main() {
  await connectDB();
  console.log(`backfill-catalog-from-hosted — mode ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  // Séquentiel : deux flux en parallèle flattent le rate limit TMDB.
  const movie = await processType('movie');
  const tv = await processType('tv');
  console.log(
    `\nTotal à créer : ${movie.todo + tv.todo}` +
      (APPLY ? ` | écrits : ${movie.created + tv.created}` : ''),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
