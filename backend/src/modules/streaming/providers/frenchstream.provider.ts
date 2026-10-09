import { StreamingProvider, StreamQuery, StreamResult } from './provider.interface';
import { getFrenchStreamMovie, getFrenchStreamEpisode } from '../../frenchstream/frenchstream.service';
import { DirectScraper } from './direct-scraper';
import tmdbClient from '../../../config/tmdb';
import Movie from '../../../models/Movie';
import Serie from '../../../models/Serie';

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
    let originalTitle = query.originalTitle;

    // Si le titre ou l'année n'a pas été envoyé, le récupérer via l'API TMDB
    let year = query.year;
    if ((!movieTitle || !year || !originalTitle) && query.tmdbId) {
      try {
        const { data } = await tmdbClient.get(`/movie/${query.tmdbId}?language=${query.language || 'fr'}`);
        if (!movieTitle) movieTitle = data?.title || data?.original_title;
        if (!originalTitle && data?.original_title) originalTitle = data.original_title;
        if (!year && data?.release_date) {
          const y = new Date(data.release_date).getFullYear();
          if (!isNaN(y)) year = y;
        }
      } catch (_) {}
    }

    if (!movieTitle) return null;

    // Recherche d'une page source connue mémorisée dans MongoDB
    let knownPagePath: string | undefined;
    let existingMovie: any = null;
    try {
      existingMovie = await Movie.findOne(
        query.tmdbId ? { tmdbId: query.tmdbId } : { titre: new RegExp(`^${movieTitle.trim()}$`, 'i') }
      ).select('_id providerPages');
      
      const matchedPage = existingMovie?.providerPages?.find(
        (p: any) => p.provider === this.name && (!p.language || p.language === (query.language || 'fr')) && p.isWorking !== false
      );
      if (matchedPage?.path) {
        knownPagePath = matchedPage.path;
      }
    } catch (_) {}

    console.log(`[FrenchStream Provider] Recherche film 1080p pour: "${movieTitle}" (year=${year || 'non spécifiée'}, lang=${query.language || 'fr'}, directPage=${knownPagePath || 'aucune'})`);
    const result = await getFrenchStreamMovie(movieTitle, (query.language as any) || 'fr', year, knownPagePath, originalTitle);

    if (result?.streamUrl) {
      console.log(`[FrenchStream Provider] Flux 1080p trouvé: ${result.streamUrl.slice(0, 80)}... (${result.fileSize})`);
      
      // Mémoriser la page source dans MongoDB pour les futures requêtes
      if (result.pagePath && (existingMovie || query.tmdbId)) {
        const lang = query.language || 'fr';
        const filter = existingMovie?._id ? { _id: existingMovie._id } : { tmdbId: query.tmdbId };
        Movie.updateOne(
          filter,
          {
            $pull: { providerPages: { provider: this.name, language: lang } },
          }
        ).then(() => {
          return Movie.updateOne(
            filter,
            {
              $push: {
                providerPages: {
                  provider: this.name,
                  path: result.pagePath,
                  language: lang,
                  lastScrapedAt: new Date(),
                  isWorking: true,
                },
              },
            }
          );
        }).catch((err) => {
          console.warn(`[FrenchStream Provider] Erreur sauvegarde providerPages film:`, err.message);
        });
      }

      let directStreamUrl = result.streamUrl;
      let directType: 'mp4' | 'hls' = /\.(m3u8)/i.test(result.streamUrl) ? 'hls' : 'mp4';
      if (!/\.(mp4|webm|mkv|m3u8)(\?|$)/i.test(result.streamUrl)) {
        try {
          const directRes = await DirectScraper.resolve(result.streamUrl);
          if (directRes?.directUrl) {
            directStreamUrl = directRes.directUrl;
            directType = directRes.type === 'hls' ? 'hls' : 'mp4';
          }
        } catch (_) {}
      }

      const isDirectStream = /\.(mp4|webm|mkv|m3u8)(\?|$)/i.test(directStreamUrl) || /u\d+\.vidzy\.cc/i.test(directStreamUrl);
      const referer = getRefererForStreamUrl(directStreamUrl);

      return {
        provider: this.name,
        // L'URL directe est renvoyée brute : le lecteur proxy le HLS via
        // /api/live/proxy (le backend ne sert pas de proxy /api/doodstream/stream).
        embedUrl: directStreamUrl,
        directUrl: directStreamUrl,
        directType: isDirectStream ? directType : undefined,
        referer: isDirectStream ? referer : undefined,
        type: 'movie',
      };
    }

    return null;
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    let seriesTitle = query.title;
    let originalTitle = query.originalTitle;

    // Si le titre n'a pas été envoyé, le récupérer via l'API TMDB
    if ((!seriesTitle || !originalTitle) && query.tmdbId) {
      try {
        const { data } = await tmdbClient.get(`/tv/${query.tmdbId}?language=${query.language || 'fr'}`);
        if (!seriesTitle) seriesTitle = data?.name || data?.original_name;
        if (!originalTitle && data?.original_name) originalTitle = data.original_name;
      } catch (_) {}
    }

    if (!seriesTitle) return null;

    const season = query.season || 1;
    const episode = query.episode || 1;

    // Recherche d'une page source connue pour cette série / saison
    let knownPagePath: string | undefined;
    let existingSerie: any = null;
    try {
      existingSerie = await Serie.findOne(
        query.tmdbId ? { tmdbId: query.tmdbId } : { titre: new RegExp(`^${seriesTitle.trim()}$`, 'i') }
      ).select('_id providerPages episodes');

      const matchedPage = existingSerie?.providerPages?.find(
        (p: any) => p.provider === this.name && (!p.season || p.season === season) && (!p.language || p.language === (query.language || 'fr')) && p.isWorking !== false
      );
      if (matchedPage?.path) {
        knownPagePath = matchedPage.path;
      }
    } catch (_) {}

    console.log(`[FrenchStream Provider] Recherche série 1080p pour: "${seriesTitle}" S${season}E${episode} (lang=${query.language || 'fr'}, directPage=${knownPagePath || 'aucune'})`);
    const result = await getFrenchStreamEpisode(seriesTitle, season, episode, (query.language as any) || 'fr', knownPagePath, originalTitle);

    if (result?.streamUrl) {
      console.log(`[FrenchStream Provider] Flux série 1080p trouvé: ${result.streamUrl.slice(0, 80)}... (${result.fileSize})`);
      
      // Mémoriser la page source dans MongoDB
      if (result.pagePath && (existingSerie || query.tmdbId)) {
        const lang = query.language || 'fr';
        const filter = existingSerie?._id ? { _id: existingSerie._id } : { tmdbId: query.tmdbId };
        Serie.updateOne(
          filter,
          {
            $pull: { providerPages: { provider: this.name, season, language: lang } },
          }
        ).then(() => {
          return Serie.updateOne(
            filter,
            {
              $push: {
                providerPages: {
                  provider: this.name,
                  path: result.pagePath,
                  season,
                  language: lang,
                  lastScrapedAt: new Date(),
                  isWorking: true,
                },
              },
            }
          );
        }).catch((err) => {
          console.warn(`[FrenchStream Provider] Erreur sauvegarde providerPages série:`, err.message);
        });
      }

      let directStreamUrl = result.streamUrl;
      let directType: 'mp4' | 'hls' = /\.(m3u8)/i.test(result.streamUrl) ? 'hls' : 'mp4';
      if (!/\.(mp4|webm|mkv|m3u8)(\?|$)/i.test(result.streamUrl)) {
        try {
          const directRes = await DirectScraper.resolve(result.streamUrl);
          if (directRes?.directUrl) {
            directStreamUrl = directRes.directUrl;
            directType = directRes.type === 'hls' ? 'hls' : 'mp4';
          }
        } catch (_) {}
      }

      const isDirectStream = /\.(mp4|webm|mkv|m3u8)(\?|$)/i.test(directStreamUrl) || /u\d+\.vidzy\.cc/i.test(directStreamUrl);
      const referer = getRefererForStreamUrl(directStreamUrl);

      return {
        provider: this.name,
        // L'URL directe est renvoyée brute : le lecteur proxy le HLS via
        // /api/live/proxy (le backend ne sert pas de proxy /api/doodstream/stream).
        embedUrl: directStreamUrl,
        directUrl: directStreamUrl,
        directType: isDirectStream ? directType : undefined,
        referer: isDirectStream ? referer : undefined,
        type: 'episode',
      };
    }

    return null;
  }
}
