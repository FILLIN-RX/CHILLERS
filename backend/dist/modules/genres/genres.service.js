"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTvGenres = exports.getMovieGenres = void 0;
const tmdb_1 = __importDefault(require("../../config/tmdb"));
const getMovieGenres = async () => {
    const { data } = await tmdb_1.default.get('/genre/movie/list');
    return data.genres;
};
exports.getMovieGenres = getMovieGenres;
const getTvGenres = async () => {
    const { data } = await tmdb_1.default.get('/genre/tv/list');
    return data.genres;
};
exports.getTvGenres = getTvGenres;
