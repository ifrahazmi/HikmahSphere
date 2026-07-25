import express, { Request, Response } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import UserActivity from '../models/UserActivity';

const UserActivityModel = UserActivity as typeof UserActivity & {
  getAllActivities: (limit?: number, page?: number, filters?: any) => Promise<any>;
  getUserActivities: (userId: string, limit?: number, page?: number) => Promise<any>;
  getActivitySummary: (days?: number) => Promise<any>;
};

const router = express.Router();

/**
 * @route   GET /api/activity/logs
 * @desc    Get all user activity logs (Admin only)
 * @access  Private (Admin)
 */
router.get('/logs', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const { limit = 100, page = 1, category, action, userId, startDate, endDate } = req.query;
    
    const filters: any = {};
    if (category) filters.category = category;
    if (action) filters.action = action;
    if (userId) filters.userId = userId;
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.$gte = new Date(startDate);
      if (endDate) filters.createdAt.$lte = new Date(endDate);
    }
    
    const result = await UserActivityModel.getAllActivities(
      parseInt(limit, 10),
      parseInt(page, 10),
      filters
    );
    
    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch activity logs' 
    });
  }
});

/**
 * @route   GET /api/activity/user/:userId
 * @desc    Get activity logs for a specific user
 * @access  Private (Admin)
 */
router.get('/user/:userId', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const { limit = 50, page = 1 } = req.query;
    
    const result = await UserActivityModel.getUserActivities(
      userId,
      parseInt(limit, 10),
      parseInt(page, 10)
    );
    
    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    console.error('Get user activities error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch user activities' 
    });
  }
});

/**
 * @route   GET /api/activity/summary
 * @desc    Get activity summary for dashboard
 * @access  Private (Admin)
 */
router.get('/summary', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const { days = 30 } = req.query;
    
    const result = await UserActivityModel.getActivitySummary(parseInt(days, 10));
    
    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    console.error('Get activity summary error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch activity summary' 
    });
  }
});

/**
 * @route   GET /api/activity/recent
 * @desc    Get recent activity logs for dashboard overview
 * @access  Private (Admin)
 */
router.get('/recent', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const { limit = 20 } = req.query;
    
    const activities = await UserActivity.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .select('userId userName userEmail action category description createdAt ipAddress');
    
    res.json({
      status: 'success',
      data: { activities },
    });
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch recent activities' 
    });
  }
});

/**
 * @route   GET /api/activity/stats
 * @desc    Get activity statistics for dashboard
 * @access  Private (Admin)
 */
router.get('/stats', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days, 10));
    
    // Total activities
    const totalActivities = await UserActivity.countDocuments({
      createdAt: { $gte: startDate },
    });
    
    // Activities by category
    const byCategory = await UserActivity.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    
    // Activities by action
    const byAction = await UserActivity.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    
    // Most active users
    const mostActiveUsers = await UserActivity.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$userId', userName: { $first: '$userName' }, userEmail: { $first: '$userEmail' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    
    // New users (register actions)
    const newUsers = await UserActivity.find({
      action: 'register',
      createdAt: { $gte: startDate },
    })
    .select('userId userName userEmail createdAt')
    .sort({ createdAt: -1 })
    .limit(10);
    
    res.json({
      status: 'success',
      data: {
        period: `${days} days`,
        totalActivities,
        byCategory,
        byAction,
        mostActiveUsers,
        newUsers,
      },
    });
  } catch (error) {
    console.error('Get activity stats error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch activity statistics' 
    });
  }
});

export default router;
