import User from '../models/User';
import UserNotification from '../models/UserNotification';
import { sendMulticastNotification } from '../config/firebaseAdmin';
import {
  getCurrentHHMMInTimezone,
  getCurrentDateKeyInTimezone,
} from './prayerTimesProvider';
import {
  MUHASABA_REMINDER_BODY,
  MUHASABA_REMINDER_TITLE,
  normalizeMuhasabaReminderTime,
  shouldSendMuhasabaReminder,
} from '../utils/muhasabaReminder';

const INTERVAL_MS = 60 * 1000;
let schedulerHandle: NodeJS.Timeout | null = null;
let isRunning = false;

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

const sendReminder = async (user: any, tokens: string[], localDateKey: string) => {
  const notificationId = `muhasaba-reminder-${user._id.toString()}-${localDateKey}`;
  const data = {
    type: 'muhasaba-reminder',
    url: '/salah-tracker',
    notificationId,
  };

  try {
    await sendMulticastNotification(tokens, MUHASABA_REMINDER_TITLE, MUHASABA_REMINDER_BODY, data);
  } catch (err) {
    console.error(`Muhasaba reminder: FCM send failed for user ${user._id}:`, err);
  }

  try {
    await UserNotification.create({
      userId: user._id,
      title: MUHASABA_REMINDER_TITLE,
      body: MUHASABA_REMINDER_BODY,
      data,
      source: 'muhasaba-reminder',
      read: false,
    });
  } catch (err) {
    console.error(`Muhasaba reminder: failed to store bell notification for user ${user._id}:`, err);
  }

  try {
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          'religious.muhasabaReminder.lastSentAt': new Date(),
          'religious.muhasabaReminder.lastSentDate': localDateKey,
        },
      },
    );
  } catch (err) {
    console.error(`Muhasaba reminder: failed to persist send bookkeeping for user ${user._id}:`, err);
  }
};

const runTick = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    pruneRegistry();

    const users = await User.find({
      isBlocked: { $ne: true },
      'religious.muhasabaReminder.enabled': true,
    })
      .select('_id fcmTokens notificationDevices religious.muhasabaReminder prayerPush.timezone')
      .lean();

    if (!users.length) return;

    for (const user of users) {
      const reminder = (user as any)?.religious?.muhasabaReminder;
      if (!reminder) continue;

      const tokens = collectTokens(user);
      if (tokens.length === 0) continue;

      const timezone: string | null =
        (typeof reminder.timezone === 'string' && reminder.timezone) ||
        (typeof (user as any)?.prayerPush?.timezone === 'string' && (user as any).prayerPush.timezone) ||
        null;
      if (!timezone) continue;

      const nowHHMM = getCurrentHHMMInTimezone(timezone);
      const localDateKey = getCurrentDateKeyInTimezone(timezone);
      const userId = user._id.toString();

      if (!shouldSendMuhasabaReminder({
        enabled: true,
        time: normalizeMuhasabaReminderTime(reminder.time),
        lastSentDate: reminder.lastSentDate,
        nowHHMM,
        localDateKey,
      })) {
        continue;
      }

      const dedupeKey = `${userId}|${localDateKey}`;
      if (sentRegistry.has(dedupeKey)) continue;
      sentRegistry.set(dedupeKey, Date.now());

      await sendReminder(user, tokens, localDateKey);
    }
  } catch (error) {
    console.error('Muhasaba reminder scheduler tick failed:', error);
  } finally {
    isRunning = false;
  }
};

export const startMuhasabaReminderScheduler = () => {
  if (schedulerHandle) return;
  schedulerHandle = setInterval(() => {
    void runTick();
  }, INTERVAL_MS);
  void runTick();
  console.log('Muhasabah reminder scheduler started');
};

export const stopMuhasabaReminderScheduler = () => {
  if (!schedulerHandle) return;
  clearInterval(schedulerHandle);
  schedulerHandle = null;
};
