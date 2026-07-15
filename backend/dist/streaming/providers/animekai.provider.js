"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnimeKaiProvider = void 0;
// AnimeKai supports anime by TMDB ID or by title slug
// Priority: use TMDB ID embed (more reliable), fallback to title slug
const BASE_URL = 'https://animekai.to';
function slugify(title) {
    return title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}
class AnimeKaiProvider {
    constructor() {
        this.name = 'animekai';
    }
    supports(query) {
        return query.type === 'anime';
    }
    async getMovieStream(query) {
        // Try TMDB-ID based embed first (most reliable)
        const embedUrl = query.title
            ? `${BASE_URL}/embed/${slugify(query.title)}`
            : `${BASE_URL}/embed/tmdb-${query.tmdbId}`;
        return { provider: this.name, embedUrl, type: 'movie' };
    }
    async getEpisodeStream(query) {
        const ep = query.episode || 1;
        const embedUrl = query.title
            ? `${BASE_URL}/embed/${slugify(query.title)}?ep=${ep}`
            : `${BASE_URL}/embed/tmdb-${query.tmdbId}?ep=${ep}`;
        return { provider: this.name, embedUrl, type: 'episode' };
    }
}
exports.AnimeKaiProvider = AnimeKaiProvider;
