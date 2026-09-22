import { StreamingProvider, StreamQuery, StreamResult } from './provider.interface';
import { getFrenchStreamMovie, getFrenchStreamEpisode } from '../../modules/frenchstream/frenchstream.service';
import tmdbClient from '../../config/tmdb';

function getRefererForStreamUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('vidzy')) return 'https://vidzy.cc/';
    if (parsed.hostname.includes('uqload')) return 'https://uqload.is/';
    if (parsed.hostname.includes('dood') || parsed.hostname.includes('playmogo') || parsed.hostname.includes('d000')) return 'https://doodstream.com/';
    if (parsed.hostname.includes('streamtape')) return 'https://streamtape.com/';
    if (parsed.hostname.includes('voe')) return 'https://voe.sx/';
    if (parsed.hostname.includes('luluv')) return 'https://luluvdo.com/';
    return `${parsed.protocol}//${parsed.host}/`;
  } catch {
    return 'https://french-stream.net/';
  }
}

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
      const isDirectStream = /\.(mp4|webm|mkv|m3u8)(\?|$)/i.test(result.streamUrl) || /u\d+\.vidzy\.cc/i.test(result.streamUrl);
      const referer = getRefererForStreamUrl(result.streamUrl);
      const streamUrl = isDirectStream
        ? `/api/doodstream/stream?url=${encodeURIComponent(result.streamUrl)}&referer=${encodeURIComponent(referer)}`
        : result.streamUrl;

      return {
        provider: this.name,
        embedUrl: streamUrl,
        directUrl: result.streamUrl,
        directType: /\.(m3u8)/i.test(result.streamUrl) ? 'hls' : 'mp4',
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
      const isDirectStream = /\.(mp4|webm|mkv|m3u8)(\?|$)/i.test(result.streamUrl) || /u\d+\.vidzy\.cc/i.test(result.streamUrl);
      const referer = getRefererForStreamUrl(result.streamUrl);
      const streamUrl = isDirectStream
        ? `/api/doodstream/stream?url=${encodeURIComponent(result.streamUrl)}&referer=${encodeURIComponent(referer)}`
        : result.streamUrl;

      return {
        provider: this.name,
        embedUrl: streamUrl,
        directUrl: result.streamUrl,
        directType: /\.(m3u8)/i.test(result.streamUrl) ? 'hls' : 'mp4',
        type: 'episode',
      };
    }

    return null;
  }
}
