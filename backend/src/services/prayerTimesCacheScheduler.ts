import User from '../models/User';
import { getTodayPrayerTimes } from './prayerTimesProvider';

/**
 * Periodically warms Redis prayer-time caches for users who have a saved
 * location, so the Prayer Times page can load from cache without waiting on
 * upstream APIs.
 */

const refreshIntervalMinutes = Math.max(
  1,
  Number(process.env.PRAYER_TIMES_REFRESH_INTERVAL) || Number(process.env.PRAYER_TIMES_CACHE_TTL) || 15,
);
const INTERVAL_MS = refreshIntervalMinutes * 60 * 1000;

let schedulerHandle: NodeJS.Timeout | null = null;
let isRunning = false;

const getInternalApiBase = (): string => {
  const port = process.env.BACKEND_PORT || process.env.PORT || '5000';
  return `http://127.0.0.1:${port}/api`;
};

const warmPublicPrayerTimesCache = async (
  latitude: number,
  longitude: number,
  method: number,
  school: number,
): Promise<void> => {
  const lat = latitude.toFixed(4);
  const lon = longitude.toFixed(4);
  const url = `${getInternalApiBase()}/prayers/times?latitude=${lat}&longitude=${lon}&method=${method}&school=${school}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      console.warn(`Prayer cache warm failed (${lat},${lon}): HTTP ${resp.status}`);
    }
  } catch (err) {
    console.warn(`Prayer cache warm failed (${lat},${lon}):`, err);
  } finally {
    clearTimeout(timer);
  }
};

const runTick = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    const users = await User.find({
      isBlocked: { $ne: true },
      $or: [
        { 'location.coordinates.latitude': { $type: 'number' }, 'location.coordinates.longitude': { $type: 'number' } },
        { 'prayerPush.latitude': { $type: 'number' }, 'prayerPush.longitude': { $type: 'number' } },
      ],
    })
      .select('location prayerPush')
      .lean();

    if (!users.length) return;

    const serverDateKey = new Date().toISOString().slice(0, 10);
    const seen = new Set<string>();

    for (const user of users) {
      const loc = (user as any).location;
      const push = (user as any).prayerPush;
      const latitude = Number(loc?.coordinates?.latitude ?? push?.latitude);
      const longitude = Number(loc?.coordinates?.longitude ?? push?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

      const method = Number(push?.method) || 1;
      const school = Number(push?.school) === 2 ? 2 : 1;
      const locKey = `${latitude.toFixed(4)}:${longitude.toFixed(4)}:${method}:${school}`;
      if (seen.has(locKey)) continue;
      seen.add(locKey);

      // Warm Adhan-push Redis key used by the notification scheduler.
      await getTodayPrayerTimes(latitude, longitude, method, school, serverDateKey);
      // Warm the public /api/prayers/times Redis key used by the UI.
      await warmPublicPrayerTimesCache(latitude, longitude, method, school);
    }

    if (seen.size > 0) {
      console.log(`🕌 Prayer times cache refreshed for ${seen.size} unique location(s)`);
    }
  } catch (error) {
    console.error('Prayer times cache scheduler tick failed:', error);
  } finally {
    isRunning = false;
  }
};

export const startPrayerTimesCacheScheduler = () => {
  if (schedulerHandle) return;
  schedulerHandle = setInterval(() => {
    void runTick();
  }, INTERVAL_MS);
  // Delay first tick slightly so the HTTP server is listening before self-fetch.
  setTimeout(() => {
    void runTick();
  }, 5000);
  console.log(
    `Prayer times cache scheduler started (every ${refreshIntervalMinutes} min)`,
  );
};

export const stopPrayerTimesCacheScheduler = () => {
  if (!schedulerHandle) return;
  clearInterval(schedulerHandle);
  schedulerHandle = null;
};
