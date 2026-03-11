import mongoose, { Document, Schema } from 'mongoose';

type QuranStatus = 'none' | 'read' | 'translation' | 'tafseer';

export interface ISalahTrackerActivity {
  dateKey: string;
  prayed: number;
  qada: number;
  missed: number;
  pending: number;
  prayerScore: number;
  quranScore: number;
  quranStatus: QuranStatus;
  note: string;
  hasAnyActivity: boolean;
}

export interface ISalahTracker extends Document {
  userId: mongoose.Types.ObjectId;
  version: number;
  records: Record<string, unknown>;
  stats: Record<string, unknown>;
  activity: ISalahTrackerActivity[];
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SalahTrackerActivitySchema = new Schema<ISalahTrackerActivity>(
  {
    dateKey: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    prayed: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    qada: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    missed: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    pending: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    prayerScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    quranScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    quranStatus: {
      type: String,
      enum: ['none', 'read', 'translation', 'tafseer'],
      default: 'none',
    },
    note: {
      type: String,
      default: '',
      maxlength: 3000,
    },
    hasAnyActivity: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const SalahTrackerSchema = new Schema<ISalahTracker>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    version: {
      type: Number,
      default: 2,
      min: 1,
      max: 50,
    },
    records: {
      type: Schema.Types.Mixed,
      default: {},
    },
    stats: {
      type: Schema.Types.Mixed,
      default: {},
    },
    activity: {
      type: [SalahTrackerActivitySchema],
      default: [],
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

SalahTrackerSchema.index({ updatedAt: -1 });

export default mongoose.model<ISalahTracker>('SalahTracker', SalahTrackerSchema);
