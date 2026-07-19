"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UqloadClient = void 0;
const axios_1 = __importDefault(require("axios"));
const API_BASE = 'https://uqload.is/api';
class UqloadClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async get(endpoint, params = {}) {
        const { data } = await axios_1.default.get(`${API_BASE}${endpoint}`, {
            params: { key: this.apiKey, ...params },
            timeout: 30000,
        });
        return data;
    }
    async getAccountInfo() {
        return this.get('/account/info');
    }
    async getAccountStats(lastDays = 7) {
        return this.get('/account/stats', { last: lastDays });
    }
    async getUploadServer() {
        const res = await this.get('/upload/server');
        return res.result;
    }
    async uploadByUrl(videoUrl, title, fldId) {
        const params = { url: videoUrl };
        if (title)
            params.file_title = title;
        if (fldId)
            params.fld_id = fldId;
        const res = await this.get('/upload/url', params);
        return res.result.filecode;
    }
    async getFileInfo(fileCode) {
        return this.get('/file/info', { file_code: fileCode });
    }
    async getDirectLink(fileCode, quality, hls) {
        const params = { file_code: fileCode };
        if (quality)
            params.q = quality;
        if (hls)
            params.hls = 1;
        return this.get('/file/direct_link', params);
    }
    async getFileList(fldId, page = 1, perPage = 50) {
        const params = { page, per_page: perPage };
        if (fldId)
            params.fld_id = fldId;
        return this.get('/file/list', params);
    }
    async editFile(fileCode, title, descr, tags) {
        const params = { file_code: fileCode };
        if (title)
            params.file_title = title;
        if (descr)
            params.file_descr = descr;
        if (tags)
            params.tags = tags;
        return this.get('/file/edit', params);
    }
    async deleteFile(fileCode) {
        return this.get('/file/delete', { file_code: fileCode });
    }
    async cloneFile(fileCode, newTitle, fldId) {
        const params = { file_code: fileCode };
        if (newTitle)
            params.file_title = newTitle;
        if (fldId)
            params.fld_id = fldId;
        const res = await this.get('/file/clone', params);
        return res.result.filecode;
    }
    async createFolder(name, parentId = 0, descr) {
        const params = { name, parent_id: parentId };
        if (descr)
            params.descr = descr;
        const res = await this.get('/folder/create', params);
        return parseInt(res.result.fld_id, 10);
    }
    async getFolderList(fldId = 0, includeFiles = false) {
        const params = { fld_id: fldId };
        if (includeFiles)
            params.files = 1;
        return this.get('/folder/list', params);
    }
    async deleteFolder(fldId) {
        return this.get('/folder/delete', { fld_id: fldId });
    }
}
exports.UqloadClient = UqloadClient;
