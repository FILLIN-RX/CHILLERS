import { Router } from 'express';
import {
  cancelCampaign, config, createCampaign, generateCampaignDraft, currentPreferences, listCampaigns,
  optionalAuth, preferences, sendTest, subscribe, unsubscribe,
} from './notifications.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { adminMiddleware } from '../admin/admin.middleware';

const router = Router();
router.get('/config', config);
router.post('/subscriptions', optionalAuth, subscribe);
router.delete('/subscriptions', unsubscribe);
router.get('/preferences', optionalAuth, currentPreferences);
router.put('/preferences', optionalAuth, preferences);
router.post('/test', requireAuth, sendTest);
router.get('/admin/campaigns', adminMiddleware, listCampaigns);
router.post('/admin/campaigns/draft', adminMiddleware, generateCampaignDraft);
router.post('/admin/campaigns', adminMiddleware, createCampaign);
router.post('/admin/campaigns/:id/cancel', adminMiddleware, cancelCampaign);

export default router;
