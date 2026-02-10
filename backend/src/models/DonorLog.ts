import mongoose, { Schema, Document } from 'mongoose';

export interface IDonorLog extends Document {
  // Auto-generated
  logId: string; // HKS-L-XXXXX format
  
  // Admin Information
  adminEmail: string;
  adminId?: mongoose.Types.ObjectId;
  
  // Action Details
  action: 'DONOR_CREATED' | 'DONOR_UPDATED' | 'DONOR_DISABLED' | 'DONOR_DELETED' | 'DONOR_RESTORED' | 'DONOR_VERIFICATION_UPDATED' | 'DONOR_TwoFA_ENABLED' | 'DONOR_TwoFA_DISABLED' | 'DONATION_CREATED' | 'DONATION_CANCELLED' | 'DONATION_COMPLETED' | 'INSTALLMENT_CREATED' | 'INSTALLMENT_CANCELLED' | 'INSTALLMENT_MARKED_PAID';
  
  // Target Information
  targetType: 'Donor' | 'Donation' | 'Installment';
  targetId: mongoose.Types.ObjectId;
  
  // Record Details (JSON for flexibility)
  details: {
    oldData?: Record<string, any>;
    newData?: Record<string, any>;
    reason?: string;
    [key: string]: any;
  };
  
  // Network Information
  ipAddress: string;
  userAgent?: string;
  
  // Timestamps
  createdAt: Date;
}

const donorLogSchema = new Schema<IDonorLog>(
  {
    // Auto-generated ID
    logId: {
      type: String,
      unique: true,
      index: true,
      sparse: true,
    },
    
    // Admin Information
    adminEmail: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    
    // Action Details
    action: {
      type: String,
      enum: [
        'DONOR_CREATED',
        'DONOR_UPDATED',
        'DONOR_DISABLED',
        'DONOR_DELETED',
        'DONOR_RESTORED',
        'DONOR_VERIFICATION_UPDATED',
        'DONOR_TwoFA_ENABLED',
        'DONOR_TwoFA_DISABLED',
        'DONATION_CREATED',
        'DONATION_CANCELLED',
        'DONATION_COMPLETED',
        'INSTALLMENT_CREATED',
        'INSTALLMENT_CANCELLED',
        'INSTALLMENT_MARKED_PAID',
      ],
      required: true,
      index: true,
    },
    
    // Target Information
    targetType: {
      type: String,
      enum: ['Donor', 'Donation', 'Installment'],
      required: true,
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    
    // Record Details (JSON for flexibility)
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    
    // Network Information
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes for audit queries
donorLogSchema.index({ createdAt: -1 }); // Recent logs first
donorLogSchema.index({ adminEmail: 1, createdAt: -1 }); // Admin activity timeline
donorLogSchema.index({ targetId: 1, createdAt: -1 }); // Object history
donorLogSchema.index({ action: 1, createdAt: -1 }); // Action-based reports
donorLogSchema.index({ targetType: 1, action: 1, createdAt: -1 }); // Complex queries
donorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // TTL: 90 days for logs (optional)

// Pre-save hook to generate log ID
donorLogSchema.pre<IDonorLog>('save', async function(next) {
  if (!this.logId && this.isNew) {
    const count = await mongoose.model('DonorLog').countDocuments();
    const paddedCount = String(count + 1).padStart(5, '0');
    this.logId = `HKS-L-${paddedCount}`;
  }
  next();
});

// Static method to create audit log
donorLogSchema.statics.createLog = async function(
  adminEmail: string,
  action: string,
  targetType: string,
  targetId: mongoose.Types.ObjectId,
  details: Record<string, any>,
  ipAddress: string,
  userAgent?: string
) {
  try {
    const newLog = new this({
      adminEmail,
      action,
      targetType,
      targetId,
      details,
      ipAddress,
      userAgent,
    });
    await newLog.save();
    return newLog;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error as this is non-critical
  }
};

// Static method to get audit trail for an object
donorLogSchema.statics.getAuditTrail = async function(
  targetId: mongoose.Types.ObjectId,
  limit = 50
) {
  return this.find({ targetId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method for compliance reports
donorLogSchema.statics.getAdminActivityReport = async function(
  adminEmail: string,
  startDate?: Date,
  endDate?: Date
) {
  const query: Record<string, any> = { adminEmail };
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = startDate;
    if (endDate) query.createdAt.$lte = endDate;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .lean();
};

// Prevent updates to logs (immutable)
donorLogSchema.pre<IDonorLog>('findOneAndUpdate', function(next) {
  throw new Error('Audit logs are immutable and cannot be modified');
});

donorLogSchema.pre<IDonorLog>('updateOne', function(next) {
  throw new Error('Audit logs are immutable and cannot be modified');
});

export default mongoose.model<IDonorLog>('DonorLog', donorLogSchema);
