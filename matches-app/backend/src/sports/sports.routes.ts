import { Router } from 'express';
import { getChannels, getMatches, getMatchStream, getMatchStreamById, getSources } from './sports.controller';
import { getHlsMasterPlaylist, getHlsProxy } from './utils/sports.hls-relay';
import { MULTI_SERVER_ENABLED } from './match-channels.registry';
import { matchLogger } from './match-logger';
import labRoutes from './lab/lab.routes';
import { LAB_ENABLED } from './lab/lab-store';

const router = Router();

router.get('/matches', getMatches);
router.get('/sources', getSources);
router.get('/match/:source/:matchId/stream', matchLogger, getMatchStream);
router.get('/match/:matchId/stream', matchLogger, getMatchStreamById);

if (MULTI_SERVER_ENABLED) router.get('/match/:matchId/channels', matchLogger, getChannels);

router.get('/match/:source/:matchId/hls/playlist.m3u8', matchLogger, getHlsMasterPlaylist);
router.get('/match/:source/:matchId/hls/proxy/:encoded', matchLogger, getHlsProxy);

if (LAB_ENABLED) {
  router.use('/lab', labRoutes);
}

export default router;
