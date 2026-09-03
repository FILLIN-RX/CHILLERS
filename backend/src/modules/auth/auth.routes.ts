import { Router } from 'express';
import * as authController from './auth.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', requireAuth, authController.getProfile);
router.post('/revoke-session', requireAuth, authController.revokeSession);
router.get('/plans', authController.getPlans);

export default router;
