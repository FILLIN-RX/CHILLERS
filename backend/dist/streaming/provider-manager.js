"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderManager = void 0;
const axios_1 = __importDefault(require("axios"));
const vidlink_provider_1 = require("./providers/vidlink.provider");
const vidapi_provider_1 = require("./providers/vidapi.provider");
const animekai_provider_1 = require("./providers/animekai.provider");
const VALIDATION_TIMEOUT = 5000;
class ProviderManager {
    constructor() {
        this.providers = [
            new animekai_provider_1.AnimeKaiProvider(),
            new vidlink_provider_1.VidLinkProvider(),
            new vidapi_provider_1.VidAPIProvider(),
        ];
    }
    async getMovieStream(query) {
        const ordered = this.sortProviders(query);
        for (const provider of ordered) {
            try {
                const result = await provider.getMovieStream(query);
                if (result && result.embedUrl) {
                    const valid = await this.validateUrl(result.embedUrl);
                    if (valid) {
                        return { provider: result.provider, embedUrl: result.embedUrl };
                    }
                }
            }
            catch {
                continue;
            }
        }
        return null;
    }
    async getEpisodeStream(query) {
        const ordered = this.sortProviders(query);
        for (const provider of ordered) {
            try {
                const result = await provider.getEpisodeStream(query);
                if (result && result.embedUrl) {
                    const valid = await this.validateUrl(result.embedUrl);
                    if (valid) {
                        return { provider: result.provider, embedUrl: result.embedUrl };
                    }
                }
            }
            catch {
                continue;
            }
        }
        return null;
    }
    sortProviders(query) {
        const supports = [];
        const fallback = [];
        for (const p of this.providers) {
            if (p.supports(query)) {
                supports.push(p);
            }
            else {
                fallback.push(p);
            }
        }
        return [...supports, ...fallback];
    }
    async validateUrl(url) {
        try {
            const response = await axios_1.default.head(url, {
                timeout: VALIDATION_TIMEOUT,
                validateStatus: (status) => status < 500,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });
            return response.status < 400;
        }
        catch {
            return false;
        }
    }
}
exports.ProviderManager = ProviderManager;
