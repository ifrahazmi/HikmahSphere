import mongoose, { Document, Schema } from 'mongoose';

export interface IMeetingNotificationSettings extends Document {
  key: string;
  defaults: {
    enabled: boolean;
    channels: Array<'push' | 'email'>;
    reminderMinutes: number[];
    mode: 'once' | 'multiple';
    audience: 'all_registered' | 'rsvped_only';
  };
  emailTemplate: {
    subjectPrefix: string;
    logoUrl: string;
    headerTitle: string;
    footerText: string;
    includeAdvertisement: boolean;
    advertisementText?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const MeetingNotificationSettingsSchema = new Schema<IMeetingNotificationSettings>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'global',
    },
    defaults: {
      enabled: { type: Boolean, default: true },
      channels: {
        type: [String],
        enum: ['push', 'email'],
        default: ['push', 'email'],
      },
      reminderMinutes: {
        type: [Number],
        default: [1440, 60, 15],
      },
      mode: {
        type: String,
        enum: ['once', 'multiple'],
        default: 'multiple',
      },
      audience: {
        type: String,
        enum: ['all_registered', 'rsvped_only'],
        default: 'all_registered',
      },
    },
    emailTemplate: {
      subjectPrefix: { type: String, default: 'HikmahSphere Meeting' },
      logoUrl: { type: String, default: '/logo.png' },
      headerTitle: { type: String, default: 'You are invited to a community meeting' },
      footerText: { type: String, default: 'You received this because you have a HikmahSphere account.' },
      includeAdvertisement: { type: Boolean, default: false },
      advertisementText: { type: String, trim: true, maxlength: 600 },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IMeetingNotificationSettings>('MeetingNotificationSettings', MeetingNotificationSettingsSchema);
