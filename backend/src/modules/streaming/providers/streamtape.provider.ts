import { StreamingProvider, StreamResult, StreamQuery } from './provider.interface';
import { docMatchesQuery } from '../../../utils/title-match';
import Movie from '../../../models/Movie';
import Serie from '../../../models/Serie';

function escapeRe(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class StreamtapeProvider implements StreamingProvider {
  readonly name = 'streamtape';

  supports(query: StreamQuery): boolean {
    return !!query.title || !!query.tmdbId;
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    const embedUrl = await this.findMovieStream(query);
    if (!embedUrl) return null;
    return { provider: this.name, embedUrl, type: 'movie' };
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    const embedUrl = await this.findEpisodeStream(query);
    if (!embedUrl) return null;
    return { provider: this.name, embedUrl, type: 'episode' };
  }

  private embedUrl(code: string): string {
    return `https://streamtape.com/e/${code}`;
  }

  private isStreamtapeUrl(url: string): string | null {
    const m = url.match(/streamtape\.com\/(?:e|v)\/([a-zA-Z0-9_\-]+)/i);
    if (m) return this.embedUrl(m[1]);
    return null;
  }

  private async findMovieStream(query: StreamQuery): Promise<string | null> {
    try {
      let movie: any = null;
      if (query.tmdbId) {
        movie = await Movie.findOne({ tmdbId: query.tmdbId }).exec();
      }
      if (!movie) {
        const titles = [query.title, query.frenchTitle, query.originalTitle].filter(Boolean) as string[];
        if (titles.length) {
          const candidates = await Movie.find({
            $or: titles.map((t) => ({ titre: { $regex: new RegExp(escapeRe(t), 'i') } })),
          }).exec();
          movie = candidates.find(
            (m) =>
              docMatchesQuery(m, titles, query.year, false) &&
              (!query.tmdbId || !m.tmdbId || Number(m.tmdbId) === Number(query.tmdbId)),
          ) || null;
        }
      }

      if (!movie) return null;

      if (movie.streamtapeLink || movie.streamtapeCode) {
        const code = movie.streamtapeCode || (movie.streamtapeLink?.match(/streamtape\.com\/(?:e|v)\/([a-zA-Z0-9_\-]+)/i)?.[1]);
        if (code) return this.embedUrl(code);
      }

      if (movie.lien) {
        const fromLien = this.isStreamtapeUrl(movie.lien);
        if (fromLien) return fromLien;
      }
    } catch (err) {
      console.error('[Streamtape] Movie query error:', err);
    }
    return null;
  }

  private async findEpisodeStream(query: StreamQuery): Promise<string | null> {
    if (query.season === undefined || query.episode === undefined) return null;

    try {
      const titleVariants = [query.title, query.frenchTitle, query.originalTitle].filter(Boolean) as string[];
      const ors: any[] = [];
      if (query.tmdbId) ors.push({ tmdbId: query.tmdbId });
      ors.push(...titleVariants.map(t => ({ titre: { $regex: new RegExp(escapeRe(t), 'i') } })));
      if (!ors.length) return null;
      const candidates = await Serie.find({ $or: ors }).exec();
      const series = candidates.find((s) => {
        // tmdbId exact : la fiche est la bonne par identité, le titre peut être
        // un alias localisé.
        if (query.tmdbId && Number(s.tmdbId) === Number(query.tmdbId)) return true;
        // Un tmdbId différent contredit la demande : homonyme, on écarte.
        if (query.tmdbId && s.tmdbId && Number(s.tmdbId) !== Number(query.tmdbId)) return false;
        // Sinon, jointure stricte par titre (+ saison tolérée, + année).
        return docMatchesQuery(s, titleVariants, query.year, true);
      }) || null;

      if (!series) return null;

      const ep = series.episodes.find(
        (e: any) => Number(e.season) === Number(query.season) && Number(e.episodeNumber) === Number(query.episode),
      );
      if (!ep) return null;

      if (ep.streamtapeLink || ep.streamtapeCode) {
        const code = ep.streamtapeCode || (ep.streamtapeLink?.match(/streamtape\.com\/(?:e|v)\/([a-zA-Z0-9_\-]+)/i)?.[1]);
        if (code) return this.embedUrl(code);
      }

      if (ep.lien) {
        const fromLien = this.isStreamtapeUrl(ep.lien);
        if (fromLien) return fromLien;
      }
    } catch (err) {
      console.error('[Streamtape] Serie query error:', err);
    }
    return null;
  }
}
