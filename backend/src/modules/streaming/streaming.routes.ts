import { Router } from 'express';
import * as streamingController from './streaming.controller';
import { handleOhaRelay } from './oha-hls-relay';

const router = Router();

router.get('/oha/hls', handleOhaRelay);
router.get('/oha/file', handleOhaRelay);

router.get('/movie/:id', streamingController.getMovieStream);
router.get('/afroland/:id/movie', streamingController.getAfrolandMovieStream);
router.get('/afroland/:id/:season/:episode', streamingController.getAfrolandEpisodeStream);
router.get('/tv/:id/:season/:episode', streamingController.getEpisodeStream);

export default router;
