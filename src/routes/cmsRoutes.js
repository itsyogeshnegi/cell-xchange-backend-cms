import express from 'express';
import {
  getPublicProducts,
  getPublicProductById,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductVisibility,
  getWebCMS,
  updateWebCMS,
} from '../controllers/cmsController.js';
import { protect, requireRole } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Public routes for website frontend (NO AUTH REQUIRED)
router.get('/public/products', getPublicProducts);
router.get('/public/products/:id', getPublicProductById);
router.get('/public/homepage', getWebCMS);

// Admin dashboard product CRUD routes
router.route('/products')
  .get(protect, getProducts)
  .post(protect, requireRole(['admin']), upload.array('images', 10), createProduct);

router.route('/products/:id/toggle')
  .put(protect, requireRole(['admin']), toggleProductVisibility);

router.route('/products/:id')
  .put(protect, requireRole(['admin']), upload.array('images', 10), updateProduct)
  .delete(protect, requireRole(['admin']), deleteProduct);

// Admin homepage CMS copywriting routes
router.route('/homepage')
  .get(protect, getWebCMS)
  .put(protect, requireRole(['admin']), updateWebCMS);

export default router;
