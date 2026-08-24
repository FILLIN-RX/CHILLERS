"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const uqload_client_1 = require("./uqload.client");
const uqload_uploader_1 = require("./uqload.uploader");
const Movie_1 = __importDefault(require("../../models/Movie"));
const Serie_1 = __importDefault(require("../../models/Serie"));
const router = (0, express_1.Router)();
function getClient(req) {
    const apiKey = process.env.UQLOAD_API_KEY;
    if (!apiKey)
        return null;
    return new uqload_client_1.UqloadClient(apiKey);
}
/**
 * GET /uqload/file-info/:code
 * Retourne les infos temps réel d'un fichier Uqload depuis l'API officielle :
 * vues totales, durée, date création, statut, miniature.
 */
router.get('/uqload/file-info/:code', auth_1.adminMiddleware, async (req, res) => {
    const client = getClient(req);
    if (!client) {
        res.status(400).json({ success: false, data: null, message: 'UQLOAD_API_KEY non configurée' });
        return;
    }
    try {
        const code = req.params.code;
        const info = await client.getFileInfo(code);
        if (!info.result || info.result.length === 0) {
            res.status(404).json({ success: false, data: null, message: 'Fichier introuvable sur Uqload' });
            return;
        }
        const f = info.result[0];
        res.json({
            success: true,
            data: {
                code: f.file_code,
                title: f.file_title,
                views: parseInt(f.file_views, 10) || 0,
                duration: f.file_length,
                createdAt: f.file_created,
                public: f.file_public === '1',
                canPlay: f.canplay === 1,
                status: f.status,
                thumbnail: f.player_img,
                tags: f.tags || null,
                embedUrl: `https://uqload.is/embed-${f.file_code}.html`,
            },
            message: null,
        });
    }
    catch (e) {
        res.status(500).json({ success: false, data: null, message: e.message });
    }
});
router.post('/uqload/upload/movies', auth_1.adminMiddleware, async (req, res) => {
    const client = getClient(req);
    if (!client) {
        res.status(400).json({ success: false, data: null, message: 'UQLOAD_API_KEY non configurée' });
        return;
    }
    if ((0, uqload_uploader_1.isUploadRunning)()) {
        res.status(409).json({ success: false, data: null, message: 'Un upload est déjà en cours' });
        return;
    }
    const result = await (0, uqload_uploader_1.uploadMoviesBatch)(client);
    res.json({ success: true, data: result, message: null });
});
router.post('/uqload/upload/series', auth_1.adminMiddleware, async (req, res) => {
    const client = getClient(req);
    if (!client) {
        res.status(400).json({ success: false, data: null, message: 'UQLOAD_API_KEY non configurée' });
        return;
    }
    if ((0, uqload_uploader_1.isUploadRunning)()) {
        res.status(409).json({ success: false, data: null, message: 'Un upload est déjà en cours' });
        return;
    }
    const result = await (0, uqload_uploader_1.uploadSeriesBatch)(client);
    res.json({ success: true, data: result, message: null });
});
router.post('/uqload/upload/movie/:id', auth_1.adminMiddleware, async (req, res) => {
    const client = getClient(req);
    if (!client) {
        res.status(400).json({ success: false, data: null, message: 'UQLOAD_API_KEY non configurée' });
        return;
    }
    try {
        await (0, uqload_uploader_1.uploadSingleMovie)(client, req.params.id);
        res.json({ success: true, data: null, message: 'Upload terminé' });
    }
    catch (e) {
        res.status(500).json({ success: false, data: null, message: e.message });
    }
});
router.post('/uqload/upload/serie/:id/episode/:index', auth_1.adminMiddleware, async (req, res) => {
    const client = getClient(req);
    if (!client) {
        res.status(400).json({ success: false, data: null, message: 'UQLOAD_API_KEY non configurée' });
        return;
    }
    try {
        await (0, uqload_uploader_1.uploadSingleEpisode)(client, req.params.id, parseInt(req.params.index, 10));
        res.json({ success: true, data: null, message: 'Upload terminé' });
    }
    catch (e) {
        res.status(500).json({ success: false, data: null, message: e.message });
    }
});
router.post('/uqload/stop', auth_1.adminMiddleware, (_req, res) => {
    (0, uqload_uploader_1.stopUpload)();
    res.json({ success: true, data: null, message: 'Arrêt demandé' });
});
router.get('/uqload/status', auth_1.adminMiddleware, async (_req, res) => {
    const client = getClient(_req);
    if (!client) {
        res.json({ success: true, data: { configured: false, message: 'UQLOAD_API_KEY non configurée' }, message: null });
        return;
    }
    try {
        const [accountInfo, moviesPending, seriesPending] = await Promise.all([
            client.getAccountInfo(),
            Movie_1.default.countDocuments({ $or: [{ uqloadCode: { $eq: null } }, { uqloadCode: { $exists: false } }] }),
            Serie_1.default.countDocuments({ 'episodes.uqloadCode': { $eq: null } }),
        ]);
        res.json({
            success: true,
            data: {
                configured: true,
                isUploading: (0, uqload_uploader_1.isUploadRunning)(),
                account: {
                    login: accountInfo.result.login,
                    storageLeft: accountInfo.result.storage_left,
                    storageUsed: accountInfo.result.storage_used,
                    premium: accountInfo.result.premium === 1,
                    premiumExpire: accountInfo.result.premium_expire,
                },
                pending: {
                    movies: moviesPending,
                    series: seriesPending,
                },
            },
            message: null,
        });
    }
    catch (e) {
        res.status(500).json({ success: false, data: { configured: true, error: e.message }, message: e.message });
    }
});
router.get('/uqload/pending', auth_1.adminMiddleware, async (_req, res) => {
    try {
        const [movies, series] = await Promise.all([
            Movie_1.default.find({ $or: [{ uqloadCode: { $eq: null } }, { uqloadCode: { $exists: false } }] })
                .select('titre lien uqloadCode createdAt')
                .sort({ createdAt: -1 })
                .limit(200)
                .lean(),
            Serie_1.default.find({ 'episodes.uqloadCode': { $eq: null } })
                .select('titre episodes')
                .sort({ createdAt: -1 })
                .limit(200)
                .lean(),
        ]);
        const seriesEpisodes = [];
        for (const serie of series) {
            for (const ep of serie.episodes || []) {
                if (!ep.uqloadCode) {
                    seriesEpisodes.push({ serieTitre: serie.titre, episode: ep.episode, lien: ep.lien, uqloadCode: ep.uqloadCode || null });
                }
            }
        }
        res.json({
            success: true,
            data: {
                movies: movies.map(m => ({ titre: m.titre, lien: m.lien, uqloadCode: m.uqloadCode || null, createdAt: m.createdAt })),
                series: seriesEpisodes.slice(0, 200),
                totalMovies: movies.length,
                totalEpisodes: seriesEpisodes.length,
            },
            message: null,
        });
    }
    catch (e) {
        res.status(500).json({ success: false, data: null, message: e.message });
    }
});
/**
 * GET /uqload/files
 * Liste tous les fichiers uploadés sur Uqload avec leurs infos complètes.
 * Query params :
 *   - type   : "movies" | "series" | "all" (défaut: "all")
 *   - page   : numéro de page (défaut: 1)
 *   - limit  : résultats par page (défaut: 50, max: 200)
 *   - search : recherche dans le titre
 */
router.get('/uqload/files', auth_1.adminMiddleware, async (req, res) => {
    try {
        const type = req.query.type || 'all';
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
        const search = req.query.search || '';
        const skip = (page - 1) * limit;
        const results = {};
        if (type === 'movies' || type === 'all') {
            const movieFilter = {
                $or: [
                    { uqloadCode: { $exists: true, $ne: '' } },
                    { uqloadLink: { $exists: true, $ne: '' } },
                ],
            };
            if (search)
                movieFilter.titre = { $regex: search, $options: 'i' };
            const [movies, totalMovies] = await Promise.all([
                Movie_1.default.find(movieFilter)
                    .select('titre tmdbId uqloadCode uqloadLink uqloadQualities uqloadHls streamtapeCode streamtapeLink uploadedAt year posterUrl')
                    .sort({ uploadedAt: -1, createdAt: -1 })
                    .skip(type === 'all' ? 0 : skip)
                    .limit(type === 'all' ? Math.floor(limit / 2) : limit)
                    .lean(),
                Movie_1.default.countDocuments(movieFilter),
            ]);
            results.movies = {
                total: totalMovies,
                items: movies.map(m => ({
                    id: m._id,
                    titre: m.titre,
                    tmdbId: m.tmdbId,
                    year: m.year,
                    posterUrl: m.posterUrl,
                    uqload: {
                        code: m.uqloadCode || null,
                        link: m.uqloadLink || null,
                        hls: m.uqloadHls || null,
                        qualities: m.uqloadQualities || [],
                    },
                    streamtape: {
                        code: m.streamtapeCode || null,
                        link: m.streamtapeLink || null,
                    },
                    uploadedAt: m.uploadedAt || null,
                })),
            };
        }
        if (type === 'series' || type === 'all') {
            const serieFilter = {
                'episodes.uqloadCode': { $exists: true, $ne: '' },
            };
            if (search)
                serieFilter.titre = { $regex: search, $options: 'i' };
            const [series, totalSeries] = await Promise.all([
                Serie_1.default.find(serieFilter)
                    .select('titre tmdbId year posterUrl episodes')
                    .sort({ updatedAt: -1 })
                    .skip(type === 'all' ? 0 : skip)
                    .limit(type === 'all' ? Math.floor(limit / 2) : limit)
                    .lean(),
                Serie_1.default.countDocuments(serieFilter),
            ]);
            results.series = {
                total: totalSeries,
                items: series.map(s => ({
                    id: s._id,
                    titre: s.titre,
                    tmdbId: s.tmdbId,
                    year: s.year,
                    posterUrl: s.posterUrl,
                    episodes: (s.episodes || [])
                        .filter((e) => e.uqloadCode || e.uqloadLink)
                        .map((e) => ({
                        label: e.episode,
                        season: e.season,
                        episodeNumber: e.episodeNumber,
                        uqload: {
                            code: e.uqloadCode || null,
                            link: e.uqloadLink || null,
                        },
                        streamtape: {
                            code: e.streamtapeCode || null,
                            link: e.streamtapeLink || null,
                        },
                        uploadedAt: e.uploadedAt || null,
                    })),
                })),
            };
        }
        res.json({ success: true, data: { page, limit, ...results }, message: null });
    }
    catch (e) {
        res.status(500).json({ success: false, data: null, message: e.message });
    }
});
exports.default = router;
