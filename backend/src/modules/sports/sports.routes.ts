import { Router } from 'express';
import { getMatches, getMatchStream, getMatchStreamById, getSources } from './sports.controller';
import { getHlsMasterPlaylist, getHlsProxy } from './sports.hls-relay';

const router = Router();

// Public
router.get('/matches', getMatches);
router.get('/sources', getSources);
router.get('/match/:source/:matchId/stream', getMatchStream);
router.get('/match/:matchId/stream', getMatchStreamById);

// Relay HLS (lecture via notre backend pour contourner les jetons liés à l'IP + CORS)
router.get('/match/:source/:matchId/hls/playlist.m3u8', getHlsMasterPlaylist);
router.get('/match/:source/:matchId/hls/proxy/:encoded', getHlsProxy);

export default router;
