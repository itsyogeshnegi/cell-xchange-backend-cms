import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    shopName: {
      type: String,
      default: 'Cell Xchange',
    },
    gstNumber: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      default: '',
    },
    logoUrl: {
      type: String,
      default: '',
    },
    invoicePrefix: {
      type: String,
      default: 'CX-INV-',
    },
    purchasePrefix: {
      type: String,
      default: 'CX-PUR-',
    },
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'dark',
    },
    // Website CMS Sections
    heroTitle: {
      type: String,
      default: 'Buy & sell second-hand phones — fairly priced, fully checked.',
    },
    heroSubtitle: {
      type: String,
      default: 'Cell Xchange offers quality pre-owned smartphones backed by a quick quality check and a friendly return window. Get instant quotes when you sell.',
    },
    aboutUs: {
      type: String,
      default: 'Drop by for a chat, a trade-in, or to pick up your next phone. New Delhi\'s trusted second-hand electronics dealer.',
    },
    faqs: {
      type: [
        {
          question: String,
          answer: String,
        },
      ],
      default: [
        {
          question: 'Are the devices tested?',
          answer: 'Yes, every device goes through a comprehensive 30-point quality check by our expert technicians before listing.',
        },
        {
          question: 'What is the return policy?',
          answer: 'We offer a friendly 30-day return window. If you are not satisfied with the device, you can bring it back for an exchange or refund.',
        },
        {
          question: 'How do I get paid when selling?',
          answer: 'Once you bring the device to our New Delhi store and we run a quick physical validation, we pay you instantly via Cash or UPI.',
        },
      ],
    },
    testimonials: {
      type: [
        {
          name: String,
          text: String,
          rating: Number,
        },
      ],
      default: [
        {
          name: 'Aman Sharma',
          text: 'Bought an iPhone 13 from Cell Xchange. Device is working flawlessly and battery life is great. Highly recommended!',
          rating: 5,
        },
        {
          name: 'Priya Patel',
          text: 'Sold my old OnePlus. Got a fair quote on WhatsApp and was paid in cash in less than 10 minutes at the store.',
          rating: 5,
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
