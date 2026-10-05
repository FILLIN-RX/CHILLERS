import { Router } from 'express';
import { streamsController } from './streams.controller';

const router = Router();

// GET /api/streams/live - Liste des matchs en direct
router.get('/live', (req, res, next) => streamsController.getLiveList(req, res, next));

// GET /api/streams/resolve - Résolution par noms d'équipes (?home=...&away=...)
router.get('/resolve', (req, res, next) => streamsController.resolveByTeams(req, res, next));

// GET /api/streams/:id - Résolution par ID (ESPN ou LiveBall)
router.get('/:id', (req, res, next) => streamsController.getStreamById(req, res, next));

export default router;
