import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    alternatePhone: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', ''],
      default: '',
    },
    address: {
      type: String,
      trim: true,
    },
    aadhaarNumber: {
      type: String,
      trim: true,
    },
    panNumber: {
      type: String,
      trim: true,
    },
    customerPhoto: {
      type: String, // R2 / Local image path
      default: '',
    },
    aadhaarFront: {
      type: String, // R2 / Local image path
      default: '',
    },
    aadhaarBack: {
      type: String, // R2 / Local image path
      default: '',
    },
    panImage: {
      type: String, // R2 / Local image path
      default: '',
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;
