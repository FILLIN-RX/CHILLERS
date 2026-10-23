import { Router } from 'express';
import { adminMiddleware } from '../admin/admin.middleware';
import { getTrafficReport, recordVisit } from './analytics.controller';

const router = Router();

router.post('/visit', recordVisit);
router.get('/admin/report', adminMiddleware, getTrafficReport);

export default router;
