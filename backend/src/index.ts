import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import User from './models/User';
import { authMiddleware, superAdminMiddleware } from './middleware/auth';
import {
  appLogger,
  requestLogger,
  errorLogger,
  installProductionConsoleBridge,
  logStartup,
  logDatabaseConnection,
  summarizeMongoUri,
} from './middleware/logger';
import redisClient from './config/redis'; // Import Redis client
import { getUploadsRoot } from './utils/uploads';
import { startMeetingNotificationScheduler, stopMeetingNotificationScheduler } from './services/meetingNotificationScheduler';
import { startPrayerNotificationScheduler, stopPrayerNotificationScheduler } from './services/prayerNotificationScheduler';
import { startPrayerTimesCacheScheduler, stopPrayerTimesCacheScheduler } from './services/prayerTimesCacheScheduler';
import { startDhikrReminderScheduler, stopDhikrReminderScheduler } from './services/dhikrReminderScheduler';
import { logZohoMailStatus } from './services/zohoMail';
import { logObjectStorageStatus } from './services/objectStorage';

// Import routes
import authRoutes from './routes/auth';
import prayerRoutes from './routes/prayers';
import quranRoutes from './routes/quran';
import dhikrRoutes from './routes/dhikr';
import zakatRoutes from './routes/zakat';
import maktabRoutes from './routes/maktab';
import communityRoutes from './routes/community';
import notificationRoutes from './routes/notifications'; // Import notification routes
import supportRoutes from './routes/support'; // Import support routes
import activityRoutes from './routes/activity'; // Import activity log routes
import salahTrackerRoutes from './routes/salahTracker';
import hajjGuideRoutes from './routes/hajjGuide';
import gamesRoutes from './routes/games';
import userRoutes from './routes/users';

// Load environment variables
// Use __dirname to resolve paths correctly regardless of whether running from src/ or dist/
const rootDir = path.resolve(__dirname, '..');
const envPaths = [
  path.join(rootDir, '.env'),           // Root .env (for both dev and production)
  path.join(process.cwd(), '.env'),     // Fallback to current directory
];

for (const envPath of envPaths) {
  dotenv.config({ path: envPath, override: false });
}

// Render captures stdout/stderr. Keep only readable warnings/errors from legacy
// console output; routine request access lines come from the central logger.
installProductionConsoleBridge();
appLogger.info('environment_loaded', {
  sourcesChecked: envPaths,
  nodeEnvironment: process.env.NODE_ENV || 'development',
});

// Log loaded Islamic API Key (masked)
const apiKey = process.env.ISLAMIC_API_KEY;
if (apiKey) {
    console.log('🔑 ISLAMIC_API_KEY loaded successfully');
} else {
    console.warn('⚠️ ISLAMIC_API_KEY is missing from environment variables!');
}

logZohoMailStatus();
logObjectStorageStatus();

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);
const NOTIFICATION_ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const NOTIFICATION_RECENT_WINDOW_MS = 30 * 60 * 1000;

type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unknown';

type NotificationDeviceStatus = {
  deviceId: string;
  token?: string;
  permission: NotificationPermissionState;
  supportsWebPush: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  lastSeenAt: Date | null;
  lastActiveAt: Date | null;
  updatedAt: Date | null;
  isLive: boolean;
  isRecentlySeen: boolean;
  canReceiveNotification: boolean;
};

const normalizePermission = (value: unknown): NotificationPermissionState => {
  if (value === 'granted' || value === 'denied' || value === 'default') {
    return value;
  }
  return 'unknown';
};

const toDateOrNull = (value: unknown): Date | null => {
  const parsed = new Date(value as string | number | Date);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const normalizeDeviceStatus = (rawDevice: any): NotificationDeviceStatus | null => {
  const deviceId = typeof rawDevice?.deviceId === 'string' ? rawDevice.deviceId.trim() : '';
  const token = typeof rawDevice?.token === 'string' ? rawDevice.token.trim() : '';
  if (!deviceId) {
    return null;
  }

  const permission = normalizePermission(rawDevice?.permission);
  const supportsWebPush = rawDevice?.supportsWebPush === true;
  const isIOS = rawDevice?.isIOS === true;
  const isStandalone = rawDevice?.isStandalone === true;
  const lastSeenAt = toDateOrNull(rawDevice?.lastSeenAt);
  const lastActiveAt = toDateOrNull(rawDevice?.lastActiveAt);
  const updatedAt = toDateOrNull(rawDevice?.updatedAt);
  const referenceTime = lastSeenAt || updatedAt;
  const isLive = Boolean(
    lastActiveAt && (Date.now() - lastActiveAt.getTime()) <= NOTIFICATION_ACTIVE_WINDOW_MS
  );
  const isRecentlySeen = Boolean(
    referenceTime && (Date.now() - referenceTime.getTime()) <= NOTIFICATION_RECENT_WINDOW_MS
  );
  const iosBlocked = isIOS && !isStandalone;
  const canReceiveNotification =
    Boolean(token) && permission === 'granted' && supportsWebPush && !iosBlocked;

  const normalized: NotificationDeviceStatus = {
    deviceId,
    permission,
    supportsWebPush,
    isIOS,
    isStandalone,
    lastSeenAt,
    lastActiveAt,
    updatedAt,
    isLive,
    isRecentlySeen,
    canReceiveNotification,
  };
  if (token) normalized.token = token;
  return normalized;
};

const deriveUserNotificationStatus = (rawUser: any) => {
  const devices = Array.isArray(rawUser?.notificationDevices)
    ? rawUser.notificationDevices.map(normalizeDeviceStatus).filter(Boolean) as NotificationDeviceStatus[]
    : [];

  const lastSeenAt = devices.reduce<Date | null>((latest, device) => {
    const candidate = device.lastSeenAt || device.updatedAt;
    if (!candidate) return latest;
    if (!latest || candidate.getTime() > latest.getTime()) {
      return candidate;
    }
    return latest;
  }, null);

  const hasValidNotificationDevice = devices.some((device) => device.canReceiveNotification);
  const isNotificationLive = devices.some((device) => device.isLive);
  const isNotificationRecentlySeen = devices.some((device) => device.isRecentlySeen);
  const lastActiveAt = devices.reduce<Date | null>((latest, device) => {
    const candidate = device.lastActiveAt;
    if (!candidate || (latest && candidate.getTime() <= latest.getTime())) return latest;
    return candidate;
  }, null);
  const topLevelPermission = normalizePermission(rawUser?.notificationPermission);
  const effectivePermission = topLevelPermission !== 'unknown'
    ? topLevelPermission
    : (devices[0]?.permission || 'unknown');

  return {
    notificationPermission: effectivePermission,
    notificationPermissionUpdatedAt: rawUser?.notificationPermissionUpdatedAt || null,
    notificationPreference: {
      prayers: rawUser?.preferences?.notifications?.prayers !== false,
      events: rawUser?.preferences?.notifications?.events !== false,
      community: rawUser?.preferences?.notifications?.community !== false,
    },
    hasValidNotificationDevice,
    isNotificationLive,
    isNotificationActive: isNotificationLive,
    isNotificationRecentlySeen,
    notificationDeviceCount: devices.length,
    notificationLastSeenAt: lastSeenAt,
    notificationLastActiveAt: lastActiveAt,
    notificationDevices: devices,
  };
};

// Trust Proxy for IDX/Cloud environments
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"], // Added blob: for image previews
      scriptSrc: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resource sharing
}));

// Rate limiting
const isQuranApiRequest = (req: express.Request) => req.path.startsWith('/api/quran');
const isRateLimitSkippedRequest = (req: express.Request) => (
  req.path.startsWith('/api/hajj-guide/images')
  || isQuranApiRequest(req)
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (dashboards/SPAs poll many endpoints)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  validate: {
      xForwardedForHeader: false, // Disable validation if we trust proxy logic is complex
  },
  skip: isRateLimitSkippedRequest,
});

app.use(limiter);

const quranLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Quran content is receiving too many requests right now. Please wait a moment and try again.',
  },
  validate: {
    xForwardedForHeader: false,
  },
});

// CORS configuration — honor CORS_ORIGIN when set (comma-separated allowlist).
// When unset, reflect the request origin (local Docker / IDX development).
const corsOriginEnv = process.env.CORS_ORIGIN?.trim();
const allowedOrigins = corsOriginEnv
  ? corsOriginEnv.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

app.use(cors({
  origin: allowedOrigins.length > 0
    ? (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      }
    : true,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files for uploads from one shared base path.
const uploadsPath = getUploadsRoot();
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Also serve from src/uploads for backwards compatibility
app.use('/src/uploads', express.static(uploadsPath));

// Request logging middleware
app.use(requestLogger);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: '🕌 Welcome to HikmahSphere API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      prayers: '/api/prayers',
      quran: '/api/quran',
      dhikr: '/api/dhikr',
      zakat: '/api/zakat',
      maktab: '/api/maktab',
      community: '/api/community',
      salahTracker: '/api/salah-tracker',
      hajjGuide: '/api/hajj-guide',
    },
    documentation: `${req.protocol}://${req.get('host')}/docs`
  });
});

// API base endpoint (supports both /api and /api/)
app.get(['/api', '/api/'], (req, res) => {
  res.status(200).json({
    status: 'success',
    message: '🕌 HikmahSphere API base endpoint',
    version: '1.0.0',
    basePath: '/api',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      prayers: '/api/prayers',
      quran: '/api/quran',
      dhikr: '/api/dhikr',
      zakat: '/api/zakat',
      maktab: '/api/maktab',
      community: '/api/community',
      notifications: '/api/notifications',
      support: '/api/support',
      activity: '/api/activity',
      salahTracker: '/api/salah-tracker',
      hajjGuide: '/api/hajj-guide',
    },
  });
});

// Health check endpoint (supports both /health and /api/health)
app.get(['/health', '/api/health'], async (req, res) => {
  let redisStatus = 'disconnected';
  try {
      if (redisClient.isOpen) {
          await redisClient.ping();
          redisStatus = 'connected';
      }
  } catch (error) {
      redisStatus = 'error';
  }

  res.status(200).json({
    status: 'success',
    message: 'HikmahSphere API is running! 🕌',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        redis: redisStatus
    }
  });
});

// --- REDIS TEST ROUTE START ---
app.get('/api/test/redis', async (req, res) => {
    try {
        if (!redisClient.isOpen) {
            res.status(503).json({ status: 'error', message: 'Redis not connected' });
            return;
        }

        // Increment a simple counter
        const count = await redisClient.incr('test_counter');
        
        // Store a test object
        await redisClient.hSet('test_hash', {
            last_visit: new Date().toISOString(),
            status: 'working'
        });

        const hash = await redisClient.hGetAll('test_hash');

        res.json({
            status: 'success',
            message: 'Redis is working perfectly! 🚀',
            data: {
                visit_count: count,
                stored_data: hash
            }
        });
    } catch (error: any) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});
// --- REDIS TEST ROUTE END ---

// Helper tool to view users in database
app.get('/api/tools/users', async (req, res) => {
    try {
        const users = await User.find({});
        res.json(users.map(u => ({
            _id: u._id,
            username: u.username,
            email: u.email,
            isAdmin: u.isAdmin,
            role: u.role,
            createdAt: u.createdAt
        })));
    } catch (error: any) {
        console.error('Error fetching users:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/prayers', prayerRoutes);
app.use('/api/quran', quranLimiter, quranRoutes);
app.use('/api/dhikr', dhikrRoutes);
app.use('/api/zakat', zakatRoutes);
app.use('/api/maktab', maktabRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/notifications', notificationRoutes); // Use notification routes
app.use('/api/support', supportRoutes); // Use support routes
app.use('/api/activity', activityRoutes); // Use activity log routes
app.use('/api/salah-tracker', salahTrackerRoutes);
app.use('/api/hajj-guide', hajjGuideRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/users', userRoutes);

// Admin Routes for User Management (Restricted to Super Admin)
// Get All Users
app.get('/api/admin/users', authMiddleware, superAdminMiddleware, async (req: any, res: any) => {
    try {
    const users = await User.find({}, '-password'); // Exclude passwords
    const enrichedUsers = users.map((user) => {
      const rawUser = user.toObject();
      const notificationStatus = deriveUserNotificationStatus(rawUser);
      const profileHistory = Array.isArray(rawUser.profileAudit?.history) ? rawUser.profileAudit.history : [];
      const hasProfileEdits = profileHistory.length > 0;

      return {
        ...rawUser,
        ...notificationStatus,
        profileEdited: hasProfileEdits,
        profileEditedAt: rawUser.profileAudit?.lastEditedAt || (hasProfileEdits ? profileHistory[0]?.editedAt : null),
        profileEditCount: profileHistory.length,
      };
    });

        res.json({
            status: 'success',
      data: { users: enrichedUsers }
        });
    } catch (error: any) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Get detailed user profile + profile edit history
app.get('/api/admin/users/:id/profile', authMiddleware, superAdminMiddleware, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.params.id, '-password');
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const rawUser = user.toObject();
    const notificationStatus = deriveUserNotificationStatus(rawUser);
    const profileHistory = Array.isArray(rawUser.profileAudit?.history) ? rawUser.profileAudit.history : [];
    const hasProfileEdits = profileHistory.length > 0;

    return res.json({
      status: 'success',
      data: {
        user: {
          ...rawUser,
          ...notificationStatus,
          profileEdited: hasProfileEdits,
          profileEditedAt: rawUser.profileAudit?.lastEditedAt || (hasProfileEdits ? profileHistory[0]?.editedAt : null),
          profileEditCount: profileHistory.length,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// Create User (Manager/User)
app.post('/api/admin/users', authMiddleware, superAdminMiddleware, async (req: any, res: any) => {
    try {
        const { username, email, password, firstName, lastName, role } = req.body;
        
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ status: 'error', message: 'User already exists' });
        }

        const newUser = new User({
            username,
            email,
            password,
            firstName,
            lastName,
            role: role || 'user',
            isAdmin: role === 'superadmin' // Sync legacy field
        });

        await newUser.save();
        res.status(201).json({
            status: 'success',
            message: 'User created successfully',
            data: { user: newUser }
        });
    } catch (error: any) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Block/Unblock User
app.patch('/api/admin/users/:id/block', authMiddleware, superAdminMiddleware, async (req: any, res: any) => {
    try {
        if (req.params.id === req.user.userId) {
            return res.status(400).json({ status: 'error', message: 'You cannot block yourself.' });
        }
        const { isBlocked } = req.body;
        const user = await User.findByIdAndUpdate(req.params.id, { isBlocked }, { new: true });
        res.json({
            status: 'success',
            data: { user }
        });
    } catch (error: any) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Delete User
app.delete('/api/admin/users/:id', authMiddleware, superAdminMiddleware, async (req: any, res: any) => {
    try {
        if (req.params.id === req.user.userId) {
            return res.status(400).json({ status: 'error', message: 'You cannot delete yourself.' });
        }
        await User.findByIdAndDelete(req.params.id);
        res.json({
            status: 'success',
            message: 'User deleted successfully'
        });
    } catch (error: any) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});


// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Error logging middleware
app.use(errorLogger);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Seed Admin User
const seedAdminUser = async () => {
    try {
        const adminEmail = 'admin@hikmah.com';
        const adminExists = await User.findOne({ email: adminEmail });

        if (!adminExists) {
            const adminUser = new User({
                username: 'admin',
                email: adminEmail,
                password: 'copernicus', // Will be hashed by pre-save hook
                firstName: 'Admin',
                lastName: 'User',
                isAdmin: true,
                role: 'superadmin', // Set role
                security: {
                    emailVerified: true
                }
            });
            await adminUser.save();
            console.log('✅ Admin user created successfully: admin@hikmah.com (Super Admin)');
        } else {
             // Ensure admin status if user exists
             if (!adminExists.isAdmin || adminExists.role !== 'superadmin') {
                 adminExists.isAdmin = true;
                 adminExists.role = 'superadmin';
                 await adminExists.save();
                 console.log('✅ User updated to superadmin: admin@hikmah.com');
             } else {
                 console.log('✅ Admin user exists and is configured.');
             }
        }
    } catch (error) {
        console.error('Error seeding admin user:', error);
    }
};


// MongoDB connection (single shared Mongoose connection for the process)
// Local Docker / host: MONGODB_URI (or optional MONGODB_URI_LOCAL override)
// Production (Atlas on Render): MONGODB_URI=mongodb+srv://...
// Prefer optional local override, then MONGODB_URI, then unauthenticated local default
const resolveMongoUri = (): string =>
  process.env.MONGODB_URI_LOCAL ||
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/hikmahsphere';

const connectDB = async () => {
  const mongoURI = resolveMongoUri();

  const { host, database } = summarizeMongoUri(mongoURI);

  try {
    const configuredDbName =
      !database || database === '(default)' || database === '(unknown)'
        ? 'hikmahsphere'
        : database;

    const connectOptions: mongoose.ConnectOptions = {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      // Sensible pool defaults; Atlas and local Docker both work with these
      maxPoolSize: 10,
      // Atlas SRV URIs often omit the path; keep the existing app database name
      dbName: configuredDbName,
    };

    // URI already embeds credentials (Atlas / Docker auth URI) — do not override with MONGO_USER/MONGO_PASS
    const uriHasEmbeddedCredentials = /mongodb(\+srv)?:\/\/[^/@]+@/i.test(mongoURI);

    if (!uriHasEmbeddedCredentials && process.env.MONGO_USER) {
      connectOptions.user = process.env.MONGO_USER;
      connectOptions.authSource = 'admin';
    }
    if (!uriHasEmbeddedCredentials && process.env.MONGO_PASS) {
      connectOptions.pass = process.env.MONGO_PASS;
    }

    await mongoose.connect(mongoURI, connectOptions);

    logDatabaseConnection(mongoURI, mongoose.connection.name || configuredDbName);
    await seedAdminUser();
  } catch (error: any) {
    // Never log the connection string or credentials
    const message = error?.message || String(error);
    appLogger.error('database_connection_failed', {
      host,
      database,
      error: new Error(message),
    });
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  try {
    // Check Redis connection
    if (!redisClient.isOpen) {
        try {
            await redisClient.connect();
        } catch (e) {
            appLogger.warn('redis_unavailable_at_startup', {
                message: 'Redis is unavailable at startup (non-fatal)',
            });
        }
    }

    await connectDB();

    // Listen on 0.0.0.0 to allow access from other interfaces (required for VMs/external access)
    app.listen(PORT, '0.0.0.0', () => {
      logStartup(PORT, {
        database: `${summarizeMongoUri(resolveMongoUri()).host} / ${mongoose.connection.name || 'hikmahsphere'}`,
        redis: redisClient.isOpen ? 'connected' : 'unavailable',
      });
      startMeetingNotificationScheduler();
      startPrayerNotificationScheduler();
      startPrayerTimesCacheScheduler();
      startDhikrReminderScheduler();
    });
  } catch (error) {
    appLogger.error('server_start_failed', { error });
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: any) => {
  appLogger.error('unhandled_promise_rejection', { error: err });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  appLogger.error('uncaught_exception', { error: err });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  appLogger.info('shutdown_started', { signal: 'SIGTERM' });
  stopMeetingNotificationScheduler();
  stopPrayerNotificationScheduler();
  stopPrayerTimesCacheScheduler();
  stopDhikrReminderScheduler();
  await mongoose.connection.close();
  if (redisClient.isOpen) {
      await redisClient.quit();
  }
  appLogger.info('shutdown_completed', { signal: 'SIGTERM' });
  process.exit(0);
});

startServer();

export default app;
