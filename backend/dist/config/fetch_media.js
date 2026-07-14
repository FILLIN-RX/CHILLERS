"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tmdb_js_1 = __importDefault(require("./tmdb.js"));
async function fetchMedia() {
    try {
        // Fetch 2 series
        const { data: tvData } = await tmdb_js_1.default.get('/tv/popular', { params: { page: 1 } });
        const series = tvData.results.slice(0, 2).map((item) => ({ ...item, media_type: 'tv' }));
        // Fetch 3 movies
        const { data: movieData } = await tmdb_js_1.default.get('/movie/popular', { params: { page: 1 } });
        const movies = movieData.results.slice(0, 3).map((item) => ({ ...item, media_type: 'movie' }));
        console.log(JSON.stringify([...series, ...movies], null, 2));
    }
    catch (error) {
        console.error('Error fetching media:', error);
    }
}
fetchMedia();
