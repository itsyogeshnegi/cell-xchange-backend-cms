import mongoose from 'mongoose';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import Product from '../models/Product.js';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cell_xchange');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Seed initial data
    await seedInitialData();
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

const seedInitialData = async () => {
  try {
    // 1. Seed Super Admin if not exists
    const superAdminExists = await User.findOne({ email: 'yogeshnegi.dev@gmail.com' });
    if (!superAdminExists) {
      await User.create({
        name: 'Yogesh Negi',
        email: 'yogeshnegi.dev@gmail.com',
        password: 'dev@123', // Will be hashed by userSchema.pre('save')
        role: 'super_admin',
        isActive: true,
      });
      console.log('Seeded Super Admin User: yogeshnegi.dev@gmail.com / dev@123');
    }

    // 2. Seed Admin if no users exist
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      await User.create({
        name: 'Admin User',
        email: 'admin@cellxchange.com',
        password: 'admin123', // Will be hashed by userSchema.pre('save')
        role: 'admin',
        isActive: true,
      });
      console.log('Seeded default Admin User: admin@cellxchange.com / admin123');
    }

    // 2. Seed Default Settings if none exist
    const settingsCount = await Settings.countDocuments();
    if (settingsCount === 0) {
      await Settings.create({
        shopName: 'Cell Xchange',
        gstNumber: '07AAAAA0000A1Z2', // Dummy Delhi GSTIN
        address: 'P-15, Connaught Place, New Delhi, 110001',
        phone: '+919718182727',
        email: 'info@cellxchange.com',
        invoicePrefix: 'CX-INV-',
        purchasePrefix: 'CX-PUR-',
        theme: 'dark',
      });
      console.log('Seeded default Store Settings');
    }

    // 3. Seed Catalog Products if empty
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      const initialProducts = [
        {
          title: 'iPhone 13',
          category: 'mobile',
          brand: 'Apple',
          model: 'iPhone 13',
          price: 42000,
          ram: '4 GB',
          storage: '128 GB',
          condition: 'Excellent',
          batteryHealth: 89,
          description: 'A pre-owned iPhone 13 in excellent condition. 100% functional, checked with a 30-point inspection.',
          images: [],
          isPublished: true,
          isFeatured: true,
        },
        {
          title: 'Galaxy S22',
          category: 'mobile',
          brand: 'Samsung',
          model: 'Galaxy S22',
          price: 34500,
          ram: '8 GB',
          storage: '256 GB',
          condition: 'Excellent',
          batteryHealth: 91,
          description: 'Premium Samsung device, fully verified and ready to ship.',
          images: [],
          isPublished: true,
          isFeatured: true,
        },
        {
          title: 'MacBook Air M1',
          category: 'laptop',
          brand: 'Apple',
          model: 'MacBook Air M1',
          price: 62000,
          ram: '8 GB',
          storage: '256 GB',
          condition: 'Good',
          batteryHealth: 88,
          description: 'Incredibly thin and light Apple M1 powered MacBook Air in perfect working order.',
          images: [],
          isPublished: true,
          isFeatured: true,
        },
        {
          title: 'Dell XPS 13',
          category: 'laptop',
          brand: 'Dell',
          model: 'XPS 13',
          price: 48000,
          ram: '16 GB',
          storage: '512 GB',
          condition: 'Good',
          batteryHealth: 85,
          description: 'Lightweight professional Windows laptop with edge-to-edge screen.',
          images: [],
          isPublished: true,
          isFeatured: true,
        }
      ];
      await Product.insertMany(initialProducts);
      console.log('Seeded initial products for catalog');
    }
  } catch (error) {
    console.error(`Error seeding initial data: ${error.message}`);
  }
};
