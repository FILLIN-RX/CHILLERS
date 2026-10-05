import { StreamingProvider, StreamQuery, StreamResult } from './provider.interface';
import { searchOtaku } from '../../otaku/otaku.service';
import Movie from '../../../models/Movie';
import Serie from '../../../models/Serie';

export class OtakuProvider implements StreamingProvider {
  readonly name = 'otaku';

  supports(query: StreamQuery): boolean {
    return !!(query.title || query.tmdbId);
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    if (!query.title) return null;

    // Recherche d'un ID/page mémorisé dans MongoDB
    let knownPageId: string | undefined;
    let existingMovie: any = null;
    try {
      existingMovie = await Movie.findOne(
        query.tmdbId ? { tmdbId: query.tmdbId } : { titre: new RegExp(`^${query.title.trim()}$`, 'i') }
      ).select('_id providerPages');

      const matchedPage = existingMovie?.providerPages?.find(
        (p: any) => p.provider === this.name && (!p.language || p.language === (query.language || 'fr')) && p.isWorking !== false
      );
      if (matchedPage?.path) {
        knownPageId = matchedPage.path;
      }
    } catch (_) {}

    console.log(`[Otaku] Searching movie: "${query.title}" (directId=${knownPageId || 'aucun'})`);
    const result = await searchOtaku(
      query.title,
      'movie',
      undefined,
      undefined,
      query.language || 'fr',
      query.year,
      knownPageId
    );

    if (result?.lien) {
      console.log(`[Otaku] Found movie link: ${result.lien.slice(0, 80)}...`);

      // Mémoriser l'ID/page source dans MongoDB
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
          console.warn(`[Otaku Provider] Erreur sauvegarde providerPages film:`, err.message);
        });
      }

      return {
        provider: this.name,
        embedUrl: result.lien,
        type: 'movie',
      };
    }

    return null;
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    if (!query.title) return null;

    const season = query.season || 1;
    const episode = query.episode || 1;

    // Recherche d'un ID/page mémorisé dans MongoDB
    let knownPageId: string | undefined;
    let existingSerie: any = null;
    try {
      existingSerie = await Serie.findOne(
        query.tmdbId ? { tmdbId: query.tmdbId } : { titre: new RegExp(`^${query.title.trim()}$`, 'i') }
      ).select('_id providerPages');

      const matchedPage = existingSerie?.providerPages?.find(
        (p: any) => p.provider === this.name && (!p.season || p.season === season) && (!p.language || p.language === (query.language || 'fr')) && p.isWorking !== false
      );
      if (matchedPage?.path) {
        knownPageId = matchedPage.path;
      }
    } catch (_) {}

    console.log(`[Otaku] Searching series: "${query.title}" S${season}E${episode} (directId=${knownPageId || 'aucun'})`);
    const result = await searchOtaku(
      query.title,
      'series',
      season,
      episode,
      query.language || 'fr',
      query.year,
      knownPageId
    );

    if (result?.lien) {
      console.log(`[Otaku] Found series link: ${result.lien.slice(0, 80)}...`);

      // Mémoriser l'ID/page source dans MongoDB
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
          console.warn(`[Otaku Provider] Erreur sauvegarde providerPages série:`, err.message);
        });
      }

      return {
        provider: this.name,
        embedUrl: result.lien,
        downloadUrl: result.lien,
        type: 'episode',
      };
    }

    return null;
  }
}
