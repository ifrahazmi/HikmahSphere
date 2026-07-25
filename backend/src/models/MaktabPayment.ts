import mongoose, { Document, Schema } from 'mongoose';

export type MaktabSpendingCategory =
  | 'Teacher Salary'
  | 'Books/Stationery'
  | 'Uniform'
  | 'Rent'
  | 'Utilities'
  | 'Other';

export interface IMaktabPayment extends Document {
  userId?: mongoose.Types.ObjectId;
  type: 'collection' | 'spending';
  // Collection fields
  contributorId?: mongoose.Types.ObjectId;
  contributorName?: string;
  contributorType?: 'Individual' | 'Organization' | 'Charity';
  contributionFrequency?: 'One-time' | 'Monthly';
  // Spending fields
  recipientName?: string;
  recipientType?: 'Teacher' | 'Student' | 'Supplier' | 'Other';
  category?: MaktabSpendingCategory;
  studentCount?: number;
  // Shared fields
  amount: number;
  currency: string;
  paymentDate: Date;
  paymentMethod: 'Bank Transfer' | 'UPI Transfer' | 'Cash' | 'Cheque' | 'QR Scanner';
  transactionRefId?: string;
  bankName?: string;
  senderUpiId?: string;
  chequeNumber?: string;
  proofFilePath?: string;
  notes?: string;
  recordedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MaktabPaymentSchema = new Schema<IMaktabPayment>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  type: {
    type: String,
    enum: ['collection', 'spending'],
    required: [true, 'Transaction type is required'],
  },
  // Collection fields
  contributorId: {
    type: Schema.Types.ObjectId,
    ref: 'MaktabContributor',
  },
  contributorName: {
    type: String,
    trim: true,
    maxlength: [200, 'Contributor name cannot exceed 200 characters'],
  },
  contributorType: {
    type: String,
    enum: ['Individual', 'Organization', 'Charity'],
  },
  contributionFrequency: {
    type: String,
    enum: ['One-time', 'Monthly'],
    default: 'One-time',
  },
  // Spending fields
  recipientName: {
    type: String,
    trim: true,
    maxlength: [200, 'Recipient name cannot exceed 200 characters'],
  },
  recipientType: {
    type: String,
    enum: ['Teacher', 'Student', 'Supplier', 'Other'],
  },
  category: {
    type: String,
    enum: ['Teacher Salary', 'Books/Stationery', 'Uniform', 'Rent', 'Utilities', 'Other'],
  },
  studentCount: {
    type: Number,
    min: [0, 'Student count cannot be negative'],
  },
  // Shared fields
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
MaktabPaymentSchema.index({ type: 1, paymentDate: -1 });
MaktabPaymentSchema.index({ type: 1, category: 1, paymentDate: -1 });
MaktabPaymentSchema.index({ contributorId: 1 });
MaktabPaymentSchema.index({ transactionRefId: 1, paymentMethod: 1 });

// Pre-save validation
MaktabPaymentSchema.pre('save', function(next) {
  // Validate transaction ref ID format for non-Cash, non-Cheque, non-Bank Transfer payments
  if (this.transactionRefId && this.paymentMethod !== 'Cash' && this.paymentMethod !== 'Cheque' && this.paymentMethod !== 'Bank Transfer') {
    if (!/^\d{6,}$/.test(this.transactionRefId)) {
      return next(new Error('Transaction Ref ID must be at least 6 digits'));
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

  // Validate UPI ID format (number@any)
  if (this.paymentMethod === 'UPI Transfer' && this.senderUpiId) {
    if (!/^\d+@[a-zA-Z]+$/.test(this.senderUpiId)) {
      return next(new Error('UPI ID must be in format: number@bank (e.g., 9876543210@oksbi)'));
    }
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
MaktabPaymentSchema.statics.hasDuplicateRefId = async function(
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

// Static method to get totals (collected / spent / balance)
MaktabPaymentSchema.statics.getTotals = async function() {
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

// Static method to get contributor summary with rankings
MaktabPaymentSchema.statics.getContributorSummary = async function() {
  const summary = await this.aggregate([
    { $match: { type: 'collection' } },
    {
      $group: {
        _id: '$contributorId',
        contributorName: { $first: '$contributorName' },
        contributorType: { $first: '$contributorType' },
        totalContributed: { $sum: '$amount' },
        contributionsCount: { $sum: 1 }
      }
    },
    { $sort: { totalContributed: -1 } }
  ]);

  return summary.map((item: any, index: number) => ({
    rank: index + 1,
    contributorId: item._id,
    contributorName: item.contributorName || 'Unknown',
    contributorType: item.contributorType || 'Individual',
    totalContributed: item.totalContributed,
    contributionsCount: item.contributionsCount
  }));
};

export default mongoose.model<IMaktabPayment>('MaktabPayment', MaktabPaymentSchema);
