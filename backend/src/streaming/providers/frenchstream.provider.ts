import { StreamingProvider, StreamQuery, StreamResult } from './provider.interface';
import { getFrenchStreamMovie, getFrenchStreamEpisode } from '../../modules/frenchstream/frenchstream.service';
import tmdbClient from '../../config/tmdb';

export class FrenchStreamProvider implements StreamingProvider {
  readonly name = 'frenchstream';

  supports(query: StreamQuery): boolean {
    return !!(query.title || query.tmdbId);
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    let movieTitle = query.title;

    // Si le titre n'a pas été envoyé, le récupérer via l'API TMDB
    if (!movieTitle && query.tmdbId) {
      try {
        const { data } = await tmdbClient.get(`/movie/${query.tmdbId}?language=${query.language || 'fr'}`);
        movieTitle = data?.title || data?.original_title;
      } catch (_) {}
    }

    if (!movieTitle) return null;

    console.log(`[FrenchStream Provider] Recherche film 1080p pour: "${movieTitle}" (isPremium=${!!query.isPremium})`);
    const result = await getFrenchStreamMovie(movieTitle);

    if (result?.streamUrl) {
      console.log(`[FrenchStream Provider] Flux 1080p trouvé: ${result.streamUrl.slice(0, 80)}... (${result.fileSize})`);
      return {
        provider: this.name,
        embedUrl: result.streamUrl,
        type: 'movie',
      };
    }

    return null;
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    let seriesTitle = query.title;

    // Si le titre n'a pas été envoyé, le récupérer via l'API TMDB
    if (!seriesTitle && query.tmdbId) {
      try {
        const { data } = await tmdbClient.get(`/tv/${query.tmdbId}?language=${query.language || 'fr'}`);
        seriesTitle = data?.name || data?.original_name;
      } catch (_) {}
    }

    if (!seriesTitle) return null;

    const season = query.season || 1;
    const episode = query.episode || 1;

    console.log(`[FrenchStream Provider] Recherche série 1080p pour: "${seriesTitle}" S${season}E${episode} (isPremium=${!!query.isPremium})`);
    const result = await getFrenchStreamEpisode(seriesTitle, season, episode);

    if (result?.streamUrl) {
      console.log(`[FrenchStream Provider] Flux série 1080p trouvé: ${result.streamUrl.slice(0, 80)}... (${result.fileSize})`);
      return {
        provider: this.name,
        embedUrl: result.streamUrl,
        type: 'episode',
      };
    }

    return null;
  }
}
