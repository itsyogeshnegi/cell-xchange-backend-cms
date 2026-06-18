import Inventory from '../models/Inventory.js';
import bwipjs from 'bwip-js';
import { uploadFile, deleteFile } from '../config/r2.js';
import { parseInventoryExcel, exportToExcel } from '../utils/excelHelper.js';

// Helper to generate Base64 Barcode (Code128) and QR Code
const generateCodes = async (text) => {
  if (!text) return { barcode: '', qr: '' };
  try {
    const barcodeBuffer = await bwipjs.toBuffer({
      bcid: 'code128',
      text: text,
      scale: 2,
      height: 10,
      includetext: true,
      textxalign: 'center',
    });
    const barcodeBase64 = `data:image/png;base64,${barcodeBuffer.toString('base64')}`;

    const qrBuffer = await bwipjs.toBuffer({
      bcid: 'qrcode',
      text: text,
      scale: 3,
    });
    const qrBase64 = `data:image/png;base64,${qrBuffer.toString('base64')}`;

    return { barcode: barcodeBase64, qr: qrBase64 };
  } catch (err) {
    console.error('Error generating barcodes:', err);
    return { barcode: '', qr: '' };
  }
};

/**
 * Get all inventory (with filters, search, and pagination)
 * Route: GET /api/inventory
 */
export const getInventory = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const productType = req.query.productType || '';
  const brand = req.query.brand || '';
  const condition = req.query.condition || '';
  const deviceStatus = req.query.deviceStatus || '';

  try {
    const query = {};

    if (search) {
      query.$or = [
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { imei1: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } },
      ];
    }

    if (productType) query.productType = productType;
    if (brand) query.brand = brand;
    if (condition) query.condition = condition;
    if (deviceStatus) query.deviceStatus = deviceStatus;

    const total = await Inventory.countDocuments(query);
    const items = await Inventory.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json({
      items,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Get single inventory item details
 * Route: GET /api/inventory/:id
 */
export const getInventoryById = async (req, res) => {
  const { id } = req.params;

  try {
    const item = await Inventory.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }
    return res.json(item);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Create a new inventory item manually
 * Route: POST /api/inventory
 */
export const createInventory = async (req, res) => {
  try {
    const {
      productType,
      brand,
      model,
      color,
      ram,
      storage,
      processor,
      batteryHealth,
      imei1,
      imei2,
      serialNumber,
      condition,
      purchasePrice,
      sellingPrice,
      warrantyStatus,
      accessoriesIncluded,
      deviceStatus,
    } = req.body;

    // Verify uniqueness of IMEI / Serial
    if (imei1) {
      const imeiExists = await Inventory.findOne({ imei1 });
      if (imeiExists) {
        return res.status(400).json({ message: `IMEI 1 (${imei1}) already exists in inventory.` });
      }
    }
    if (serialNumber) {
      const serialExists = await Inventory.findOne({ serialNumber });
      if (serialExists) {
        return res.status(400).json({ message: `Serial Number (${serialNumber}) already exists in inventory.` });
      }
    }

    // Process uploaded images
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const url = await uploadFile(file);
        imageUrls.push(url);
      }
    }

    // Generate barcodes based on IMEI or Serial or Unique ID
    const codeSource = imei1 || serialNumber || `CX-${Date.now()}`;
    const { barcode, qr } = await generateCodes(codeSource);

    const item = await Inventory.create({
      productType,
      brand,
      model,
      color,
      ram,
      storage,
      processor,
      batteryHealth,
      imei1,
      imei2,
      serialNumber,
      condition,
      purchasePrice: Number(purchasePrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      warrantyStatus,
      accessoriesIncluded: accessoriesIncluded ? (Array.isArray(accessoriesIncluded) ? accessoriesIncluded : JSON.parse(accessoriesIncluded)) : [],
      images: imageUrls,
      deviceStatus: deviceStatus || 'Available',
      barcodeUrl: barcode,
      qrCodeUrl: qr,
    });

    await req.logActivity('CREATE_INVENTORY', `Added inventory item: ${item.brand} ${item.model} (S/N: ${codeSource})`);
    return res.status(201).json(item);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Update inventory item details
 * Route: PUT /api/inventory/:id
 */
export const updateInventory = async (req, res) => {
  const { id } = req.params;

  try {
    const item = await Inventory.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    const {
      productType,
      brand,
      model,
      color,
      ram,
      storage,
      processor,
      batteryHealth,
      imei1,
      imei2,
      serialNumber,
      condition,
      purchasePrice,
      sellingPrice,
      warrantyStatus,
      accessoriesIncluded,
      deviceStatus,
    } = req.body;

    // Check IMEI / Serial uniqueness
    if (imei1 && imei1 !== item.imei1) {
      const imeiExists = await Inventory.findOne({ imei1 });
      if (imeiExists) return res.status(400).json({ message: `IMEI 1 (${imei1}) already exists.` });
    }
    if (serialNumber && serialNumber !== item.serialNumber) {
      const serialExists = await Inventory.findOne({ serialNumber });
      if (serialExists) return res.status(400).json({ message: `Serial Number (${serialNumber}) already exists.` });
    }

    // Regnerate codes if source changes
    const newCodeSource = imei1 || serialNumber || item.imei1 || item.serialNumber;
    const oldCodeSource = item.imei1 || item.serialNumber;
    if (newCodeSource !== oldCodeSource || !item.barcodeUrl) {
      const { barcode, qr } = await generateCodes(newCodeSource || `CX-${Date.now()}`);
      item.barcodeUrl = barcode;
      item.qrCodeUrl = qr;
    }

    // Process new images if uploaded
    if (req.files && req.files.length > 0) {
      const newImageUrls = [];
      for (const file of req.files) {
        const url = await uploadFile(file);
        newImageUrls.push(url);
      }
      item.images = [...item.images, ...newImageUrls];
    }

    item.productType = productType || item.productType;
    item.brand = brand || item.brand;
    item.model = model || item.model;
    item.color = color !== undefined ? color : item.color;
    item.ram = ram !== undefined ? ram : item.ram;
    item.storage = storage !== undefined ? storage : item.storage;
    item.processor = processor !== undefined ? processor : item.processor;
    item.batteryHealth = batteryHealth !== undefined ? Number(batteryHealth) : item.batteryHealth;
    item.imei1 = imei1 !== undefined ? imei1 : item.imei1;
    item.imei2 = imei2 !== undefined ? imei2 : item.imei2;
    item.serialNumber = serialNumber !== undefined ? serialNumber : item.serialNumber;
    item.condition = condition || item.condition;
    item.purchasePrice = purchasePrice !== undefined ? Number(purchasePrice) : item.purchasePrice;
    item.sellingPrice = sellingPrice !== undefined ? Number(sellingPrice) : item.sellingPrice;
    item.warrantyStatus = warrantyStatus !== undefined ? warrantyStatus : item.warrantyStatus;
    item.accessoriesIncluded = accessoriesIncluded ? (Array.isArray(accessoriesIncluded) ? accessoriesIncluded : JSON.parse(accessoriesIncluded)) : item.accessoriesIncluded;
    item.deviceStatus = deviceStatus || item.deviceStatus;

    await item.save();
    await req.logActivity('UPDATE_INVENTORY', `Updated inventory item: ${item.brand} ${item.model} (${item._id})`);
    
    return res.json(item);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Delete inventory item (Admin / Manager only)
 * Route: DELETE /api/inventory/:id
 */
export const deleteInventory = async (req, res) => {
  const { id } = req.params;

  try {
    const item = await Inventory.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    // If item status is Sold, prevent deletion to preserve billing logs consistency
    if (item.deviceStatus === 'Sold') {
      return res.status(400).json({
        message: 'Cannot delete a sold item. This is required to maintain billing audit trails.',
      });
    }

    // Clean up uploaded product images
    if (item.images && item.images.length > 0) {
      for (const imgUrl of item.images) {
        await deleteFile(imgUrl);
      }
    }

    await Inventory.findByIdAndDelete(id);
    await req.logActivity('DELETE_INVENTORY', `Deleted inventory item: ${item.brand} ${item.model} (${id})`);

    return res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Bulk import inventory from Excel sheet
 * Route: POST /api/inventory/import
 */
export const bulkImportInventory = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No spreadsheet file uploaded.' });
  }

  try {
    const parsedItems = parseInventoryExcel(req.file.buffer);
    const addedItems = [];
    const errors = [];

    for (const item of parsedItems) {
      try {
        // Enforce uniqueness check
        if (item.imei1) {
          const exists = await Inventory.findOne({ imei1: item.imei1 });
          if (exists) {
            errors.push(`IMEI 1 (${item.imei1}) already exists in database.`);
            continue;
          }
        }
        if (item.serialNumber) {
          const exists = await Inventory.findOne({ serialNumber: item.serialNumber });
          if (exists) {
            errors.push(`Serial Number (${item.serialNumber}) already exists.`);
            continue;
          }
        }

        // Generate barcodes
        const codeSource = item.imei1 || item.serialNumber || `CX-${Date.now()}-${Math.round(Math.random()*1000)}`;
        const { barcode, qr } = await generateCodes(codeSource);
        
        item.barcodeUrl = barcode;
        item.qrCodeUrl = qr;

        const created = await Inventory.create(item);
        addedItems.push(created);
      } catch (err) {
        errors.push(`Row ${item.brand} ${item.model} failed: ${err.message}`);
      }
    }

    await req.logActivity('BULK_IMPORT_INVENTORY', `Bulk imported ${addedItems.length} items from spreadsheet`);

    return res.status(201).json({
      message: `Successfully imported ${addedItems.length} items.`,
      successCount: addedItems.length,
      errorCount: errors.length,
      errors,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Export current inventory stock list to Excel
 * Route: GET /api/inventory/export
 */
export const bulkExportInventory = async (req, res) => {
  try {
    const items = await Inventory.find({}).sort({ createdAt: -1 });

    const exportData = items.map((item) => ({
      'Product Type': item.productType,
      'Brand': item.brand,
      'Model': item.model,
      'Color': item.color || '',
      'RAM': item.ram || '',
      'Storage': item.storage || '',
      'Processor': item.processor || '',
      'Battery Health (%)': item.batteryHealth || '',
      'IMEI 1': item.imei1 || '',
      'IMEI 2': item.imei2 || '',
      'Serial Number': item.serialNumber || '',
      'Condition': item.condition,
      'Purchase Price (INR)': item.purchasePrice,
      'Selling Price (INR)': item.sellingPrice,
      'Warranty Status': item.warrantyStatus || '',
      'Status': item.deviceStatus,
      'Date Added': new Date(item.createdAt).toLocaleDateString(),
    }));

    const buffer = exportToExcel(exportData, 'Inventory Stock');
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Inventory_Stock_Report.xlsx');
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
