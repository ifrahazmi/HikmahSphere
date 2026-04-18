import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICommunityPost extends Document {
  forumId: Types.ObjectId;
  authorId: Types.ObjectId;
  authorName: string;
  title: string;
  content: string;
  tags: string[];
  imageUrl?: string;
  attachmentUrl?: string;
  externalLink?: string;
  videoUrl?: string;
  likeCount: number;
  replyCount: number;
  viewCount: number;
  isPinned: boolean;
  isLocked: boolean;
  moderationStatus: 'visible' | 'hidden';
  createdAt: Date;
  updatedAt: Date;
}

const CommunityPostSchema = new Schema<ICommunityPost>(
  {
    forumId: {
      type: Schema.Types.ObjectId,
      ref: 'CommunityForum',
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 5000,
    },
    tags: {
      type: [String],
      default: [],
      set: (value: string[]) => value.map((item) => item.trim().toLowerCase()).filter(Boolean),
    },
    imageUrl: {
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
    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    replyCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    moderationStatus: {
      type: String,
      enum: ['visible', 'hidden'],
      default: 'visible',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

CommunityPostSchema.index({ forumId: 1, createdAt: -1 });
CommunityPostSchema.index({ forumId: 1, isPinned: -1, createdAt: -1 });
CommunityPostSchema.index({ likeCount: -1, replyCount: -1, viewCount: -1 });

export default mongoose.model<ICommunityPost>('CommunityPost', CommunityPostSchema);
