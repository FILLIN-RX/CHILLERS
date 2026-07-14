"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSeasonDetails = exports.getDetails = exports.getTrending = exports.getPopular = void 0;
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
