"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const error_middleware_1 = require("./middleware/error.middleware");
const movies_routes_1 = __importDefault(require("./modules/movies/movies.routes"));
const tv_routes_1 = __importDefault(require("./modules/tv/tv.routes"));
const search_routes_1 = __importDefault(require("./modules/search/search.routes"));
const genres_routes_1 = __importDefault(require("./modules/genres/genres.routes"));
const streaming_routes_1 = __importDefault(require("./streaming/streaming.routes"));
const download_routes_1 = __importDefault(require("./modules/download/download.routes"));
const doodstream_routes_1 = __importDefault(require("./modules/doodstream/doodstream.routes"));
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
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(s => s.trim());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.some(o => origin.startsWith(o))) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok' }, message: null });
});
app.use('/api/movies', movies_routes_1.default);
app.use('/api/tv', tv_routes_1.default);
app.use('/api/search', search_routes_1.default);
app.use('/api/genres', genres_routes_1.default);
app.use('/api/stream', streaming_routes_1.default);
app.use('/api/download', download_routes_1.default);
app.use('/api/doodstream', doodstream_routes_1.default);
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        data: null,
        message: 'Route not found',
    });
});
app.use(error_middleware_1.errorMiddleware);
exports.default = app;
