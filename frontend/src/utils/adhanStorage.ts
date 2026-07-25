// Shared storage for today's prayer times so the global Adhan scheduler can
// fire notifications/audio from any page, not just the Prayer Times page.

export const ADHAN_TIMES_STORAGE_KEY = 'hs-adhan-today';

export interface StoredAdhanTimes {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

interface AdhanTimesEnvelope {
  date: string; // local YYYY-MM-DD the times belong to
  times: StoredAdhanTimes;
}

export const getLocalDateKey = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const writeTodayAdhanTimes = (times: Partial<StoredAdhanTimes> | null | undefined) => {
  if (typeof window === 'undefined' || !times) return;

  const required: (keyof StoredAdhanTimes)[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  if (!required.every((key) => typeof times[key] === 'string' && (times[key] as string).length > 0)) {
    return;
  }

  try {
    const envelope: AdhanTimesEnvelope = {
      date: getLocalDateKey(),
      times: {
        Fajr: times.Fajr as string,
        Dhuhr: times.Dhuhr as string,
        Asr: times.Asr as string,
        Maghrib: times.Maghrib as string,
        Isha: times.Isha as string,
      },
    };
    window.localStorage.setItem(ADHAN_TIMES_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Ignore storage errors (private mode, quota, etc.)
  }
};

export const readTodayAdhanTimes = (): StoredAdhanTimes | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(ADHAN_TIMES_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as AdhanTimesEnvelope;
    if (!parsed?.times || parsed.date !== getLocalDateKey()) {
      return null;
    }
    return parsed.times;
  } catch {
    return null;
  }
};
