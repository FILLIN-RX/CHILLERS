import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import axios from 'axios';
import { ProviderManager } from '../../streaming/provider-manager';
import { StreamQuery } from '../../streaming/providers/provider.interface';
import { DirectScraper } from '../../streaming/providers/direct-scraper';

const router = Router();
const providerManager = new ProviderManager();

/**
 * GET /api/download/resolve
 *
 * Résout automatiquement la meilleure URL de téléchargement (MP4 direct)
 * pour n'importe quel film ou épisode via le ProviderManager multi-sources.
 */
router.get('/resolve', async (req: Request, res: Response) => {
  try {
    const {
      tmdb_id,
      title,
      type = 'movie',
      season,
      episode,
      isPremium,
      language = 'fr'
    } = req.query as {
      tmdb_id?: string;
      title?: string;
      type?: 'movie' | 'series' | 'anime';
      season?: string;
      episode?: string;
      isPremium?: string;
      language?: string;
    };

    const tmdbIdNum = tmdb_id && /^\d+$/.test(tmdb_id) ? parseInt(tmdb_id, 10) : 0;
    const isPrem = isPremium === 'true' || isPremium === '1';
    const isTv = type === 'series' || type === 'anime' || season !== undefined || episode !== undefined;
    const cleanTitle = title
      ? title.replace(/\s*·\s*(?:S\d+)?E\d+.*$/i, '').trim()
      : undefined;

    const query: StreamQuery = {
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

    // Si on a déjà une URL directe MP4/HLS depuis le cache → on l'utilise directement (0 scrape)
    if (streamResult.directUrl && streamResult.directUrl.startsWith('http')) {
      console.log(`[Download Resolve] ✅ directUrl depuis cache (${streamResult.directType || 'direct'}) → pas de re-scrape`);
      downloadUrl = streamResult.directUrl;
    } else if (downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://')) {
      // Sinon, fallback : scrape l'embed pour extraire le MP4/HLS
      try {
        const direct = await DirectScraper.resolve(downloadUrl);
        if (direct && direct.directUrl && direct.directUrl.startsWith('http')) {
          downloadUrl = direct.directUrl;
        }
      } catch (err: any) {
        console.warn(`[Download Resolve] Échec DirectScraper sur "${downloadUrl}":`, err.message);
      }
    }

    const cleanFilename = `${(title || 'video').replace(/[^a-zA-Z0-9_\-]/g, '_')}${isTv ? `_S${season || 1}E${episode || 1}` : ''}.mp4`;

    // Déterminer le type de lien final pour construire la bonne URL de téléchargement
    const isHls = streamResult.directType === 'hls' || /\.m3u8(\?|$)/i.test(downloadUrl);
    const isMp4Direct = streamResult.directType === 'mp4' || /\.mp4(\?|$)/i.test(downloadUrl);

    let finalDownloadUrl: string;

    if (isHls) {
      // HLS → FFmpeg convertit le flux en MP4 à la volée
      finalDownloadUrl = `/api/download/stream?m3u8=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(cleanFilename)}`;
      console.log(`[Download Resolve] HLS → FFmpeg proxy: ${downloadUrl.slice(0, 80)}...`);
    } else if (isMp4Direct && downloadUrl.startsWith('http')) {
      // MP4 direct → proxy simple avec Range support
      finalDownloadUrl = `/api/download/file?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(cleanFilename)}`;
      console.log(`[Download Resolve] MP4 direct → file proxy: ${downloadUrl.slice(0, 80)}...`);
    } else {
      // Embed ou URL interne → on renvoie tel quel
      finalDownloadUrl = downloadUrl;
    }

    return res.json({
      success: true,
      data: {
        downloadUrl: finalDownloadUrl,
        rawUrl: downloadUrl,
        directType: streamResult.directType || (isHls ? 'hls' : isMp4Direct ? 'mp4' : 'embed'),
        provider: streamResult.provider,
        type: isTv ? 'episode' : 'movie',
        filename: cleanFilename,
        fileCode: ''
      }
    });
  } catch (error: any) {
    console.error('[Download Resolve] Erreur:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/download/file
 *
 * Proxy de téléchargement haute vitesse avec gestion des noms de fichiers et en-têtes Range
 */
router.get('/file', async (req: Request, res: Response) => {
  try {
    const { url, filename = 'video.mp4' } = req.query as { url?: string; filename?: string };
    if (!url) {
      return res.status(400).json({ success: false, error: 'Paramètre ?url= requis' });
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    if (url.includes('videodownloader') || url.includes('hakunaymatata')) {
      headers['Referer'] = 'https://videodownloader.site/';
    }

    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }
    if (req.headers['if-range']) {
      headers['If-Range'] = req.headers['if-range'] as string;
    }

    const response = await axios({
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
    } else {
      res.setHeader('Content-Type', (response.headers['content-type'] as string) || 'video/mp4');
    }

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );

    for (const [key, val] of Object.entries(response.headers)) {
      if (['content-length', 'accept-ranges', 'content-range', 'etag', 'last-modified'].includes(key.toLowerCase())) {
        res.setHeader(key, val as string);
      }
    }

    response.data.pipe(res);
  } catch (error: any) {
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
router.get('/stream', (req: Request, res: Response) => {
  const m3u8Url = req.query.m3u8 as string;
  if (!m3u8Url) {
    res.status(400).json({ success: false, error: 'm3u8 query param required' });
    return;
  }

  const filename = (req.query.filename as string) || 'video.mp4';

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'video/mp4');

  const referer = m3u8Url.includes('uqload') ? 'https://uqload.is/' : m3u8Url.includes('vidzy') ? 'https://vidzy.cc/' : '';
  const headers = `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n${referer ? `Referer: ${referer}\r\n` : ''}`;

  const ffmpeg = spawn('ffmpeg', [
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

  ffmpeg.stderr.on('data', () => {});

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

  req.on('close', () => {
    ffmpeg.kill();
  });
});

/**
 * GET /api/download/premium
 *
 * Téléchargement direct 1080p Full HD pour les membres Premium
 */
router.get('/premium', async (req: Request, res: Response) => {
  try {
    const title = req.query.title as string;
    if (!title) {
      res.status(400).json({ success: false, error: 'title query param required' });
      return;
    }

    const { getFrenchStreamMovie } = await import('../frenchstream/frenchstream.service');
    const movie = await getFrenchStreamMovie(title);

    if (!movie?.streamUrl) {
      res.status(404).json({ success: false, error: `Aucune version 1080p trouvée pour "${title}"` });
      return;
    }

    res.redirect(movie.streamUrl);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
