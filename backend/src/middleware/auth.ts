import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User from '../models/User';

interface AuthRequest extends Request {
  user?: any;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Get token from header
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'No token, authorization denied',
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your_jwt_secret'
    );

    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({
      status: 'error',
      message: 'Token is not valid',
    });
  }
};

export const optionalAuthMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your_jwt_secret'
    );
    req.user = decoded;
    return next();
  } catch (err) {
    // If token is invalid, just proceed without user
    return next();
  }
};

export const adminMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user || !req.user.userId) {
             return res.status(401).json({ status: 'error', message: 'User not authenticated' });
        }
        
        const user = await User.findById(req.user.userId);
        // Allow Super Admin, Manager, or legacy Admin
        if (user && (user.role === 'superadmin' || user.role === 'manager' || user.isAdmin)) {
            req.user.role = user.role;
            return next();
        } else {
            return res.status(403).json({ status: 'error', message: 'Access denied. Authorized personnel only.' });
        }
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Server error checking admin status.' });
    }
};

export const superAdminMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user || !req.user.userId) {
             return res.status(401).json({ status: 'error', message: 'User not authenticated' });
        }

        const user = await User.findById(req.user.userId);
        // Strict check for Super Admin
        if (user && (user.role === 'superadmin' || (user.isAdmin && user.role !== 'manager'))) {
             return next();
        } else {
             return res.status(403).json({ status: 'error', message: 'Access denied. Super Admin only.' });
        }
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Server error checking superadmin status.' });
    }
};
