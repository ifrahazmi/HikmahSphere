// src/routes/notifications.ts

import express, { Request, Response } from 'express';
import User from '../models/User';
import { authMiddleware, superAdminMiddleware } from '../middleware/auth';
import { sendMulticastNotification } from '../config/firebaseAdmin'; // Use the helper directly

const router = express.Router();
const INVALID_TOKEN_ERROR_CODES = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
]);

const createNotificationId = () => `notif-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const removeInvalidTokens = async (tokens: string[], responses: Array<{ success: boolean; error?: { code?: string } }>) => {
    const invalidTokens = tokens.filter((token, index) => {
        const response = responses[index];
        return !response?.success && response?.error?.code && INVALID_TOKEN_ERROR_CODES.has(response.error.code);
    });

    if (invalidTokens.length === 0) {
        return;
    }

    await User.updateMany(
        {},
        {
            $pull: {
                fcmTokens: { $in: invalidTokens },
                notificationDevices: { token: { $in: invalidTokens } },
            },
        }
    );
};

// Store FCM Token for the authenticated user
router.post('/token', authMiddleware, async (req: any, res: Response) => {
    try {
        const { token, deviceId, userAgent } = req.body;
        if (!token) {
            res.status(400).json({ status: 'error', message: 'Token is required' });
            return;
        }

        const userId = req.user.userId;

        await User.updateMany(
            { _id: { $ne: userId } },
            {
                $pull: {
                    fcmTokens: token,
                    notificationDevices: { token },
                },
            }
        );

        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ status: 'error', message: 'User not found' });
            return;
        }

        const existingTokens = Array.isArray(user.fcmTokens)
            ? user.fcmTokens.filter((existingToken): existingToken is string => typeof existingToken === 'string' && existingToken.length > 0)
            : [];
        const existingDevices = Array.isArray(user.notificationDevices)
            ? user.notificationDevices.filter((device) => device && typeof device.token === 'string' && typeof device.deviceId === 'string')
            : [];

        if (deviceId && typeof deviceId === 'string') {
            const filteredDevices = existingDevices.filter(
                (device) => device.deviceId !== deviceId && device.token !== token
            );

            const nextDeviceEntry: {
                deviceId: string;
                token: string;
                userAgent?: string;
                updatedAt: Date;
            } = {
                deviceId,
                token,
                updatedAt: new Date(),
            };
            if (typeof userAgent === 'string' && userAgent.trim().length > 0) {
                nextDeviceEntry.userAgent = userAgent.slice(0, 500);
            }

            filteredDevices.push(nextDeviceEntry);

            user.notificationDevices = filteredDevices;
            user.fcmTokens = [...new Set([
                ...filteredDevices.map((device) => device.token),
                ...existingTokens.filter((existingToken) => !filteredDevices.some((device) => device.token === existingToken)),
            ])];
        } else {
            user.fcmTokens = [...new Set([...existingTokens, token])];
        }

        await user.save();

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
        const { token, deviceId } = req.body;
        if (!token && !deviceId) {
            res.status(400).json({ status: 'error', message: 'Token or deviceId is required' });
            return;
        }

        const userId = req.user.userId;

        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ status: 'error', message: 'User not found' });
            return;
        }

        const nextDevices = Array.isArray(user.notificationDevices)
            ? user.notificationDevices.filter((device) => {
                if (deviceId && device.deviceId === deviceId) {
                    return false;
                }
                if (token && device.token === token) {
                    return false;
                }
                return true;
            })
            : [];

        user.notificationDevices = nextDevices;
        user.fcmTokens = (Array.isArray(user.fcmTokens) ? user.fcmTokens : []).filter((existingToken) => {
            if (token && existingToken === token) {
                return false;
            }
            if (deviceId) {
                return nextDevices.some((device) => device.token === existingToken);
            }
            return true;
        });

        await user.save();

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

        const notificationId = createNotificationId();
        const response = await sendMulticastNotification(tokens, title, body, {
            ...data,
            notificationId,
        });
        await removeInvalidTokens(tokens, response.responses);
        
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
        const notificationId = createNotificationId();

        for (let i = 0; i < allTokens.length; i += batchSize) {
            const batchTokens = allTokens.slice(i, i + batchSize);
            console.log(`🚀 Sending batch ${i / batchSize + 1} with ${batchTokens.length} tokens...`);
            
            try {
                const response = await sendMulticastNotification(batchTokens, title, body, {
                    ...data,
                    notificationId,
                });
                successCount += response.successCount;
                failureCount += response.failureCount;
                await removeInvalidTokens(batchTokens, response.responses);
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
