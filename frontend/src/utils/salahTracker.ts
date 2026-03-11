export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export type PrayerStatus = 'pending' | 'prayed' | 'qada' | 'missed';
export type QuranStatus = 'none' | 'read' | 'translation' | 'tafseer';

export interface PrayerEntry {
  status: PrayerStatus;
  note: string;
  updatedAt: string;
}

export interface QuranEntry {
  status: QuranStatus;
  updatedAt: string;
}

export interface DayRecord {
  prayers: Record<PrayerName, PrayerEntry>;
  quran: QuranEntry;
  dailyNote: string;
  updatedAt: string;
}

export type TrackerRecords = Record<string, DayRecord>;

export interface TrackerStorePayload {
  version: number;
  records: TrackerRecords;
}

export interface AuthLikeUser {
  id?: string;
  email?: string;
}

export interface TrackerAggregate {
  trackedDays: number;
  activeDays: number;
  perfectDays: number;
  prayersPrayed: number;
  prayersQada: number;
  prayersMissed: number;
  prayersPending: number;
  prayersLogged: number;
  averagePrayerScore: number;
  quranReadDays: number;
  quranTranslationDays: number;
  quranTafseerDays: number;
  averageQuranScore: number;
}

export interface DailyActivityItem {
  dateKey: string;
  prayed: number;
  qada: number;
  missed: number;
  pending: number;
  prayerScore: number;
  quranScore: number;
  quranStatus: QuranStatus;
  hasAnyActivity: boolean;
  note: string;
}

export const STORAGE_VERSION = 2;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const PRAYER_KEYS: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export const SCORE_BY_STATUS: Record<PrayerStatus, number> = {
  pending: 0,
  prayed: 1,
  qada: 0.7,
  missed: 0,
};

export const QURAN_SCORE_BY_STATUS: Record<QuranStatus, number> = {
  none: 0,
  read: 60,
  translation: 80,
  tafseer: 100,
};

export const QURAN_STATUS_LABEL: Record<QuranStatus, string> = {
  none: 'Not Read',
  read: 'Read (Arabic)',
  translation: 'Read + Translation',
  tafseer: 'Read + Tafseer',
};

const nowIso = (): string => new Date().toISOString();

export const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

export const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const formatReadableDate = (dateKey: string): string => {
  const parsed = parseDateKey(dateKey);
  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatCompactDate = (dateKey: string): string => {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const isPrayerStatus = (value: unknown): value is PrayerStatus => {
  return value === 'pending' || value === 'prayed' || value === 'qada' || value === 'missed';
};

const isQuranStatus = (value: unknown): value is QuranStatus => {
  return value === 'none' || value === 'read' || value === 'translation' || value === 'tafseer';
};

const createEmptyPrayerEntry = (): PrayerEntry => ({
  status: 'pending',
  note: '',
  updatedAt: nowIso(),
});

export const createDefaultDayRecord = (): DayRecord => {
  const prayers = {} as Record<PrayerName, PrayerEntry>;

  PRAYER_KEYS.forEach((prayerKey) => {
    prayers[prayerKey] = createEmptyPrayerEntry();
  });

  return {
    prayers,
    quran: {
      status: 'none',
      updatedAt: nowIso(),
    },
    dailyNote: '',
    updatedAt: nowIso(),
  };
};

export const normalizeDayRecord = (value: unknown): DayRecord => {
  const fallback = createDefaultDayRecord();

  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const unsafeValue = value as {
    prayers?: Record<string, any>;
    quran?: { status?: unknown; updatedAt?: unknown };
    dailyNote?: unknown;
    updatedAt?: unknown;
  };

  const prayers = {} as Record<PrayerName, PrayerEntry>;

  PRAYER_KEYS.forEach((prayerKey) => {
    const existingEntry = unsafeValue.prayers?.[prayerKey];

    prayers[prayerKey] = {
      status: isPrayerStatus(existingEntry?.status) ? existingEntry.status : 'pending',
      note: typeof existingEntry?.note === 'string' ? existingEntry.note : '',
      updatedAt: typeof existingEntry?.updatedAt === 'string' ? existingEntry.updatedAt : nowIso(),
    };
  });

  const quranStatus = unsafeValue.quran?.status;

  return {
    prayers,
    quran: {
      status: isQuranStatus(quranStatus) ? quranStatus : 'none',
      updatedAt: typeof unsafeValue.quran?.updatedAt === 'string' ? unsafeValue.quran.updatedAt : nowIso(),
    },
    dailyNote: typeof unsafeValue.dailyNote === 'string' ? unsafeValue.dailyNote : '',
    updatedAt: typeof unsafeValue.updatedAt === 'string' ? unsafeValue.updatedAt : nowIso(),
  };
};

export const normalizeRecords = (value: unknown): TrackerRecords => {
  const normalized: TrackerRecords = {};

  if (!value || typeof value !== 'object') {
    return normalized;
  }

  Object.entries(value as Record<string, unknown>).forEach(([dateKey, entry]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      normalized[dateKey] = normalizeDayRecord(entry);
    }
  });

  return normalized;
};

export const getSalahTrackerStorageKey = (user?: AuthLikeUser | null): string => {
  const userKey = user?.id || user?.email || 'guest';
  return `hikmah-salah-tracker:${userKey}`;
};

export const readTrackerFromStorage = (storageKey: string): TrackerRecords => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'records' in parsed) {
      return normalizeRecords((parsed as TrackerStorePayload).records);
    }

    return normalizeRecords(parsed);
  } catch (error) {
    console.error('Failed to parse Salah Tracker storage:', error);
    return {};
  }
};

export const writeTrackerToStorage = (storageKey: string, records: TrackerRecords): void => {
  try {
    const payload: TrackerStorePayload = {
      version: STORAGE_VERSION,
      records,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (error) {
    console.error('Failed to save Salah Tracker storage:', error);
  }
};

export const getLoggedCount = (dayRecord: DayRecord): number => {
  return PRAYER_KEYS.reduce((count, prayerKey) => {
    return dayRecord.prayers[prayerKey].status === 'pending' ? count : count + 1;
  }, 0);
};

export const countByStatus = (dayRecord: DayRecord, status: PrayerStatus): number => {
  return PRAYER_KEYS.reduce((count, prayerKey) => {
    return dayRecord.prayers[prayerKey].status === status ? count + 1 : count;
  }, 0);
};

export const getDayScore = (dayRecord: DayRecord): number => {
  const score = PRAYER_KEYS.reduce((sum, prayerKey) => {
    return sum + SCORE_BY_STATUS[dayRecord.prayers[prayerKey].status];
  }, 0);

  return Math.round((score / PRAYER_KEYS.length) * 100);
};

export const getQuranScore = (dayRecord: DayRecord): number => {
  return QURAN_SCORE_BY_STATUS[dayRecord.quran.status];
};

export const isActiveDay = (dayRecord: DayRecord): boolean => {
  return PRAYER_KEYS.every((prayerKey) => dayRecord.prayers[prayerKey].status !== 'pending');
};

export const isPerfectDay = (dayRecord: DayRecord): boolean => {
  return PRAYER_KEYS.every((prayerKey) => dayRecord.prayers[prayerKey].status === 'prayed');
};

export const hasQuranRead = (dayRecord: DayRecord): boolean => {
  return dayRecord.quran.status !== 'none';
};

export const getCurrentStreak = (records: TrackerRecords, fromDateKey: string): number => {
  let streak = 0;
  let cursor = parseDateKey(fromDateKey);

  while (true) {
    const key = formatDateKey(cursor);
    const day = records[key];

    if (!day || !isActiveDay(normalizeDayRecord(day))) {
      break;
    }

    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
};

export const getBestStreak = (records: TrackerRecords): number => {
  const activeDateKeys = Object.keys(records)
    .filter((key) => isActiveDay(normalizeDayRecord(records[key])))
    .sort();

  if (activeDateKeys.length === 0) {
    return 0;
  }

  let best = 1;
  let current = 1;

  for (let i = 1; i < activeDateKeys.length; i += 1) {
    const previousDate = parseDateKey(activeDateKeys[i - 1]);
    const currentDate = parseDateKey(activeDateKeys[i]);
    const diff = Math.round((currentDate.getTime() - previousDate.getTime()) / DAY_MS);

    if (diff === 1) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }

  return best;
};

export const filterRecordsFromDate = (records: TrackerRecords, startDateKey: string): TrackerRecords => {
  const filtered: TrackerRecords = {};

  Object.entries(records).forEach(([dateKey, day]) => {
    if (dateKey >= startDateKey) {
      filtered[dateKey] = day;
    }
  });

  return filtered;
};

export const getAggregatedStats = (records: TrackerRecords): TrackerAggregate => {
  const dateKeys = Object.keys(records);

  if (dateKeys.length === 0) {
    return {
      trackedDays: 0,
      activeDays: 0,
      perfectDays: 0,
      prayersPrayed: 0,
      prayersQada: 0,
      prayersMissed: 0,
      prayersPending: 0,
      prayersLogged: 0,
      averagePrayerScore: 0,
      quranReadDays: 0,
      quranTranslationDays: 0,
      quranTafseerDays: 0,
      averageQuranScore: 0,
    };
  }

  let activeDays = 0;
  let perfectDays = 0;
  let prayersPrayed = 0;
  let prayersQada = 0;
  let prayersMissed = 0;
  let prayersPending = 0;
  let prayerScoreTotal = 0;
  let quranReadDays = 0;
  let quranTranslationDays = 0;
  let quranTafseerDays = 0;
  let quranScoreTotal = 0;

  dateKeys.forEach((dateKey) => {
    const day = normalizeDayRecord(records[dateKey]);

    if (isActiveDay(day)) {
      activeDays += 1;
    }

    if (isPerfectDay(day)) {
      perfectDays += 1;
    }

    prayersPrayed += countByStatus(day, 'prayed');
    prayersQada += countByStatus(day, 'qada');
    prayersMissed += countByStatus(day, 'missed');
    prayersPending += countByStatus(day, 'pending');
    prayerScoreTotal += getDayScore(day);

    if (day.quran.status !== 'none') {
      quranReadDays += 1;
    }
    if (day.quran.status === 'translation') {
      quranTranslationDays += 1;
    }
    if (day.quran.status === 'tafseer') {
      quranTafseerDays += 1;
    }

    quranScoreTotal += getQuranScore(day);
  });

  return {
    trackedDays: dateKeys.length,
    activeDays,
    perfectDays,
    prayersPrayed,
    prayersQada,
    prayersMissed,
    prayersPending,
    prayersLogged: prayersPrayed + prayersQada + prayersMissed,
    averagePrayerScore: Math.round(prayerScoreTotal / dateKeys.length),
    quranReadDays,
    quranTranslationDays,
    quranTafseerDays,
    averageQuranScore: Math.round(quranScoreTotal / dateKeys.length),
  };
};

export const getDailyActivity = (records: TrackerRecords, limit = 30): DailyActivityItem[] => {
  return Object.entries(records)
    .map(([dateKey, rawDay]) => {
      const day = normalizeDayRecord(rawDay);
      const prayed = countByStatus(day, 'prayed');
      const qada = countByStatus(day, 'qada');
      const missed = countByStatus(day, 'missed');
      const pending = countByStatus(day, 'pending');
      const prayerScore = getDayScore(day);
      const quranScore = getQuranScore(day);
      const hasAnyActivity = prayed + qada + missed > 0 || day.quran.status !== 'none' || day.dailyNote.trim().length > 0;

      return {
        dateKey,
        prayed,
        qada,
        missed,
        pending,
        prayerScore,
        quranScore,
        quranStatus: day.quran.status,
        hasAnyActivity,
        note: day.dailyNote,
      };
    })
    .filter((item) => item.hasAnyActivity)
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))
    .slice(0, limit);
};
