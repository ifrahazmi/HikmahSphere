import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICommunityComment extends Document {
  postId: Types.ObjectId;
  forumId: Types.ObjectId;
  parentCommentId?: Types.ObjectId;
  authorId: Types.ObjectId;
  authorName: string;
  content: string;
  moderationStatus: 'visible' | 'hidden';
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CommunityCommentSchema = new Schema<ICommunityComment>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'CommunityPost',
      required: true,
      index: true,
    },
    forumId: {
      type: Schema.Types.ObjectId,
      ref: 'CommunityForum',
      required: true,
      index: true,
    },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: 'CommunityComment',
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
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 1500,
    },
    moderationStatus: {
      type: String,
      enum: ['visible', 'hidden'],
      default: 'visible',
      index: true,
    },
    replyCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

CommunityCommentSchema.index({ postId: 1, parentCommentId: 1, createdAt: -1 });

export default mongoose.model<ICommunityComment>('CommunityComment', CommunityCommentSchema);
