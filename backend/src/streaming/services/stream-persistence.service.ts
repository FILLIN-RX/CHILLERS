import Movie, { IMovie } from '../../models/Movie';
import Serie, { ISerie, IEpisode } from '../../models/Serie';
import tmdbClient from '../../config/tmdb';
import { StreamQuery, StreamResult } from '../providers/provider.interface';
import { UqloadClient } from '../../modules/uqload/uqload.client';

interface PersistOptions {
  quality?: string;
  isPremium?: boolean;
}

/**
 * Service d'auto-sauvegarde en arrière-plan des flux découverts par les providers externes
 */
export async function persistDiscoveredStream(
  query: StreamQuery,
  result: StreamResult,
  options: PersistOptions = {}
): Promise<void> {
  // Exécution asynchrone non-bloquante
  setImmediate(async () => {
    try {
      if (!result.embedUrl || result.provider === 'mongodb') {
        return;
      }

      const isMovie = result.type === 'movie' || (!query.season && query.type !== 'tv' && query.type !== 'anime');
      const quality = options.quality || (result.provider === 'frenchstream' ? '1080p' : '720p');
      const isPremium = options.isPremium ?? (quality === '1080p' || result.provider === 'frenchstream');

      if (isMovie) {
        await persistMovieStream(query, result, quality, isPremium);
      } else {
        await persistEpisodeStream(query, result, quality, isPremium);
      }
    } catch (err: any) {
      console.warn(`[AutoPersist] Erreur enregistrement ${result.provider} pour "${query.title || query.tmdbId}":`, err.message);
    }
  });
}

/**
 * Sauvegarde automatique d'un film découvert
 */
async function persistMovieStream(
  query: StreamQuery,
  result: StreamResult,
  quality: string,
  isPremium: boolean
): Promise<void> {
  let tmdbData: any = null;
  let title = query.title;
  let year = undefined;
  let posterUrl = undefined;

  if (query.tmdbId) {
    try {
      const res = await tmdbClient.get(`/movie/${query.tmdbId}?language=${query.language || 'fr'}`);
      tmdbData = res.data;
      title = tmdbData?.title || tmdbData?.original_title || title;
      if (tmdbData?.release_date) {
        year = new Date(tmdbData.release_date).getFullYear();
      }
      if (tmdbData?.poster_path) {
        posterUrl = `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}`;
      }
    } catch (_) {}
  }

  if (!title) return;

  // Vérifier d'abord par tmdbId OU par titre exact pour ne jamais violer l'index unique de titre
  const existingMovie = await Movie.findOne({
    $or: [
      ...(query.tmdbId ? [{ tmdbId: query.tmdbId }] : []),
      { titre: new RegExp(`^${escapeRegex(title)}$`, 'i') },
    ],
  });

  const sourceEntry = {
    source: result.provider,
    url: result.embedUrl,
    quality,
    isPremium,
    addedAt: new Date(),
  };

  if (existingMovie) {
    // Vérifier si cette URL exacte existe déjà
    const alreadyExists = existingMovie.sources?.some(s => s.url === result.embedUrl);
    if (!alreadyExists) {
      if (!existingMovie.sources) existingMovie.sources = [];
      existingMovie.sources.push(sourceEntry);
    }

    // Mettre à jour le lien principal si c'est un flux de meilleure qualité
    if (quality === '1080p' || !existingMovie.lien) {
      existingMovie.lien = result.embedUrl;
      existingMovie.source = result.provider;
      existingMovie.quality = quality;
      existingMovie.isPremium = isPremium;
    }

    existingMovie.disponible = true;
    existingMovie.disponibleCheckedAt = new Date();
    await existingMovie.save();
    console.log(`[AutoPersist] Film mis à jour en MongoDB: "${existingMovie.titre}" [${result.provider} ${quality}]`);

    // Upload en arrière-plan vers Uqload si aucun uqloadCode n'est présent
    if (!existingMovie.uqloadCode && existingMovie.lien) {
      triggerBackgroundUqloadUpload(existingMovie._id.toString(), existingMovie.lien, existingMovie.titre);
    }
  } else {
    // Créer un nouveau film
    const newMovie = new Movie({
      titre: title,
      pageUrl: result.embedUrl,
      lien: result.embedUrl,
      tmdbId: query.tmdbId || undefined,
      year: year || undefined,
      posterUrl: posterUrl || undefined,
      posterSource: posterUrl ? 'tmdb' : undefined,
      source: result.provider,
      quality,
      isPremium,
      sources: [sourceEntry],
      disponible: true,
      disponibleCheckedAt: new Date(),
      langueAudio: query.language || 'fr',
    });

    await newMovie.save();
    console.log(`[AutoPersist] Nouveau film créé en MongoDB: "${title}" [${result.provider} ${quality}]`);

    // Upload en arrière-plan vers Uqload
    if (newMovie.lien) {
      triggerBackgroundUqloadUpload(newMovie._id.toString(), newMovie.lien, newMovie.titre);
    }
  }
}

/**
 * Sauvegarde automatique d'un épisode de série / anime
 */
async function persistEpisodeStream(
  query: StreamQuery,
  result: StreamResult,
  quality: string,
  isPremium: boolean
): Promise<void> {
  const season = query.season || 1;
  const episodeNumber = query.episode || 1;
  const episodeLabel = `S${String(season).padStart(2, '0')}E${String(episodeNumber).padStart(2, '0')}`;

  let tmdbData: any = null;
  let title = query.title;
  let year = undefined;
  let posterUrl = undefined;

  if (query.tmdbId) {
    try {
      const res = await tmdbClient.get(`/tv/${query.tmdbId}?language=${query.language || 'fr'}`);
      tmdbData = res.data;
      title = tmdbData?.name || tmdbData?.original_name || title;
      if (tmdbData?.first_air_date) {
        year = new Date(tmdbData.first_air_date).getFullYear();
      }
      if (tmdbData?.poster_path) {
        posterUrl = `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}`;
      }
    } catch (_) {}
  }

  if (!title) return;

  const filter: any = query.tmdbId ? { tmdbId: query.tmdbId } : { titre: new RegExp(`^${escapeRegex(title)}$`, 'i') };
  let serie = await Serie.findOne(filter);

  const sourceEntry = {
    source: result.provider,
    url: result.embedUrl,
    quality,
    isPremium,
    addedAt: new Date(),
  };

  if (!serie) {
    serie = new Serie({
      titre: title,
      pageUrl: result.embedUrl,
      tmdbId: query.tmdbId || undefined,
      year: year || undefined,
      posterUrl: posterUrl || undefined,
      posterSource: posterUrl ? 'tmdb' : undefined,
      disponible: true,
      disponibleCheckedAt: new Date(),
      langueAudio: query.language || 'fr',
      episodes: [],
    });
  }

  // Chercher l'épisode dans la série
  const epIndex = serie.episodes.findIndex(
    e => e.season === season && e.episodeNumber === episodeNumber
  );

  if (epIndex >= 0) {
    const ep = serie.episodes[epIndex];
    if (!ep.sources) ep.sources = [];
    const alreadyExists = ep.sources.some(s => s.url === result.embedUrl);
    if (!alreadyExists) {
      ep.sources.push(sourceEntry);
    }
    if (quality === '1080p' || !ep.lien) {
      ep.lien = result.embedUrl;
      ep.source = result.provider;
      ep.quality = quality;
      ep.isPremium = isPremium;
    }
  } else {
    const newEpisode: IEpisode = {
      episode: episodeLabel,
      season,
      episodeNumber,
      lien: result.embedUrl,
      source: result.provider,
      quality,
      isPremium,
      sources: [sourceEntry],
      langueAudio: query.language || 'fr',
    };
    serie.episodes.push(newEpisode);
  }

  serie.disponible = true;
  serie.disponibleCheckedAt = new Date();
  await serie.save();
  console.log(`[AutoPersist] Épisode mis à jour en MongoDB: "${title}" ${episodeLabel} [${result.provider} ${quality}]`);
}

/**
 * Upload asynchrone vers Uqload en tâche de fond pour pérenniser le contenu
 */
async function triggerBackgroundUqloadUpload(movieId: string, videoUrl: string, title: string): Promise<void> {
  const apiKey = process.env.UQLOAD_API_KEY;
  if (!apiKey || !videoUrl || !videoUrl.startsWith('http')) return;

  // On ignore si ce n'est pas un lien direct téléchargeable (ex: MP4 ou Vidzy direct)
  const isDirectDownloadable = /\.(mp4|mkv|webm)|u\d+\.vidzy\.cc/i.test(videoUrl);
  if (!isDirectDownloadable) return;

  setImmediate(async () => {
    try {
      console.log(`[AutoPersist -> Uqload] Démarrage upload Uqload pour "${title}"...`);
      const client = new UqloadClient(apiKey);
      const fileCode = await client.uploadByUrlAsync(videoUrl, title);
      if (fileCode) {
        await Movie.updateOne(
          { _id: movieId },
          {
            $set: {
              uqloadCode: fileCode,
              uqloadLink: `https://uqload.is/embed-${fileCode}.html`,
              uploadedAt: new Date()
            }
          }
        );
        console.log(`[AutoPersist -> Uqload] ✅ Film uploadé avec succès sur Uqload: "${title}" (fileCode=${fileCode})`);
      }
    } catch (err: any) {
      console.warn(`[AutoPersist -> Uqload] ⚠️ Échec upload Uqload pour "${title}":`, err.message);
    }
  });
}

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
