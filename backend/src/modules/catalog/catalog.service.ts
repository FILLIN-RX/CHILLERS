import tmdbClient from '../../config/tmdb';
import ProviderCatalogItem, {
  CatalogCard,
  CatalogItemType,
  CatalogProvider,
  normalizeCatalogTitle,
} from '../../models/ProviderCatalogItem';

const MAX_LIMIT = 50;

export interface CatalogListQuery {
  provider?: CatalogProvider;
  type?: CatalogItemType;
  page?: number;
  limit?: number;
  q?: string;
  matched?: 'only' | 'unmatched' | 'all';
}

export interface CatalogListItem {
  id: string;
  provider: CatalogProvider;
  type: CatalogItemType;
  title: string;
  year?: number;
  description?: string;
  season?: number;
  posterUrl?: string;
  language?: string;
  country?: string;
  quality?: string;
  pageUrl: string;
  tmdbId?: number;
  matched: boolean;
  card?: CatalogCard;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Listing paginé de l'index — le JSON que la section Catalogues rend (façon oha.to). */
export async function listCatalog(query: CatalogListQuery) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || 24));

  const filter: any = { active: true };
  if (query.provider) filter.provider = query.provider;
  if (query.type) filter.type = query.type;
  if (query.matched === 'only') {
    filter.matchStatus = 'matched';
    filter.$or = [
      { type: 'movie', 'card.media_type': 'movie' },
      { type: 'tv', 'card.media_type': 'tv' },
      { type: 'anime', 'card.media_type': { $in: ['movie', 'tv'] }, 'card.genre_ids': 16 },
    ];
  }
  if (query.matched === 'unmatched') filter.matchStatus = 'unmatched';
  if (query.q?.trim()) {
    const needle = escapeRegex(normalizeCatalogTitle(query.q));
    // « 1992 » se normalise en chaîne vide : sans ce garde-fou le $regex vide
    // laisserait passer tout le catalogue.
    if (needle) filter.normalizedTitle = { $regex: new RegExp(needle, 'i') };
  }

  const [items, total] = await Promise.all([
    ProviderCatalogItem.find(filter)
      .select(
        'provider type title year description season posterUrl language country quality pageUrl tmdbId matchStatus card'
      )
      .sort({ lastSeenAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ProviderCatalogItem.countDocuments(filter),
  ]);

  const mapped: CatalogListItem[] = items.map((it: any) => {
    const correctTmdbType = it.type === 'anime'
      ? (it.card?.media_type === 'movie' || it.card?.media_type === 'tv') &&
        (it.card?.genre_ids || []).includes(16)
      : it.card?.media_type === it.type;
    const matched = it.matchStatus === 'matched' && correctTmdbType;
    return {
      id: String(it._id),
      provider: it.provider,
      type: it.type,
      title: it.title,
      year: it.year,
      description: it.description,
      season: it.season,
      posterUrl: it.posterUrl,
      language: it.language,
      country: it.country,
      quality: it.quality,
      pageUrl: it.pageUrl,
      tmdbId: matched ? it.tmdbId : undefined,
      matched,
      card: matched ? it.card : undefined,
    };
  });

  return {
    items: mapped,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** Compteurs par provider/type/statut + dernière synchro (max lastSeenAt). */
export async function catalogStatus() {
  const [byProvider, lastSeen, totals] = await Promise.all([
    ProviderCatalogItem.aggregate([
      { $match: { active: true } },
      {
        $group: {
          _id: { provider: '$provider', type: '$type', matchStatus: '$matchStatus' },
          count: { $sum: 1 },
        },
      },
    ]),
    ProviderCatalogItem.findOne({ active: true }).sort({ lastSeenAt: -1 }).select('lastSeenAt').lean(),
    ProviderCatalogItem.aggregate([{ $match: { active: true } }, { $count: 'total' }]),
  ]);

  const providers: Record<string, { total: number; matched: number; unmatched: number; pending: number; byType: Record<string, number> }> = {};
  for (const row of byProvider) {
    const p = row._id.provider as string;
    if (!providers[p]) providers[p] = { total: 0, matched: 0, unmatched: 0, pending: 0, byType: {} };
    const entry = providers[p];
    entry.total += row.count;
    entry.byType[row._id.type] = (entry.byType[row._id.type] || 0) + row.count;
    if (row._id.matchStatus === 'matched') entry.matched += row.count;
    else if (row._id.matchStatus === 'unmatched') entry.unmatched += row.count;
    else entry.pending += row.count;
  }

  return {
    providers,
    total: totals[0]?.total || 0,
    lastSyncAt: (lastSeen as any)?.lastSeenAt || null,
    // Le même gate que celui qui protège les grilles : un index partiel ne filtre rien.
    matchedMin: FILTER_MIN_MATCHED,
    filterActive: await isCatalogFilterActive(),
  };
}

/**
 * Filtre une liste TMDB : ne garde que les ids présents dans l'index.
 * Retourne null si l'index est vide (gate : pas de filtrage).
 */
export async function filterIdsByCatalog(
  type: 'movie' | 'tv',
  ids: number[]
): Promise<number[] | null> {
  if (!ids.length) return [];
  const rows = await ProviderCatalogItem.find({
    tmdbId: { $in: ids },
    active: true,
    matchStatus: 'matched',
    ...safeSourceTypeFilter(type),
  })
    .select('tmdbId')
    .lean();
  const found = new Set(rows.map((r: any) => r.tmdbId));
  return ids.filter((id) => found.has(id));
}

/**
 * Un index partiel ne doit pas vider le site : tant que le parcours complet
 * n'a pas été fait et lié, on ne filtre rien. 5 000 ids liés ≈ la couverture
 * d'une archive remplie (FrenchStream en compte ~21 000).
 */
const FILTER_MIN_MATCHED = Number(process.env.CATALOG_FILTER_MIN_MATCHED || 5000);
const FILTER_GATE_TTL = 60_000;
let gateCache: { value: boolean; at: number } | null = null;

/** Indique si l'index est assez rempli pour filtrer les grilles TMDB. */
export async function isCatalogFilterActive(): Promise<boolean> {
  if (gateCache && Date.now() - gateCache.at < FILTER_GATE_TTL) return gateCache.value;
  const matched = await ProviderCatalogItem.countDocuments({
    active: true,
    matchStatus: 'matched',
  });
  gateCache = { value: matched >= FILTER_MIN_MATCHED, at: Date.now() };
  return gateCache.value;
}

/**
 * Applique le filtre catalogue à une réponse TMDB paginée ({ results: [...] }).
 * Si l'index est vide ou l'appel échoue, la réponse passe telle quelle
 * (comportement actuel préservé le temps du remplissage).
 */
export async function applyCatalogFilterToPage<T extends { results?: any[] }>(
  type: 'movie' | 'tv',
  data: T
): Promise<T> {
  const results = data?.results;
  if (!Array.isArray(results) || results.length === 0) return data;
  try {
    if (!(await isCatalogFilterActive())) return data;
    const ids = results.map((r: any) => r.id).filter((id: any) => typeof id === 'number');
    const kept = await filterIdsByCatalog(type, ids);
    if (!kept) return data;
    const keptSet = new Set(kept);
    return { ...data, results: results.filter((r: any) => keptSet.has(r.id)) };
  } catch {
    return data;
  }
}

type TmdbResultList = { results?: Array<{ id?: unknown }> };

/**
 * Filtre les listes `recommendations` / `similar` d'une fiche TMDB : la fiche
 * elle-même reste servie, mais les cartes qui pointent vers un titre absent des
 * providers sont retirées (sinon le clic mène à une fiche « indisponible »).
 */
export async function applyCatalogFilterToDetail<
  T extends { recommendations?: TmdbResultList; similar?: TmdbResultList },
>(type: 'movie' | 'tv', data: T): Promise<T> {
  if (!data) return data;
  const [recommendations, similar] = await Promise.all([
    data.recommendations ? applyCatalogFilterToPage(type, data.recommendations) : undefined,
    data.similar ? applyCatalogFilterToPage(type, data.similar) : undefined,
  ]);
  return {
    ...data,
    ...(recommendations ? { recommendations } : {}),
    ...(similar ? { similar } : {}),
  };
}

export type CatalogSort = 'popular' | 'rating' | 'recent' | 'oldest';

const ROW_SIZE = 20;
const RATING_MIN_VOTES = Number(process.env.CATALOG_RATING_MIN_VOTES || 50);
/** Note bayésienne (formule du Top 250) : sinon un live de BTS à 9,6/60 votes coiffe le catalogue. */
const RATING_PRIOR_MEAN = Number(process.env.CATALOG_RATING_PRIOR_MEAN || 6);
const RATING_PRIOR_WEIGHT = Number(process.env.CATALOG_RATING_PRIOR_WEIGHT || 250);

/** Un type source ne suffit pas : l'ID TMDB doit rester dans son espace. */
function safeSourceTypeFilter(type: 'movie' | 'tv'): Record<string, any> {
  if (type === 'movie') {
    return {
      $or: [
        { type: 'movie', 'card.media_type': 'movie' },
        { type: 'anime', 'card.media_type': 'movie', 'card.genre_ids': 16 },
      ],
    };
  }
  return {
    $or: [
      { type: 'tv', 'card.media_type': 'tv' },
      { type: 'anime', 'card.media_type': { $in: ['movie', 'tv'] }, 'card.genre_ids': 16 },
    ],
  };
}

/**
 * Rangée prise dans l'index catalogue plutôt que dans une page TMDB filtrée :
 * 20 titres qu'on a vraiment, triés sur les champs TMDB stockés. Une page TMDB
 * de 20 candidats ne rend que ~30 % de cartes — les rangées tombent à 6, et à 0
 * pour l'animation (le top popularité TMDB est plein de séries qu'on n'héberge
 * pas). null = gate éteint ou index muet sur ce filtre : l'appelant TMDB reprend.
 */
export async function catalogPage(
  type: 'movie' | 'tv',
  opts: {
    page?: number;
    sort?: CatalogSort;
    genres?: string[];
    year?: string;
    types?: CatalogItemType[];
    /** Langue d'origine TMDB — « ja » borne une rangée anime bien chargée. */
    originalLanguage?: string;
  } = {}
): Promise<{
  page: number;
  results: CatalogCard[];
  total_pages: number;
  total_results: number;
} | null> {
  if (!(await isCatalogFilterActive())) return null;

  const page = Math.max(1, Number(opts.page) || 1);
  const genres = (opts.genres || []).map(Number).filter(Number.isFinite);
  const year = /^\d{4}$/.test(String(opts.year || '')) ? String(opts.year) : undefined;
  // Les pages anime demandent volontairement movie + tv; les autres pages
  // doivent respecter l'espace TMDB correspondant à leur route.
  const mediaTypes = type === 'tv' && (opts.types?.includes('movie') || opts.types?.includes('anime')) ? ['movie', 'tv'] : [type];
  const sortBy: Record<string, 1 | -1> =
    opts.sort === 'rating'
      ? { _wr: -1, 'card.vote_count': -1 }
      : opts.sort === 'recent'
        ? { _release: -1, 'card.popularity': -1 }
        : opts.sort === 'oldest'
          ? { _release: 1, 'card.popularity': -1 }
          : { 'card.popularity': -1 };

  const pipeline: any[] = [
    {
      $match: {
        active: true,
        matchStatus: 'matched',
        ...(opts.types ? { type: { $in: opts.types } } : safeSourceTypeFilter(type)),
        'card.id': { $exists: true },
        'card.media_type': { $in: mediaTypes },
        ...(opts.originalLanguage ? { 'card.original_language': opts.originalLanguage } : {}),
        // Tri « notes » : sinon une fiche à 1 vote coiffait tout le catalogue.
        ...(opts.sort === 'rating' ? { 'card.vote_count': { $gte: RATING_MIN_VOTES } } : {}),
        ...(genres.length ? { $and: genres.map((g) => ({ 'card.genre_ids': g })) } : {}),
      },
    },
    { $sort: { 'card.popularity': -1 } },
    // TMDB sépare les espaces movie et tv : un ID numérique peut exister dans
    // les deux. Les regrouper sur tmdbId seul ferait disparaître un autre titre.
    { $group: { _id: { tmdbId: '$tmdbId', mediaType: '$card.media_type' }, card: { $first: '$card' } } },
    { $addFields: { _release: { $ifNull: ['$card.release_date', '$card.first_air_date'] } } },
    {
      $addFields: {
        _wr: {
          $add: [
            RATING_PRIOR_MEAN,
            {
              $multiply: [
                {
                  $divide: [
                    { $ifNull: ['$card.vote_count', 0] },
                    { $add: [{ $ifNull: ['$card.vote_count', 0] }, RATING_PRIOR_WEIGHT] },
                  ]
                },
                { $subtract: [{ $ifNull: ['$card.vote_average', RATING_PRIOR_MEAN] }, RATING_PRIOR_MEAN] },
              ],
            },
          ],
        },
      },
    },
    ...(year ? [{ $match: { _release: { $regex: `^${year}` } } }] : []),
    { $sort: sortBy },
    {
      $facet: {
        items: [{ $skip: (page - 1) * ROW_SIZE }, { $limit: ROW_SIZE }],
        total: [{ $count: 'n' }],
      },
    },
  ];

  const [res] = await ProviderCatalogItem.aggregate(pipeline, { allowDiskUse: true });
  const items: any[] = res?.items || [];
  if (items.length === 0) return null;
  const total: number = res?.total?.[0]?.n || 0;

  return {
    page,
    results: items.map((d) => d.card),
    total_pages: Math.max(1, Math.ceil(total / ROW_SIZE)),
    total_results: total,
  };
}

/**
 * Listing de browsing : rangée catalogue quand l'index la remplit, sinon la
 * page TMDB telle quelle (ou filtrée dès que le gate est actif).
 */
export async function tmdbCatalogList(
  type: 'movie' | 'tv',
  path: string,
  params: Record<string, any> = {},
  opts: {
    sort?: CatalogSort;
    genres?: string[];
    year?: string;
    types?: CatalogItemType[];
    originalLanguage?: string;
  } = {}
): Promise<any> {
  const fromCatalog = await catalogPage(type, {
    page: params.page,
    sort: opts.sort,
    genres: opts.genres,
    year: opts.year,
    types: opts.types,
    originalLanguage: opts.originalLanguage,
  }).catch(() => null);
  if (fromCatalog) return fromCatalog;
  const { data } = await tmdbClient.get(path, { params });
  return applyCatalogFilterToPage(type, data);
}

/** Providers qui couvrent un tmdbId (pour le badge de la fiche média). */
export async function providersForTmdbIds(
  type: 'movie' | 'tv',
  tmdbIds: number[]
): Promise<Map<number, { providers: CatalogProvider[]; language?: string }>> {
  const map = new Map<number, { providers: CatalogProvider[]; language?: string }>();
  if (!tmdbIds.length) return map;
  const rows = await ProviderCatalogItem.find({
    tmdbId: { $in: tmdbIds },
    active: true,
    matchStatus: 'matched',
    ...safeSourceTypeFilter(type),
  })
    .select('tmdbId provider language')
    .lean();
  for (const row of rows as any[]) {
    const entry = map.get(row.tmdbId) || { providers: [] as CatalogProvider[] };
    if (!entry.providers.includes(row.provider)) entry.providers.push(row.provider);
    if (!entry.language && row.language) entry.language = row.language;
    map.set(row.tmdbId, entry);
  }
  return map;
}
