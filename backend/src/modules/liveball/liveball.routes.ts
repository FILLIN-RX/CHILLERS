import { Router } from 'express';
import { getMatches, getAvailableMatches, getLeagueMatches, getMatchStream } from './liveball.controller';
import { getHlsMasterPlaylist, getHlsProxy } from './liveball.hls-relay';

const router = Router();

// Public
router.get('/matches', getMatches);
router.get('/matches/available', getAvailableMatches);
router.get('/league/:league/matches', getLeagueMatches);
router.get('/match/:matchId/stream', getMatchStream);

// Relay HLS (lecture via notre backend pour éviter jeton lié à l'IP + CORS)
router.get('/match/:matchId/hls/playlist.m3u8', getHlsMasterPlaylist);
router.get('/match/:matchId/hls/proxy/:encoded', getHlsProxy);

export default router;