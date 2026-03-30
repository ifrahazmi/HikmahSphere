import mongoose, { Document, Model, Schema } from 'mongoose';

export type PrayerTimeOffsetKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'imsak';
export type ImsakMode = 'tied-to-fajr';

export interface PrayerTimeOffsets {
  fajr: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
  imsak: number;
}

export interface IPrayerTimeTuning extends Document {
  key: 'global';
  offsets: PrayerTimeOffsets;
  imsakMode: ImsakMode;
  applyToFasting: boolean;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_PRAYER_TIME_OFFSETS: PrayerTimeOffsets = {
  fajr: 0,
  dhuhr: 0,
  asr: 0,
  maghrib: 0,
  isha: 0,
  imsak: 0,
};

const PrayerTimeTuningSchema = new Schema<IPrayerTimeTuning>(
  {
    key: {
      type: String,
      enum: ['global'],
      required: true,
      default: 'global',
    },
    offsets: {
      fajr: { type: Number, min: -5, max: 5, default: DEFAULT_PRAYER_TIME_OFFSETS.fajr },
      dhuhr: { type: Number, min: -5, max: 5, default: DEFAULT_PRAYER_TIME_OFFSETS.dhuhr },
      asr: { type: Number, min: -5, max: 5, default: DEFAULT_PRAYER_TIME_OFFSETS.asr },
      maghrib: { type: Number, min: -5, max: 5, default: DEFAULT_PRAYER_TIME_OFFSETS.maghrib },
      isha: { type: Number, min: -5, max: 5, default: DEFAULT_PRAYER_TIME_OFFSETS.isha },
      imsak: { type: Number, min: -5, max: 5, default: DEFAULT_PRAYER_TIME_OFFSETS.imsak },
    },
    imsakMode: {
      type: String,
      enum: ['tied-to-fajr'],
      required: true,
      default: 'tied-to-fajr',
    },
    applyToFasting: {
      type: Boolean,
      required: true,
      default: true,
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

PrayerTimeTuningSchema.index({ key: 1 }, { unique: true });

const PrayerTimeTuningModel: Model<IPrayerTimeTuning> = mongoose.models.PrayerTimeTuning
  ? (mongoose.models.PrayerTimeTuning as Model<IPrayerTimeTuning>)
  : mongoose.model<IPrayerTimeTuning>('PrayerTimeTuning', PrayerTimeTuningSchema);

export default PrayerTimeTuningModel;
