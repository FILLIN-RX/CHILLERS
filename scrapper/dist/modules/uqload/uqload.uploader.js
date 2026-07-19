"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopUpload = stopUpload;
exports.isUploadRunning = isUploadRunning;
exports.uploadMoviesBatch = uploadMoviesBatch;
exports.uploadSeriesBatch = uploadSeriesBatch;
exports.uploadSingleMovie = uploadSingleMovie;
exports.uploadSingleEpisode = uploadSingleEpisode;
const log_buffer_1 = require("../../config/log-buffer");
const Movie_1 = __importDefault(require("../../models/Movie"));
const Serie_1 = __importDefault(require("../../models/Serie"));
const db_1 = require("../../config/db");
const BATCH_SIZE = 100;
let isUploading = false;
let shouldStop = false;
function stopUpload() {
    shouldStop = true;
    (0, log_buffer_1.appendLog)('[Uqload] Arrêt demandé…');
}
function isUploadRunning() {
    return isUploading;
}
async function uploadMoviesBatch(client) {
    await (0, db_1.connectDB)();
    isUploading = true;
    shouldStop = false;
    const startTime = Date.now();
    const errors = [];
    let success = 0;
    let failed = 0;
    try {
        const pending = await Movie_1.default.find({ $or: [{ uqloadCode: { $eq: null } }, { uqloadCode: { $exists: false } }] })
            .limit(BATCH_SIZE)
            .lean();
        const total = pending.length;
        if (total === 0) {
            (0, log_buffer_1.appendLog)('[Uqload] Aucun film à uploader');
            return { total: 0, success: 0, failed: 0, errors: [], duration: 0, remaining: 0 };
        }
        (0, log_buffer_1.appendLog)(`[Uqload] Upload de ${total} films…`);
        for (let i = 0; i < total; i++) {
            if (shouldStop) {
                (0, log_buffer_1.appendLog)('[Uqload] Upload interrompu par l\'utilisateur');
                break;
            }
            const movie = pending[i];
            try {
                (0, log_buffer_1.appendLog)(`[Uqload] (${i + 1}/${total}) ${movie.titre}`);
                const fileCode = await client.uploadByUrl(movie.lien, movie.titre);
                await new Promise(r => setTimeout(r, 2000));
                const dlResult = await client.getDirectLink(fileCode);
                const bestQuality = dlResult.result.versions.find(v => v.name === 'n')
                    || dlResult.result.versions[0];
                await Movie_1.default.updateOne({ _id: movie._id }, {
                    $set: {
                        uqloadCode: fileCode,
                        uqloadLink: bestQuality?.url || null,
                        uqloadQualities: dlResult.result.versions,
                        uqloadHls: dlResult.result.hls_direct || null,
                    }
                });
                success++;
                (0, log_buffer_1.appendLog)(`[Uqload] ✅ ${movie.titre} → ${fileCode}`);
            }
            catch (e) {
                failed++;
                errors.push(`${movie.titre}: ${e.message}`);
                (0, log_buffer_1.appendLog)(`[Uqload] ❌ ${movie.titre}: ${e.message}`);
            }
        }
        const remaining = await Movie_1.default.countDocuments({ $or: [{ uqloadCode: { $eq: null } }, { uqloadCode: { $exists: false } }] });
        return {
            total,
            success,
            failed,
            errors,
            duration: (Date.now() - startTime) / 1000,
            remaining,
        };
    }
    finally {
        isUploading = false;
    }
}
async function uploadSeriesBatch(client) {
    await (0, db_1.connectDB)();
    isUploading = true;
    shouldStop = false;
    const startTime = Date.now();
    const errors = [];
    let success = 0;
    let failed = 0;
    try {
        const series = await Serie_1.default.find({ 'episodes.uqloadCode': { $eq: null } })
            .limit(BATCH_SIZE)
            .lean();
        let totalEpisodes = 0;
        const episodesToUpload = [];
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
            (0, log_buffer_1.appendLog)('[Uqload] Aucun épisode à uploader');
            return { total: 0, success: 0, failed: 0, errors: [], duration: 0, remaining: 0 };
        }
        (0, log_buffer_1.appendLog)(`[Uqload] Upload de ${totalEpisodes} épisodes…`);
        for (let i = 0; i < Math.min(totalEpisodes, BATCH_SIZE); i++) {
            if (shouldStop) {
                (0, log_buffer_1.appendLog)('[Uqload] Upload interrompu par l\'utilisateur');
                break;
            }
            const { serieId, serieTitre, episodeIndex, episode } = episodesToUpload[i];
            const label = `${serieTitre} - ${episode.episode}`;
            try {
                (0, log_buffer_1.appendLog)(`[Uqload] (${i + 1}/${Math.min(totalEpisodes, BATCH_SIZE)}) ${label}`);
                const fileCode = await client.uploadByUrl(episode.lien, label);
                await new Promise(r => setTimeout(r, 2000));
                const dlResult = await client.getDirectLink(fileCode);
                const bestQuality = dlResult.result.versions.find(v => v.name === 'n')
                    || dlResult.result.versions[0];
                await Serie_1.default.updateOne({ _id: serieId }, { $set: { [`episodes.${episodeIndex}.uqloadCode`]: fileCode, [`episodes.${episodeIndex}.uqloadLink`]: bestQuality?.url || null } });
                success++;
                (0, log_buffer_1.appendLog)(`[Uqload] ✅ ${label} → ${fileCode}`);
            }
            catch (e) {
                failed++;
                errors.push(`${label}: ${e.message}`);
                (0, log_buffer_1.appendLog)(`[Uqload] ❌ ${label}: ${e.message}`);
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
    }
    finally {
        isUploading = false;
    }
}
async function uploadSingleMovie(client, movieId) {
    await (0, db_1.connectDB)();
    const movie = await Movie_1.default.findById(movieId);
    if (!movie)
        throw new Error('Film introuvable');
    (0, log_buffer_1.appendLog)(`[Uqload] Upload film: ${movie.titre}`);
    const fileCode = await client.uploadByUrl(movie.lien, movie.titre);
    await new Promise(r => setTimeout(r, 2000));
    const dlResult = await client.getDirectLink(fileCode);
    const bestQuality = dlResult.result.versions.find(v => v.name === 'n') || dlResult.result.versions[0];
    await Movie_1.default.updateOne({ _id: movie._id }, {
        $set: {
            uqloadCode: fileCode,
            uqloadLink: bestQuality?.url || null,
            uqloadQualities: dlResult.result.versions,
            uqloadHls: dlResult.result.hls_direct || null,
        }
    });
    (0, log_buffer_1.appendLog)(`[Uqload] ✅ ${movie.titre} → ${fileCode}`);
}
async function uploadSingleEpisode(client, serieId, episodeIndex) {
    await (0, db_1.connectDB)();
    const serie = await Serie_1.default.findById(serieId);
    if (!serie)
        throw new Error('Série introuvable');
    const ep = serie.episodes[episodeIndex];
    if (!ep)
        throw new Error('Épisode introuvable');
    const label = `${serie.titre} - ${ep.episode}`;
    (0, log_buffer_1.appendLog)(`[Uqload] Upload épisode: ${label}`);
    const fileCode = await client.uploadByUrl(ep.lien, label);
    await new Promise(r => setTimeout(r, 2000));
    const dlResult = await client.getDirectLink(fileCode);
    const bestQuality = dlResult.result.versions.find(v => v.name === 'n') || dlResult.result.versions[0];
    await Serie_1.default.updateOne({ _id: serieId }, { $set: { [`episodes.${episodeIndex}.uqloadCode`]: fileCode, [`episodes.${episodeIndex}.uqloadLink`]: bestQuality?.url || null } });
    (0, log_buffer_1.appendLog)(`[Uqload] ✅ ${label} → ${fileCode}`);
}
