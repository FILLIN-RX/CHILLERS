import axios from 'axios';
import { UqloadApiResponse, UqloadAccountInfo, UqloadFileInfo, UqloadDirectLinkResult, UqloadFileListEntry } from './uqload.types';

const API_BASE = 'https://uqload.is/api';

export class UqloadClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async get<T>(endpoint: string, params: Record<string, any> = {}): Promise<UqloadApiResponse<T>> {
    const { data } = await axios.get(`${API_BASE}${endpoint}`, {
      params: { key: this.apiKey, ...params },
      timeout: 30000,
    });
    return data;
  }

  async getAccountInfo(): Promise<UqloadApiResponse<UqloadAccountInfo>> {
    return this.get<UqloadAccountInfo>('/account/info');
  }

  async getAccountStats(lastDays: number = 7) {
    return this.get('/account/stats', { last: lastDays });
  }

  async getUploadServer(): Promise<string> {
    const res = await this.get<{ server?: string }>('/upload/server');
    return res.result as any;
  }

  async uploadByUrl(videoUrl: string, title?: string, fldId?: number): Promise<string> {
    const params: Record<string, any> = { url: videoUrl };
    if (title) params.file_title = title;
    if (fldId) params.fld_id = fldId;

    const res = await this.get<{ filecode: string }>('/upload/url', params);
    return res.result.filecode;
  }

  async getFileInfo(fileCode: string): Promise<UqloadApiResponse<UqloadFileInfo[]>> {
    return this.get<UqloadFileInfo[]>('/file/info', { file_code: fileCode });
  }

  async getDirectLink(fileCode: string, quality?: string, hls?: boolean): Promise<UqloadApiResponse<UqloadDirectLinkResult>> {
    const params: Record<string, any> = { file_code: fileCode };
    if (quality) params.q = quality;
    if (hls) params.hls = 1;
    return this.get<UqloadDirectLinkResult>('/file/direct_link', params);
  }

  async getFileList(fldId?: number, page: number = 1, perPage: number = 50): Promise<UqloadApiResponse<{ files: UqloadFileListEntry[]; results_total: number; pages: number; results: number }>> {
    const params: Record<string, any> = { page, per_page: perPage };
    if (fldId) params.fld_id = fldId;
    return this.get('/file/list', params);
  }

  async editFile(fileCode: string, title?: string, descr?: string, tags?: string) {
    const params: Record<string, any> = { file_code: fileCode };
    if (title) params.file_title = title;
    if (descr) params.file_descr = descr;
    if (tags) params.tags = tags;
    return this.get('/file/edit', params);
  }

  async waitForFileReady(fileCode: string, maxRetries = 30, interval = 3000): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const info = await this.getFileInfo(fileCode);
        if (info.result && info.result.length > 0 && info.result[0].status === 200) {
          return true;
        }
      } catch {}
      await new Promise(r => setTimeout(r, interval));
    }
    return false;
  }

  async uploadByUrlAndGetLink(videoUrl: string, title?: string): Promise<{ fileCode: string; directLink: UqloadDirectLinkResult | null }> {
    const fileCode = await this.uploadByUrl(videoUrl, title);
    const ready = await this.waitForFileReady(fileCode);
    if (!ready) {
      console.log(`[Uqload] Fichier pas prêt après 90s: ${fileCode}`);
      return { fileCode, directLink: null };
    }
    const dlResult = await this.getDirectLink(fileCode);
    return { fileCode, directLink: dlResult.result };
  }

  async deleteFile(fileCode: string) {
    return this.get('/file/delete', { file_code: fileCode });
  }

  async cloneFile(fileCode: string, newTitle?: string, fldId?: number): Promise<string> {
    const params: Record<string, any> = { file_code: fileCode };
    if (newTitle) params.file_title = newTitle;
    if (fldId) params.fld_id = fldId;
    const res = await this.get<{ filecode: string }>('/file/clone', params);
    return res.result.filecode;
  }

  async createFolder(name: string, parentId: number = 0, descr?: string): Promise<number> {
    const params: Record<string, any> = { name, parent_id: parentId };
    if (descr) params.descr = descr;
    const res = await this.get<{ fld_id: string }>('/folder/create', params);
    return parseInt(res.result.fld_id, 10);
  }

  async getFolderList(fldId: number = 0, includeFiles: boolean = false) {
    const params: Record<string, any> = { fld_id: fldId };
    if (includeFiles) params.files = 1;
    return this.get('/folder/list', params);
  }

  async deleteFolder(fldId: number) {
    return this.get('/folder/delete', { fld_id: fldId });
  }
}
