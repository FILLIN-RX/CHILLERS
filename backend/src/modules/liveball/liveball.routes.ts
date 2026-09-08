import { Router } from 'express';
import { getMatches, getAvailableMatches, getLeagueMatches, getMatchStream } from './liveball.controller';

const router = Router();

// Public
router.get('/matches', getMatches);
router.get('/matches/available', getAvailableMatches);
router.get('/league/:league/matches', getLeagueMatches);
router.get('/match/:matchId/stream', getMatchStream);

export default router;