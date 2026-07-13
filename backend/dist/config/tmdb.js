"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const tmdbClient = axios_1.default.create({
    baseURL: 'https://api.themoviedb.org/3',
    timeout: 10000,
    headers: {
        Authorization: `Bearer ${process.env.TMDB_TOKEN}`,
        'Content-Type': 'application/json',
    },
});
exports.default = tmdbClient;
