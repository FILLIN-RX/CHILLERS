import tmdbClient from '../../config/tmdb';

export const searchMulti = async (query: string, page: number = 1) => {
  const { data } = await tmdbClient.get('/search/multi', {
    params: { query, page },
  });
  return data;
};
