import { Router } from 'express';
import * as authController from './auth.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import * as subController from '../admin/subscription.controller';
import { proofUpload, publicProofUrl } from '../admin/media.upload';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', requireAuth, authController.getProfile);
router.post('/revoke-session', requireAuth, authController.revokeSession);
router.post('/revoke-other-sessions', requireAuth, authController.revokeOtherSessions);
router.get('/plans', authController.getPlans);

// Upload capture d'écran de preuve de paiement
router.post('/payment-proof/upload', requireAuth, proofUpload.single('screenshot'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Aucun fichier reçu' });
  }
  const url = publicProofUrl(req.file.filename);
  res.json({ success: true, url });
});

// Soumission de la preuve de paiement
router.post('/payment-proof', requireAuth, subController.submitPaymentProof);

export default router;
