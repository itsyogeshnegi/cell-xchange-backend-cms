import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
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
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    ram: {
      type: String,
      trim: true,
    },
    storage: {
      type: String,
      trim: true,
    },
    condition: {
      type: String,
      enum: ['Excellent', 'Good', 'Fair', 'Needs Repair'],
      default: 'Good',
    },
    batteryHealth: {
      type: Number,
      min: 0,
      max: 100,
    },
    images: {
      type: [String],
      default: [],
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model('Product', productSchema);
export default Product;
