import mongoose, { Document, Schema } from 'mongoose';

export interface IIngredientAnalysis {
  name: string;
  status: 'HALAL' | 'HARAM' | 'DOUBTFUL' | 'UNKNOWN';
  eCodes: string[];
  sources: string[];
  note?: string;
}

export interface ISource {
  name: 'OpenFoodFacts' | 'HalalCheck' | 'MCG' | 'UserCommunity';
  url: string;
  verdict: string;
  fetchedAt: Date;
}

export interface IHalalVerification extends Document {
  barcode: string;
  productName: string;
  brands: string[];
  images: string[];
  status: 'HALAL' | 'HARAM' | 'DOUBTFUL' | 'UNKNOWN';
  confidence: number; // 0-100
  ingredients: IIngredientAnalysis[];
  sources: ISource[];
  certifier?: string;
  verifiedAt: Date;
  userReports: Array<{ userId: mongoose.Types.ObjectId; status: string; note: string; createdAt: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

const IngredientAnalysisSchema = new Schema<IIngredientAnalysis>({
  name: { type: String, required: true },
  status: { type: String, enum: ['HALAL', 'HARAM', 'DOUBTFUL', 'UNKNOWN'], required: true },
  eCodes: [String],
  sources: [String],
  note: String,
}, { _id: false });

const SourceSchema = new Schema<ISource>({
  name: { type: String, enum: ['OpenFoodFacts', 'HalalCheck', 'MCG', 'UserCommunity'], required: true },
  url: { type: String, required: true },
  verdict: { type: String, required: true },
  fetchedAt: { type: Date, default: Date.now },
}, { _id: false });

const HalalVerificationSchema = new Schema<IHalalVerification>({
  barcode: { type: String, required: true, unique: true, index: true },
  productName: { type: String, required: true },
  brands: [String],
  images: [String],
  status: { type: String, enum: ['HALAL', 'HARAM', 'DOUBTFUL', 'UNKNOWN'], required: true, index: true },
  confidence: { type: Number, min: 0, max: 100, required: true },
  ingredients: [IngredientAnalysisSchema],
  sources: [SourceSchema],
  certifier: String,
  verifiedAt: { type: Date, default: Date.now },
  userReports: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['HALAL', 'HARAM', 'DOUBTFUL'] },
    note: String,
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

HalalVerificationSchema.index({ productName: 'text', brands: 'text' });

export default mongoose.model<IHalalVerification>('HalalVerification', HalalVerificationSchema);