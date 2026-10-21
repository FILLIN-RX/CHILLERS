import tmdbClient from '../../config/tmdb';
import { toTMDBLanguage } from '../../config/language';
import Serie from '../../models/Serie';
import { applyCatalogFilterToPage, catalogPage, tmdbCatalogList, CatalogSort } from '../catalog/catalog.service';

/** Genre TMDB « Animation » — sert à borner les rangées anime côté catalogue. */
const ANIME_GENRE = '16';

export const getPopular = async (page: number = 1, language?: string) =>
  tmdbCatalogList('tv', '/tv/popular', { page, language: toTMDBLanguage(language) }, { sort: 'popular' });

/** Tendance = signal TMDB (vues de la semaine) : l'index ne peut pas le reproduire. */
export const getTrending = async (language?: string) => {
  const { data } = await tmdbClient.get('/trending/tv/week', { params: { language: toTMDBLanguage(language) } });
  return applyCatalogFilterToPage('tv', data);
};

export const getTopRated = async (page: number = 1, language?: string) =>
  tmdbCatalogList('tv', '/tv/top_rated', { page, language: toTMDBLanguage(language) }, { sort: 'rating' });

export const getByGenre = async (genreId: string, page: number = 1, language?: string) =>
  tmdbCatalogList(
    'tv',
    '/discover/tv',
    { with_genres: genreId, sort_by: 'popularity.desc', page, language: toTMDBLanguage(language) },
    { sort: 'popular', genres: [genreId] }
  );

export const getAnimeByGenre = async (genreId: string, page: number = 1, language?: string) => {
  const fromCatalog = await catalogPage('tv', {
    page,
    sort: 'popular',
    genres: [genreId, ANIME_GENRE],
    types: ['anime'],
  }).catch(() => null);
  if (fromCatalog) return fromCatalog;

  const params = {
    with_genres: genreId,
    sort_by: 'popularity.desc',
    page,
    with_original_language: 'ja',
    language: toTMDBLanguage(language),
  };
  return tmdbCatalogList('tv', '/discover/tv', params, {
    sort: 'popular',
    genres: [genreId, ANIME_GENRE],
    originalLanguage: 'ja',
  });
};

export type DiscoverSort = 'trending' | 'rating' | 'recent' | 'oldest';

const TV_SORT_BY: Record<DiscoverSort, string> = {
  trending: 'popularity.desc',
  rating: 'vote_average.desc',
  recent: 'first_air_date.desc',
  oldest: 'first_air_date.asc',
};

const MOVIE_SORT_BY: Record<DiscoverSort, string> = {
  trending: 'popularity.desc',
  rating: 'vote_average.desc',
  recent: 'primary_release_date.desc',
  oldest: 'primary_release_date.asc',
};

function normalizeSort(sort?: string): DiscoverSort {
  return sort === 'rating' || sort === 'recent' || sort === 'oldest' ? sort : 'trending';
}

/** Même tri, côté index catalogue (les champs sont stockés, pas re-demandés). */
const CATALOG_SORT_OF: Record<DiscoverSort, CatalogSort> = {
  trending: 'popular',
  rating: 'rating',
  recent: 'recent',
  oldest: 'oldest',
};

/** Découverte filtrable : tendance par défaut, filtres genre / année / tri. */
export const discover = async (
  opts: { page?: number; genre?: string; year?: string; sort?: string; anime?: boolean } = {},
  language?: string,
) => {
  const page = Math.max(1, Number(opts.page) || 1);
  const sort = normalizeSort(opts.sort?.trim());
  const genre = opts.genre?.trim() || undefined;
  const year = opts.year?.trim() || undefined;
  const lang = toTMDBLanguage(language);

  if (opts.anime) {
    const tvParams: Record<string, unknown> = {
      page,
      language: lang,
      sort_by: TV_SORT_BY[sort],
      with_genres: genre ? `${genre},16` : '16',
      with_original_language: 'ja',
      include_adult: false,
    };
    const movieParams: Record<string, unknown> = {
      page,
      language: lang,
      sort_by: MOVIE_SORT_BY[sort],
      with_genres: genre ? `${genre},16` : '16',
      with_original_language: 'ja',
      include_adult: false,
    };
    if (year) {
      tvParams.first_air_date_year = year;
      movieParams.primary_release_year = year;
    }
    if (sort === 'rating') {
      tvParams['vote_count.gte'] = 100;
      movieParams['vote_count.gte'] = 100;
    }

    // L'anime est le cas où trier TMDB puis filtrer ne rend rien : le top
    // popularité TMDB est plein de séries que le provider n'héberge pas.
    const fromCatalog = await catalogPage('tv', {
      page,
      sort: CATALOG_SORT_OF[sort],
      genres: genre ? [genre, ANIME_GENRE] : [ANIME_GENRE],
      year,
      types: ['anime'],
    }).catch(() => null);
    if (fromCatalog) return fromCatalog;

    const [tvRes, movieRes] = await Promise.all([
      tmdbClient.get('/discover/tv', { params: tvParams }),
      tmdbClient.get('/discover/movie', { params: movieParams }),
    ]);
    const results = [...tvRes.data.results, ...movieRes.data.results].sort(
      (a, b) => (b.popularity || 0) - (a.popularity || 0),
    );
    return applyCatalogFilterToPage('tv', {
      page: tvRes.data.page,
      results,
      total_pages: Math.max(tvRes.data.total_pages, movieRes.data.total_pages),
      total_results: tvRes.data.total_results + movieRes.data.total_results,
    });
  }

  // Tendance réelle TMDB tant qu'aucun filtre n'est appliqué.
  if (sort === 'trending' && !genre && !year) {
    return tmdbCatalogList('tv', '/trending/tv/week', { page, language: lang }, { sort: 'popular' });
  }

  const params: Record<string, unknown> = {
    page,
    language: lang,
    sort_by: TV_SORT_BY[sort],
    include_adult: false,
  };
  if (genre) params.with_genres = genre;
  if (year) params.first_air_date_year = year;
  if (sort === 'rating') params['vote_count.gte'] = 200;

  return tmdbCatalogList('tv', '/discover/tv', params, {
    sort: CATALOG_SORT_OF[sort],
    genres: genre ? [genre] : undefined,
    year,
  });
};

export const getAnime = async (page: number = 1, language?: string) => {
  const fromCatalog = await catalogPage('tv', {
    page,
    genres: [ANIME_GENRE],
    types: ['anime'],
  }).catch(() => null);
  if (fromCatalog) return fromCatalog;

  const params = {
    with_genres: '16',
    sort_by: 'popularity.desc',
    page,
    with_original_language: 'ja',
    language: toTMDBLanguage(language),
  };

  const [tvRes, movieRes] = await Promise.all([
    tmdbClient.get('/discover/tv', { params }),
    tmdbClient.get('/discover/movie', { params }),
  ]);

  const combinedResults = [...tvRes.data.results, ...movieRes.data.results]
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  return applyCatalogFilterToPage('tv', {
    page: tvRes.data.page,
    results: combinedResults,
    total_pages: Math.max(tvRes.data.total_pages, movieRes.data.total_pages),
    total_results: tvRes.data.total_results + movieRes.data.total_results,
  });
};

export const getAfrican = async (page: number = 1, language?: string, country?: string) => {
  const originCountry = country || 'NG|GH|CM|CI|SN';
  const { data } = await tmdbClient.get('/discover/tv', {
    params: { 
      with_origin_country: originCountry, 
      sort_by: 'popularity.desc', 
      page, 
      language: toTMDBLanguage(language) 
    },
  });
  return applyCatalogFilterToPage('tv', data);
};

export const getDetails = async (id: string, language?: string) => {
  try {
    const { data } = await tmdbClient.get(`/tv/${id}`, {
      params: { 
        append_to_response: 'credits,videos,content_ratings,external_ids,recommendations,similar,aggregate_credits,keywords', 
        language: toTMDBLanguage(language) 
      },
    });
    return data;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      try {
        const { data } = await tmdbClient.get(`/movie/${id}`, {
          params: { 
            append_to_response: 'credits,videos,release_dates,recommendations,similar', 
            language: toTMDBLanguage(language) 
          },
        });
        return data;
      } catch (_) {}
    }
    throw err;
  }
};

export const getSeasonDetails = async (id: string, seasonNumber: string, language?: string) => {
  const { data } = await tmdbClient.get(`/tv/${id}/season/${seasonNumber}`, {
    params: { 
      append_to_response: 'credits,videos,images',
      language: toTMDBLanguage(language) 
    },
  });

  try {
    const tmdbIdNum = parseInt(id, 10);
    const sNum = parseInt(seasonNumber, 10);
    if (!isNaN(tmdbIdNum) && !isNaN(sNum) && data?.episodes?.length) {
      const serie = await Serie.findOne({ tmdbId: tmdbIdNum }).lean().exec();
      if (serie?.episodes?.length) {
        data.episodes = data.episodes.map((ep: any) => {
          const dbEp = serie.episodes.find(
            (e: any) => Number(e.season) === sNum && Number(e.episodeNumber) === Number(ep.episode_number)
          );
          if (dbEp) {
            ep.downloadUrl = dbEp.uqloadLink || (dbEp.uqloadCode ? `/api/download/uqload/${dbEp.uqloadCode}` : null) || dbEp.lien || null;
            ep.uqloadCode = dbEp.uqloadCode;
          }
          return ep;
        });
      }
    }
  } catch {}

  return data;
};

export const getTrailer = async (id: string, language?: string) => {
  try {
    const { data } = await tmdbClient.get(`/tv/${id}/videos`, { params: { language: toTMDBLanguage(language) } });
    let results = data.results || [];

    // Si aucun trailer en français, repli automatique sur en-US ou toutes les vidéos
    if (results.length === 0) {
      const fallback = await tmdbClient.get(`/tv/${id}/videos`, { params: { language: 'en-US' } });
      results = fallback.data?.results || [];
    }
    if (results.length === 0) {
      const fallbackAll = await tmdbClient.get(`/tv/${id}/videos`);
      results = fallbackAll.data?.results || [];
    }

    const trailer =
      results.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer' && v.official === true) ||
      results.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer') ||
      results.find((v: any) => v.site === 'YouTube' && v.type === 'Teaser') ||
      results.find((v: any) => v.site === 'YouTube') ||
      null;

    return trailer;
  } catch {
    return null;
  }
};
