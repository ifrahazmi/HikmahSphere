import { useEffect, useState } from 'react';
import usePrayerNotificationChecker from '../hooks/usePrayerNotificationChecker';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { readTodayAdhanTimes, StoredAdhanTimes } from '../utils/adhanStorage';

/**
 * Headless component mounted once at the app root. It keeps today's prayer
 * times in sync from localStorage (written by the Prayer Times page) and feeds
 * them to the Adhan checker so notifications + audio fire on any page while the
 * app is open.
 */
const PrayerAdhanScheduler: React.FC = () => {
  const { preferences } = useNotificationPreferences();
  const [times, setTimes] = useState<StoredAdhanTimes | null>(() => readTodayAdhanTimes());

  useEffect(() => {
    const refresh = () => {
      const next = readTodayAdhanTimes();
      setTimes((prev) => {
        if (prev && next && JSON.stringify(prev) === JSON.stringify(next)) {
          return prev;
        }
        return next;
      });
    };

    refresh();

    // Re-read periodically (covers day rollover) and when another tab updates.
    const interval = window.setInterval(refresh, 60 * 1000);
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'hs-adhan-today') refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  usePrayerNotificationChecker(
    times,
    preferences as unknown as Parameters<typeof usePrayerNotificationChecker>[1]
  );

  return null;
};

export default PrayerAdhanScheduler;
