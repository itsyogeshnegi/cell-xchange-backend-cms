import express from 'express';
import { getAuditLogs } from '../controllers/auditLogController.js';
import { protect, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, requireRole(['admin']), getAuditLogs);

export default router;
