import User from '../models/User';
import UserNotification from '../models/UserNotification';
import { sendMulticastNotification } from '../config/firebaseAdmin';
import {
  getTodayPrayerTimes,
  getCurrentHHMMInTimezone,
  getCurrentDateKeyInTimezone,
  type ProviderPrayerTimes,
} from './prayerTimesProvider';

const INTERVAL_MS = 60 * 1000;
let schedulerHandle: NodeJS.Timeout | null = null;
let isRunning = false;

const PRAYERS: Array<keyof ProviderPrayerTimes> = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// In-memory de-duplication so a user is notified at most once per prayer per
// local day. Key: `${userId}|${localDate}|${prayer}`. Pruned every tick.
const sentRegistry = new Map<string, number>();
const DEDUPE_RETENTION_MS = 25 * 60 * 60 * 1000; // a little over a day

const pruneRegistry = () => {
  const cutoff = Date.now() - DEDUPE_RETENTION_MS;
  for (const [key, ts] of sentRegistry.entries()) {
    if (ts < cutoff) sentRegistry.delete(key);
  }
};

const collectTokens = (user: any): string[] => {
  const tokens = new Set<string>();
  if (Array.isArray(user?.fcmTokens)) {
    user.fcmTokens.forEach((token: unknown) => {
      if (typeof token === 'string' && token.trim()) tokens.add(token.trim());
    });
  }
  if (Array.isArray(user?.notificationDevices)) {
    user.notificationDevices.forEach((device: any) => {
      if (typeof device?.token === 'string' && device.token.trim()) tokens.add(device.token.trim());
    });
  }
  return Array.from(tokens);
};

// Per-prayer toggle. Defaults to enabled when no preference has been saved.
const isPrayerEnabled = (prayerAlerts: any, prayer: string): boolean => {
  if (!prayerAlerts || typeof prayerAlerts !== 'object') return true;
  const pref = prayerAlerts[prayer.toLowerCase()];
  if (!pref || typeof pref !== 'object') return true;
  return pref.enabled !== false;
};

const runTick = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    pruneRegistry();

    const users = await User.find({
      isBlocked: { $ne: true },
      'prayerPush.enabled': { $ne: false },
      'prayerPush.latitude': { $type: 'number' },
      'prayerPush.longitude': { $type: 'number' },
      'preferences.notifications.prayers': { $ne: false },
    })
      .select('_id fcmTokens notificationDevices prayerPush preferences.notifications.prayerAlerts')
      .lean();

    if (!users.length) return;

    const serverDateKey = new Date().toISOString().slice(0, 10);

    // Cache today's times per unique location so we don't refetch per user.
    const timesByLocation = new Map<string, Awaited<ReturnType<typeof getTodayPrayerTimes>>>();

    for (const user of users) {
      const push = (user as any).prayerPush;
      if (!push) continue;

      const tokens = collectTokens(user);
      if (tokens.length === 0) continue;

      const method = Number(push.method) || 1;
      const school = Number(push.school) || 1;

      // Timezone used to read the user's local clock.
      let timezone: string | null =
        typeof push.timezone === 'string' && push.timezone ? push.timezone : null;

      // Prefer the EXACT times the Prayer Times page displayed for the user's
      // current local day, so the Adhan fires at precisely the shown start
      // time. Otherwise recompute today's times (which also yields a timezone).
      let prayerTimes: Partial<ProviderPrayerTimes> | null = null;
      if (timezone && push.times && push.timesDate) {
        if (push.timesDate === getCurrentDateKeyInTimezone(timezone)) {
          prayerTimes = push.times as Partial<ProviderPrayerTimes>;
        }
      }

      if (!prayerTimes) {
        const locKey = `${push.latitude.toFixed(4)}:${push.longitude.toFixed(4)}:${method}:${school}`;
        let computed = timesByLocation.get(locKey);
        if (computed === undefined) {
          computed = await getTodayPrayerTimes(push.latitude, push.longitude, method, school, serverDateKey);
          timesByLocation.set(locKey, computed);
        }
        if (!computed) continue;
        prayerTimes = computed.times;
        if (!timezone) timezone = computed.timezone;
      }

      if (!timezone) continue;

      const nowHHMM = getCurrentHHMMInTimezone(timezone);
      if (!nowHHMM) continue;
      const localDateKey = getCurrentDateKeyInTimezone(timezone);

      const prayerAlerts = (user as any)?.preferences?.notifications?.prayerAlerts;

      for (const prayer of PRAYERS) {
        const prayerTime = prayerTimes[prayer];
        if (!prayerTime || prayerTime !== nowHHMM) continue;
        if (!isPrayerEnabled(prayerAlerts, prayer)) continue;

        const dedupeKey = `${user._id.toString()}|${localDateKey}|${prayer}`;
        if (sentRegistry.has(dedupeKey)) continue;
        sentRegistry.set(dedupeKey, Date.now());

        const notificationId = `adhan-${localDateKey}-${prayer.toLowerCase()}`;
        const title = `Adhan: ${prayer}`;
        const body = `It's time for ${prayer} prayer. Tap to play the Adhan.`;
        const data = {
          type: 'adhan',
          prayer,
          url: `/prayers?playAdhan=1&prayer=${encodeURIComponent(prayer)}`,
          notificationId,
          playAdhan: '1',
        };

        try {
          await sendMulticastNotification(tokens, title, body, data, { dataOnly: true });
        } catch (err) {
          console.error(`Prayer push: FCM send failed for user ${user._id}:`, err);
        }

        try {
          await UserNotification.create({
            userId: user._id,
            title,
            body,
            data,
            source: 'prayer-adhan',
            read: false,
          });
        } catch (err) {
          console.error(`Prayer push: failed to store bell notification for user ${user._id}:`, err);
        }
      }
    }
  } catch (error) {
    console.error('Prayer notification scheduler tick failed:', error);
  } finally {
    isRunning = false;
  }
};

export const startPrayerNotificationScheduler = () => {
  if (schedulerHandle) return;
  schedulerHandle = setInterval(() => {
    void runTick();
  }, INTERVAL_MS);
  void runTick();
  console.log('Prayer (Adhan) notification scheduler started');
};

export const stopPrayerNotificationScheduler = () => {
  if (!schedulerHandle) return;
  clearInterval(schedulerHandle);
  schedulerHandle = null;
};
