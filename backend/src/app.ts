import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { errorMiddleware } from './middleware/error.middleware';
import moviesRoutes from './modules/movies/movies.routes';
import tvRoutes from './modules/tv/tv.routes';
import searchRoutes from './modules/search/search.routes';
import genresRoutes from './modules/genres/genres.routes';
import streamingRoutes from './streaming/streaming.routes';
import downloadRoutes from './modules/download/download.routes';

dotenv.config();

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameSrc: ["'self'", "https://animekai.to", "https://vidlink.pro", "https://vidapi.xyz", "https://www.youtube.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      mediaSrc: ["'self'", "https:", "blob:"],
    },
  },
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from any localhost port (dev) or no origin (curl/mobile)
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' }, message: null });
});

app.use('/api/movies', moviesRoutes);
app.use('/api/tv', tvRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/genres', genresRoutes);
app.use('/api/stream', streamingRoutes);
app.use('/api/download', downloadRoutes);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    message: 'Route not found',
  });
});

app.use(errorMiddleware);

export default app;
