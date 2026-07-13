"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnimeKaiProvider = void 0;
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
        return query.type === 'anime' && !!query.title;
    }
    async getMovieStream(query) {
        if (!query.title)
            return null;
        const slug = slugify(query.title);
        const embedUrl = `${BASE_URL}/embed/${slug}`;
        return { provider: this.name, embedUrl, type: 'movie' };
    }
    async getEpisodeStream(query) {
        if (!query.title)
            return null;
        const slug = slugify(query.title);
        const ep = query.episode || 1;
        const embedUrl = `${BASE_URL}/embed/${slug}?ep=${ep}`;
        return { provider: this.name, embedUrl, type: 'episode' };
    }
}
exports.AnimeKaiProvider = AnimeKaiProvider;
