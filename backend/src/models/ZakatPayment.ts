import mongoose from 'mongoose';

const zakatPaymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Type of transaction: 'Credit' (Collection) or 'Debit' (Distribution)
  type: {
    type: String,
    enum: ['Credit', 'Debit'], 
    default: 'Credit',
    required: true
  },
  // Donor Info (For Credit)
  donorType: {
    type: String,
    enum: ['Individual', 'Organization', 'Charity', 'Other'],
    default: 'Individual'
  },
  donorName: {
    type: String,
    // Required if type is Credit
  },
  
  // Recipient Info (For Debit/Spending)
  recipientName: {
    type: String,
    // Required if type is Debit
  },
  recipientType: {
    type: String,
    enum: ['Individual', 'Family', 'Mosque', 'Madrasa', 'NGO', 'Other'],
  },

  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  paymentDate: {
    type: Date,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ['Bank Transfer', 'Credit Card', 'Cash', 'UPI Transfer', 'QR Scanner', 'Cheque', 'Other'],
    required: true,
  },
  proofOfPayment: {
    type: String, // URL or file path for screenshot
  },
  paymentId: {
    type: String, // Transaction ID
    required: true, 
  },
  upiId: {
    type: String, // Optional UPI ID
  },
  status: {
    type: String,
    enum: ['Pending', 'Verified', 'Rejected'],
    default: 'Verified', // Default verified for admin entry
  },
  notes: {
    type: String, // Purpose of spending or notes for collection
  },
}, { timestamps: true });

export default mongoose.model('ZakatPayment', zakatPaymentSchema);
