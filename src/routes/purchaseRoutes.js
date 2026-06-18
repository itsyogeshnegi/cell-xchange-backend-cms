import express from 'express';
import {
  getPurchases,
  getPurchaseById,
  createPurchase,
  getPurchaseInvoicePDFResponse,
} from '../controllers/purchaseController.js';
import { protect } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

const purchaseUploadFields = upload.fields([
  { name: 'customerPhoto', maxCount: 1 },
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
  { name: 'panImage', maxCount: 1 },
  { name: 'deviceImages', maxCount: 5 },
]);

router.route('/')
  .get(protect, getPurchases)
  .post(protect, purchaseUploadFields, createPurchase);

router.get('/:id', protect, getPurchaseById);
router.get('/:id/pdf', protect, getPurchaseInvoicePDFResponse);

export default router;
