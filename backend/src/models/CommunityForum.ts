import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICommunityForum extends Document {
  title: string;
  description: string;
  category: string;
  tags: string[];
  coverImageUrl?: string;
  attachmentUrl?: string;
  externalLink?: string;
  videoUrl?: string;
  createdById?: Types.ObjectId;
  createdByName?: string;
  moderators: Types.ObjectId[];
  memberCount: number;
  postCount: number;
  lastActivityAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CommunityForumSchema = new Schema<ICommunityForum>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 600,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      set: (value: string[]) => value.map((item) => item.trim().toLowerCase()).filter(Boolean),
    },
    coverImageUrl: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    attachmentUrl: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    externalLink: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    videoUrl: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    createdByName: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    moderators: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    memberCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    postCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

CommunityForumSchema.index({ category: 1, isActive: 1 });
CommunityForumSchema.index({ lastActivityAt: -1 });

export default mongoose.model<ICommunityForum>('CommunityForum', CommunityForumSchema);
