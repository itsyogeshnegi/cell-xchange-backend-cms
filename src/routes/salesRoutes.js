import express from 'express';
import {
  getSales,
  getSaleById,
  createSale,
  getSaleInvoicePDFResponse,
  getSaleThermalPDFResponse,
} from '../controllers/salesController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getSales)
  .post(protect, createSale);

router.get('/:id', protect, getSaleById);
router.get('/:id/pdf', protect, getSaleInvoicePDFResponse);
router.get('/:id/thermal', protect, getSaleThermalPDFResponse);

export default router;
