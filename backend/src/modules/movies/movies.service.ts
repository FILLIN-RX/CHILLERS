import tmdbClient from '../../config/tmdb';
import { toTMDBLanguage } from '../../config/language';
import Movie from '../../models/Movie';
import { applyCatalogFilterToPage, tmdbCatalogList, CatalogSort } from '../catalog/catalog.service';

export const getPopular = async (page: number = 1, language?: string) =>
  tmdbCatalogList('movie', '/movie/popular', { page, language: toTMDBLanguage(language) }, { sort: 'popular' });

/** Tendance = signal TMDB (vues de la semaine) : l'index ne peut pas le reproduire. */
export const getTrending = async (language?: string) => {
  const { data } = await tmdbClient.get('/trending/movie/week', { params: { language: toTMDBLanguage(language) } });
  return applyCatalogFilterToPage('movie', data);
};

export const getUpcoming = async (page: number = 1, language?: string) => {
  const today = new Date().toISOString().split('T')[0];
  return tmdbCatalogList(
    'movie',
    '/discover/movie',
    {
      page,
      language: toTMDBLanguage(language),
      'primary_release_date.gte': today,
      sort_by: 'popularity.desc',
      include_adult: false,
    },
    { sort: 'recent' }
  );
};

export const getTopRated = async (page: number = 1, language?: string) =>
  tmdbCatalogList('movie', '/movie/top_rated', { page, language: toTMDBLanguage(language) }, { sort: 'rating' });

export const getDetails = async (id: string, language?: string) => {
  try {
    const { data } = await tmdbClient.get(`/movie/${id}`, {
      params: { 
        append_to_response: 'credits,videos,release_dates,recommendations,similar', 
        language: toTMDBLanguage(language) 
      },
    });

    const tmdbIdNum = parseInt(id, 10);
    if (!isNaN(tmdbIdNum)) {
      try {
        const dbMovie = await Movie.findOne({ tmdbId: tmdbIdNum }).select('uqloadLink uqloadCode lien synopsis posterUrl backdropUrl').lean().exec();
        if (dbMovie) {
          data.downloadUrl = dbMovie.uqloadLink || (dbMovie.uqloadCode ? `/api/download/uqload/${dbMovie.uqloadCode}` : null) || dbMovie.lien || null;
          data.uqloadCode = dbMovie.uqloadCode;
          if (dbMovie.synopsis) { data.overview = dbMovie.synopsis; data.synopsis = dbMovie.synopsis; }
          if (dbMovie.posterUrl) data.posterUrl = dbMovie.posterUrl;
          if (dbMovie.backdropUrl) data.backdropUrl = dbMovie.backdropUrl;
        }
      } catch {}
    }

    return data;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      try {
        const { data } = await tmdbClient.get(`/tv/${id}`, {
          params: { 
            append_to_response: 'credits,videos,content_ratings,recommendations,similar', 
            language: toTMDBLanguage(language) 
          },
        });
        return data;
      } catch (_) {}
    }
    throw err;
  }
};

export const getRecommendations = async (id: string, language?: string) => {
  try {
    const { data } = await tmdbClient.get(`/movie/${id}/recommendations`, { params: { language: toTMDBLanguage(language) } });
    return data;
  } catch (err: any) {
    try {
      const { data } = await tmdbClient.get(`/tv/${id}/recommendations`, { params: { language: toTMDBLanguage(language) } });
      return data;
    } catch (_) {
      return { results: [], page: 1, total_pages: 0, total_results: 0 };
    }
  }
};

export const getTrailer = async (id: string, language?: string) => {
  try {
    const { data } = await tmdbClient.get(`/movie/${id}/videos`, { params: { language: toTMDBLanguage(language) } });
    let results = data.results || [];

    // Si aucun trailer en français, repli automatique sur en-US ou toutes les vidéos
    if (results.length === 0) {
      const fallback = await tmdbClient.get(`/movie/${id}/videos`, { params: { language: 'en-US' } });
      results = fallback.data?.results || [];
    }
    if (results.length === 0) {
      const fallbackAll = await tmdbClient.get(`/movie/${id}/videos`);
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

export const getByGenre = async (genreId: string, page: number = 1, language?: string) =>
  tmdbCatalogList(
    'movie',
    '/discover/movie',
    { with_genres: genreId, sort_by: 'popularity.desc', page, language: toTMDBLanguage(language) },
    { sort: 'popular', genres: [genreId] }
  );

export type DiscoverSort = 'trending' | 'rating' | 'recent' | 'oldest';

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
  opts: { page?: number; genre?: string; year?: string; sort?: string } = {},
  language?: string,
) => {
  const page = Math.max(1, Number(opts.page) || 1);
  const sort = normalizeSort(opts.sort?.trim());
  const genre = opts.genre?.trim() || undefined;
  const year = opts.year?.trim() || undefined;
  const lang = toTMDBLanguage(language);

  // Tendance réelle TMDB tant qu'aucun filtre n'est appliqué.
  if (sort === 'trending' && !genre && !year) {
    return tmdbCatalogList(
      'movie',
      '/trending/movie/week',
      { page, language: lang },
      { sort: 'popular' }
    );
  }

  const params: Record<string, unknown> = {
    page,
    language: lang,
    sort_by: MOVIE_SORT_BY[sort],
    include_adult: false,
  };
  if (genre) params.with_genres = genre;
  if (year) params.primary_release_year = year;
  if (sort === 'rating') params['vote_count.gte'] = 200;

  return tmdbCatalogList('movie', '/discover/movie', params, {
    sort: CATALOG_SORT_OF[sort],
    genres: genre ? [genre] : undefined,
    year,
  });
};

export const getAfrican = async (page: number = 1, language?: string, country?: string) => {
  const originCountry = country || 'NG|GH|CM|CI|SN';
  const { data } = await tmdbClient.get('/discover/movie', {
    params: { 
      with_origin_country: originCountry, 
      sort_by: 'popularity.desc', 
      page, 
      language: toTMDBLanguage(language) 
    },
  });
  return applyCatalogFilterToPage('movie', data);
};

export const getDiscoverSmart = async (page: number = 1, language?: string) => {
  const lang = toTMDBLanguage(language);

  // Fetch top-rated recent films from TMDB /discover/movie
  const { data } = await tmdbClient.get('/discover/movie', {
    params: {
      page,
      language: lang,
      sort_by: 'vote_average.desc',
      'primary_release_date.gte': '2023-01-01',
      'vote_count.gte': 200,
      'vote_average.gte': 5,
      include_adult: false,
    },
  });

  const results: any[] = data.results || [];

  // Calculate composite score for each film
  const scored = results.map((movie: any) => {
    const rating = movie.vote_average || 0;
    const voteCount = movie.vote_count || 0;
    const releaseYear = movie.release_date
      ? new Date(movie.release_date).getFullYear()
      : 2020;

    const yearRecency = Math.min(1, Math.max(0, (2026 - releaseYear) / 2));
    const score =
      (rating / 10) * 0.4 +
      (Math.log10(voteCount + 1) / 3) * 0.3 +
      yearRecency * 0.3;

    return { ...movie, _score: parseFloat(score.toFixed(4)) };
  });

  // Sort by composite score descending
  scored.sort((a: any, b: any) => b._score - a._score);

  return applyCatalogFilterToPage('movie', {
    ...data,
    results: scored,
  });
};
