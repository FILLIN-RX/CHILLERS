import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import tmdbClient from '../../config/tmdb';
import Movie from '../../models/Movie';
import Serie from '../../models/Serie';

/**
 * Vrai si l'URL est un fichier vidéo direct (.mp4) servi par un CDN qui
 * bloque l'IP du serveur (Uqload, vidzy…) mais pas celle du navigateur.
 * Le serveur ne peut pas vérifier la vivacité de ces liens (403), on les
 * renvoie donc tels quels : c'est le navigateur qui les ouvre directement.
 */
function isDirectMp4CdnUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return /\.mp4(\?|$)/i.test(url);
}

/**
 * Extrait le fileCode DoodStream d'une URL embed/download (/e/ ou /d/).
 * Permet de retomber sur une page /d/ téléchargeable quand seule une URL
 * embed est stockée en base (sans champ fileCode explicite).
 */
function extractDoodFileCode(url: string | undefined | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:doodstream\.com|playmogo\.com|d000d\.com|d0000d\.com|dood\.(?:to|sh|so|cx|la|wf|pm))\/(?:d|e)\/([a-zA-Z0-9]+)/i);
  return m ? m[1] : null;
}

/**
 * Résolution d'un fichier via MongoDB uniquement.
 *
 * Priorité stricte :
 *  1. tmdbId (s'il y a plusieurs docs avec le même tmdbId, on prend celui
 *     dont les épisodes couvrent la saison demandée)
 *  2. titre exact (fallback si pas de tmdbId)
 *
 * Aucune lecture des fichiers JSON (uploaded.json / series-output.json) :
 * ces fichiers sont obsolètes depuis la migration vers MongoDB.
 */
async function findByMongoDB(title?: string, tmdbId?: number, season?: number, episode?: number): Promise<{ fileCode: string; info: any } | null> {
  try {
    if (!tmdbId && !title) return null;

    // ── Films : pas de season/episode ───────────────────────────────────
    if (!season && !episode) {
      let movie = tmdbId ? await Movie.findOne({ tmdbId }).exec() : null;
      if (!movie && title) {
        const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        movie = await Movie.findOne({ titre: { $regex: new RegExp(`^${escaped}$`, 'i') } }).exec();
      }
      if (movie) {
        const lien = movie.uqloadLink || movie.lien;
        const fileCode = movie.fileCode || extractDoodFileCode(movie.lien) || extractDoodFileCode(movie.uqloadLink) || '';
        if (lien || fileCode) {
          return {
            fileCode,
            info: {
              lien,
              titre: movie.titre,
              tmdbId: movie.tmdbId,
              uqloadLink: movie.uqloadLink,
              uqloadCode: movie.uqloadCode,
              lienFallback: movie.lien !== lien ? movie.lien : undefined,
            },
          };
        }
      }
    }

    // ── Séries : avec season/episode ────────────────────────────────────
    if (season !== undefined && episode !== undefined) {
      let series: any = null;
      if (tmdbId) {
        const byId = await Serie.find({ tmdbId }).exec();
        if (byId.length) {
          // Préférer la série dont les épisodes contiennent la saison
          // demandée (cas des doublons tmdbId : séries homonymes).
          series = byId.find((s: any) => s.episodes?.some(
            (e: any) => Number(e.season) === Number(season)
          )) || byId[0];
        }
      }
      if (!series && title) {
        const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        series = await Serie.findOne({ titre: { $regex: new RegExp(`^${escaped}$`, 'i') } }).exec();
      }

      if (series) {
        const epLabel = `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
        const found = series.episodes.find(
          (ep: any) =>
            (Number(ep.season) === Number(season) && Number(ep.episodeNumber) === Number(episode)) ||
            ep.episode?.toUpperCase() === epLabel
        );
        if (found) {
          const lien = found.uqloadLink || found.lien;
          const fileCode = found.fileCode || extractDoodFileCode(found.lien) || extractDoodFileCode(found.uqloadLink) || '';
          if (lien || fileCode) {
            return {
              fileCode,
              info: {
                lien,
                titre: `${series.titre} ${epLabel}`,
                tmdbId: series.tmdbId,
                season: found.season,
                episode: found.episodeNumber,
                uqloadLink: found.uqloadLink,
                uqloadCode: found.uqloadCode,
                lienFallback: found.lien !== lien ? found.lien : undefined,
              },
            };
          }
        }
      }
    }
  } catch (err) {
    console.error('[DoodStream Download] MongoDB query error:', err);
  }
  return null;
}

/**
 * Trouve un uqloadCode pour un film/épisode donné. Utilisé comme étape
 * d'enrichissement : si la doc Mongo a un uqloadCode, on peut régénérer
 * une URL fraîche via l'API Uqload avant de rendre la réponse.
 */
async function getUqloadCode(tmdbId: number | undefined, season?: number, episode?: number): Promise<string | null> {
  if (!tmdbId) return null;
  try {
    if (season !== undefined && episode !== undefined) {
      const byId = await Serie.find({ tmdbId }).exec();
      const s = byId.find((doc: any) => doc.episodes?.some(
        (e: any) => Number(e.season) === Number(season)
      )) || byId[0];
      if (!s) return null;
      const ep = s.episodes.find((e: any) =>
        Number(e.season) === Number(season) && Number(e.episodeNumber) === Number(episode)
      );
      return ep?.uqloadCode || null;
    }
    const m = await Movie.findOne({ tmdbId }).exec();
    return m?.uqloadCode || null;
  } catch {
    return null;
  }
}

/**
 * Scraping de l'embed Uqload pour obtenir un lien direct frais.
 * Met à jour MongoDB en cache pour le prochain appel.
 */
async function refreshUqloadLink(uqloadCode: string, tmdbId?: number, season?: number, episode?: number): Promise<string | null> {
  try {
    const { getUqloadDirectLink } = await import('../../streaming/providers/direct-scraper');
    const embedUrl = `https://uqload.is/embed-${uqloadCode}.html`;
    const scraped = await getUqloadDirectLink(uqloadCode, false);
    if (!scraped) return null;

    const freshUrl = scraped.directUrl;
    console.log(`[Download] Uqload fresh URL for code=${uqloadCode}: ${freshUrl.slice(0, 100)}`);

    // Update MongoDB avec le lien frais (cache pour le prochain appel)
    try {
      if (season !== undefined && episode !== undefined) {
        await Serie.updateOne(
          { tmdbId, 'episodes.uqloadCode': uqloadCode },
          { $set: { 'episodes.$.uqloadLink': freshUrl } }
        );
      } else if (tmdbId) {
        await Movie.updateOne(
          { tmdbId },
          { $set: { uqloadLink: freshUrl } }
        );
      }
    } catch (dbErr: any) {
      console.log(`[Download] MongoDB update failed: ${dbErr.message}`);
    }

    return freshUrl;
  } catch (err: any) {
    console.log(`[Download] Uqload refresh failed for code=${uqloadCode}: ${err.message}`);
    return null;
  }
}

export const getDownloadByTitle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, tmdb_id, file_code, season, episode } = req.query as Record<string, string>;
    const seasonNum = season ? parseInt(season, 10) : undefined;
    const episodeNum = episode ? parseInt(episode, 10) : undefined;
    const tmdbIdNum = tmdb_id ? Number(tmdb_id) : undefined;

    if (!title && !file_code && !tmdbIdNum) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Missing ?title=, ?tmdb_id=, or ?file_code= param',
      });
    }

    // Cas particulier : file_code direct (pas de lookup Mongo)
    if (!title && !tmdbIdNum && file_code) {
      const downloadUrl = `https://doodstream.com/d/${file_code}`;
      return res.json({
        success: true,
        data: { fileCode: file_code, directUrl: downloadUrl, downloadUrl, title: '', year: null, season: null, episode: null },
        message: null,
      });
    }

    // Lookup MongoDB
    const match = await findByMongoDB(title, tmdbIdNum, seasonNum, episodeNum);

    if (!match) {
      return res.json({
        success: false,
        data: null,
        message: 'No downloadable file found in MongoDB',
      });
    }

    const info = match.info;
    let downloadUrl: string | null = null;

    // 1) Uqload : si on a un uqloadCode, on régénère un lien frais via l'API
    if (info.uqloadCode && tmdbIdNum) {
      downloadUrl = await refreshUqloadLink(info.uqloadCode, tmdbIdNum, seasonNum, episodeNum);
    }

    // 2) Sinon, on prend le lien Uqload stocké s'il est utilisable directement
    if (!downloadUrl && info.uqloadLink && isDirectMp4CdnUrl(info.uqloadLink)) {
      downloadUrl = info.uqloadLink;
    }

    // 3) Sinon, le lien historique (vidzy / ancien uqload MP4)
    if (!downloadUrl && info.lien && info.lien !== '#' && isDirectMp4CdnUrl(info.lien)) {
      downloadUrl = info.lien;
    }

    // 4) Fallback DoodStream /d/ page si on a un fileCode
    if (!downloadUrl && match.fileCode) {
      downloadUrl = `https://doodstream.com/d/${match.fileCode}`;
    }

    if (!downloadUrl) {
      return res.json({
        success: false,
        data: null,
        message: 'No downloadable URL found for this episode',
      });
    }

    return res.json({
      success: true,
      data: {
        fileCode: match.fileCode,
        uqloadCode: info.uqloadCode || null,
        directUrl: downloadUrl,
        downloadUrl,
        title: info.titre || title || '',
        year: info.year || null,
        season: info.season || null,
        episode: info.episode || null,
      },
      message: null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Proxy de téléchargement : pipe le contenu au navigateur en passant par
 * le backend quand le navigateur ne peut pas consommer l'URL directement
 * (CDN bloquant par Referer, etc.).
 *
 * Flow :
 *  1. DoodStream /d/ → redirect direct (c'est une page HTML, pas un MP4)
 *  2. HLS .m3u8 → redirige vers /api/download/stream (FFmpeg convertit)
 *  3. MP4 direct → tente de piper depuis le backend (avec Referer uqload.is)
 *  4. Si 403/HTML → fallback HLS via clone + API Uqload
 */
export const proxyDownload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, filename } = req.query as Record<string, string>;

    if (!url) {
      return res.status(400).json({ success: false, message: 'Missing ?url= param' });
    }

    // Page DoodStream /d/ → redirect plutôt que proxy (c'est une page HTML)
    if (/doodstream\.com\/d\//i.test(url)) {
      return res.redirect(302, url);
    }

    // URL HLS Uqload (.m3u8) : on redirige vers le proxy FFmpeg qui convertit
    // le HLS en MP4 à la volée.
    if (/\.m3u8(\?|$)/i.test(url)) {
      const downloadName = filename || 'video.mp4';
      const hlsProxyUrl = `/api/download/stream?m3u8=${encodeURIComponent(url)}&filename=${encodeURIComponent(downloadName)}`;
      return res.redirect(302, hlsProxyUrl);
    }

    const downloadName = filename || 'video.mp4';

    // ── Étape 1 : Tenter le MP4 direct depuis le backend ──────────────
    try {
      const response = await axios.get(url, {
        responseType: 'stream',
        timeout: 300000,
        maxContentLength: Infinity,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://uqload.is/',
        },
        'decompress': false,
        validateStatus: (s) => s < 400,
      });

      const rawContentType = response.headers['content-type'];
      const upstreamType = (typeof rawContentType === 'string' ? rawContentType : '').toLowerCase();
      const isHtml = upstreamType.includes('text/html') || upstreamType.includes('application/xhtml');

      if (!isHtml) {
        const contentLength = response.headers['content-length'] as string | undefined;
        if (contentLength) res.setHeader('Content-Length', contentLength);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        response.data.pipe(res);
        return;
      }
      response.data.destroy();
      console.log(`[PROXY] MP4 direct bloqué (HTML), fallback HLS pour ${url}`);
    } catch {
      console.log(`[PROXY] MP4 direct 403/erreur, fallback HLS pour ${url}`);
    }

    // ── Étape 2 : Fallback HLS via l'API Uqload ────────────────────────
    // Extraire le file_code depuis l'URL, cloner, et récupérer le HLS
    const uqloadMatch = url.match(/uqload\.is\/v\/[^/]+\/[^/]+\/([a-z0-9]+)_/i);
    const fileCode = uqloadMatch?.[1] || url.match(/([a-z0-9]{12})/i)?.[1];
    if (!fileCode) {
      return res.status(502).json({ success: false, message: 'No fallback available' });
    }

    const API_KEY = process.env.UQLOAD_API_KEY || '';
    if (!API_KEY) {
      return res.status(502).json({ success: false, message: 'No API key for HLS fallback' });
    }

    // Cloner pour un nouveau filecode + direct_link HLS
    const cloneRes = await axios.get(`https://uqload.is/api/file/clone?key=${API_KEY}&file_code=${fileCode}`, { timeout: 10000 });
    const cloneCode = cloneRes.data?.result?.filecode;
    if (!cloneCode) {
      return res.status(502).json({ success: false, message: 'Clone failed for HLS fallback' });
    }

    const hlsRes = await axios.get(`https://uqload.is/api/file/direct_link?key=${API_KEY}&file_code=${cloneCode}&hls=1`, { timeout: 10000 });
    const hlsUrl = hlsRes.data?.result?.hls_direct;
    if (!hlsUrl) {
      return res.status(502).json({ success: false, message: 'HLS direct_link failed' });
    }

    // Proxy l'HLS → FFmpeg convertit en MP4 et stream au navigateur
    const ffmpegProxyUrl = `/api/download/stream?m3u8=${encodeURIComponent(hlsUrl)}&filename=${encodeURIComponent(downloadName)}`;
    console.log(`[PROXY] Fallback HLS download: ${ffmpegProxyUrl.slice(0, 100)}`);
    res.redirect(302, ffmpegProxyUrl);
  } catch (error: any) {
    console.error('[PROXY] Download error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Download failed' });
    }
  }
};

export const proxyStream = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, referer } = req.query as Record<string, string>;

    if (!url) {
      return res.status(400).json({ success: false, message: 'Missing ?url= param' });
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': referer || 'https://vidzy.cc/',
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range as string;
    }

    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 600000,
      maxRedirects: 5,
      headers,
    });

    const contentType = (response.headers['content-type'] as string || '').toLowerCase();
    const isHls = contentType.includes('mpegurl') || url.endsWith('.m3u8');

    if (isHls) {
      const contentLength = response.headers['content-length'] as string | undefined;
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const body = await axios.get(url, {
        timeout: 30000,
        headers,
        responseType: 'text',
      });

      const baseUrl = new URL(url);
      const origin = baseUrl.origin;
      const baseDir = url.substring(0, url.lastIndexOf('/') + 1);

      const rewritten = (body.data as string).split('\n').map((line: string) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;

        let absoluteUrl = trimmed;
        if (trimmed.startsWith('//')) {
          absoluteUrl = 'https:' + trimmed;
        } else if (trimmed.startsWith('/')) {
          absoluteUrl = origin + trimmed;
        } else if (!trimmed.startsWith('http')) {
          absoluteUrl = baseDir + trimmed;
        }

        const encodedUrl = encodeURIComponent(absoluteUrl);
        return `/api/doodstream/stream?url=${encodedUrl}&referer=${encodeURIComponent(referer || 'https://uqload.is/')}`;
      }).join('\n');

      res.send(rewritten);
      return;
    }

    const contentLength = response.headers['content-length'] as string | undefined;
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    const contentRange = response.headers['content-range'] as string | undefined;
    if (contentRange) {
      res.setHeader('Content-Range', contentRange);
    }

    const acceptRanges = response.headers['accept-ranges'] as string | undefined;
    if (acceptRanges) {
      res.setHeader('Accept-Ranges', acceptRanges);
    }

    res.setHeader('Content-Type', response.headers['content-type'] as string || 'video/mp4');
    if (req.headers.range) {
      res.setHeader('Accept-Ranges', 'bytes');
    }

    res.status(response.status);
    response.data.pipe(res);
  } catch (error: any) {
    console.error('[STREAM] Proxy error:', error.message);
    if (!res.headersSent) {
      res.status(502).json({ success: false, message: 'Stream unavailable' });
    }
  }
};

/**
 * Vérifie la disponibilité de tous les épisodes d'une série sur la plateforme.
 * Source unique : MongoDB. Aucun fallback JSON.
 */
export const getSeriesDownloadCheck = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tmdb_id } = req.query as Record<string, string>;

    if (!tmdb_id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Missing ?tmdb_id= param',
      });
    }

    const tmdbIdNum = Number(tmdb_id);
    if (isNaN(tmdbIdNum)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Invalid tmdb_id',
      });
    }

    // 1. Fetch TV series details from TMDB
    const language = req.query.language as string | undefined;
    const { toTMDBLanguage } = await import('../../config/language');
    const tmdbRes = await tmdbClient.get(`/tv/${tmdbIdNum}`, {
      params: { language: toTMDBLanguage(language) },
    });
    const seriesData = tmdbRes.data;

    if (!seriesData || !seriesData.seasons) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Series not found on TMDB',
      });
    }

    // 2. Build expected episodes (skip season 0 = specials)
    const expectedEpisodes: { season: number; episode: number }[] = [];
    for (const season of seriesData.seasons) {
      const seasonNum = season.season_number;
      if (seasonNum === 0 || !season.episode_count) continue;
      for (let epNum = 1; epNum <= season.episode_count; epNum++) {
        expectedEpisodes.push({ season: seasonNum, episode: epNum });
      }
    }

    // 3. Trouver le bon document MongoDB (par tmdbId d'abord, par titre en fallback)
    const serie = await (async () => {
      const byId = await Serie.find({ tmdbId: tmdbIdNum }).exec();
      if (byId.length) {
        // Préférer la série dont les épisodes couvrent le plus de saisons
        // attendues (cas des doublons tmdbId : séries homonymes).
        let best = byId[0];
        let bestScore = -1;
        for (const s of byId) {
          const score = s.episodes?.filter(
            (e: any) => expectedEpisodes.some(ep => Number(e.season) === ep.season)
          ).length || 0;
          if (score > bestScore) { bestScore = score; best = s; }
        }
        return best;
      }
      if (seriesData.name) {
        const escaped = seriesData.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return Serie.findOne({ titre: { $regex: new RegExp(`^${escaped}$`, 'i') } }).exec();
      }
      return null;
    })();

    const missing: { season: number; episode: number }[] = [];
    const found: { season: number; episode: number; fileCode: string; uqloadCode?: string; downloadUrl: string | null }[] = [];

    for (const ep of expectedEpisodes) {
      let match: { fileCode: string; info: any } | null = null;

      if (serie) {
        const epLabel = `S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}`;
        const foundEp = serie.episodes.find(
          (e: any) =>
            (Number(e.season) === Number(ep.season) && Number(e.episodeNumber) === Number(ep.episode)) ||
            e.episode?.toUpperCase() === epLabel
        );
        // uqloadCode suffit : le téléchargement simple le scrape pour produire
        // une URL fraîche (getDownloadByTitle fait pareil).
        if (foundEp && (foundEp.uqloadLink || foundEp.lien || foundEp.fileCode || foundEp.uqloadCode)) {
          const lien = foundEp.uqloadLink || foundEp.lien;
          match = {
            fileCode: foundEp.fileCode || '',
            info: {
              lien,
              titre: `${serie.titre} ${epLabel}`,
              uqloadLink: foundEp.uqloadLink,
              uqloadCode: foundEp.uqloadCode,
              lienFallback: foundEp.lien !== lien ? foundEp.lien : undefined,
            },
          };
        }
      }

      if (!match) {
        missing.push({ season: ep.season, episode: ep.episode });
        continue;
      }

      // Calcul du downloadUrl
      let downloadUrl: string | null = null;
      const candidates = [
        match.info?.uqloadLink,
        match.info?.lien,
        match.info?.lienFallback,
      ].filter(Boolean) as string[];
      for (const url of [...new Set(candidates)]) {
        if (isDirectMp4CdnUrl(url)) {
          downloadUrl = url;
          break;
        }
      }
      if (!downloadUrl) {
        const doodCode =
          match.fileCode ||
          extractDoodFileCode(match.info?.lien) ||
          extractDoodFileCode(match.info?.uqloadLink) ||
          extractDoodFileCode(match.info?.lienFallback);
        if (doodCode) {
          downloadUrl = `https://doodstream.com/d/${doodCode}`;
        }
      }

      found.push({
        season: ep.season,
        episode: ep.episode,
        fileCode: match.fileCode || '',
        uqloadCode: match.info?.uqloadCode || undefined,
        downloadUrl,
      });
    }

    return res.json({
      success: found.length > 0,
      data: {
        missing,
        episodes: found,
        found: found.length,
        total: expectedEpisodes.length,
        seriesTitle: seriesData.name || seriesData.title || null,
      },
      message: found.length > 0
        ? null
        : `Série incomplète : ${missing.length} épisode(s) manquant(s)`,
    });
  } catch (error) {
    next(error);
  }
};
