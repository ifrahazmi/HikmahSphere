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

    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res.status(400).json({ status: 'error', message: 'User already exists' });
    }

    user = new User({
      username,
      email,
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
      email,
      'register',
      'auth',
      `New user registered: ${email}`,
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
    const user = await User.findOne({ email }).select('+password');
    
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
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('phoneNumber').optional().trim(),
    body('gender').optional().isIn(['male', 'female']),
], async (req: any, res: any) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ status: 'error', errors: errors.array() });
        }

        const { firstName, lastName, phoneNumber, gender, madhab, street, city, country, bio, avatar } = req.body;
        
        const updateData: any = {};
        
        // Update root level fields
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (phoneNumber) updateData.phoneNumber = phoneNumber;
        if (gender) updateData.gender = gender;
        
        // Update nested preferences
        if (madhab) updateData['preferences.madhab'] = madhab;
        
        // Update nested address
        if (street || city || country) {
            if (street) updateData['address.street'] = street;
            if (city) updateData['address.city'] = city;
            if (country) updateData['address.country'] = country;
        }
        
        // Update nested profile
        if (bio !== undefined) updateData['profile.bio'] = bio;
        if (avatar !== undefined) updateData['profile.avatar'] = avatar;
        
        const user = await User.findByIdAndUpdate(
            req.user.userId, 
            { $set: updateData }, 
            { new: true, runValidators: true }
        );
        
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }
        
        res.json({ status: 'success', data: { user }, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

export default router;
