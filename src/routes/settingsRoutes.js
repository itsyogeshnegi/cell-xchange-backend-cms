import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { protect, requireRole } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getSettings)
  .put(protect, requireRole(['admin']), upload.single('logo'), updateSettings);

export default router;
