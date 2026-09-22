"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VidLinkProvider = void 0;
const BASE_URL = 'https://vidlink.pro';
class VidLinkProvider {
    constructor() {
        this.name = 'vidlink';
    }
    supports(query) {
        return Boolean(query.tmdbId && query.tmdbId > 0);
    }
    async getMovieStream(query) {
        if (!this.supports(query))
            return null;
        const embedUrl = `${BASE_URL}/movie/${query.tmdbId}?primaryColor=D70466&autoplay=false`;
        return {
            provider: this.name,
            embedUrl,
            type: 'movie',
        };
    }
    async getEpisodeStream(query) {
        if (!this.supports(query))
            return null;
        const season = query.season || 1;
        const episode = query.episode || 1;
        const embedUrl = `${BASE_URL}/tv/${query.tmdbId}/${season}/${episode}?primaryColor=D70466&autoplay=false`;
        return {
            provider: this.name,
            embedUrl,
            type: 'episode',
        };
    }
}
exports.VidLinkProvider = VidLinkProvider;
