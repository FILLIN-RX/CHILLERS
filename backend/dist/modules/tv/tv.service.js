"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSeasonDetails = exports.getDetails = exports.getAnime = exports.getByGenre = exports.getTopRated = exports.getTrending = exports.getPopular = void 0;
const tmdb_1 = __importDefault(require("../../config/tmdb"));
const getPopular = async (page = 1) => {
    const { data } = await tmdb_1.default.get('/tv/popular', { params: { page } });
    return data;
};
exports.getPopular = getPopular;
const getTrending = async () => {
    const { data } = await tmdb_1.default.get('/trending/tv/week');
    return data;
};
exports.getTrending = getTrending;
const getTopRated = async (page = 1) => {
    const { data } = await tmdb_1.default.get('/tv/top_rated', { params: { page } });
    return data;
};
exports.getTopRated = getTopRated;
const getByGenre = async (genreId, page = 1) => {
    const { data } = await tmdb_1.default.get('/discover/tv', {
        params: { with_genres: genreId, sort_by: 'popularity.desc', page },
    });
    return data;
};
exports.getByGenre = getByGenre;
// Anime: animation genre (16) on TV, sorted by popularity
const getAnime = async (page = 1) => {
    const { data } = await tmdb_1.default.get('/discover/tv', {
        params: {
            with_genres: '16',
            sort_by: 'popularity.desc',
            page,
            with_original_language: 'ja', // Japanese anime primarily
        },
    });
    return data;
};
exports.getAnime = getAnime;
const getDetails = async (id) => {
    // Fetch details and include seasons/credits/videos
    const { data } = await tmdb_1.default.get(`/tv/${id}`, {
        params: { append_to_response: 'credits,videos' },
    });
    return data;
};
exports.getDetails = getDetails;
const getSeasonDetails = async (id, seasonNumber) => {
    const { data } = await tmdb_1.default.get(`/tv/${id}/season/${seasonNumber}`);
    return data;
};
exports.getSeasonDetails = getSeasonDetails;
