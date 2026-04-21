import mongoose, { Document, Schema, Types } from 'mongoose';

export type MeetingPlatform = 'google_meet' | 'zoom' | 'teams' | 'jitsi' | 'other';
export type MeetingStatus = 'scheduled' | 'completed' | 'canceled';
export type MeetingRecurrence = 'none' | 'weekly' | 'biweekly';
export type MeetingReminderChannel = 'push' | 'email';

export interface IMeetingAttachment {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface IMeetingNotificationConfig {
  enabled: boolean;
  channels: MeetingReminderChannel[];
  reminderMinutes: number[];
  mode: 'once' | 'multiple';
  audience: 'all_registered' | 'rsvped_only';
  allowManualSendToAll: boolean;
  sendHistory: Array<{
    sentAt: Date;
    channel: MeetingReminderChannel;
    audience: 'all_registered' | 'rsvped_only';
    recipientCount: number;
    trigger: 'manual' | 'scheduled';
    note?: string;
  }>;
}

export interface ICommunityMeeting extends Document {
  title: string;
  description: string;
  topic: string;
  speakerName: string;
  platform: MeetingPlatform;
  meetingUrl?: string;
  meetingId?: string;
  passcode?: string;
  scheduledAt: Date;
  durationMinutes: number;
  timezone: string;
  recurrence: MeetingRecurrence;
  status: MeetingStatus;
  organizer: {
    id: Types.ObjectId;
    name: string;
    verified: boolean;
  };
  attendeeIds: Types.ObjectId[];
  maxCapacity?: number;
  tags: string[];
  notesLinks: string[];
  attachment?: IMeetingAttachment;
  notificationConfig: IMeetingNotificationConfig;
  createdAt: Date;
  updatedAt: Date;
}

const CommunityMeetingSchema = new Schema<ICommunityMeeting>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 1200,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 160,
    },
    speakerName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    platform: {
      type: String,
      enum: ['google_meet', 'zoom', 'teams', 'jitsi', 'other'],
      default: 'google_meet',
      index: true,
    },
    meetingUrl: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    meetingId: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    passcode: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 10,
      max: 600,
    },
    timezone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      default: 'UTC',
    },
    recurrence: {
      type: String,
      enum: ['none', 'weekly', 'biweekly'],
      default: 'none',
      index: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'canceled'],
      default: 'scheduled',
      index: true,
    },
    organizer: {
      id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
      },
      verified: {
        type: Boolean,
        default: false,
      },
    },
    attendeeIds: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    maxCapacity: {
      type: Number,
      min: 1,
      max: 100000,
    },
    tags: {
      type: [String],
      default: [],
      set: (value: string[]) => value.map((item) => item.trim().toLowerCase()).filter(Boolean),
    },
    notesLinks: {
      type: [String],
      default: [],
      set: (value: string[]) => value.map((item) => item.trim()).filter(Boolean),
    },
    attachment: {
      url: {
        type: String,
        trim: true,
      },
      name: {
        type: String,
        trim: true,
        maxlength: 280,
      },
      mimeType: {
        type: String,
        trim: true,
        maxlength: 120,
      },
      size: {
        type: Number,
        min: 1,
      },
    },
    notificationConfig: {
      enabled: {
        type: Boolean,
        default: true,
      },
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
      allowManualSendToAll: {
        type: Boolean,
        default: true,
      },
      sendHistory: {
        type: [
          {
            sentAt: { type: Date, default: Date.now },
            channel: { type: String, enum: ['push', 'email'], required: true },
            audience: { type: String, enum: ['all_registered', 'rsvped_only'], required: true },
            recipientCount: { type: Number, required: true, min: 0 },
            trigger: { type: String, enum: ['manual', 'scheduled'], required: true },
            note: { type: String, trim: true, maxlength: 280 },
          },
        ],
        default: [],
      },
    },
  },
  {
    timestamps: true,
  }
);

CommunityMeetingSchema.index({ scheduledAt: 1, status: 1 });
CommunityMeetingSchema.index({ 'organizer.id': 1, createdAt: -1 });

export default mongoose.model<ICommunityMeeting>('CommunityMeeting', CommunityMeetingSchema);
