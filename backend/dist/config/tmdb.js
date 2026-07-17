"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCache = clearCache;
const axios_1 = __importDefault(require("axios"));
const dns_1 = __importDefault(require("dns"));
const tmdbClient = axios_1.default.create({
    baseURL: 'https://api.themoviedb.org/3',
    timeout: 10000,
    headers: {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1ODY4ZjBmM2NmZTg1MTZmYmQ1NmE2YjNiNzJmOGYwZiIsIm5iZiI6MTc4Mzk0MDMzNi42ODMsInN1YiI6IjZhNTRjNGYwY2M4ZTIzNDZhNWI1MmUxYiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.33Zn39ASeHdHwv7jxe5-qaPhi-5uSvGqfAOPCSW8ddM',
        'Content-Type': 'application/json',
    },
    // @ts-ignore
    lookup: (hostname, options, cb) => {
        dns_1.default.lookup(hostname, { ...options, family: 4 }, cb);
    },
});
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;
const originalGet = tmdbClient.get;
// @ts-ignore
tmdbClient.get = async function (url, config) {
    const cacheKey = JSON.stringify({ url, params: config?.params });
    const cached = cache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiry > now) {
        return { data: cached.data };
    }
    const response = await originalGet.call(this, url, config);
    cache.set(cacheKey, {
        data: response.data,
        expiry: Date.now() + CACHE_DURATION,
    });
    return response;
};
function clearCache() {
    cache.clear();
}
exports.default = tmdbClient;
