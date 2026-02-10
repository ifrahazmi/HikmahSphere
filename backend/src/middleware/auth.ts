import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User from '../models/User';

export interface AuthRequest extends Request {
  user?: any;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // Get token from header
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({
      status: 'error',
      message: 'No token, authorization denied',
    });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your_jwt_secret'
    );
    
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({
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
    next();
  } catch (err) {
    // If token is invalid, just proceed without user
    next();
  }
};

export const adminMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user || !req.user.userId) {
             res.status(401).json({ status: 'error', message: 'User not authenticated' });
             return;
        }
        
        const user = await User.findById(req.user.userId);
        // Allow Super Admin, Manager, or legacy Admin
        if (user && (user.role === 'superadmin' || user.role === 'manager' || user.isAdmin)) {
            req.user.role = user.role; 
            next();
        } else {
            res.status(403).json({ status: 'error', message: 'Access denied. Authorized personnel only.' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error checking admin status.' });
    }
};

export const superAdminMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user || !req.user.userId) {
             res.status(401).json({ status: 'error', message: 'User not authenticated' });
             return;
        }

        const user = await User.findById(req.user.userId);
        // Strict check for Super Admin
        if (user && (user.role === 'superadmin' || (user.isAdmin && user.role !== 'manager'))) {
             next();
        } else {
             res.status(403).json({ status: 'error', message: 'Access denied. Super Admin only.' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error checking superadmin status.' });
    }
};
