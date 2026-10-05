export interface StreamResult {
  provider: string;
  embedUrl: string;
  type: 'movie' | 'episode';
  directUrl?: string;
  directType?: 'mp4' | 'hls';
  downloadUrl?: string | null;
  quality?: string;
  language?: string;
  referer?: string;
}

export interface StreamQuery {
  tmdbId: number;
  type?: 'movie' | 'tv' | 'anime';
  title?: string;
  season?: number;
  episode?: number;
  language?: string;
  year?: number;
  isPremium?: boolean;
  strict1080p?: boolean;
}

export interface StreamingProvider {
  name: string;
  supports(query: StreamQuery): boolean;
  getMovieStream(query: StreamQuery): Promise<StreamResult | null>;
  getEpisodeStream(query: StreamQuery): Promise<StreamResult | null>;
}
