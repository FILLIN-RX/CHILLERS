import { Router } from 'express';
import { getChannels, getMatches, getMatchStream, getMatchStreamById, getSources } from './sports.controller';
import { getHlsMasterPlaylist, getHlsProxy } from './utils/sports.hls-relay';
import { MULTI_SERVER_ENABLED } from './match-channels.registry';
import labRoutes from './lab/lab.routes';
import { LAB_ENABLED } from './lab/lab-store';

const router = Router();

// Public
router.get('/matches', getMatches);
router.get('/sources', getSources);
router.get('/match/:source/:matchId/stream', getMatchStream);
router.get('/match/:matchId/stream', getMatchStreamById);

// Tous les serveurs du match (agrégation multi-providers, registre 24 h)
if (MULTI_SERVER_ENABLED) {
  router.get('/match/:matchId/channels', getChannels);
}

// Relay HLS (lecture via notre backend pour contourner les jetons liés à l'IP + CORS)
router.get('/match/:source/:matchId/hls/playlist.m3u8', getHlsMasterPlaylist);
router.get('/match/:source/:matchId/hls/proxy/:encoded', getHlsProxy);

// Lab chaînes de match : snapshot du lab + relay URL directe (flag dédié)
if (LAB_ENABLED) {
  router.use('/lab', labRoutes);
}

export default router;
