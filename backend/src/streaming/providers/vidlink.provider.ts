import { StreamingProvider, StreamResult, StreamQuery } from './provider.interface';

const BASE_URL = 'https://vidlink.pro';
const PARAMS = 'primaryColor=D70466&autoplay=false';

export class VidLinkProvider implements StreamingProvider {
  readonly name = 'vidlink';

  supports(_query: StreamQuery): boolean {
    return true;
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    const embedUrl = `${BASE_URL}/movie/${query.tmdbId}?${PARAMS}`;
    return { provider: this.name, embedUrl, type: 'movie' };
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    const embedUrl = `${BASE_URL}/tv/${query.tmdbId}/${query.season || 1}/${query.episode || 1}?${PARAMS}`;
    return { provider: this.name, embedUrl, type: 'episode' };
  }
}
