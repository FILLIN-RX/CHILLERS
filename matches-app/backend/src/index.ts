import './config/env';
import express from 'express';
import cors from 'cors';
import matchesRouter from './matches/matches.routes';
import competitionsRouter from './competitions/competitions.routes';
import teamsRouter from './teams/teams.routes';
import playersRouter from './players/players.routes';
import streamsRouter from './streams/streams.routes';
import sportsRouter from './sports/sports.routes';
import liveRouter from './modules/live/live.routes';

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 5050;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'matches-backend',
    timestamp: new Date().toISOString(),
  });
});

// APIs
app.use('/api/matches', matchesRouter);
app.use('/api/competitions', competitionsRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/players', playersRouter);
app.use('/api/streams', streamsRouter);
// Sources sportives + relay HLS local (playlists + segments).
app.use('/api/sports', sportsRouter);
// Chaînes OHA, EPG, sélection TV et proxies (embed + HLS).
app.use('/api/live', liveRouter);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[MatchesBackend] Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

app.listen(PORT, () => {
  console.log(`[MatchesBackend] Running on http://localhost:${PORT}`);
  console.log(`[MatchesBackend] Endpoints:`);
  console.log(` - GET http://localhost:${PORT}/api/matches`);
  console.log(` - GET http://localhost:${PORT}/api/matches/countries`);
  console.log(` - GET http://localhost:${PORT}/api/competitions`);
  console.log(` - GET http://localhost:${PORT}/api/competitions/:leagueId/standings`);
  console.log(` - GET http://localhost:${PORT}/api/competitions/:leagueId/teams`);
  console.log(` - GET http://localhost:${PORT}/api/competitions/:leagueId/leaders`);
  console.log(` - GET http://localhost:${PORT}/api/teams/:teamId`);
  console.log(` - GET http://localhost:${PORT}/api/teams/:teamId/roster`);
  console.log(` - GET http://localhost:${PORT}/api/players/:playerId`);
  console.log(` - GET http://localhost:${PORT}/api/streams/:id`);
  console.log(` - GET http://localhost:${PORT}/api/sports/match/:matchId/stream`);
  console.log(` - GET http://localhost:${PORT}/api/live/oha/channels`);
  console.log(` - GET http://localhost:${PORT}/api/live/match-channels`);
});
