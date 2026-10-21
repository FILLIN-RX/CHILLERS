// Admin types extracted from inline declarations in admin pages.

export interface TmdbSearchResult {
  id: number;
  title?: string;
  name?: string;
  media_type: "movie" | "tv" | "person";
  original_title?: string;
  original_language?: string;
  genre_ids?: number[];
  overview?: string;
  year?: number | null;
  poster?: string | null;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  vote_average?: number;
}
