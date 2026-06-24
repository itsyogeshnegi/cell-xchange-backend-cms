import Product from '../models/Product.js';
import Settings from '../models/Settings.js';
import Inventory from '../models/Inventory.js';
import { uploadFile, deleteFile } from '../config/cloudinary.js';

// Helper to map backend Inventory item to frontend CMS product schema
const mapInventoryToCmsProduct = (item) => ({
  _id: item._id,
  title: `${item.brand} ${item.model}`,
  category: item.productType,
  brand: item.brand,
  model: item.model,
  price: item.sellingPrice,
  ram: item.ram,
  storage: item.storage,
  condition: item.condition,
  images: item.images,
  isFeatured: true, // Display available stock items as featured on the public website
  isPublished: item.showOnWebsite !== false,
  createdAt: item.createdAt,
});

/**
 * Get published products for the public catalog website
 * Route: GET /api/cms/public/products
 */
export const getPublicProducts = async (req, res) => {
  const { category, brand, condition, maxPrice, search } = req.query;

  try {
    const query = { showOnWebsite: { $ne: false }, deviceStatus: 'Available' };

    if (category) query.productType = category;
    if (brand) query.brand = brand;
    if (condition) query.condition = condition;
    if (maxPrice) query.sellingPrice = { $lte: parseFloat(maxPrice) };
    if (search) {
      query.$or = [
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
      ];
    }

    const items = await Inventory.find(query).sort({ createdAt: -1 });
    const products = items.map(mapInventoryToCmsProduct);
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Get a single published product details for public website
 * Route: GET /api/cms/public/products/:id
 */
export const getPublicProductById = async (req, res) => {
  const { id } = req.params;

  try {
    const item = await Inventory.findOne({ _id: id, showOnWebsite: { $ne: false }, deviceStatus: 'Available' });
    if (!item) {
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.json(mapInventoryToCmsProduct(item));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Get all CMS products (both published and unpublished)
 * Route: GET /api/cms/products
 */
export const getProducts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';

  try {
    const query = {};
    if (search) {
      query.$or = [
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Inventory.countDocuments(query);
    const items = await Inventory.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const products = items.map(mapInventoryToCmsProduct);

    return res.json({
      products,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Create a new CMS Product
 * Route: POST /api/cms/products
 */
export const createProduct = async (req, res) => {
  const { title, category, brand, model, price, ram, storage, condition, batteryHealth, description, isFeatured, isPublished } = req.body;

  try {
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const url = await uploadFile(file);
        imageUrls.push(url);
      }
    }

    const product = await Product.create({
      title,
      category,
      brand,
      model,
      price: Number(price) || 0,
      ram,
      storage,
      condition,
      batteryHealth: batteryHealth ? Number(batteryHealth) : undefined,
      description,
      images: imageUrls,
      isFeatured: isFeatured === 'true' || isFeatured === true,
      isPublished: isPublished === 'true' || isPublished === true,
    });

    await req.logActivity('CREATE_CMS_PRODUCT', `Created CMS product: ${product.title}`);
    return res.status(201).json(product);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Update CMS Product
 * Route: PUT /api/cms/products/:id
 */
export const updateProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const { title, category, brand, model, price, ram, storage, condition, batteryHealth, description, isFeatured, isPublished, existingImages } = req.body;

    // Handle image file uploads
    let updatedImages = product.images;
    if (existingImages) {
      // Parse existing images remaining
      updatedImages = Array.isArray(existingImages) ? existingImages : [existingImages];
    } else {
      updatedImages = []; // all removed
    }

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const url = await uploadFile(file);
        updatedImages.push(url);
      }
    }

    product.title = title || product.title;
    product.category = category || product.category;
    product.brand = brand || product.brand;
    product.model = model || product.model;
    product.price = price !== undefined ? Number(price) : product.price;
    product.ram = ram !== undefined ? ram : product.ram;
    product.storage = storage !== undefined ? storage : product.storage;
    product.condition = condition || product.condition;
    product.batteryHealth = batteryHealth !== undefined ? Number(batteryHealth) : product.batteryHealth;
    product.description = description !== undefined ? description : product.description;
    product.images = updatedImages;
    if (isFeatured !== undefined) product.isFeatured = isFeatured === 'true' || isFeatured === true;
    if (isPublished !== undefined) product.isPublished = isPublished === 'true' || isPublished === true;

    await product.save();
    await req.logActivity('UPDATE_CMS_PRODUCT', `Updated CMS product: ${product.title}`);
    
    return res.json(product);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Delete CMS Product
 * Route: DELETE /api/cms/products/:id
 */
export const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Clean up images from storage
    if (product.images && product.images.length > 0) {
      for (const url of product.images) {
        await deleteFile(url);
      }
    }

    await Product.findByIdAndDelete(id);
    await req.logActivity('DELETE_CMS_PRODUCT', `Deleted CMS product: ${product.title}`);

    return res.json({ message: 'Product deleted from CMS successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Get all homepage CMS configuration texts
 * Route: GET /api/cms/homepage
 */
export const getWebCMS = async (req, res) => {
  try {
    const settings = await Settings.findOne({});
    return res.json({
      shopName: settings.shopName,
      logoUrl: settings.logoUrl,
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
      heroTitle: settings.heroTitle,
      heroSubtitle: settings.heroSubtitle,
      aboutUs: settings.aboutUs,
      faqs: settings.faqs || [],
      testimonials: settings.testimonials || [],
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Update homepage CMS content
 * Route: PUT /api/cms/homepage
 */
export const updateWebCMS = async (req, res) => {
  const { heroTitle, heroSubtitle, aboutUs, faqs, testimonials } = req.body;

  try {
    const settings = await Settings.findOne({});
    if (!settings) {
      return res.status(404).json({ message: 'Store settings not found' });
    }

    settings.heroTitle = heroTitle !== undefined ? heroTitle : settings.heroTitle;
    settings.heroSubtitle = heroSubtitle !== undefined ? heroSubtitle : settings.heroSubtitle;
    settings.aboutUs = aboutUs !== undefined ? aboutUs : settings.aboutUs;
    settings.faqs = faqs !== undefined ? (typeof faqs === 'string' ? JSON.parse(faqs) : faqs) : settings.faqs;
    settings.testimonials = testimonials !== undefined ? (typeof testimonials === 'string' ? JSON.parse(testimonials) : testimonials) : settings.testimonials;

    await settings.save();
    await req.logActivity('UPDATE_CMS_HOMEPAGE', 'Updated public homepage copywriting structure');
    
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Toggle visibility of inventory stock item on CMS website
 * Route: PUT /api/cms/products/:id/toggle
 */
export const toggleProductVisibility = async (req, res) => {
  const { id } = req.params;
  const { isPublished } = req.body;

  try {
    const item = await Inventory.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Inventory stock item not found' });
    }

    item.showOnWebsite = isPublished === true || isPublished === 'true';
    await item.save();

    await req.logActivity('TOGGLE_CMS_PRODUCT_VISIBILITY', `Toggled CMS visibility of ${item.brand} ${item.model} to ${item.showOnWebsite}`);

    return res.json({ message: 'Product visibility updated successfully', isPublished: item.showOnWebsite });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
