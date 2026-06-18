import Settings from '../models/Settings.js';
import { uploadFile, deleteFile } from '../config/cloudinary.js';

/**
 * Get shop configurations
 * Route: GET /api/settings
 */
export const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({});
    if (!settings) {
      settings = await Settings.create({});
    }
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Update shop settings
 * Route: PUT /api/settings
 */
export const updateSettings = async (req, res) => {
  const { shopName, gstNumber, address, phone, email, invoicePrefix, purchasePrefix, theme } = req.body;

  try {
    let settings = await Settings.findOne({});
    if (!settings) {
      settings = await Settings.create({});
    }

    // Process logo if uploaded
    if (req.file) {
      if (settings.logoUrl) {
        await deleteFile(settings.logoUrl);
      }
      settings.logoUrl = await uploadFile(req.file);
    }

    settings.shopName = shopName || settings.shopName;
    settings.gstNumber = gstNumber !== undefined ? gstNumber : settings.gstNumber;
    settings.address = address || settings.address;
    settings.phone = phone || settings.phone;
    settings.email = email || settings.email;
    settings.invoicePrefix = invoicePrefix || settings.invoicePrefix;
    settings.purchasePrefix = purchasePrefix || settings.purchasePrefix;
    settings.theme = theme || settings.theme;

    await settings.save();

    await req.logActivity('UPDATE_SETTINGS', `Updated global shop settings for: ${settings.shopName}`);

    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
