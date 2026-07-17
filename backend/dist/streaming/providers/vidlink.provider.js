"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VidLinkProvider = void 0;
const BASE_URL = 'https://vidlink.pro';
class VidLinkProvider {
    constructor() {
        this.name = 'vidlink';
    }
    buildParams(query) {
        return new URLSearchParams({
            primaryColor: 'D70466',
            autoplay: 'false',
            icons: 'vid',
            language: query.language || 'fr',
        });
    }
    supports(query) {
        return query.type !== 'anime';
    }
    async getMovieStream(query) {
        const params = this.buildParams(query);
        const embedUrl = `${BASE_URL}/movie/${query.tmdbId}?${params.toString()}`;
        return { provider: this.name, embedUrl, type: 'movie' };
    }
    async getEpisodeStream(query) {
        const params = this.buildParams({ ...query, ...{ nextbutton: 'true' } });
        params.set('nextbutton', 'true');
        const embedUrl = `${BASE_URL}/tv/${query.tmdbId}/${query.season || 1}/${query.episode || 1}?${params.toString()}`;
        return { provider: this.name, embedUrl, type: 'episode' };
    }
}
exports.VidLinkProvider = VidLinkProvider;
