import { StreamingProvider, StreamResult, StreamQuery } from '../../streaming/providers/provider.interface';
import Movie from '../../models/Movie';
import Serie from '../../models/Serie';

const TAG = '[Streamtape]';

function extractFileId(url: string): string | null {
  const m = url.match(/streamtape\.com\/(?:e|v|f)\/([a-zA-Z0-9]+)/i);
  return m ? m[1] : null;
}

function toEmbedUrl(url: string): string {
  const id = extractFileId(url);
  if (id) return `https://streamtape.com/e/${id}`;
  return url;
}

function resolveUrl(url: string | undefined | null): string | null {
  if (!url || url === '#') return null;
  if (!/streamtape\.com/i.test(url)) return null;
  return url;
}

export class StreamtapeProvider implements StreamingProvider {
  readonly name = 'streamtape';

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

      const url = resolveUrl(movie.lien);
      if (!url) return null;

      console.log(`${TAG} Movie match: "${movie.titre}" → ${url.slice(0, 80)}`);
      return { provider: this.name, embedUrl: toEmbedUrl(url), type: 'movie' };
    } catch (err) {
      console.error(`${TAG} getMovieStream error:`, err);
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

      const url = resolveUrl(ep.lien);
      if (!url) return null;

      const label = `S${String(query.season).padStart(2, '0')}E${String(query.episode).padStart(2, '0')}`;
      console.log(`${TAG} Episode match: "${serie.titre}" ${label} → ${url.slice(0, 80)}`);
      return { provider: this.name, embedUrl: toEmbedUrl(url), type: 'episode' };
    } catch (err) {
      console.error(`${TAG} getEpisodeStream error:`, err);
    }
    return null;
  }
}
