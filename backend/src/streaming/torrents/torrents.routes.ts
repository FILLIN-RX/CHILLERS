import { Router } from 'express';
import * as torrentsController from './torrents.controller';
import { getMagnet } from './magnet.controller';

const router = Router();

router.get('/health', torrentsController.healthCheck);
router.get('/magnet', getMagnet);
router.get('/stream', torrentsController.streamFile);
router.get('/download', torrentsController.downloadFile);

export default router;
