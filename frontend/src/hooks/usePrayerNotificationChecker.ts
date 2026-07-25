import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './useAuth';
import { useNotification } from '../contexts/NotificationContext';
import { playAdhanAudio, setupAdhanAudioUnlock } from '../utils/adhanAudio';

interface PrayerTimes {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

interface NotificationPreferences {
  [key: string]: {
    enabled: boolean;
    sound: boolean;
  };
}

const prayerOrder = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// Robustly parse prayer time strings. Handles 24h ("17:30"), values with a
// timezone suffix ("17:30 (EET)"), and 12h with meridian ("5:30 PM").
const timeStringToMinutes = (timeStr: string): number | null => {
  if (!timeStr) return null;

  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  if (/\b(am|pm)\b/i.test(timeStr)) {
    const meridian = (timeStr.match(/\b(am|pm)\b/i)?.[1] || '').toLowerCase();
    if (meridian === 'pm' && hours < 12) hours += 12;
    if (meridian === 'am' && hours === 12) hours = 0;
  }

  return (hours % 24) * 60 + minutes;
};

export const usePrayerNotificationChecker = (
  prayerTimes: PrayerTimes | null,
  notificationPrefs: NotificationPreferences | null
) => {
  const { user } = useAuth();
  const { addSystemNotification } = useNotification();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const notifiedPrayersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!prayerTimes || !user || !notificationPrefs) {
      return;
    }

    // Ask for notification permission ahead of time and prepare audio so the
    // Adhan can fire automatically the moment a prayer time arrives.
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
    setupAdhanAudioUnlock();

    const checkUpcomingPrayers = () => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const today = now.toISOString().split('T')[0];
      const checkKey = `${today}`;

      prayerOrder.forEach((prayer) => {
        const timeStr = prayerTimes[prayer as keyof PrayerTimes];
        if (!timeStr) return;

        const prayerMinutes = timeStringToMinutes(timeStr);
        if (prayerMinutes === null) return;

        // Fire exactly at the displayed start time (the current minute matches
        // the prayer minute). The 30s interval samples this minute twice, and
        // the per-day de-dupe guarantees a single Adhan.
        if (prayerMinutes === currentMinutes) {
          const prayerKey = `${checkKey}-${prayer}`;

          // Only notify once per prayer per day
          if (!notifiedPrayersRef.current.has(prayerKey)) {
            const prefs = notificationPrefs[prayer.toLowerCase()];
            if (prefs?.enabled) {
              const capitalizedPrayer = prayer.charAt(0).toUpperCase() + prayer.slice(1);

              // Request notification permission if needed
              if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
              }

              // Add to in-app bell. OS tray for Adhan is left to FCM/SW so we
              // do not show two system notifications when the app is open.
              const adhanNotificationId = `adhan-${today}-${prayer.toLowerCase()}`;
              addSystemNotification(
                `Adhan: ${capitalizedPrayer}`,
                `It's time for ${capitalizedPrayer} prayer.`,
                'info',
                { type: 'adhan', prayer, notificationId: adhanNotificationId }
              );

              toast.success(`Time for ${capitalizedPrayer}`);

              // Play audio if enabled (only works while the app is open)
              if (prefs.sound) {
                playAdhanAudio();
              }

              notifiedPrayersRef.current.add(prayerKey);

              if (notifiedPrayersRef.current.size > 20) {
                const arr = Array.from(notifiedPrayersRef.current);
                notifiedPrayersRef.current = new Set(arr.slice(-10));
              }
            }
          }
        }
      });
    };

    intervalRef.current = setInterval(checkUpcomingPrayers, 30000);
    checkUpcomingPrayers();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [prayerTimes, user, notificationPrefs, addSystemNotification]);
};

export default usePrayerNotificationChecker;
