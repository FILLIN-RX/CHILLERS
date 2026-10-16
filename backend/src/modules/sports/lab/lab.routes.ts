/**
 * Routes du lab « chaînes de match » — montage conditionnel dans
 * `sports.routes.ts` : sans `SPORTS_CHANNELS_LAB=1`, `/api/sports/lab/*` n'existe pas.
 */
import { Router } from 'express';
import { getLabFixture, getLabFixtureChannels, getLabReport } from './lab.controller';
import { getLabPlaylist, getLabProxy } from './lab-relay';

const router = Router();

// Snapshot : fixtures fusionnés + liens de toutes les chaînes probeées
router.get('/report', getLabReport);
router.get('/fixtures', getLabReport);
router.get('/fixtures/:fixtureId', getLabFixture);
router.get('/fixtures/:fixtureId/channels', getLabFixtureChannels);

// Lecture d'un lien HLS du snapshot (playlist maître puis segments)
router.get('/play', getLabPlaylist);
router.get('/proxy/:encoded', getLabProxy);

export default router;
