import { Router } from 'express';
import { matchesController } from './matches.controller';
import { competitionsController } from '../competitions/competitions.controller';
import { streamsController } from '../streams/streams.controller';

const router = Router();

// 1. Liste et filtres des matchs (supporte ?country=, ?league=, ?month=, ?season=, ?date=, etc.)
router.get('/', (req, res, next) => matchesController.getMatches(req, res, next));

// 2. Pays et Championnats
router.get('/countries', (req, res, next) => matchesController.getCountries(req, res, next));
router.get('/countries/:countryId/leagues', (req, res, next) => matchesController.getLeaguesByCountry(req, res, next));
router.get('/leagues', (req, res, next) => matchesController.getLeagues(req, res, next));
router.get('/leagues/:leagueId', (req, res, next) => matchesController.getLeagueById(req, res, next));
router.get('/leagues/:leagueId/standings', (req, res, next) => competitionsController.getStandings(req, res, next));
router.get('/leagues/:leagueId/seasons', (req, res, next) => competitionsController.getSeasons(req, res, next));

// 3. SSE Flux Temps Réel (Scores en direct, minutes, buts)
router.get('/live/sse', (req, res) => matchesController.subscribeLiveSSE(req, res));
router.post('/live/sse/test-goal', (req, res) => matchesController.simulateGoal(req, res));

// 4. Match spécifique, Analyse détaillée et Stream
router.get('/:id', (req, res, next) => matchesController.getMatchById(req, res, next));
router.get('/:id/summary', (req, res, next) => matchesController.getMatchSummary(req, res, next));
router.get('/:id/analysis', (req, res, next) => matchesController.getMatchAnalysis(req, res, next));
router.get('/:id/stream', (req, res, next) => streamsController.getStreamById(req, res, next));

export default router;
