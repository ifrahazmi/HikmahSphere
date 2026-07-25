import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IUserNotification extends Document {
  userId: Types.ObjectId;
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  readAt?: Date;
  source: 'admin-direct' | 'admin-broadcast' | 'prayer-adhan';
  createdAt: Date;
  updatedAt: Date;
}

const UserNotificationSchema = new Schema<IUserNotification>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [120, 'Title cannot exceed 120 characters'],
  },
  body: {
    type: String,
    required: true,
    trim: true,
    maxlength: [1000, 'Body cannot exceed 1000 characters'],
  },
  data: {
    type: Schema.Types.Mixed,
    default: {},
  },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  readAt: {
    type: Date,
  },
  source: {
    type: String,
    enum: ['admin-direct', 'admin-broadcast', 'prayer-adhan'],
    required: true,
  },
}, { timestamps: true });

UserNotificationSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IUserNotification>('UserNotification', UserNotificationSchema);
