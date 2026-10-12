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
    const titlesToTry = [
      query.originalTitle,
      query.title,
      query.frenchTitle
    ].filter(Boolean) as string[];

    if (titlesToTry.length === 0 && query.tmdbId) {
      try {
        const { data } = await tmdbClient.get(`/movie/${query.tmdbId}?language=${query.language || 'fr'}`);
        if (data?.original_title) titlesToTry.push(data.original_title);
        if (data?.title) titlesToTry.push(data.title);
      } catch (_) {}
    }

    const uniqueTitles = [...new Set(titlesToTry.map(t => t.trim()))];
    if (uniqueTitles.length === 0) return null;

    try {
      for (const t of uniqueTitles) {
        const results = await searchFawesome(t, 'movie');
        const target = normalize(t);
        const match = results.find((r) => normalize(r.title) === target);

        if (match) {
          const url = match.mp4Url || match.hlsUrl;
          if (url) {
            const directType: 'mp4' | 'hls' = match.mp4Url ? 'mp4' : 'hls';
            console.log(`[Fawesome] Flux ${directType.toUpperCase()} trouvé pour "${t}": ${url.slice(0, 80)}...`);

            return {
              provider: this.name,
              embedUrl: url,
              directUrl: url,
              directType,
              type: 'movie',
            };
          }
        }
      }

      console.log(`[Fawesome] Pas de correspondance exacte pour [${uniqueTitles.join(', ')}]`);
      return null;
    } catch (error: any) {
      console.error(`[Fawesome] Erreur film [${uniqueTitles.join(', ')}]:`, error.message);
      return null;
    }
  }

  async getEpisodeStream(_query: StreamQuery): Promise<StreamResult | null> {
    // Catalogue films uniquement : aucun appel réseau.
    return null;
  }
}
