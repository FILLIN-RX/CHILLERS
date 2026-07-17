import fs from 'fs';
import path from 'path';
import { StreamingProvider, StreamResult, StreamQuery } from './provider.interface';
import { getFileDownloadUrl, listFiles } from '../../modules/doodstream/doodstream.service';
import Serie from '../../models/Serie';
import Movie from '../../models/Movie';

const UPLOADED_PATH = path.join(__dirname, '../../../uploaded.json');
const SERIES_OUTPUT_PATH = path.join(__dirname, '../../../series-output.json');

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
  return str
    .toLowerCase()
    .replace(/[-–—:]/g, ' ')
    .replace(/saison\s*\d+/gi, '')
    .replace(/season\s*\d+/gi, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

const SE_PATTERN = /[Ss](\d+)[Ee](\d+)/;

function parseSeasonEpisode(filename: string): { season: number; episode: number } | null {
  const match = filename.match(SE_PATTERN);
  if (match) {
    return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };
  }
  return null;
}

export class DoodStreamProvider implements StreamingProvider {
  readonly name = 'doodstream';

  supports(query: StreamQuery): boolean {
    return !!query.title || !!query.tmdbId;
  }

  private findByTmdbId(tmdbId: number, season?: number, episode?: number): { fileCode: string; info: any } | null {
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
        // Sans S/E, garder le premier match série comme fallback
        if (!seriesFallback) {
          seriesFallback = { fileCode: file.fileCode, info: file };
        }
      }
    }
    // Si pas de film trouvé, retourner le premier épisode trouvé
    return seriesFallback;
  }

  private findByTitle(title: string, season?: number, episode?: number): { fileCode: string; info: any } | null {
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

    // Second pass: looser match
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

  private async findByFolderFallback(tmdbId: number, season: number, episode: number): Promise<{ fileCode: string; info: any } | null> {
    // Option B: find the series folderId from any S/E entry for this tmdbId, then list files on DoodStream
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
      // DoodStream API unavailable, return null
    }

    return null;
  }

  private async findByMongoDB(query: StreamQuery): Promise<{ fileCode: string; info: any } | null> {
    try {
      if (query.type === 'movie' || (!query.season && !query.episode)) {
        const movie = await Movie.findOne({
          $or: [
            ...(query.tmdbId ? [{ tmdbId: query.tmdbId }] : []),
            ...(query.title ? [{ titre: { $regex: new RegExp(query.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }] : []),
          ],
        }).exec();
        if (movie?.lien) {
          console.log(`[DoodStream] MongoDB match movie="${movie.titre}" → ${movie.lien.slice(0, 60)}`);
          return { fileCode: '', info: { lien: movie.lien, titre: movie.titre } };
        }
      }

      if (query.season !== undefined && query.episode !== undefined) {
        const series = await Serie.findOne({
          $or: [
            ...(query.tmdbId ? [{ tmdbId: query.tmdbId }] : []),
            ...(query.title ? [{ titre: { $regex: new RegExp(query.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }] : []),
          ],
        }).exec();

        if (series) {
          const epLabel = `S${String(query.season).padStart(2, '0')}E${String(query.episode).padStart(2, '0')}`;
          const found = series.episodes.find(
            (ep: any) => ep.episode?.toUpperCase() === epLabel
          );
          if (found?.lien) {
            console.log(`[DoodStream] MongoDB match series="${series.titre}" ${epLabel} → ${found.lien.slice(0, 60)}`);
            return { fileCode: '', info: { lien: found.lien, titre: `${series.titre} ${epLabel}` } };
          }
        }
      }
    } catch (err) {
      console.error('[DoodStream] MongoDB query error:', err);
    }
    return null;
  }

  private async findFile(query: StreamQuery): Promise<{ fileCode: string; info: any } | null> {
    const season = query.season;
    const episode = query.episode;

    if (query.tmdbId) {
      const byId = this.findByTmdbId(query.tmdbId, season, episode);
      if (byId) {
        console.log(`[DoodStream] Match by tmdbId=${query.tmdbId} S${season}E${episode} → ${byId.fileCode}`);
        return byId;
      }
    }

    if (query.title) {
      const byTitle = this.findByTitle(query.title, season, episode);
      if (byTitle) {
        console.log(`[DoodStream] Match by title="${query.title}" S${season}E${episode} → ${byTitle.fileCode}`);
        return byTitle;
      }
    }

    // Option B fallback: if we have season+episode but no json match, try DoodStream folder listing
    if (query.tmdbId && season !== undefined && episode !== undefined) {
      const fallback = await this.findByFolderFallback(query.tmdbId, season, episode);
      if (fallback) {
        console.log(`[DoodStream] Match by folder fallback tmdbId=${query.tmdbId} S${season}E${episode} → ${fallback.fileCode}`);
        return fallback;
      }
    }

    // MongoDB fallback
    const mongo = await this.findByMongoDB(query);
    if (mongo) {
      console.log(`[DoodStream] Match by MongoDB for tmdbId=${query.tmdbId} title="${query.title}"`);
      return mongo;
    }

    // Final fallback: match without S/E
    if (query.tmdbId) {
      const byId = this.findByTmdbId(query.tmdbId);
      if (byId) return byId;
    }
    if (query.title) {
      return this.findByTitle(query.title);
    }

    console.log(`[DoodStream] No match for tmdbId=${query.tmdbId} title="${query.title}" S${season}E${episode}`);
    return null;
  }

  private async getStreamUrl(query: StreamQuery): Promise<string | null> {
    const match = await this.findFile(query);
    if (!match) return null;

    // Prefer the direct .mp4 / vidzy.cc link when it's available — it
    // plays in a native <video> element with no ads, no anti-embed
    // scripts, and no risk of the embed provider breaking out of the
    // iframe (window.top.history.back).
    if (match.info.lien) return match.info.lien;

    if (match.fileCode) return `https://doodstream.com/e/${match.fileCode}`;

    return null;
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    const embedUrl = await this.getStreamUrl(query);
    if (!embedUrl) return null;
    return { provider: this.name, embedUrl, type: 'movie' };
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    const embedUrl = await this.getStreamUrl(query);
    if (!embedUrl) return null;
    return { provider: this.name, embedUrl, type: 'episode' };
  }

  async getDownloadUrl(title: string, tmdbId?: number): Promise<string | null> {
    const query: StreamQuery = { tmdbId: tmdbId || 0, title };
    const match = await this.findFile(query);
    if (!match) return null;

    if (match.fileCode) {
      try {
        const dlUrl = await getFileDownloadUrl(match.fileCode);
        if (dlUrl) return dlUrl;
      } catch {
        // API indisponible, fallback au lien stocké
      }
    }

    return match.info.lien || null;
  }
}
