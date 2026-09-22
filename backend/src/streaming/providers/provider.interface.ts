export interface StreamResult {
  provider: string;
  embedUrl: string;
  type: 'movie' | 'episode';
  /** URL directe MP4 ou HLS extraite du scrape (optionnelle). Utilisée pour le téléchargement sans 2ème scrape. */
  directUrl?: string;
  /** Type du lien direct : 'mp4' | 'hls' */
  directType?: 'mp4' | 'hls';
}

export interface StreamQuery {
  tmdbId: number;
  type?: 'movie' | 'tv' | 'anime';
  title?: string;
  originalTitle?: string;
  releaseDate?: string;
  year?: number;
  season?: number;
  episode?: number;
  language?: string;
  isPremium?: boolean;
}

export interface StreamingProvider {
  name: string;
  supports(query: StreamQuery): boolean;
  getMovieStream(query: StreamQuery): Promise<StreamResult | null>;
  getEpisodeStream(query: StreamQuery): Promise<StreamResult | null>;
}
