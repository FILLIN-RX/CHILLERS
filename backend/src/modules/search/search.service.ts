import tmdbClient from '../../config/tmdb';
import { toTMDBLanguage } from '../../config/language';
import Movie from '../../models/Movie';
import Serie from '../../models/Serie';
import ProviderCatalogItem from '../../models/ProviderCatalogItem';
import { filterIdsByCatalog } from '../catalog/catalog.service';

// Petit limiteur de concurrence maison (équivalent p-limit avec une cap à 4).
const queue: Array<() => void> = [];
let active = 0;
const MAX = 4;

function limit<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      active++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          active--;
          const next = queue.shift();
          if (next) next();
        });
    };
    if (active < MAX) run();
    else queue.push(run);
  });
}

async function fetchDetails(media_type: 'movie' | 'tv', id: number, language?: string) {
  return limit(() =>
    tmdbClient
      .get(`/${media_type}/${id}`, {
        params: {
          append_to_response: 'images,credits,videos',
          include_image_language: 'en,fr,null',
          language: toTMDBLanguage(language),
        },
      })
      .then(r => r.data)
      .catch(() => null)
  );
}

/** Échappe les métacaractères d'une saisie utilisateur avant de l'injecter dans un RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalise un titre pour la comparaison (enlève articles, ponctuation, etc.)
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/^(the|le|la|les|un|une|des)\s+/i, '') // Retire articles
    .replace(/[^\w\s]/g, '') // Retire ponctuation
    .replace(/\s+/g, ' ') // Normalise espaces
    .trim();
}

/**
 * Calcule un score de similarité entre le titre recherché et le résultat
 */
function calculateRelevanceScore(
  query: string,
  result: any,
  mediaType: 'movie' | 'tv'
): number {
  const title = mediaType === 'movie' ? result.title || result.name : result.name || result.title;
  const originalTitle = result.original_title || result.original_name || '';
  
  const normalizedQuery = normalizeTitle(query);
  const normalizedTitle = normalizeTitle(title || '');
  const normalizedOriginal = normalizeTitle(originalTitle);

  let score = 0;

  // Correspondance exacte = 100 points
  if (normalizedTitle === normalizedQuery || normalizedOriginal === normalizedQuery) {
    score += 100;
  }
  // Commence par la requête = 50 points
  else if (normalizedTitle.startsWith(normalizedQuery) || normalizedOriginal.startsWith(normalizedQuery)) {
    score += 50;
  }
  // Contient la requête = 25 points
  else if (normalizedTitle.includes(normalizedQuery) || normalizedOriginal.includes(normalizedQuery)) {
    score += 25;
  }

  // Bonus pour popularité (vote_average et vote_count)
  const voteAverage = result.vote_average || 0;
  const voteCount = result.vote_count || 0;
  score += (voteAverage / 10) * 20; // Max 20 points
  score += Math.min(voteCount / 100, 10); // Max 10 points

  // Bonus pour année récente (les plus récents = plus pertinents)
  const year = parseInt(
    (result.release_date || result.first_air_date || '').substring(0, 4)
  );
  if (year >= 2020) score += 10;
  else if (year >= 2010) score += 5;

  return score;
}

/**
 * Filtre les doublons par identifiant unique (media_type + id/tmdbId) tout en calculant
 * le score de pertinence pour classer les résultats du plus pertinent au moins pertinent.
 * Les œuvres distinctes portant le même titre (ex: remakes, films homonymes comme "Kraken")
 * sont préservées et ne sont plus écrasées.
 */
function deduplicateResults(results: any[], query: string): any[] {
  const seen = new Map<string, any>();

  for (const result of results) {
    const mediaType = result.media_type as 'movie' | 'tv';
    const id = result.id || result.tmdbId || result._id;
    if (!id) continue;
    const key = `${mediaType}:${id}`;
    const score = calculateRelevanceScore(query, result, mediaType);

    // Garde seulement le résultat avec le meilleur score pour chaque ID unique
    if (!seen.has(key) || score > seen.get(key).score) {
      seen.set(key, { ...result, score });
    }
  }

  // Trie par score décroissant et retourne
  return Array.from(seen.values())
    .sort((a, b) => b.score - a.score)
    .map(({ score, ...rest }) => rest); // Retire le score du résultat final
}

/**
 * Recherche multi-source avec déduplication intelligente :
 *  1. MongoDB local (films + séries, regex insensible à la casse)
 *  2. TMDB /search/movie + /search/tv en parallèle
 *  3. Hydratation des tops avec append_to_response=images,credits,videos
 *  4. Déduplication par type + titre normalisé avec scoring de pertinence
 *  5. Retour des résultats triés par pertinence
 */
export const searchMulti = async (query: string, page: number = 1, language?: string) => {
  const regex = new RegExp(escapeRegExp(query), 'i');

  const [localMovies, localSeries, moviesResp, tvResp, sourceCatalogRows] = await Promise.all([
    Movie.find({ titre: regex }).limit(5).lean().catch(() => []),
    Serie.find({ titre: regex }).limit(5).lean().catch(() => []),
    tmdbClient
      .get('/search/movie', { params: { query, page, language: toTMDBLanguage(language) } })
      .then(r => r.data)
      .catch(() => ({ results: [] })),
    tmdbClient
      .get('/search/tv', { params: { query, page, language: toTMDBLanguage(language) } })
      .then(r => r.data)
      .catch(() => ({ results: [] })),
    ProviderCatalogItem.find({
      active: true,
      $or: [
        { provider: { $in: ['otaku', 'afroland'] }, matchStatus: 'matched' },
        { provider: 'afroland', matchStatus: 'unmatched' },
      ],
      $and: [{
        $or: [
          { title: regex },
          { 'card.title': regex },
          { 'card.name': regex },
          { 'card.original_title': regex },
          { 'card.original_name': regex },
        ],
      }],
    })
      .select('provider type sourceId title year description posterUrl pageUrl card tmdbId matchStatus')
      .limit(20)
      .lean()
      .catch(() => []),
  ]);

  const sourceOnly = sourceCatalogRows
    .filter((row: any) => row.provider === 'afroland' && row.matchStatus === 'unmatched')
    .map((row: any) => ({
      id: `afroland-${row.sourceId}`,
      media_type: row.type === 'movie' ? 'movie' : 'tv',
      title: row.type === 'movie' ? row.title : undefined,
      name: row.type === 'movie' ? undefined : row.title,
      overview: row.description || '',
      posterUrl: row.posterUrl,
      release_date: row.type === 'movie' && row.year ? `${row.year}-01-01` : undefined,
      first_air_date: row.type !== 'movie' && row.year ? `${row.year}-01-01` : undefined,
      sourceProvider: 'Black',
    }));
  const sourceCatalog = sourceCatalogRows
    .filter((row: any) => row.matchStatus === 'matched')
    .map((row: any) => row.card && { ...row.card, media_type: row.card.media_type || 'tv', id: row.tmdbId })
    .filter(Boolean) as any[];
  const movieTop = [...(moviesResp.results || []), ...sourceCatalog.filter((item) => item.media_type === 'movie')]
    .slice(0, 40) as any[];
  const tvTop = [...(tvResp.results || []), ...sourceCatalog.filter((item) => item.media_type === 'tv')]
    .slice(0, 40) as any[];

  // Fail closed: TMDB fournit les métadonnées, mais seul l'index des providers
  // prouve qu'un titre est réellement disponible. Cette recherche reste stricte
  // même si l'index est incomplet ou temporairement indisponible.
  const [filmGardes, serieGardee] = await Promise.all([
    filterIdsByCatalog('movie', movieTop.map((item) => item.id)),
    filterIdsByCatalog('tv', tvTop.map((item) => item.id)),
  ]);
  const movieIds = new Set(filmGardes || []);
  const tvIds = new Set(serieGardee || []);
  const films = movieTop.filter((item) => movieIds.has(item.id));
  const series = tvTop.filter((item) => tvIds.has(item.id));

  const [movieDetails, tvDetails] = await Promise.all([
    Promise.all(films.map(m => fetchDetails('movie', m.id, language))),
    Promise.all(series.map(t => fetchDetails('tv', t.id, language))),
  ]);

  // Merge les résultats
  const allResults = [
    ...films.map((m, i) => ({
      ...(movieDetails[i] || {}),
      ...m,
      media_type: 'movie' as const,
    })),
    ...series.map((t, i) => ({
      ...(tvDetails[i] || {}),
      ...t,
      media_type: 'tv' as const,
    })),
    ...sourceOnly,
  ];

  // Déduplique et trie par pertinence
  const deduplicatedResults = deduplicateResults(allResults, query);

  // Limite aux 20 résultats les plus pertinents
  const tmdbResults = {
    results: deduplicatedResults.slice(0, 20),
  };

  return {
    localResults: { movies: localMovies, series: localSeries },
    tmdbResults,
  };
};
