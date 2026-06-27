import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './useAuth';
import { useNotification } from '../contexts/NotificationContext';

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

let globalAdhanAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;

// Browsers block audio that is not started from a user gesture. We "unlock"
// playback the first time the user interacts with the page so the Adhan can
// later be played automatically when a prayer time arrives.
const setupAudioUnlock = () => {
  if (typeof window === 'undefined' || audioUnlocked) return;

  const unlock = () => {
    try {
      const primer = new Audio('/sounds/adhan.mp3');
      // `muted` is reliably honored on all platforms (including iOS, where the
      // `volume` property is ignored). This keeps the unlock completely silent
      // so the Adhan never blares out when the user simply taps the page.
      primer.muted = true;
      primer.volume = 0;
      primer
        .play()
        .then(() => {
          primer.pause();
          primer.currentTime = 0;
          audioUnlocked = true;
        })
        .catch(() => {
          // Even if priming fails, mark as attempted so we don't spam.
          audioUnlocked = true;
        });
    } catch {
      audioUnlocked = true;
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };

  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
};

const playadhanAudio = () => {
  try {
    if (globalAdhanAudio) {
      globalAdhanAudio.pause();
      globalAdhanAudio.currentTime = 0;
    }

    const audioUrl = '/sounds/adhan.mp3';
    globalAdhanAudio = new Audio(audioUrl);
    globalAdhanAudio.volume = 0.8;
    globalAdhanAudio.play().catch(err => {
      console.warn('[PrayerChecker] Audio play failed (autoplay may be blocked until user interacts):', err);
    });
    
    // Stop after 20 seconds strictly
    setTimeout(() => {
      if (globalAdhanAudio) {
        globalAdhanAudio.pause();
        globalAdhanAudio.currentTime = 0;
      }
    }, 20000);
  } catch (err) {
    console.warn('Error creating audio element:', err);
  }
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
    setupAudioUnlock();

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

              // Add to in-app bell and show system push. The notificationId is
              // deterministic and matches the server-side push so the same
              // Adhan is never shown twice (foreground client + background push).
              const adhanNotificationId = `adhan-${today}-${prayer.toLowerCase()}`;
              addSystemNotification(
                `Adhan: ${capitalizedPrayer}`,
                `It's time for ${capitalizedPrayer} prayer.`,
                'info',
                { type: 'adhan', prayer, notificationId: adhanNotificationId }
              );

              // Show toast notification
              toast.success(`Time for ${capitalizedPrayer}`);

              // Play audio if enabled
              if (prefs.sound) {
                playadhanAudio();
              }

              notifiedPrayersRef.current.add(prayerKey);

              // Keep set size manageable (remove old entries if >20)
              if (notifiedPrayersRef.current.size > 20) {
                const arr = Array.from(notifiedPrayersRef.current);
                notifiedPrayersRef.current = new Set(arr.slice(-10));
              }
            }
          }
        }
      });
    };

    // Check every 30 seconds
    intervalRef.current = setInterval(checkUpcomingPrayers, 30000);

    // Also check immediately
    checkUpcomingPrayers();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [prayerTimes, user, notificationPrefs, addSystemNotification]);
};

export default usePrayerNotificationChecker;
