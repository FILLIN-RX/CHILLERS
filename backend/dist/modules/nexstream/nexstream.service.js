"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTvEmbedUrl = exports.getMovieEmbedUrl = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const API_KEY = process.env.NEXSTREAM_API_KEY || '';
const BASE_URL = 'https://api.codespecters.com/embed';
const getMovieEmbedUrl = (movieId, progress) => {
    let url = `${BASE_URL}/movie/${movieId}?apikey=${API_KEY}`;
    if (progress)
        url += `&progress=${progress}`;
    return url;
};
exports.getMovieEmbedUrl = getMovieEmbedUrl;
const getTvEmbedUrl = (tvId, season, episode, progress) => {
    let url = `${BASE_URL}/tv/${tvId}/${season}/${episode}?apikey=${API_KEY}`;
    if (progress)
        url += `&progress=${progress}`;
    return url;
};
exports.getTvEmbedUrl = getTvEmbedUrl;
