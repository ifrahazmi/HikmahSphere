import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IUserActivity extends Document {
  userId: mongoose.Types.ObjectId;
  userName: string;
  userEmail: string;
  action: string;
  category: 'auth' | 'zakat' | 'prayer' | 'quran' | 'community' | 'profile' | 'system';
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface UserActivityModel extends Model<IUserActivity> {
  logActivity(
    userId: string,
    userName: string,
    userEmail: string,
    action: string,
    category: string,
    description: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IUserActivity>;
  getUserActivities(
    userId: string,
    limit?: number,
    page?: number
  ): Promise<{
    activities: IUserActivity[];
    pagination: { total: number; page: number; limit: number; pages: number };
  }>;
  getAllActivities(
    limit?: number,
    page?: number,
    filters?: any
  ): Promise<{
    activities: any[];
    pagination: { total: number; page: number; limit: number; pages: number };
  }>;
  getActivitySummary(
    days?: number
  ): Promise<{
    summary: any[];
    totalActivities: number;
    uniqueUsers: number;
    period: string;
  }>;
}

const UserActivitySchema = new Schema<IUserActivity>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  userName: {
    type: String,
    required: true,
  },
  userEmail: {
    type: String,
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      'register',
      'login',
      'logout',
      'password_change',
      'profile_update',
      'zakat_collection_add',
      'zakat_spending_add',
      'zakat_collection_edit',
      'zakat_spending_edit',
      'zakat_delete',
      'prayer_view',
      'quran_read',
      'quran_search',
      'community_post',
      'community_comment',
      'admin_login',
      'admin_logout',
      'admin_view_dashboard',
      'admin_user_create',
      'admin_user_update',
      'admin_user_delete',
      'admin_user_block',
      'admin_export_data',
      'other',
    ],
  },
  category: {
    type: String,
    required: true,
    enum: ['auth', 'zakat', 'prayer', 'quran', 'community', 'profile', 'system'],
    index: true,
  },
  description: {
    type: String,
    required: true,
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  metadata: {
    type: Schema.Types.Mixed,
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
UserActivitySchema.index({ userId: 1, createdAt: -1 });
UserActivitySchema.index({ category: 1, createdAt: -1 });
UserActivitySchema.index({ action: 1, createdAt: -1 });
UserActivitySchema.index({ createdAt: -1 });

// Static method to log activity
UserActivitySchema.statics.logActivity = async function(
  userId: string,
  userName: string,
  userEmail: string,
  action: string,
  category: string,
  description: string,
  metadata?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
) {
  const activity = new this({
    userId,
    userName,
    userEmail,
    action,
    category,
    description,
    metadata,
    ipAddress,
    userAgent,
  });
  await activity.save();
  return activity;
};

// Static method to get user activities
UserActivitySchema.statics.getUserActivities = async function(
  userId: string,
  limit: number = 50,
  page: number = 1
) {
  const skip = (page - 1) * limit;
  const activities = await this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
  
  const total = await this.countDocuments({ userId });
  
  return {
    activities,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};

// Static method to get all activities (for admin)
UserActivitySchema.statics.getAllActivities = async function(
  limit: number = 100,
  page: number = 1,
  filters?: {
    category?: string;
    action?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }
) {
  const skip = (page - 1) * limit;
  const query: any = {};
  
  if (filters) {
    if (filters.category) query.category = filters.category;
    if (filters.action) query.action = filters.action;
    if (filters.userId) query.userId = filters.userId;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }
  }
  
  const activities = await this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('userId', 'username email role');
  
  const total = await this.countDocuments(query);
  
  return {
    activities,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};

// Static method to get activity summary
UserActivitySchema.statics.getActivitySummary = async function(
  days: number = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const summary = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        actions: { $push: '$action' },
      },
    },
  ]);
  
  const totalActivities = await this.countDocuments({
    createdAt: { $gte: startDate },
  });
  
  const uniqueUsers = await this.distinct('userId', {
    createdAt: { $gte: startDate },
  });
  
  return {
    summary,
    totalActivities,
    uniqueUsers: uniqueUsers.length,
    period: `${days} days`,
  };
};

export default mongoose.model<IUserActivity, UserActivityModel>('UserActivity', UserActivitySchema);
