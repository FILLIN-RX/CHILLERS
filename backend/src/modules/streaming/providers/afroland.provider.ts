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

  private async resolveTitle(query: StreamQuery, kind: 'movie' | 'tv'): Promise<string | undefined> {
    if (query.title) return query.title;
    if (!query.tmdbId) return undefined;
    try {
      const endpoint = kind === 'tv' ? `/tv/${query.tmdbId}` : `/movie/${query.tmdbId}`;
      const { data } = await tmdbClient.get(`${endpoint}?language=${query.language || 'fr'}`);
      return (kind === 'tv' ? data?.name || data?.original_name : data?.title || data?.original_title) || undefined;
    } catch (_) {
      return undefined;
    }
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    const title = await this.resolveTitle(query, 'movie');
    if (!title) return null;

    try {
      const candidates = await searchAfrolandVideos(title);
      const match = pickBestMatch(candidates, title);
      if (!match) return null;

      const stream = await resolveAfrolandStream(match);
      if (!stream) return null;

      console.log(`[Afroland] Flux ${stream.directType.toUpperCase()} pour "${title}" → "${match.name}": ${stream.url.slice(0, 80)}...`);

      return {
        provider: this.name,
        embedUrl: stream.url,
        directUrl: stream.url,
        directType: stream.directType,
        type: 'movie',
        language: 'en',
      };
    } catch (error: any) {
      console.error(`[Afroland] Erreur film "${title}":`, error.message);
      return null;
    }
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    const title = await this.resolveTitle(query, 'tv');
    if (!title) return null;

    const season = query.season || 1;
    const episode = query.episode || 1;

    try {
      const shows = await searchAfrolandShows(title);
      const show = pickBestMatch(shows, title);
      if (!show) return null;

      const episodes = await getAfrolandEpisodes(show.id);
      const target =
        episodes.find((e) => e.season === season && e.episode === episode) ||
        (episodes.length >= episode && season === 1 ? episodes[episode - 1] : undefined);
      if (!target) return null;

      const stream = await resolveAfrolandStream(target);
      if (!stream) return null;

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
    } catch (error: any) {
      console.error(`[Afroland] Erreur épisode "${title}" S${season}E${episode}:`, error.message);
      return null;
    }
  }
}
