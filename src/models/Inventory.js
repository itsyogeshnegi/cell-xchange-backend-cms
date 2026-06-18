import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema(
  {
    productType: {
      type: String,
      required: true,
      enum: ['mobile', 'laptop', 'tablet', 'accessory'],
    },
    brand: {
      type: String,
      required: true,
      trim: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      trim: true,
    },
    ram: {
      type: String,
      trim: true, // e.g. "8 GB", "16 GB"
    },
    storage: {
      type: String,
      trim: true, // e.g. "128 GB", "256 GB"
    },
    processor: {
      type: String,
      trim: true, // e.g. "M1", "Intel i7"
    },
    batteryHealth: {
      type: Number, // percentage, e.g. 88
      min: 0,
      max: 100,
    },
    imei1: {
      type: String,
      trim: true,
    },
    imei2: {
      type: String,
      trim: true,
    },
    serialNumber: {
      type: String,
      trim: true,
    },
    condition: {
      type: String,
      required: true,
      enum: ['Excellent', 'Good', 'Fair', 'Needs Repair'],
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    warrantyStatus: {
      type: String,
      trim: true, // e.g. "3 Months Shop Warranty", "Out of Warranty"
    },
    accessoriesIncluded: {
      type: [String], // e.g. ["Box", "Charger", "Cable"]
      default: [],
    },
    images: {
      type: [String], // Array of image URLs
      default: [],
    },
    deviceStatus: {
      type: String,
      enum: ['Available', 'Reserved', 'Sold', 'Returned', 'Repair'],
      default: 'Available',
    },
    barcodeUrl: {
      type: String,
      default: '',
    },
    qrCodeUrl: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Indexing for quick search
inventorySchema.index({ brand: 'text', model: 'text', imei1: 'text', serialNumber: 'text' });

const Inventory = mongoose.model('Inventory', inventorySchema);
export default Inventory;
