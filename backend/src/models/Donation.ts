import mongoose, { Schema, Document } from 'mongoose';

export interface IDonation extends Document {
  // Auto-generated
  donationId: string; // HKS-T-XXXXX format
  donorId: mongoose.Types.ObjectId; // Reference to Donor
  
  // Donation Type & Category
  donationType: 'Zakat_Maal' | 'Zakat_Fitr' | 'Sadaqah' | 'Fidya' | 'Kaffarah' | 'Sadaqah_Jariyah';
  subCategory?: string; // Gold, Silver, Cash, Education, Food, etc.
  
  // Amount & Currency
  totalAmount: number;
  currency: 'INR';
  
  // Payment Mode
  paymentMode: 'Full' | 'Installment';
  numberOfInstallments?: number; // If installment mode
  
  // Status
  status: 'Pledged' | 'Partial' | 'Completed' | 'Cancelled';
  amountPaid?: number; // Paid so far
  pendingAmount?: number; // Remaining
  
  // Nisab Information (for Zakat al-Maal)
  nisabVerified?: boolean;
  nisabAmount?: number; // If calculated
  
  // Zakat Year (Hijri)
  hijriYear?: string;
  
  // Payment Information
  paymentMethod?: string;
  bankTransferType?: 'NEFT' | 'Manual';
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  paymentStatus?: 'Completed' | 'Pending' | 'Failed';
  
  // Allocation
  allocationCategory?: 'General' | 'Education' | 'Food' | 'Medical' | 'Emergency' | 'Orphans' | 'Water' | 'Mosque';
  purpose?: string; // "For orphans in Yemen", etc.
  
  // Recurring
  isRecurring?: boolean;
  recurringFrequency?: 'Monthly' | 'Yearly';
  nextRecurrenceDate?: Date;
  
  // Tax Receipt
  taxReceiptRequired?: boolean;
  tax80GEligible?: boolean;
  tax80GNumber?: string;
  
  // Metadata
  createdByAdmin: string; // Admin email
  notes?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
}

const donationSchema = new Schema<IDonation>(
  {
    // Auto-generated ID
    donationId: {
      type: String,
      unique: true,
      sparse: true,
    },
    donorId: {
      type: Schema.Types.ObjectId,
      ref: 'Donor',
      required: true,
    },
    
    // Donation Type & Category
    donationType: {
      type: String,
      enum: ['Zakat_Maal', 'Zakat_Fitr', 'Sadaqah', 'Fidya', 'Kaffarah', 'Sadaqah_Jariyah'],
      required: true,
    },
    subCategory: String,
    
    // Amount & Currency
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR'],
    },
    
    // Payment Mode
    paymentMode: {
      type: String,
      enum: ['Full', 'Installment'],
      default: 'Full',
    },
    numberOfInstallments: {
      type: Number,
      min: 2,
      max: 12,
    },
    
    // Status
    status: {
      type: String,
      enum: ['Pledged', 'Partial', 'Completed', 'Cancelled'],
      default: 'Pledged',
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    pendingAmount: {
      type: Number,
      default: function(this: IDonation) {
        return this.totalAmount - (this.amountPaid || 0);
      },
    },
    
    // Nisab Information
    nisabVerified: {
      type: Boolean,
      default: false,
    },
    nisabAmount: Number,
    
    // Zakat Year
    hijriYear: String,
    
    // Payment Information
    paymentMethod: String,
    bankTransferType: {
      type: String,
      enum: ['NEFT', 'Manual'],
    },
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    upiId: String,
    paymentStatus: {
      type: String,
      enum: ['Completed', 'Pending', 'Failed'],
    },
    
    // Allocation
    allocationCategory: {
      type: String,
      enum: ['General', 'Education', 'Food', 'Medical', 'Emergency', 'Orphans', 'Water', 'Mosque'],
    },
    purpose: String,
    
    // Recurring
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringFrequency: {
      type: String,
      enum: ['Monthly', 'Yearly'],
    },
    nextRecurrenceDate: Date,
    
    // Tax Receipt
    taxReceiptRequired: {
      type: Boolean,
      default: false,
    },
    tax80GEligible: {
      type: Boolean,
      default: false,
    },
    tax80GNumber: String,
    
    // Metadata
    createdByAdmin: {
      type: String,
      required: true,
    },
    notes: String,
    
    // Timestamps
    cancelledAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
donationSchema.index({ donorId: 1, createdAt: -1 });
donationSchema.index({ donationType: 1 });
donationSchema.index({ status: 1 });
donationSchema.index({ createdAt: -1 });
donationSchema.index({ totalAmount: -1 });
donationSchema.index({ paymentMode: 1 });

// Pre-save hook to generate donation ID
donationSchema.pre<IDonation>('save', async function(next) {
  if (!this.donationId && this.isNew) {
    const count = await mongoose.model('Donation').countDocuments();
    const paddedCount = String(count + 1).padStart(5, '0');
    this.donationId = `HKS-T-${paddedCount}`;
  }
  next();
});

// Pre-save hook to calculate pending amount
donationSchema.pre<IDonation>('save', function(next) {
  this.pendingAmount = this.totalAmount - (this.amountPaid || 0);
  
  // Auto-complete if fully paid
  if (this.pendingAmount === 0 && this.status !== 'Cancelled') {
    this.status = 'Completed';
  }
  
  next();
});

// Virtual for display type
donationSchema.virtual('displayType').get(function(this: IDonation) {
  return this.donationType.replace(/_/g, ' ');
});

export default mongoose.model<IDonation>('Donation', donationSchema);
