import mongoose, { Schema, Document } from 'mongoose';

export interface IDonor extends Document {
  // Auto-generated
  donorId: string; // HKS-D-XXXXX format
  
  // Basic Information
  fullName: string;
  donorType: 'Individual' | 'Organization' | 'Anonymous';
  phone: string; // Unique, OTP verified
  email?: string; // Unique, optional but recommended
  address: string;
  
  // Verification
  idProofType?: 'Aadhaar' | 'PAN' | 'Passport'; // Required if > ₹50,000
  idProofNumber?: string; // Encrypted
  
  // Account
  passwordHash?: string; // For donor portal
  status: 'Active' | 'Disabled' | 'Deleted';
  
  // Statistics
  totalDonations: number; // Count of donations
  totalAmount: number; // Lifetime donated amount
  
  // Preferences
  preferredCategory?: 'Zakat' | 'Sadaqah' | 'General' | 'Education' | 'Food' | 'Medical' | 'Emergency';
  communicationPref: ('SMS' | 'Email' | 'WhatsApp')[];
  
  // Timestamps
  registeredDate: Date; // First payment date
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // For soft deletes
  
  // Metadata
  createdByAdmin?: string; // Admin email who created
  notes?: string;
  
  // Portal Access
  isPortalUser?: boolean;
  lastLoginAt?: Date;
  twoFactorEnabled?: boolean;
}

const donorSchema = new Schema<IDonor>(
  {
    // Auto-generated ID
    donorId: {
      type: String,
      unique: true,
      index: true,
      sparse: true,
    },
    
    // Basic Information
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    donorType: {
      type: String,
      enum: ['Individual', 'Organization', 'Anonymous'],
      required: true,
      default: 'Individual',
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      validate: {
        validator: function(v) {
          return /^\+?[\d\s\-()]{10,}$/.test(v);
        },
        message: 'Invalid phone number format',
      },
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Invalid email address',
      },
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    
    // Verification
    idProofType: {
      type: String,
      enum: ['Aadhaar', 'PAN', 'Passport'],
    },
    idProofNumber: {
      type: String,
      sparse: true,
      // Note: Implement encryption at application level
    },
    
    // Account
    passwordHash: {
      type: String,
      // Optional - only if donor creates portal account
    },
    status: {
      type: String,
      enum: ['Active', 'Disabled', 'Deleted'],
      default: 'Active',
      index: true,
    },
    
    // Statistics
    totalDonations: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Preferences
    preferredCategory: {
      type: String,
      enum: ['Zakat', 'Sadaqah', 'General', 'Education', 'Food', 'Medical', 'Emergency'],
    },
    communicationPref: {
      type: [String],
      enum: ['SMS', 'Email', 'WhatsApp'],
      default: ['SMS', 'Email'],
    },
    
    // Timestamps
    registeredDate: {
      type: Date,
      default: Date.now,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    
    // Metadata
    createdByAdmin: String,
    notes: String,
    
    // Portal Access
    isPortalUser: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: Date,
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
donorSchema.index({ phone: 1, status: 1 });
donorSchema.index({ fullName: 'text' });
donorSchema.index({ donorType: 1 });
donorSchema.index({ totalAmount: -1 }); // For top donors
donorSchema.index({ registeredDate: -1 });
donorSchema.index({ status: 1, deletedAt: 1 }); // For soft deletes

// Pre-save hook to generate donor ID
donorSchema.pre<IDonor>('save', async function(next) {
  if (!this.donorId && this.isNew) {
    const count = await mongoose.model('Donor').countDocuments();
    const paddedCount = String(count + 1).padStart(5, '0');
    this.donorId = `HKS-D-${paddedCount}`;
  }
  next();
});

// Virtual for active status check
donorSchema.virtual('isActive').get(function(this: IDonor) {
  return this.status === 'Active';
});

// Virtual for display name (handles anonymous)
donorSchema.virtual('displayName').get(function(this: IDonor) {
  if (this.donorType === 'Anonymous') {
    return 'Anonymous Donor';
  }
  return this.fullName;
});

export default mongoose.model<IDonor>('Donor', donorSchema);
