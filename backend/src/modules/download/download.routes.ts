import { Router, Request, Response, NextFunction } from 'express';
import { spawn } from 'child_process';

const router = Router();
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
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  const { mediaId, mediaType = 'movie', season, episode, title } = req.body;

  if (!mediaId) {
    res.status(400).json({ success: false, error: 'mediaId is required' });
    return;
  }

  const args = ['-m', 'downloader.main', mediaId, mediaType];
  if (season !== undefined && episode !== undefined) {
    args.push(String(season), String(episode));
  }
  if (title) args.push(title);

  const py = spawn('python', args, { cwd: CWD, timeout: 120000 });
  let stdout = '';
  let stderr = '';

  py.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
  py.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

  py.on('close', (code: number | null) => {
    if (code !== 0) {
      res.json({ success: false, error: `Python exited code ${code}`, stderr });
      return;
    }
    try {
      res.json(JSON.parse(stdout));
    } catch {
      res.json({ success: false, error: 'Invalid JSON from Python', raw: stdout });
    }
  });

  py.on('error', (err: Error) => {
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
router.get('/stream', (req: Request, res: Response) => {
  const m3u8Url = req.query.m3u8 as string;
  if (!m3u8Url) {
    res.status(400).json({ success: false, error: 'm3u8 query param required' });
    return;
  }

  const filename = (req.query.filename as string) || 'video.mp4';

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'video/mp4');

  const ffmpeg = spawn('ffmpeg', [
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

  ffmpeg.on('close', (code: number | null) => {
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

export default router;
