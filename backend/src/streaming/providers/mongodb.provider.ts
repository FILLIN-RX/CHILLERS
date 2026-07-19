import { StreamingProvider, StreamResult, StreamQuery } from './provider.interface';
import Movie from '../../models/Movie';
import Serie from '../../models/Serie';
import DeadLink from '../../models/DeadLink';

function toEmbedUrl(lien: string): string {
  const match = lien.match(/doodstream\.com\/(?:d|e)\/([a-zA-Z0-9]+)/);
  if (match) return `https://doodstream.com/e/${match[1]}`;
  return lien;
}

async function isDead(lien: string): Promise<boolean> {
  try {
    return !!(await DeadLink.findOne({ lien }).select('_id').lean());
  } catch {
    return false;
  }
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

      if (!movie?.lien || movie.lien === '#') return null;
      if (await isDead(movie.lien)) return null;
      return { provider: this.name, embedUrl: toEmbedUrl(movie.lien), type: 'movie' };
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

      if (!serie) return null;

      const ep = serie.episodes.find(
        (e: any) => Number(e.season) === Number(query.season) && Number(e.episodeNumber) === Number(query.episode)
      );
      if (!ep?.lien || ep.lien === '#') return null;
      if (await isDead(ep.lien)) return null;
      return { provider: this.name, embedUrl: toEmbedUrl(ep.lien), type: 'episode' };
    } catch (err) {
      console.error('[MongoDB] getEpisodeStream error:', err);
    }
    return null;
  }
}
