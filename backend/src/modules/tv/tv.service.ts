import tmdbClient from '../../config/tmdb';

export const getPopular = async (page: number = 1) => {
  const { data } = await tmdbClient.get('/tv/popular', { params: { page } });
  return data;
};

export const getTrending = async () => {
  const { data } = await tmdbClient.get('/trending/tv/week');
  return data;
};

export const getDetails = async (id: string) => {
  const { data } = await tmdbClient.get(`/tv/${id}`, {
    params: { append_to_response: 'credits,videos' },
  });
  return data;
};
