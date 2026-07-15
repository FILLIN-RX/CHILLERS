import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const UPLOADED_PATH = path.join(__dirname, '../../../uploaded.json');

function getUploadedFiles(): Record<string, any> {
  if (fs.existsSync(UPLOADED_PATH)) {
    return JSON.parse(fs.readFileSync(UPLOADED_PATH, 'utf-8'));
  }
  return {};
}

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
}

function findByTmdbId(tmdbId: number): { fileCode: string; info: any } | null {
  const uploaded = getUploadedFiles();
  for (const key of Object.keys(uploaded)) {
    const file = uploaded[key];
    if (file.tmdbId && Number(file.tmdbId) === tmdbId) {
      return { fileCode: file.fileCode, info: file };
    }
  }
  return null;
}

function findByTitle(title: string): { fileCode: string; info: any } | null {
  const uploaded = getUploadedFiles();
  const search = normalize(title);

  for (const key of Object.keys(uploaded)) {
    const file = uploaded[key];
    const fileTitle = normalize(file.titre || '');
    if (fileTitle === search || fileTitle.includes(search) || search.includes(fileTitle)) {
      return { fileCode: file.fileCode, info: file };
    }
  }

  for (const key of Object.keys(uploaded)) {
    const file = uploaded[key];
    const fileTitle = normalize(file.titre || '');
    if (fileTitle.includes(search.slice(0, 10)) || search.includes(fileTitle.slice(0, 10))) {
      return { fileCode: file.fileCode, info: file };
    }
  }

  return null;
}

export const getDownloadByTitle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, tmdb_id, file_code } = req.query as Record<string, string>;

    if (!title && !file_code && !tmdb_id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Missing ?title=, ?tmdb_id=, or ?file_code= param',
      });
    }

    let match: { fileCode: string; info: any } | null = null;

    if (tmdb_id) {
      match = findByTmdbId(Number(tmdb_id));
    }

    if (!match && file_code) {
      match = { fileCode: file_code, info: {} };
    }

    if (!match && title) {
      match = findByTitle(title);
    }

    if (!match) {
      return res.json({
        success: false,
        data: null,
        message: 'No DoodStream file found',
      });
    }

    return res.json({
      success: true,
      data: {
        fileCode: match.fileCode,
        directUrl: match.info.lien || null,
        downloadUrl: match.info.lien || `https://doodstream.com/d/${match.fileCode}`,
        title: match.info.titre || title || '',
        year: match.info.year || null,
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
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://vidzy.cc/',
      },
    });

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
