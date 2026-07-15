import fs from 'fs';
import path from 'path';
import { StreamingProvider, StreamResult, StreamQuery } from './provider.interface';
import { getDirectDownloadUrl, listFiles } from '../../modules/doodstream/doodstream.service';

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
    for (const key of Object.keys(uploaded)) {
      const file = uploaded[key];
      if (file.tmdbId && Number(file.tmdbId) === tmdbId) {
        // If season/episode are requested, only match entries with matching S/E
        if (season !== undefined && episode !== undefined) {
          if (file.season === season && file.episode === episode) {
            return { fileCode: file.fileCode, info: file };
          }
          continue;
        }
        // No S/E requested → prefer entries without S/E (movies)
        if (!file.season && !file.episode) {
          return { fileCode: file.fileCode, info: file };
        }
      }
    }
    return null;
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

  private async findFile(query: StreamQuery): Promise<{ fileCode: string; info: any } | null> {
    const season = query.season;
    const episode = query.episode;

    // Option A: search uploaded.json by tmdbId + season + episode
    if (query.tmdbId) {
      const byId = this.findByTmdbId(query.tmdbId, season, episode);
      if (byId) return byId;
    }

    if (query.title) {
      const byTitle = this.findByTitle(query.title, season, episode);
      if (byTitle) return byTitle;
    }

    // Option B fallback: if we have season+episode but no json match, try DoodStream folder listing
    if (query.tmdbId && season !== undefined && episode !== undefined) {
      const fallback = await this.findByFolderFallback(query.tmdbId, season, episode);
      if (fallback) return fallback;
    }

    // Final fallback: match without S/E (same as old behavior)
    if (query.tmdbId) {
      const byId = this.findByTmdbId(query.tmdbId);
      if (byId) return byId;
    }
    if (query.title) {
      return this.findByTitle(query.title);
    }

    return null;
  }

  private async getApiDirectUrl(fileCode: string): Promise<string | null> {
    try {
      const dlUrl = await getDirectDownloadUrl(fileCode);
      if (dlUrl) {
        return `/api/doodstream/stream?url=${encodeURIComponent(dlUrl)}`;
      }
    } catch {
      // API unavailable, fall through
    }
    return null;
  }

  private async getStreamUrl(query: StreamQuery): Promise<string | null> {
    const match = await this.findFile(query);
    if (!match) return null;

    // Tier 1: direct MP4 from uploaded.json (lien → proxied through backend)
    if (match.info.lien) {
      return `/api/doodstream/stream?url=${encodeURIComponent(match.info.lien)}`;
    }

    // Tier 2: DoodStream API fresh download URL (proxied through backend)
    const apiUrl = await this.getApiDirectUrl(match.fileCode);
    if (apiUrl) return apiUrl;

    // Tier 3: DoodStream embed player (fallback)
    return `https://doodstream.com/e/${match.fileCode}`;
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
    return match.info.lien || `https://doodstream.com/d/${match.fileCode}`;
  }
}
