"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSeasonDetails = exports.getDetails = exports.getAfrican = exports.getAnime = exports.getByGenre = exports.getTopRated = exports.getTrending = exports.getPopular = void 0;
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
    const params = {
        with_genres: '16',
        sort_by: 'popularity.desc',
        page,
        with_original_language: 'ja',
        language: (0, language_1.toTMDBLanguage)(language),
    };
    const [tvRes, movieRes] = await Promise.all([
        tmdb_1.default.get('/discover/tv', { params }),
        tmdb_1.default.get('/discover/movie', { params }),
    ]);
    const combinedResults = [...tvRes.data.results, ...movieRes.data.results]
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    return {
        page: tvRes.data.page,
        results: combinedResults,
        total_pages: Math.max(tvRes.data.total_pages, movieRes.data.total_pages),
        total_results: tvRes.data.total_results + movieRes.data.total_results,
    };
};
exports.getAnime = getAnime;
const getAfrican = async (page = 1, language, country) => {
    const originCountry = country || 'NG|GH|CM|CI|SN';
    const { data } = await tmdb_1.default.get('/discover/tv', {
        params: {
            with_origin_country: originCountry,
            sort_by: 'popularity.desc',
            page,
            language: (0, language_1.toTMDBLanguage)(language)
        },
    });
    return data;
};
exports.getAfrican = getAfrican;
const getDetails = async (id, language) => {
    try {
        const { data } = await tmdb_1.default.get(`/tv/${id}`, {
            params: {
                append_to_response: 'credits,videos,content_ratings,external_ids,recommendations,similar,aggregate_credits,keywords',
                language: (0, language_1.toTMDBLanguage)(language)
            },
        });
        return data;
    }
    catch (err) {
        if (err?.response?.status === 404) {
            try {
                const { data } = await tmdb_1.default.get(`/movie/${id}`, {
                    params: {
                        append_to_response: 'credits,videos,release_dates,recommendations,similar',
                        language: (0, language_1.toTMDBLanguage)(language)
                    },
                });
                return data;
            }
            catch (_) { }
        }
        throw err;
    }
};
exports.getDetails = getDetails;
const getSeasonDetails = async (id, seasonNumber, language) => {
    const { data } = await tmdb_1.default.get(`/tv/${id}/season/${seasonNumber}`, {
        params: {
            append_to_response: 'credits,videos,images',
            language: (0, language_1.toTMDBLanguage)(language)
        },
    });
    return data;
};
exports.getSeasonDetails = getSeasonDetails;
