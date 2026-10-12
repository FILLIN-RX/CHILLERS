import { StreamingProvider, StreamQuery, StreamResult } from './provider.interface';
import {
  getAfrolandEpisodes,
  pickBestMatch,
  resolveAfrolandStream,
  searchAfrolandShows,
  searchAfrolandVideos,
} from '../../afroland/afroland.service';
import tmdbClient from '../../../config/tmdb';

/**
 * AfrolandTV — catalogue Afro/Nollywood (Kaltura) en accès libre.
 * Recherche par titre sur l'API Ottera puis lecture HLS/MP4 directe.
 * Correspondance de titre stricte : jamais de mauvais film.
 */
export class AfrolandProvider implements StreamingProvider {
  readonly name = 'afroland';

  supports(query: StreamQuery): boolean {
    return !!(query.title || query.tmdbId);
  }

  private async resolveTitles(query: StreamQuery, kind: 'movie' | 'tv'): Promise<string[]> {
    const list = [query.title, query.frenchTitle, query.originalTitle].filter(Boolean) as string[];
    if (list.length === 0 && query.tmdbId) {
      try {
        const endpoint = kind === 'tv' ? `/tv/${query.tmdbId}` : `/movie/${query.tmdbId}`;
        const { data } = await tmdbClient.get(`${endpoint}?language=${query.language || 'fr'}`);
        if (kind === 'tv') {
          if (data?.name) list.push(data.name);
          if (data?.original_name) list.push(data.original_name);
        } else {
          if (data?.title) list.push(data.title);
          if (data?.original_title) list.push(data.original_title);
        }
      } catch (_) {}
    }
    return [...new Set(list.map(t => t.trim()))];
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    const titles = await this.resolveTitles(query, 'movie');
    if (titles.length === 0) return null;

    try {
      for (const title of titles) {
        const candidates = await searchAfrolandVideos(title);
        const match = pickBestMatch(candidates, title);
        if (match) {
          const stream = await resolveAfrolandStream(match);
          if (stream) {
            console.log(`[Afroland] Flux ${stream.directType.toUpperCase()} pour "${title}" → "${match.name}": ${stream.url.slice(0, 80)}...`);

            return {
              provider: this.name,
              embedUrl: stream.url,
              directUrl: stream.url,
              directType: stream.directType,
              type: 'movie',
              language: 'en',
            };
          }
        }
      }
      return null;
    } catch (error: any) {
      console.error(`[Afroland] Erreur film [${titles.join(', ')}]:`, error.message);
      return null;
    }
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    const titles = await this.resolveTitles(query, 'tv');
    if (titles.length === 0) return null;

    const season = query.season || 1;
    const episode = query.episode || 1;

    try {
      for (const title of titles) {
        const shows = await searchAfrolandShows(title);
        const show = pickBestMatch(shows, title);
        if (show) {
          const episodes = await getAfrolandEpisodes(show.id);
          const target =
            episodes.find((e) => e.season === season && e.episode === episode) ||
            (episodes.length >= episode && season === 1 ? episodes[episode - 1] : undefined);
          if (target) {
            const stream = await resolveAfrolandStream(target);
            if (stream) {
              console.log(
                `[Afroland] Flux ${stream.directType.toUpperCase()} S${season}E${episode} → "${show.name}" / "${target.name}": ${stream.url.slice(0, 80)}...`
              );

              return {
                provider: this.name,
                embedUrl: stream.url,
                directUrl: stream.url,
                directType: stream.directType,
                type: 'episode',
                language: 'en',
              };
            }
          }
        }
      }
      return null;
    } catch (error: any) {
      console.error(`[Afroland] Erreur épisode [${titles.join(', ')}] S${season}E${episode}:`, error.message);
      return null;
    }
  }
}
