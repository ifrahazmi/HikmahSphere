import User from '../models/User';
import UserNotification from '../models/UserNotification';
import { sendMulticastNotification } from '../config/firebaseAdmin';
import {
  getCurrentHHMMInTimezone,
  getCurrentDateKeyInTimezone,
} from './prayerTimesProvider';

/**
 * Server-side Dhikr & Dua reminder scheduler.
 *
 * The Dhikr & Dua page stores each user's reminder preferences under
 * `religious.dhikrDuaProgress.reminders`. Historically the reminders only
 * fired from a page-scoped interval in the browser, so nothing happened once
 * the tab closed. This scheduler delivers them through FCM (same stack as the
 * prayer Adhan pushes) so they work with the app in the background.
 *
 * Two schedule modes are supported:
 *  - `specific`: fire once per local day when the user's local clock matches
 *    `specificTime` (HH:MM). Deduped via `lastSentDate` (local YYYY-MM-DD).
 *  - `periodic`: fire every `periodicIntervalMinutes`. Tracked via
 *    `lastSentAt`; the first tick seeds the baseline instead of sending
 *    immediately, matching the old client behaviour.
 *
 * Both bookkeeping fields live on the user document so dedupe survives
 * server restarts. An in-memory registry guards against double sends within
 * a single process lifetime if the DB write lags.
 */

const INTERVAL_MS = 60 * 1000;
let schedulerHandle: NodeJS.Timeout | null = null;
let isRunning = false;

// Key: `${userId}|${localDate}|specific` or `${userId}|periodic`.
const sentRegistry = new Map<string, number>();
const DEDUPE_RETENTION_MS = 25 * 60 * 60 * 1000;

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

const getTopicLabel = (reminders: any): string => {
  const includeDhikr = reminders?.includeDhikr !== false;
  const includeDua = reminders?.includeDua !== false;
  if (includeDhikr && includeDua) return 'dhikr and dua';
  if (includeDhikr) return 'dhikr';
  if (includeDua) return 'dua';
  return '';
};

const REMINDER_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const sendReminder = async (
  user: any,
  tokens: string[],
  body: string,
  localDateKey: string,
) => {
  const title = 'Dhikr & Dua Reminder';
  const notificationId = `dhikr-reminder-${user._id.toString()}-${Date.now()}`;
  const data = {
    type: 'dhikr-reminder',
    url: '/dhikr-dua',
    notificationId,
  };

  try {
    await sendMulticastNotification(tokens, title, body, data);
  } catch (err) {
    console.error(`Dhikr reminder: FCM send failed for user ${user._id}:`, err);
  }

  try {
    await UserNotification.create({
      userId: user._id,
      title,
      body,
      data,
      source: 'dhikr-reminder',
      read: false,
    });
  } catch (err) {
    console.error(`Dhikr reminder: failed to store bell notification for user ${user._id}:`, err);
  }

  try {
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          'religious.dhikrDuaProgress.reminders.lastSentAt': new Date(),
          'religious.dhikrDuaProgress.reminders.lastSentDate': localDateKey,
        },
      },
    );
  } catch (err) {
    console.error(`Dhikr reminder: failed to persist send bookkeeping for user ${user._id}:`, err);
  }
};

const runTick = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    pruneRegistry();

    const users = await User.find({
      isBlocked: { $ne: true },
      'religious.dhikrDuaProgress.reminders.enabled': true,
    })
      .select('_id fcmTokens notificationDevices religious.dhikrDuaProgress.reminders prayerPush.timezone')
      .lean();

    if (!users.length) return;

    for (const user of users) {
      const reminders = (user as any)?.religious?.dhikrDuaProgress?.reminders;
      if (!reminders) continue;
      if (!getTopicLabel(reminders)) continue;

      const tokens = collectTokens(user);
      if (tokens.length === 0) continue;

      // Prefer the timezone saved with the reminder settings; fall back to
      // the prayer-push timezone if the user enabled Adhan alerts before.
      const timezone: string | null =
        (typeof reminders.timezone === 'string' && reminders.timezone) ||
        (typeof (user as any)?.prayerPush?.timezone === 'string' && (user as any).prayerPush.timezone) ||
        null;
      if (!timezone) continue;

      const nowHHMM = getCurrentHHMMInTimezone(timezone);
      if (!nowHHMM) continue;
      const localDateKey = getCurrentDateKeyInTimezone(timezone);
      const userId = user._id.toString();

      if (reminders.scheduleType === 'specific') {
        const specificTime = typeof reminders.specificTime === 'string' ? reminders.specificTime : '';
        if (!REMINDER_TIME_PATTERN.test(specificTime)) continue;
        if (nowHHMM !== specificTime) continue;
        if (reminders.lastSentDate === localDateKey) continue;

        const dedupeKey = `${userId}|${localDateKey}|specific`;
        if (sentRegistry.has(dedupeKey)) continue;
        sentRegistry.set(dedupeKey, Date.now());

        await sendReminder(user, tokens, `It is time for your ${getTopicLabel(reminders)}.`, localDateKey);
        continue;
      }

      // Periodic mode.
      const intervalMinutes = Number(reminders.periodicIntervalMinutes) || 180;
      const intervalMs = intervalMinutes * 60 * 1000;
      const lastSentAt = reminders.lastSentAt ? new Date(reminders.lastSentAt).getTime() : NaN;

      if (!Number.isFinite(lastSentAt)) {
        // First tick after enabling: seed the baseline instead of firing
        // immediately, so the first reminder arrives one interval later.
        try {
          await User.updateOne(
            { _id: user._id },
            { $set: { 'religious.dhikrDuaProgress.reminders.lastSentAt': new Date() } },
          );
        } catch (err) {
          console.error(`Dhikr reminder: failed to seed baseline for user ${user._id}:`, err);
        }
        continue;
      }

      if (Date.now() - lastSentAt < intervalMs) continue;

      const dedupeKey = `${userId}|periodic`;
      const lastInMemory = sentRegistry.get(dedupeKey);
      if (lastInMemory && Date.now() - lastInMemory < intervalMs) continue;
      sentRegistry.set(dedupeKey, Date.now());

      await sendReminder(user, tokens, `Take a short break for ${getTopicLabel(reminders)}.`, localDateKey);
    }
  } catch (error) {
    console.error('Dhikr reminder scheduler tick failed:', error);
  } finally {
    isRunning = false;
  }
};

export const startDhikrReminderScheduler = () => {
  if (schedulerHandle) return;
  schedulerHandle = setInterval(() => {
    void runTick();
  }, INTERVAL_MS);
  void runTick();
  console.log('Dhikr & Dua reminder scheduler started');
};

export const stopDhikrReminderScheduler = () => {
  if (!schedulerHandle) return;
  clearInterval(schedulerHandle);
  schedulerHandle = null;
};
