import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { deriveNotificationStatus, mergeHeartbeatDevice } from './notifications';

describe('notification device presence', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('creates a tokenless device shell from the first heartbeat', () => {
        const heartbeatAt = new Date('2026-08-21T12:00:00.000Z');

        const devices = mergeHeartbeatDevice([], {
            deviceId: 'device-1',
            permission: 'granted',
            capability: {
                supportsWebPush: true,
                isIOS: false,
                isStandalone: true,
            },
            heartbeatAt,
            visibilityState: 'visible',
            isOnline: true,
        });

        expect(devices).toHaveLength(1);
        expect(devices[0]).toMatchObject({
            deviceId: 'device-1',
            permission: 'granted',
            supportsWebPush: true,
            visibilityState: 'visible',
            lastSeenAt: heartbeatAt,
            lastActiveAt: heartbeatAt,
        });
        expect(devices[0]?.token).toBeUndefined();
    });

    it('preserves an existing push token when heartbeat metadata is updated', () => {
        const devices = mergeHeartbeatDevice([
            {
                deviceId: 'device-1',
                token: 'fcm-token',
                permission: 'default',
                supportsWebPush: false,
                updatedAt: new Date('2026-08-21T11:00:00.000Z'),
            },
        ], {
            deviceId: 'device-1',
            permission: 'granted',
            capability: {
                supportsWebPush: true,
                isIOS: false,
                isStandalone: true,
            },
            heartbeatAt: new Date('2026-08-21T12:00:00.000Z'),
            visibilityState: 'visible',
            isOnline: true,
        });

        expect(devices).toHaveLength(1);
        expect(devices[0]?.token).toBe('fcm-token');
        expect(devices[0]?.permission).toBe('granted');
    });

    it('reports push readiness independently from recent activity', () => {
        const now = new Date('2026-08-21T12:00:00.000Z');
        jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

        const activeWithoutPush = deriveNotificationStatus({
            notificationPermission: 'granted',
            notificationDevices: [{
                deviceId: 'active-device',
                token: '',
                permission: 'granted',
                supportsWebPush: true,
                lastSeenAt: new Date(now.getTime() - 30_000),
                lastActiveAt: new Date(now.getTime() - 30_000),
                updatedAt: new Date(now.getTime() - 30_000),
            }],
        });
        expect(activeWithoutPush.hasValidNotificationDevice).toBe(false);
        expect(activeWithoutPush.isActive).toBe(true);
        expect(activeWithoutPush.isRecentlySeen).toBe(true);

        const backgroundPushReady = deriveNotificationStatus({
            notificationPermission: 'granted',
            notificationDevices: [{
                deviceId: 'background-device',
                token: 'fcm-token',
                permission: 'granted',
                supportsWebPush: true,
                lastSeenAt: new Date(now.getTime() - 10 * 60_000),
                lastActiveAt: new Date(now.getTime() - 10 * 60_000),
                updatedAt: new Date(now.getTime() - 10 * 60_000),
            }],
        });
        expect(backgroundPushReady.hasValidNotificationDevice).toBe(true);
        expect(backgroundPushReady.isActive).toBe(false);
        expect(backgroundPushReady.isRecentlySeen).toBe(true);
    });
});
