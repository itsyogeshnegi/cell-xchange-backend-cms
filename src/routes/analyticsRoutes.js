import express from 'express';
import { getDashboardSummary, getAnalyticsCharts } from '../controllers/analyticsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/summary', protect, getDashboardSummary);
router.get('/charts', protect, getAnalyticsCharts);

export default router;
