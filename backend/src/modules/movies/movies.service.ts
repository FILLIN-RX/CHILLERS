import tmdbClient from '../../config/tmdb';
import { toTMDBLanguage } from '../../config/language';

export const getPopular = async (page: number = 1, language?: string) => {
  const { data } = await tmdbClient.get('/movie/popular', { params: { page, language: toTMDBLanguage(language) } });
  return data;
};

export const getTrending = async (language?: string) => {
  const { data } = await tmdbClient.get('/trending/movie/week', { params: { language: toTMDBLanguage(language) } });
  return data;
};

export const getUpcoming = async (page: number = 1, language?: string) => {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await tmdbClient.get('/discover/movie', {
    params: {
      page,
      language: toTMDBLanguage(language),
      'primary_release_date.gte': today,
      sort_by: 'popularity.desc',
      include_adult: false,
    },
  });
  return data;
};

export const getTopRated = async (page: number = 1, language?: string) => {
  const { data } = await tmdbClient.get('/movie/top_rated', { params: { page, language: toTMDBLanguage(language) } });
  return data;
};

export const getDetails = async (id: string, language?: string) => {
  try {
    const { data } = await tmdbClient.get(`/movie/${id}`, {
      params: { 
        append_to_response: 'credits,videos,release_dates,recommendations,similar', 
        language: toTMDBLanguage(language) 
      },
    });
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
  const { data } = await tmdbClient.get(`/movie/${id}/recommendations`, { params: { language: toTMDBLanguage(language) } });
  return data;
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

export const getByGenre = async (genreId: string, page: number = 1, language?: string) => {
  const { data } = await tmdbClient.get('/discover/movie', {
    params: { with_genres: genreId, sort_by: 'popularity.desc', page, language: toTMDBLanguage(language) },
  });
  return data;
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
  return data;
};
