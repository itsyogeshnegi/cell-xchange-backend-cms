import Purchase from '../models/Purchase.js';
import Inventory from '../models/Inventory.js';
import Customer from '../models/Customer.js';
import Settings from '../models/Settings.js';
import Notification from '../models/Notification.js';
import { uploadFile } from '../config/r2.js';
import bwipjs from 'bwip-js';
import { generatePurchaseInvoicePDF } from '../utils/pdfGenerator.js';

// Helper to generate Base64 Barcodes
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
 * Get all purchase transactions (paginated)
 * Route: GET /api/purchases
 */
export const getPurchases = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const total = await Purchase.countDocuments({});
    const purchases = await Purchase.find({})
      .populate('customer', 'fullName phone')
      .populate('purchasedBy', 'name')
      .populate('device', 'brand model storage color imei1')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json({
      purchases,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Get purchase transaction by ID
 * Route: GET /api/purchases/:id
 */
export const getPurchaseById = async (req, res) => {
  const { id } = req.params;

  try {
    const purchase = await Purchase.findById(id)
      .populate('customer')
      .populate('purchasedBy', 'name')
      .populate('device');
      
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase transaction not found' });
    }
    return res.json(purchase);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Create a new Purchase (Trade-in: Shop buys from Customer)
 * Route: POST /api/purchases
 */
export const createPurchase = async (req, res) => {
  try {
    const {
      // Customer details (used if creating/updating customer)
      customerId,
      fullName,
      phone,
      alternatePhone,
      gender,
      address,
      aadhaarNumber,
      panNumber,
      notes,
      
      // Device details
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
      
      // Transaction
      paymentMethod,
    } = req.body;

    // 1. Process files for Customer & Device if uploaded
    let customerPhotoUrl = '';
    let aadhaarFrontUrl = '';
    let aadhaarBackUrl = '';
    let panImageUrl = '';
    const deviceImageUrls = [];

    if (req.files) {
      if (req.files['customerPhoto']) customerPhotoUrl = await uploadFile(req.files['customerPhoto'][0]);
      if (req.files['aadhaarFront']) aadhaarFrontUrl = await uploadFile(req.files['aadhaarFront'][0]);
      if (req.files['aadhaarBack']) aadhaarBackUrl = await uploadFile(req.files['aadhaarBack'][0]);
      if (req.files['panImage']) panImageUrl = await uploadFile(req.files['panImage'][0]);
      if (req.files['deviceImages']) {
        for (const file of req.files['deviceImages']) {
          const url = await uploadFile(file);
          deviceImageUrls.push(url);
        }
      }
    }

    // 2. Load or Create Customer
    let customer;
    if (customerId) {
      customer = await Customer.findById(customerId);
      if (!customer) {
        return res.status(404).json({ message: 'Specified Customer ID not found.' });
      }
      // Optionally update details if provided
      if (fullName) customer.fullName = fullName;
      if (address) customer.address = address;
      if (aadhaarNumber) customer.aadhaarNumber = aadhaarNumber;
      if (panNumber) customer.panNumber = panNumber;
      if (customerPhotoUrl) customer.customerPhoto = customerPhotoUrl;
      if (aadhaarFrontUrl) customer.aadhaarFront = aadhaarFrontUrl;
      if (aadhaarBackUrl) customer.aadhaarBack = aadhaarBackUrl;
      if (panImageUrl) customer.panImage = panImageUrl;
      await customer.save();
    } else {
      // Create new customer
      const existingCustomer = await Customer.findOne({ phone });
      if (existingCustomer) {
        customer = existingCustomer;
      } else {
        customer = await Customer.create({
          fullName,
          phone,
          alternatePhone,
          gender,
          address,
          aadhaarNumber,
          panNumber,
          customerPhoto: customerPhotoUrl,
          aadhaarFront: aadhaarFrontUrl,
          aadhaarBack: aadhaarBackUrl,
          panImage: panImageUrl,
          notes,
        });
      }
    }

    // 3. Create the Device in Inventory automatically
    if (imei1) {
      const imeiExists = await Inventory.findOne({ imei1 });
      if (imeiExists) {
        return res.status(400).json({ message: `Device with IMEI 1 (${imei1}) already exists in inventory.` });
      }
    }
    if (serialNumber) {
      const serialExists = await Inventory.findOne({ serialNumber });
      if (serialExists) {
        return res.status(400).json({ message: `Device with Serial Number (${serialNumber}) already exists.` });
      }
    }

    const codeSource = imei1 || serialNumber || `CX-${Date.now()}`;
    const { barcode, qr } = await generateCodes(codeSource);

    const device = await Inventory.create({
      productType,
      brand,
      model,
      color,
      ram,
      storage,
      processor,
      batteryHealth: batteryHealth ? Number(batteryHealth) : undefined,
      imei1,
      imei2,
      serialNumber,
      condition,
      purchasePrice: Number(purchasePrice) || 0,
      sellingPrice: Number(sellingPrice) || Number(purchasePrice) * 1.25, // default markup 25% if not set
      warrantyStatus: warrantyStatus || 'Shop Warranty',
      accessoriesIncluded: accessoriesIncluded ? (Array.isArray(accessoriesIncluded) ? accessoriesIncluded : JSON.parse(accessoriesIncluded)) : [],
      images: deviceImageUrls,
      deviceStatus: 'Available',
      barcodeUrl: barcode,
      qrCodeUrl: qr,
    });

    // 4. Generate sequential Purchase Number
    const settings = await Settings.findOne({}) || { purchasePrefix: 'CX-PUR-' };
    const lastPurchase = await Purchase.findOne({ purchaseNumber: new RegExp('^' + settings.purchasePrefix) }).sort({ createdAt: -1 });
    let nextNum = 1;
    if (lastPurchase) {
      const match = lastPurchase.purchaseNumber.replace(settings.purchasePrefix, '');
      const lastVal = parseInt(match, 10);
      if (!isNaN(lastVal)) {
        nextNum = lastVal + 1;
      }
    }
    const purchaseNumber = `${settings.purchasePrefix}${String(nextNum).padStart(5, '0')}`;

    // 5. Create Purchase log
    const purchase = await Purchase.create({
      purchaseNumber,
      customer: customer._id,
      device: device._id,
      paymentMethod,
      purchasePrice: Number(purchasePrice) || 0,
      purchasedBy: req.user._id,
    });

    // 6. Push notification
    await Notification.create({
      type: 'new_purchase',
      message: `Inward purchase completed: ${purchaseNumber} | Device: ${device.brand} ${device.model} | Paid: ₹${purchase.purchasePrice.toLocaleString()}`,
    });

    await req.logActivity(
      'CREATE_PURCHASE',
      `Inwarded device: ${device.brand} ${device.model} on purchase voucher: ${purchaseNumber}`
    );

    return res.status(201).json(purchase);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Generate A4 Inward Purchase Voucher PDF on the fly
 * Route: GET /api/purchases/:id/pdf
 */
export const getPurchaseInvoicePDFResponse = async (req, res) => {
  const { id } = req.params;

  try {
    const purchase = await Purchase.findById(id).populate('customer').populate('purchasedBy', 'name').populate('device');
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase transaction not found' });
    }

    const settings = await Settings.findOne({}) || { shopName: 'Cell Xchange' };
    const pdfBuffer = await generatePurchaseInvoicePDF(purchase, settings);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=PurchaseVoucher_${purchase.purchaseNumber}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
