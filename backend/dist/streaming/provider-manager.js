"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderManager = void 0;
const axios_1 = __importDefault(require("axios"));
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const mongodb_provider_1 = require("./providers/mongodb.provider");
const doodstream_provider_1 = require("./providers/doodstream.provider");
const vidapi_provider_1 = require("./providers/vidapi.provider");
const otaku_provider_1 = require("./providers/otaku.provider");
const vidlink_provider_1 = require("./providers/vidlink.provider");
const stream_cache_1 = require("../utils/stream-cache");
const Movie_1 = __importDefault(require("../models/Movie"));
const Serie_1 = __importDefault(require("../models/Serie"));
const VALIDATION_TIMEOUT = 5000;
const PROVIDER_TIMEOUT = 10000;
const OTAKU_TIMEOUT = 25000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN = 60000;
class ProviderManager {
    constructor() {
        this.health = new Map();
        /** Debounce : évite de re-scraper le même contenu plusieurs fois en // */
        this.pendingScrapes = new Set();
        this.providers = this.buildProviders();
    }
    buildProviders() {
        return [
            new mongodb_provider_1.MongoDBProvider(),
            new doodstream_provider_1.DoodStreamProvider(),
            new otaku_provider_1.OtakuProvider(),
            new vidlink_provider_1.VidLinkProvider(),
            new vidapi_provider_1.VidAPIProvider(),
        ];
    }
    async getMovieStream(query) {
        // ── Cache LRU ───────────────────────────────────────────────────────────
        const cacheKey = (0, stream_cache_1.getCacheKey)('movie', query.tmdbId);
        const cached = stream_cache_1.streamCache.get(cacheKey);
        if (cached) {
            console.log(`[Stream] Cache hit for movie ${query.tmdbId}`);
            return cached;
        }
        const attempts = [];
        const activeProviders = await this.filterProviders(query);
        for (const provider of activeProviders) {
            const attempt = await this.tryProvider(provider, 'movie', query);
            attempts.push(attempt);
            if (attempt.status === 'success') {
                console.log(`[Stream] Movie stream found via "${provider.name}" after ${attempts.length} attempt(s)`);
                const result = { provider: attempt.provider, embedUrl: attempt.reason };
                stream_cache_1.streamCache.set(cacheKey, result);
                return result;
            }
        }
        console.error(`[Stream] All providers failed for movie query "${query.title || query.tmdbId}":`, attempts.map(a => `${a.provider}=${a.status}${a.reason ? ` (${a.reason})` : ''}`).join(', '));
        return null;
    }
    async getEpisodeStream(query) {
        // ── Cache LRU ───────────────────────────────────────────────────────────
        const cacheKey = (0, stream_cache_1.getCacheKey)('episode', query.tmdbId, query.season, query.episode);
        const cached = stream_cache_1.streamCache.get(cacheKey);
        if (cached) {
            console.log(`[Stream] Cache hit for episode ${query.tmdbId} S${query.season}E${query.episode}`);
            return cached;
        }
        const attempts = [];
        const activeProviders = await this.filterProviders(query);
        for (const provider of activeProviders) {
            const attempt = await this.tryProvider(provider, 'episode', query);
            attempts.push(attempt);
            if (attempt.status === 'success') {
                console.log(`[Stream] Episode stream found via "${provider.name}" after ${attempts.length} attempt(s)`);
                const result = { provider: attempt.provider, embedUrl: attempt.reason };
                stream_cache_1.streamCache.set(cacheKey, result);
                return result;
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
            // Skip validation for MongoDB — URLs already stored in our DB,
            // the provider itself checks signed-link expiry internally.
            const valid = provider.name === 'mongodb' || await this.validateUrl(result.embedUrl);
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
                this.triggerReScrape(query.title || String(query.tmdbId), type, query.episode);
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
    async contentExistsInMongoDB(query) {
        try {
            const isSerie = query.season !== undefined && query.episode !== undefined;
            const Model = isSerie ? Serie_1.default : Movie_1.default;
            const orClause = [];
            if (query.tmdbId) {
                orClause.push({ tmdbId: query.tmdbId });
                orClause.push({ tmdbId: String(query.tmdbId) });
            }
            if (query.title) {
                const safe = query.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                orClause.push({ titre: { $regex: new RegExp(safe, 'i') } });
                // Match sans espaces/ponctuation pour tolérer les différences de format
                const stripped = query.title.replace(/[^a-z0-9]/gi, '');
                if (stripped.length >= 3 && stripped !== safe) {
                    const fuzzy = [...stripped].join('[^a-z0-9]*');
                    orClause.push({ titre: { $regex: new RegExp(fuzzy, 'i') } });
                }
            }
            if (orClause.length === 0)
                return false;
            const doc = await Model.findOne({ $or: orClause }).exec();
            if (doc) {
                console.log(`[ProviderManager] ${isSerie ? 'Série' : 'Film'} trouvé en BD (tmdbId=${query.tmdbId}, titre="${query.title}")`);
            }
            else {
                console.log(`[ProviderManager] ${isSerie ? 'Série' : 'Film'} NON trouvé en BD (tmdbId=${query.tmdbId}, titre="${query.title}") → VidLink/VidAPI gardés`);
            }
            return !!doc;
        }
        catch (err) {
            console.error('[ProviderManager] Erreur contentExistsInMongoDB:', err);
            return false;
        }
    }
    async filterProviders(query) {
        const skipVid = await this.contentExistsInMongoDB(query);
        const ordered = this.sortProviders(query);
        if (!skipVid)
            return ordered;
        return ordered.filter(p => p.name !== 'vidlink' && p.name !== 'vidapi');
    }
    /**
     * Déclenche un re-scrape en arrière-plan de façon sécurisée.
     * - Utilise spawn() au lieu de exec() → pas d'injection shell possible
     * - Debounce via pendingScrapes → évite les appels en boucle
     */
    triggerReScrape(title, type, episode) {
        const typeArg = type === 'movie' ? 'movie' : 'series';
        const debounceKey = `${typeArg}:${title}`;
        if (this.pendingScrapes.has(debounceKey)) {
            console.log(`[Self-Healing] Re-scrape déjà en cours pour "${title}", ignoré`);
            return;
        }
        this.pendingScrapes.add(debounceKey);
        // Nettoyer le debounce après 5 minutes
        setTimeout(() => this.pendingScrapes.delete(debounceKey), 5 * 60 * 1000);
        const scriptPath = path_1.default.join(__dirname, '../scraping/core/on-demand-fetch.ts');
        // spawn() — arguments passés séparément, JAMAIS interpolés dans un shell
        const child = (0, child_process_1.spawn)('npx', ['tsx', scriptPath, title, typeArg, String(episode ?? '')], { detached: true, stdio: 'ignore', env: process.env });
        child.unref();
        console.log(`[Self-Healing] Re-scrape lancé pour "${title}" (${typeArg}) pid=${child.pid}`);
    }
    isIframeEmbedUrl(url) {
        return (url.includes('vidlink.pro') ||
            url.includes('vidapi') ||
            url.includes('animekai') ||
            url.includes('uqload') ||
            url.includes('youtube.com') ||
            url.includes('doodstream.com') ||
            url.includes('playmogo.com') ||
            url.includes('d000d.com') ||
            url.includes('d0000d.com') ||
            /dood\.(to|sh|so|cx|la|wf|pm)/i.test(url) ||
            url.includes('/e/') ||
            url.includes('embed'));
    }
    async validateUrl(url) {
        // Skip validation for iframe embeds since they are protected by Cloudflare/DDOS-GUARD
        if (this.isIframeEmbedUrl(url)) {
            return true;
        }
        try {
            // 1. Try a HEAD request first to verify video URLs quickly without downloading body
            try {
                const headResponse = await axios_1.default.head(url, {
                    timeout: VALIDATION_TIMEOUT,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                    maxRedirects: 5,
                });
                if (headResponse.status >= 200 && headResponse.status < 400) {
                    const contentType = String(headResponse.headers['content-type'] || '');
                    if (contentType.includes('video/') ||
                        contentType.includes('application/x-mpegurl') ||
                        contentType.includes('application/vnd.apple.mpegurl')) {
                        return true;
                    }
                }
            }
            catch (headErr) {
                // HEAD failed, fall back to GET stream
            }
            // 2. Perform GET request with stream response to inspect headers / small body chunk
            const response = await axios_1.default.get(url, {
                timeout: VALIDATION_TIMEOUT,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                maxRedirects: 5,
            });
            if (response.status >= 400) {
                response.data.destroy();
                return false;
            }
            const contentType = String(response.headers['content-type'] || '').toLowerCase();
            if (contentType.includes('video/') ||
                contentType.includes('application/x-mpegurl') ||
                contentType.includes('application/vnd.apple.mpegurl')) {
                response.data.destroy();
                return true;
            }
            // If it is HTML, read the first 50KB to check for error indicators
            return new Promise((resolve) => {
                let body = '';
                const stream = response.data;
                stream.on('data', (chunk) => {
                    body += chunk.toString('utf8');
                    if (body.length > 50000) {
                        stream.destroy();
                    }
                });
                stream.on('end', () => {
                    resolve(this.checkBodyForErrors(body, url));
                });
                stream.on('error', () => {
                    resolve(false);
                });
            });
        }
        catch {
            return false;
        }
    }
    checkBodyForErrors(body, url) {
        const text = body.toLowerCase();
        if (text.length < 200)
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
            if (text.includes(indicator)) {
                return false;
            }
        }
        if (url.includes('vidlink.pro')) {
            if (!text.includes('vidlink') &&
                !text.includes('player') &&
                !text.includes('video') &&
                !text.includes('iframe')) {
                return false;
            }
        }
        return true;
    }
}
exports.ProviderManager = ProviderManager;
