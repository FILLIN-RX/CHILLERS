import { Router } from 'express';
import {
  submitRequestHandler,
  getUserRequestsHandler,
  fulfillRequestHandler,
  getAdminRequestsHandler,
  retrySearchHandler,
} from './requests.controller';
import { requireAuth, optionalAuth } from '../../middleware/auth.middleware';
import { adminMiddleware } from '../admin/admin.middleware';

const router = Router();

// Route publique / authentifiée pour soumettre une demande
router.post('/', optionalAuth, submitRequestHandler);

// Route pour récupérer les demandes de l'utilisateur connecté
router.get('/me', requireAuth, getUserRequestsHandler);

// Callback interne appelé par le microservice Go
router.post('/internal/:id/fulfill', fulfillRequestHandler);

// Routes d'administration
router.get('/admin', adminMiddleware, getAdminRequestsHandler);
router.post('/admin/:id/retry', adminMiddleware, retrySearchHandler);
router.get('/admin-list', adminMiddleware, getAdminRequestsHandler);
router.post('/retry/:id', adminMiddleware, retrySearchHandler);

export default router;
