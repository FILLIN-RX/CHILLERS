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
import fs from 'fs/promises';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import mongoose, { AnyBulkWriteOperation } from 'mongoose';
import tmdbClient from '../../config/tmdb';
import { connectDB } from '../../config/db';
import ProviderCatalogItem, {
  CatalogCard,
  IProviderCatalogItem,
  normalizeCatalogTitle,
} from '../../models/ProviderCatalogItem';
import { extractImdbId, extractSourceOriginalTitle, fetchFsPageHtml, splitSeasonTitle } from './frenchstream-listing';
import { extractW16AlternativeTitles, fetchW16AnimePayload } from './w16-anime-source';

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
const REPAIR_TYPE_MISMATCHES = process.env.MATCH_REPAIR_TYPE_MISMATCHES === '1';
const MATCH_UNMATCHED = process.env.MATCH_UNMATCHED === '1';
const MATCH_SKIP_IMDB = MATCH_UNMATCHED && process.env.MATCH_SKIP_IMDB === '1';
const MATCH_PROVIDER = process.env.MATCH_PROVIDER?.trim();
const MATCH_CATALOG_TYPE = process.env.MATCH_CATALOG_TYPE?.trim();
/**
 * Les cartes stockées servent les rangées sans rappeler TMDB : elles doivent
 * donc être en français, comme le reste de l'app. Le gate y gagne aussi —
 * il compare des titres localisés à des titres localisés.
 */
const CARD_LANGUAGE = process.env.CATALOG_CARD_LANGUAGE || 'fr-FR';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function nameSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeCatalogTitle(a).split(' ').filter((w) => w.length > 1));
  const wordsB = new Set(normalizeCatalogTitle(b).split(' ').filter((w) => w.length > 1));
  // Les titres en alphabets non latins peuvent normaliser en vide. Deux sets
  // vides ne prouvent aucune ressemblance : on attend l'identifiant IMDb.
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersect = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersect++;
  return intersect / new Set([...wordsA, ...wordsB]).size;
}

/** Comparaison exacte qui conserve les alphabets non latins (japonais, coréen…). */
function normalizeExactTitle(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

  // Sans année des deux côtés, ou avec une seule année, un homonyme peut
  // sembler parfait. La recherche par titre seule ne lie donc jamais ce cas :
  // l'ID IMDb reste disponible comme preuve exacte.
  if (!itemYear || !candidateYear) {
    return { ok: false, sim, yearOk: false, reason: 'annee_absente' };
  }

  const diff = Math.abs(itemYear - candidateYear);
  if (diff > 1) return { ok: false, sim, yearOk: false, reason: `annee_ecart_${diff}` };
  return { ok: true, sim, yearOk: true };
}

function matchesCatalogKind(item: any, candidate: any, kind: 'movie' | 'tv'): boolean {
  if (item.type === 'movie' && kind !== 'movie') return false;
  if (item.type === 'tv' && kind !== 'tv') return false;
  if (item.type === 'anime') {
    // Le provider classe déjà cette fiche comme anime. Certains anime
    // (ex. productions internationales) ont une langue originale autre que ja.
    return (candidate?.genre_ids || []).includes(16);
  }
  return true;
}

async function searchTmdb(kind: 'movie' | 'tv', query: string, year?: number): Promise<any[]> {
  const params: Record<string, any> = { query, page: 1 };
  if (kind === 'movie' && year) params.year = year;
  if (kind === 'tv' && year) params.first_air_date_year = year;
  const endpoint = kind === 'movie' ? '/search/movie' : '/search/tv';
  // Certains providers donnent le titre français, d'autres l'anglais. Les
  // deux recherches gardent la même année et les mêmes garde-fous de matching.
  const languages = CARD_LANGUAGE === 'en-US' ? ['en-US', 'fr-FR'] : [CARD_LANGUAGE, 'en-US'];
  const responses = await Promise.all(languages.map((language) =>
    tmdbClient.get(endpoint, { params: { ...params, language } })
  ));

  // Garder en priorité la carte dans la langue configurée (fr-FR par défaut),
  // mais conserver aussi le titre anglais pour comparer la correspondance.
  const candidates = new Map<number, any>();
  languages.forEach((language, index) => {
    const data = responses[index].data;
    for (const result of data.results || []) {
      const existing = candidates.get(result.id);
      const titles = [result.title, result.name].filter((value): value is string => Boolean(value));
      if (existing) {
        existing.catalogSearchTitles.push(...titles);
        existing.catalogLocalizedTitles[language] = titles[0];
      } else {
        candidates.set(result.id, {
          ...result,
          catalogSearchTitles: titles,
          catalogLocalizedTitles: { [language]: titles[0] },
          catalogHasPreferredLanguage: index === 0,
        });
      }
    }
  });
  return [...candidates.values()];
}

/** Étape 1 : match par titre+année avec gate dur. */
export interface CatalogMatchDiagnostic {
  tmdbId: number;
  kind: 'movie' | 'tv';
  titles: Record<string, string | undefined>;
  originalTitle?: string;
  year: number | null;
  similarity: number;
  accepted: boolean;
  reason?: string;
}

async function matchBySearch(
  item: any,
  diagnostics?: CatalogMatchDiagnostic[]
): Promise<{
  tmdbId: number;
  method: 'search';
  card: CatalogCard;
  localizedTitles: Record<string, string | undefined>;
} | null> {
  const kinds: ('movie' | 'tv')[] = item.type === 'movie' ? ['movie'] : item.type === 'tv' ? ['tv'] : ['tv', 'movie'];
  for (const kind of kinds) {
    const results = await searchTmdb(kind, item.title, item.year);
    await sleep(TMDB_DELAY_MS);
    const acceptable: Array<{ candidate: any; sim: number }> = [];
    // Évaluer les candidats des deux langues, pas seulement les cinq premiers
    // résultats français qui masqueraient les candidats anglais.
    for (const candidate of results) {
      if (!matchesCatalogKind(item, candidate, kind)) continue;
      const candidateTitles = [
        ...(candidate.catalogSearchTitles || []),
        candidate.title || candidate.name || '',
        candidate.original_title || candidate.original_name || '',
      ].filter(Boolean);
      const candidateYear = candidateYearOf(candidate, kind);
      const checks = candidateTitles
        .map((title) => evaluateCandidate(item.title, item.year, title, candidateYear));
      const bestGate = checks
        .filter((candidateGate) => candidateGate.ok)
        .sort((a, b) => b.sim - a.sim)[0];
      const bestCheck = [...checks].sort((a, b) => b.sim - a.sim)[0];
      diagnostics?.push({
        tmdbId: candidate.id,
        kind,
        titles: candidate.catalogLocalizedTitles || {},
        originalTitle: candidate.original_title || candidate.original_name,
        year: candidateYear,
        similarity: bestCheck?.sim || 0,
        accepted: Boolean(bestGate),
        reason: bestGate ? undefined : bestCheck?.reason,
      });
      if (bestGate) acceptable.push({ candidate, sim: bestGate.sim });
    }
    acceptable.sort((a, b) => b.sim - a.sim);
    const best = acceptable[0];
    const runnerUp = acceptable[1];
    // Deux homonymes plausibles : ne devine pas d'après l'ordre TMDB.
    if (best && runnerUp && best.sim - runnerUp.sim < 0.08) continue;
    if (best) {
      const {
        catalogSearchTitles: _titles,
        catalogLocalizedTitles,
        catalogHasPreferredLanguage,
        ...localizedCandidate
      } = best.candidate;
      const card = catalogHasPreferredLanguage
        ? { ...localizedCandidate, media_type: kind }
        : await fullCard(best.candidate.id, kind);
      return { tmdbId: best.candidate.id, method: 'search', card, localizedTitles: catalogLocalizedTitles };
    }
  }
  return null;
}

/**
 * /find et /search ne rendent pas les mêmes champs (aucun backdrop ni popularité
 * côté /find). Une carte incomplète donnerait une carte cassée dans l'app.
 */
async function fullCard(id: number, kind: 'movie' | 'tv'): Promise<CatalogCard> {
  const { data } = await tmdbClient.get(`/${kind}/${id}`, { params: { language: CARD_LANGUAGE } });
  await sleep(TMDB_DELAY_MS);
  // Le détail rend `genres` en objets ; les rangées filtrées cherchent `genre_ids`.
  return { ...data, media_type: kind, genre_ids: (data.genres || []).map((g: any) => g.id) };
}

/**
 * OpenOtaku ne renvoie pas l'année dans son API de listing. Pour l'anime,
 * on accepte donc uniquement un titre original/source strictement identique,
 * unique entre film et série, et confirmé comme animation par TMDB.
 * Un simple score de similarité sans année ne suffit jamais.
 */
async function matchAnimeByExactTitles(
  item: any,
  sourceTitles: string[],
): Promise<{
  tmdbId: number;
  method: 'search';
  card: CatalogCard;
  localizedTitles: Record<string, string | undefined>;
} | null> {
  const queries = [...new Set(sourceTitles.map((title) => title.trim()).filter(Boolean))];
  const exactHits = new Map<string, { candidate: any; kind: 'movie' | 'tv' }>();

  for (const query of queries) {
    for (const kind of ['tv', 'movie'] as const) {
      const candidates = await searchTmdb(kind, query);
      await sleep(TMDB_DELAY_MS);
      for (const candidate of candidates) {
        if (!matchesCatalogKind({ ...item, type: 'anime' }, candidate, kind)) continue;
        const candidateTitles = [
          ...(candidate.catalogSearchTitles || []),
          candidate.title || candidate.name || '',
          candidate.original_title || candidate.original_name || '',
        ].filter(Boolean);
        const normalizedQuery = normalizeExactTitle(query);
        if (!normalizedQuery || !candidateTitles.some((title) => normalizeExactTitle(title) === normalizedQuery)) continue;
        exactHits.set(`${kind}:${candidate.id}`, { candidate, kind });
      }
    }
  }

  if (exactHits.size !== 1) return null;
  const [{ candidate, kind }] = [...exactHits.values()];
  return {
    tmdbId: candidate.id,
    method: 'search',
    card: await fullCard(candidate.id, kind),
    localizedTitles: candidate.catalogLocalizedTitles || {},
  };
}

/** Étape 2 : IMDB id sur la page provider → TMDB /find (match exact). */
async function matchByImdb(
  item: any,
  pageHtml?: string | null,
): Promise<{ tmdbId: number; method: 'imdb'; imdbId: string; card: CatalogCard } | null> {
  const html = pageHtml ?? await fetchFsPageHtml(item.pageUrl);
  if (!html) return null;
  await sleep(IMDB_DELAY_MS);

  const imdbId = extractImdbId(html);
  if (!imdbId) return null;

  const { data } = await tmdbClient.get(`/find/${imdbId}`, {
    params: { external_source: 'imdb_id' },
  });
  await sleep(TMDB_DELAY_MS);

  const movieHit = (data.movie_results || []).find((candidate: any) => matchesCatalogKind(item, candidate, 'movie'));
  const tvHit = (data.tv_results || []).find((candidate: any) => matchesCatalogKind(item, candidate, 'tv'));
  const best = item.type === 'movie' ? movieHit : item.type === 'tv' ? tvHit : tvHit || movieHit;
  if (!best) return null;

  const kind: 'movie' | 'tv' = item.type === 'movie' ? 'movie' : item.type === 'tv' ? 'tv' : tvHit === best ? 'tv' : 'movie';
  const resultYear = candidateYearOf(best, kind);
  if (item.year && resultYear && Math.abs(item.year - resultYear) > 1) return null;
  return { tmdbId: best.id, method: 'imdb', imdbId, card: await fullCard(best.id, kind) };
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

  const baseMatchFilter: Record<string, any> = REPAIR_TYPE_MISMATCHES
    ? {
        active: true,
        matchStatus: 'matched',
        $or: [
          { type: 'movie', 'card.media_type': { $ne: 'movie' } },
          { type: 'tv', 'card.media_type': { $ne: 'tv' } },
        ],
      }
        : MATCH_UNMATCHED
          ? { matchStatus: 'unmatched', active: true }
          : { matchStatus: 'pending', active: true };
  const matchFilter: Record<string, any> = {
    ...baseMatchFilter,
    ...(MATCH_PROVIDER ? { provider: MATCH_PROVIDER } : {}),
    ...(MATCH_CATALOG_TYPE ? { type: MATCH_CATALOG_TYPE } : {}),
  };
  const pending = await ProviderCatalogItem.find(matchFilter)
    .sort(MATCH_UNMATCHED ? { year: -1, lastSeenAt: -1, _id: -1 } : { firstSeenAt: 1 })
    .limit(BATCH_SIZE)
    .lean();

  console.log(`[CatalogMatch] ${pending.length} items à traiter${MATCH_PROVIDER ? ` (provider=${MATCH_PROVIDER})` : ''}${MATCH_CATALOG_TYPE ? ` (type=${MATCH_CATALOG_TYPE})` : ''}${REPAIR_TYPE_MISMATCHES ? ' (réparation type TMDB)' : MATCH_UNMATCHED ? ` (reprise des non liés${MATCH_SKIP_IMDB ? ', titres bilingues uniquement' : ''})` : ''}`);
  if (REPAIR_TYPE_MISMATCHES && pending.length > 0) {
    const backupPath = path.join('/tmp', `catalog-type-mismatch-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await fs.writeFile(backupPath, JSON.stringify(pending, null, 2), 'utf8');
    console.log(`[CatalogMatch] Sauvegarde des anciennes associations : ${backupPath}`);
  }

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
        const seasonBaseTitle = item.type === 'anime' ? splitSeasonTitle(item.title).base : item.title;
        const yearlessAnime = item.type === 'anime' && !item.year;
        const bySearch = yearlessAnime ? null : await matchBySearch(item);
        const byExactBaseTitle = !bySearch && yearlessAnime
          ? await matchAnimeByExactTitles(item, [seasonBaseTitle])
          : null;
        const sourceHtml = !bySearch && !byExactBaseTitle && item.type === 'anime'
          ? await fetchFsPageHtml(item.pageUrl)
          : null;
        const sourceOriginalTitle = sourceHtml ? extractSourceOriginalTitle(sourceHtml) : undefined;
        const w16Payload = !bySearch && !byExactBaseTitle && /w16\.french-manga\.net/i.test(item.pageUrl)
          ? await fetchW16AnimePayload(item.sourceId)
          : null;
        const sourceTitles = [
          seasonBaseTitle,
          sourceOriginalTitle,
          ...extractW16AlternativeTitles(w16Payload?.alt_titles),
        ].filter((title): title is string => Boolean(title));
        const byExactSourceTitle = !bySearch && !byExactBaseTitle && sourceTitles.length
          ? await matchAnimeByExactTitles(item, sourceTitles)
          : null;
        const result = bySearch || byExactBaseTitle || byExactSourceTitle || (MATCH_SKIP_IMDB ? null : await matchByImdb(item, sourceHtml));

        if (result) {
          queue.push({
              updateOne: {
              filter: MATCH_UNMATCHED
                ? { _id: item._id, active: true, matchStatus: 'unmatched' }
                : { _id: item._id },
              update: {
                $set: {
                  tmdbId: result.tmdbId,
                  card: result.card,
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
              filter: MATCH_UNMATCHED
                ? { _id: item._id, active: true, matchStatus: 'unmatched' }
                : { _id: item._id },
              update: {
                $set: { matchStatus: 'unmatched' },
                $unset: { tmdbId: '', card: '', matchMethod: '', imdbId: '' },
              },
            },
          });
          unmatched++;
        }

        if (queue.length >= FLUSH_EVERY) await flush();
      } catch (err: any) {
        console.error(`[CatalogMatch] "${item.title}" en erreur : ${err.message}`);
        if (REPAIR_TYPE_MISMATCHES) {
          queue.push({
            updateOne: {
              filter: { _id: item._id },
              update: {
                $set: { matchStatus: 'pending' },
                $unset: { tmdbId: '', card: '', matchMethod: '', imdbId: '' },
              },
            },
          });
        }
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

/** Même logique que le batch normal, exposée au script de prévisualisation. */
export async function matchCatalogItem(item: any) {
  const yearlessAnime = item.type === 'anime' && !item.year;
  const bySearch = yearlessAnime ? null : await matchBySearch(item);
  if (bySearch || item.type !== 'anime') return bySearch || (await matchByImdb(item));
  const baseTitle = splitSeasonTitle(item.title).base;
  const exactBase = await matchAnimeByExactTitles(item, [baseTitle]);
  if (exactBase) return exactBase;
  const sourceHtml = await fetchFsPageHtml(item.pageUrl);
  const sourceOriginalTitle = sourceHtml ? extractSourceOriginalTitle(sourceHtml) : undefined;
  const w16Payload = /w16\.french-manga\.net/i.test(item.pageUrl)
    ? await fetchW16AnimePayload(item.sourceId)
    : null;
  const sourceTitles = [baseTitle, sourceOriginalTitle, ...extractW16AlternativeTitles(w16Payload?.alt_titles)]
    .filter((title): title is string => Boolean(title));
  const exactSource = sourceTitles.length
    ? await matchAnimeByExactTitles(item, sourceTitles)
    : null;
  return exactSource || (await matchByImdb(item, sourceHtml));
}

/** Exécution en lecture seule avec motifs des candidats rejetés, pour audit. */
export async function previewCatalogItem(item: any) {
  const diagnostics: CatalogMatchDiagnostic[] = [];
  const search = await matchBySearch(item, diagnostics);
  return {
    result: search || (await matchByImdb(item)),
    diagnostics: diagnostics.sort((a, b) => b.similarity - a.similarity),
  };
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[FATAL] match-tmdb:', err);
    process.exit(1);
  });
}
