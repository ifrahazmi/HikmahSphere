import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User from '../models/User';

interface AuthRequest extends Request {
  user?: any;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    ) as { userId?: string };

    if (!decoded?.userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Token is not valid',
      });
    }

    const dbUser = await User.findById(decoded.userId).select('email firstName lastName username role isAdmin');
    if (!dbUser) {
      return res.status(401).json({
        status: 'error',
        message: 'Token is not valid',
      });
    }

    req.user = {
      ...decoded,
      userId: decoded.userId,
      email: dbUser.email,
      username: dbUser.username,
      name: `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || dbUser.username,
      role: dbUser.role,
      isAdmin: dbUser.isAdmin,
    };
    return next();
  } catch {
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
  } catch {
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
    } catch {
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
    } catch {
        return res.status(500).json({ status: 'error', message: 'Server error checking superadmin status.' });
    }
};
