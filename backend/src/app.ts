import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorMiddleware } from './middleware/error.middleware';
import { antiBotMiddleware } from './middleware/antibot.middleware';
import { verifyCsrfToken, generateCsrfToken } from './middleware/csrf.middleware';
import { apiRateLimiter, loginRateLimiter, streamingRateLimiter } from './middleware/rate-limit.middleware';
import { clearCache } from './config/tmdb';
import moviesRoutes from './modules/movies/movies.routes';
import tvRoutes from './modules/tv/tv.routes';
import searchRoutes from './modules/search/search.routes';
import genresRoutes from './modules/genres/genres.routes';
import streamingRoutes from './streaming/streaming.routes';
import nexstreamRoutes from './streaming/nexstream.routes';
import downloadRoutes from './modules/download/download.routes';
import doodstreamRoutes from './modules/doodstream/doodstream.routes';
import otakuRoutes from './modules/otaku/otaku.routes';
import frenchstreamRoutes from './modules/frenchstream/frenchstream.routes';
import adminRoutes from './modules/admin/admin.routes';
import availabilityRoutes from './modules/availability/availability.routes';
import affichesRoutes from './modules/affiches/affiches.routes';
import liveRoutes from './modules/live/live.routes';
import liveballRoutes from './modules/liveball/liveball.routes';
import subtitlesRoutes from './modules/subtitles/subtitles.routes';
import torrentsRoutes from './streaming/torrents/torrents.routes';
import aiRoutes from './modules/ai/ai.routes';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import omnisaveRoutes from './modules/omnisave/omnisave.routes';
import requestsRoutes from './modules/requests/requests.routes';

import compression from 'compression';

import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();

const allowedOrigins = [
  'https://chillers-pi.vercel.app',
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim().replace(/\/$/, '')) : []),
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(normalizedOrigin) || normalizedOrigin === 'https://chillers-pi.vercel.app') {
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

app.use(cors(corsOptions));
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    const contentType = res.getHeader('Content-Type');
    if (typeof contentType === 'string' && (contentType.includes('video/') || contentType.includes('application/octet-stream'))) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 512, // Compress payloads larger than 512 bytes
}));
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameSrc: ["'self'", "https://animekai.to", "https://*.vidlink.pro", "https://vidapi.xyz", "https://www.youtube.com", "https://doodstream.com", "https://*.doodstream.com", "https://d000d.com", "https://*.d000d.com", "https://d0000d.com", "https://playmogo.com", "https://*.playmogo.com", "https://*.dood.to", "https://*.vidzy.cc", "https://fsvid.lol", "https://*.fsvid.lol", "https://trakx.lol", "https://*.trakx.lol", "https://vidsrc.in", "https://*.vidsrc.in", "https://vidsrc.xyz", "https://embed.su", "https://uqload.is", "https://*.uqload.is", "https://uqload.vc", "https://*.uqload.vc", "https://www.google.com", "https://*.google.com",
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
      mediaSrc: ["'self'", "https:", "blob:"],
    },
  },
}));
app.use(express.json({ limit: '10mb' }));

// Fichiers uploadés manuellement par l'admin (uploads/ en mémoire) - servis
// publiquement pour permettre l'upload Uqload via URL
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' }, message: null });
});

app.post('/api/clear-cache', (_req, res) => {
  clearCache();
  res.json({ success: true, data: null, message: 'TMDB cache cleared' });
});

// Security middleware
// Rate limiting for API endpoints
app.use('/api', apiRateLimiter);

// CSRF token generation on first request
app.get('/api/csrf-token', generateCsrfToken);

// CSRF verification on state-changing requests
app.use('/api/admin', verifyCsrfToken);
app.use('/api/user', verifyCsrfToken);
app.use('/api/auth/logout', verifyCsrfToken);

// Protection anti-bot & anti-scraping sur les routes publiques et médias
app.use('/api', antiBotMiddleware);

app.use('/api/movies', moviesRoutes);
app.use('/api/tv', tvRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/genres', genresRoutes);
app.use('/api/stream', streamingRoutes);
app.use('/api/nexstream', nexstreamRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/doodstream', doodstreamRoutes);
app.use('/api/otaku', otakuRoutes);
app.use('/api/frenchstream', frenchstreamRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/ai', aiRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/affiches', affichesRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/liveball', liveballRoutes);
app.use('/api/subtitles', subtitlesRoutes);
app.use('/api/torrents', torrentsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/omnisave', omnisaveRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/admin/requests', requestsRoutes);
app.use('/api/internal/requests', requestsRoutes);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    message: 'Route not found',
  });
});

app.use(errorMiddleware);

export default app;
