"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const child_process_1 = require("child_process");
const axios_1 = __importDefault(require("axios"));
const provider_manager_1 = require("../../streaming/provider-manager");
const direct_scraper_1 = require("../../streaming/providers/direct-scraper");
const router = (0, express_1.Router)();
const providerManager = new provider_manager_1.ProviderManager();
/**
 * GET /api/download/resolve
 *
 * Résout automatiquement la meilleure URL de téléchargement (MP4 direct)
 * pour n'importe quel film ou épisode via le ProviderManager multi-sources.
 */
router.get('/resolve', async (req, res) => {
    try {
        const { tmdb_id, title, type = 'movie', season, episode, isPremium, language = 'fr' } = req.query;
        const tmdbIdNum = tmdb_id && /^\d+$/.test(tmdb_id) ? parseInt(tmdb_id, 10) : 0;
        const isPrem = isPremium === 'true' || isPremium === '1';
        const isTv = type === 'series' || type === 'anime' || season !== undefined || episode !== undefined;
        const cleanTitle = title
            ? title.replace(/\s*·\s*(?:S\d+)?E\d+.*$/i, '').trim()
            : undefined;
        const query = {
            tmdbId: tmdbIdNum,
            title: cleanTitle,
            type: isTv ? 'tv' : 'movie',
            season: season !== undefined ? parseInt(season, 10) : undefined,
            episode: episode !== undefined ? parseInt(episode, 10) : undefined,
            isPremium: isPrem,
            language
        };
        console.log(`[Download Resolve] Résolution: "${cleanTitle || tmdb_id}" (type=${type}, S${season || 1}E${episode || 1}, premium=${isPrem})`);
        const streamResult = isTv
            ? await providerManager.getEpisodeStream(query)
            : await providerManager.getMovieStream(query);
        if (!streamResult || !streamResult.embedUrl) {
            return res.status(404).json({
                success: false,
                error: 'Aucune source de téléchargement trouvée pour ce contenu',
                data: null
            });
        }
        let downloadUrl = streamResult.directUrl || streamResult.embedUrl;
        let directType = streamResult.directType || (/\.m3u8(\?|$)/i.test(downloadUrl) ? 'hls' : /\.mp4(\?|$)/i.test(downloadUrl) ? 'mp4' : 'embed');
        // Pour le téléchargement : si on a reçu du HLS ou une URL embed, tenter d'extraire le MP4 direct (avec vraie taille et débit max)
        if (directType !== 'mp4' && (streamResult.embedUrl || downloadUrl)) {
            const targetUrl = streamResult.embedUrl || downloadUrl;
            try {
                const direct = await direct_scraper_1.DirectScraper.resolve(targetUrl, false);
                if (direct?.directUrl && direct.type === 'mp4') {
                    downloadUrl = direct.directUrl;
                    directType = 'mp4';
                    console.log(`[Download Resolve] ✅ MP4 direct extrait avec succès pour download: ${downloadUrl.slice(0, 80)}...`);
                }
            }
            catch (err) {
                console.warn(`[Download Resolve] Échec extraction MP4 direct:`, err.message);
            }
        }
        const cleanFilename = `${(title || 'video').replace(/[^a-zA-Z0-9_\-]/g, '_')}${isTv ? `_S${season || 1}E${episode || 1}` : ''}.mp4`;
        // Déterminer le type de lien final pour construire la bonne URL de téléchargement
        const isHls = directType === 'hls' || /\.m3u8(\?|$)/i.test(downloadUrl);
        const isMp4Direct = directType === 'mp4' || /\.mp4(\?|$)/i.test(downloadUrl);
        let finalDownloadUrl;
        if (isMp4Direct && downloadUrl.startsWith('http')) {
            // MP4 direct → proxy avec Range support et Content-Length d'origine (vitesse max + vraie taille)
            finalDownloadUrl = `/api/download/file?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(cleanFilename)}`;
            console.log(`[Download Resolve] MP4 direct → file proxy: ${downloadUrl.slice(0, 80)}...`);
        }
        else if (isHls) {
            // HLS de secours → FFmpeg convertit le flux en MP4 à la volée
            finalDownloadUrl = `/api/download/stream?m3u8=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(cleanFilename)}`;
            console.log(`[Download Resolve] HLS fallback → FFmpeg proxy: ${downloadUrl.slice(0, 80)}...`);
        }
        else {
            // Embed ou URL interne → on renvoie tel quel
            finalDownloadUrl = downloadUrl;
        }
        return res.json({
            success: true,
            data: {
                downloadUrl: finalDownloadUrl,
                rawUrl: downloadUrl,
                directType: directType,
                provider: streamResult.provider,
                type: isTv ? 'episode' : 'movie',
                filename: cleanFilename,
                fileCode: ''
            }
        });
    }
    catch (error) {
        console.error('[Download Resolve] Erreur:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/download/file
 *
 * Proxy de téléchargement haute vitesse avec gestion des noms de fichiers, referers et en-têtes Range
 */
router.get('/file', async (req, res) => {
    try {
        const { url, filename = 'video.mp4' } = req.query;
        if (!url) {
            return res.status(400).json({ success: false, error: 'Paramètre ?url= requis' });
        }
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };
        if (url.includes('videodownloader') || url.includes('hakunaymatata')) {
            headers['Referer'] = 'https://videodownloader.site/';
        }
        else if (url.includes('uqload')) {
            headers['Referer'] = 'https://uqload.is/';
        }
        else if (url.includes('vidzy')) {
            headers['Referer'] = 'https://vidzy.cc/';
        }
        else if (url.includes('dood') || url.includes('playmogo') || url.includes('d000')) {
            headers['Referer'] = 'https://doodstream.com/';
        }
        else if (url.includes('voe')) {
            headers['Referer'] = 'https://voe.sx/';
        }
        else if (url.includes('streamtape')) {
            headers['Referer'] = 'https://streamtape.com/';
        }
        if (req.headers.range) {
            headers['Range'] = req.headers.range;
        }
        if (req.headers['if-range']) {
            headers['If-Range'] = req.headers['if-range'];
        }
        const response = await (0, axios_1.default)({
            method: 'GET',
            url,
            headers,
            responseType: 'stream',
            validateStatus: status => status >= 200 && status < 400
        });
        const isIos = /iPhone|iPad|iPod/i.test(req.headers['user-agent'] || '');
        res.status(response.status);
        if (isIos) {
            // Force Safari iOS to trigger native download dialog to Files app
            res.setHeader('Content-Type', 'application/octet-stream');
        }
        else {
            res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
        }
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
        for (const [key, val] of Object.entries(response.headers)) {
            if (['content-length', 'accept-ranges', 'content-range', 'etag', 'last-modified'].includes(key.toLowerCase())) {
                res.setHeader(key, val);
            }
        }
        response.data.pipe(res);
    }
    catch (error) {
        console.error('[Download File Proxy] Erreur:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'Erreur proxy de téléchargement' });
        }
    }
});
/**
 * GET /api/download/stream
 *
 * Proxy de téléchargement HLS vers MP4 via FFmpeg
 */
router.get('/stream', (req, res) => {
    const m3u8Url = req.query.m3u8;
    if (!m3u8Url) {
        res.status(400).json({ success: false, error: 'm3u8 query param required' });
        return;
    }
    const filename = req.query.filename || 'video.mp4';
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'video/mp4');
    const referer = m3u8Url.includes('uqload') ? 'https://uqload.is/' : m3u8Url.includes('vidzy') ? 'https://vidzy.cc/' : '';
    const headers = `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n${referer ? `Referer: ${referer}\r\n` : ''}`;
    const ffmpeg = (0, child_process_1.spawn)('ffmpeg', [
        '-y',
        '-headers', headers,
        '-i', m3u8Url,
        '-c', 'copy',
        '-bsf:a', 'aac_adtstoasc',
        '-movflags', 'frag_keyframe+empty_moov',
        '-f', 'mp4',
        'pipe:1',
    ]);
    ffmpeg.stdout.pipe(res);
    ffmpeg.stderr.on('data', () => { });
    ffmpeg.on('close', (code) => {
        if (code !== 0 && !res.headersSent) {
            res.status(500).json({ success: false, error: `FFmpeg exited code ${code}` });
        }
    });
    ffmpeg.on('error', () => {
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'FFmpeg not found' });
        }
    });
    req.on('close', () => {
        ffmpeg.kill();
    });
});
/**
 * GET /api/download/premium
 *
 * Téléchargement direct 1080p Full HD pour les membres Premium
 */
router.get('/premium', async (req, res) => {
    try {
        const title = req.query.title;
        if (!title) {
            res.status(400).json({ success: false, error: 'title query param required' });
            return;
        }
        const { getFrenchStreamMovie } = await Promise.resolve().then(() => __importStar(require('../frenchstream/frenchstream.service')));
        const movie = await getFrenchStreamMovie(title);
        if (!movie?.streamUrl) {
            res.status(404).json({ success: false, error: `Aucune version 1080p trouvée pour "${title}"` });
            return;
        }
        res.redirect(movie.streamUrl);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
