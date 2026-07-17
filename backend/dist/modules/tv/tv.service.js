"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSeasonDetails = exports.getDetails = exports.getAnime = exports.getByGenre = exports.getTopRated = exports.getTrending = exports.getPopular = void 0;
const tmdb_1 = __importDefault(require("../../config/tmdb"));
const language_1 = require("../../config/language");
const getPopular = async (page = 1, language) => {
    const { data } = await tmdb_1.default.get('/tv/popular', { params: { page, language: (0, language_1.toTMDBLanguage)(language) } });
    return data;
};
exports.getPopular = getPopular;
const getTrending = async (language) => {
    const { data } = await tmdb_1.default.get('/trending/tv/week', { params: { language: (0, language_1.toTMDBLanguage)(language) } });
    return data;
};
exports.getTrending = getTrending;
const getTopRated = async (page = 1, language) => {
    const { data } = await tmdb_1.default.get('/tv/top_rated', { params: { page, language: (0, language_1.toTMDBLanguage)(language) } });
    return data;
};
exports.getTopRated = getTopRated;
const getByGenre = async (genreId, page = 1, language) => {
    const { data } = await tmdb_1.default.get('/discover/tv', {
        params: { with_genres: genreId, sort_by: 'popularity.desc', page, language: (0, language_1.toTMDBLanguage)(language) },
    });
    return data;
};
exports.getByGenre = getByGenre;
const getAnime = async (page = 1, language) => {
    const { data } = await tmdb_1.default.get('/discover/tv', {
        params: {
            with_genres: '16',
            sort_by: 'popularity.desc',
            page,
            with_original_language: 'ja',
            language: (0, language_1.toTMDBLanguage)(language),
        },
    });
    return data;
};
exports.getAnime = getAnime;
const getDetails = async (id, language) => {
    const { data } = await tmdb_1.default.get(`/tv/${id}`, {
        params: { append_to_response: 'credits,videos', language: (0, language_1.toTMDBLanguage)(language) },
    });
    return data;
};
exports.getDetails = getDetails;
const getSeasonDetails = async (id, seasonNumber, language) => {
    const { data } = await tmdb_1.default.get(`/tv/${id}/season/${seasonNumber}`, {
        params: { language: (0, language_1.toTMDBLanguage)(language) },
    });
    return data;
};
exports.getSeasonDetails = getSeasonDetails;
