import express from 'express';
import { getNotifications, markAllAsRead } from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getNotifications);
router.put('/read', protect, markAllAsRead);

export default router;
