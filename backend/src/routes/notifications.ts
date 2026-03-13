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

type NormalizedNotificationDevice = {
    deviceId: string;
    token: string;
    userAgent?: string;
    updatedAt: Date;
};

const normalizeNonEmptyString = (value: unknown): string | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : null;
};

const extractUniqueTokens = (tokens: unknown): string[] => {
    if (!Array.isArray(tokens)) {
        return [];
    }

    const uniqueTokens = new Set<string>();
    for (const token of tokens) {
        const normalizedToken = normalizeNonEmptyString(token);
        if (normalizedToken) {
            uniqueTokens.add(normalizedToken);
        }
    }

    return Array.from(uniqueTokens);
};

const normalizeNotificationDevices = (devices: unknown): NormalizedNotificationDevice[] => {
    if (!Array.isArray(devices)) {
        return [];
    }

    const normalizedDevices: NormalizedNotificationDevice[] = [];
    const seenDevices = new Set<string>();

    for (const device of devices) {
        const normalizedToken = normalizeNonEmptyString((device as any)?.token);
        const normalizedDeviceId = normalizeNonEmptyString((device as any)?.deviceId);

        if (!normalizedToken || !normalizedDeviceId) {
            continue;
        }

        const dedupeKey = `${normalizedDeviceId}|${normalizedToken}`;
        if (seenDevices.has(dedupeKey)) {
            continue;
        }
        seenDevices.add(dedupeKey);

        const normalizedUpdatedAt = new Date((device as any)?.updatedAt ?? 0);
        const normalizedDevice: NormalizedNotificationDevice = {
            deviceId: normalizedDeviceId,
            token: normalizedToken,
            updatedAt: Number.isNaN(normalizedUpdatedAt.getTime()) ? new Date(0) : normalizedUpdatedAt,
        };
        const normalizedUserAgent = normalizeNonEmptyString((device as any)?.userAgent);
        if (normalizedUserAgent) {
            normalizedDevice.userAgent = normalizedUserAgent;
        }

        normalizedDevices.push(normalizedDevice);
    }

    normalizedDevices.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return normalizedDevices;
};

const resolveSingleDeliveryTarget = (user: {
    fcmTokens?: unknown;
    notificationDevices?: unknown;
}): {
    token: string | null;
    tokens: string[];
    devices: NormalizedNotificationDevice[];
} => {
    const normalizedDevices = normalizeNotificationDevices(user.notificationDevices);
    const normalizedTokens = extractUniqueTokens(user.fcmTokens);
    const preferredToken = normalizedDevices[0]?.token || normalizedTokens[0] || null;

    if (!preferredToken) {
        return {
            token: null,
            tokens: [],
            devices: [],
        };
    }

    const preferredDevice = normalizedDevices.find((device) => device.token === preferredToken);

    return {
        token: preferredToken,
        tokens: [preferredToken],
        devices: preferredDevice ? [preferredDevice] : [],
    };
};

const areDevicesEqual = (first: NormalizedNotificationDevice, second: NormalizedNotificationDevice): boolean => {
    return (
        first.deviceId === second.deviceId &&
        first.token === second.token &&
        (first.userAgent || '') === (second.userAgent || '') &&
        first.updatedAt.getTime() === second.updatedAt.getTime()
    );
};

const shouldUpdateStoredTargets = (
    user: {
        fcmTokens?: unknown;
        notificationDevices?: unknown;
    },
    nextTokens: string[],
    nextDevices: NormalizedNotificationDevice[]
): boolean => {
    const currentTokens = extractUniqueTokens(user.fcmTokens);
    const currentDevices = normalizeNotificationDevices(user.notificationDevices);

    if (
        currentTokens.length !== nextTokens.length ||
        currentTokens.some((currentToken, index) => currentToken !== nextTokens[index])
    ) {
        return true;
    }

    if (currentDevices.length !== nextDevices.length) {
        return true;
    }

    for (let index = 0; index < currentDevices.length; index += 1) {
        const currentDevice = currentDevices[index];
        const nextDevice = nextDevices[index];
        if (!currentDevice || !nextDevice || !areDevicesEqual(currentDevice, nextDevice)) {
            return true;
        }
    }

    return false;
};

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
        const normalizedToken = normalizeNonEmptyString(token);
        if (!normalizedToken) {
            res.status(400).json({ status: 'error', message: 'Token is required' });
            return;
        }
        const normalizedDeviceId = normalizeNonEmptyString(deviceId);
        const normalizedUserAgent = normalizeNonEmptyString(userAgent);

        const userId = req.user.userId;

        await User.updateMany(
            { _id: { $ne: userId } },
            {
                $pull: {
                    fcmTokens: normalizedToken,
                    notificationDevices: { token: normalizedToken },
                },
            }
        );

        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ status: 'error', message: 'User not found' });
            return;
        }

        const latestDeviceEntry = normalizedDeviceId
            ? [{
                deviceId: normalizedDeviceId,
                token: normalizedToken,
                ...(normalizedUserAgent ? { userAgent: normalizedUserAgent.slice(0, 500) } : {}),
                updatedAt: new Date(),
            }]
            : [];

        // Single-latest-token policy:
        // keep exactly one active key per user to avoid duplicate delivery.
        user.notificationDevices = latestDeviceEntry;
        user.fcmTokens = [normalizedToken];

        await user.save();

        console.log(`✅ Token stored for user ${userId} (single-latest-token policy)`);
        res.json({
            status: 'success',
            message: 'Token registered successfully',
            tokenPolicy: 'single-latest',
        });
    } catch (error: any) {
        console.error('Error saving FCM token:', error);
        res.status(500).json({ status: 'error', message: 'Failed to save token' });
    }
});

// Remove FCM Token
router.delete('/token', authMiddleware, async (req: any, res: Response) => {
    try {
        const { token, deviceId } = req.body;
        const normalizedToken = normalizeNonEmptyString(token);
        const normalizedDeviceId = normalizeNonEmptyString(deviceId);

        if (!normalizedToken && !normalizedDeviceId) {
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
                if (normalizedDeviceId && device.deviceId === normalizedDeviceId) {
                    return false;
                }
                if (normalizedToken && device.token === normalizedToken) {
                    return false;
                }
                return true;
            })
            : [];

        user.notificationDevices = nextDevices;
        user.fcmTokens = (Array.isArray(user.fcmTokens) ? user.fcmTokens : []).filter((existingToken) => {
            if (normalizedToken && existingToken === normalizedToken) {
                return false;
            }
            if (normalizedDeviceId) {
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

        const { token: deliveryToken, tokens: normalizedTokens, devices: normalizedDevices } = resolveSingleDeliveryTarget(user);
        if (shouldUpdateStoredTargets(user, normalizedTokens, normalizedDevices)) {
            user.fcmTokens = normalizedTokens;
            user.notificationDevices = normalizedDevices;
            await user.save();
        }

        const tokens = deliveryToken ? [deliveryToken] : [];

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

        // 1. Get all users with at least one notification key.
        const users = await User.find({
            $or: [
                { fcmTokens: { $exists: true, $not: { $size: 0 } } },
                { notificationDevices: { $exists: true, $not: { $size: 0 } } },
            ],
        }).select('fcmTokens notificationDevices username');
        
        console.log(`🔎 Found ${users.length} users with tokens.`);

        const allTokens: string[] = [];
        const bulkNormalizationOperations: Array<{
            updateOne: {
                filter: { _id: unknown };
                update: {
                    $set: {
                        fcmTokens: string[];
                        notificationDevices: NormalizedNotificationDevice[];
                    };
                };
            };
        }> = [];

        for (const user of users) {
            const { token: deliveryToken, tokens: normalizedTokens, devices: normalizedDevices } = resolveSingleDeliveryTarget(user);
            if (deliveryToken) {
                allTokens.push(deliveryToken);
            }

            if (shouldUpdateStoredTargets(user, normalizedTokens, normalizedDevices)) {
                bulkNormalizationOperations.push({
                    updateOne: {
                        filter: { _id: user._id },
                        update: {
                            $set: {
                                fcmTokens: normalizedTokens,
                                notificationDevices: normalizedDevices,
                            },
                        },
                    },
                });
            }
        }

        if (bulkNormalizationOperations.length > 0) {
            await User.bulkWrite(bulkNormalizationOperations, { ordered: false });
            console.log(`🧹 Normalized legacy notification keys for ${bulkNormalizationOperations.length} users.`);
        }

        // Deduplicate tokens
        const uniqueDeliveryTokens = [...new Set(allTokens)];

        console.log(`📝 Total unique tokens to send to: ${uniqueDeliveryTokens.length}`);

        if (uniqueDeliveryTokens.length === 0) {
            res.json({ status: 'success', message: 'No valid devices found to receive broadcast.' });
            return;
        }

        // 2. Batch send (Firebase limit is 500 per batch)
        const batchSize = 500;
        let successCount = 0;
        let failureCount = 0;
        const notificationId = createNotificationId();

        for (let i = 0; i < uniqueDeliveryTokens.length; i += batchSize) {
            const batchTokens = uniqueDeliveryTokens.slice(i, i + batchSize);
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
