import express from 'express';
import {
  getInventory,
  getInventoryById,
  createInventory,
  updateInventory,
  deleteInventory,
  bulkImportInventory,
  bulkExportInventory,
} from '../controllers/inventoryController.js';
import { protect, requireRole } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Bulk file operations (must be declared before /:id parameter matching)
router.get('/export', protect, bulkExportInventory);
router.post('/import', protect, upload.single('file'), bulkImportInventory);

router.route('/')
  .get(protect, getInventory)
  .post(protect, upload.array('images', 10), createInventory);

router.route('/:id')
  .get(protect, getInventoryById)
  .put(protect, upload.array('images', 10), updateInventory)
  .delete(protect, requireRole(['admin']), deleteInventory);

export default router;
