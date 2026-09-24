"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const error_middleware_1 = require("./middleware/error.middleware");
const antibot_middleware_1 = require("./middleware/antibot.middleware");
const csrf_middleware_1 = require("./middleware/csrf.middleware");
const rate_limit_middleware_1 = require("./middleware/rate-limit.middleware");
const tmdb_1 = require("./config/tmdb");
const movies_routes_1 = __importDefault(require("./modules/movies/movies.routes"));
const tv_routes_1 = __importDefault(require("./modules/tv/tv.routes"));
const search_routes_1 = __importDefault(require("./modules/search/search.routes"));
const genres_routes_1 = __importDefault(require("./modules/genres/genres.routes"));
const streaming_routes_1 = __importDefault(require("./streaming/streaming.routes"));
const nexstream_routes_1 = __importDefault(require("./streaming/nexstream.routes"));
const download_routes_1 = __importDefault(require("./modules/download/download.routes"));
const doodstream_routes_1 = __importDefault(require("./modules/doodstream/doodstream.routes"));
const otaku_routes_1 = __importDefault(require("./modules/otaku/otaku.routes"));
const frenchstream_routes_1 = __importDefault(require("./modules/frenchstream/frenchstream.routes"));
const fawesome_routes_1 = __importDefault(require("./modules/fawesome/fawesome.routes"));
const freemoviesplus_routes_1 = __importDefault(require("./modules/freemoviesplus/freemoviesplus.routes"));
const plex_routes_1 = __importDefault(require("./modules/plex/plex.routes"));
const admin_routes_1 = __importDefault(require("./modules/admin/admin.routes"));
const availability_routes_1 = __importDefault(require("./modules/availability/availability.routes"));
const affiches_routes_1 = __importDefault(require("./modules/affiches/affiches.routes"));
const live_routes_1 = __importDefault(require("./modules/live/live.routes"));
const liveball_routes_1 = __importDefault(require("./modules/liveball/liveball.routes"));
const subtitles_routes_1 = __importDefault(require("./modules/subtitles/subtitles.routes"));
const torrents_routes_1 = __importDefault(require("./streaming/torrents/torrents.routes"));
const ai_routes_1 = __importDefault(require("./modules/ai/ai.routes"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const user_routes_1 = __importDefault(require("./modules/user/user.routes"));
const omnisave_routes_1 = __importDefault(require("./modules/omnisave/omnisave.routes"));
const requests_routes_1 = __importDefault(require("./modules/requests/requests.routes"));
const compression_1 = __importDefault(require("compression"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
const app = (0, express_1.default)();
const allowedOrigins = [
    'https://chillers-pi.vercel.app',
    'https://chillers.site',
    'https://www.chillers.site',
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim().replace(/\/$/, '')) : []),
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
];
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        const normalizedOrigin = origin.replace(/\/$/, '');
        // Vérification directe ou wildcard chillers.site / vercel.app
        if (allowedOrigins.includes(normalizedOrigin) ||
            normalizedOrigin.endsWith('.chillers.site') ||
            normalizedOrigin.endsWith('.vercel.app') ||
            normalizedOrigin.endsWith('chillers.onrender.com')) {
            return callback(null, true);
        }
        return callback(new Error(`CORS non autorisé pour l'origine: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Range',
        'X-Session-ID',
        'X-Forwarded-For',
        'x-csrf-token',
        'X-CSRF-Token',
        'x-no-compression',
        'Cache-Control',
        'Pragma',
    ],
    exposedHeaders: [
        'Content-Range',
        'Accept-Ranges',
        'Content-Length',
        'Content-Type',
        'ETag',
        'X-Total-Count',
    ],
    maxAge: 86400,
};
app.use((0, cors_1.default)(corsOptions));
app.use((0, compression_1.default)({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        const contentType = res.getHeader('Content-Type');
        if (typeof contentType === 'string' && (contentType.includes('video/') || contentType.includes('application/octet-stream'))) {
            return false;
        }
        return compression_1.default.filter(req, res);
    },
    threshold: 512, // Compress payloads larger than 512 bytes
}));
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            frameSrc: ["'self'", "https://animekai.to", "https://vidlink.pro", "https://*.vidlink.pro", "https://vidapi.xyz", "https://*.vidapi.xyz", "https://www.youtube.com", "https://doodstream.com", "https://*.doodstream.com", "https://d000d.com", "https://*.d000d.com", "https://d0000d.com", "https://*.d0000d.com", "https://playmogo.com", "https://*.playmogo.com", "https://*.dood.to", "https://vidzy.cc", "https://*.vidzy.cc", "https://luluvid.com", "https://*.luluvid.com", "https://fsvid.lol", "https://*.fsvid.lol", "https://trakx.lol", "https://*.trakx.lol", "https://vidsrc.in", "https://*.vidsrc.in", "https://vidsrc.xyz", "https://*.vidsrc.xyz", "https://embed.su", "https://*.embed.su", "https://uqload.is", "https://*.uqload.is", "https://uqload.vc", "https://*.uqload.vc", "https://uqload.ws", "https://*.uqload.ws", "https://uqload.to", "https://*.uqload.to", "https://uqload.co", "https://*.uqload.co", "https://uqload.net", "https://*.uqload.net", "https://uqload.com", "https://*.uqload.com", "https://uqload.io", "https://*.uqload.io", "https://www.google.com", "https://*.google.com",
                // Flemmix embed hosts
                "https://luluvdo.com", "https://*.luluvdo.com",
                "https://vidmoly.org", "https://*.vidmoly.org",
                "https://savefiles.com", "https://*.savefiles.com",
                "https://waaw1.tv", "https://*.waaw1.tv",
                "https://vidara.to", "https://*.vidara.to",
                "https://morencius.com", "https://*.morencius.com",
                "https://hanerix.com", "https://*.hanerix.com",
                "https://firestream.site", "https://*.firestream.site",
                "https://tipfly.xyz", "https://*.tipfly.xyz",
                "https://rebeccapracticeloss.com", "https://*.rebeccapracticeloss.com",
            ],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https:"],
            imgSrc: ["'self'", "data:", "https:"],
            mediaSrc: ["'self'", "https:", "blob:", "http:"],
        },
    },
}));
app.use(express_1.default.json({ limit: '10mb' }));
// Fichiers uploadés manuellement par l'admin (uploads/ en mémoire) - servis
// publiquement pour permettre l'upload Uqload via URL
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok' }, message: null });
});
app.post('/api/clear-cache', (_req, res) => {
    (0, tmdb_1.clearCache)();
    res.json({ success: true, data: null, message: 'TMDB cache cleared' });
});
// Security middleware
// Rate limiting for API endpoints
app.use('/api', rate_limit_middleware_1.apiRateLimiter);
// CSRF token generation on first request
app.get('/api/csrf-token', csrf_middleware_1.generateCsrfToken);
// CSRF verification on state-changing requests
app.use('/api/admin', csrf_middleware_1.verifyCsrfToken);
app.use('/api/user', csrf_middleware_1.verifyCsrfToken);
app.use('/api/auth/logout', csrf_middleware_1.verifyCsrfToken);
// Protection anti-bot & anti-scraping sur les routes publiques et médias
app.use('/api', antibot_middleware_1.antiBotMiddleware);
app.use('/api/movies', movies_routes_1.default);
app.use('/api/tv', tv_routes_1.default);
app.use('/api/search', search_routes_1.default);
app.use('/api/genres', genres_routes_1.default);
app.use('/api/stream', streaming_routes_1.default);
app.use('/api/nexstream', nexstream_routes_1.default);
app.use('/api/download', download_routes_1.default);
app.use('/api/doodstream', doodstream_routes_1.default);
app.use('/api/otaku', otaku_routes_1.default);
app.use('/api/frenchstream', frenchstream_routes_1.default);
app.use('/api/fawesome', fawesome_routes_1.default);
app.use('/api/freemoviesplus', freemoviesplus_routes_1.default);
app.use('/api/plex', plex_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/admin/ai', ai_routes_1.default);
app.use('/api/availability', availability_routes_1.default);
app.use('/api/affiches', affiches_routes_1.default);
app.use('/api/live', live_routes_1.default);
app.use('/api/liveball', liveball_routes_1.default);
app.use('/api/subtitles', subtitles_routes_1.default);
app.use('/api/torrents', torrents_routes_1.default);
app.use('/api/auth', auth_routes_1.default);
app.use('/api/user', user_routes_1.default);
app.use('/api/omnisave', omnisave_routes_1.default);
app.use('/api/requests', requests_routes_1.default);
app.use('/api/admin/requests', requests_routes_1.default);
app.use('/api/internal/requests', requests_routes_1.default);
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        data: null,
        message: 'Route not found',
    });
});
app.use(error_middleware_1.errorMiddleware);
exports.default = app;
