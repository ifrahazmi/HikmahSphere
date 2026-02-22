import mongoose, { Document, Schema } from 'mongoose';

export interface IZakatPayment extends Document {
  userId?: mongoose.Types.ObjectId;
  type: 'collection' | 'spending';
  donorId?: mongoose.Types.ObjectId;
  donorName?: string;
  donorType?: 'Individual' | 'Organization' | 'Charity';
  recipientName?: string;
  recipientType?: 'Individual' | 'Family' | 'Mosque' | 'Madrasa' | 'NGO' | 'Other';
  amount: number;
  currency: string;
  paymentDate: Date;
  paymentMethod: 'Bank Transfer' | 'UPI Transfer' | 'Cash' | 'Cheque' | 'QR Scanner';
  // Payment-specific fields
  transactionRefId?: string; // For general reference
  bankName?: string; // For Bank Transfer
  senderUpiId?: string; // For UPI Transfer
  chequeNumber?: string; // For Cheque
  proofFilePath?: string;
  notes?: string;
  recordedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ZakatPaymentSchema = new Schema<IZakatPayment>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  type: {
    type: String,
    enum: ['collection', 'spending'],
    required: [true, 'Transaction type is required'],
  },
  donorId: {
    type: Schema.Types.ObjectId,
    ref: 'Donor',
  },
  donorName: {
    type: String,
    trim: true,
    maxlength: [200, 'Donor name cannot exceed 200 characters'],
  },
  donorType: {
    type: String,
    enum: ['Individual', 'Organization', 'Charity'],
  },
  recipientName: {
    type: String,
    trim: true,
    maxlength: [200, 'Recipient name cannot exceed 200 characters'],
  },
  recipientType: {
    type: String,
    enum: ['Individual', 'Family', 'Mosque', 'Madrasa', 'NGO', 'Other'],
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0'],
  },
  currency: {
    type: String,
    default: 'INR',
  },
  paymentDate: {
    type: Date,
    required: [true, 'Payment date is required'],
  },
  paymentMethod: {
    type: String,
    enum: ['Bank Transfer', 'UPI Transfer', 'Cash', 'Cheque', 'QR Scanner'],
    required: [true, 'Payment method is required'],
  },
  // Payment-specific fields
  transactionRefId: {
    type: String,
    trim: true,
  },
  bankName: {
    type: String,
    trim: true,
  },
  senderUpiId: {
    type: String,
    trim: true,
  },
  chequeNumber: {
    type: String,
    trim: true,
  },
  proofFilePath: {
    type: String,
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
  },
  recordedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

// Indexes for efficient queries
ZakatPaymentSchema.index({ type: 1, paymentDate: -1 });
ZakatPaymentSchema.index({ donorId: 1 });
ZakatPaymentSchema.index({ transactionRefId: 1, paymentMethod: 1 });

// Pre-save validation
ZakatPaymentSchema.pre('save', function(next) {
  // Validate transaction ref ID format for non-Cash, non-Cheque payments
  if (this.transactionRefId && this.paymentMethod !== 'Cash' && this.paymentMethod !== 'Cheque') {
    if (!/^\d{6}$/.test(this.transactionRefId)) {
      return next(new Error('Transaction Ref ID must be exactly 6 digits'));
    }
  }

  // Validate cheque number if payment method is Cheque
  if (this.paymentMethod === 'Cheque' && !this.chequeNumber) {
    return next(new Error('Cheque Number is required for Cheque payments'));
  }

  // Validate bank name if payment method is Bank Transfer
  if (this.paymentMethod === 'Bank Transfer' && !this.bankName) {
    return next(new Error('Bank Name is required for Bank Transfer payments'));
  }

  // Validate sender UPI ID if payment method is UPI Transfer
  if (this.paymentMethod === 'UPI Transfer' && !this.senderUpiId) {
    return next(new Error('Sender UPI ID is required for UPI Transfer payments'));
  }

  // Validate amount
  if (this.amount <= 0) {
    return next(new Error('Amount must be greater than 0'));
  }

  // Validate payment date is not in the future
  if (this.paymentDate > new Date()) {
    return next(new Error('Payment date cannot be in the future'));
  }

  next();
});

// Static method to check for duplicate ref ID
ZakatPaymentSchema.statics.hasDuplicateRefId = async function(
  refId: string,
  paymentMethod: string,
  excludeId?: string
) {
  const query: any = {
    transactionRefId: refId,
    paymentMethod: paymentMethod,
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existing = await this.findOne(query);
  return !!existing;
};

// Static method to get totals
ZakatPaymentSchema.statics.getTotals = async function() {
  const collections = await this.aggregate([
    { $match: { type: 'collection' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  const spendings = await this.aggregate([
    { $match: { type: 'spending' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  return {
    totalCollected: collections[0]?.total || 0,
    totalSpent: spendings[0]?.total || 0,
    currentBalance: (collections[0]?.total || 0) - (spendings[0]?.total || 0),
  };
};

// Static method to get donor summary with rankings
ZakatPaymentSchema.statics.getDonorSummary = async function() {
  const summary = await this.aggregate([
    { $match: { type: 'collection' } },
    {
      $group: {
        _id: '$donorId',
        donorName: { $first: '$donorName' },
        donorType: { $first: '$donorType' },
        totalContributed: { $sum: '$amount' },
        donationsCount: { $sum: 1 }
      }
    },
    { $sort: { totalContributed: -1 } }
  ]);

  return summary.map((item: any, index: number) => ({
    rank: index + 1,
    donorId: item._id,
    donorName: item.donorName || 'Unknown',
    donorType: item.donorType || 'Individual',
    totalContributed: item.totalContributed,
    donationsCount: item.donationsCount
  }));
};

export default mongoose.model<IZakatPayment>('ZakatPayment', ZakatPaymentSchema);
