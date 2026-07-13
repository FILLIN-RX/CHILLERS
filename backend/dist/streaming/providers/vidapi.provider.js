"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VidAPIProvider = void 0;
const BASE_URL = 'https://vidapi.xyz/embed';
class VidAPIProvider {
    constructor() {
        this.name = 'vidapi';
    }
    supports(_query) {
        return true;
    }
    async getMovieStream(query) {
        const embedUrl = `${BASE_URL}/movie/${query.tmdbId}`;
        return { provider: this.name, embedUrl, type: 'movie' };
    }
    async getEpisodeStream(query) {
        const embedUrl = `${BASE_URL}/tv/${query.tmdbId}/${query.season || 1}/${query.episode || 1}`;
        return { provider: this.name, embedUrl, type: 'episode' };
    }
}
exports.VidAPIProvider = VidAPIProvider;
