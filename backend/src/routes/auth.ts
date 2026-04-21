import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { authMiddleware } from '../middleware/auth';
import { logAnonymousActivity, logUserActivity } from '../middleware/activityLogger';

const router = express.Router();

// Generate JWT Token
const generateToken = (userId: string): string => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your_jwt_secret',
    { expiresIn: process.env.JWT_EXPIRE || '30d' } as jwt.SignOptions
  );
};

// Generate Refresh Token
const generateRefreshToken = (userId: string): string => {
  return jwt.sign(
    { userId },
    process.env.REFRESH_TOKEN_SECRET || 'your_refresh_token_secret',
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRE || '7d' } as jwt.SignOptions
  );
};

// Check Admin
router.get('/check-admin', async (req, res) => {
    try {
        const adminUser = await User.findOne({ email: 'admin@hikmah.com' });
        if (adminUser) {
            res.json({
                status: 'success',
                message: 'Admin user found',
                data: {
                    user: {
                        _id: adminUser._id,
                        email: adminUser.email,
                        role: adminUser.role
                    }
                }
            });
        } else {
             res.json({ status: 'fail', message: 'Admin user not found' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to check admin user' });
    }
});

// Seed Admin (Manual)
router.post('/seed-admin', async (req, res) => {
    // ... (Keep existing seed logic if needed, usually handled in index.ts)
    res.json({ status: 'success', message: 'Use backend startup seeding.' });
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 */
router.post('/register', [
  body('username').trim().isLength({ min: 3 }),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const { username, email, password, firstName, lastName } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();

    let user = await User.findOne({ $or: [{ email: normalizedEmail }, { username }] });
    if (user) {
      return res.status(400).json({ status: 'error', message: 'User already exists' });
    }

    user = new User({
      username,
      email: normalizedEmail,
      password,
      firstName,
      lastName,
      requiresPasswordChange: false // Self-registered users don't need to change immediately
    });

    await user.save();

    const accessToken = generateToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    // Log registration activity
    await logAnonymousActivity(
      user._id.toString(),
      `${firstName} ${lastName}`,
      normalizedEmail,
      'register',
      'auth',
      `New user registered: ${normalizedEmail}`,
      req,
      { username, role: user.role }
    );

    return res.status(201).json({
      status: 'success',
      token: accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        role: user.role,
        isAdmin: user.isAdmin
      },
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 */
router.post('/login', [
  body('email').isEmail(),
  body('password').exists(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const { email, password } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incrementLoginAttempts();
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    if (user.isAccountLocked()) {
      return res.status(403).json({ status: 'error', message: 'Account is locked' });
    }

    // Reset login attempts
    await User.updateOne({ _id: user._id }, {
        $unset: { 'security.lockUntil': 1 },
        $set: { 'security.loginAttempts': 0, 'security.lastLogin': new Date() }
    });

    const accessToken = generateToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    // Log login activity
    await logAnonymousActivity(
      user._id.toString(),
      `${user.firstName} ${user.lastName}`,
      user.email,
      'login',
      'auth',
      `User logged in: ${user.email}`,
      req,
      { username: user.username, role: user.role, isAdmin: user.isAdmin }
    );

    // Check for forced password change
    if (user.requiresPasswordChange) {
        return res.json({
            status: 'success',
            passwordChangeRequired: true,
            token: accessToken, // Temporary token to allow password change
            user: { id: user._id, email: user.email }
        });
    }

    return res.json({
      status: 'success',
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        role: user.role,
        isAdmin: user.isAdmin
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password (for forced reset or user update)
 * @access  Private
 */
router.post('/change-password', authMiddleware, [
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req: any, res: any) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ status: 'error', errors: errors.array() });
        }

        const { newPassword } = req.body;
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        user.password = newPassword; // Will be hashed by pre-save hook
        user.requiresPasswordChange = false; // Reset flag
        await user.save();

        res.json({
            status: 'success',
            message: 'Password changed successfully'
        });

    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 */
router.get('/profile', authMiddleware, async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }
    return res.json({ status: 'success', data: { user } });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 */
router.put('/profile', authMiddleware, [
  body('firstName').optional({ checkFalsy: true }).trim().notEmpty(),
  body('lastName').optional({ checkFalsy: true }).trim().notEmpty(),
  body('phoneNumber').optional({ checkFalsy: true }).trim(),
  body('gender').optional({ checkFalsy: true }).isIn(['male', 'female']),
], async (req: any, res: any) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ status: 'error', errors: errors.array() });
        }

        const { firstName, lastName, phoneNumber, gender, madhab, street, city, country, bio, avatar } = req.body;
        const normalizeOptional = (value: unknown): string | undefined => {
          if (typeof value !== 'string') {
            return undefined;
          }
          const normalizedValue = value.trim();
          return normalizedValue.length > 0 ? normalizedValue : undefined;
        };

        const normalizedFirstName = normalizeOptional(firstName);
        const normalizedLastName = normalizeOptional(lastName);
        const normalizedPhoneNumber = normalizeOptional(phoneNumber);
        const normalizedGender = normalizeOptional(gender);
        const normalizedMadhab = normalizeOptional(madhab);
        const normalizedStreet = normalizeOptional(street);
        const normalizedCity = normalizeOptional(city);
        const normalizedCountry = normalizeOptional(country);
        const normalizedBio = normalizeOptional(bio);
        const normalizedAvatar = normalizeOptional(avatar);
        const user = await User.findById(req.user.userId);
        
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        const changedFields: Array<{ field: string; before?: string; after?: string }> = [];
        const stringifiedValue = (value: unknown): string => {
          if (value === null || value === undefined) return '';
          if (typeof value === 'string') return value;
          return String(value);
        };

        const applyChange = (field: string, nextValue: unknown, currentValue: unknown, setter: () => void) => {
          const beforeValue = stringifiedValue(currentValue);
          const afterValue = stringifiedValue(nextValue);
          if (beforeValue === afterValue) {
            return;
          }
          setter();
          changedFields.push({ field, before: beforeValue, after: afterValue });
        };

        if (normalizedFirstName !== undefined) {
          applyChange('firstName', normalizedFirstName, user.firstName, () => {
            user.firstName = normalizedFirstName;
          });
        }
        if (normalizedLastName !== undefined) {
          applyChange('lastName', normalizedLastName, user.lastName, () => {
            user.lastName = normalizedLastName;
          });
        }
        if (normalizedPhoneNumber !== undefined) {
          applyChange('phoneNumber', normalizedPhoneNumber, user.phoneNumber, () => {
            user.phoneNumber = normalizedPhoneNumber;
          });
        }
        if (normalizedGender !== undefined) {
          applyChange('gender', normalizedGender, user.gender, () => {
            user.gender = normalizedGender as 'male' | 'female';
          });
        }
        if (normalizedMadhab !== undefined) {
          const currentMadhab = user.preferences?.madhab;
          applyChange('preferences.madhab', normalizedMadhab, currentMadhab, () => {
            if (!user.preferences) {
              user.preferences = {
                language: 'en',
                prayerCalculationMethod: 'MWL',
                madhab: 'hanafi',
                notifications: {
                  prayers: true,
                  events: true,
                  community: true,
                },
              };
            }
            user.preferences.madhab = normalizedMadhab as 'hanafi' | 'shafi' | 'maliki' | 'hanbali';
          });
        }
        if (normalizedStreet !== undefined) {
          applyChange('address.street', normalizedStreet, user.address?.street, () => {
            const nextAddress = user.address || ({} as any);
            nextAddress.street = normalizedStreet;
            user.address = nextAddress;
          });
        }
        if (normalizedCity !== undefined) {
          applyChange('address.city', normalizedCity, user.address?.city, () => {
            const nextAddress = user.address || ({} as any);
            nextAddress.city = normalizedCity;
            user.address = nextAddress;
          });
        }
        if (normalizedCountry !== undefined) {
          applyChange('address.country', normalizedCountry, user.address?.country, () => {
            const nextAddress = user.address || ({} as any);
            nextAddress.country = normalizedCountry;
            user.address = nextAddress;
          });
        }
        if (normalizedBio !== undefined) {
          applyChange('profile.bio', normalizedBio, user.profile?.bio, () => {
            if (!user.profile) user.profile = { interests: [] };
            user.profile.bio = normalizedBio;
          });
        }
        if (normalizedAvatar !== undefined) {
          applyChange('profile.avatar', normalizedAvatar, user.profile?.avatar, () => {
            if (!user.profile) user.profile = { interests: [] };
            user.profile.avatar = normalizedAvatar;
          });
        }

        if (changedFields.length > 0) {
          if (!user.profileAudit) {
            user.profileAudit = { history: [] };
          }
          const actorName = (typeof req.user?.name === 'string' && req.user.name.trim().length > 0)
            ? req.user.name.trim()
            : (typeof req.user?.email === 'string' ? req.user.email : 'User');

          user.profileAudit.lastEditedAt = new Date();
          user.profileAudit.history = [
            {
              editedAt: new Date(),
              editedByUserId: req.user.userId,
              actorName,
              changedFields,
            },
            ...(Array.isArray(user.profileAudit.history) ? user.profileAudit.history : []),
          ].slice(0, 50);

          await logUserActivity(
            req,
            'profile_update',
            'profile',
            `${actorName} updated profile fields: ${changedFields.map((field) => field.field).join(', ')}`,
            { changedFields: changedFields.map((field) => field.field) }
          );
        }

        await user.save();
        
        res.json({ status: 'success', data: { user }, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

/**
 * @route   PUT /api/auth/preferences/meeting-notifications
 * @desc    Update current user meeting notification preferences
 */
router.put('/preferences/meeting-notifications', authMiddleware, [
  body('enabled').optional().isBoolean(),
  body('channels').optional().isArray(),
  body('reminderMinutes').optional().isArray(),
], async (req: any, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array().map((error: any) => ({ field: error.path, message: error.msg })),
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    if (!user.preferences) {
      user.preferences = {
        language: 'en',
        prayerCalculationMethod: 'MWL',
        madhab: 'hanafi',
        notifications: {
          prayers: true,
          events: true,
          community: true,
        },
      };
    }

    if (!user.preferences.notifications) {
      user.preferences.notifications = {
        prayers: true,
        events: true,
        community: true,
      };
    }

    const channels = Array.isArray(req.body.channels)
      ? req.body.channels.filter((item: string) => ['push', 'email'].includes(item))
      : undefined;

    const reminderMinutes = Array.isArray(req.body.reminderMinutes)
      ? req.body.reminderMinutes
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isFinite(value) && value > 0)
          .sort((a: number, b: number) => b - a)
      : undefined;

    const existingMeetingPrefs = user.preferences.notifications.meetings || {
      enabled: true,
      channels: ['push', 'email'],
      reminderMinutes: [1440, 60, 15],
    };

    user.preferences.notifications.meetings = {
      enabled: typeof req.body.enabled === 'boolean' ? req.body.enabled : existingMeetingPrefs.enabled,
      channels: channels && channels.length > 0 ? channels : existingMeetingPrefs.channels,
      reminderMinutes: reminderMinutes && reminderMinutes.length > 0 ? reminderMinutes : existingMeetingPrefs.reminderMinutes,
    };

    await user.save();

    return res.json({
      status: 'success',
      message: 'Meeting notification preferences updated',
      data: {
        meetings: user.preferences.notifications.meetings,
      },
    });
  } catch (error) {
    console.error('Update meeting preferences error:', error);
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

export default router;
