import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { listFiles, getFileDownloadUrl } from './doodstream.service';
import tmdbClient from '../../config/tmdb';
import Movie from '../../models/Movie';
import Serie from '../../models/Serie';

const UPLOADED_PATH = path.join(__dirname, '../../../uploaded.json');
const SERIES_OUTPUT_PATH = path.join(__dirname, '../../../series-output.json');

const SE_PATTERN = /[Ss](\d+)[Ee](\d+)/;

function parseSeasonEpisode(filename: string): { season: number; episode: number } | null {
  const match = filename.match(SE_PATTERN);
  if (match) {
    return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };
  }
  return null;
}

let cachedUploadedFiles: Record<string, any> | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 30 * 1000; // 30 seconds

function getUploadedFiles(): Record<string, any> {
  const now = Date.now();
  if (cachedUploadedFiles && (now - lastCacheTime < CACHE_TTL)) {
    return cachedUploadedFiles;
  }
  const all: Record<string, any> = {};
  if (fs.existsSync(UPLOADED_PATH)) {
    try {
      Object.assign(all, JSON.parse(fs.readFileSync(UPLOADED_PATH, 'utf-8')));
    } catch (e) {
      console.error('Error reading UPLOADED_PATH:', e);
    }
  }
  if (fs.existsSync(SERIES_OUTPUT_PATH)) {
    try {
      Object.assign(all, JSON.parse(fs.readFileSync(SERIES_OUTPUT_PATH, 'utf-8')));
    } catch (e) {
      console.error('Error reading SERIES_OUTPUT_PATH:', e);
    }
  }
  cachedUploadedFiles = all;
  lastCacheTime = now;
  return all;
}

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
}

function findByTmdbId(tmdbId: number, season?: number, episode?: number): { fileCode: string; info: any } | null {
  const uploaded = getUploadedFiles();
  let seriesFallback: { fileCode: string; info: any } | null = null;
  for (const key of Object.keys(uploaded)) {
    const file = uploaded[key];
    if (file.tmdbId && Number(file.tmdbId) === tmdbId) {
      if (season !== undefined && episode !== undefined) {
        if (file.season === season && file.episode === episode) {
          return { fileCode: file.fileCode, info: file };
        }
        continue;
      }
      if (!file.season && !file.episode) {
        return { fileCode: file.fileCode, info: file };
      }
      if (!seriesFallback) {
        seriesFallback = { fileCode: file.fileCode, info: file };
      }
    }
  }
  return seriesFallback;
}

function findByTitle(title: string, season?: number, episode?: number): { fileCode: string; info: any } | null {
  const uploaded = getUploadedFiles();
  const search = normalize(title);

  for (const key of Object.keys(uploaded)) {
    const file = uploaded[key];
    const fileTitle = normalize(file.titre || '');
    if (fileTitle === search || fileTitle.includes(search) || search.includes(fileTitle)) {
      if (season !== undefined && episode !== undefined) {
        if (file.season === season && file.episode === episode) return { fileCode: file.fileCode, info: file };
        continue;
      }
      if (!file.season && !file.episode) return { fileCode: file.fileCode, info: file };
    }
  }

  for (const key of Object.keys(uploaded)) {
    const file = uploaded[key];
    const fileTitle = normalize(file.titre || '');
    if (fileTitle.includes(search.slice(0, 10)) || search.includes(fileTitle.slice(0, 10))) {
      if (season !== undefined && episode !== undefined) {
        if (file.season === season && file.episode === episode) return { fileCode: file.fileCode, info: file };
        continue;
      }
      if (!file.season && !file.episode) return { fileCode: file.fileCode, info: file };
    }
  }

  // Third pass: no S/E filter → accept any match (series entries too)
  if (season === undefined && episode === undefined) {
    const search10 = search.slice(0, 10);
    for (const key of Object.keys(uploaded)) {
      const file = uploaded[key];
      const fileTitle = normalize(file.titre || '');
      if (fileTitle === search || fileTitle.includes(search) || search.includes(fileTitle) ||
          fileTitle.includes(search10) || search10.includes(fileTitle.slice(0, 10))) {
        return { fileCode: file.fileCode, info: file };
      }
    }
  }

  return null;
}

async function findByFolderFallback(tmdbId: number, season: number, episode: number): Promise<{ fileCode: string; info: any } | null> {
  const uploaded = getUploadedFiles();
  let fldId: string | null = null;

  for (const key of Object.keys(uploaded)) {
    const file = uploaded[key];
    if (file.tmdbId && Number(file.tmdbId) === tmdbId && file.fldId) {
      fldId = file.fldId;
      break;
    }
  }

  if (!fldId) return null;

  try {
    const result = await listFiles({ fldId, perPage: 100 });
    const files = result.files || result;
    if (!Array.isArray(files)) return null;

    for (const doodFile of files) {
      const parsed = parseSeasonEpisode(doodFile.title || doodFile.name || '');
      if (parsed && parsed.season === season && parsed.episode === episode) {
        return {
          fileCode: doodFile.filecode,
          info: { lien: doodFile.download_url || doodFile.protected_embed || doodFile.filecode, titre: doodFile.title },
        };
      }
    }
  } catch {
    // DoodStream API unavailable
  }

  return null;
}

async function findByMongoDB(title?: string, tmdbId?: number, season?: number, episode?: number): Promise<{ fileCode: string; info: any } | null> {
  try {
    if (!tmdbId && !title) return null;

    if (!season && !episode) {
      const movie = await Movie.findOne({
        $or: [
          ...(tmdbId ? [{ tmdbId }] : []),
          ...(title ? [{ titre: { $regex: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }] : []),
        ],
      }).exec();
      if (movie?.lien) {
        return { fileCode: '', info: { lien: movie.lien, titre: movie.titre } };
      }
    }

    if (season !== undefined && episode !== undefined) {
      const series = await Serie.findOne({
        $or: [
          ...(tmdbId ? [{ tmdbId }] : []),
          ...(title ? [{ titre: { $regex: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }] : []),
        ],
      }).exec();

      if (series) {
        const epLabel = `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
        const found = series.episodes.find(
          (ep: any) => ep.episode?.toUpperCase() === epLabel
        );
        if (found?.lien) {
          return { fileCode: '', info: { lien: found.lien, titre: `${series.titre} ${epLabel}` } };
        }
      }
    }
  } catch (err) {
    console.error('[DoodStream Download] MongoDB query error:', err);
  }
  return null;
}

export const getDownloadByTitle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, tmdb_id, file_code, season, episode } = req.query as Record<string, string>;
    const seasonNum = season ? parseInt(season, 10) : undefined;
    const episodeNum = episode ? parseInt(episode, 10) : undefined;

    if (!title && !file_code && !tmdb_id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Missing ?title=, ?tmdb_id=, or ?file_code= param',
      });
    }

    let match: { fileCode: string; info: any } | null = null;

    if (tmdb_id) {
      match = findByTmdbId(Number(tmdb_id), seasonNum, episodeNum);
    }

    if (!match && file_code) {
      match = { fileCode: file_code, info: {} };
    }

    if (!match && title) {
      match = findByTitle(title, seasonNum, episodeNum);
    }

    // Fallback: if season+episode requested but not found in json, try DoodStream folder listing
    if (!match && tmdb_id && seasonNum !== undefined && episodeNum !== undefined) {
      match = await findByFolderFallback(Number(tmdb_id), seasonNum, episodeNum);
    }

    // MongoDB fallback
    if (!match) {
      match = await findByMongoDB(title, tmdb_id ? Number(tmdb_id) : undefined, seasonNum, episodeNum);
    }

    if (!match) {
      return res.json({
        success: false,
        data: null,
        message: 'No DoodStream file found',
      });
    }

    // Decide which URL to actually hand back to the client.
    //
    // 1) The stored "lien" is a direct .mp4 / vidzy.cc URL → best
    //    option, downloads cleanly.
    // 2) Otherwise, ask the Doodstream API for a fresh protected
    //    download URL via the file_code.
    //
    // We must reject Doodstream *embed* pages (doodstream.com/e/...)
    // because the proxy fetches them as if they were video files and
    // they return a tiny HTML "downloader" page — that's the broken
    // KB-sized downloads the user was seeing for series.
    let downloadUrl: string | null = null;
    const storedLien: string | undefined = match.info.lien;
    const isDirectMediaUrl =
      !!storedLien &&
      !/doodstream\.com\/e\//i.test(storedLien) &&
      !/doodstream\.com\/d\//i.test(storedLien);

    if (isDirectMediaUrl) {
      downloadUrl = storedLien;
    } else if (match.fileCode) {
      try {
        const apiUrl = await getFileDownloadUrl(match.fileCode);
        if (apiUrl && !/doodstream\.com\/e\//i.test(apiUrl)) {
          downloadUrl = apiUrl;
        }
      } catch {
        // API indisponible
      }
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
        directUrl: downloadUrl,
        downloadUrl,
        title: match.info.titre || title || '',
        year: match.info.year || null,
        season: match.info.season || null,
        episode: match.info.episode || null,
      },
      message: null,
    });
  } catch (error) {
    next(error);
  }
};

export const proxyDownload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, filename } = req.query as Record<string, string>;

    if (!url) {
      return res.status(400).json({ success: false, message: 'Missing ?url= param' });
    }

    const downloadName = filename || 'video.mp4';

    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 300000,
      maxContentLength: Infinity,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://vidzy.cc/',
      },
      // Don't try to decompress — we want raw bytes piped through
      'decompress': false,
    });

    const rawContentType = response.headers['content-type'];
    const upstreamType = (typeof rawContentType === 'string' ? rawContentType : '').toLowerCase();
    const isHtml = upstreamType.includes('text/html') || upstreamType.includes('application/xhtml');

    if (isHtml) {
      // The upstream returned an HTML page (Doodstream "click to
      // download" page, an error page, etc.) — refuse to forward it
      // as a .mp4 download. The user would otherwise get a tiny
      // unplayable file.
      console.warn(`[PROXY] Refusing HTML upstream (${upstreamType}) for ${url}`);
      response.data.destroy();
      if (!res.headersSent) {
        return res.status(502).json({
          success: false,
          message: 'Upstream returned HTML, not a video file',
        });
      }
      return;
    }

    const contentLength = response.headers['content-length'] as string | undefined;
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

    response.data.pipe(res);
  } catch (error: any) {
    console.error('[PROXY] Download error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Download failed' });
    }
  }
};

export const proxyStream = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = req.query as Record<string, string>;

    if (!url) {
      return res.status(400).json({ success: false, message: 'Missing ?url= param' });
    }

    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 600000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://vidzy.cc/',
      },
    });

    const contentLength = response.headers['content-length'] as string | undefined;
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    res.setHeader('Content-Type', response.headers['content-type'] as string || 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');

    response.data.pipe(res);
  } catch (error: any) {
    console.error('[STREAM] Proxy error:', error.message);
    if (!res.headersSent) {
      res.status(502).json({ success: false, message: 'Stream unavailable' });
    }
  }
};

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

    // 1. Fetch TV series details from TMDB to get all seasons and episode counts
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

    // 2. Build the list of expected episodes (skip season 0 = specials)
    const expectedEpisodes: { season: number; episode: number }[] = [];
    for (const season of seriesData.seasons) {
      const seasonNum = season.season_number;
      if (seasonNum === 0 || !season.episode_count) continue;

      for (let epNum = 1; epNum <= season.episode_count; epNum++) {
        expectedEpisodes.push({ season: seasonNum, episode: epNum });
      }
    }

    // 3. Check each episode against the local JSON database
    const uploaded = getUploadedFiles();
    const missing: { season: number; episode: number }[] = [];
    const found: { season: number; episode: number; fileCode: string; downloadUrl: string | null }[] = [];

    for (const ep of expectedEpisodes) {
      let match: { fileCode: string; info: any } | null = null;

      for (const key of Object.keys(uploaded)) {
        const file = uploaded[key];
        if (
          file.tmdbId &&
          Number(file.tmdbId) === tmdbIdNum &&
          file.season === ep.season &&
          file.episode === ep.episode
        ) {
          match = { fileCode: file.fileCode, info: file };
          break;
        }
      }

      if (!match) {
        // Fallback: try DoodStream folder listing via the existing helper
        try {
          match = await findByFolderFallback(tmdbIdNum, ep.season, ep.episode);
        } catch {
          // ignore
        }
      }

      if (match) {
        let downloadUrl: string | null = null;
        const storedLien = match.info?.lien;
        const isDirectUrl =
          !!storedLien &&
          !/doodstream\.com\/e\//i.test(storedLien) &&
          !/doodstream\.com\/d\//i.test(storedLien);

        if (isDirectUrl) {
          downloadUrl = storedLien;
        } else if (match.fileCode) {
          try {
            const apiUrl = await getFileDownloadUrl(match.fileCode);
            if (apiUrl && !/doodstream\.com\/e\//i.test(apiUrl)) {
              downloadUrl = apiUrl;
            }
          } catch {
            // API unavailable
          }
        }

        found.push({
          season: ep.season,
          episode: ep.episode,
          fileCode: match.fileCode,
          downloadUrl,
        });
      } else {
        missing.push({ season: ep.season, episode: ep.episode });
      }
    }

    // 4. If any episodes are missing, block the download
    if (missing.length > 0) {
      return res.json({
        success: false,
        data: {
          missing,
          found: found.length,
          total: expectedEpisodes.length,
          seriesTitle: seriesData.name || seriesData.title || null,
        },
        message: `Série incomplète : ${missing.length} épisode(s) manquant(s)`,
      });
    }

    // 5. All episodes found — return their download URLs
    return res.json({
      success: true,
      data: {
        episodes: found,
        total: found.length,
        seriesTitle: seriesData.name || seriesData.title || null,
      },
      message: null,
    });
  } catch (error) {
    next(error);
  }
};
