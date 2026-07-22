"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const error_middleware_1 = require("./middleware/error.middleware");
const tmdb_1 = require("./config/tmdb");
const movies_routes_1 = __importDefault(require("./modules/movies/movies.routes"));
const tv_routes_1 = __importDefault(require("./modules/tv/tv.routes"));
const search_routes_1 = __importDefault(require("./modules/search/search.routes"));
const genres_routes_1 = __importDefault(require("./modules/genres/genres.routes"));
const streaming_routes_1 = __importDefault(require("./streaming/streaming.routes"));
const download_routes_1 = __importDefault(require("./modules/download/download.routes"));
const doodstream_routes_1 = __importDefault(require("./modules/doodstream/doodstream.routes"));
const otaku_routes_1 = __importDefault(require("./modules/otaku/otaku.routes"));
const admin_routes_1 = __importDefault(require("./modules/admin/admin.routes"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
const app = (0, express_1.default)();
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            frameSrc: ["'self'", "https://animekai.to", "https://*.vidlink.pro", "https://vidapi.xyz", "https://www.youtube.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https:"],
            imgSrc: ["'self'", "data:", "https:"],
            mediaSrc: ["'self'", "https:", "blob:"],
        },
    },
}));
app.use(express_1.default.json());
app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok' }, message: null });
});
app.post('/api/clear-cache', (_req, res) => {
    (0, tmdb_1.clearCache)();
    res.json({ success: true, data: null, message: 'TMDB cache cleared' });
});
app.use('/api/movies', movies_routes_1.default);
app.use('/api/tv', tv_routes_1.default);
app.use('/api/search', search_routes_1.default);
app.use('/api/genres', genres_routes_1.default);
app.use('/api/stream', streaming_routes_1.default);
app.use('/api/download', download_routes_1.default);
app.use('/api/doodstream', doodstream_routes_1.default);
app.use('/api/otaku', otaku_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        data: null,
        message: 'Route not found',
    });
});
app.use(error_middleware_1.errorMiddleware);
exports.default = app;
