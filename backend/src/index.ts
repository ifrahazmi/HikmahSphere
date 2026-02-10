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

// Import routes
import authRoutes from './routes/auth';
import prayerRoutes from './routes/prayers';
import quranRoutes from './routes/quran';
import zakatRoutes from './routes/zakat';
import communityRoutes from './routes/community';
import donorRoutes from './routes/donors';
import donationRoutes from './routes/donations';
import installmentRoutes from './routes/installments';

// Load environment variables
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
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
    },
  },
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
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'HikmahSphere API is running! 🕌',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

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
app.use('/api/zakat/donors', donorRoutes);
app.use('/api/zakat/donations', donationRoutes);
app.use('/api/zakat/installments', installmentRoutes);

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
    // Use Docker MongoDB or provided URI
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hikmahsphere';
    
    console.log('Connecting to MongoDB at:', mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));
    
    await mongoose.connect(mongoURI, {
      // Modern MongoDB connection options
    });
    
    console.log('🚀 MongoDB connected successfully!');
    await seedAdminUser();

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 HikmahSphere API Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/docs`);
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
  console.log('🔒 MongoDB connection closed.');
  process.exit(0);
});

startServer();

export default app;
