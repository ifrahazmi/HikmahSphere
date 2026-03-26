import mongoose, { Document, Schema, Model } from 'mongoose';

export type HijriAdjustmentValue = -1 | 0;

export interface IHijriAdjustment extends Document {
  key: 'global';
  adjustment: HijriAdjustmentValue;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const HijriAdjustmentSchema = new Schema<IHijriAdjustment>(
  {
    key: {
      type: String,
      enum: ['global'],
      required: true,
      default: 'global',
    },
    adjustment: {
      type: Number,
      required: true,
      enum: [-1, 0],
      default: -1,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

HijriAdjustmentSchema.index({ key: 1 }, { unique: true });

const HijriAdjustmentModel: Model<IHijriAdjustment> = mongoose.models.HijriAdjustment
  ? (mongoose.models.HijriAdjustment as Model<IHijriAdjustment>)
  : mongoose.model<IHijriAdjustment>('HijriAdjustment', HijriAdjustmentSchema);

export default HijriAdjustmentModel;
