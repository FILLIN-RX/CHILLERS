"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getByGenre = exports.getTrailer = exports.getRecommendations = exports.getDetails = exports.getTopRated = exports.getUpcoming = exports.getTrending = exports.getPopular = void 0;
const tmdb_1 = __importDefault(require("../../config/tmdb"));
const getPopular = async (page = 1) => {
    const { data } = await tmdb_1.default.get('/movie/popular', { params: { page } });
    return data;
};
exports.getPopular = getPopular;
const getTrending = async () => {
    const { data } = await tmdb_1.default.get('/trending/movie/week');
    return data;
};
exports.getTrending = getTrending;
const getUpcoming = async (page = 1) => {
    const { data } = await tmdb_1.default.get('/movie/upcoming', { params: { page } });
    return data;
};
exports.getUpcoming = getUpcoming;
const getTopRated = async (page = 1) => {
    const { data } = await tmdb_1.default.get('/movie/top_rated', { params: { page } });
    return data;
};
exports.getTopRated = getTopRated;
const getDetails = async (id) => {
    const { data } = await tmdb_1.default.get(`/movie/${id}`, {
        params: { append_to_response: 'credits,videos' },
    });
    return data;
};
exports.getDetails = getDetails;
const getRecommendations = async (id) => {
    const { data } = await tmdb_1.default.get(`/movie/${id}/recommendations`);
    return data;
};
exports.getRecommendations = getRecommendations;
const getTrailer = async (id) => {
    const { data } = await tmdb_1.default.get(`/movie/${id}/videos`);
    const results = data.results || [];
    const trailer = results.find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official === true);
    return trailer || results.find((v) => v.site === 'YouTube' && v.type === 'Trailer') || null;
};
exports.getTrailer = getTrailer;
const getByGenre = async (genreId, page = 1) => {
    const { data } = await tmdb_1.default.get('/discover/movie', {
        params: { with_genres: genreId, sort_by: 'popularity.desc', page },
    });
    return data;
};
exports.getByGenre = getByGenre;
