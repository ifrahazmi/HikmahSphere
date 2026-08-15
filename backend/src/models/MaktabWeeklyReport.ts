import mongoose, { Document, Schema } from 'mongoose';
import { MAKTAB_TEACHER_SLUGS } from '../constants/maktabTeachers';

export interface IMaktabWeeklyPhoto {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface IMaktabWeeklyReport extends Document {
  teacher: string;
  isoWeek: string;
  year: number;
  week: number;
  weekStart: Date;
  weekEnd: Date;
  photos: IMaktabWeeklyPhoto[];
  note?: string;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MaktabWeeklyPhotoSchema = new Schema<IMaktabWeeklyPhoto>(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const MaktabWeeklyReportSchema = new Schema<IMaktabWeeklyReport>(
  {
    teacher: {
      type: String,
      required: true,
      enum: MAKTAB_TEACHER_SLUGS,
      index: true,
    },
    isoWeek: {
      type: String,
      required: true,
      match: /^\d{4}-W\d{2}$/,
      index: true,
    },
    year: {
      type: Number,
      required: true,
    },
    week: {
      type: Number,
      required: true,
      min: 1,
      max: 53,
    },
    weekStart: {
      type: Date,
      required: true,
    },
    weekEnd: {
      type: Date,
      required: true,
    },
    photos: {
      type: [MaktabWeeklyPhotoSchema],
      required: true,
      validate: {
        validator: (photos: IMaktabWeeklyPhoto[]) => photos.length >= 1 && photos.length <= 8,
        message: 'A weekly report must include between 1 and 8 photos',
      },
    },
    note: {
      type: String,
      trim: true,
      maxlength: [800, 'Note cannot exceed 800 characters'],
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

MaktabWeeklyReportSchema.index({ teacher: 1, isoWeek: 1 }, { unique: true });

export default mongoose.model<IMaktabWeeklyReport>('MaktabWeeklyReport', MaktabWeeklyReportSchema);
