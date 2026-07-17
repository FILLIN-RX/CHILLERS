"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTvGenres = exports.getMovieGenres = void 0;
const tmdb_1 = __importDefault(require("../../config/tmdb"));
const language_1 = require("../../config/language");
const getMovieGenres = async (language) => {
    const { data } = await tmdb_1.default.get('/genre/movie/list', {
        params: { language: (0, language_1.toTMDBLanguage)(language) },
    });
    return data.genres;
};
exports.getMovieGenres = getMovieGenres;
const getTvGenres = async (language) => {
    const { data } = await tmdb_1.default.get('/genre/tv/list', {
        params: { language: (0, language_1.toTMDBLanguage)(language) },
    });
    return data.genres;
};
exports.getTvGenres = getTvGenres;
