"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderManager = void 0;
const axios_1 = __importDefault(require("axios"));
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const doodstream_provider_1 = require("./providers/doodstream.provider");
const vidlink_provider_1 = require("./providers/vidlink.provider");
const vidapi_provider_1 = require("./providers/vidapi.provider");
const animekai_provider_1 = require("./providers/animekai.provider");
const otaku_provider_1 = require("./providers/otaku.provider");
const VALIDATION_TIMEOUT = 5000;
const PROVIDER_TIMEOUT = 10000;
const OTAKU_TIMEOUT = 60000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN = 60000;
class ProviderManager {
    constructor() {
        this.health = new Map();
        // Ordre de priorité: Doodstream, Otaku, Autres...
        this.providers = [
            new doodstream_provider_1.DoodStreamProvider(),
            new otaku_provider_1.OtakuProvider(),
            new animekai_provider_1.AnimeKaiProvider(),
            new vidlink_provider_1.VidLinkProvider(),
            new vidapi_provider_1.VidAPIProvider(),
        ];
    }
    async getMovieStream(query) {
        const attempts = [];
        const ordered = this.sortProviders(query);
        for (const provider of ordered) {
            const attempt = await this.tryProvider(provider, 'movie', query);
            attempts.push(attempt);
            if (attempt.status === 'success') {
                console.log(`[Stream] Movie stream found via "${provider.name}" after ${attempts.length} attempt(s)`);
                return { provider: attempt.provider, embedUrl: attempt.reason };
            }
        }
        console.error(`[Stream] All providers failed for movie query "${query.title || query.tmdbId}":`, attempts.map(a => `${a.provider}=${a.status}${a.reason ? ` (${a.reason})` : ''}`).join(', '));
        return null;
    }
    async getEpisodeStream(query) {
        const attempts = [];
        const ordered = this.sortProviders(query);
        for (const provider of ordered) {
            const attempt = await this.tryProvider(provider, 'episode', query);
            attempts.push(attempt);
            if (attempt.status === 'success') {
                console.log(`[Stream] Episode stream found via "${provider.name}" after ${attempts.length} attempt(s)`);
                return { provider: attempt.provider, embedUrl: attempt.reason };
            }
        }
        console.error(`[Stream] All providers failed for episode query "${query.title || query.tmdbId}" S${query.season}E${query.episode}:`, attempts.map(a => `${a.provider}=${a.status}${a.reason ? ` (${a.reason})` : ''}`).join(', '));
        return null;
    }
    isCircuitBroken(name) {
        const h = this.health.get(name);
        if (!h)
            return false;
        if (Date.now() < h.cooldownUntil)
            return true;
        if (h.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
            if (Date.now() - h.lastFailureTime > CIRCUIT_BREAKER_COOLDOWN) {
                this.health.delete(name);
                return false;
            }
            return true;
        }
        return false;
    }
    recordFailure(name) {
        const h = this.health.get(name) || {
            consecutiveFailures: 0,
            lastFailureTime: 0,
            cooldownUntil: 0,
        };
        h.consecutiveFailures++;
        h.lastFailureTime = Date.now();
        if (h.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
            h.cooldownUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN;
            console.warn(`[Stream] Circuit breaker opened for "${name}" after ${h.consecutiveFailures} failures, cooling down for ${CIRCUIT_BREAKER_COOLDOWN / 1000}s`);
        }
        this.health.set(name, h);
    }
    recordSuccess(name) {
        const h = this.health.get(name);
        if (h) {
            h.consecutiveFailures = 0;
            h.cooldownUntil = 0;
        }
    }
    async tryProvider(provider, type, query) {
        if (this.isCircuitBroken(provider.name)) {
            return {
                provider: provider.name,
                status: 'skip',
                reason: 'circuit breaker cooldown',
            };
        }
        const controller = new AbortController();
        const timeout = provider.name === 'otaku' ? OTAKU_TIMEOUT : PROVIDER_TIMEOUT;
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const result = await (type === 'movie'
                ? provider.getMovieStream(query)
                : provider.getEpisodeStream(query));
            if (!result || !result.embedUrl) {
                this.recordFailure(provider.name);
                return {
                    provider: provider.name,
                    status: 'fail',
                    reason: 'no result returned',
                };
            }
            // Self-healing trigger: validate URL
            const valid = await this.validateUrl(result.embedUrl);
            if (valid) {
                this.recordSuccess(provider.name);
                return {
                    provider: provider.name,
                    status: 'success',
                    reason: result.embedUrl,
                };
            }
            else {
                this.recordFailure(provider.name);
                // TRIGGER BACKGROUND RE-SCRAPE
                console.log(`[Self-Healing] Triggering background re-scrape for: ${provider.name} - ${query.title}`);
                const scriptPath = path_1.default.join(__dirname, '../scraping/core/on-demand-fetch.ts');
                const typeArg = type === 'movie' ? 'movie' : 'series';
                (0, child_process_1.exec)(`npx tsx ${scriptPath} "${query.title}" "${typeArg}" "${query.episode || ''}"`);
                return {
                    provider: provider.name,
                    status: 'fail',
                    reason: 'URL validation failed, re-scraping triggered',
                };
            }
        }
        catch (err) {
            this.recordFailure(provider.name);
            const msg = err?.name === 'AbortError'
                ? `timeout (${timeout}ms)`
                : err?.message || 'unknown error';
            return {
                provider: provider.name,
                status: 'error',
                reason: msg,
            };
        }
        finally {
            clearTimeout(timeoutId);
        }
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
            const response = await axios_1.default.get(url, {
                timeout: VALIDATION_TIMEOUT,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                maxRedirects: 5,
            });
            if (response.status >= 400)
                return false;
            const body = typeof response.data === 'string' ? response.data.toLowerCase() : '';
            const contentLength = body.length;
            // Too short = error/redirect/minimal fallback page
            if (contentLength < 200)
                return false;
            const notFoundIndicators = [
                'not found',
                'unavailable',
                'error loading',
                'no stream',
                'content not available',
                '404',
                'introuvable',
                'indisponible',
                'erreur',
                'non disponible',
                'aucun contenu',
                'n\'existe pas',
                'this video is not available',
                'video not found',
                'no video',
                'content unavailable',
                'stream not found',
                'sorry',
                'page not found',
                'file not found',
                'nothing found',
                'aucun résultat',
                'ne correspond',
                'page introuvable',
                'fichier introuvable',
                'contenu non trouvé',
                'film introuvable',
                'série introuvable',
                'nothing here',
                'no content',
                'empty',
                'error 404',
                'error 500',
            ];
            for (const indicator of notFoundIndicators) {
                if (body.includes(indicator)) {
                    return false;
                }
            }
            // VidLink fallback pages are typically very minimal HTML without a real player
            // Check that the response has meaningful content (player scripts, video elements, etc.)
            if (url.includes('vidlink.pro')) {
                if (!body.includes('vidlink') && !body.includes('player') && !body.includes('video') && !body.includes('iframe')) {
                    return false;
                }
            }
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.ProviderManager = ProviderManager;
