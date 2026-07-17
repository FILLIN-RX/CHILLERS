"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getByGenre = exports.getTrailer = exports.getRecommendations = exports.getDetails = exports.getTopRated = exports.getUpcoming = exports.getTrending = exports.getPopular = void 0;
const tmdb_1 = __importDefault(require("../../config/tmdb"));
const language_1 = require("../../config/language");
const getPopular = async (page = 1, language) => {
    const { data } = await tmdb_1.default.get('/movie/popular', { params: { page, language: (0, language_1.toTMDBLanguage)(language) } });
    return data;
};
exports.getPopular = getPopular;
const getTrending = async (language) => {
    const { data } = await tmdb_1.default.get('/trending/movie/week', { params: { language: (0, language_1.toTMDBLanguage)(language) } });
    return data;
};
exports.getTrending = getTrending;
const getUpcoming = async (page = 1, language) => {
    const { data } = await tmdb_1.default.get('/movie/upcoming', { params: { page, language: (0, language_1.toTMDBLanguage)(language) } });
    return data;
};
exports.getUpcoming = getUpcoming;
const getTopRated = async (page = 1, language) => {
    const { data } = await tmdb_1.default.get('/movie/top_rated', { params: { page, language: (0, language_1.toTMDBLanguage)(language) } });
    return data;
};
exports.getTopRated = getTopRated;
const getDetails = async (id, language) => {
    const { data } = await tmdb_1.default.get(`/movie/${id}`, {
        params: { append_to_response: 'credits,videos', language: (0, language_1.toTMDBLanguage)(language) },
    });
    return data;
};
exports.getDetails = getDetails;
const getRecommendations = async (id, language) => {
    const { data } = await tmdb_1.default.get(`/movie/${id}/recommendations`, { params: { language: (0, language_1.toTMDBLanguage)(language) } });
    return data;
};
exports.getRecommendations = getRecommendations;
const getTrailer = async (id, language) => {
    const { data } = await tmdb_1.default.get(`/movie/${id}/videos`, { params: { language: (0, language_1.toTMDBLanguage)(language) } });
    const results = data.results || [];
    const trailer = results.find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official === true);
    return trailer || results.find((v) => v.site === 'YouTube' && v.type === 'Trailer') || null;
};
exports.getTrailer = getTrailer;
const getByGenre = async (genreId, page = 1, language) => {
    const { data } = await tmdb_1.default.get('/discover/movie', {
        params: { with_genres: genreId, sort_by: 'popularity.desc', page, language: (0, language_1.toTMDBLanguage)(language) },
    });
    return data;
};
exports.getByGenre = getByGenre;
