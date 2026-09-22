import { StreamingProvider, StreamQuery, StreamResult } from './provider.interface';
import { getFlemmixMovie, getFlemmixEpisode } from '../../modules/flemmix/flemmix.service';
import tmdbClient from '../../config/tmdb';

export class FlemmixProvider implements StreamingProvider {
  readonly name = 'flemmix';

  supports(query: StreamQuery): boolean {
    return !!(query.title || query.tmdbId);
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    let movieTitle = query.title;

    if (!movieTitle && query.tmdbId) {
      try {
        const { data } = await tmdbClient.get(`/movie/${query.tmdbId}?language=${query.language || 'fr'}`);
        movieTitle = data?.title || data?.original_title;
      } catch (_) {}
    }

    if (!movieTitle) return null;

    console.log(`[Flemmix Provider] Recherche film: "${movieTitle}"`);
    const result = await getFlemmixMovie(movieTitle);

    if (result?.bestStream?.url) {
      console.log(
        `[Flemmix Provider] Stream trouvé (${result.bestStream.name} / ${result.bestStream.lang}): ${result.bestStream.url.slice(0, 80)}...`
      );
      return {
        provider: this.name,
        embedUrl: result.bestStream.url,
        type: 'movie',
      };
    }

    return null;
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    let seriesTitle = query.title;

    if (!seriesTitle && query.tmdbId) {
      try {
        const { data } = await tmdbClient.get(`/tv/${query.tmdbId}?language=${query.language || 'fr'}`);
        seriesTitle = data?.name || data?.original_name;
      } catch (_) {}
    }

    if (!seriesTitle) return null;

    const season = query.season || 1;
    const episode = query.episode || 1;

    console.log(`[Flemmix Provider] Recherche série: "${seriesTitle}" S${season}E${episode}`);
    const result = await getFlemmixEpisode(seriesTitle, season, episode);

    if (result?.bestStream?.url) {
      console.log(
        `[Flemmix Provider] Stream série trouvé (${result.bestStream.name} / ${result.bestStream.lang}): ${result.bestStream.url.slice(0, 80)}...`
      );
      return {
        provider: this.name,
        embedUrl: result.bestStream.url,
        type: 'episode',
      };
    }

    return null;
  }
}
