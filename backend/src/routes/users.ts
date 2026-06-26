import express from 'express';
import User from '../models/User';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Get User Profile & Preferences
router.get('/:id', authMiddleware, async (req: any, res) => {
  try {
    if (req.user.userId !== req.params.id && !req.user.role?.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const user = await User.findById(req.params.id, '-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// Get User Notification Preferences
router.get('/:id/notification-prefs', authMiddleware, async (req: any, res) => {
  try {
    if (req.user.userId !== req.params.id && !req.user.role?.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    return res.json({ notificationPreferences: user.preferences?.notifications?.prayerAlerts || null });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// Update User Notification Preferences
router.put('/:id/notification-prefs', authMiddleware, async (req: any, res) => {
  try {
    if (req.user.userId !== req.params.id && !req.user.role?.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    const { notificationPreferences } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    if (!user.preferences) user.preferences = {} as any;
    if (!user.preferences.notifications) user.preferences.notifications = {} as any;
    
    user.preferences.notifications.prayerAlerts = notificationPreferences;
    
    user.markModified('preferences');
    await user.save();
    
    return res.json({ message: 'Updated', notificationPreferences: user.preferences.notifications.prayerAlerts });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// Update User Generic Preferences
router.put('/:id/preferences', authMiddleware, async (req: any, res) => {
  try {
    if (req.user.userId !== req.params.id && !req.user.role?.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    const { preferences } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    user.preferences = { ...user.preferences, ...preferences };
    user.markModified('preferences');
    await user.save();
    
    return res.json({ message: 'Updated', preferences: user.preferences });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

export default router;
