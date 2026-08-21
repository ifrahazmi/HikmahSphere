import redisClient from '../config/redis';
import PrayerTimeTuningModel, {
  DEFAULT_PRAYER_TIME_OFFSETS,
  type PrayerTimeOffsets,
} from '../models/PrayerTimeTuning';

/**
 * Lightweight, server-side prayer-time provider used by the Adhan push
 * scheduler. It intentionally mirrors the sources and tuning used by the
 * public `/api/prayers/times` route so the times we notify on match what the
 * user sees in the UI. It returns the five obligatory prayers as 24h "HH:MM"
 * strings together with the location's IANA timezone, so the scheduler can
 * compare against the *user's* local clock regardless of where the server runs.
 */

const ISLAMIC_API_PRAYER_URL = 'https://islamicapi.com/api/v1/prayer-time';
const ALADHAN_TIMINGS_URL = 'https://api.aladhan.com/v1/timings';

// Align with public /api/prayers/times Redis TTL (env minutes → seconds).
const CACHE_TTL_SECONDS = Math.max(1, Number(process.env.PRAYER_TIMES_CACHE_TTL) || 15) * 60;

export interface ProviderPrayerTimes {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export interface PrayerTimesResult {
  times: ProviderPrayerTimes;
  timezone: string; // IANA timezone name, e.g. "Asia/Kolkata"
  source: string;
}

async function fetchWithTimeout(url: string, timeoutMs = 8000, options: RequestInit = {}): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const toMinutes = (value: string): number | null => {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1] as string, 10);
  const minutes = parseInt(match[2] as string, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const toHHMM = (totalMinutes: number): string => {
  const perDay = 24 * 60;
  const normalized = ((Math.round(totalMinutes) % perDay) + perDay) % perDay;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Strip a possible timezone suffix ("05:31 (IST)") and normalise to "HH:MM".
const normalizeRawTime = (value: unknown): string => {
  const raw = String(value || '').match(/(\d{1,2}):(\d{2})/);
  if (!raw) return '';
  return `${String(parseInt(raw[1] as string, 10)).padStart(2, '0')}:${raw[2]}`;
};

const applyOffset = (time: string, offsetMinutes: number): string => {
  const base = toMinutes(time);
  if (base === null) return time;
  return toHHMM(base + offsetMinutes);
};

const getGlobalOffsets = async (): Promise<PrayerTimeOffsets> => {
  try {
    const tuning = await PrayerTimeTuningModel.findOne({ key: 'global' }).lean();
    if (!tuning?.offsets) return { ...DEFAULT_PRAYER_TIME_OFFSETS };
    return {
      fajr: Number(tuning.offsets.fajr) || 0,
      dhuhr: Number(tuning.offsets.dhuhr) || 0,
      asr: Number(tuning.offsets.asr) || 0,
      maghrib: Number(tuning.offsets.maghrib) || 0,
      isha: Number(tuning.offsets.isha) || 0,
      imsak: Number(tuning.offsets.imsak) || 0,
    };
  } catch {
    return { ...DEFAULT_PRAYER_TIME_OFFSETS };
  }
};

const applyTuning = (
  raw: { Fajr: unknown; Dhuhr: unknown; Asr: unknown; Maghrib: unknown; Isha: unknown },
  offsets: PrayerTimeOffsets
): ProviderPrayerTimes => ({
  Fajr: applyOffset(normalizeRawTime(raw.Fajr), offsets.fajr),
  Dhuhr: applyOffset(normalizeRawTime(raw.Dhuhr), offsets.dhuhr),
  Asr: applyOffset(normalizeRawTime(raw.Asr), offsets.asr),
  Maghrib: applyOffset(normalizeRawTime(raw.Maghrib), offsets.maghrib),
  Isha: applyOffset(normalizeRawTime(raw.Isha), offsets.isha),
});

const isCompleteTimes = (times: ProviderPrayerTimes): boolean =>
  Boolean(times.Fajr && times.Dhuhr && times.Asr && times.Maghrib && times.Isha);

// Aladhan school: 0 = Shafi/Standard, 1 = Hanafi. Our app uses 1 = Shafi, 2 = Hanafi.
const toAladhanSchool = (school: number): string => (school === 2 ? '1' : '0');

/**
 * Get today's prayer times + timezone for a location. Cached in Redis per
 * (lat, lon, method, school, YYYY-MM-DD) so the per-minute scheduler does not
 * hammer the upstream APIs.
 */
export const getTodayPrayerTimes = async (
  latitude: number,
  longitude: number,
  method: number,
  school: number,
  dateKey: string // YYYY-MM-DD (server date; times are stable for the day)
): Promise<PrayerTimesResult | null> => {
  const lat = latitude.toFixed(4);
  const lon = longitude.toFixed(4);
  const cacheKey = `adhan_push_times:${lat}:${lon}:${method}:${school}:${dateKey}`;

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as PrayerTimesResult;
    }
  } catch {
    // ignore cache read errors
  }

  const offsets = await getGlobalOffsets();
  let result: PrayerTimesResult | null = null;

  // ── PRIMARY: islamicapi.com ──────────────────────────────────────────────
  try {
    const apiKey = process.env.ISLAMIC_API_KEY || '';
    const url = `${ISLAMIC_API_PRAYER_URL}/?lat=${lat}&lon=${lon}&method=${method}&school=${school}&api_key=${apiKey}`;
    const resp = await fetchWithTimeout(url, 8000, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HikmahSphere/1.0)',
        Accept: 'application/json',
        Referer: 'https://islamicapi.com/',
      },
    });
    if (resp.ok) {
      const data: any = await resp.json();
      if (data?.code === 200 && data?.data?.times) {
        const times = applyTuning(data.data.times, offsets);
        const timezone = data.data?.timezone?.name;
        if (isCompleteTimes(times) && typeof timezone === 'string' && timezone) {
          result = { times, timezone, source: 'islamicapi.com' };
        }
      }
    }
  } catch {
    // fall through to Aladhan
  }

  // ── FALLBACK: Aladhan ────────────────────────────────────────────────────
  if (!result) {
    try {
      const [yyyy, mm, dd] = dateKey.split('-');
      const aladhanDate = `${dd}-${mm}-${yyyy}`; // Aladhan expects DD-MM-YYYY
      const url = `${ALADHAN_TIMINGS_URL}/${aladhanDate}?latitude=${lat}&longitude=${lon}&method=${method}&school=${toAladhanSchool(school)}`;
      const resp = await fetchWithTimeout(url, 8000);
      if (resp.ok) {
        const data: any = await resp.json();
        if (data?.code === 200 && data?.data?.timings) {
          const times = applyTuning(data.data.timings, offsets);
          const timezone = data.data?.meta?.timezone;
          if (isCompleteTimes(times) && typeof timezone === 'string' && timezone) {
            result = { times, timezone, source: 'aladhan.com' };
          }
        }
      }
    } catch {
      // give up
    }
  }

  if (result) {
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result));
    } catch {
      // ignore cache write errors
    }
  }

  return result;
};

/**
 * Current "HH:MM" in a given IANA timezone (24h). Returns null if the timezone
 * is invalid.
 */
export const getCurrentHHMMInTimezone = (timezone: string, now: Date = new Date()): string | null => {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const minute = parts.find((p) => p.type === 'minute')?.value;
    if (hour == null || minute == null) return null;
    // Intl can emit "24" for midnight in some environments; normalise to "00".
    const hh = hour === '24' ? '00' : hour;
    return `${hh}:${minute}`;
  } catch {
    return null;
  }
};

/**
 * Current calendar date "YYYY-MM-DD" in a given IANA timezone. Used to key the
 * per-day de-duplication so a user is notified at most once per prayer per day
 * in their own local day.
 */
export const getCurrentDateKeyInTimezone = (timezone: string, now: Date = new Date()): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // ignore
  }
  return now.toISOString().slice(0, 10);
};
