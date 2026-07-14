import redisClient from '../config/redis';
import HijriAdjustmentModel, { HijriAdjustmentValue } from '../models/HijriAdjustment';

const ALADHAN_GTOH_URL = 'https://api.aladhan.com/v1/gToH';
const PER_DATE_CACHE_TTL_SECONDS = 60 * 60 * 6;
const LAST_KNOWN_CACHE_TTL_SECONDS = 60 * 60 * 24 * 14;

const HIJRI_MONTH_NAMES: Record<number, string> = {
  1: 'Muharram',
  2: 'Safar',
  3: 'Rabi al-Awwal',
  4: 'Rabi al-Thani',
  5: 'Jumada al-Awwal',
  6: 'Jumada al-Thani',
  7: 'Rajab',
  8: 'Sha\'ban',
  9: 'Ramadan',
  10: 'Shawwal',
  11: 'Dhu al-Qadah',
  12: 'Dhu al-Hijjah',
};

export interface CorrectedHijriDate {
  day: string;
  month: {
    number: number;
    en: string;
    ar?: string;
  };
  year: string;
  date: string;
  readable: string;
  adjustmentApplied: HijriAdjustmentValue;
  source: 'aladhan-gtoh' | 'cache' | 'last-known-cache';
  isFallback: boolean;
}

interface AladhanGtoHResponse {
  code: number;
  status: string;
  data?: {
    hijri?: {
      day?: string;
      month?: {
        number?: number;
        en?: string;
        ar?: string;
      };
      year?: string;
      date?: string;
    };
  };
}

const fetchWithTimeout = async (url: string, timeoutMs = 8000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const normalizeCoordinateForKey = (value: string | number): string => {
  const numeric = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(numeric)) {
    return '0';
  }

  return numeric.toFixed(4);
};

// Shift a DD-MM-YYYY Gregorian date string by a (possibly negative) number of days.
// Applying the offset on the Gregorian side lets the astronomical source return the
// correct Hijri date directly, avoiding fragile assumptions about Hijri month lengths.
const shiftGregorianDDMMYYYY = (dateStr: string, offsetDays: number): string => {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dateStr.trim());
  if (!match) return dateStr;

  const day = parseInt(match[1] as string, 10);
  const month = parseInt(match[2] as string, 10);
  const year = parseInt(match[3] as string, 10);

  const base = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(base.getTime())) return dateStr;

  base.setUTCDate(base.getUTCDate() + offsetDays);

  const shiftedDay = String(base.getUTCDate()).padStart(2, '0');
  const shiftedMonth = String(base.getUTCMonth() + 1).padStart(2, '0');
  const shiftedYear = base.getUTCFullYear();

  return `${shiftedDay}-${shiftedMonth}-${shiftedYear}`;
};

const parseHijriFromApi = (payload: AladhanGtoHResponse): {
  day: string;
  monthNumber: number;
  monthEn: string;
  monthAr?: string;
  year: string;
} => {
  const hijri = payload.data?.hijri;
  const day = String(hijri?.day || '').trim();
  const monthNumber = Number(hijri?.month?.number || 0);
  const year = String(hijri?.year || '').trim();

  if (!day || !monthNumber || !year) {
    throw new Error('AlAdhan gToH response missing Hijri fields');
  }

  const monthAr = typeof hijri?.month?.ar === 'string' ? hijri.month.ar : undefined;

  return {
    day,
    monthNumber,
    monthEn: String(hijri?.month?.en || HIJRI_MONTH_NAMES[monthNumber] || ''),
    ...(monthAr ? { monthAr } : {}),
    year,
  };
};

const makeDateString = (year: number, month: number, day: number): string => {
  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
};

const makeReadable = (day: number, month: number, year: number): string => {
  const monthName = HIJRI_MONTH_NAMES[month] || String(month);
  return `${day} ${monthName} ${year}`;
};

// Default alignment for this deployment (India local moon-sighting) when no admin
// value has been stored yet. Once an admin sets a value it always wins.
const DEFAULT_HIJRI_ADJUSTMENT: HijriAdjustmentValue = -1;

const clampHijriAdjustment = (value: number): HijriAdjustmentValue => {
  if (!Number.isFinite(value)) return DEFAULT_HIJRI_ADJUSTMENT;
  const rounded = Math.round(value);
  const clamped = Math.max(-2, Math.min(2, rounded));
  return clamped as HijriAdjustmentValue;
};

// The stored global adjustment is a single admin-controlled integer offset applied on
// top of the astronomical (AlAdhan gToH) date. The stored value always wins; when no
// value exists we fall back to the deployment default (-1). The optional `country`
// parameter is retained for signature compatibility but no longer alters the result.
export const getGlobalHijriAdjustment = async (_country?: string): Promise<HijriAdjustmentValue> => {
  const settings = await HijriAdjustmentModel.findOne({ key: 'global' }).lean();
  const rawAdjustment = (settings as { adjustment?: number } | null)?.adjustment;

  if (rawAdjustment === undefined || rawAdjustment === null) {
    return DEFAULT_HIJRI_ADJUSTMENT;
  }

  return clampHijriAdjustment(Number(rawAdjustment));
};

export const setGlobalHijriAdjustment = async (
  adjustment: HijriAdjustmentValue,
  updatedBy?: string,
): Promise<HijriAdjustmentValue> => {
  const normalized = clampHijriAdjustment(Number(adjustment));
  const updatePayload: { adjustment: HijriAdjustmentValue; updatedBy?: string } = { adjustment: normalized };
  if (updatedBy) {
    updatePayload.updatedBy = updatedBy;
  }

  const updated = await HijriAdjustmentModel.findOneAndUpdate(
    { key: 'global' },
    { $set: updatePayload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return clampHijriAdjustment(Number(updated?.adjustment ?? normalized));
};

export const getCorrectedHijriDate = async (params: {
  date: string;
  latitude: string | number;
  longitude: string | number;
  country?: string;
}): Promise<CorrectedHijriDate> => {
  const { date, latitude, longitude, country } = params;
  const adjustment = await getGlobalHijriAdjustment(country);

  const latKey = normalizeCoordinateForKey(latitude);
  const lonKey = normalizeCoordinateForKey(longitude);
  // Cache version bumped to v2 after fixing the Hijri offset (Gregorian-side shift),
  // so previously cached, incorrectly-adjusted values are never served.
  const perDateCacheKey = `hijri:corrected:v2:${latKey}:${lonKey}:${date}:${adjustment}`;
  const lastKnownCacheKey = `hijri:last-known:v2:${latKey}:${lonKey}`;

  try {
    const cached = await redisClient.get(perDateCacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as CorrectedHijriDate;
      return { ...parsed, source: 'cache', isFallback: false };
    }
  } catch (cacheReadError) {
    console.warn('⚠️ Hijri per-date cache read error:', cacheReadError);
  }

  try {
    // Apply the admin offset on the Gregorian side, then let AlAdhan return the exact
    // Hijri date for that day. This avoids inventing non-existent days (e.g. rolling
    // "1 Safar" back to "30 Muharram" when Muharram only has 29 days that year).
    const requestGregorianDate = adjustment !== 0
      ? shiftGregorianDDMMYYYY(date, adjustment)
      : date;
    const query = `date=${encodeURIComponent(requestGregorianDate)}&latitude=${encodeURIComponent(String(latitude))}&longitude=${encodeURIComponent(String(longitude))}`;
    const url = `${ALADHAN_GTOH_URL}?${query}`;

    const response = await fetchWithTimeout(url, 8000);
    if (!response.ok) {
      throw new Error(`AlAdhan gToH HTTP ${response.status}`);
    }

    const payload = (await response.json()) as AladhanGtoHResponse;
    if (payload.code !== 200 || !payload.data?.hijri) {
      throw new Error(`AlAdhan gToH invalid payload: ${payload.status || 'unknown'}`);
    }

    const parsed = parseHijriFromApi(payload);
    const dayNum = parseInt(parsed.day, 10);
    const yearNum = parseInt(parsed.year, 10);
    const monthEn = parsed.monthEn || HIJRI_MONTH_NAMES[parsed.monthNumber] || String(parsed.monthNumber);

    const result: CorrectedHijriDate = {
      day: String(dayNum),
      month: {
        number: parsed.monthNumber,
        en: monthEn,
        ...(parsed.monthAr ? { ar: parsed.monthAr } : {}),
      },
      year: String(yearNum),
      date: makeDateString(yearNum, parsed.monthNumber, dayNum),
      readable: makeReadable(dayNum, parsed.monthNumber, yearNum),
      adjustmentApplied: adjustment,
      source: 'aladhan-gtoh',
      isFallback: false,
    };

    try {
      await redisClient.setEx(perDateCacheKey, PER_DATE_CACHE_TTL_SECONDS, JSON.stringify(result));
      await redisClient.setEx(lastKnownCacheKey, LAST_KNOWN_CACHE_TTL_SECONDS, JSON.stringify(result));
    } catch (cacheWriteError) {
      console.warn('⚠️ Hijri cache write error:', cacheWriteError);
    }

    return result;
  } catch (apiError) {
    try {
      const lastKnown = await redisClient.get(lastKnownCacheKey);
      if (lastKnown) {
        const parsed = JSON.parse(lastKnown) as CorrectedHijriDate;
        return {
          ...parsed,
          source: 'last-known-cache',
          isFallback: true,
        };
      }
    } catch (fallbackReadError) {
      console.warn('⚠️ Hijri fallback cache read error:', fallbackReadError);
    }

    throw apiError;
  }
};
