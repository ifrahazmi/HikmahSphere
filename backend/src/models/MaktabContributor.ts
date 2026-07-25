import mongoose, { Document, Schema } from 'mongoose';

export interface IMaktabContributor extends Document {
  name: string;
  type: 'Individual' | 'Organization' | 'Charity';
  contact?: {
    phone?: string;
    email?: string;
    address?: string;
  };
  totalContributed: number;
  contributionCount: number;
  lastContributionDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MaktabContributorSchema = new Schema<IMaktabContributor>({
  name: {
    type: String,
    required: [true, 'Contributor name is required'],
    trim: true,
    maxlength: [200, 'Contributor name cannot exceed 200 characters'],
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
  totalContributed: {
    type: Number,
    default: 0,
    min: 0,
  },
  contributionCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  lastContributionDate: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Index for efficient contributor search
MaktabContributorSchema.index({ name: 1 });

// Static method to find or create contributor
MaktabContributorSchema.statics.findOrCreateContributor = async function(
  name: string,
  type: 'Individual' | 'Organization' | 'Charity' = 'Individual',
  contact?: { phone?: string; email?: string; address?: string }
) {
  const existingContributor = await this.findOne({
    name: { $regex: new RegExp(`^${name}$`, 'i') },
  });

  if (existingContributor) {
    return existingContributor;
  }

  const newContributor = new this({ name, type, contact });
  await newContributor.save();
  return newContributor;
};

// Static method for fuzzy contributor search
// Only returns contributors with at least one active contribution (contributionCount > 0)
// so deleted contributors never reappear in autocomplete suggestions.
MaktabContributorSchema.statics.searchContributors = async function(
  searchTerm: string,
  limit: number = 10
) {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return [];
  }

  const normalizedTerm = searchTerm.trim();
  const regex = new RegExp(normalizedTerm, 'i');

  const contributors = await this.find({
    name: regex,
    contributionCount: { $gt: 0 },
  })
  .sort({ totalContributed: -1, contributionCount: -1 })
  .limit(limit);

  return contributors;
};

export default mongoose.model<IMaktabContributor>('MaktabContributor', MaktabContributorSchema);
