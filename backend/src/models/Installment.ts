import mongoose, { Schema, Document } from 'mongoose';

export interface IInstallment extends Document {
  // Auto-generated
  installmentId: string; // HKS-I-XXXXX format
  donationId: mongoose.Types.ObjectId; // Reference to Donation
  donorId: mongoose.Types.ObjectId; // Denormalized for quick queries
  
  // Installment Schedule
  installmentNumber: number; // 1, 2, 3, etc.
  totalInstallments: number; // Out of how many
  
  // Amount & Currency
  amount: number;
  currency: 'INR';
  
  // Dates
  dueDate: Date;
  frequency: 'Weekly' | 'Monthly' | 'Custom';
  nextDueDate?: Date; // For recurring
  
  // Status
  status: 'Pending' | 'Paid' | 'Overdue' | 'Cancelled' | 'Defaulted';
  paidDate?: Date;
  
  // Payment Information
  paymentMethod?: string;
  transactionId?: string;
  transactionRef?: string;
  receiptId?: string;
  
  // Reminders
  reminderSent?: boolean;
  reminderSentDate?: Date;
  reminderCount?: number;
  
  // Grace Period
  graceEndDate?: Date;
  gracePeriodDays?: number; // Default: 7 days
  
  // Follow-up
  followUpAttempts?: number;
  lastFollowUpDate?: Date;
  
  // Notes
  notes?: string;
  adminNotes?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
}

const installmentSchema = new Schema<IInstallment>(
  {
    // Auto-generated ID
    installmentId: {
      type: String,
      unique: true,
      sparse: true,
    },
    donationId: {
      type: Schema.Types.ObjectId,
      ref: 'Donation',
      required: true,
    },
    donorId: {
      type: Schema.Types.ObjectId,
      ref: 'Donor',
      required: true,
    },
    
    // Installment Schedule
    installmentNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    totalInstallments: {
      type: Number,
      required: true,
      min: 2,
      max: 12,
    },
    
    // Amount & Currency
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR'],
    },
    
    // Dates
    dueDate: {
      type: Date,
      required: true,
    },
    frequency: {
      type: String,
      enum: ['Weekly', 'Monthly', 'Custom'],
      default: 'Monthly',
    },
    nextDueDate: Date,
    
    // Status
    status: {
      type: String,
      enum: ['Pending', 'Paid', 'Overdue', 'Cancelled', 'Defaulted'],
      default: 'Pending',
    },
    paidDate: Date,
    
    // Payment Information
    paymentMethod: String,
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    transactionRef: String,
    receiptId: {
      type: String,
      unique: true,
      sparse: true,
    },
    
    // Reminders
    reminderSent: {
      type: Boolean,
      default: false,
    },
    reminderSentDate: Date,
    reminderCount: {
      type: Number,
      default: 0,
    },
    
    // Grace Period
    graceEndDate: Date,
    gracePeriodDays: {
      type: Number,
      default: 7,
    },
    
    // Follow-up
    followUpAttempts: {
      type: Number,
      default: 0,
    },
    lastFollowUpDate: Date,
    
    // Notes
    notes: String,
    adminNotes: String,
    
    // Timestamps
    cancelledAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
installmentSchema.index({ donorId: 1, dueDate: 1 });
installmentSchema.index({ dueDate: 1, status: 1 });
installmentSchema.index({ donationId: 1 });
installmentSchema.index({ status: 1 });
installmentSchema.index({ createdAt: -1 });

// Pre-save hook to generate installment ID
installmentSchema.pre<IInstallment>('save', async function(next) {
  if (!this.installmentId && this.isNew) {
    const count = await mongoose.model('Installment').countDocuments();
    const paddedCount = String(count + 1).padStart(5, '0');
    this.installmentId = `HKS-I-${paddedCount}`;
  }
  next();
});

// Pre-save hook to mark as overdue
installmentSchema.pre<IInstallment>('save', function(next) {
  if (
    this.status === 'Pending' &&
    this.dueDate < new Date() &&
    !this.graceEndDate
  ) {
    // Mark as overdue if past due date and no grace period
    if (new Date() > new Date(this.dueDate)) {
      this.status = 'Overdue';
    }
  }
  
  // Set grace period end date if overdue
  if (this.status === 'Overdue' && !this.graceEndDate) {
    const graceEnd = new Date(this.dueDate);
    graceEnd.setDate(graceEnd.getDate() + (this.gracePeriodDays || 7));
    this.graceEndDate = graceEnd;
  }
  
  next();
});

// Virtual for display
installmentSchema.virtual('displayNumber').get(function(this: IInstallment) {
  return `${this.installmentNumber}/${this.totalInstallments}`;
});

// Virtual for is overdue
installmentSchema.virtual('isOverdue').get(function(this: IInstallment) {
  return this.status === 'Overdue' || (this.dueDate < new Date() && this.status === 'Pending');
});

// Virtual for is in grace period
installmentSchema.virtual('isInGracePeriod').get(function(this: IInstallment) {
  if (!this.graceEndDate) return false;
  return new Date() <= this.graceEndDate;
});

export default mongoose.model<IInstallment>('Installment', installmentSchema);
