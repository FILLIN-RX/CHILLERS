import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import {
  confirmOtp,
  getConfig,
  getNetworks,
  getPlans,
  getRatesCtrl,
  getStatus,
  retry,
  startSoftpay,
  webhook,
} from './payments.controller';

const router = Router();

// Webhook (signature HMAC, pas d'auth utilisateur) — monté AVANT /:id
router.post('/webhook', webhook);

// Référentiels (publics — aucune clé exposée)
router.get('/config', getConfig);
router.get('/networks', getNetworks);
router.get('/rates', getRatesCtrl);
router.get('/plans', getPlans);

// Paiement (utilisateur authentifié)
router.post('/softpay', requireAuth, startSoftpay);
router.get('/:id', requireAuth, getStatus);
router.post('/:id/confirm-otp', requireAuth, confirmOtp);
router.post('/:id/retry', requireAuth, retry);

export default router;
