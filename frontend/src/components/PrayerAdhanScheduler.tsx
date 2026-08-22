import { useEffect, useState } from 'react';
import usePrayerNotificationChecker from '../hooks/usePrayerNotificationChecker';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { useAuth } from '../hooks/useAuth';
import { API_URL } from '../config';
import { readTodayAdhanTimes, StoredAdhanTimes, writeTodayAdhanTimes, getLocalDateKey } from '../utils/adhanStorage';

/**
 * Headless component mounted once at the app root. It keeps today's prayer
 * times in sync from localStorage (written by the Prayer Times page) and feeds
 * them to the Adhan checker so notifications + audio fire on any page while the
 * app is open.
 */
const PrayerAdhanScheduler: React.FC = () => {
  const { user } = useAuth();
  const { preferences } = useNotificationPreferences();
  const [times, setTimes] = useState<StoredAdhanTimes | null>(() => readTodayAdhanTimes());

  useEffect(() => {
    if (!user?.id) return;

    const hydrateFromBackend = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const response = await fetch(`${API_URL}/users/${user.id}/location`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;

        const data = await response.json();
        const push = data?.prayerPush;
        if (
          push?.times &&
          push?.timesDate === getLocalDateKey() &&
          typeof push.times === 'object'
        ) {
          writeTodayAdhanTimes(push.times);
        }
      } catch {
        // Best-effort hydration; Prayer Times page still writes local times.
      }
    };

    void hydrateFromBackend();
  }, [user?.id]);

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
