import { StreamingProvider, StreamResult, StreamQuery } from './provider.interface';

const BASE_URL = 'https://vidlink.pro/embed';

export class VidLinkProvider implements StreamingProvider {
  readonly name = 'vidlink';

  supports(_query: StreamQuery): boolean {
    return true;
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    const embedUrl = `${BASE_URL}/movie/${query.tmdbId}`;
    return { provider: this.name, embedUrl, type: 'movie' };
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    const embedUrl = `${BASE_URL}/tv/${query.tmdbId}/${query.season || 1}/${query.episode || 1}`;
    return { provider: this.name, embedUrl, type: 'episode' };
  }
}
