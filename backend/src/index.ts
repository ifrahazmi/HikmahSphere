import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';
import path from 'path';
import User from './models/User';
import { authMiddleware, superAdminMiddleware } from './middleware/auth';
import { requestLogger, errorLogger, logStartup, logDatabaseConnection } from './middleware/logger';
import redisClient from './config/redis'; // Import Redis client

// Import routes
import authRoutes from './routes/auth';
import prayerRoutes from './routes/prayers';
import quranRoutes from './routes/quran';
import zakatRoutes from './routes/zakat';
import communityRoutes from './routes/community';
import notificationRoutes from './routes/notifications'; // Import notification routes
import supportRoutes from './routes/support'; // Import support routes
import activityRoutes from './routes/activity'; // Import activity log routes

// Load environment variables
// Try to load from root .env for local development, fallback to Docker env vars
const envPath = path.join(process.cwd(), '../.env');
dotenv.config({ path: envPath });
// Also try current directory as fallback
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

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
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  validate: {
      xForwardedForHeader: false, // Disable validation if we trust proxy logic is complex
  }
});

app.use(limiter);

// CORS configuration
app.use(cors({
  origin: true, // Allow all origins for development/IDX to prevent CORS issues
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files for uploaded proofs - Works in both dev and production
// Using path.resolve for absolute path resolution
const uploadsPath = path.resolve(process.cwd(), 'src', 'uploads');
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
      zakat: '/api/zakat',
      community: '/api/community'
    },
    documentation: `http://localhost:${process.env.PORT || 5000}/docs`
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
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
app.use('/api/quran', quranRoutes);
app.use('/api/zakat', zakatRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/notifications', notificationRoutes); // Use notification routes
app.use('/api/support', supportRoutes); // Use support routes
app.use('/api/activity', activityRoutes); // Use activity log routes

// Admin Routes for User Management (Restricted to Super Admin)
// Get All Users
app.get('/api/admin/users', authMiddleware, superAdminMiddleware, async (req: any, res: any) => {
    try {
        const users = await User.find({}, '-password'); // Exclude passwords
        res.json({
            status: 'success',
            data: { users }
        });
    } catch (error: any) {
        res.status(500).json({ status: 'error', message: error.message });
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
  console.error(err.stack);

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


// MongoDB connection
const connectDB = async () => {
  try {
    // Use MONGODB_URI_LOCAL for local dev, MONGODB_URI for Docker, or default
    const mongoURI = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI || 'mongodb://localhost:27017/hikmahsphere';

    const connectOptions: mongoose.ConnectOptions = {
        authSource: "admin",
    };

    if (process.env.MONGO_USER) connectOptions.user = process.env.MONGO_USER;
    if (process.env.MONGO_PASS) connectOptions.pass = process.env.MONGO_PASS;

    await mongoose.connect(mongoURI, connectOptions);

    logDatabaseConnection(mongoURI);
    await seedAdminUser();

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  try {
    // Check Redis connection
    if (redisClient.isOpen) {
        console.log('✅ Redis connection confirmed.');
    } else {
        console.log('⚠️ Redis not yet connected, attempting...');
        try {
            await redisClient.connect();
        } catch (e) {
            console.error('⚠️ Could not connect to Redis at startup (non-fatal for now)');
        }
    }

    await connectDB();

    // Listen on 0.0.0.0 to allow access from other interfaces (required for VMs/external access)
    app.listen(PORT, '0.0.0.0', () => {
      logStartup(PORT);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: any) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  await mongoose.connection.close();
  if (redisClient.isOpen) {
      await redisClient.quit();
  }
  console.log('🔒 MongoDB and Redis connections closed.');
  process.exit(0);
});

startServer();

export default app;
