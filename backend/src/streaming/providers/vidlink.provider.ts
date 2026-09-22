import { StreamingProvider, StreamQuery, StreamResult } from './provider.interface';

const BASE_URL = 'https://vidlink.pro';

export class VidLinkProvider implements StreamingProvider {
  readonly name = 'vidlink';

  supports(query: StreamQuery): boolean {
    return Boolean(query.tmdbId && query.tmdbId > 0);
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    if (!this.supports(query)) return null;
    const embedUrl = `${BASE_URL}/movie/${query.tmdbId}?primaryColor=D70466&autoplay=false`;
    return {
      provider: this.name,
      embedUrl,
      type: 'movie',
    };
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    if (!this.supports(query)) return null;
    const season = query.season || 1;
    const episode = query.episode || 1;
    const embedUrl = `${BASE_URL}/tv/${query.tmdbId}/${season}/${episode}?primaryColor=D70466&autoplay=false`;
    return {
      provider: this.name,
      embedUrl,
      type: 'episode',
    };
  }
}
