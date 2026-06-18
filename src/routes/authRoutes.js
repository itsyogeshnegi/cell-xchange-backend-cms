import express from 'express';
import {
  loginUser,
  changePassword,
  getProfile,
  getUsers,
  createUser,
  toggleUserStatus,
} from '../controllers/authController.js';
import { protect, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', loginUser);
router.put('/change-password', protect, changePassword);
router.get('/profile', protect, getProfile);

// Super Admin-only user management routes
router.get('/users', protect, requireRole(['super_admin']), getUsers);
router.post('/users', protect, requireRole(['super_admin']), createUser);
router.post('/register', protect, requireRole(['super_admin']), createUser);
router.patch('/users/:id/status', protect, requireRole(['super_admin']), toggleUserStatus);

export default router;
