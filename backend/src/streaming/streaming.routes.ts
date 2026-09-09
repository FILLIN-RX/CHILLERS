import { Router } from 'express';
import * as streamingController from './streaming.controller';

const router = Router();

// Routes de streaming (Gestion automatique des paliers free / guest / premium dans le controller)
router.get('/movie/:id', streamingController.getMovieStream);
router.get('/tv/:id/:season/:episode', streamingController.getEpisodeStream);

export default router;
