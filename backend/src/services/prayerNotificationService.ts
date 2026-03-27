/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import cron from 'node-cron';
import User, { IUser } from '../models/User';
import UserNotification from '../models/UserNotification';
import { sendMulticastNotification } from '../config/firebaseAdmin';
import axios from 'axios';

const API_BASE_URL = 'https://api.aladhan.com/v1/timings';

interface PrayerTimes {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

interface UserNotificationData {
  _id: any;
  email: string;
  username: string;
  location?: {
    city: string;
    country: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  preferences: {
    prayerCalculationMethod: string;
    prayerNotifications?: {
      fajr: boolean;
      dhuhr: boolean;
      asr: boolean;
      maghrib: boolean;
      isha: boolean;
      jumuah: boolean;
      advanceMinutes: number;
      sound: string;
      volume: number;
    };
    notifications: {
      prayers: boolean;
      push: boolean;
    };
  };
  fcmTokens?: string[];
  notificationDevices?: Array<{
    token: string;
    permission: string;
    supportsWebPush: boolean;
    isIOS: boolean;
    isStandalone: boolean;
  }>;
}

// Parse time string (HH:MM) to Date object for today
const parseTimeToDate = (timeStr: string): Date => {
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr || '0', 10);
  const minutes = parseInt(minutesStr || '0', 10);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

// Get prayer times for a specific date and location
const getPrayerTimesForLocation = async (
  latitude: number,
  longitude: number,
  date: string,
  method?: string
): Promise<PrayerTimes | null> => {
  const calculationMethod = method || 'MWL';
  try {
    const response = await axios.get(`${API_BASE_URL}/${date}`, {
      params: {
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        method: calculationMethod,
      },
      timeout: 8000,
    });

    if (response.data.code === 200 && response.data.data?.timings) {
      return {
        Fajr: response.data.data.timings.Fajr,
        Dhuhr: response.data.data.timings.Dhuhr,
        Asr: response.data.data.timings.Asr,
        Maghrib: response.data.data.timings.Maghrib,
        Isha: response.data.data.timings.Isha,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching prayer times:', error);
    return null;
  }
};

// Send prayer notification to users
const sendPrayerNotification = async (
  users: Array<{
    _id: any;
    email: string;
    username: string;
    fcmTokens?: string[];
    notificationDevices?: Array<{ token: string; permission: string; supportsWebPush: boolean }>;
  }>,
  prayerName: string,
  prayerTime: string
) => {
  const title = `🕌 ${prayerName} Prayer Time`;
  const body = `The time for ${prayerName} prayer has arrived. Don't forget to pray!`;

  // Collect all valid tokens
  const tokens: string[] = [];
  for (const user of users) {
    const deviceToken = user.notificationDevices?.[0]?.token;
    const userToken = user.fcmTokens?.[0];
    const validToken = deviceToken || userToken;
    if (validToken) {
      tokens.push(validToken);
    }
  }

  if (tokens.length === 0) {
    console.log('No valid tokens found for prayer notification');
    return;
  }

  try {
    // Send notifications via FCM
    const response = await sendMulticastNotification(tokens, title, body, {
      type: 'prayer_notification',
      prayer: prayerName.toLowerCase(),
      prayerTime,
    });

    console.log(`✅ Sent ${prayerName} notification: ${response.successCount} successful, ${response.failureCount} failed`);

    // Store notifications in database for first few users (to avoid excessive writes)
    const usersToStore = users.slice(0, 100);
    const notificationDocs = usersToStore.map(user => ({
      userId: user._id,
      title,
      body,
      data: {
        type: 'prayer_notification',
        prayer: prayerName.toLowerCase(),
        prayerTime,
      },
      source: 'system-prayer' as const,
      read: false,
    }));

    if (notificationDocs.length > 0) {
      await UserNotification.insertMany(notificationDocs, { ordered: false });
    }
  } catch (error) {
    console.error('Error sending prayer notification:', error);
  }
};

// Schedule notifications for a specific prayer
const schedulePrayerNotification = (
  prayerName: string,
  prayerTime: string,
  users: Array<{
    _id: any;
    email: string;
    username: string;
    fcmTokens?: string[];
    notificationDevices?: Array<{ token: string; permission: string; supportsWebPush: boolean }>;
  }>
) => {
  const notificationDate = parseTimeToDate(prayerTime);
  const now = new Date();

  // If the prayer time has already passed today, schedule for tomorrow
  if (notificationDate <= now) {
    notificationDate.setDate(notificationDate.getDate() + 1);
  }

  const cronTime = `${notificationDate.getMinutes()} ${notificationDate.getHours()} * * *`;

  console.log(`📅 Scheduling ${prayerName} notification for ${notificationDate.toISOString()} (cron: ${cronTime})`);

  const job = cron.schedule(cronTime, async () => {
    console.log(`⏰ Sending ${prayerName} notification...`);
    await sendPrayerNotification(users, prayerName, prayerTime);
  }, {
    timezone: 'UTC',
  });

  return job;
};

// Main function to schedule all prayer notifications for the day
export const scheduleDailyPrayerNotifications = async () => {
  try {
    console.log('🕌 Starting daily prayer notification scheduling...');

    // Get all users with prayer notifications enabled
    const users = await User.find({
      'preferences.notifications.prayers': true,
      'preferences.notifications.push': true,
      $and: [
        {
          $or: [
            { 'preferences.prayerNotifications.fajr': true },
            { 'preferences.prayerNotifications.dhuhr': true },
            { 'preferences.prayerNotifications.asr': true },
            { 'preferences.prayerNotifications.maghrib': true },
            { 'preferences.prayerNotifications.isha': true },
          ],
        },
        {
          $or: [
            { 'fcmTokens.0': { $exists: true } },
            { 'notificationDevices.0.token': { $exists: true } },
          ],
        },
      ],
    })
    .select('_id email username location preferences fcmTokens notificationDevices')
    .lean() as unknown as UserNotificationData[];

    if (users.length === 0) {
      console.log('No users found with prayer notifications enabled');
      return;
    }

    console.log(`📋 Found ${users.length} users with prayer notifications enabled`);

    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Group users by location for efficient prayer time fetching
    const usersByLocation = new Map<string, typeof users>();

    for (const user of users) {
      const lat = user.location?.coordinates?.latitude || 21.4225; // Default to Makkah
      const lon = user.location?.coordinates?.longitude || 39.8262;
      const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;

      if (!usersByLocation.has(key)) {
        usersByLocation.set(key, []);
      }
      usersByLocation.get(key)!.push(user);
    }

    // Schedule notifications for each location group
    const scheduledJobs: cron.ScheduledTask[] = [];

    for (const [locationKey, locationUsers] of usersByLocation.entries()) {
      const [latStr, lonStr] = locationKey.split(',');
      const lat = parseFloat(latStr || '21.42');
      const lon = parseFloat(lonStr || '39.83');
      const prayerMethod = locationUsers[0]?.preferences?.prayerCalculationMethod || 'MWL';

      // @ts-ignore - TypeScript strict mode issue with optional chaining and || operator
      const prayerTimes = await getPrayerTimesForLocation(lat, lon, today, prayerMethod);

      if (!prayerTimes) {
        console.log(`❌ Could not fetch prayer times for location ${locationKey}`);
        continue;
      }

      // Schedule notifications for each prayer
      const prayers = [
        { name: 'Fajr', time: prayerTimes.Fajr, enabled: locationUsers.some(u => u.preferences.prayerNotifications?.fajr) },
        { name: 'Dhuhr', time: prayerTimes.Dhuhr, enabled: locationUsers.some(u => u.preferences.prayerNotifications?.dhuhr) },
        { name: 'Asr', time: prayerTimes.Asr, enabled: locationUsers.some(u => u.preferences.prayerNotifications?.asr) },
        { name: 'Maghrib', time: prayerTimes.Maghrib, enabled: locationUsers.some(u => u.preferences.prayerNotifications?.maghrib) },
        { name: 'Isha', time: prayerTimes.Isha, enabled: locationUsers.some(u => u.preferences.prayerNotifications?.isha) },
      ];

      for (const prayer of prayers) {
        if (prayer.enabled) {
          const job = schedulePrayerNotification(prayer.name, prayer.time, locationUsers);
          scheduledJobs.push(job);
        }
      }
    }

    console.log(`✅ Scheduled ${scheduledJobs.length} prayer notification jobs for today`);
  } catch (error) {
    console.error('Error scheduling daily prayer notifications:', error);
  }
};

// Schedule Jumu'ah (Friday prayer) notification
export const scheduleJumuahNotification = () => {
  // Every Friday at 11:00 AM (before Jumu'ah prayer)
  const jumuahCron = '0 11 * * 5'; // Minute Hour Day Month DayOfWeek (5 = Friday)

  console.log('📅 Scheduling weekly Jumu\'ah notification (Fridays at 11:00 AM)');

  const job = cron.schedule(jumuahCron, async () => {
    console.log('⏰ Sending Jumu\'ah notification...');

    try {
      const users = await User.find({
        'preferences.notifications.prayers': true,
        'preferences.notifications.push': true,
        'preferences.prayerNotifications.jumuah': true,
        $or: [
          { 'fcmTokens.0': { $exists: true } },
          { 'notificationDevices.0.token': { $exists: true } },
        ],
      })
      .select('_id email username fcmTokens notificationDevices')
      .lean();

      if (users.length === 0) {
        console.log('No users found for Jumu\'ah notification');
        return;
      }

      const title = '🕌 Jumu\'ah Prayer Reminder';
      const body = "Don't forget to attend the Friday congregational prayer. May Allah accept your worship!";

      const tokens: string[] = [];
      for (const user of users) {
        const deviceToken = user.notificationDevices?.[0]?.token;
        const userToken = user.fcmTokens?.[0];
        const validToken = deviceToken || userToken;
        if (validToken) {
          tokens.push(validToken);
        }
      }

      if (tokens.length === 0) {
        return;
      }

      const response = await sendMulticastNotification(tokens, title, body, {
        type: 'jumuah_notification',
      });

      console.log(`✅ Sent Jumu'ah notification: ${response.successCount} successful, ${response.failureCount} failed`);

      // Store notifications
      const usersToStore = users.slice(0, 100);
      const notificationDocs = usersToStore.map(user => ({
        userId: user._id,
        title,
        body,
        data: { type: 'jumuah_notification' },
        source: 'system-jumuah' as const,
        read: false,
      }));

      if (notificationDocs.length > 0) {
        await UserNotification.insertMany(notificationDocs, { ordered: false });
      }
    } catch (error) {
      console.error('Error sending Jumu\'ah notification:', error);
    }
  }, {
    timezone: 'UTC',
  });

  return job;
};

// Initialize all scheduled notifications
export const initializePrayerNotifications = () => {
  console.log('🕌 Initializing prayer notification scheduler...');

  // Schedule daily notifications (runs every day at midnight to set up the day's notifications)
  const dailyScheduler = cron.schedule('0 0 * * *', () => {
    console.log('🌙 Running daily prayer notification scheduler...');
    void scheduleDailyPrayerNotifications();
  }, {
    timezone: 'UTC',
  });

  // Schedule Jumu'ah notification
  const jumuahScheduler = scheduleJumuahNotification();

  // Run initial scheduling
  void scheduleDailyPrayerNotifications();

  return {
    dailyScheduler,
    jumuahScheduler,
  };
};

// Cleanup function
export const cleanupPrayerNotifications = (schedulers: {
  dailyScheduler: cron.ScheduledTask;
  jumuahScheduler: cron.ScheduledTask;
}) => {
  console.log('🧹 Cleaning up prayer notification schedulers...');
  schedulers.dailyScheduler.stop();
  schedulers.jumuahScheduler.stop();
};
