import Sale from '../models/Sale.js';
import Inventory from '../models/Inventory.js';
import Settings from '../models/Settings.js';
import Notification from '../models/Notification.js';
import Customer from '../models/Customer.js';
import { generateSaleInvoicePDF, generateThermalReceiptPDF } from '../utils/pdfGenerator.js';

/**
 * Get all sales transactions (paginated)
 * Route: GET /api/sales
 */
export const getSales = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const total = await Sale.countDocuments({});
    const sales = await Sale.find({})
      .populate('customer', 'fullName phone')
      .populate('soldBy', 'name')
      .populate('items.item', 'brand model storage color imei1')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json({
      sales,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Get sale transaction by ID
 * Route: GET /api/sales/:id
 */
export const getSaleById = async (req, res) => {
  const { id } = req.params;

  try {
    const sale = await Sale.findById(id)
      .populate('customer')
      .populate('soldBy', 'name')
      .populate('items.item');
      
    if (!sale) {
      return res.status(404).json({ message: 'Sales transaction not found' });
    }
    return res.json(sale);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Create a new Sale (Checkout)
 * Route: POST /api/sales
 */
export const createSale = async (req, res) => {
  let { customerId, itemIds, items: frontendItems, paymentMethod, discount } = req.body;

  if (!itemIds && frontendItems) {
    itemIds = frontendItems.map((i) => (typeof i === 'object' && i.item ? i.item : i));
  }
  if (!itemIds) {
    itemIds = [];
  }

  try {
    // 1. Fetch customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // 2. Fetch inventory items and verify availability
    const items = await Inventory.find({ _id: { $in: itemIds } });
    if (items.length !== itemIds.length) {
      return res.status(400).json({ message: 'Some devices in the cart do not exist.' });
    }

    const unavailableItems = items.filter((item) => item.deviceStatus !== 'Available');
    if (unavailableItems.length > 0) {
      const names = unavailableItems.map((item) => `${item.brand} ${item.model}`).join(', ');
      return res.status(400).json({ message: `The following devices are unavailable: ${names}` });
    }

    // 3. Fetch settings for invoice numbers and store rules
    const settings = await Settings.findOne({}) || { invoicePrefix: 'CX-INV-' };

    // 4. Calculate invoice number sequentially
    const lastSale = await Sale.findOne({ invoiceNumber: new RegExp('^' + settings.invoicePrefix) }).sort({ createdAt: -1 });
    let nextNum = 1;
    if (lastSale) {
      const match = lastSale.invoiceNumber.replace(settings.invoicePrefix, '');
      const lastVal = parseInt(match, 10);
      if (!isNaN(lastVal)) {
        nextNum = lastVal + 1;
      }
    }
    const invoiceNumber = `${settings.invoicePrefix}${String(nextNum).padStart(5, '0')}`;

    // 5. Calculate finances (GST defaults to 18%)
    let subTotal = 0;
    const saleItems = items.map((item) => {
      subTotal += item.sellingPrice;
      return {
        item: item._id,
        price: item.sellingPrice,
      };
    });

    const discVal = Number(discount) || 0;
    // GST included in price:
    const baseValue = (subTotal - discVal) / 1.18;
    const gstAmount = (subTotal - discVal) - baseValue;
    const totalAmount = subTotal - discVal;

    // 6. Create Sale
    const sale = await Sale.create({
      invoiceNumber,
      customer: customerId,
      items: saleItems,
      paymentMethod,
      subTotal,
      gstAmount: Math.round(gstAmount * 100) / 100,
      discount: discVal,
      totalAmount,
      soldBy: req.user._id,
    });

    // 7. Update Inventory status to Sold
    await Inventory.updateMany(
      { _id: { $in: itemIds } },
      { $set: { deviceStatus: 'Sold' } }
    );

    // 8. Create dashboard alerts & notification
    const deviceNames = items.map((item) => `${item.brand} ${item.model}`).join(', ');
    await Notification.create({
      type: 'new_sale',
      message: `New sale completed: ${invoiceNumber} | Devices: ${deviceNames} | Value: ₹${totalAmount.toLocaleString()}`,
    });

    await req.logActivity(
      'CREATE_SALE',
      `Checked out invoice: ${invoiceNumber} for Customer: ${customer.fullName}. Total: ₹${totalAmount}`
    );

    return res.status(201).json(sale);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Generate A4 GST Invoice PDF stream on the fly
 * Route: GET /api/sales/:id/pdf
 */
export const getSaleInvoicePDFResponse = async (req, res) => {
  const { id } = req.params;

  try {
    const sale = await Sale.findById(id).populate('customer').populate('soldBy', 'name').populate('items.item');
    if (!sale) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const settings = await Settings.findOne({}) || { shopName: 'Cell Xchange' };
    const pdfBuffer = await generateSaleInvoicePDF(sale, settings);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Invoice_${sale.invoiceNumber}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Generate 80mm Thermal Receipt PDF stream on the fly
 * Route: GET /api/sales/:id/thermal
 */
export const getSaleThermalPDFResponse = async (req, res) => {
  const { id } = req.params;

  try {
    const sale = await Sale.findById(id).populate('customer').populate('soldBy', 'name').populate('items.item');
    if (!sale) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const settings = await Settings.findOne({}) || { shopName: 'Cell Xchange' };
    const pdfBuffer = await generateThermalReceiptPDF(sale, settings);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Thermal_Receipt_${sale.invoiceNumber}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
