import { StreamingProvider, StreamQuery, StreamResult } from './provider.interface';
import { searchFawesome } from '../../fawesome/fawesome.service';
import tmdbClient from '../../../config/tmdb';

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Fawesome TV — API interne (mp4 + hls Cachefly) : renvoie des URLs directes,
 * aucun embed à scraper. Le catalogue est partiel et la recherche très souple :
 * on n'accepte que la correspondance de titre 100 % stricte pour ne jamais
 * servir le mauvais film. Catalogue films uniquement.
 */
export class FawesomeProvider implements StreamingProvider {
  readonly name = 'fawesome';

  supports(query: StreamQuery): boolean {
    return !!(query.title || query.tmdbId) && !query.season;
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    let title = query.title;

    if (!title && query.tmdbId) {
      try {
        const { data } = await tmdbClient.get(`/movie/${query.tmdbId}?language=${query.language || 'fr'}`);
        title = data?.title || data?.original_title;
      } catch (_) {}
    }

    if (!title) return null;

    try {
      const results = await searchFawesome(title, 'movie');
      const target = normalize(title);
      const match = results.find((r) => normalize(r.title) === target);

      if (!match) {
        console.log(`[Fawesome] Pas de correspondance exacte pour "${title}" (${results.length} résultats écartés)`);
        return null;
      }

      const url = match.mp4Url || match.hlsUrl;
      if (!url) return null;

      const directType: 'mp4' | 'hls' = match.mp4Url ? 'mp4' : 'hls';
      console.log(`[Fawesome] Flux ${directType.toUpperCase()} trouvé pour "${title}": ${url.slice(0, 80)}...`);

      return {
        provider: this.name,
        embedUrl: url,
        directUrl: url,
        directType,
        type: 'movie',
      };
    } catch (error: any) {
      console.error(`[Fawesome] Erreur film "${title}":`, error.message);
      return null;
    }
  }

  async getEpisodeStream(_query: StreamQuery): Promise<StreamResult | null> {
    // Catalogue films uniquement : aucun appel réseau.
    return null;
  }
}
