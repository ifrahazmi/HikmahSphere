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

const HIJRI_LEAP_YEAR_POSITIONS = new Set([2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29]);

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

const isHijriLeapYear = (year: number): boolean => {
  const cycleYear = ((year - 1) % 30) + 1;
  return HIJRI_LEAP_YEAR_POSITIONS.has(cycleYear);
};

const getHijriMonthMaxDays = (month: number, year: number): number => {
  if (month < 1 || month > 12) return 30;

  if (month === 12) {
    return isHijriLeapYear(year) ? 30 : 29;
  }

  return month % 2 === 1 ? 30 : 29;
};

const applyHijriDayAdjustment = (
  dayRaw: string,
  monthRaw: number,
  yearRaw: string,
  adjustment: HijriAdjustmentValue,
): { day: number; month: number; year: number } => {
  let day = parseInt(dayRaw, 10);
  let month = monthRaw;
  let year = parseInt(yearRaw, 10);

  if (!Number.isFinite(day) || day < 1) day = 1;
  if (!Number.isFinite(month) || month < 1 || month > 12) month = 1;
  if (!Number.isFinite(year) || year < 1) year = 1446;

  day += adjustment;

  while (day < 1) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }

    day += getHijriMonthMaxDays(month, year);
  }

  while (true) {
    const maxDays = getHijriMonthMaxDays(month, year);
    if (day <= maxDays) {
      break;
    }

    day -= maxDays;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return { day, month, year };
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

export const getGlobalHijriAdjustment = async (country?: string): Promise<HijriAdjustmentValue> => {
  const settings = await HijriAdjustmentModel.findOne({ key: 'global' }).lean();
  const rawAdjustment = Number((settings as { adjustment?: number } | null)?.adjustment);
  const normalizedCountry = String(country || '').trim().toLowerCase();
  const isIndia = normalizedCountry.includes('india');

  if (settings && rawAdjustment === 1) {
    await HijriAdjustmentModel.updateOne({ key: 'global' }, { $set: { adjustment: 0 } });
    if (isIndia) {
      await HijriAdjustmentModel.updateOne(
        { key: 'global' },
        { $set: { adjustment: -1 } }
      );
      return -1;
    }

    return 0;
  }

  if (isIndia) {
    // India default must remain -1. If a legacy 0 exists without explicit admin actor,
    // normalize it back to -1 so calendar display matches local observation.
    const hasExplicitAdminOverride = Boolean((settings as { updatedBy?: unknown } | null)?.updatedBy);
    if (rawAdjustment === 0 && !hasExplicitAdminOverride) {
      await HijriAdjustmentModel.updateOne(
        { key: 'global' },
        { $set: { adjustment: -1 } },
        { upsert: true }
      );
      return -1;
    }

    if (rawAdjustment === -1 || rawAdjustment === 0) {
      return rawAdjustment;
    }

    return -1;
  }

  if (rawAdjustment === -1 || rawAdjustment === 0) {
    return rawAdjustment;
  }

  // Safe default for this deployment: local moon-sighting alignment.
  return -1;
};

export const setGlobalHijriAdjustment = async (
  adjustment: HijriAdjustmentValue,
  updatedBy?: string,
): Promise<HijriAdjustmentValue> => {
  const updatePayload: { adjustment: HijriAdjustmentValue; updatedBy?: string } = { adjustment };
  if (updatedBy) {
    updatePayload.updatedBy = updatedBy;
  }

  const updated = await HijriAdjustmentModel.findOneAndUpdate(
    { key: 'global' },
    { $set: updatePayload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const normalized = updated?.adjustment === -1 ? -1 : 0;
  return normalized as HijriAdjustmentValue;
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
  const perDateCacheKey = `hijri:corrected:${latKey}:${lonKey}:${date}:${adjustment}`;
  const lastKnownCacheKey = `hijri:last-known:${latKey}:${lonKey}`;

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
    const query = `date=${encodeURIComponent(date)}&latitude=${encodeURIComponent(String(latitude))}&longitude=${encodeURIComponent(String(longitude))}`;
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
    const adjusted = applyHijriDayAdjustment(parsed.day, parsed.monthNumber, parsed.year, adjustment);

    const monthEn = adjusted.month === parsed.monthNumber
      ? (parsed.monthEn || HIJRI_MONTH_NAMES[adjusted.month] || String(adjusted.month))
      : (HIJRI_MONTH_NAMES[adjusted.month] || String(adjusted.month));

    const result: CorrectedHijriDate = {
      day: String(adjusted.day),
      month: {
        number: adjusted.month,
        en: monthEn,
        ...(parsed.monthAr ? { ar: parsed.monthAr } : {}),
      },
      year: String(adjusted.year),
      date: makeDateString(adjusted.year, adjusted.month, adjusted.day),
      readable: makeReadable(adjusted.day, adjusted.month, adjusted.year),
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
