import Customer from '../models/Customer.js';
import Sale from '../models/Sale.js';
import Purchase from '../models/Purchase.js';
import { uploadFile, deleteFile } from '../config/cloudinary.js';

/**
 * Get all customers (with pagination and search)
 * Route: GET /api/customers
 */
export const getCustomers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';

  try {
    const query = {};

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Customer.countDocuments(query);
    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json({
      customers,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Get customer by ID (with full transaction history)
 * Route: GET /api/customers/:id
 */
export const getCustomerById = async (req, res) => {
  const { id } = req.params;

  try {
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Fetch transactions
    const sales = await Sale.find({ customer: id })
      .populate('items.item')
      .populate('soldBy', 'name')
      .sort({ createdAt: -1 });

    const purchases = await Purchase.find({ customer: id })
      .populate('device')
      .populate('purchasedBy', 'name')
      .sort({ createdAt: -1 });

    return res.json({
      customer,
      history: {
        sales,
        purchases,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Create a new customer
 * Route: POST /api/customers
 */
export const createCustomer = async (req, res) => {
  try {
    const { fullName, phone, alternatePhone, gender, address, aadhaarNumber, panNumber, notes } = req.body;

    const customerExists = await Customer.findOne({ phone });
    if (customerExists) {
      return res.status(400).json({ message: 'Customer already exists with this phone number.' });
    }

    // Process files if uploaded
    let customerPhotoUrl = '';
    let aadhaarFrontUrl = '';
    let aadhaarBackUrl = '';
    let panImageUrl = '';

    if (req.files) {
      if (req.files['customerPhoto']) customerPhotoUrl = await uploadFile(req.files['customerPhoto'][0]);
      if (req.files['aadhaarFront']) aadhaarFrontUrl = await uploadFile(req.files['aadhaarFront'][0]);
      if (req.files['aadhaarBack']) aadhaarBackUrl = await uploadFile(req.files['aadhaarBack'][0]);
      if (req.files['panImage']) panImageUrl = await uploadFile(req.files['panImage'][0]);
    }

    const customer = await Customer.create({
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

    await req.logActivity('CREATE_CUSTOMER', `Created customer: ${customer.fullName} (${customer.phone})`);
    return res.status(201).json(customer);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Update customer
 * Route: PUT /api/customers/:id
 */
export const updateCustomer = async (req, res) => {
  const { id } = req.params;

  try {
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const { fullName, phone, alternatePhone, gender, address, aadhaarNumber, panNumber, notes } = req.body;

    // Check if phone already taken by another customer
    if (phone && phone !== customer.phone) {
      const phoneTaken = await Customer.findOne({ phone });
      if (phoneTaken) {
        return res.status(400).json({ message: 'Another customer is already registered with this phone number.' });
      }
    }

    // Update fields
    customer.fullName = fullName || customer.fullName;
    customer.phone = phone || customer.phone;
    customer.alternatePhone = alternatePhone !== undefined ? alternatePhone : customer.alternatePhone;
    customer.gender = gender !== undefined ? gender : customer.gender;
    customer.address = address !== undefined ? address : customer.address;
    customer.aadhaarNumber = aadhaarNumber !== undefined ? aadhaarNumber : customer.aadhaarNumber;
    customer.panNumber = panNumber !== undefined ? panNumber : customer.panNumber;
    customer.notes = notes !== undefined ? notes : customer.notes;

    // Handle uploaded file changes (replace old if new ones provided)
    if (req.files) {
      if (req.files['customerPhoto']) {
        if (customer.customerPhoto) await deleteFile(customer.customerPhoto);
        customer.customerPhoto = await uploadFile(req.files['customerPhoto'][0]);
      }
      if (req.files['aadhaarFront']) {
        if (customer.aadhaarFront) await deleteFile(customer.aadhaarFront);
        customer.aadhaarFront = await uploadFile(req.files['aadhaarFront'][0]);
      }
      if (req.files['aadhaarBack']) {
        if (customer.aadhaarBack) await deleteFile(customer.aadhaarBack);
        customer.aadhaarBack = await uploadFile(req.files['aadhaarBack'][0]);
      }
      if (req.files['panImage']) {
        if (customer.panImage) await deleteFile(customer.panImage);
        customer.panImage = await uploadFile(req.files['panImage'][0]);
      }
    }

    await customer.save();
    await req.logActivity('UPDATE_CUSTOMER', `Updated customer: ${customer.fullName} (${customer.phone})`);
    
    return res.json(customer);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Delete customer (Admin / Manager only)
 * Route: DELETE /api/customers/:id
 */
export const deleteCustomer = async (req, res) => {
  const { id } = req.params;

  try {
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Verify customer has no sales/purchase records to prevent database orphan records
    const salesCount = await Sale.countDocuments({ customer: id });
    const purchasesCount = await Purchase.countDocuments({ customer: id });

    if (salesCount > 0 || purchasesCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete customer because they have purchase or sales transaction history. Deactivate or edit instead.',
      });
    }

    // Clean up uploaded image attachments from storage
    if (customer.customerPhoto) await deleteFile(customer.customerPhoto);
    if (customer.aadhaarFront) await deleteFile(customer.aadhaarFront);
    if (customer.aadhaarBack) await deleteFile(customer.aadhaarBack);
    if (customer.panImage) await deleteFile(customer.panImage);

    await Customer.findByIdAndDelete(id);

    await req.logActivity('DELETE_CUSTOMER', `Deleted customer: ${customer.fullName} (${customer.phone})`);
    return res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
