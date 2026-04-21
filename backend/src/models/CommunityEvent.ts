import mongoose, { Document, Schema, Types } from 'mongoose';

export type CommunityEventType = 'prayer' | 'iftar' | 'lecture' | 'study' | 'charity' | 'social';

export interface ICommunityEvent extends Document {
  title: string;
  description: string;
  type: CommunityEventType;
  date: Date;
  location: {
    name: string;
    address: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  organizer: {
    id: Types.ObjectId;
    name: string;
    verified: boolean;
  };
  attendeeIds: Types.ObjectId[];
  maxCapacity?: number;
  isOnline: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CommunityEventSchema = new Schema<ICommunityEvent>(
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
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: ['prayer', 'iftar', 'lecture', 'study', 'charity', 'social'],
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    location: {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
      },
      address: {
        type: String,
        required: true,
        trim: true,
        maxlength: 280,
      },
      coordinates: {
        lat: {
          type: Number,
          min: -90,
          max: 90,
        },
        lng: {
          type: Number,
          min: -180,
          max: 180,
        },
      },
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
    },
    isOnline: {
      type: Boolean,
      default: false,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      set: (value: string[]) => value.map((item) => item.trim().toLowerCase()).filter(Boolean),
    },
  },
  {
    timestamps: true,
  }
);

CommunityEventSchema.index({ date: 1, type: 1 });

export default mongoose.model<ICommunityEvent>('CommunityEvent', CommunityEventSchema);
