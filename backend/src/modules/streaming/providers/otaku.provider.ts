import { StreamingProvider, StreamQuery, StreamResult } from './provider.interface';
import { searchOtaku } from '../../otaku/otaku.service';
import Movie from '../../../models/Movie';
import Serie from '../../../models/Serie';
import tmdbClient from '../../../config/tmdb';

export class OtakuProvider implements StreamingProvider {
  readonly name = 'otaku';

  supports(query: StreamQuery): boolean {
    return !!(query.title || query.tmdbId);
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    let movieTitle = query.title;
    let originalTitle = query.originalTitle;
    let year = query.year;

    // Si le titre, titre original ou l'année n'a pas été envoyé, le récupérer via l'API TMDB
    if ((!movieTitle || !year || !originalTitle) && query.tmdbId) {
      try {
        const { data } = await tmdbClient.get(`/movie/${query.tmdbId}?language=${query.language || 'fr'}`);
        if (!movieTitle) movieTitle = data?.title || data?.original_title;
        if (!originalTitle && data?.original_title) originalTitle = data.original_title;
        if (!year && data?.release_date) {
          const y = new Date(data.release_date).getFullYear();
          if (!isNaN(y)) year = y;
        }
      } catch (_) {}
    }

    if (!movieTitle) return null;

    // Recherche d'un ID/page mémorisé dans MongoDB
    let knownPageId: string | undefined;
    let existingMovie: any = null;
    try {
      existingMovie = await Movie.findOne(
        query.tmdbId ? { tmdbId: query.tmdbId } : { titre: new RegExp(`^${movieTitle.trim()}$`, 'i') }
      ).select('_id providerPages');

      const matchedPage = existingMovie?.providerPages?.find(
        (p: any) => p.provider === this.name && (!p.language || p.language === (query.language || 'fr')) && p.isWorking !== false
      );
      if (matchedPage?.path) {
        knownPageId = matchedPage.path;
      }
    } catch (_) {}

    console.log(`[Otaku] Searching movie: "${movieTitle}" (directId=${knownPageId || 'aucun'}, year=${year || 'non spécifiée'})`);
    const result = await searchOtaku(
      movieTitle,
      'movie',
      undefined,
      undefined,
      query.language || 'fr',
      year,
      knownPageId,
      originalTitle
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
    let seriesTitle = query.title;
    let originalTitle = query.originalTitle;
    let year = query.year;

    // Si le titre n'a pas été envoyé, le récupérer via l'API TMDB
    if ((!seriesTitle || !originalTitle) && query.tmdbId) {
      try {
        const { data } = await tmdbClient.get(`/tv/${query.tmdbId}?language=${query.language || 'fr'}`);
        if (!seriesTitle) seriesTitle = data?.name || data?.original_name;
        if (!originalTitle && data?.original_name) originalTitle = data.original_name;
        if (!year && data?.first_air_date) {
          const y = new Date(data.first_air_date).getFullYear();
          if (!isNaN(y)) year = y;
        }
      } catch (_) {}
    }

    if (!seriesTitle) return null;

    const season = query.season || 1;
    const episode = query.episode || 1;

    // Recherche d'un ID/page mémorisé dans MongoDB
    let knownPageId: string | undefined;
    let existingSerie: any = null;
    try {
      existingSerie = await Serie.findOne(
        query.tmdbId ? { tmdbId: query.tmdbId } : { titre: new RegExp(`^${seriesTitle.trim()}$`, 'i') }
      ).select('_id providerPages');

      const matchedPage = existingSerie?.providerPages?.find(
        (p: any) => p.provider === this.name && (!p.season || p.season === season) && (!p.language || p.language === (query.language || 'fr')) && p.isWorking !== false
      );
      if (matchedPage?.path) {
        knownPageId = matchedPage.path;
      }
    } catch (_) {}

    console.log(`[Otaku] Searching series: "${seriesTitle}" S${season}E${episode} (directId=${knownPageId || 'aucun'})`);
    const result = await searchOtaku(
      seriesTitle,
      'series',
      season,
      episode,
      query.language || 'fr',
      year,
      knownPageId,
      originalTitle
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
