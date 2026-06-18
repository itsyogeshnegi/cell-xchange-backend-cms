import express from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customerController.js';
import { protect, requireRole } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Specify file fields for customer profile + documentation uploads
const uploadFields = upload.fields([
  { name: 'customerPhoto', maxCount: 1 },
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
  { name: 'panImage', maxCount: 1 },
]);

router.route('/')
  .get(protect, getCustomers)
  .post(protect, uploadFields, createCustomer);

router.route('/:id')
  .get(protect, getCustomerById)
  .put(protect, uploadFields, updateCustomer)
  .delete(protect, requireRole(['admin']), deleteCustomer);

export default router;
