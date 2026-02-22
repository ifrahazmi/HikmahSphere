import { Request, Response, NextFunction } from 'express';
import UserActivity from '../models/UserActivity';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email?: string;
    name?: string;
  };
}

const UserActivityModel = UserActivity as typeof UserActivity & {
  logActivity: (
    userId: string,
    userName: string,
    userEmail: string,
    action: string,
    category: string,
    description: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ) => Promise<any>;
};

/**
 * Middleware to log user activities
 * Usage: app.post('/route', logActivity('action_name', 'category'), handler)
 */
export const logActivity = (
  action: string,
  category: 'auth' | 'zakat' | 'prayer' | 'quran' | 'community' | 'profile' | 'system',
  descriptionFn?: (req: Request, res: Response) => string,
  metadataFn?: (req: Request, res: Response) => Record<string, any>
) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Store original res.json to capture response
    const originalJson = res.json;
    
    res.json = function(data: any) {
      // Log activity after successful response
      if (res.statusCode < 400 && req.user) {
        const description = descriptionFn 
          ? descriptionFn(req, res) 
          : `${action} by ${req.user.email || req.user.userId}`;
        
        const metadata = metadataFn ? metadataFn(req, res) : undefined;
        
        // Log activity asynchronously (don't wait)
        UserActivityModel.logActivity(
          req.user.userId,
          req.user.name || req.user.email || 'Unknown',
          req.user.email || 'unknown@example.com',
          action,
          category,
          description,
          metadata,
          req.ip,
          req.get('user-agent')
        ).catch((err: Error) => console.error('Activity logging error:', err));
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

/**
 * Manual activity logging function
 * Usage: await logUserActivity(req, 'action', 'category', 'description', metadata)
 */
export const logUserActivity = async (
  req: AuthenticatedRequest,
  action: string,
  category: 'auth' | 'zakat' | 'prayer' | 'quran' | 'community' | 'profile' | 'system',
  description: string,
  metadata?: Record<string, any>
) => {
  if (!req.user) return;
  
  try {
    await UserActivityModel.logActivity(
      req.user.userId,
      req.user.name || req.user.email || 'Unknown',
      req.user.email || 'unknown@example.com',
      action,
      category,
      description,
      metadata,
      req.ip,
      req.get('user-agent')
    );
  } catch (error) {
    console.error('Activity logging error:', error);
  }
};

/**
 * Log activity for non-authenticated users (e.g., failed login attempts)
 */
export const logAnonymousActivity = async (
  userId: string,
  userName: string,
  userEmail: string,
  action: string,
  category: 'auth' | 'zakat' | 'prayer' | 'quran' | 'community' | 'profile' | 'system',
  description: string,
  req: Request,
  metadata?: Record<string, any>
) => {
  try {
    await UserActivityModel.logActivity(
      userId,
      userName,
      userEmail,
      action,
      category,
      description,
      metadata,
      req.ip,
      req.get('user-agent')
    );
  } catch (error) {
    console.error('Anonymous activity logging error:', error);
  }
};
