import { Router } from 'express';
import { optionalAuth } from '../../middleware/auth.middleware';
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

// Paiement : le don est ouvert aux non-connectés (transaction anonyme).
// L'auth est optionnelle — le service exige un compte uniquement pour un
// abonnement, et chaque accès reste cloisonné (user → ses txns, anonyme →
// les txns sans compte).
router.post('/softpay', optionalAuth, startSoftpay);
router.get('/:id', optionalAuth, getStatus);
router.post('/:id/confirm-otp', optionalAuth, confirmOtp);
router.post('/:id/retry', optionalAuth, retry);

export default router;
