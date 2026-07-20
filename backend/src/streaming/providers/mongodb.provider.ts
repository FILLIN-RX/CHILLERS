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

      if (!movie) return null;

      let embedUrl = '';
      if (movie.uqloadLink && movie.uqloadLink !== '#') {
        const dead = await isDead(movie.uqloadLink);
        if (!dead) {
          embedUrl = toEmbedUrl(movie.uqloadLink);
        }
      }

      if (!embedUrl && movie.lien && movie.lien !== '#') {
        const dead = await isDead(movie.lien);
        if (!dead) {
          embedUrl = toEmbedUrl(movie.lien);
        }
      }

      if (!embedUrl) return null;

      return { provider: this.name, embedUrl, type: 'movie' };
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

      if (!ep) return null;

      let embedUrl = '';
      if (ep.uqloadLink && ep.uqloadLink !== '#') {
        const dead = await isDead(ep.uqloadLink);
        if (!dead) {
          embedUrl = toEmbedUrl(ep.uqloadLink);
        }
      }

      if (!embedUrl && ep.lien && ep.lien !== '#') {
        const dead = await isDead(ep.lien);
        if (!dead) {
          embedUrl = toEmbedUrl(ep.lien);
        }
      }

      if (!embedUrl) return null;

      return { provider: this.name, embedUrl, type: 'episode' };
    } catch (err) {
      console.error('[MongoDB] getEpisodeStream error:', err);
    }
    return null;
  }
}
