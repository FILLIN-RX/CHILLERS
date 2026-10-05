import { StreamingProvider, StreamQuery, StreamResult } from './provider.interface';

const BASE_URL = 'https://vidlink.pro';

/**
 * VidLink — lecteur iframe TMDB (film/épisode). Aucune URL directe exploitable :
 * c'est un fallback de dernier recours avant le P2P, le temps que les autres
 * providers aient échoué. validateUrl() le skippe (isIframeEmbedUrl).
 */
export class VidLinkProvider implements StreamingProvider {
  readonly name = 'vidlink';

  supports(query: StreamQuery): boolean {
    return Boolean(query.tmdbId && query.tmdbId > 0);
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    if (!query.tmdbId) return null;
    return {
      provider: this.name,
      embedUrl: `${BASE_URL}/movie/${query.tmdbId}?primaryColor=D70466&autoplay=false`,
      type: 'movie',
    };
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    if (!query.tmdbId) return null;
    const season = query.season || 1;
    const episode = query.episode || 1;
    return {
      provider: this.name,
      embedUrl: `${BASE_URL}/tv/${query.tmdbId}/${season}/${episode}?primaryColor=D70466&autoplay=false`,
      type: 'episode',
    };
  }
}
