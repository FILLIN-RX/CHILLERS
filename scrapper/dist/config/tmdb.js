"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const TMDB_TOKEN = process.env.TMDB_TOKEN;
const TMDB_LANGUAGE = process.env.TMDB_LANGUAGE || 'fr-FR';
const tmdbClient = axios_1.default.create({
    baseURL: 'https://api.themoviedb.org/3',
    headers: {
        Authorization: `Bearer ${TMDB_TOKEN}`,
        'Content-Type': 'application/json',
    },
    params: { language: TMDB_LANGUAGE },
});
exports.default = tmdbClient;
