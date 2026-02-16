// src/routes/notifications.ts

import express, { Request, Response } from 'express';
import User from '../models/User';
import { authMiddleware, superAdminMiddleware } from '../middleware/auth';
import { sendMulticastNotification } from '../config/firebaseAdmin'; // Use the helper directly

const router = express.Router();

// Store FCM Token for the authenticated user
router.post('/token', authMiddleware, async (req: any, res: Response) => {
    try {
        const { token } = req.body;
        if (!token) {
            res.status(400).json({ status: 'error', message: 'Token is required' });
            return;
        }

        const userId = req.user.userId;
        
        await User.findByIdAndUpdate(userId, {
            $addToSet: { fcmTokens: token }
        });

        console.log(`✅ Token stored for user ${userId}`);
        res.json({ status: 'success', message: 'Token registered successfully' });
    } catch (error: any) {
        console.error('Error saving FCM token:', error);
        res.status(500).json({ status: 'error', message: 'Failed to save token' });
    }
});

// Remove FCM Token
router.delete('/token', authMiddleware, async (req: any, res: Response) => {
    try {
        const { token } = req.body;
        if (!token) {
            res.status(400).json({ status: 'error', message: 'Token is required' });
            return;
        }

        const userId = req.user.userId;

        await User.findByIdAndUpdate(userId, {
            $pull: { fcmTokens: token }
        });

        res.json({ status: 'success', message: 'Token removed successfully' });
    } catch (error: any) {
        console.error('Error removing FCM token:', error);
        res.status(500).json({ status: 'error', message: 'Failed to remove token' });
    }
});

// --- ADMIN ROUTES ---

// Send direct notification to a specific user
router.post('/send-user', authMiddleware, superAdminMiddleware, async (req: any, res: Response) => {
    try {
        const { userId, title, body, data } = req.body;

        if (!userId || !title || !body) {
            res.status(400).json({ status: 'error', message: 'UserId, title, and body are required' });
            return;
        }

        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ status: 'error', message: 'User not found' });
            return;
        }

        const tokens: string[] = user.fcmTokens?.filter((t): t is string => typeof t === 'string') || [];

        if (tokens.length === 0) {
            res.status(404).json({ status: 'error', message: 'User has no valid registered devices' });
            return;
        }

        const response = await sendMulticastNotification(tokens, title, body, data);
        
        // Cleanup logic would go here based on response.responses

        res.json({ 
            status: 'success', 
            message: `Sent ${response.successCount} messages, failed ${response.failureCount}`,
            details: {
                successCount: response.successCount,
                failureCount: response.failureCount
            }
        });

    } catch (error: any) {
        console.error('Error sending user notification:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Broadcast to all users
router.post('/broadcast', authMiddleware, superAdminMiddleware, async (req: any, res: Response) => {
    try {
        const { title, body, data } = req.body;

        if (!title || !body) {
            res.status(400).json({ status: 'error', message: 'Title and body are required' });
            return;
        }

        console.log("📢 Starting broadcast...");

        // 1. Get all users with at least one token
        const users = await User.find({ 
            fcmTokens: { $exists: true, $not: { $size: 0 } } 
        }).select('fcmTokens username');
        
        console.log(`🔎 Found ${users.length} users with tokens.`);

        let allTokens: string[] = [];
        users.forEach(u => {
            if (u.fcmTokens) {
                const validTokens = u.fcmTokens.filter((t): t is string => typeof t === 'string' && t.length > 0);
                allTokens.push(...validTokens);
            }
        });

        // Deduplicate tokens
        allTokens = [...new Set(allTokens)];

        console.log(`📝 Total unique tokens to send to: ${allTokens.length}`);

        if (allTokens.length === 0) {
            res.json({ status: 'success', message: 'No valid devices found to receive broadcast.' });
            return;
        }

        // 2. Batch send (Firebase limit is 500 per batch)
        const batchSize = 500;
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < allTokens.length; i += batchSize) {
            const batchTokens = allTokens.slice(i, i + batchSize);
            console.log(`🚀 Sending batch ${i / batchSize + 1} with ${batchTokens.length} tokens...`);
            
            try {
                const response = await sendMulticastNotification(batchTokens, title, body, data);
                successCount += response.successCount;
                failureCount += response.failureCount;
            } catch (err) {
                console.error("❌ Batch send failed:", err);
            }
        }

        console.log(`✅ Broadcast complete. Success: ${successCount}, Failed: ${failureCount}`);

        res.json({ 
            status: 'success', 
            message: `Broadcast sent. Success: ${successCount}, Failed: ${failureCount}` 
        });

    } catch (error: any) {
        console.error('❌ Error broadcasting notification:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

export default router;
