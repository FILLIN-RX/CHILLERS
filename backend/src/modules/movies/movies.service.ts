import tmdbClient from '../../config/tmdb';

export const getPopular = async (page: number = 1) => {
  const { data } = await tmdbClient.get('/movie/popular', { params: { page } });
  return data;
};

export const getTrending = async () => {
  const { data } = await tmdbClient.get('/trending/movie/week');
  return data;
};

export const getUpcoming = async (page: number = 1) => {
  const { data } = await tmdbClient.get('/movie/upcoming', { params: { page } });
  return data;
};

export const getTopRated = async (page: number = 1) => {
  const { data } = await tmdbClient.get('/movie/top_rated', { params: { page } });
  return data;
};

export const getDetails = async (id: string) => {
  const { data } = await tmdbClient.get(`/movie/${id}`, {
    params: { append_to_response: 'credits,videos' },
  });
  return data;
};

export const getRecommendations = async (id: string) => {
  const { data } = await tmdbClient.get(`/movie/${id}/recommendations`);
  return data;
};

export const getTrailer = async (id: string) => {
  const { data } = await tmdbClient.get(`/movie/${id}/videos`);
  const results = data.results || [];
  const trailer = results.find(
    (v: any) => v.site === 'YouTube' && v.type === 'Trailer' && v.official === true
  );
  return trailer || results.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer') || null;
};

export const getByGenre = async (genreId: string, page: number = 1) => {
  const { data } = await tmdbClient.get('/discover/movie', {
    params: { with_genres: genreId, sort_by: 'popularity.desc', page },
  });
  return data;
};
