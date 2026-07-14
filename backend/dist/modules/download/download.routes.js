"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
const CWD = process.cwd();
/**
 * POST /api/download
 *
 * Extrait l'URL .m3u8 via Python/Playwright (ne télécharge rien).
 *
 * Body: { mediaId, mediaType?, season?, episode?, title? }
 *
 * Réponse: { success, source, m3u8_url, error }
 */
router.post('/', (req, res, next) => {
    const { mediaId, mediaType = 'movie', season, episode, title } = req.body;
    if (!mediaId) {
        res.status(400).json({ success: false, error: 'mediaId is required' });
        return;
    }
    const args = ['-m', 'downloader.main', mediaId, mediaType];
    if (season !== undefined && episode !== undefined) {
        args.push(String(season), String(episode));
    }
    if (title)
        args.push(title);
    const py = (0, child_process_1.spawn)(path_1.default.join(CWD, 'venv', 'bin', 'python3'), args, { cwd: CWD, timeout: 120000 });
    let stdout = '';
    let stderr = '';
    py.stdout.on('data', (data) => { stdout += data.toString(); });
    py.stderr.on('data', (data) => { stderr += data.toString(); });
    py.on('close', (code) => {
        if (code !== 0) {
            console.error('Python downloader error:', stderr);
            res.json({ success: false, error: `Python exited code ${code}`, stderr });
            return;
        }
        try {
            res.json(JSON.parse(stdout));
        }
        catch {
            res.json({ success: false, error: 'Invalid JSON from Python', raw: stdout });
        }
    });
    py.on('error', (err) => {
        res.status(500).json({ success: false, error: err.message });
    });
});
/**
 * GET /api/download/stream
 *
 * Proxy de téléchargement : pipe le flux HLS via FFmpeg directement
 * vers le navigateur client. Aucun fichier stocké sur le serveur.
 *
 * Query: ?m3u8=<encoded_url>&filename=<nom_fichier>
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
    const ffmpeg = (0, child_process_1.spawn)('ffmpeg', [
        '-y',
        '-i', m3u8Url,
        '-c', 'copy',
        '-bsf:a', 'aac_adtstoasc',
        '-movflags', '+faststart',
        '-f', 'mp4',
        'pipe:1',
    ]);
    ffmpeg.stdout.pipe(res);
    ffmpeg.stderr.on('data', () => {
        // FFmpeg logs — ignorés, seulement pour debug
    });
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
    // Timeout global 10 minutes
    req.on('close', () => {
        ffmpeg.kill();
    });
});
exports.default = router;
