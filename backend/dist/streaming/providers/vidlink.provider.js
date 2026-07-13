"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VidLinkProvider = void 0;
const BASE_URL = 'https://vidlink.pro';
const PARAMS = 'primaryColor=D70466&autoplay=false';
class VidLinkProvider {
    constructor() {
        this.name = 'vidlink';
    }
    supports(_query) {
        return true;
    }
    async getMovieStream(query) {
        const embedUrl = `${BASE_URL}/movie/${query.tmdbId}?${PARAMS}`;
        return { provider: this.name, embedUrl, type: 'movie' };
    }
    async getEpisodeStream(query) {
        const embedUrl = `${BASE_URL}/tv/${query.tmdbId}/${query.season || 1}/${query.episode || 1}?${PARAMS}`;
        return { provider: this.name, embedUrl, type: 'episode' };
    }
}
exports.VidLinkProvider = VidLinkProvider;
