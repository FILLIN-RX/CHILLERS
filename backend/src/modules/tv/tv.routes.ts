import { Router } from 'express';
import * as tvController from './tv.controller';

const router = Router();

router.get('/popular', tvController.getPopular);
router.get('/trending', tvController.getTrending);
router.get('/:id', tvController.getDetails);
router.get('/:id/season/:seasonNumber', tvController.getSeasonDetails);

export default router;
