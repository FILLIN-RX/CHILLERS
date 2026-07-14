import { StreamingProvider, StreamResult, StreamQuery } from './provider.interface';

const BASE_URL = 'https://vidlink.pro';
const BASE_PARAMS = {
  primaryColor: 'D70466',
  autoplay: 'false',
  icons: 'vid',
};

export class VidLinkProvider implements StreamingProvider {
  readonly name = 'vidlink';

  supports(query: StreamQuery): boolean {
    return query.type !== 'anime';
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    const params = new URLSearchParams({ ...BASE_PARAMS });
    const embedUrl = `${BASE_URL}/movie/${query.tmdbId}?${params.toString()}`;
    return { provider: this.name, embedUrl, type: 'movie' };
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    const params = new URLSearchParams({ 
      ...BASE_PARAMS,
      nextbutton: 'true' 
    });
    const embedUrl = `${BASE_URL}/tv/${query.tmdbId}/${query.season || 1}/${query.episode || 1}?${params.toString()}`;
    return { provider: this.name, embedUrl, type: 'episode' };
  }
}
