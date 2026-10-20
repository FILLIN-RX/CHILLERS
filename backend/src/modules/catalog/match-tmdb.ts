/**
 * Matching des items de catalogue (pending) → TMDB.
 *
 * Étape 1 : recherche TMDB par titre (+ année en indice) avec GATE DUR —
 *           similarité de mots ≥ 0.6 ET année exacte ou ±1 (les homonymes
 *           d'une autre année sont rejetés, contrairement à l'ancien
 *           link-movies-tmdb qui acceptait sur le nom seul).
 * Étape 2 : pour les restants, extraction de l'IMDB id sur la page du
 *           provider puis TMDB /find → match exact.
 * Échec    : marqué `unmatched` (affiché en JSON brut dans la section
 *           Catalogues, jamais deviné).
 *
 *   npx tsx src/modules/catalog/match-tmdb.ts
 *   MATCH_BATCH_SIZE=2000 MATCH_MAX_MINUTES=120 npx tsx ...
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import mongoose, { AnyBulkWriteOperation } from 'mongoose';
import tmdbClient from '../../config/tmdb';
import { connectDB } from '../../config/db';
import ProviderCatalogItem, {
  IProviderCatalogItem,
  normalizeCatalogTitle,
} from '../../models/ProviderCatalogItem';
import { extractImdbId, fetchFsPageHtml } from './frenchstream-listing';

const BATCH_SIZE = Number(process.env.MATCH_BATCH_SIZE || 500);
const TIME_BUDGET_MIN = Number(process.env.MATCH_MAX_MINUTES || 30);
const TMDB_DELAY_MS = Number(process.env.MATCH_TMDB_DELAY_MS || 150);
const IMDB_DELAY_MS = Number(process.env.MATCH_IMDB_DELAY_MS || 800);
/**
 * TMDB est le goulot (~0,5 s par appel) pendant qu'Atlas coûte ~2,3 s par
 * écriture : on fait tourner quelques recherches de front et on groupe les
 * écritures, sinon 21 000 items = 12 h.
 */
const CONCURRENCY = Number(process.env.MATCH_CONCURRENCY || 4);
const FLUSH_EVERY = Number(process.env.MATCH_FLUSH_EVERY || 50);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function nameSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeCatalogTitle(a).split(' ').filter((w) => w.length > 1));
  const wordsB = new Set(normalizeCatalogTitle(b).split(' ').filter((w) => w.length > 1));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  let intersect = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersect++;
  return intersect / new Set([...wordsA, ...wordsB]).size;
}

function candidateYearOf(candidate: any, kind: 'movie' | 'tv'): number | null {
  const raw = kind === 'movie' ? candidate?.release_date : candidate?.first_air_date;
  const y = parseInt(String(raw || '').slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

interface GateResult {
  ok: boolean;
  sim: number;
  yearOk: boolean;
  reason?: string;
}

/** Gate dur : similarité + cohérence d'année (exacte ou ±1). */
function evaluateCandidate(
  itemTitle: string,
  itemYear: number | undefined,
  candidateTitle: string,
  candidateYear: number | null
): GateResult {
  const sim = nameSimilarity(itemTitle, candidateTitle);
  if (sim < 0.6) return { ok: false, sim, yearOk: false, reason: 'similarite_faible' };

  if (itemYear && candidateYear) {
    const diff = Math.abs(itemYear - candidateYear);
    if (diff > 1) return { ok: false, sim, yearOk: false, reason: `annee_ecart_${diff}` };
    return { ok: true, sim, yearOk: true };
  }

  // Sans année des deux côtés, exige une similarité très haute.
  if (!itemYear && !candidateYear) {
    return sim >= 0.75
      ? { ok: true, sim, yearOk: true }
      : { ok: false, sim, yearOk: false, reason: 'sans_annee_sim_insuffisant' };
  }
  return { ok: true, sim, yearOk: true };
}

async function searchTmdb(kind: 'movie' | 'tv', query: string, year?: number): Promise<any[]> {
  const params: Record<string, any> = { query, page: 1 };
  if (kind === 'movie' && year) params.year = year;
  if (kind === 'tv' && year) params.first_air_date_year = year;
  const endpoint = kind === 'movie' ? '/search/movie' : '/search/tv';
  const { data } = await tmdbClient.get(endpoint, { params });
  return data.results || [];
}

/** Étape 1 : match par titre+année avec gate dur. */
async function matchBySearch(item: any): Promise<{ tmdbId: number; method: 'search' } | null> {
  const kinds: ('movie' | 'tv')[] = item.type === 'movie' ? ['movie'] : ['tv', 'movie'];
  for (const kind of kinds) {
    const results = await searchTmdb(kind, item.title, item.year);
    await sleep(TMDB_DELAY_MS);
    for (const candidate of results.slice(0, 5)) {
      const candidateTitle = candidate.title || candidate.name || '';
      const gate = evaluateCandidate(item.title, item.year, candidateTitle, candidateYearOf(candidate, kind));
      if (gate.ok) return { tmdbId: candidate.id, method: 'search' };
    }
  }
  return null;
}

/** Étape 2 : IMDB id sur la page provider → TMDB /find (match exact). */
async function matchByImdb(
  item: any
): Promise<{ tmdbId: number; method: 'imdb'; imdbId: string } | null> {
  const html = await fetchFsPageHtml(item.pageUrl);
  if (!html) return null;
  await sleep(IMDB_DELAY_MS);

  const imdbId = extractImdbId(html);
  if (!imdbId) return null;

  const { data } = await tmdbClient.get(`/find/${imdbId}`, {
    params: { external_source: 'imdb_id' },
  });
  await sleep(TMDB_DELAY_MS);

  const candidates =
    item.type === 'movie'
      ? data.movie_results || []
      : [...(data.tv_results || []), ...(data.movie_results || [])];
  const best = candidates[0];
  if (!best) return null;

  // L'IMDB id reste en preuve du match.
  return { tmdbId: best.id, method: 'imdb', imdbId };
}

async function main() {
  await connectDB();

  const deadline = Date.now() + TIME_BUDGET_MIN * 60_000;
  let matched = 0;
  let unmatched = 0;
  let processed = 0;

  console.log(
    `[CatalogMatch] Batch de ${BATCH_SIZE} items pending (budget ${TIME_BUDGET_MIN} min, ` +
      `concurrence ${CONCURRENCY}, flush ${FLUSH_EVERY})`
  );

  const pending = await ProviderCatalogItem.find({ matchStatus: 'pending', active: true })
    .sort({ firstSeenAt: 1 })
    .limit(BATCH_SIZE)
    .lean();

  console.log(`[CatalogMatch] ${pending.length} items à traiter`);

  const queue: AnyBulkWriteOperation<IProviderCatalogItem>[] = [];
  let arret = false;

  async function flush() {
    if (queue.length === 0) return;
    const ops = queue.splice(0, queue.length);
    try {
      await ProviderCatalogItem.bulkWrite(ops, { ordered: false });
    } catch (err: any) {
      console.error(`[CatalogMatch] Flush de ${ops.length} écritures en erreur : ${err.message}`);
    }
  }

  async function worker(items: any[]) {
    for (const item of items) {
      if (Date.now() > deadline) {
        arret = true;
        break;
      }
      processed++;

      try {
        const bySearch = await matchBySearch(item);
        const result = bySearch || (await matchByImdb(item));

        if (result) {
          queue.push({
            updateOne: {
              filter: { _id: item._id },
              update: {
                $set: {
                  tmdbId: result.tmdbId,
                  matchStatus: 'matched',
                  matchMethod: result.method,
                  ...(result.method === 'imdb' ? { imdbId: result.imdbId } : {}),
                },
              },
            },
          });
          matched++;
          if (matched % 200 === 0) {
            console.log(`[CatalogMatch] ${processed}/${pending.length} — ${matched} liés`);
          }
        } else {
          queue.push({
            updateOne: {
              filter: { _id: item._id },
              update: { $set: { matchStatus: 'unmatched' } },
            },
          });
          unmatched++;
        }

        if (queue.length >= FLUSH_EVERY) await flush();
      } catch (err: any) {
        console.error(`[CatalogMatch] "${item.title}" en erreur : ${err.message}`);
        await sleep(1000);
      }
    }
  }

  // Répartition round-robin : chaque worker prend un item sur CONCURRENCY.
  const parts: any[][] = Array.from({ length: CONCURRENCY }, () => []);
  pending.forEach((item, i) => parts[i % CONCURRENCY].push(item));

  await Promise.all(parts.map(worker));
  await flush();

  if (arret) console.log('[CatalogMatch] Budget de temps atteint — les restants restent pending.');
  console.log(`\n[CatalogMatch] Terminé : traités=${processed} liés=${matched} non liés=${unmatched}`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[FATAL] match-tmdb:', err);
    process.exit(1);
  });
}
