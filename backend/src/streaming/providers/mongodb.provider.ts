import { StreamingProvider, StreamResult, StreamQuery } from './provider.interface';
import Movie from '../../models/Movie';
import Serie from '../../models/Serie';

function toEmbedUrl(url: string, uqloadLink?: string): string {
  if (uqloadLink) return uqloadLink;
  const match = url.match(/doodstream\.com\/(?:d|e)\/([a-zA-Z0-9]+)/);
  if (match) return `https://doodstream.com/e/${match[1]}`;
  return url;
}

export class MongoDBProvider implements StreamingProvider {
  readonly name = 'mongodb';

  supports(_query: StreamQuery): boolean {
    return true;
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    try {
      const movie = await Movie.findOne({
        $or: [
          ...(query.tmdbId ? [{ tmdbId: query.tmdbId }] : []),
          ...(query.title ? [{ titre: { $regex: new RegExp(query.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }] : []),
        ],
      }).exec();

      if (movie?.lien && movie.lien !== '#') {
        return { provider: this.name, embedUrl: toEmbedUrl(movie.lien, movie.uqloadLink), type: 'movie' };
      }
    } catch (err) {
      console.error('[MongoDB] getMovieStream error:', err);
    }
    return null;
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    if (query.season === undefined || query.episode === undefined) return null;

    try {
      const serie = await Serie.findOne({
        $or: [
          ...(query.tmdbId ? [{ tmdbId: query.tmdbId }] : []),
          ...(query.title ? [{ titre: { $regex: new RegExp(query.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }] : []),
        ],
      }).exec();

      if (serie) {
        const ep = serie.episodes.find(
          (e: any) => e.season === query.season && e.episodeNumber === query.episode
        );
        if (ep?.lien && ep.lien !== '#') {
          return { provider: this.name, embedUrl: toEmbedUrl(ep.lien, ep.uqloadLink), type: 'episode' };
        }
      }
    } catch (err) {
      console.error('[MongoDB] getEpisodeStream error:', err);
    }
    return null;
  }
}
