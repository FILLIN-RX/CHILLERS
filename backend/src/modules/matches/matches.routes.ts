import { Router } from 'express';
import { matchesController } from './matches.controller';

const router = Router();

// GET /api/matches - Récupère la liste des matchs (filtres: status, league, date, sport, search)
router.get('/', (req, res, next) => matchesController.getMatches(req, res, next));

// GET /api/matches/leagues - Liste des compétitions & ligues supportées
router.get('/leagues', (req, res, next) => matchesController.getLeagues(req, res, next));

// GET /api/matches/:id/summary - Détails complets d'un match (boxscore, rosters, keyEvents)
router.get('/:id/summary', (req, res, next) => matchesController.getMatchSummary(req, res, next));

// GET /api/matches/summary/:id - Alias pour les détails complets
router.get('/summary/:id', (req, res, next) => matchesController.getMatchSummary(req, res, next));

// GET /api/matches/:id/stream - Résolution automatique du flux vidéo en direct (LiveBall, Kora, Streamiz...)
router.get('/:id/stream', (req, res, next) => matchesController.getMatchStream(req, res, next));

// GET /api/matches/:id - Détails d'un match spécifique (scoreboard header)
router.get('/:id', (req, res, next) => matchesController.getMatchById(req, res, next));

export default router;
