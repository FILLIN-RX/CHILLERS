import { Request, Response } from 'express';
import { isAxiosError } from 'axios';
import { isOpenSubtitlesConfigured } from './opensubtitles.config';
import { searchSubtitles, downloadSubtitle, refreshToken } from './opensubtitles.service';
import { srtToVtt } from './srt-to-vtt';
import { errMessage } from '../../streaming/torrents/torrents.utils';

export async function findSubs(req: Request, res: Response): Promise<void> {
    if (!isOpenSubtitlesConfigured()) {
        res.json({ success: true, subtitles: [], message: 'Module sous-titres désactivé (OPENSUBTITLES_USER/PASS manquantes)' });
        return;
    }

    const title = String(req.query.title || '').trim();
    if (!title) {
        res.status(400).json({ success: false, subtitles: [], message: 'Paramètre "title" requis' });
        return;
    }

    const year = parseInt(String(req.query.year || ''), 10) || undefined;
    const season = parseInt(String(req.query.season || ''), 10) || undefined;
    const episode = parseInt(String(req.query.episode || ''), 10) || undefined;
    const type = String(req.query.type || 'movie');
    const langs = String(req.query.langs || 'fr,en')
        .split(',')
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean);

    try {
        const subtitles = await searchSubtitles({
            title,
            year,
            type: type === 'tv' || type === 'series' ? 'episode' : 'movie',
            season,
            episode,
            langs,
        });
        res.json({ success: true, subtitles, message: null });
    } catch (err) {
        console.error(`[Subtitles] Erreur recherche "${title}": ${errMessage(err)}`);
        res.json({ success: true, subtitles: [], message: 'Erreur lors de la recherche de sous-titres' });
    }
}

export async function getSubFile(req: Request, res: Response): Promise<void> {
    if (!isOpenSubtitlesConfigured()) {
        res.status(404).send('Module sous-titres désactivé');
        return;
    }

    const fileId = parseInt(String(req.params.fileId), 10);
    if (!Number.isFinite(fileId)) {
        res.status(400).send('fileId invalide');
        return;
    }

    try {
        const file = await downloadSubtitle(fileId);
        if (!file) {
            res.status(404).send('Sous-titre introuvable');
            return;
        }

        const vtt = file.format === 'vtt' ? file.buffer.toString('utf8') : srtToVtt(file.buffer.toString('utf8'));
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Content-Disposition', 'inline; filename="subtitle.vtt"');
        res.send(vtt);
    } catch (err) {
        if (isAxiosError(err) && err.response?.status === 401) {
            try {
                await refreshToken();
                const file = await downloadSubtitle(fileId);
                if (!file) {
                    res.status(404).send('Sous-titre introuvable');
                    return;
                }
                const vtt = file.format === 'vtt' ? file.buffer.toString('utf8') : srtToVtt(file.buffer.toString('utf8'));
                res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.send(vtt);
                return;
            } catch (retryErr) {
                console.error(`[Subtitles] Erreur après refresh token (${fileId}): ${errMessage(retryErr)}`);
            }
        }
        if (isAxiosError(err) && err.response?.status === 429) {
            res.status(429).send('Limite OpenSubtitles atteinte — réessaie dans quelques minutes');
            return;
        }
        console.error(`[Subtitles] Erreur téléchargement (${fileId}): ${errMessage(err)}`);
        res.status(502).send('Échec du téléchargement du sous-titre');
    }
}
