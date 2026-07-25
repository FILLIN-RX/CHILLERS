import { UqloadClient } from './uqload.client';
import { BatchResult } from './uqload.types';
import { appendLog } from '../../config/log-buffer';
import Movie from '../../models/Movie';
import Serie from '../../models/Serie';
import { connectDB } from '../../config/db';

const BATCH_SIZE = 100;
let isUploading = false;
let shouldStop = false;

export function stopUpload() {
  shouldStop = true;
  appendLog('[Uqload] Arrêt demandé…');
}

export function isUploadRunning() {
  return isUploading;
}

export async function uploadMoviesBatch(client: UqloadClient): Promise<BatchResult> {
  await connectDB();
  isUploading = true;
  shouldStop = false;
  const startTime = Date.now();
  const errors: string[] = [];
  let success = 0;
  let failed = 0;

  try {
    const pending = await Movie.find({ $or: [{ uqloadCode: { $eq: null } }, { uqloadCode: { $exists: false } }] })
      .limit(BATCH_SIZE)
      .lean();

    const total = pending.length;
    if (total === 0) {
      appendLog('[Uqload] Aucun film à uploader');
      return { total: 0, success: 0, failed: 0, errors: [], duration: 0, remaining: 0 };
    }

    appendLog(`[Uqload] Upload de ${total} films…`);

    for (let i = 0; i < total; i++) {
      if (shouldStop) {
        appendLog('[Uqload] Upload interrompu par l\'utilisateur');
        break;
      }

      const movie = pending[i];
      try {
        appendLog(`[Uqload] (${i + 1}/${total}) ${movie.titre}`);

        const { fileCode, directLink } = await client.uploadByUrlAndGetLink(movie.lien, movie.titre);
        const bestQuality = directLink?.versions?.find((v: any) => v.name === 'n') || directLink?.versions?.[0];

        await Movie.updateOne(
          { _id: movie._id },
          {
            $set: {
              uqloadCode: fileCode,
              uqloadLink: bestQuality?.url || null,
              uqloadQualities: directLink?.versions || [],
              uqloadHls: directLink?.hls_direct || null,
            }
          }
        );

        success++;
        appendLog(`[Uqload] ✅ ${movie.titre} → ${fileCode}`);
      } catch (e: any) {
        failed++;
        errors.push(`${movie.titre}: ${e.message}`);
        appendLog(`[Uqload] ❌ ${movie.titre}: ${e.message}`);
      }
    }

    const remaining = await Movie.countDocuments({ $or: [{ uqloadCode: { $eq: null } }, { uqloadCode: { $exists: false } }] });

    return {
      total,
      success,
      failed,
      errors,
      duration: (Date.now() - startTime) / 1000,
      remaining,
    };
  } finally {
    isUploading = false;
  }
}

export async function uploadSeriesBatch(client: UqloadClient): Promise<BatchResult> {
  await connectDB();
  isUploading = true;
  shouldStop = false;
  const startTime = Date.now();
  const errors: string[] = [];
  let success = 0;
  let failed = 0;

  try {
    const series = await Serie.find({ 'episodes.uqloadCode': { $eq: null } })
      .limit(BATCH_SIZE)
      .lean();

    let totalEpisodes = 0;
    const episodesToUpload: { serieId: string; serieTitre: string; episodeIndex: number; episode: any }[] = [];

    for (const serie of series) {
      for (let idx = 0; idx < (serie.episodes || []).length; idx++) {
        const ep = serie.episodes[idx];
        if (!ep.uqloadCode) {
          episodesToUpload.push({ serieId: serie._id.toString(), serieTitre: serie.titre, episodeIndex: idx, episode: ep });
          totalEpisodes++;
        }
      }
    }

    if (totalEpisodes === 0) {
      appendLog('[Uqload] Aucun épisode à uploader');
      return { total: 0, success: 0, failed: 0, errors: [], duration: 0, remaining: 0 };
    }

    appendLog(`[Uqload] Upload de ${totalEpisodes} épisodes…`);

    for (let i = 0; i < Math.min(totalEpisodes, BATCH_SIZE); i++) {
      if (shouldStop) {
        appendLog('[Uqload] Upload interrompu par l\'utilisateur');
        break;
      }

      const { serieId, serieTitre, episodeIndex, episode } = episodesToUpload[i];
      const label = `${serieTitre} - ${episode.episode}`;

      try {
        appendLog(`[Uqload] (${i + 1}/${Math.min(totalEpisodes, BATCH_SIZE)}) ${label}`);

        const { fileCode, directLink } = await client.uploadByUrlAndGetLink(episode.lien, label);
        const bestQuality = directLink?.versions?.find((v: any) => v.name === 'n') || directLink?.versions?.[0];

        await Serie.updateOne(
          { _id: serieId },
          { $set: { [`episodes.${episodeIndex}.uqloadCode`]: fileCode, [`episodes.${episodeIndex}.uqloadLink`]: bestQuality?.url || null } }
        );

        success++;
        appendLog(`[Uqload] ✅ ${label} → ${fileCode}`);
      } catch (e: any) {
        failed++;
        errors.push(`${label}: ${e.message}`);
        appendLog(`[Uqload] ❌ ${label}: ${e.message}`);
      }
    }

    return {
      total: Math.min(totalEpisodes, BATCH_SIZE),
      success,
      failed,
      errors,
      duration: (Date.now() - startTime) / 1000,
      remaining: totalEpisodes - success - failed,
    };
  } finally {
    isUploading = false;
  }
}

export async function uploadSingleMovie(client: UqloadClient, movieId: string): Promise<void> {
  await connectDB();
  const movie = await Movie.findById(movieId);
  if (!movie) throw new Error('Film introuvable');

  appendLog(`[Uqload] Upload film: ${movie.titre}`);
  const { fileCode, directLink } = await client.uploadByUrlAndGetLink(movie.lien, movie.titre);
  const bestQuality = directLink?.versions?.find((v: any) => v.name === 'n') || directLink?.versions?.[0];

  await Movie.updateOne(
    { _id: movie._id },
    {
      $set: {
        uqloadCode: fileCode,
        uqloadLink: bestQuality?.url || null,
        uqloadQualities: directLink?.versions || [],
        uqloadHls: directLink?.hls_direct || null,
      }
    }
  );
  appendLog(`[Uqload] ✅ ${movie.titre} → ${fileCode}`);
}

export async function uploadSingleEpisode(client: UqloadClient, serieId: string, episodeIndex: number): Promise<void> {
  await connectDB();
  const serie = await Serie.findById(serieId);
  if (!serie) throw new Error('Série introuvable');
  const ep = serie.episodes[episodeIndex];
  if (!ep) throw new Error('Épisode introuvable');

  const label = `${serie.titre} - ${ep.episode}`;
  appendLog(`[Uqload] Upload épisode: ${label}`);

  const { fileCode, directLink } = await client.uploadByUrlAndGetLink(ep.lien, label);
  const bestQuality = directLink?.versions?.find((v: any) => v.name === 'n') || directLink?.versions?.[0];

  await Serie.updateOne(
    { _id: serieId },
    { $set: { [`episodes.${episodeIndex}.uqloadCode`]: fileCode, [`episodes.${episodeIndex}.uqloadLink`]: bestQuality?.url || null } }
  );
  appendLog(`[Uqload] ✅ ${label} → ${fileCode}`);
}
