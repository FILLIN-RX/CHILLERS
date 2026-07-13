"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchMulti = void 0;
const tmdb_1 = __importDefault(require("../../config/tmdb"));
const searchMulti = async (query, page = 1) => {
    const { data } = await tmdb_1.default.get('/search/multi', {
        params: { query, page },
    });
    return data;
};
exports.searchMulti = searchMulti;
