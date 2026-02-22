import mongoose, { Document, Schema } from 'mongoose';

export interface IDonor extends Document {
  name: string;
  type: 'Individual' | 'Organization' | 'Charity';
  contact?: {
    phone?: string;
    email?: string;
    address?: string;
  };
  totalDonated: number;
  donationCount: number;
  lastDonationDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DonorSchema = new Schema<IDonor>({
  name: {
    type: String,
    required: [true, 'Donor name is required'],
    trim: true,
    maxlength: [200, 'Donor name cannot exceed 200 characters'],
  },
  type: {
    type: String,
    enum: ['Individual', 'Organization', 'Charity'],
    default: 'Individual',
    required: true,
  },
  contact: {
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  totalDonated: {
    type: Number,
    default: 0,
    min: 0,
  },
  donationCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  lastDonationDate: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Index for efficient donor search
DonorSchema.index({ name: 1 });

// Static method to find or create donor
DonorSchema.statics.findOrCreateDonor = async function(
  name: string,
  type: 'Individual' | 'Organization' | 'Charity' = 'Individual',
  contact?: { phone?: string; email?: string; address?: string }
) {
  const existingDonor = await this.findOne({
    name: { $regex: new RegExp(`^${name}$`, 'i') },
  });

  if (existingDonor) {
    return existingDonor;
  }

  const newDonor = new this({ name, type, contact });
  await newDonor.save();
  return newDonor;
};

// Static method for fuzzy donor search
DonorSchema.statics.searchDonors = async function(
  searchTerm: string,
  limit: number = 10
) {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return [];
  }

  const normalizedTerm = searchTerm.trim();
  const regex = new RegExp(normalizedTerm, 'i');
  
  const donors = await this.find({
    name: regex,
  })
  .sort({ totalDonated: -1, donationCount: -1 })
  .limit(limit);

  return donors;
};

export default mongoose.model<IDonor>('Donor', DonorSchema);
