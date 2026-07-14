export interface Episode {
  id: string;
  title: string;
  duration: string;
  number: number;
  thumbnail: string;
  synopsis: string;
}

export interface Season {
  id: string;
  name: string;
  seasonNumber: number;
  posterUrl: string;
  episodes: Episode[];
}

export interface MovieOrShow {
  id: string;
  title: string;
  type: 'movie' | 'series' | 'anime' | 'documentary';
  description: string;
  synopsis: string;
  backdropUrl: string;
  posterUrl: string;
  rating: number;
  year: number;
  duration: string; // e.g. "2h 15m" or "10 Episodes"
  genres: string[];
  cast: string[];
  isTrending?: boolean;
  isPopular?: boolean;
  videoUrl?: string;
  seasons?: Season[];
}
