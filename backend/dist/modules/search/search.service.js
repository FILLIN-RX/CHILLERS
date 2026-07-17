"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchMulti = void 0;
const tmdb_1 = __importDefault(require("../../config/tmdb"));
const language_1 = require("../../config/language");
const Movie_1 = __importDefault(require("../../models/Movie"));
const Serie_1 = __importDefault(require("../../models/Serie"));
const searchMulti = async (query, page = 1, language) => {
    // 1. Recherche dans MongoDB (Locale)
    const regex = new RegExp(query, 'i');
    const localMovies = await Movie_1.default.find({ titre: regex }).limit(5);
    const localSeries = await Serie_1.default.find({ titre: regex }).limit(5);
    // 2. Recherche sur TMDB (API)
    const { data } = await tmdb_1.default.get('/search/multi', {
        params: { query, page, language: (0, language_1.toTMDBLanguage)(language) },
    });
    // 3. Fusion des résultats (simplifiée)
    return {
        localResults: {
            movies: localMovies,
            series: localSeries
        },
        tmdbResults: data
    };
};
exports.searchMulti = searchMulti;
