// src/routes/notifications.ts

import express, { Response } from 'express';
import User from '../models/User';
import UserNotification from '../models/UserNotification';
import { authMiddleware, superAdminMiddleware } from '../middleware/auth';
import { isFirebaseAdminReady, sendMulticastNotification } from '../config/firebaseAdmin';

const router = express.Router();
const INVALID_TOKEN_ERROR_CODES = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
]);

const createNotificationId = () => `notif-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

type NormalizedNotificationDevice = {
    deviceId: string;
    token?: string;
    userAgent?: string;
    permission?: 'granted' | 'denied' | 'default' | 'unknown';
    supportsWebPush?: boolean;
    isIOS?: boolean;
    isStandalone?: boolean;
    lastSeenAt?: Date;
    lastActiveAt?: Date;
    visibilityState?: 'visible' | 'hidden' | 'prerender' | 'unknown';
    isOnline?: boolean;
    updatedAt: Date;
};

type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unknown';

type DeviceCapabilityInput = {
    supportsWebPush?: boolean;
    isIOS?: boolean;
    isStandalone?: boolean;
};

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const RECENTLY_SEEN_WINDOW_MS = 30 * 60 * 1000;

const normalizeNonEmptyString = (value: unknown): string | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : null;
};

const normalizePermission = (value: unknown): NotificationPermissionState => {
    if (value === 'granted' || value === 'denied' || value === 'default') {
        return value;
    }
    return 'unknown';
};

const normalizeCapability = (value: unknown): DeviceCapabilityInput => {
    const raw = (value && typeof value === 'object') ? value as Record<string, unknown> : {};
    return {
        supportsWebPush: raw.supportsWebPush === true,
        isIOS: raw.isIOS === true,
        isStandalone: raw.isStandalone === true,
    };
};

const normalizeVisibilityState = (
    value: unknown
): 'visible' | 'hidden' | 'prerender' | 'unknown' => {
    if (value === 'visible' || value === 'hidden' || value === 'prerender') {
        return value;
    }
    return 'unknown';
};

const normalizeDateOrNow = (value: unknown): Date => {
    const parsed = new Date(value as string | number | Date);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
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

        if (!normalizedDeviceId) {
            continue;
        }

        const dedupeKey = normalizedDeviceId;
        if (seenDevices.has(dedupeKey)) {
            continue;
        }
        seenDevices.add(dedupeKey);

        const normalizedUpdatedAt = new Date((device as any)?.updatedAt ?? 0);
        const normalizedDevice: NormalizedNotificationDevice = {
            deviceId: normalizedDeviceId,
            permission: normalizePermission((device as any)?.permission),
            supportsWebPush: (device as any)?.supportsWebPush === true,
            isIOS: (device as any)?.isIOS === true,
            isStandalone: (device as any)?.isStandalone === true,
            lastSeenAt: normalizeDateOrNow((device as any)?.lastSeenAt),
            visibilityState: normalizeVisibilityState((device as any)?.visibilityState),
            isOnline: (device as any)?.isOnline !== false,
            updatedAt: Number.isNaN(normalizedUpdatedAt.getTime()) ? new Date(0) : normalizedUpdatedAt,
        };
        if (normalizedToken) {
            normalizedDevice.token = normalizedToken;
        }
        if ((device as any)?.lastActiveAt) {
            normalizedDevice.lastActiveAt = normalizeDateOrNow((device as any).lastActiveAt);
        }
        const normalizedUserAgent = normalizeNonEmptyString((device as any)?.userAgent);
        if (normalizedUserAgent) {
            normalizedDevice.userAgent = normalizedUserAgent;
        }

        normalizedDevices.push(normalizedDevice);
    }

    normalizedDevices.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return normalizedDevices;
};

export const mergeHeartbeatDevice = (
    devices: unknown,
    update: {
        deviceId: string;
        permission: NotificationPermissionState;
        capability: DeviceCapabilityInput;
        heartbeatAt: Date;
        visibilityState: unknown;
        isOnline: unknown;
    }
): NormalizedNotificationDevice[] => {
    const currentDevices = normalizeNotificationDevices(devices);
    const deviceIndex = currentDevices.findIndex(
        (device) => device.deviceId === update.deviceId
    );
    const visibilityState = normalizeVisibilityState(update.visibilityState);
    const nextDevice: NormalizedNotificationDevice =
        deviceIndex >= 0 && currentDevices[deviceIndex]
            ? currentDevices[deviceIndex]!
            : {
                deviceId: update.deviceId,
                updatedAt: new Date(),
            };

    nextDevice.permission = update.permission;
    nextDevice.supportsWebPush = update.capability.supportsWebPush === true;
    nextDevice.isIOS = update.capability.isIOS === true;
    nextDevice.isStandalone = update.capability.isStandalone === true;
    nextDevice.lastSeenAt = update.heartbeatAt;
    if (visibilityState === 'visible') {
        nextDevice.lastActiveAt = update.heartbeatAt;
    }
    nextDevice.visibilityState = visibilityState;
    nextDevice.isOnline = update.isOnline !== false;
    nextDevice.updatedAt = new Date();

    if (deviceIndex >= 0) {
        currentDevices[deviceIndex] = nextDevice;
    } else {
        currentDevices.unshift(nextDevice);
    }
    return currentDevices;
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
    const preferredToken =
        normalizedDevices.find((device) => Boolean(device.token))?.token ||
        normalizedTokens[0] ||
        null;

    if (!preferredToken) {
        return {
            token: null,
            tokens: [],
            devices: [],
        };
    }

    return {
        token: preferredToken,
        tokens: [preferredToken],
        devices: normalizedDevices,
    };
};

const areDevicesEqual = (first: NormalizedNotificationDevice, second: NormalizedNotificationDevice): boolean => {
    return (
        first.deviceId === second.deviceId &&
        (first.token || '') === (second.token || '') &&
        (first.userAgent || '') === (second.userAgent || '') &&
        (first.permission || 'unknown') === (second.permission || 'unknown') &&
        Boolean(first.supportsWebPush) === Boolean(second.supportsWebPush) &&
        Boolean(first.isIOS) === Boolean(second.isIOS) &&
        Boolean(first.isStandalone) === Boolean(second.isStandalone) &&
        (first.lastSeenAt?.getTime() || 0) === (second.lastSeenAt?.getTime() || 0) &&
        (first.lastActiveAt?.getTime() || 0) === (second.lastActiveAt?.getTime() || 0) &&
        (first.visibilityState || 'unknown') === (second.visibilityState || 'unknown') &&
        Boolean(first.isOnline) === Boolean(second.isOnline) &&
        first.updatedAt.getTime() === second.updatedAt.getTime()
    );
};

export const deriveNotificationStatus = (user: {
    notificationPermission?: NotificationPermissionState;
    preferences?: { notifications?: { prayers?: boolean; events?: boolean; community?: boolean } };
    notificationDevices?: unknown;
}): {
    permission: NotificationPermissionState;
    preferences: { prayers: boolean; events: boolean; community: boolean };
    hasValidNotificationDevice: boolean;
    isLive: boolean;
    isActive: boolean;
    isRecentlySeen: boolean;
    lastSeenAt: Date | null;
    lastActiveAt: Date | null;
} => {
    const devices = normalizeNotificationDevices(user.notificationDevices);
    const now = Date.now();

    const hasValidNotificationDevice = devices.some((device) => {
        const permission = device.permission || user.notificationPermission || 'unknown';
        const iosBlocked = Boolean(device.isIOS) && !device.isStandalone;
        return permission === 'granted' && Boolean(device.token) && Boolean(device.supportsWebPush) && !iosBlocked;
    });

    const latestSeen = devices.reduce<Date | null>((latest, device) => {
        const seenAt = device.lastSeenAt || device.updatedAt;
        if (!latest) {
            return seenAt;
        }
        return seenAt.getTime() > latest.getTime() ? seenAt : latest;
    }, null);

    const latestActive = devices.reduce<Date | null>((latest, device) => {
        const activeAt = device.lastActiveAt || null;
        if (!activeAt || (latest && activeAt.getTime() <= latest.getTime())) return latest;
        return activeAt;
    }, null);
    const isActive = Boolean(latestActive && (now - latestActive.getTime()) <= ACTIVE_WINDOW_MS);
    const isRecentlySeen = Boolean(
        latestSeen && (now - latestSeen.getTime()) <= RECENTLY_SEEN_WINDOW_MS
    );
    const preferences = {
        prayers: user.preferences?.notifications?.prayers !== false,
        events: user.preferences?.notifications?.events !== false,
        community: user.preferences?.notifications?.community !== false,
    };

    return {
        permission: user.notificationPermission || devices[0]?.permission || 'unknown',
        preferences,
        hasValidNotificationDevice,
        isLive: isActive,
        isActive,
        isRecentlySeen,
        lastSeenAt: latestSeen,
        lastActiveAt: latestActive,
    };
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

const persistNotificationsForUsers = async (
    userIds: Array<string | { toString: () => string }>,
    title: string,
    body: string,
    data: Record<string, string> | undefined,
    source: 'admin-direct' | 'admin-broadcast'
) => {
    if (!Array.isArray(userIds) || userIds.length === 0) {
        return;
    }

    const uniqueIds = Array.from(new Set(userIds.map((id) => id.toString())));
    const rows = uniqueIds.map((userId) => ({
        userId,
        title,
        body,
        data: data || {},
        source,
        read: false,
    }));

    await UserNotification.insertMany(rows, { ordered: false });
};

// Get current user notification history
router.get('/history', authMiddleware, async (req: any, res: Response) => {
    try {
        const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 300);
        const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);

        const [rows, total] = await Promise.all([
            UserNotification.find({ userId: req.user.userId })
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip((page - 1) * limit)
                .lean(),
            UserNotification.countDocuments({ userId: req.user.userId }),
        ]);

        const unreadCount = await UserNotification.countDocuments({ userId: req.user.userId, read: false });

        res.json({
            status: 'success',
            data: {
                notifications: rows,
                unreadCount,
                pagination: {
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error: any) {
        console.error('Error fetching notification history:', error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch notification history' });
    }
});

// Mark one notification as read
router.patch('/history/:id/read', authMiddleware, async (req: any, res: Response) => {
    try {
        const updated = await UserNotification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { $set: { read: true, readAt: new Date() } },
            { new: true }
        );

        if (!updated) {
            res.status(404).json({ status: 'error', message: 'Notification not found' });
            return;
        }

        res.json({ status: 'success', data: { notification: updated } });
    } catch (error: any) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ status: 'error', message: 'Failed to update notification' });
    }
});

// Mark all notifications as read for current user
router.patch('/history/read-all', authMiddleware, async (req: any, res: Response) => {
    try {
        await UserNotification.updateMany(
            { userId: req.user.userId, read: false },
            { $set: { read: true, readAt: new Date() } }
        );
        res.json({ status: 'success', message: 'All notifications marked as read' });
    } catch (error: any) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ status: 'error', message: 'Failed to update notifications' });
    }
});

// Delete one notification for current user
router.delete('/history/:id', authMiddleware, async (req: any, res: Response) => {
    try {
        const deleted = await UserNotification.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.userId,
        });

        if (!deleted) {
            res.status(404).json({ status: 'error', message: 'Notification not found' });
            return;
        }

        res.json({ status: 'success', message: 'Notification deleted' });
    } catch (error: any) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ status: 'error', message: 'Failed to delete notification' });
    }
});

// Store FCM Token for the authenticated user
router.post('/token', authMiddleware, async (req: any, res: Response) => {
    try {
        const {
            token,
            deviceId,
            userAgent,
            permission,
            capability,
            heartbeatAt,
            visibilityState,
        } = req.body;
        const normalizedToken = normalizeNonEmptyString(token);
        if (!normalizedToken) {
            res.status(400).json({ status: 'error', message: 'Token is required' });
            return;
        }
        const normalizedDeviceId = normalizeNonEmptyString(deviceId);
        const normalizedUserAgent = normalizeNonEmptyString(userAgent);
        const normalizedPermission = normalizePermission(permission);
        const normalizedCapability = normalizeCapability(capability);
        const normalizedHeartbeatAt = normalizeDateOrNow(heartbeatAt);

        const userId = req.user.userId;

        // Remove this token from all other users (prevent duplicates across accounts)
        await User.updateMany(
            { _id: { $ne: userId } },
            {
                $pull: {
                    fcmTokens: normalizedToken,
                    notificationDevices: { token: normalizedToken },
                },
            }
        );

        const user = await User.findById(userId).select('notificationDevices');
        if (!user) {
            res.status(404).json({ status: 'error', message: 'User not found' });
            return;
        }

        const now = new Date();
        const currentDevices = normalizeNotificationDevices(user.notificationDevices)
            .filter((device) => device.deviceId !== normalizedDeviceId)
            .map(({ token: _token, ...device }) => device);
        const latestDeviceEntry: NormalizedNotificationDevice[] = normalizedDeviceId
            ? [{
                deviceId: normalizedDeviceId,
                token: normalizedToken,
                ...(normalizedUserAgent ? { userAgent: normalizedUserAgent.slice(0, 500) } : {}),
                permission: normalizedPermission,
                supportsWebPush: normalizedCapability.supportsWebPush === true,
                isIOS: normalizedCapability.isIOS === true,
                isStandalone: normalizedCapability.isStandalone === true,
                lastSeenAt: normalizedHeartbeatAt,
                ...(normalizeVisibilityState(visibilityState) === 'visible'
                    ? { lastActiveAt: normalizedHeartbeatAt }
                    : {}),
                visibilityState: normalizeVisibilityState(visibilityState),
                isOnline: true,
                updatedAt: now,
            }]
            : [];

        // Single-latest-token policy:
        // keep exactly one active key per user to avoid duplicate delivery, while
        // retaining tokenless device shells for presence/capability diagnostics.
        // A targeted update instead of save() so unrelated legacy fields on the
        // account cannot make push registration fail.
        await User.updateOne(
            { _id: userId },
            {
                $set: {
                    notificationDevices: [...latestDeviceEntry, ...currentDevices],
                    fcmTokens: [normalizedToken],
                    notificationPermission: normalizedPermission,
                    notificationPermissionUpdatedAt: now,
                },
            }
        );

        console.log(`✅ Token stored for user ${userId} (single-latest-token policy)`);
        console.log(`   Token: ${normalizedToken.substring(0, 20)}...`);
        console.log(`   Device ID: ${normalizedDeviceId || 'N/A'}`);
        console.log(`   User Agent: ${normalizedUserAgent ? normalizedUserAgent.substring(0, 50) + '...' : 'N/A'}`);
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

router.post('/heartbeat', authMiddleware, async (req: any, res: Response) => {
    try {
        const {
            deviceId,
            permission,
            capability,
            heartbeatAt,
            visibilityState,
            isOnline,
        } = req.body;
        const normalizedDeviceId = normalizeNonEmptyString(deviceId);
        if (!normalizedDeviceId) {
            res.status(400).json({ status: 'error', message: 'deviceId is required' });
            return;
        }

        const normalizedPermission = normalizePermission(permission);
        const normalizedCapability = normalizeCapability(capability);
        const normalizedHeartbeatAt = normalizeDateOrNow(heartbeatAt);
        const user = await User.findById(req.user.userId).select('notificationDevices');

        if (!user) {
            res.status(404).json({ status: 'error', message: 'User not found' });
            return;
        }

        const mergedDevices = mergeHeartbeatDevice(user.notificationDevices, {
            deviceId: normalizedDeviceId,
            permission: normalizedPermission,
            capability: normalizedCapability,
            heartbeatAt: normalizedHeartbeatAt,
            visibilityState,
            isOnline,
        });

        // Heartbeats run every minute per device, so write only these fields.
        // save() would validate the whole account and let unrelated data break presence.
        await User.updateOne(
            { _id: req.user.userId },
            {
                $set: {
                    notificationDevices: mergedDevices,
                    notificationPermission: normalizedPermission,
                    notificationPermissionUpdatedAt: new Date(),
                },
            }
        );

        res.json({ status: 'success', message: 'Heartbeat updated' });
    } catch (error: any) {
        console.error('Error updating heartbeat:', error);
        res.status(500).json({ status: 'error', message: 'Failed to update heartbeat' });
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

// Search users by username (for admin notification panel)
router.get('/search-users', authMiddleware, superAdminMiddleware, async (req: any, res: Response) => {
    try {
        const { query } = req.query;
        
        if (!query || typeof query !== 'string') {
            res.status(400).json({ status: 'error', message: 'Search query is required' });
            return;
        }

        // Search for users with username starting with or containing the query
        const searchRegex = new RegExp(query, 'i'); // Case-insensitive
        const users = await User.find({
            username: searchRegex
        })
        .select('username email _id notificationPermission notificationDevices preferences.notifications')
        .limit(10); // Limit to 10 suggestions

        const formattedUsers = users.map(user => ({
            id: user._id,
            username: user.username,
            email: user.email,
            ...deriveNotificationStatus(user),
        }));

        res.json({
            status: 'success',
            data: formattedUsers
        });
    } catch (error: any) {
        console.error('Error searching users:', error);
        res.status(500).json({ status: 'error', message: 'Failed to search users' });
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
        if (!isFirebaseAdminReady()) {
            res.status(503).json({
                status: 'error',
                message: 'Push service is not configured on the backend.',
            });
            return;
        }

        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ status: 'error', message: 'User not found' });
            return;
        }

        const { token: deliveryToken, tokens: normalizedTokens, devices: normalizedDevices } = resolveSingleDeliveryTarget(user);
        const deliveryStatus = deriveNotificationStatus(user);
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
        await persistNotificationsForUsers([userId], title, body, {
            ...(data || {}),
            notificationId,
        }, 'admin-direct');

        const response = await sendMulticastNotification(tokens, title, body, {
            ...data,
            notificationId,
        }, { dataOnly: true });
        await removeInvalidTokens(tokens, response.responses);

        res.json({ 
            status: 'success', 
            message: `Sent ${response.successCount} messages, failed ${response.failureCount}`,
            details: {
                successCount: response.successCount,
                failureCount: response.failureCount,
                notificationStatus: deliveryStatus,
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
        if (!isFirebaseAdminReady()) {
            res.status(503).json({
                status: 'error',
                message: 'Push service is not configured on the backend.',
            });
            return;
        }

        console.log("📢 Starting broadcast...");

        // Broadcast history is an in-app notification for every user. Push is an
        // additional delivery channel only for users with a valid token.
        const users = await User.find({}).select('fcmTokens notificationDevices username');
        
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
            
            // Log user agent info for debugging iOS issues
            const firstDevice = normalizedDevices[0];
            const userAgent = firstDevice?.userAgent || '';
            const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
            if (isIOS) {
                console.log(`📱 iOS user found: ${user.username || 'unknown'}, token: ${deliveryToken ? deliveryToken.substring(0, 20) + '...' : 'NONE'}`);
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
            const notificationId = createNotificationId();
            await persistNotificationsForUsers(
                users.map((user) => user._id),
                title,
                body,
                { ...(data || {}), notificationId },
                'admin-broadcast'
            );
            res.status(207).json({
                status: 'partial',
                message: 'Saved in-app for all users, but no push-ready devices were found.',
                details: {
                    recipients: users.length,
                    pushReadyDevices: 0,
                    successCount: 0,
                    failureCount: 0,
                },
            });
            return;
        }

        // 2. Batch send (Firebase limit is 500 per batch)
        const batchSize = 500;
        let successCount = 0;
        let failureCount = 0;
        const notificationId = createNotificationId();

        await persistNotificationsForUsers(
            users.map((user) => user._id),
            title,
            body,
            {
                ...(data || {}),
                notificationId,
            },
            'admin-broadcast'
        );

        for (let i = 0; i < uniqueDeliveryTokens.length; i += batchSize) {
            const batchTokens = uniqueDeliveryTokens.slice(i, i + batchSize);
            console.log(`🚀 Sending batch ${i / batchSize + 1} with ${batchTokens.length} tokens...`);
            
            try {
                const response = await sendMulticastNotification(batchTokens, title, body, {
                    ...data,
                    notificationId,
                }, { dataOnly: true });
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
            message: `Broadcast sent. Success: ${successCount}, Failed: ${failureCount}`,
            details: {
                recipients: users.length,
                pushReadyDevices: uniqueDeliveryTokens.length,
                successCount,
                failureCount,
            },
        });

    } catch (error: any) {
        console.error('❌ Error broadcasting notification:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

export default router;
