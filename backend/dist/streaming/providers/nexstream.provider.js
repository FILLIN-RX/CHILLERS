"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NexStreamProvider = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const API_KEY = process.env.NEXSTREAM_API_KEY || '';
const BASE_URL = 'https://api.codespecters.com/embed';
class NexStreamProvider {
    constructor() {
        this.name = 'nexstream';
    }
    async getMovieStream(tmdbId) {
        if (!API_KEY)
            return null;
        const embedUrl = `${BASE_URL}/movie/${tmdbId}?apikey=${API_KEY}`;
        return { provider: this.name, embedUrl, type: 'movie' };
    }
    async getEpisodeStream(tmdbId, season, episode) {
        if (!API_KEY)
            return null;
        const embedUrl = `${BASE_URL}/tv/${tmdbId}/${season}/${episode}?apikey=${API_KEY}`;
        return { provider: this.name, embedUrl, type: 'episode' };
    }
}
exports.NexStreamProvider = NexStreamProvider;
