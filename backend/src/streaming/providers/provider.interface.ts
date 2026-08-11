export interface StreamResult {
  provider: string;
  embedUrl: string;
  /** URL same-origin du téléchargement direct (proxy TorrServer), si le provider l'expose. */
  downloadUrl?: string;
  type: 'movie' | 'episode';
}

export interface StreamQuery {
  tmdbId: number;
  type?: 'movie' | 'tv' | 'anime';
  title?: string;
  season?: number;
  episode?: number;
  language?: string;
}

export interface StreamingProvider {
  name: string;
  supports(query: StreamQuery): boolean;
  getMovieStream(query: StreamQuery): Promise<StreamResult | null>;
  getEpisodeStream(query: StreamQuery): Promise<StreamResult | null>;
}
