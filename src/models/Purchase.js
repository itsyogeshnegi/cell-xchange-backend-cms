import mongoose from 'mongoose';

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['Cash', 'UPI', 'Bank Transfer'],
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    purchasedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    purchaseInvoiceUrl: {
      type: String,
      default: '',
    },
    purchaseReceiptUrl: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const Purchase = mongoose.model('Purchase', purchaseSchema);
export default Purchase;
