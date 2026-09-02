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
const direct_provider_1 = require("./providers/direct.provider");
const otaku_provider_1 = require("./providers/otaku.provider");
const frenchstream_provider_1 = require("./providers/frenchstream.provider");
const omnisave_provider_1 = require("./providers/omnisave.provider");
const stream_persistence_service_1 = require("./services/stream-persistence.service");
const stream_cache_1 = require("../utils/stream-cache");
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
            new direct_provider_1.DirectProvider(),
            new frenchstream_provider_1.FrenchStreamProvider(),
            new omnisave_provider_1.OmniSaveProvider(),
            new mongodb_provider_1.MongoDBProvider(),
            new doodstream_provider_1.DoodStreamProvider(),
            new otaku_provider_1.OtakuProvider(),
        ];
    }
    async getMovieStream(query) {
        // ── Cache LRU ───────────────────────────────────────────────────────────
        const cacheKey = (0, stream_cache_1.getCacheKey)('movie', query.tmdbId, undefined, undefined, query.isPremium);
        const cached = stream_cache_1.streamCache.get(cacheKey);
        if (cached) {
            console.log(`[Stream] Cache hit for movie ${query.tmdbId} (premium=${!!query.isPremium})`);
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
        const cacheKey = (0, stream_cache_1.getCacheKey)('episode', query.tmdbId, query.season, query.episode, query.isPremium);
        const cached = stream_cache_1.streamCache.get(cacheKey);
        if (cached) {
            console.log(`[Stream] Cache hit for episode ${query.tmdbId} S${query.season}E${query.episode} (premium=${!!query.isPremium})`);
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
                // "Pas de résultat" = contenu absent de ce provider (cas NORMAL),
                // ce n'est PAS une panne : on ne déclenche pas le circuit breaker,
                // sinon les recherches de contenus non stockés le feraient sauter
                // et pénaliseraient les contenus réellement disponibles.
                return {
                    provider: provider.name,
                    status: 'skip',
                    reason: 'no result returned',
                };
            }
            const valid = await this.validateUrl(result.embedUrl);
            if (valid) {
                this.recordSuccess(provider.name);
                if (provider.name !== 'mongodb') {
                    (0, stream_persistence_service_1.persistDiscoveredStream)(query, result, {
                        quality: provider.name === 'frenchstream' ? '1080p' : '720p',
                        isPremium: query.isPremium || provider.name === 'frenchstream',
                    });
                }
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
        const isPremium = !!query.isPremium;
        if (isPremium) {
            // Pour les utilisateurs Premium : FrenchStream (1080p Full HD) en priorité #1
            const premiumProviders = this.providers.filter(p => p.name === 'frenchstream' && p.supports(query));
            const otherProviders = this.providers.filter(p => p.name !== 'frenchstream');
            return [...premiumProviders, ...otherProviders];
        }
        else {
            // Pour les utilisateurs Standards/Gratuits : flux normaux (Direct, MongoDB, Doodstream, Otaku)
            return this.providers.filter(p => p.name !== 'frenchstream');
        }
    }
    async filterProviders(query) {
        return this.sortProviders(query);
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
            url.includes('streamtape.com') ||
            url.includes('playmogo.com') ||
            url.includes('d000d.com') ||
            url.includes('d0000d.com') ||
            url.includes('/api/doodstream/stream') ||
            /dood\.(to|sh|so|cx|la|wf|pm)/i.test(url) ||
            url.includes('/e/') ||
            url.includes('embed'));
    }
    async validateUrl(url) {
        // Skip validation for internal proxy
        if (url.startsWith('/api/')) {
            return true;
        }
        // Validation active pour Uqload
        if (url.includes('uqload')) {
            try {
                const res = await axios_1.default.get(url, {
                    timeout: 3000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    },
                    validateStatus: (s) => s === 200,
                });
                const html = typeof res.data === 'string' ? res.data : '';
                if (html.includes('File is no longer available') ||
                    html.includes('expired or has been deleted') ||
                    html.includes('File Not Found') ||
                    (html.includes('deleted') && html.includes('expired'))) {
                    console.log(`[Stream Validation] Uqload embed is dead/deleted: ${url}`);
                    return false;
                }
                return true;
            }
            catch {
                return false;
            }
        }
        // Validation active pour Doodstream et Streamtape
        if (url.includes('doodstream') || url.includes('d000d') || url.includes('streamtape')) {
            try {
                const res = await axios_1.default.get(url, {
                    timeout: 3000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                    validateStatus: (s) => s === 200,
                });
                const html = typeof res.data === 'string' ? res.data : '';
                if (html.includes('Video not found') ||
                    html.includes('File has been deleted') ||
                    html.includes('File has been removed') ||
                    html.includes('404 Not Found')) {
                    console.log(`[Stream Validation] Dood/Tape embed is dead: ${url}`);
                    return false;
                }
                return true;
            }
            catch {
                return false;
            }
        }
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
