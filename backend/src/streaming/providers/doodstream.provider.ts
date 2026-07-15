import fs from 'fs';
import path from 'path';
import { StreamingProvider, StreamResult, StreamQuery } from './provider.interface';
import { getDirectDownloadUrl } from '../../modules/doodstream/doodstream.service';

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

export class DoodStreamProvider implements StreamingProvider {
  readonly name = 'doodstream';

  supports(query: StreamQuery): boolean {
    return !!query.title || !!query.tmdbId;
  }

  private findByTmdbId(tmdbId: number): { fileCode: string; info: any } | null {
    const uploaded = getUploadedFiles();
    for (const key of Object.keys(uploaded)) {
      const file = uploaded[key];
      if (file.tmdbId && Number(file.tmdbId) === tmdbId) {
        return { fileCode: file.fileCode, info: file };
      }
    }
    return null;
  }

  private findByTitle(title: string): { fileCode: string; info: any } | null {
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

  private findFile(query: StreamQuery): { fileCode: string; info: any } | null {
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
    const match = this.findFile(query);
    if (!match) return null;

    // Tier 1: direct MP4 from uploaded.json (lien → proxied through backend for Referer + CORS)
    if (match.info.lien) {
      return `/api/doodstream/stream?url=${encodeURIComponent(match.info.lien)}`;
    }

    // Tier 2: DoodStream API fresh download URL (proxied through backend)
    const apiUrl = await this.getApiDirectUrl(match.fileCode);
    if (apiUrl) {
      return apiUrl;
    }

    // Tier 3: DoodStream embed player (fallback)
    return `https://doodstream.com/e/${match.fileCode}`;
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    const embedUrl = await this.getStreamUrl(query);
    if (!embedUrl) return null;

    return {
      provider: this.name,
      embedUrl,
      type: 'movie',
    };
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    const embedUrl = await this.getStreamUrl(query);
    if (!embedUrl) return null;

    return {
      provider: this.name,
      embedUrl,
      type: 'episode',
    };
  }

  async getDownloadUrl(title: string, tmdbId?: number): Promise<string | null> {
    const query: StreamQuery = { tmdbId: tmdbId || 0, title };
    const match = this.findFile(query);
    if (!match) return null;

    return match.info.lien || `https://doodstream.com/d/${match.fileCode}`;
  }
}
