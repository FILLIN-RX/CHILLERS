// Shared types for media (movies, series, anime).
// Migrated from src/app/mockData.ts as part of the architecture refactor.

export type MediaType = "movie" | "series" | "anime" | "documentary";

export interface Episode {
  id: string;
  title: string;
  duration: string;
  number: number;
  season?: number;
  thumbnail: string;
  synopsis: string;
}

export interface Season {
  id: string;
  name: string;
  seasonNumber: number;
  posterUrl: string;
  /** from TMDB episode_count field */
  episodeCount?: number;
  /** from TMDB air_date field (YYYY-MM-DD or null) */
  airDate?: string;
  episodes: Episode[];
}

export interface MovieOrShow {
  id: string;
  title: string;
  type: MediaType;
  description: string;
  synopsis: string;
  backdropUrl: string;
  backdropOriginalUrl?: string;
  posterUrl: string;
  rating: number;
  year: number;
  /** e.g. "2h 15m" or "10 Episodes" */
  duration: string;
  genres: string[];
  cast: string[];
  isTrending?: boolean;
  isPopular?: boolean;
  videoUrl?: string;
  trailerUrl?: string;
  seasons?: Season[];
}

export interface Genre {
  id: number;
  name: string;
}

export interface StreamResult {
  /** The embeddable URL (iframe src for VidLink/DoodStream/YouTube, or direct .mp4/.m3u8) */
  embedUrl: string;
  /** Which provider resolved the link (vidlink, doodstream, vidzy, ...) */
  provider: string;
}

export interface MediaDetails extends MovieOrShow {
  /** Full enriched details (TMDB complete payload). Subset of MovieOrShow for now. */
}

export interface SearchResults {
  movies: MovieOrShow[];
  series: MovieOrShow[];
  total: number;
}

export interface PaginatedMedia {
  items: MovieOrShow[];
  page: number;
  totalPages: number;
  totalResults: number;
}

export interface SeasonDetails {
  id: number;
  name: string;
  season_number: number;
  poster_path?: string | null;
  overview?: string;
  episodes?: Array<{
    id: number;
    name: string;
    episode_number: number;
    runtime?: number;
    still_path?: string | null;
    overview?: string;
  }>;
}