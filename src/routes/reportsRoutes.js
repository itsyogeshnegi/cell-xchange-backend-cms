import express from 'express';
import { getReportData, exportReportExcel } from '../controllers/reportsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getReportData);
router.get('/export', protect, exportReportExcel);

export default router;
