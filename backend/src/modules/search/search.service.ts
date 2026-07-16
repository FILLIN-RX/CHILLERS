import tmdbClient from '../../config/tmdb';
import { toTMDBLanguage } from '../../config/language';

export const searchMulti = async (query: string, page: number = 1, language?: string) => {
  const { data } = await tmdbClient.get('/search/multi', {
    params: { query, page, language: toTMDBLanguage(language) },
  });
  return data;
};
