import tmdbClient from '../../config/tmdb';

export const getMovieGenres = async () => {
  const { data } = await tmdbClient.get('/genre/movie/list');
  return data.genres;
};

export const getTvGenres = async () => {
  const { data } = await tmdbClient.get('/genre/tv/list');
  return data.genres;
};
