import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICommunityForumMember extends Document {
  forumId: Types.ObjectId;
  userId: Types.ObjectId;
  joinedAt: Date;
}

const CommunityForumMemberSchema = new Schema<ICommunityForumMember>(
  {
    forumId: {
      type: Schema.Types.ObjectId,
      ref: 'CommunityForum',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

CommunityForumMemberSchema.index({ forumId: 1, userId: 1 }, { unique: true });

export default mongoose.model<ICommunityForumMember>('CommunityForumMember', CommunityForumMemberSchema);
