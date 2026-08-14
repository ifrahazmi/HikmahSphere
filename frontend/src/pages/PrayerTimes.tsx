import React, { useState, useEffect, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ClockIcon,
  MapPinIcon,
  SunIcon,
  MoonIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  CloudIcon,
  BoltIcon,
  Cog6ToothIcon,
  InformationCircleIcon,
  CalendarDaysIcon,
  SparklesIcon,
  BookOpenIcon,
  ShareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { useUserPreferences } from '../hooks/useUserPreferences';
import LoadingSpinner from '../components/LoadingSpinner';
import IslamicCalendar from '../components/IslamicCalendar';
import PageSEO from '../components/PageSEO';
import MosqueFinder from '../components/mosques/MosqueFinder';
import { API_URL } from '../config';
import { IslamicReminder, getCurrentPrayerWindow, selectReminder } from '../data/islamicReminders';
import { writeTodayAdhanTimes } from '../utils/adhanStorage';

interface HijriDate {
  day: string;
  month: { number: number; en: string };
  year: string;
  readable?: string;
}

interface ExtraPrayerTimingCard {
  key: 'tahajjud' | 'ishraq' | 'duha';
  title: string;
  badge: string;
  badgeClassName: string;
  rakats: string;
  time: string;
  range: string;
  summary: string;
  details: string;
  accentClassName: string;
}

interface PrayerPageCacheEnvelope<T> {
  timestamp: number;
  data: T;
}

interface DailyPrayerCacheData {
  prayerData: any;
  fastingData: any;
  weatherData: any;
  islamicEvents: any[];
  isRamadanMonth: boolean;
  currentHijriDate: HijriDate | null;
  nextHijriDate: HijriDate | null;
  nextDayPrayerData: any;
  nextDayFastingData: any;
  ramadanData: any;
}

interface PrayerTuningState {
  offsets: {
    fajr: number;
    dhuhr: number;
    asr: number;
    maghrib: number;
    isha: number;
    imsak: number;
  };
  applyToFasting: boolean;
  updatedAt: string | null;
}

type RakatType = 'Fard' | 'Sunnah Muakkadah' | 'Sunnah Ghair Muakkadah' | 'Nafl' | 'Witr (Wajib)';

interface RakatEntry {
  type: RakatType;
  rakat: number | string;
}

const PRAYER_RAKAT_BREAKDOWN: Record<'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha', RakatEntry[]> = {
  Fajr: [
    { type: 'Sunnah Muakkadah', rakat: 2 },
    { type: 'Fard', rakat: 2 },
  ],
  Dhuhr: [
    { type: 'Sunnah Muakkadah', rakat: 4 },
    { type: 'Fard', rakat: 4 },
    { type: 'Sunnah Muakkadah', rakat: 2 },
    { type: 'Nafl', rakat: 2 },
  ],
  Asr: [
    { type: 'Sunnah Ghair Muakkadah', rakat: 4 },
    { type: 'Fard', rakat: 4 },
  ],
  Maghrib: [
    { type: 'Fard', rakat: 3 },
    { type: 'Sunnah Muakkadah', rakat: 2 },
    { type: 'Nafl', rakat: 2 },
  ],
  Isha: [
    { type: 'Sunnah Ghair Muakkadah', rakat: 4 },
    { type: 'Fard', rakat: 4 },
    { type: 'Sunnah Muakkadah', rakat: 2 },
    { type: 'Nafl', rakat: 2 },
    { type: 'Witr (Wajib)', rakat: 3 },
  ],
};

const SUNRISE_RAKAT_BREAKDOWN: RakatEntry[] = [
  { type: 'Nafl', rakat: 2 },
  { type: 'Nafl', rakat: '2-8' },
];

const RAKAT_TYPE_META: Record<RakatType, { icon: string; colorClassName: string; meaning: string }> = {
  Fard: {
    icon: '🔴',
    colorClassName: 'text-red-600',
    meaning: 'Obligatory',
  },
  'Sunnah Muakkadah': {
    icon: '🟢',
    colorClassName: 'text-green-600',
    meaning: 'Strongly emphasized Sunnah',
  },
  'Sunnah Ghair Muakkadah': {
    icon: '🟡',
    colorClassName: 'text-yellow-600',
    meaning: 'Less emphasized Sunnah',
  },
  Nafl: {
    icon: '⚪',
    colorClassName: 'text-gray-600',
    meaning: 'Optional',
  },
  'Witr (Wajib)': {
    icon: '🟣',
    colorClassName: 'text-purple-600',
    meaning: 'Wajib after Isha',
  },
};

const HIJRI_MONTH_NAMES: Record<number, string> = {
  1: 'Muharram',
  2: 'Safar',
  3: 'Rabi al-Awwal',
  4: 'Rabi al-Thani',
  5: 'Jumada al-Awwal',
  6: 'Jumada al-Thani',
  7: 'Rajab',
  8: "Sha'ban",
  9: 'Ramadan',
  10: 'Shawwal',
  11: 'Dhul Qada',
  12: 'Dhul Hijjah',
};

const HIJRI_MONTH_NUMBERS: Record<string, number> = {
  muharram: 1,
  safar: 2,
  'rabi al-awwal': 3,
  'rabi al awwal': 3,
  'rabiul awwal': 3,
  'rabi al-thani': 4,
  'rabi al thani': 4,
  'rabiul akhir': 4,
  'jumada al-awwal': 5,
  'jumada al awwal': 5,
  'jumada al-thani': 6,
  'jumada al thani': 6,
  rajab: 7,
  "sha'ban": 8,
  shaban: 8,
  ramadan: 9,
  'ramaḍān': 9,
  shawwal: 10,
  'shawwāl': 10,
  'dhul qada': 11,
  'dhu al-qadah': 11,
  'dhul hijjah': 12,
  'dhū al-ḥijjah': 12,
};

const PRAYER_PAGE_CACHE_PREFIX = 'hikmah-sphere:prayer-times:v3';
const PRAYER_PAGE_CACHE_TTL_MS = Math.max(
  1,
  Number(process.env.REACT_APP_PRAYER_TIMES_CACHE_TTL) || 15,
) * 60 * 1000;

const DEFAULT_PRAYER_TUNING: PrayerTuningState = {
  offsets: {
    fajr: 0,
    dhuhr: 0,
    asr: 0,
    maghrib: 0,
    isha: 0,
    imsak: 0,
  },
  applyToFasting: true,
  updatedAt: null,
};

const HIJRI_INTL_LONG_FORMATTER = new Intl.DateTimeFormat('en-SA-u-ca-islamic-umalqura', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const parseGregorianDDMMYYYY = (value?: string): Date | null => {
  if (!value) return null;
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (!day || !month || !year) return null;

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const formatGregorianDDMMYYYY = (value: Date): string => (
  `${String(value.getDate()).padStart(2, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${value.getFullYear()}`
);

const formatOrdinal = (value: number): string => {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return `${value}st`;
  if (mod10 === 2 && mod100 !== 12) return `${value}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${value}rd`;
  return `${value}th`;
};

const addDaysToGregorianDDMMYYYY = (value: string, days: number): string | null => {
  const parsed = parseGregorianDDMMYYYY(value);
  if (!parsed) return null;
  parsed.setDate(parsed.getDate() + days);
  return formatGregorianDDMMYYYY(parsed);
};

const normalizeCacheValue = (value?: string): string => (
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'na'
);

const buildPrayerCacheKey = (
  scope: 'daily' | 'monthly' | 'ramadan',
  options: {
    lat: number;
    lon: number;
    city?: string;
    country?: string;
    date?: string;
    method: number;
    school: number;
    highLatitudeRule?: number;
    month?: number;
    year?: number;
    tuningMarker?: string;
  },
): string => {
  const baseKey = [
    scope,
    options.lat.toFixed(3),
    options.lon.toFixed(3),
    normalizeCacheValue(options.city),
    normalizeCacheValue(options.country),
    normalizeCacheValue(options.date),
    `m${options.method}`,
    `s${options.school}`,
    `hlr${options.highLatitudeRule ?? 0}`,
    `tm${normalizeCacheValue(options.tuningMarker)}`,
  ];

  if (typeof options.month === 'number') {
    baseKey.push(`mo${options.month}`);
  }
  if (typeof options.year === 'number') {
    baseKey.push(`yr${options.year}`);
  }

  return `${PRAYER_PAGE_CACHE_PREFIX}:${baseKey.join(':')}`;
};

const readPrayerCache = <T,>(key: string): T | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PrayerPageCacheEnvelope<T>;
    if (!parsed?.timestamp || !('data' in parsed)) {
      window.localStorage.removeItem(key);
      return null;
    }

    if (Date.now() - parsed.timestamp > PRAYER_PAGE_CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.warn('Prayer cache read failed:', error);
    return null;
  }
};

const writePrayerCache = <T,>(key: string, data: T) => {
  if (typeof window === 'undefined') return;

  try {
    const payload: PrayerPageCacheEnvelope<T> = {
      timestamp: Date.now(),
      data,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.warn('Prayer cache write failed:', error);
  }
};

const parseGregorianYYYYMMDDLocal = (value?: string): Date | null => {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (!year || !month || !day) return null;

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const normalizeHijriMonthName = (value?: string): string => (
  (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
);

const buildHijriDateFromFastingEntry = (entry: any): HijriDate | null => {
  if (!entry) return null;

  const hijriIso = typeof entry.hijri === 'string' ? entry.hijri : '';
  const readable = typeof entry.hijri_readable === 'string' ? entry.hijri_readable : '';
  const isoMatch = hijriIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const ddmmyyyyMatch = hijriIso.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  const readableMatch = readable.match(/^(\d{1,2})\s+(.+?)\s+(\d{4})/);

  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (year && month && day) {
      return {
        day: String(day),
        month: {
          number: month,
          en: readableMatch?.[2]?.trim() || HIJRI_MONTH_NAMES[month] || '',
        },
        year: String(year),
        readable: readable || undefined,
      };
    }
  }

  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10);
    const year = parseInt(ddmmyyyyMatch[3], 10);
    if (year && month && day) {
      return {
        day: String(day),
        month: {
          number: month,
          en: readableMatch?.[2]?.trim() || HIJRI_MONTH_NAMES[month] || '',
        },
        year: String(year),
        readable: readable || undefined,
      };
    }
  }

  if (readableMatch) {
    const monthName = readableMatch[2].trim();
    return {
      day: readableMatch[1],
      month: {
        number: HIJRI_MONTH_NUMBERS[normalizeHijriMonthName(monthName)] || 0,
        en: monthName,
      },
      year: readableMatch[3],
      readable,
    };
  }

  return null;
};

const buildHijriDateFromPrayerSource = (hijri: any): HijriDate | null => {
  if (!hijri) return null;

  return {
    day: String(hijri.day || ''),
    month: {
      number: Number(hijri.month?.number) || 0,
      en: String(hijri.month?.en || ''),
    },
    year: String(hijri.year || ''),
  };
};

const buildHijriDateFromGregorianDate = (date: Date): HijriDate | null => {
  const parts = HIJRI_INTL_LONG_FORMATTER.formatToParts(date);
  const day = parseInt(parts.find((part) => part.type === 'day')?.value ?? '', 10);
  const monthName = parts.find((part) => part.type === 'month')?.value ?? '';
  const year = parseInt(parts.find((part) => part.type === 'year')?.value ?? '', 10);

  if (!day || !monthName || !year) return null;

  return {
    day: String(day),
    month: {
      number: HIJRI_MONTH_NUMBERS[normalizeHijriMonthName(monthName)] || 0,
      en: monthName,
    },
    year: String(year),
  };
};

const getHijriObservationOffsetDays = (country?: string): number => {
  const normalizedCountry = String(country || '').trim().toLowerCase();

  // India frequently follows local moon sighting one day behind
  // the astronomical calendar source used by Aladhan/Umm al-Qura.
  if (normalizedCountry.includes('india')) {
    return -1;
  }

  return 0;
};

const buildLocationAwareHijriDateFromGregorianDate = (
  date: Date,
  country?: string,
  offsetOverride?: number | null,
): HijriDate | null => {
  const adjustedDate = new Date(date);
  // When a global admin-controlled offset is available, it is the single source of
  // truth; otherwise fall back to the country-based default (India = -1).
  const offsetDays = typeof offsetOverride === 'number' && Number.isFinite(offsetOverride)
    ? offsetOverride
    : getHijriObservationOffsetDays(country);

  if (offsetDays !== 0) {
    adjustedDate.setDate(adjustedDate.getDate() + offsetDays);
  }

  return buildHijriDateFromGregorianDate(adjustedDate);
};

const formatHijriReadable = (hijri?: HijriDate | null): string => {
  if (!hijri) return '';

  const parts = [hijri.day, hijri.month?.en, hijri.year]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return parts.join(' ');
};

const resolvePreferredHijriDate = (
  primary?: HijriDate | null,
  fallback?: HijriDate | null,
): HijriDate | null => {
  if (!primary) return fallback || null;
  if (!fallback) return primary;

  const primaryMonth = Number(primary.month?.number) || 0;
  const fallbackMonth = Number(fallback.month?.number) || 0;
  const primaryYear = parseInt(String(primary.year || ''), 10);
  const fallbackYear = parseInt(String(fallback.year || ''), 10);
  const primaryDay = parseInt(String(primary.day || ''), 10) || 0;
  const fallbackDay = parseInt(String(fallback.day || ''), 10) || 0;

  // If year and month match, prefer the one that's closer (within 1 day)
  if (primaryMonth === fallbackMonth && primaryYear === fallbackYear) {
    return Math.abs(primaryDay - fallbackDay) <= 1 ? primary : fallback;
  }

  // If months differ by exactly 1 (month boundary), check if dates are consecutive
  const monthDiff = (primaryYear - fallbackYear) * 12 + (primaryMonth - fallbackMonth);
  if (Math.abs(monthDiff) === 1) {
    // Primary is next month, fallback is current month - check if primary day 1 and fallback day 29/30
    if (monthDiff === 1 && primaryDay === 1 && (fallbackDay === 29 || fallbackDay === 30)) {
      return primary; // Consecutive days across month boundary
    }
    // Fallback is next month, primary is current month
    if (monthDiff === -1 && fallbackDay === 1 && (primaryDay === 29 || primaryDay === 30)) {
      return primary; // Primary is the current day
    }
  }

  // For all other cases, prefer the API data (primary) as it's the authoritative source
  return primary;
};

const incrementHijriByOneDay = (hijri?: HijriDate | null): HijriDate | null => {
  if (!hijri) return null;

  const currentDay = parseInt(hijri.day, 10);
  let monthNum = hijri.month.number;
  let year = parseInt(hijri.year, 10);
  if (!currentDay || !year) return null;
  if (!monthNum) monthNum = 1;

  // Days in each Hijri month (approximate - actual moon sighting may vary)
  // Months with 30 days: 1, 3, 5, 7, 9, 11 (Muharram, Rabi I, Jumada I, Rajab, Ramadan, Dhul Qada)
  // Months with 29 days: 2, 4, 6, 8, 10, 12 (Safar, Rabi II, Jumada II, Sha'ban, Shawwal, Dhul Hijjah)
  // Note: Dhul Hijjah can have 30 days in leap years
  const daysInMonth = [0, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
  
  const maxDaysInCurrentMonth = monthNum >= 1 && monthNum <= 12 ? daysInMonth[monthNum] : 30;
  
  let nextDay = currentDay + 1;
  if (nextDay > maxDaysInCurrentMonth) {
    nextDay = 1;
    monthNum += 1;
    if (monthNum > 12) {
      monthNum = 1;
      year += 1;
    }
  }

  return {
    day: String(nextDay),
    month: {
      number: monthNum,
      en: HIJRI_MONTH_NAMES[monthNum] || hijri.month.en,
    },
    year: String(year),
  };
};

const PrayerTimes: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { preferences: userPrefs, updatePreference } = useUserPreferences();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{lat: number; lon: number; city?: string; country?: string} | null>(null);
  const [detectedCountry, setDetectedCountry] = useState<string>('');
  const [cityQuery, setCityQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showExtraPrayerInfo, setShowExtraPrayerInfo] = useState(false);
  const [activeFlippedCard, setActiveFlippedCard] = useState<string | null>(null);
  const [openGuideCard, setOpenGuideCard] = useState<string | null>(null);
  const [locationPermissionNeeded, setLocationPermissionNeeded] = useState(false);
  const allowDurableClientCacheRef = useRef(true);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialViewMode = searchParams.get('tab') === 'mosques' ? 'mosques' : 'daily';
  // View mode and settings
  const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'ramadan' | 'mosques'>(initialViewMode);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['daily', 'monthly', 'ramadan', 'mosques'].includes(tab)) {
      setViewMode(tab as any);
    } else if (!tab) {
      setViewMode('daily');
    }
  }, [searchParams]);

  const handleViewModeChange = useCallback((mode: 'daily' | 'monthly' | 'ramadan' | 'mosques') => {
    setViewMode(mode);
    setSearchParams(mode === 'daily' ? {} : { tab: mode });
  }, [setSearchParams]);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [ramadanData, setRamadanData] = useState<any>(null);
  const [, setIsRamadanMonth] = useState(false);

  // Calculation method settings
  const [selectedMadhab, setSelectedMadhab] = useState<string>(
    userPrefs.asrMethod === 'hanafi' ? 'hanafi' : 'shafi'
  );
  
  // Sync from userPrefs to selectedMadhab if changed from outside
  useEffect(() => {
    setSelectedMadhab(userPrefs.asrMethod === 'hanafi' ? 'hanafi' : 'shafi');
  }, [userPrefs.asrMethod]);

  const [calculationMethod, setCalculationMethod] = useState(1); // Default: University of Islamic Sciences, Karachi
  const [highLatitudeRule, setHighLatitudeRule] = useState(1); // Default: Middle of Night
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');

  // Prayer tuning (admin only)
  const [prayerTuning, setPrayerTuning] = useState<PrayerTuningState>(DEFAULT_PRAYER_TUNING);
  const [isPrayerTuningLoading, setIsPrayerTuningLoading] = useState(false);
  const [isPrayerTuningSaving, setIsPrayerTuningSaving] = useState(false);
  const [hasPrayerTuningLoaded, setHasPrayerTuningLoaded] = useState(false);
  const [prayerTuningError, setPrayerTuningError] = useState<string | null>(null);
  const [prayerTuningMessage, setPrayerTuningMessage] = useState<string | null>(null);
  const [globalTuningMarker, setGlobalTuningMarker] = useState<string>('unknown');

  // Global Hijri date adjustment (admin controlled, applies to all users)
  const HIJRI_ADJUSTMENT_MIN = -2;
  const HIJRI_ADJUSTMENT_MAX = 2;
  const [hijriAdjustment, setHijriAdjustment] = useState<number | null>(null);
  const [hijriAdjustmentInput, setHijriAdjustmentInput] = useState<number>(0);
  const [isHijriAdjustmentSaving, setIsHijriAdjustmentSaving] = useState(false);
  const [hijriAdjustmentError, setHijriAdjustmentError] = useState<string | null>(null);
  const [hijriAdjustmentMessage, setHijriAdjustmentMessage] = useState<string | null>(null);

  // Data states
  const [prayerData, setPrayerData] = useState<any>(null);
  const [fastingData, setFastingData] = useState<any>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [islamicEvents, setIslamicEvents] = useState<any[]>([]);
  const [currentReminder, setCurrentReminder] = useState<IslamicReminder | null>(null);
  const [currentHijriDate, setCurrentHijriDate] = useState<HijriDate | null>(null);
  const [nextHijriDate, setNextHijriDate] = useState<HijriDate | null>(null);
  const [nextDayPrayerData, setNextDayPrayerData] = useState<any>(null);
  const [nextDayFastingData, setNextDayFastingData] = useState<any>(null);

  // Share image generation states
  const [showRatioModal, setShowRatioModal] = useState(false);
  const [shareType, setShareType] = useState<'dua' | 'hadith'>('dua');
  const [selectedRatio, setSelectedRatio] = useState<'story' | 'post'>('story');
  const duaImageRef = useRef<HTMLDivElement>(null);
  const hadithImageRef = useRef<HTMLDivElement>(null);
  const extraPrayerInfoRef = useRef<HTMLDivElement>(null);

  // Countdown timer states
  const [currentPrayerIndex, setCurrentPrayerIndex] = useState(-1);
  const [nextPrayerIndex, setNextPrayerIndex] = useState(-1);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isNextDay, setIsNextDay] = useState(false);

  // Refs for prayer cards to enable auto-scroll
  const prayerCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasScrolledToPrayerRef = useRef(false);
  const hasScrolledToRamadanRef = useRef(false);
  const prayersContainerRef = useRef<HTMLDivElement>(null);
  const hijriFetchRequestIdRef = useRef(0);
  const hasRefreshedAtMaghribRef = useRef(false);
  const currentGregorianDateRef = useRef(formatGregorianDDMMYYYY(new Date()));
  const normalizedRole = String(user?.role || '').toLowerCase();
  const canManagePrayerTuning = Boolean(
    user && (user.isAdmin === true || normalizedRole === 'superadmin' || normalizedRole === 'admin')
  );

  const refreshGlobalTuningMarker = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/prayers/tuning`);
      const payload = await response.json();

      if (payload?.status !== 'success' || !payload?.data) {
        return;
      }

      const offsets = payload.data.offsets || {};
      const marker = [
        payload.data.updatedAt || 'na',
        Number(offsets.fajr) || 0,
        Number(offsets.dhuhr) || 0,
        Number(offsets.asr) || 0,
        Number(offsets.maghrib) || 0,
        Number(offsets.isha) || 0,
        Number(offsets.imsak) || 0,
        payload.data.applyToFasting ? 1 : 0,
      ].join('|');

      setGlobalTuningMarker(marker);
    } catch (markerError) {
      console.warn('Unable to refresh global tuning marker:', markerError);
    }
  }, []);

  useEffect(() => {
    refreshGlobalTuningMarker();
  }, [refreshGlobalTuningMarker]);

  const refreshHijriAdjustment = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/prayers/hijri-adjustment/public`);
      const payload = await response.json();

      if (payload?.status === 'success' && payload?.data && payload.data.adjustment != null) {
        const value = Number(payload.data.adjustment);
        if (Number.isFinite(value)) {
          setHijriAdjustment(value);
          setHijriAdjustmentInput(value);
        }
      }
    } catch (adjustmentError) {
      console.warn('Unable to refresh global Hijri adjustment:', adjustmentError);
    }
  }, []);

  useEffect(() => {
    refreshHijriAdjustment();
  }, [refreshHijriAdjustment]);

  useEffect(() => {
    if (!showExtraPrayerInfo) return;

    const handlePointerOutside = (event: PointerEvent) => {
      if (!extraPrayerInfoRef.current?.contains(event.target as Node)) {
        setShowExtraPrayerInfo(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerOutside);
    return () => document.removeEventListener('pointerdown', handlePointerOutside);
  }, [showExtraPrayerInfo]);

  useEffect(() => {
    if (!showExtraPrayerInfo || typeof window === 'undefined') return;

    const scrollY = window.scrollY;
    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;
    const previousHtmlOverflow = documentElement.style.overflow;

    documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    return () => {
      documentElement.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
    };
  }, [showExtraPrayerInfo]);

  const resolveLocationDetails = useCallback(async (lat: number, lon: number): Promise<{ city?: string; country?: string }> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
      );
      const data = await response.json();
      const address = data?.address || {};

      const city =
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        address.state ||
        '';
      const country = address.country || '';

      if (country) {
        setDetectedCountry(country);
      }
      if (city) {
        setCityQuery((prev) => prev || city);
      }
      if (city || country) {
        setLocation((prev) => (
          prev && prev.lat === lat && prev.lon === lon
            ? {
                ...prev,
                ...(city ? { city } : {}),
                ...(country ? { country } : {}),
              }
            : prev
        ));
      }
      return {
        ...(city ? { city } : {}),
        ...(country ? { country } : {}),
      };
    } catch (err) {
      console.warn('Reverse geocoding failed:', err);
      return {};
    }
  }, []);

  const persistUserLocation = useCallback(async (
    lat: number,
    lon: number,
    city?: string,
    country?: string,
  ) => {
    if (!user?.id) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    const school = selectedMadhab === 'hanafi' ? 2 : 1;
    try {
      await fetch(`${API_URL}/users/${user.id}/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: lat,
          longitude: lon,
          city,
          country,
          method: calculationMethod,
          school,
        }),
      });
      allowDurableClientCacheRef.current = true;
      setLocationPermissionNeeded(false);
    } catch (err) {
      console.warn('Failed to save user location:', err);
    }
  // selectedMadhab / calculationMethod read at call time; omit from deps so
  // location bootstrap does not re-run when settings change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    const bootstrapLocation = async () => {
      setLoading(true);

      // Logged-in: prefer saved DB location so we skip GPS and load from cache.
      if (user?.id) {
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const response = await fetch(`${API_URL}/users/${user.id}/location`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
              const payload = await response.json();
              const saved = payload?.location;
              if (
                !cancelled
                && saved
                && Number.isFinite(Number(saved.latitude))
                && Number.isFinite(Number(saved.longitude))
              ) {
                allowDurableClientCacheRef.current = true;
                setLocationPermissionNeeded(false);
                setLocation({
                  lat: Number(saved.latitude),
                  lon: Number(saved.longitude),
                  city: saved.city,
                  country: saved.country,
                });
                if (saved.city) setCityQuery(saved.city);
                if (saved.country) setDetectedCountry(saved.country);
                return;
              }
            }
          } catch (err) {
            console.warn('Failed to load saved location:', err);
          }
        }

        if (cancelled) return;

        // No saved location — ask every visit until granted.
        if (!navigator.geolocation) {
          allowDurableClientCacheRef.current = false;
          setLocationPermissionNeeded(true);
          setLoading(false);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            if (cancelled) return;
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            allowDurableClientCacheRef.current = true;
            setLocationPermissionNeeded(false);
            setLocation({ lat, lon });
            const details = await resolveLocationDetails(lat, lon);
            await persistUserLocation(lat, lon, details.city, details.country);
          },
          (err) => {
            if (cancelled) return;
            console.warn('Geolocation denied or failed:', err);
            allowDurableClientCacheRef.current = false;
            setLocationPermissionNeeded(true);
            setLoading(false);
          },
        );
        return;
      }

      // Guests: GPS with Bengaluru fallback; durable client cache allowed.
      allowDurableClientCacheRef.current = true;
      setLocationPermissionNeeded(false);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            if (cancelled) return;
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            setLocation({ lat, lon });
            await resolveLocationDetails(lat, lon);
          },
          (err) => {
            if (cancelled) return;
            console.warn('Geolocation denied or failed:', err);
            setLocation({ lat: 12.96, lon: 77.57, city: 'Bengaluru', country: 'India' });
            setDetectedCountry('India');
            setCityQuery('Bengaluru');
          },
        );
      } else {
        setLocation({ lat: 12.96, lon: 77.57, city: 'Bengaluru', country: 'India' });
        setDetectedCountry('India');
        setCityQuery('Bengaluru');
      }
    };

    void bootstrapLocation();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, resolveLocationDetails, persistUserLocation]);

  const activeCountry = location?.country || detectedCountry || '';
  const isOutsideIndia = !!activeCountry && activeCountry !== 'Unknown' && !activeCountry.toLowerCase().includes('india');

  useEffect(() => {
    // Default behavior by location:
    // India -> 12h, Outside India -> 24h (user can still change it manually)
    if (!activeCountry) return;
    setTimeFormat(isOutsideIndia ? '24h' : '12h');
  }, [activeCountry, isOutsideIndia]);

  useEffect(() => {
    if (location) {
      console.log('🔄 Location changed, fetching data:', { 
        lat: location.lat, 
        lon: location.lon, 
        city: location.city, 
        country: location.country,
        viewMode 
      });
      if (viewMode === 'daily') {
        fetchData(location.lat, location.lon, location.city, location.country);
      } else if (viewMode === 'monthly') {
        fetchMonthlyData(location.lat, location.lon, selectedMonth, selectedYear);
      } else if (viewMode === 'ramadan') {
        fetchRamadanData(location.lat, location.lon);
      } else if (viewMode === 'mosques') {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, selectedMadhab, calculationMethod, highLatitudeRule, viewMode, selectedMonth, selectedYear]);

  const fetchData = useCallback(async (lat: number, lon: number, city?: string, country?: string) => {
    setLoading(true);
    setError(null);
    setCurrentHijriDate(null);
    setNextHijriDate(null);
    setNextDayPrayerData(null);
    setNextDayFastingData(null);
    const requestId = Date.now();
    hijriFetchRequestIdRef.current = requestId;

    // Convert madhab to school parameter (Backend API: 1=Shafi/Maliki/Hanbali, 2=Hanafi)
    const school = selectedMadhab === 'hanafi' ? 2 : 1;
    const requestGregorianDate = formatGregorianDDMMYYYY(new Date());
    currentGregorianDateRef.current = requestGregorianDate;
    const dailyCacheKey = buildPrayerCacheKey('daily', {
      lat,
      lon,
      city,
      country,
      date: requestGregorianDate,
      method: calculationMethod,
      school,
      highLatitudeRule,
      tuningMarker: globalTuningMarker,
    });

    const cachedDailyData = allowDurableClientCacheRef.current
      ? readPrayerCache<DailyPrayerCacheData>(dailyCacheKey)
      : null;
    if (cachedDailyData) {
      setPrayerData(cachedDailyData.prayerData);
      setFastingData(cachedDailyData.fastingData);
      setWeatherData(cachedDailyData.weatherData);
      setIslamicEvents(cachedDailyData.islamicEvents || []);
      setIsRamadanMonth(Boolean(cachedDailyData.isRamadanMonth));
      setCurrentHijriDate(cachedDailyData.currentHijriDate || null);
      setNextHijriDate(cachedDailyData.nextHijriDate || null);
      setNextDayPrayerData(cachedDailyData.nextDayPrayerData || null);
      setNextDayFastingData(cachedDailyData.nextDayFastingData || null);
      setRamadanData(cachedDailyData.ramadanData || null);
      setLoading(false);
      return;
    }

    try {
      // Fetch Prayer Times from Backend API
      let prayerUrl = '';

      // Use city-based API if valid city and country are available
      if (city && city !== 'Unknown' && country && country !== 'Unknown') {
        prayerUrl = `${API_URL}/prayers/timesByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${calculationMethod}&school=${school}&date=${encodeURIComponent(requestGregorianDate)}`;
      } else {
        // Fallback to coordinates-based API
        prayerUrl = `${API_URL}/prayers/times?latitude=${lat}&longitude=${lon}&method=${calculationMethod}&school=${school}&date=${encodeURIComponent(requestGregorianDate)}`;
      }

      console.log('Fetching prayer times from backend:', prayerUrl);
      const prayerRes = await fetch(prayerUrl);
      const prayerJson = await prayerRes.json();
      if (hijriFetchRequestIdRef.current !== requestId) return;

      // Hoisted so fasting logic below can read it regardless of the prayer status branch
      let isRamadan = false;
      let events: any[] = [];

      if (prayerJson.status === 'success') {
        setPrayerData(prayerJson.data);

        // Extract Islamic events from the response
        const hijriMonth = prayerJson.data?.date?.hijri?.month?.en;
        const hijriDay = prayerJson.data?.date?.hijri?.day;

        // Check if current month is Ramadan
        // Use month number (9) as primary check — covers both islamicapi.com and Aladhan
        // islamicapi.com → "Ramadan", Aladhan → "Ramaḍān" (diacritics differ)
        const hijriMonthNumber = prayerJson.data?.date?.hijri?.month?.number;
        isRamadan = hijriMonthNumber === 9
          || hijriMonth === 'Ramaḍān'
          || hijriMonth === 'Ramadan'
          || hijriMonth?.toLowerCase().startsWith('rama');

        if (isRamadan) {
          setIsRamadanMonth(true);
          events.push({ name: 'Ramadan', type: 'month', icon: '🌙' });
          if (hijriDay === '27') events.push({ name: 'Laylat al-Qadr (Night of Power)', type: 'special', icon: '✨' });
        } else {
          setIsRamadanMonth(false);
        }

        const isDhulHijjah = hijriMonthNumber === 12
          || hijriMonth === 'Dhū al-Ḥijjah'
          || hijriMonth === 'Dhu al-Hijjah'
          || hijriMonth?.toLowerCase().startsWith('dhu');

        if (isDhulHijjah && hijriDay === '9') {
          events.push({ name: 'Day of Arafah', type: 'special', icon: '🕋' });
        }
        if (isDhulHijjah && (hijriDay === '10' || hijriDay === '11' || hijriDay === '12' || hijriDay === '13')) {
          events.push({ name: 'Eid al-Adha', type: 'holiday', icon: '🎉' });
        }
        if (hijriMonth === 'Shawwāl' && hijriDay === '1') {
          events.push({ name: 'Eid al-Fitr', type: 'holiday', icon: '🎉' });
        }
        if (hijriMonth === 'Muḥarram' && hijriDay === '10') {
          events.push({ name: 'Day of Ashura', type: 'special', icon: '🕌' });
        }

        setIslamicEvents(events);
      } else {
        console.warn("Prayer API Error:", prayerJson);
        setError('Unable to fetch prayer times.');
        return;
      }

      // Fetch Fasting Times — dedicated islamicapi.com /fasting endpoint (primary),
      // Aladhan timings as fallback. Backend handles source selection transparently.
      const fastingGregorianDate = prayerJson?.data?.date?.gregorian?.date;
      const fastingDateParam = typeof fastingGregorianDate === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(fastingGregorianDate)
        ? `&date=${encodeURIComponent(fastingGregorianDate)}`
        : '';
      const fastingRes = await fetch(
        `${API_URL}/prayers/fasting?latitude=${lat}&longitude=${lon}&method=${calculationMethod}&school=${school}${fastingDateParam}`
      );
      const fastingJson = await fastingRes.json();
      if (hijriFetchRequestIdRef.current !== requestId) return;

      console.log('Fasting API Response:', fastingJson);

      let fastingPayload = null;
      if (fastingJson.status === 'success' && fastingJson.data?.fasting?.length > 0) {
        fastingPayload = fastingJson.data;
        setFastingData(fastingPayload);
        console.log('Fasting data set:', fastingPayload);
      } else {
        console.warn('Fasting API Error:', fastingJson);
      }

      // Fetch corrected Hijri dates from backend service (AlAdhan gToH + admin adjustment).
      const tomorrowGregorianDate = typeof fastingGregorianDate === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(fastingGregorianDate)
        ? addDaysToGregorianDDMMYYYY(fastingGregorianDate, 1)
        : null;
      const currentHijriPromise = fetch(
        `${API_URL}/prayers/hijri-date?latitude=${lat}&longitude=${lon}&date=${encodeURIComponent(requestGregorianDate)}&country=${encodeURIComponent(country || '')}`
      )
        .then((r) => r.json())
        .then((hijriJson) => {
          if (hijriJson.status === 'success' && hijriJson.data?.hijri) {
            return hijriJson.data.hijri as HijriDate;
          }

          return null;
        })
        .catch((hijriError) => {
          console.warn('Current corrected Hijri fetch error:', hijriError);
          return null;
        });

      const nextHijriPromise = tomorrowGregorianDate
        ? fetch(
          `${API_URL}/prayers/hijri-date?latitude=${lat}&longitude=${lon}&date=${encodeURIComponent(tomorrowGregorianDate)}&country=${encodeURIComponent(country || '')}`
        )
          .then((r) => r.json())
          .then((hijriJson) => {
            if (hijriJson.status === 'success' && hijriJson.data?.hijri) {
              return hijriJson.data.hijri as HijriDate;
            }

            return null;
          })
          .catch((hijriError) => {
            console.warn('Next corrected Hijri fetch error:', hijriError);
            return null;
          })
        : Promise.resolve(null);

      const weatherPromise = fetch(`${API_URL}/prayers/weather?latitude=${lat}&longitude=${lon}`)
        .then((response) => response.json())
        .then((weatherJson) => (weatherJson.status === 'success' ? weatherJson.data : null))
        .catch((weatherError) => {
          console.warn('Weather fetch error:', weatherError);
          return null;
        });

      const nextDayFastingPromise = tomorrowGregorianDate
        ? fetch(
          `${API_URL}/prayers/fasting?latitude=${lat}&longitude=${lon}&method=${calculationMethod}&school=${school}&date=${encodeURIComponent(tomorrowGregorianDate)}`
        )
          .then((r) => r.json())
          .then((nextDayJson) => {
            if (nextDayJson.status === 'success' && nextDayJson.data?.fasting?.length > 0) {
              return nextDayJson.data;
            }

            return null;
          })
          .catch((nextHijriError) => {
            console.warn('Next-day Hijri fetch error:', nextHijriError);
            return null;
          })
        : Promise.resolve(null);

      const nextDayPrayerPromise = tomorrowGregorianDate
        ? fetch(
          `${API_URL}/prayers/times?latitude=${lat}&longitude=${lon}&method=${calculationMethod}&school=${school}&date=${encodeURIComponent(tomorrowGregorianDate)}`
        )
          .then((r) => r.json())
          .then((nextPrayerJson) => {
            if (nextPrayerJson.status !== 'success' || !nextPrayerJson.data) {
              return null;
            }

            return nextPrayerJson.data;
          })
          .catch((nextPrayerError) => {
            console.warn('Next-day prayer fetch error:', nextPrayerError);
            return null;
          })
        : Promise.resolve(null);

      // Pre-fetch Ramadan schedule in the background during Ramadan so the tab is instant
      const ramadanPromise = isRamadan
        ? fetch(`${API_URL}/prayers/ramadan?latitude=${lat}&longitude=${lon}&method=${calculationMethod}&school=${school}`)
          .then(r => r.json())
          .then(d => {
            if (d.status === 'success' && d.data?.fasting?.length > 0) {
              return d.data;
            }

            return null;
          })
          .catch(err => {
            console.warn('Ramadan pre-fetch error:', err);
            return null;
          })
        : Promise.resolve(null);

      const [
        currentHijriPayload,
        nextHijriPayload,
        weatherPayload,
        nextDayFastingPayload,
        nextDayPrayerPayload,
        ramadanPayload,
      ] = await Promise.all([
        currentHijriPromise,
        nextHijriPromise,
        weatherPromise,
        nextDayFastingPromise,
        nextDayPrayerPromise,
        ramadanPromise,
      ]);

      if (hijriFetchRequestIdRef.current !== requestId) return;

      const resolvedCurrentHijriDate = currentHijriPayload || buildHijriDateFromPrayerSource(prayerJson?.data?.date?.hijri);
      const resolvedNextHijriDate = nextHijriPayload
        || buildHijriDateFromPrayerSource(nextDayPrayerPayload?.date?.hijri)
        || buildHijriDateFromFastingEntry(nextDayFastingPayload?.fasting?.[0]);

      setCurrentHijriDate(resolvedCurrentHijriDate);
      setWeatherData(weatherPayload);
      setNextDayFastingData(nextDayFastingPayload);
      setNextHijriDate(resolvedNextHijriDate);
      setNextDayPrayerData(nextDayPrayerPayload);

      if (ramadanPayload) {
        setRamadanData(ramadanPayload);
        setIsRamadanMonth(true);
      } else if (!isRamadan) {
        setRamadanData(null);
      }

      if (allowDurableClientCacheRef.current) {
        writePrayerCache<DailyPrayerCacheData>(dailyCacheKey, {
          prayerData: prayerJson.data,
          fastingData: fastingPayload,
          weatherData: weatherPayload,
          islamicEvents: events,
          isRamadanMonth: isRamadan,
          currentHijriDate: resolvedCurrentHijriDate,
          nextHijriDate: resolvedNextHijriDate,
          nextDayPrayerData: nextDayPrayerPayload,
          nextDayFastingData: nextDayFastingPayload,
          ramadanData: ramadanPayload,
        });
      }

    } catch (err) {
      setError('Network error. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedMadhab, calculationMethod, highLatitudeRule, globalTuningMarker]);

  const fetchMonthlyData = useCallback(async (lat: number, lon: number, month: number, year: number) => {
    setLoading(true);
    setError(null);
    
    const school = selectedMadhab === 'hanafi' ? 1 : 0;
    const monthlyCacheKey = buildPrayerCacheKey('monthly', {
      lat,
      lon,
      method: calculationMethod,
      school,
      highLatitudeRule,
      month,
      year,
      tuningMarker: globalTuningMarker,
    });
    const cachedMonthlyData = allowDurableClientCacheRef.current
      ? readPrayerCache<any[]>(monthlyCacheKey)
      : null;

    if (cachedMonthlyData) {
      setMonthlyData(cachedMonthlyData);
      setLoading(false);
      return;
    }
    
    try {
      // Fetch monthly calendar from Aladhan API
      const response = await fetch(
        `https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${lat}&longitude=${lon}&method=${calculationMethod}&school=${school}&latitudeAdjustmentMethod=${highLatitudeRule}`
      );
      const data = await response.json();
      
      if (data.code === 200 && data.data) {
        setMonthlyData(data.data);
        if (allowDurableClientCacheRef.current) {
          writePrayerCache(monthlyCacheKey, data.data);
        }
      } else {
        setError('Unable to fetch monthly data.');
      }
    } catch (err) {
      setError('Network error fetching monthly data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedMadhab, calculationMethod, highLatitudeRule, globalTuningMarker]);

  const fetchRamadanData = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);

    const school = selectedMadhab === 'hanafi' ? 2 : 1;
    const ramadanCacheKey = buildPrayerCacheKey('ramadan', {
      lat,
      lon,
      method: calculationMethod,
      school,
      tuningMarker: globalTuningMarker,
    });
    const cachedRamadanData = allowDurableClientCacheRef.current
      ? readPrayerCache<any>(ramadanCacheKey)
      : null;

    if (cachedRamadanData) {
      setRamadanData(cachedRamadanData);
      setIsRamadanMonth(true);
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching Ramadan data from backend...');
      const response = await fetch(
        `${API_URL}/prayers/ramadan?latitude=${lat}&longitude=${lon}&method=${calculationMethod}&school=${school}`
      );
      const data = await response.json();

      console.log('Ramadan API Response:', data);

      if (data.status === 'success' && data.data?.fasting?.length > 0) {
        setRamadanData(data.data);
        setIsRamadanMonth(true);
        if (allowDurableClientCacheRef.current) {
          writePrayerCache(ramadanCacheKey, data.data);
        }
      } else {
        setError('Unable to fetch Ramadan data.');
        setIsRamadanMonth(false);
      }
    } catch (err) {
      setError('Network error fetching Ramadan data.');
      console.error(err);
      setIsRamadanMonth(false);
    } finally {
      setLoading(false);
    }
  }, [selectedMadhab, calculationMethod, globalTuningMarker]);

  const fetchPrayerTuning = useCallback(async () => {
    if (!canManagePrayerTuning) return;

    setIsPrayerTuningLoading(true);
    setPrayerTuningError(null);

    try {
      const response = await fetch(`${API_URL}/prayers/tuning`);
      const payload = await response.json();

      if (payload?.status !== 'success' || !payload?.data) {
        throw new Error(payload?.message || 'Unable to load prayer tuning');
      }

      const offsets = payload.data.offsets || {};
      setPrayerTuning({
        offsets: {
          fajr: Number(offsets.fajr) || 0,
          dhuhr: Number(offsets.dhuhr) || 0,
          asr: Number(offsets.asr) || 0,
          maghrib: Number(offsets.maghrib) || 0,
          isha: Number(offsets.isha) || 0,
          imsak: Number(offsets.imsak) || 0,
        },
        applyToFasting: Boolean(payload.data.applyToFasting),
        updatedAt: payload.data.updatedAt || null,
      });
      setHasPrayerTuningLoaded(true);
    } catch (fetchError: any) {
      setPrayerTuningError(fetchError?.message || 'Failed to load prayer tuning settings');
    } finally {
      setIsPrayerTuningLoading(false);
    }
  }, [canManagePrayerTuning]);

  const updatePrayerTuningOffset = useCallback((key: keyof PrayerTuningState['offsets'], value: string) => {
    const parsed = Number.parseInt(value, 10);
    const safeValue = Number.isNaN(parsed) ? 0 : Math.max(-5, Math.min(5, parsed));

    setPrayerTuning((prev) => ({
      ...prev,
      offsets: {
        ...prev.offsets,
        [key]: safeValue,
      },
    }));
  }, []);

  const savePrayerTuning = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setPrayerTuningError('Please log in again to update prayer tuning.');
      return;
    }

    setIsPrayerTuningSaving(true);
    setPrayerTuningError(null);
    setPrayerTuningMessage(null);

    try {
      const response = await fetch(`${API_URL}/prayers/tuning`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          offsets: prayerTuning.offsets,
          applyToFasting: prayerTuning.applyToFasting,
        }),
      });

      const payload = await response.json();

      if (!response.ok || payload?.status !== 'success' || !payload?.data) {
        throw new Error(payload?.message || 'Unable to update prayer tuning');
      }

      const offsets = payload.data.offsets || {};
      setPrayerTuning({
        offsets: {
          fajr: Number(offsets.fajr) || 0,
          dhuhr: Number(offsets.dhuhr) || 0,
          asr: Number(offsets.asr) || 0,
          maghrib: Number(offsets.maghrib) || 0,
          isha: Number(offsets.isha) || 0,
          imsak: Number(offsets.imsak) || 0,
        },
        applyToFasting: Boolean(payload.data.applyToFasting),
        updatedAt: payload.data.updatedAt || null,
      });
      const marker = [
        payload.data.updatedAt || 'na',
        Number(offsets.fajr) || 0,
        Number(offsets.dhuhr) || 0,
        Number(offsets.asr) || 0,
        Number(offsets.maghrib) || 0,
        Number(offsets.isha) || 0,
        Number(offsets.imsak) || 0,
        payload.data.applyToFasting ? 1 : 0,
      ].join('|');
      setGlobalTuningMarker(marker);
      setPrayerTuningMessage(payload?.message || 'Prayer tuning saved successfully.');

      // Immediately refresh visible prayer data so users see tuned times right after save.
      if (location) {
        if (viewMode === 'daily') {
          await fetchData(location.lat, location.lon, location.city, location.country);
        } else if (viewMode === 'monthly') {
          await fetchMonthlyData(location.lat, location.lon, selectedMonth, selectedYear);
        } else if (viewMode === 'ramadan') {
          await fetchRamadanData(location.lat, location.lon);
        }
      }

      setShowSettings(false);
    } catch (saveError: any) {
      setPrayerTuningError(saveError?.message || 'Failed to save prayer tuning settings');
    } finally {
      setIsPrayerTuningSaving(false);
    }
  }, [
    prayerTuning,
    location,
    viewMode,
    selectedMonth,
    selectedYear,
    fetchData,
    fetchMonthlyData,
    fetchRamadanData,
  ]);

  const adjustHijriInput = useCallback((delta: number) => {
    setHijriAdjustmentError(null);
    setHijriAdjustmentMessage(null);
    setHijriAdjustmentInput((prev) => {
      const next = prev + delta;
      if (next < HIJRI_ADJUSTMENT_MIN) return HIJRI_ADJUSTMENT_MIN;
      if (next > HIJRI_ADJUSTMENT_MAX) return HIJRI_ADJUSTMENT_MAX;
      return next;
    });
  }, [HIJRI_ADJUSTMENT_MIN, HIJRI_ADJUSTMENT_MAX]);

  const saveHijriAdjustment = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setHijriAdjustmentError('Please log in again to update the Islamic date.');
      return;
    }

    setIsHijriAdjustmentSaving(true);
    setHijriAdjustmentError(null);
    setHijriAdjustmentMessage(null);

    try {
      const response = await fetch(`${API_URL}/prayers/hijri-adjustment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ adjustment: hijriAdjustmentInput }),
      });

      const payload = await response.json();

      if (!response.ok || payload?.status !== 'success' || payload?.data?.adjustment == null) {
        throw new Error(payload?.message || 'Unable to update the Islamic date adjustment');
      }

      const savedValue = Number(payload.data.adjustment);
      setHijriAdjustment(savedValue);
      setHijriAdjustmentInput(savedValue);
      setHijriAdjustmentMessage(payload?.message || 'Islamic date updated for all users.');

      // Refresh visible data so the header, Month tab, and calendar reflect the change now.
      if (location) {
        if (viewMode === 'daily') {
          await fetchData(location.lat, location.lon, location.city, location.country);
        } else if (viewMode === 'monthly') {
          await fetchMonthlyData(location.lat, location.lon, selectedMonth, selectedYear);
        } else if (viewMode === 'ramadan') {
          await fetchRamadanData(location.lat, location.lon);
        }
      }
    } catch (saveError: any) {
      setHijriAdjustmentError(saveError?.message || 'Failed to save the Islamic date adjustment');
    } finally {
      setIsHijriAdjustmentSaving(false);
    }
  }, [
    hijriAdjustmentInput,
    location,
    viewMode,
    selectedMonth,
    selectedYear,
    fetchData,
    fetchMonthlyData,
    fetchRamadanData,
  ]);

  useEffect(() => {
    if (!showSettings || !canManagePrayerTuning || hasPrayerTuningLoaded || isPrayerTuningLoading) {
      return;
    }

    fetchPrayerTuning();
  }, [
    showSettings,
    canManagePrayerTuning,
    hasPrayerTuningLoaded,
    isPrayerTuningLoading,
    fetchPrayerTuning,
  ]);

  // Update reminder based on prayer times, Islamic events, and current time
  useEffect(() => {
    const updateReminder = () => {
      if (!prayerData?.times) return;
      
      const now = new Date();
      const maghribParsed = parseTimeString(prayerData.times?.Maghrib || '');
      let isAfterMaghribForReminder = false;
      if (maghribParsed) {
        const maghribToday = new Date(now);
        maghribToday.setHours(maghribParsed.hours, maghribParsed.minutes, 0, 0);
        isAfterMaghribForReminder = now >= maghribToday;
      }

      const reminderTimes = isAfterMaghribForReminder && nextDayPrayerData?.times
        ? nextDayPrayerData.times
        : prayerData.times;

      const prayerWindow = getCurrentPrayerWindow(reminderTimes);
      const dayOfWeek = now.getDay();
      // Use hour as seed for consistent rotation within same hour
      const seed = now.getHours() + now.getDate();
      
      const reminder = selectReminder(prayerWindow, islamicEvents, dayOfWeek, seed);
      setCurrentReminder(reminder);
    };
    
    updateReminder();
    
    // Update every minute to catch prayer time transitions
    const interval = setInterval(updateReminder, 60000);
    
    return () => clearInterval(interval);
  }, [prayerData, nextDayPrayerData, islamicEvents]);

  // Generate and share Dua image
  const generateAndShareDuaImage = async (ratio: 'story' | 'post', platform: string) => {
    const duaText = ramadanData?.resource?.dua;
    if (!duaText) {
      console.error('❌ No Dua data available');
      return;
    }
    if (!duaImageRef.current) {
      console.error('❌ Dua image ref not available');
      return;
    }

    console.log('🎨 Generating Dua image...', ratio, platform);

    try {
      // Generate image from hidden template
      const canvas = await html2canvas(duaImageRef.current, {
        scale: 2,
        backgroundColor: null,
        logging: false,
        useCORS: true,
        allowTaint: true,
      } as any);

      console.log('✅ Canvas generated:', canvas.width, 'x', canvas.height);

      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          console.error('❌ Failed to create blob');
          return;
        }

        console.log('✅ Blob created:', blob.size, 'bytes');

        const file = new File([blob], `hikmahsphere-dua-${Date.now()}.png`, { type: 'image/png' });

        // For WhatsApp - try to share directly using Web Share API
        if (platform === 'whatsapp') {
          if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
            try {
              await (navigator as any).share({
                files: [file],
                title: duaText.title,
                text: `${duaText.title}\n\n${duaText.translation}\n\n🌐 hikmahsphere.site`,
              });
              console.log('✅ Shared via Web Share API');
              return;
            } catch (err) {
              console.log('⚠️ Web Share failed:', err);
            }
          }
          // Fallback: download and open WhatsApp
          console.log('⬇️ Downloading for WhatsApp...');
          downloadImage(canvas, 'hikmahsphere-dua-whatsapp.png');
          setTimeout(() => {
            window.open('https://wa.me/', '_blank');
          }, 1000);
        } else {
          // For Instagram, Facebook, Twitter, or download - just download image
          console.log(`⬇️ Downloading ${ratio} format...`);
          downloadImage(canvas, `hikmahsphere-dua-${ratio}.png`);
        }
      }, 'image/png');
    } catch (error) {
      console.error('❌ Error generating image:', error);
    }
  };

  // Generate and share Hadith image
  const generateAndShareHadithImage = async (ratio: 'story' | 'post', platform: string) => {
    const hadithText = ramadanData?.resource?.hadith;
    if (!hadithText) {
      console.error('❌ No Hadith data available');
      return;
    }
    if (!hadithImageRef.current) {
      console.error('❌ Hadith image ref not available');
      return;
    }

    console.log('🎨 Generating Hadith image...', ratio, platform);

    try {
      const canvas = await html2canvas(hadithImageRef.current, {
        scale: 2,
        backgroundColor: null,
        logging: false,
        useCORS: true,
        allowTaint: true,
      } as any);

      console.log('✅ Canvas generated:', canvas.width, 'x', canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          console.error('❌ Failed to create blob');
          return;
        }

        console.log('✅ Blob created:', blob.size, 'bytes');

        const file = new File([blob], `hikmahsphere-hadith-${Date.now()}.png`, { type: 'image/png' });

        if (platform === 'whatsapp') {
          if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
            try {
              await (navigator as any).share({
                files: [file],
                title: 'Hadith of Ramadan',
                text: `Hadith of Ramadan\n\n${hadithText.english}\n\n📚 ${hadithText.source}\n\n🌐 hikmahsphere.site`,
              });
              console.log('✅ Shared via Web Share API');
              return;
            } catch (err) {
              console.log('⚠️ Web Share failed:', err);
            }
          }
          // Fallback: download and open WhatsApp
          console.log('⬇️ Downloading for WhatsApp...');
          downloadImage(canvas, 'hikmahsphere-hadith-whatsapp.png');
          setTimeout(() => {
            window.open('https://wa.me/', '_blank');
          }, 1000);
        } else {
          // For download or other platforms
          console.log(`⬇️ Downloading ${ratio} format...`);
          downloadImage(canvas, `hikmahsphere-hadith-${ratio}.png`);
        }
      }, 'image/png');
    } catch (error) {
      console.error('❌ Error generating image:', error);
    }
  };

  // Download image helper
  const downloadImage = (canvas: HTMLCanvasElement, filename: string) => {
    try {
      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('✅ Image downloaded:', filename);
    } catch (error) {
      console.error('❌ Download failed:', error);
    }
  };

  // Open ratio selection modal
  const openRatioModal = (type: 'dua' | 'hadith', platform: string) => {
    setShareType(type);
    
    // Close the share modal first
    const shareModal = document.getElementById('share-modal');
    if (shareModal) {
      shareModal.classList.add('hidden');
    }
    
    // WhatsApp only supports story (9:16) - direct share
    if (platform === 'whatsapp') {
      setSelectedRatio('story');
      setTimeout(() => {
        if (type === 'dua') {
          generateAndShareDuaImage('story', platform);
        } else {
          generateAndShareHadithImage('story', platform);
        }
      }, 300);
    } else {
      // For Instagram, Facebook, Twitter - show ratio selection
      setShowRatioModal(true);
    }
  };

  // Share Dua to social media (updated to show ratio modal)
  const shareDua = (platform: string) => {
    openRatioModal('dua', platform);
  };

  // Share Hadith to social media (updated to show ratio modal)
  const shareHadith = (platform: string) => {
    openRatioModal('hadith', platform);
  };

  // Confirm ratio selection and generate image
  const confirmRatioSelection = () => {
    setShowRatioModal(false);
    setTimeout(() => {
      if (shareType === 'dua') {
        generateAndShareDuaImage(selectedRatio, 'download');
      } else {
        generateAndShareHadithImage(selectedRatio, 'download');
      }
    }, 300);
  };

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityQuery.trim()) return;

    try {
      // Use OpenStreetMap Nominatim for geocoding
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityQuery)}`);
      const data = await response.json();

      if (data && data.length > 0) {
        setSearchResults(data);
        setError(null);
      } else {
        setError('City not found. Please try another name.');
        setSearchResults([]);
      }
    } catch (err) {
      setError('Failed to search location.');
    }
  };

  const selectLocation = (result: any) => {
    // Extract city and country from Nominatim result using the structured address field
    const address = result.address || {};
    const city = (
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.state ||
      result.display_name.split(',')[0].trim() ||
      'Unknown'
    ).trim();
    const country = (address.country || 'Unknown').trim();

    console.log('📍 Selecting location:', { city, country, lat: result.lat, lon: result.lon });

    // Create a new location object to ensure React detects the change
    const newLocation = {
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      city: city,
      country: country,
    };

    setLocation(newLocation);
    setDetectedCountry(country);
    setCityQuery(city);
    setSearchResults([]);
    setShowSearch(false);
    setError(null);
    if (user?.id) {
      allowDurableClientCacheRef.current = true;
      setLocationPermissionNeeded(false);
      void persistUserLocation(newLocation.lat, newLocation.lon, city, country);
    }
  };

  const handleUseCurrentLocation = (e?: React.MouseEvent) => {
    // Prevent any default form submission behavior
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setError(null);
    setLoading(true);
    // Clear cityQuery so resolveLocationDetails can set the correct current location name
    setCityQuery('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        setLocation({ lat, lon });
        const details = await resolveLocationDetails(lat, lon);
        if (user?.id) {
          allowDurableClientCacheRef.current = true;
          setLocationPermissionNeeded(false);
          await persistUserLocation(lat, lon, details.city, details.country);
        }
        setLoading(false);
        setShowSearch(false);
        setSearchResults([]);
      },
      (geoError) => {
        console.warn('Failed to get current location:', geoError);
        setLoading(false);
        if (user?.id) {
          allowDurableClientCacheRef.current = false;
          setLocationPermissionNeeded(true);
        }
        setError('Unable to get your current location. Please allow location permission.');
      }
    );
  };
  
  // Helper: Find weather closest to a given time string (e.g., "05:30")
  const getWeatherForTime = (timeStr: string) => {
      if (!weatherData || !weatherData.hourly) return null;
      
      // Parse prayer time "HH:mm"
      const parsed = parseTimeString(timeStr);
      const hours = parsed?.hours ?? 0;
      
      const now = new Date();
      const currentHour = hours; // Approximation is fine
      
      const index = weatherData.hourly.time.findIndex((t: string) => {
          const d = new Date(t);
          return d.getDate() === now.getDate() && d.getHours() === currentHour;
      });
      
      // Get Min/Max for the current day (Index 0 is today)
      // daily.temperature_2m_max[0] and min[0]
      const dailyMax = weatherData.daily?.temperature_2m_max?.[0];
      const dailyMin = weatherData.daily?.temperature_2m_min?.[0];

      if (index !== -1) {
          return {
              temp: weatherData.hourly.temperature_2m[index],
              code: weatherData.hourly.weather_code[index],
              min: dailyMin,
              max: dailyMax
          };
      }
      
      return {
          temp: weatherData.current.temperature_2m,
          code: weatherData.current.weather_code,
          min: dailyMin,
          max: dailyMax
      };
  };

  // Helper: Get Icon and Style based on weather code and prayer time context
  const getWeatherStyling = (code: number, prayerName: string) => {
    // Determine if night based on prayer name
    const isNight = ['Fajr', 'Maghrib', 'Isha'].includes(prayerName);

    // Thunderstorm (95, 96, 99)
    if (code >= 95) return { icon: BoltIcon, color: 'text-yellow-600', label: 'Thunder' };

    // Rain / Drizzle / Showers (51-67, 80-82)
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
        return { icon: CloudIcon, color: 'text-blue-500', label: 'Rainy' };
    }

    // Snow (71-77)
    if (code >= 71 && code <= 77) {
        return { icon: CloudIcon, color: 'text-sky-300', label: 'Snowy' };
    }

    // Fog (45, 48)
    if (code >= 45 && code <= 48) {
        return { icon: CloudIcon, color: 'text-gray-400', label: 'Foggy' };
    }

    // Cloudy (1, 2, 3)
    if (code >= 1 && code <= 3) {
        return { icon: CloudIcon, color: 'text-gray-500', label: 'Cloudy' };
    }

    // Clear (0)
    if (isNight) {
        return { icon: MoonIcon, color: 'text-indigo-400', label: 'Clear' };
    }
    return { icon: SunIcon, color: 'text-orange-400', label: 'Sunny' };
  };

  // Helper: Parse time string from formats like "05:30", "05:30 (+05)", "5:30 PM"
  function parseTimeString(timeStr: string): { hours: number; minutes: number } | null {
    if (!timeStr) return null;

    const hasMeridian = /\b(am|pm)\b/i.test(timeStr);
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

    if (hasMeridian) {
      const meridian = (timeStr.match(/\b(am|pm)\b/i)?.[1] || '').toLowerCase();
      if (meridian === 'pm' && hours < 12) hours += 12;
      if (meridian === 'am' && hours === 12) hours = 0;
    }

    return { hours: hours % 24, minutes };
  }

  const formatTimeForDisplay = (timeStr: string): string => {
    const parsed = parseTimeString(timeStr);
    if (!parsed) return timeStr;

    const hh24 = `${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}`;
    if (timeFormat === '24h') return hh24;

    const hours12 = parsed.hours % 12 || 12;
    const meridian = parsed.hours >= 12 ? 'PM' : 'AM';
    return `${hours12}:${String(parsed.minutes).padStart(2, '0')} ${meridian}`;
  };

  // Helper: Parse time string (HH:mm) to Date object for today
  const parsePrayerTime = useCallback((timeStr: string, baseDate: Date = new Date()): Date => {
    const parsed = parseTimeString(timeStr);
    const hours = parsed?.hours ?? 0;
    const minutes = parsed?.minutes ?? 0;
    const prayerTime = new Date(baseDate);
    prayerTime.setHours(hours, minutes, 0, 0);
    return prayerTime;
  }, []);

  // Helper: Format countdown time
  const formatCountdown = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return 'Now';
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Helper: Calculate current prayer and countdown to next prayer
  const updatePrayerTimes = useCallback(() => {
    if (!prayerData?.times) return;

    const now = new Date();
    const activeTimesSource = prayerData;
    const prayerNames = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    
    const prayerTimes = prayerNames.map(name => parsePrayerTime(activeTimesSource.times[name] || '00:00', now));
    
    // Find current and next prayer
    let currentIdx = -1;
    let nextIdx = 0;
    let isNext = false;

    for (let i = 0; i < prayerTimes.length; i++) {
      if (now >= prayerTimes[i]) {
        currentIdx = i;
        nextIdx = (i + 1) % prayerTimes.length;
        isNext = nextIdx === 0; // Next day's Fajr
      }
    }

    // If after Isha, next prayer is Fajr (next day)
    if (currentIdx === prayerTimes.length - 1) {
      nextIdx = 0;
      isNext = true;
    } else if (currentIdx === -1) {
      // Before Fajr, next prayer is today's Fajr.
      nextIdx = 0;
      isNext = false;
    }

    setCurrentPrayerIndex(currentIdx);
    setNextPrayerIndex(nextIdx);
    setIsNextDay(isNext);

    // Calculate countdown
    let targetTime: Date;
    if (isNext) {
      const tomorrowFajrStr = nextDayPrayerData?.times?.Fajr || activeTimesSource.times.Fajr;
      targetTime = parsePrayerTime(tomorrowFajrStr, new Date(now.getTime() + 86400000));
    } else {
      targetTime = parsePrayerTime(activeTimesSource.times[prayerNames[nextIdx]], now);
    }
    
    let diffMs = targetTime.getTime() - now.getTime();
    if (diffMs < 0) diffMs = 0;
    
    const totalSeconds = Math.floor(diffMs / 1000);
    setCountdown({
      hours: Math.floor(totalSeconds / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60
    });
  }, [parsePrayerTime, prayerData, nextDayPrayerData]);

  // Update timer every second
  useEffect(() => {
    if (!prayerData?.times) return;

    // Initial update
    updatePrayerTimes();

    // Update every second
    const interval = setInterval(updatePrayerTimes, 1000);

    return () => clearInterval(interval);
  }, [prayerData, updatePrayerTimes]);

  // Persist today's prayer times so the global Adhan scheduler can fire
  // notifications/audio from any page (not only this Prayer Times page).
  useEffect(() => {
    if (!prayerData?.times) return;
    writeTodayAdhanTimes(prayerData.times);
  }, [prayerData?.times]);

  // Save the user's location + calculation settings to the backend so the
  // server can push Adhan notifications even when the app is closed. Custom
  // Adhan audio cannot autoplay in background on mobile PWAs (OS ring only);
  // tapping the notification opens the app and plays /sounds/adhan.mp3.
  useEffect(() => {
    if (!user?.id || !location?.lat || !location?.lon) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    const school = selectedMadhab === 'hanafi' ? 2 : 1;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const timesDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const t = prayerData?.times;
    // Send the exact times the page is displaying so the server fires the
    // Adhan at precisely the shown start time (not a recomputed value).
    const times = t
      ? { Fajr: t.Fajr, Dhuhr: t.Dhuhr, Asr: t.Asr, Maghrib: t.Maghrib, Isha: t.Isha }
      : undefined;

    fetch(`${API_URL}/users/${user.id}/prayer-push`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        latitude: location.lat,
        longitude: location.lon,
        method: calculationMethod,
        school,
        timezone,
        times,
        timesDate,
        city: location.city,
        country: location.country,
        enabled: true,
      }),
    }).catch((err) => console.warn('[PrayerPush] Failed to save prayer push settings:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.id,
    location?.lat,
    location?.lon,
    calculationMethod,
    selectedMadhab,
    prayerData?.times?.Fajr,
    prayerData?.times?.Dhuhr,
    prayerData?.times?.Asr,
    prayerData?.times?.Maghrib,
    prayerData?.times?.Isha,
  ]);

  // Refresh fasting data at Maghrib time to ensure Sehri/Iftar times update correctly
  useEffect(() => {
    if (!prayerData?.times?.Maghrib || !location?.lat || !location?.lon) return;

    const checkMaghribTime = () => {
      const now = new Date();
      const maghribTime = parsePrayerTime(prayerData.times.Maghrib);
      
      // Check if we just crossed Maghrib (within the last minute)
      const diffMs = now.getTime() - maghribTime.getTime();
      const wasJustMaghrib = diffMs >= 0 && diffMs < 60000; // Within 1 minute after Maghrib

      if (wasJustMaghrib && !hasRefreshedAtMaghribRef.current) {
        console.log('🕌 Maghrib time detected - refreshing fasting data for next day');
        hasRefreshedAtMaghribRef.current = true;
        fetchData(location.lat, location.lon, location.city, location.country);
      }

      // Reset the flag if it's before Maghrib the next day
      const maghribHour = maghribTime.getHours();
      const maghribMinute = maghribTime.getMinutes();
      if (now.getHours() < maghribHour || (now.getHours() === maghribHour && now.getMinutes() < maghribMinute)) {
        hasRefreshedAtMaghribRef.current = false;
      }
    };

    const interval = setInterval(checkMaghribTime, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [prayerData?.times?.Maghrib, location, parsePrayerTime, fetchData]);

  useEffect(() => {
    if (!location?.lat || !location?.lon || viewMode !== 'daily') return;

    const checkGregorianDateRollover = () => {
      const nextDate = formatGregorianDDMMYYYY(new Date());
      if (nextDate !== currentGregorianDateRef.current) {
        currentGregorianDateRef.current = nextDate;
        fetchData(location.lat, location.lon, location.city, location.country);
      }
    };

    const interval = setInterval(checkGregorianDateRollover, 30000);
    return () => clearInterval(interval);
  }, [location, viewMode, fetchData]);

  // Auto-scroll to current day's card when Ramadan tab is opened
  useEffect(() => {
    if (viewMode !== 'ramadan') {
      hasScrolledToRamadanRef.current = false;
      return;
    }
    if (loading || !ramadanData?.fasting) return;
    if (hasScrolledToRamadanRef.current) return;

    let attempts = 0;
    let timeoutId: number;

    const tryScroll = () => {
      const todayCard = document.querySelector<HTMLElement>('[data-ramadan-today="true"]');
      if (!todayCard) {
        if (attempts++ < 10) timeoutId = window.setTimeout(tryScroll, 150);
        return;
      }
      todayCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      hasScrolledToRamadanRef.current = true;
    };

    timeoutId = window.setTimeout(tryScroll, 50);
    return () => window.clearTimeout(timeoutId);
  }, [viewMode, ramadanData, loading]);

  // Auto-scroll to current (or next, before Fajr) prayer after cards mount
  useEffect(() => {
    if (loading || !prayerData?.times || viewMode !== 'daily') {
      if (viewMode !== 'daily') hasScrolledToPrayerRef.current = false;
      return;
    }
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) return;
    if (hasScrolledToPrayerRef.current) return;

    const targetIndex = currentPrayerIndex >= 0 ? currentPrayerIndex : nextPrayerIndex;
    if (targetIndex < 0) return;

    let attempts = 0;
    let timeoutId: number;

    const tryScroll = () => {
      const card = prayerCardRefs.current[targetIndex];
      if (!card || !document.contains(card)) {
        if (attempts++ < 10) timeoutId = window.setTimeout(tryScroll, 150);
        return;
      }
      const headerOffset = 96;
      const top = window.scrollY + card.getBoundingClientRect().top - headerOffset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      hasScrolledToPrayerRef.current = true;
    };

    timeoutId = window.setTimeout(tryScroll, 50);
    return () => window.clearTimeout(timeoutId);
  }, [loading, prayerData, currentPrayerIndex, nextPrayerIndex, viewMode]);

  const prayerSourceHijriDate = currentHijriDate || buildHijriDateFromPrayerSource(prayerData?.date?.hijri);
  const baseFastingEntry = fastingData?.fasting?.[0];
  const nextFastingEntry = nextDayFastingData?.fasting?.[0];
  const baseFastingHijriDate = buildHijriDateFromFastingEntry(baseFastingEntry);
  const baseHijriDate = resolvePreferredHijriDate(prayerSourceHijriDate, baseFastingHijriDate);

  const nowForHijri = new Date();
  const maghribTimeToday = prayerData?.times?.Maghrib
    ? parsePrayerTime(prayerData.times.Maghrib, nowForHijri)
    : null;
  const isAfterMaghrib = Boolean(maghribTimeToday && nowForHijri >= maghribTimeToday);
  // Civil Gregorian "today" (midnight) — used for month/Ramadan row highlighting.
  // Maghrib only advances the Islamic day, not the English calendar date.
  const civilTodayGregorianDate = new Date(nowForHijri);
  civilTodayGregorianDate.setHours(0, 0, 0, 0);
  const fallbackNextHijri = incrementHijriByOneDay(baseHijriDate);
  const nextPrayerHijriDate = buildHijriDateFromPrayerSource(nextDayPrayerData?.date?.hijri);
  const nextFastingHijriDate = buildHijriDateFromFastingEntry(nextFastingEntry);
  const resolvedNextHijriDate = nextHijriDate
    || resolvePreferredHijriDate(nextPrayerHijriDate, nextFastingHijriDate)
    || nextPrayerHijriDate
    || nextFastingHijriDate
    || fallbackNextHijri;
  const effectiveHijriDate = isAfterMaghrib
    ? (resolvedNextHijriDate || baseHijriDate)
    : baseHijriDate;
  
  // Global admin-controlled offset (single source of truth). While it is still loading
  // (null), local Intl fallbacks defer to the country-based default (India = -1).
  const resolvedHijriOffset = hijriAdjustment;
  // The header Hijri date follows the civil (Gregorian) day so it always matches the
  // calendar grid, changing at midnight rather than Maghrib. Prayer and fasting times
  // below still roll at Maghrib via activePrayerData/activeFastingData.
  const fallbackCurrentHijriDate = buildLocationAwareHijriDateFromGregorianDate(civilTodayGregorianDate, activeCountry, resolvedHijriOffset);
  const displayHijriDate = baseHijriDate || fallbackCurrentHijriDate;
  const activePrayerData = isAfterMaghrib && nextDayPrayerData?.times
    ? nextDayPrayerData
    : prayerData;
  const activeFastingData = isAfterMaghrib && nextDayFastingData?.fasting?.length
    ? nextDayFastingData
    : fastingData;
  const activeFastingEntry = activeFastingData?.fasting?.[0];

  const displayHijriReadable = formatHijriReadable(displayHijriDate || effectiveHijriDate || baseHijriDate);
  const visibleIslamicEvents = islamicEvents.filter((event) => event.name !== 'Ramadan');
  // Friday Dhuhr styling follows the civil/Gregorian day, which changes at midnight.
  const isFriday = nowForHijri.getDay() === 5;
  const shouldShowRamadanTab = (displayHijriDate?.month?.number || effectiveHijriDate?.month?.number || 0) === 9;
  const getMonthlyDayInfo = (day: any) => {
    const gd = day.date?.gregorian || {};
    const rowGregorianDate = parseGregorianDDMMYYYY(gd?.date)
      || new Date(Number(gd.year), Number(gd.month?.number || 1) - 1, Number(gd.day || 1));
    // Pair each row to its civil Gregorian day (same as day-tab calendar).
    // Do not shift "Today" or override Hijri at Maghrib — that caused duplicate Hijri labels.
    const isToday = rowGregorianDate.toDateString() === civilTodayGregorianDate.toDateString();
    const rowPrayerHijriDate = buildHijriDateFromPrayerSource(day.date?.hijri);
    // Use the offset-aware local Hijri as the primary so Month tab numbers stay in sync
    // with the admin-adjusted daily date (Aladhan calendar rows carry no admin offset).
    const fallbackRowHijriDate = buildLocationAwareHijriDateFromGregorianDate(rowGregorianDate, activeCountry, resolvedHijriOffset);
    const rowHijriDate = fallbackRowHijriDate || rowPrayerHijriDate;
    const hijriMonth = rowHijriDate?.month?.en || day.date?.hijri?.month?.en || '';
    const hijriDay = parseInt(String(rowHijriDate?.day || day.date?.hijri?.day || ''), 10) || 0;
    const normalizedHijriMonth = normalizeHijriMonthName(hijriMonth);
    const hijriMonthNumber = rowHijriDate?.month?.number || HIJRI_MONTH_NUMBERS[normalizedHijriMonth] || 0;
    const isRamadan = hijriMonthNumber === 9;
    const isEidFitr = hijriMonthNumber === 10 && hijriDay === 1;
    const isEidAdha = hijriMonthNumber === 12 && hijriDay === 10;
    const isArafah = hijriMonthNumber === 12 && hijriDay === 9;
    const isAshura = hijriMonthNumber === 1 && hijriDay === 10;
    const isWhiteDayDate = [13, 14, 15].includes(hijriDay);
    const isWhiteDay = !isToday && !isEidFitr && !isEidAdha && !isArafah && !isAshura && !isRamadan && isWhiteDayDate;

    return {
      gd,
      rowGregorianDate,
      isToday,
      rowHijriDate,
      hijriMonth,
      hijriDay,
      isRamadan,
      isEidFitr,
      isEidAdha,
      isArafah,
      isAshura,
      isWhiteDayDate,
      isWhiteDay,
    };
  };
  const monthlyWhiteDayEntries: Array<{ label: string; date: Date }> = Array.isArray(monthlyData)
    ? Array.from(monthlyData.reduce<Map<string, { label: string; date: Date }>>((entriesByDate, day: any) => {
        const info = getMonthlyDayInfo(day);
        if (!info.isWhiteDayDate) return entriesByDate;

        const dateKey = formatGregorianDDMMYYYY(info.rowGregorianDate);
        if (!entriesByDate.has(dateKey)) {
          entriesByDate.set(dateKey, {
            label: formatOrdinal(info.hijriDay),
            date: info.rowGregorianDate,
          });
        }

        return entriesByDate;
      }, new Map<string, { label: string; date: Date }>()).values())
      .sort((first, second) => first.date.getTime() - second.date.getTime())
    : [];

  useEffect(() => {
    if (viewMode === 'ramadan' && !shouldShowRamadanTab) {
      handleViewModeChange('daily');
    }
  }, [viewMode, shouldShowRamadanTab, handleViewModeChange]);

  const toMinutes = (timeStr?: string): number | null => {
    if (!timeStr) return null;
    const parsed = parseTimeString(timeStr);
    if (!parsed) return null;
    return parsed.hours * 60 + parsed.minutes;
  };

  const formatMinutesForDisplay = (totalMinutes: number): string => {
    const minutesPerDay = 24 * 60;
    const normalized = ((Math.round(totalMinutes) % minutesPerDay) + minutesPerDay) % minutesPerDay;
    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    const hhmm = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    return formatTimeForDisplay(hhmm);
  };

  const sunriseMinutes = toMinutes(activePrayerData?.times?.Sunrise);
  const dhuhrMinutes = toMinutes(activePrayerData?.times?.Dhuhr);
  const maghribMinutes = toMinutes(activePrayerData?.times?.Maghrib);
  const fajrMinutes = toMinutes(activePrayerData?.times?.Fajr);

  const ishraqStartMinutes = sunriseMinutes === null ? null : sunriseMinutes + 20;
  const duhaStartMinutes = ishraqStartMinutes;

  const duhaEndDisplay = dhuhrMinutes === null ? null : formatMinutesForDisplay(dhuhrMinutes - 10);
  const ishraqTimeDisplay = ishraqStartMinutes === null ? null : formatMinutesForDisplay(ishraqStartMinutes);
  const duhaTimeDisplay = duhaStartMinutes === null ? null : formatMinutesForDisplay(duhaStartMinutes);

  let lastThirdRangeDisplay: string | null = null;
  let tahajjudStartDisplay: string | null = null;
  let tahajjudEndDisplay: string | null = null;
  if (maghribMinutes !== null && fajrMinutes !== null) {
    const minutesPerDay = 24 * 60;
    const adjustedFajr = fajrMinutes <= maghribMinutes ? fajrMinutes + minutesPerDay : fajrMinutes;
    const nightDuration = adjustedFajr - maghribMinutes;

    if (nightDuration > 0) {
      const lastThirdStart = adjustedFajr - nightDuration / 3;
      const lastThirdStartDisplay = formatMinutesForDisplay(lastThirdStart);
      const fajrDisplay = formatTimeForDisplay(activePrayerData?.times?.Fajr || '00:00');
      tahajjudStartDisplay = lastThirdStartDisplay;
      tahajjudEndDisplay = fajrDisplay;
      lastThirdRangeDisplay = `${lastThirdStartDisplay} - ${fajrDisplay}`;
    }
  }

  const extraPrayerTimingCards: ExtraPrayerTimingCard[] = [
    {
      key: 'ishraq',
      title: 'Ishraq',
      badge: 'Early Duha',
      badgeClassName: 'bg-amber-100 text-amber-700',
      rakats: 'Usually 2 Rakats',
      time: ishraqTimeDisplay || 'Unavailable',
      range: ishraqTimeDisplay ? `Begins around ${ishraqTimeDisplay}, about 15-20 minutes after sunrise` : 'Begins about 15-20 minutes after sunrise',
      summary: 'The earliest time of the morning voluntary prayer',
      details: 'Many classical Sunni scholars describe Ishraq as the early time of Duha. It is commonly prayed as 2 rakats after waiting for the sun to rise properly, often after dhikr following Fajr.',
      accentClassName: 'border-amber-200 bg-gradient-to-br from-white to-amber-50/70',
    },
    {
      key: 'duha',
      title: 'Duha (Chasht)',
      badge: 'Sunnah',
      badgeClassName: 'bg-sky-100 text-sky-700',
      rakats: '2-8+ Rakats',
      time: duhaTimeDisplay || 'Unavailable',
      range: duhaTimeDisplay && duhaEndDisplay ? `${duhaTimeDisplay} to ${duhaEndDisplay}` : 'After Ishraq until shortly before Dhuhr',
      summary: 'Chasht is the South Asian name for Duha prayer',
      details: 'Duha is the same morning voluntary prayer whose earliest time is often called Ishraq. It continues until about 10-15 minutes before Dhuhr, and its prayer fulfills the charity due on the joints of the body in the hadith.',
      accentClassName: 'border-sky-200 bg-gradient-to-br from-white to-sky-50/70',
    },
    {
      key: 'tahajjud',
      title: 'Tahajjud',
      badge: 'Night Prayer',
      badgeClassName: 'bg-violet-100 text-violet-700',
      rakats: '2+ Rakats',
      time: tahajjudStartDisplay || 'Unavailable',
      range: tahajjudStartDisplay && tahajjudEndDisplay ? `${tahajjudStartDisplay} to ${tahajjudEndDisplay}` : 'Last part of the night before Fajr',
      summary: 'Offered in the last third of the night',
      details: 'Tahajjud is prayed after sleeping and before Fajr. Even two rakats in this quiet time are deeply rewarding and ideal for dua.',
      accentClassName: 'border-violet-200 bg-gradient-to-br from-white to-violet-50/70',
    },
  ];

  const extraPrayerInfoContent = (
    <>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Extra Prayer Times</p>
          <p className="mt-1 text-xs text-gray-500">Simple guidance for Ishraq, Duha, Chasht, and Tahajjud.</p>
        </div>
        <button
          onClick={() => setShowExtraPrayerInfo(false)}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close prayer guide"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 sm:grid sm:grid-cols-2 sm:items-start sm:gap-3">
        <p className="text-xs leading-relaxed text-emerald-900">
          According to many classical Sunni scholars, Ishraq and Duha are not two different obligatory prayers.
          Ishraq refers to praying this voluntary morning salah in its earliest time, while Duha continues later in
          the morning. Chasht is a South Asian name for Duha.
        </p>
        <div className="mt-3 rounded-lg bg-white/80 p-3 sm:mt-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Simple Timeline</p>
          <div className="mt-2 space-y-1 text-xs font-medium text-gray-700">
            <p>Sunrise</p>
            <p>↓ wait 15-20 minutes</p>
            <p>Ishraq prayer</p>
            <p>↓</p>
            <p>Duha prayer time continues</p>
            <p>↓</p>
            <p>Ends before Dhuhr</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {extraPrayerTimingCards.map((prayer) => (
          <div key={prayer.key} className={`rounded-xl border p-3 ${prayer.accentClassName}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{prayer.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${prayer.badgeClassName}`}>
                    {prayer.badge}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-600">{prayer.summary}</p>
              </div>
              <div className="rounded-lg bg-white px-2.5 py-2 text-right shadow-sm">
                <p className="text-sm font-bold text-emerald-700">{prayer.time}</p>
                <p className="text-[11px] text-gray-500">{prayer.rakats}</p>
              </div>
            </div>
            <p className="mt-2 text-xs font-medium text-emerald-700">{prayer.range}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">{prayer.details}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
        For detailed rulings about rakats, local timings, or specific madhhab questions, consult a qualified scholar.
      </p>
    </>
  );

  // Define prayers list based on active Islamic day.
  const prayers = activePrayerData ? [
    { name: 'Fajr', time: activePrayerData.times?.Fajr, arabic: 'الفجر', description: 'Dawn Prayer', icon: MoonIcon },
    { name: 'Sunrise', time: activePrayerData.times?.Sunrise, arabic: 'الشروق', description: 'Sunrise', icon: SunIcon, isSecondary: true },
    { name: 'Dhuhr', time: activePrayerData.times?.Dhuhr, arabic: 'الظهر', description: 'Noon Prayer', icon: SunIcon },
    { name: 'Asr', time: activePrayerData.times?.Asr, arabic: 'العصر', description: 'Afternoon Prayer', icon: SunIcon },
    { name: 'Maghrib', time: activePrayerData.times?.Maghrib, arabic: 'المغرب', description: 'Sunset Prayer', icon: SunIcon },
    { name: 'Isha', time: activePrayerData.times?.Isha, arabic: 'العشاء', description: 'Night Prayer', icon: MoonIcon },
  ] : [];

  const handlePrayerCardFlip = (prayerName: string) => {
    setOpenGuideCard(null);
    setActiveFlippedCard((prev) => (prev === prayerName ? null : prayerName));
  };

  // Show full screen spinner while loading initial data
  if (loading || (!prayerData && viewMode !== 'mosques' && !locationPermissionNeeded)) {
    return (
      <>
        <PageSEO
          title="Accurate Islamic Prayer Times, Qibla & Ramadan Calendar"
          description="Get highly accurate Islamic prayer times worldwide. Features include local Namaz and Salah timings, Adhan audio alarms, Qibla compass, Hijri date converter, and full Ramadan fasting schedules (Sehri & Iftar)."
          path="/prayers"
          keywords={[
            'prayer times',
            'prayer times 2026',
            'prayer times today',
            'accurate prayer times',
            'prayer times worldwide',
            'prayer times by city',
            'salah times',
            'namaz times',
            'fajr time',
            'dhuhr time',
            'asr time',
            'maghrib time',
            'isha time',
            'fajr dhuhr asr maghrib isha',
            'ramadan fasting times',
            'sehri time',
            'iftar time',
            'hijri calendar',
            'islamic calendar',
            'qibla direction',
            'adhan times',
            'muslim prayer app',
            'hikmahsphere prayer times'
          ]}
        />
        <LoadingSpinner fullScreen text="Loading prayer times..." />
      </>
    );
  }

  if (locationPermissionNeeded && !prayerData && viewMode !== 'mosques') {
    return (
      <>
        <PageSEO
          title="Accurate Islamic Prayer Times, Qibla & Ramadan Calendar"
          description="Get highly accurate Islamic prayer times worldwide. Features include local Namaz and Salah timings, Adhan audio alarms, Qibla compass, Hijri date converter, and full Ramadan fasting schedules (Sehri & Iftar)."
          path="/prayers"
        />
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-16 pb-8">
          <div className="max-w-lg mx-auto px-4 py-10">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-center shadow-sm">
              <h1 className="text-lg font-semibold text-amber-950">Location permission needed</h1>
              <p className="mt-2 text-sm text-amber-900/90">
                Allow location access for accurate prayer times, or search for your city. We will ask again on each visit until permission is granted.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Allow location
                </button>
                <button
                  type="button"
                  onClick={() => setShowSearch(true)}
                  className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  Search city
                </button>
              </div>
              {error && (
                <p className="mt-3 text-sm text-red-600">{error}</p>
              )}
              {showSearch && (
                <form onSubmit={handleCitySearch} className="relative mt-4 text-left">
                  <input
                    type="text"
                    placeholder="Enter city name..."
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 pl-10 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                  />
                  <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <button
                    type="submit"
                    className="absolute right-1 top-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Search
                  </button>
                  {searchResults.length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                      {searchResults.map((result, idx) => (
                        <button
                          key={`${result.place_id || idx}`}
                          type="button"
                          onClick={() => selectLocation(result)}
                          className="block w-full border-b border-gray-100 px-4 py-2 text-left text-sm hover:bg-emerald-50"
                        >
                          {result.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageSEO
        title="Accurate Islamic Prayer Times, Qibla & Ramadan Calendar"
        description="Get highly accurate Islamic prayer times worldwide. Features include local Namaz and Salah timings, Adhan audio alarms, Qibla compass, Hijri date converter, and full Ramadan fasting schedules (Sehri & Iftar)."
        path="/prayers"
        keywords={[
          'prayer times',
          'prayer times 2026',
          'prayer times today',
          'accurate prayer times',
          'prayer times worldwide',
          'prayer times by city',
          'salah times',
          'namaz times',
          'fajr time',
          'dhuhr time',
          'asr time',
          'maghrib time',
          'isha time',
          'fajr dhuhr asr maghrib isha',
          'ramadan fasting times',
          'sehri time',
          'iftar time',
          'hijri calendar',
          'islamic calendar',
          'qibla direction',
          'adhan times',
          'muslim prayer app',
          'hikmahsphere prayer times'
        ]}
      />
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        {/* Header Section */}
        <div className="max-w-4xl mx-auto text-center mb-6 sm:mb-8">
	          <div className="relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4 mb-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 p-5 sm:p-6 shadow-lg">
            <div
              className="pointer-events-none absolute inset-0 opacity-10"
              style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, #ffffff 1px, transparent 0)',
                backgroundSize: '28px 28px',
              }}
            />
            <div className="relative z-10 flex items-center gap-3 sm:gap-4 text-left">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0">
                <ClockIcon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Prayer Time</h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm sm:text-lg font-semibold text-white/90">
                  <span>{activePrayerData?.date?.readable || prayerData?.date?.readable}</span>
                  {displayHijriReadable && (
                    <>
                      <span className="text-white/50">•</span>
                      <span className="font-arabic">{displayHijriReadable} AH</span>
                    </>
                  )}
                  {weatherData && (
                    <>
                      <span className="text-white/50">•</span>
                      <span className="whitespace-nowrap">
                        {weatherData.current.temperature_2m}°C{' '}
                        <span className="text-white/70">({getWeatherStyling(weatherData.current.weather_code, 'Dhuhr').label})</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="relative z-10 flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 sm:p-2.5 rounded-xl bg-white/15 hover:bg-white/25 transition-colors"
              title="Settings"
              aria-label="Toggle settings"
            >
              <Cog6ToothIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </button>
		            <div
		              ref={extraPrayerInfoRef}
		              className="relative"
		            >
		              <button
		                onClick={() => setShowExtraPrayerInfo((prev) => !prev)}
		                className="p-2 sm:p-2.5 rounded-xl bg-white/15 hover:bg-white/25 transition-colors"
		                title="About extra prayer times"
		                aria-label="About extra prayer times"
	                  aria-expanded={showExtraPrayerInfo}
                    type="button"
		              >
	                <InformationCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
	              </button>
	
	              {showExtraPrayerInfo && (
	                <>
	                  {/* Mobile - Bottom Sheet */}
	                  <div
	                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm sm:hidden md:hidden"
	                    onClick={() => setShowExtraPrayerInfo(false)}
	                  >
	                    <div
	                      className="absolute inset-x-2 bottom-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-emerald-100 bg-white p-3 text-left shadow-2xl sm:inset-x-3 sm:bottom-3 sm:max-h-[75vh] sm:rounded-3xl sm:p-4"
	                      onClick={(event) => event.stopPropagation()}
	                    >
	                      <div className="sticky top-0 right-0 flex justify-end mb-2">
	                        <button
	                          onClick={() => setShowExtraPrayerInfo(false)}
	                          className="p-2 rounded-full hover:bg-gray-100"
	                        >
	                          <XMarkIcon className="h-5 w-5 text-gray-500" />
	                        </button>
	                      </div>
	                      {extraPrayerInfoContent}
	                    </div>
	                  </div>
	                  {/* Tablet/iPad - Centered Modal */}
	                  <div
	                    className="fixed inset-0 z-50 hidden bg-black/50 backdrop-blur-sm sm:hidden md:block lg:hidden"
	                    onClick={() => setShowExtraPrayerInfo(false)}
	                  >
	                    <div className="flex min-h-full items-center justify-center p-4">
	                      <div
	                        className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-5 text-left shadow-2xl"
	                        onClick={(event) => event.stopPropagation()}
	                      >
	                        <div className="sticky top-0 right-0 flex justify-end mb-3">
	                          <button
	                            onClick={() => setShowExtraPrayerInfo(false)}
	                            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
	                          >
	                            <XMarkIcon className="h-6 w-6 text-gray-500" />
	                          </button>
	                        </div>
	                        {extraPrayerInfoContent}
	                      </div>
	                    </div>
	                  </div>
                  {/* Desktop - Centered Modal */}
                  <div
                    className="fixed inset-0 z-50 hidden bg-black/50 backdrop-blur-sm lg:block"
                    onClick={() => setShowExtraPrayerInfo(false)}
                  >
                    <div className="flex min-h-full items-center justify-center p-4">
                      <div
                        className="relative max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-6 text-left shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {extraPrayerInfoContent}
                      </div>
                    </div>
                  </div>
	                </>
	              )}
	            </div>
            {/* Test scroll button - only visible on mobile in development mode */}
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={() => {
                  hasScrolledToPrayerRef.current = false;
                  const currentCard = prayerCardRefs.current[currentPrayerIndex >= 0 ? currentPrayerIndex : nextPrayerIndex];
                  if (currentCard) {
                    const rect = currentCard.getBoundingClientRect();
                    const absoluteTop = window.scrollY + rect.top;
                    const viewportHeight = window.innerHeight;
                    const scrollTop = Math.max(0, absoluteTop - (viewportHeight * 0.15));
                    console.log('Manual scroll to:', scrollTop);
                    window.scrollTo({ top: scrollTop, behavior: 'smooth' });
                  } else {
                    console.log('No card found at index:', currentPrayerIndex);
                  }
                }}
                className="p-2 sm:p-2.5 rounded-xl bg-amber-500 text-white shadow-md block sm:hidden"
                title="Test Scroll"
              >
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
            )}
            </div>
          </div>

          {/* View Mode Toggle - Mobile Optimized */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <button
              onClick={() => handleViewModeChange('daily')}
              className={`flex-1 min-w-[80px] sm:min-w-[100px] px-2 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-xl font-semibold text-xs sm:text-sm md:text-base transition-all duration-300 flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 whitespace-nowrap shadow-md ${
                viewMode === 'daily'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ClockIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
              <span className="hidden xs:inline">Daily</span>
              <span className="xs:hidden">Day</span>
            </button>
            <button
              onClick={() => handleViewModeChange('monthly')}
              className={`flex-1 min-w-[80px] sm:min-w-[100px] px-2 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-xl font-semibold text-xs sm:text-sm md:text-base transition-all duration-300 flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 whitespace-nowrap shadow-md ${
                viewMode === 'monthly'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <CalendarDaysIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
              <span className="hidden xs:inline">Monthly</span>
              <span className="xs:hidden">Month</span>
            </button>
            <button
              onClick={() => handleViewModeChange('mosques')}
              className={`flex-1 min-w-[80px] sm:min-w-[100px] px-2 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-xl font-semibold text-xs sm:text-sm md:text-base transition-all duration-300 flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 whitespace-nowrap shadow-md ${
                viewMode === 'mosques'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <MapPinIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
              <span className="hidden xs:inline">Mosques</span>
              <span className="xs:hidden">Mosques</span>
            </button>
            {shouldShowRamadanTab && (
              <button
                onClick={() => handleViewModeChange('ramadan')}
                className={`flex-1 min-w-[80px] sm:min-w-[100px] px-2 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-xl font-semibold text-xs sm:text-sm md:text-base transition-all duration-300 flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 whitespace-nowrap shadow-md ${
                  viewMode === 'ramadan'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <MoonIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                <span className="hidden xs:inline">Ramadan</span>
                <span className="xs:hidden">Ramadan</span>
              </button>
            )}
          </div>
          
          {/* Settings Panel Modal */}
          {showSettings && (
            <div
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowSettings(false)}
            >
              <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
                <div
                  className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-3xl bg-white shadow-2xl p-4 sm:p-6 text-left animate-fade-in-down"
                  onClick={(event) => event.stopPropagation()}
                >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-semibold text-base sm:text-lg flex items-center">
                  <Cog6ToothIcon className="h-5 w-5 mr-2" />
                  Prayer Calculation Settings
                </h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Close settings"
                  title="Close settings"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {/* Calculation Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Calculation Method
                  </label>
                  <select
                    value={calculationMethod}
                    onChange={(e) => setCalculationMethod(parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  >
                    <option value="0">Shia Ithna-Ansari</option>
                    <option value="1">University of Islamic Sciences, Karachi</option>
                    <option value="2">Islamic Society of North America (ISNA)</option>
                    <option value="3">Muslim World League (MWL)</option>
                    <option value="4">Umm Al-Qura University, Makkah</option>
                    <option value="5">Egyptian General Authority of Survey</option>
                    <option value="7">Institute of Geophysics, Tehran</option>
                    <option value="8">Gulf Region</option>
                    <option value="9">Kuwait</option>
                    <option value="10">Qatar</option>
                    <option value="11">Majlis Ugama Islam Singapura</option>
                    <option value="12">Union Organization islamic de France</option>
                    <option value="13">Diyanet İşleri Başkanlığı, Turkey</option>
                    <option value="14">Spiritual Administration of Muslims of Russia</option>
                  </select>
                </div>

                {/* School of Jurisprudence */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    School of Jurisprudence (Madhab)
                  </label>
                  <select
                    value={selectedMadhab}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedMadhab(val);
                      updatePreference('asrMethod', val === 'hanafi' ? 'hanafi' : 'standard');
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  >
                    <option value="shafi">Shafi'i / Maliki / Hanbali</option>
                    <option value="hanafi">Hanafi</option>
                  </select>
                </div>

                {/* High Latitude Rule */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    High Latitude Adjustment
                  </label>
                  <select
                    value={highLatitudeRule}
                    onChange={(e) => setHighLatitudeRule(parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  >
                    <option value="1">Middle of Night</option>
                    <option value="2">One Seventh</option>
                    <option value="3">Angle Based</option>
                  </select>
                </div>

                {/* Clock Format */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Clock Format
                  </label>
                  <select
                    value={timeFormat}
                    onChange={(e) => setTimeFormat(e.target.value as '12h' | '24h')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  >
                    <option value="12h">12-hour (AM/PM)</option>
                    <option value="24h">24-hour</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Default is 12-hour in India and 24-hour outside India.
                  </p>
                </div>

                {canManagePrayerTuning && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 sm:p-4">
                    <div className="mb-2">
                      <h4 className="text-sm sm:text-base font-semibold text-emerald-800">Prayer Tuning (Admin)</h4>
                      <p className="text-xs text-emerald-700 mt-1">
                        Fine tune each prayer by -5 to +5 minutes.
                      </p>
                    </div>

                    {isPrayerTuningLoading ? (
                      <p className="text-xs text-gray-600">Loading tuning settings...</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                          {([
                            ['fajr', 'Fajr'],
                            ['dhuhr', 'Dhuhr'],
                            ['asr', 'Asr'],
                            ['maghrib', 'Maghrib'],
                            ['isha', 'Isha'],
                            ['imsak', 'Imsak'],
                          ] as Array<[keyof PrayerTuningState['offsets'], string]>).map(([key, label]) => (
                            <label key={key} className="text-xs sm:text-sm text-gray-700">
                              <span className="mb-1 block font-medium">{label} (min)</span>
                              <input
                                type="number"
                                min={-5}
                                max={5}
                                value={prayerTuning.offsets[key]}
                                onChange={(event) => updatePrayerTuningOffset(key, event.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </label>
                          ))}
                        </div>

                        <label className="mt-3 inline-flex items-center gap-2 text-xs sm:text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={prayerTuning.applyToFasting}
                            onChange={(event) => {
                              setPrayerTuning((prev) => ({
                                ...prev,
                                applyToFasting: event.target.checked,
                              }));
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          Apply tuning to fasting times (Sahur/Iftar)
                        </label>

                        {prayerTuning.updatedAt && (
                          <p className="mt-2 text-[11px] text-gray-500">
                            Last updated: {new Date(prayerTuning.updatedAt).toLocaleString()}
                          </p>
                        )}

                        {prayerTuningError && (
                          <p className="mt-2 text-xs text-red-600">{prayerTuningError}</p>
                        )}
                        {prayerTuningMessage && (
                          <p className="mt-2 text-xs text-emerald-700">{prayerTuningMessage}</p>
                        )}

                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={savePrayerTuning}
                            disabled={isPrayerTuningSaving}
                            className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors ${
                              isPrayerTuningSaving
                                ? 'cursor-not-allowed bg-emerald-300'
                                : 'bg-emerald-600 hover:bg-emerald-700'
                            }`}
                          >
                            {isPrayerTuningSaving ? 'Saving...' : 'Save Prayer Tuning'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {canManagePrayerTuning && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 sm:p-4">
                    <div className="mb-2">
                      <h4 className="text-sm sm:text-base font-semibold text-indigo-800">Islamic Date (Admin)</h4>
                      <p className="text-xs text-indigo-700 mt-1">
                        Nudge the Hijri date by a day for all visitors if the local moon sighting differs. Saved globally.
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Day adjustment</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => adjustHijriInput(-1)}
                          disabled={isHijriAdjustmentSaving || hijriAdjustmentInput <= HIJRI_ADJUSTMENT_MIN}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-300 bg-white text-lg font-bold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Decrease Islamic date by one day"
                        >
                          −
                        </button>
                        <span className="min-w-[3rem] text-center text-sm font-semibold text-indigo-900">
                          {hijriAdjustmentInput > 0 ? `+${hijriAdjustmentInput}` : hijriAdjustmentInput} {Math.abs(hijriAdjustmentInput) === 1 ? 'day' : 'days'}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustHijriInput(1)}
                          disabled={isHijriAdjustmentSaving || hijriAdjustmentInput >= HIJRI_ADJUSTMENT_MAX}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-300 bg-white text-lg font-bold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Increase Islamic date by one day"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <p className="mt-2 text-[11px] text-gray-500">
                      Preview:{' '}
                      <span className="font-arabic font-semibold text-indigo-900">
                        {formatHijriReadable(
                          buildLocationAwareHijriDateFromGregorianDate(civilTodayGregorianDate, activeCountry, hijriAdjustmentInput)
                        ) || '—'}{' '}
                        AH
                      </span>
                    </p>

                    {hijriAdjustmentError && (
                      <p className="mt-2 text-xs text-red-600">{hijriAdjustmentError}</p>
                    )}
                    {hijriAdjustmentMessage && (
                      <p className="mt-2 text-xs text-indigo-700">{hijriAdjustmentMessage}</p>
                    )}

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={saveHijriAdjustment}
                        disabled={isHijriAdjustmentSaving || (hijriAdjustment != null && hijriAdjustmentInput === hijriAdjustment)}
                        className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors ${
                          isHijriAdjustmentSaving || (hijriAdjustment != null && hijriAdjustmentInput === hijriAdjustment)
                            ? 'cursor-not-allowed bg-indigo-300'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {isHijriAdjustmentSaving ? 'Saving...' : 'Save Islamic Date'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Month/Year Selection for Monthly View */}
                {viewMode === 'monthly' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Month
                      </label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'long' })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Year
                      </label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      >
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() + i;
                          return (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </>
                )}
              </div>
                </div>
              </div>
            </div>
          )}

          {isOutsideIndia && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 text-left">
              <p className="text-sm sm:text-base font-semibold text-amber-800">
                Location Notice: {activeCountry}
              </p>
              <p className="text-xs sm:text-sm text-amber-700 mt-1">
                For better prayer-time accuracy outside India, review your Calculation Method, Madhab, and High Latitude Adjustment in settings.
              </p>
            </div>
          )}

          {/* Islamic Events Display - Mobile Optimized */}
          {visibleIslamicEvents.length > 0 && (
            <div className="bg-gradient-to-r from-emerald-100 to-teal-100 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                {visibleIslamicEvents.map((event, idx) => (
                  <div
                    key={idx}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium ${
                      event.type === 'holiday'
                        ? 'bg-emerald-600 text-white'
                        : event.type === 'special'
                        ? 'bg-teal-600 text-white'
                        : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {event.icon} <span className="hidden xs:inline">{event.name || 'Event'}</span><span className="xs:hidden">{event.name?.split(' ')[0] || 'Event'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Location and Date Display - Mobile Optimized */}
          <div className="flex flex-col items-center justify-center text-gray-600 mb-3 sm:mb-4">
            {locationPermissionNeeded && (
              <div className="w-full max-w-lg mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
                <p className="font-medium">Location permission needed</p>
                <p className="mt-1 text-amber-800/90">
                  Allow location access for accurate prayer times, or search for your city. We will ask again on each visit until permission is granted.
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Allow location
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSearch(true)}
                    className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    Search city
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                  onClick={() => setShowSearch(!showSearch)}
                  className="flex items-center hover:text-emerald-600 transition-colors text-sm sm:text-base"
              >
                  <MapPinIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" />
                  <span className="truncate max-w-[220px] sm:max-w-full">
                      {location ? `${cityQuery || 'Current Location'}` : 'Select Location'}
                  </span>
              </button>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="text-[11px] sm:text-xs px-2.5 py-1 rounded-full border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                title="Use current location"
              >
                Use Current
              </button>
            </div>

          </div>

          {/* Search Bar - Mobile Optimized */}
          {showSearch && (
            <div className="max-w-md mx-auto mt-4 relative animate-fade-in-down">
                <form onSubmit={handleCitySearch} className="relative">
                <input
                    type="text"
                    placeholder="Enter city name..."
                    className="w-full px-4 py-2.5 pl-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm text-base"
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                />
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                <button
                    type="submit"
                    className="absolute right-1 top-1 bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 text-sm font-medium"
                >
                    Search
                </button>
                <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="absolute right-[74px] top-1 bg-white text-emerald-700 border border-emerald-200 px-2 py-1.5 rounded-lg hover:bg-emerald-50 text-xs font-semibold"
                    title="Use current location"
                >
                    Current
                </button>
                </form>

                {searchResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((result: any, idx) => (
                    <button
                        key={idx}
                        onClick={() => selectLocation(result)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm text-gray-700"
                    >
                        {result.display_name}
                    </button>
                    ))}
                </div>
                )}
            </div>
          )}

          {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
        </div>

        {viewMode === 'mosques' && (
          <div className="max-w-7xl mx-auto mb-6 sm:mb-8">
            <MosqueFinder location={location} />
          </div>
        )}

        {/* Monthly Calendar View - Mobile Optimized */}
        {viewMode === 'monthly' && monthlyData && (
          <div className="max-w-6xl mx-auto mb-6 sm:mb-8">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-emerald-600 text-white px-4 sm:px-6 py-3 sm:py-4">
                <h2 className="text-lg sm:text-2xl font-bold">
                  {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Fajr</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Sunrise</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Dhuhr</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Asr</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Maghrib</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Isha</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Hijri</th>
                    </tr>
                  </thead>
		                  <tbody className="divide-y divide-gray-200">
		                    {monthlyData.map((day: any, idx: number) => {
		                      const {
		                        isToday,
		                        hijriMonth,
		                        hijriDay,
		                        isRamadan,
		                        isEidFitr,
		                        isEidAdha,
		                        isArafah,
		                        isAshura,
		                        isWhiteDay,
		                      } = getMonthlyDayInfo(day);

		                      // Determine row background color (priority order)
	                      let rowBgClass = 'hover:bg-gray-50';
	                      let rowBorderClass = '';
	                      if (isToday) {
	                        rowBgClass = 'bg-emerald-50 hover:bg-emerald-50';
	                        rowBorderClass = 'ring-2 ring-inset ring-emerald-400';
	                      } else if (isEidFitr) {
	                        rowBgClass = 'bg-green-100 hover:bg-green-100';
	                      } else if (isEidAdha) {
                        rowBgClass = 'bg-red-100 hover:bg-red-100';
                      } else if (isArafah) {
                        rowBgClass = 'bg-purple-100 hover:bg-purple-100';
                      } else if (isAshura) {
                        rowBgClass = 'bg-blue-100 hover:bg-blue-100';
                      } else if (isWhiteDay) {
                        rowBgClass = 'bg-amber-50 hover:bg-amber-50';
                      } else if (isRamadan) {
                        rowBgClass = 'bg-indigo-50 hover:bg-indigo-50';
                      }

	                      return (
	                        <tr key={idx} className={`${rowBgClass} ${rowBorderClass}`}>
	                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm font-medium text-gray-900">
	                            <div className="flex items-center gap-2">
	                              <span className={`inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-1 text-sm font-bold ${
	                                isToday
	                                  ? 'bg-emerald-600 text-white shadow-sm'
	                                  : 'bg-gray-100 text-gray-700'
	                              }`}>
	                                {day.date.gregorian.day}
	                              </span>
	                              {isToday && (
	                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
	                                  Today
	                                </span>
	                              )}
	                            </div>
	                          </td>
	                          <td className={`px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm ${isToday ? 'font-semibold text-emerald-800' : 'text-gray-500'}`}>
	                            {day.date.gregorian.weekday.en}
	                          </td>
	                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm text-gray-900">{formatTimeForDisplay(day.timings.Fajr)}</td>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm text-gray-500">{formatTimeForDisplay(day.timings.Sunrise)}</td>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm text-gray-900">{formatTimeForDisplay(day.timings.Dhuhr)}</td>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm text-gray-900">{formatTimeForDisplay(day.timings.Asr)}</td>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm text-gray-900">{formatTimeForDisplay(day.timings.Maghrib)}</td>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm text-gray-900">{formatTimeForDisplay(day.timings.Isha)}</td>
	                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm text-gray-500">
	                            <span className="flex items-center gap-1">
	                              {isWhiteDay && (
	                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="White Day"></span>
	                              )}
	                              <span className={isToday ? 'font-semibold text-emerald-800' : ''}>
	                                {hijriDay} {hijriMonth}
	                              </span>
	                            </span>
	                          </td>
	                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Color Legend - Mobile Optimized */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 uppercase mb-2.5">Color Legend</p>
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                  <div className="flex items-center">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-emerald-100 mr-2"></div>
                    <span className="text-xs text-gray-600">Today</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-indigo-50 mr-2"></div>
                    <span className="text-xs text-gray-600">Ramadan</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-green-100 mr-2"></div>
                    <span className="text-xs text-gray-600">Eid al-Fitr</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-red-100 mr-2"></div>
                    <span className="text-xs text-gray-600">Eid al-Adha</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-purple-100 mr-2"></div>
                    <span className="text-xs text-gray-600">Arafah</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-blue-100 mr-2"></div>
                    <span className="text-xs text-gray-600">Ashura</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-amber-50 ring-1 ring-amber-200 mr-1 flex-shrink-0"></div>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"></span>
                    <span className="text-xs text-gray-600">White Days</span>
                  </div>
                </div>

                {/* White Days Info Banner */}
                <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl leading-none mt-0.5">🌕</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-amber-900 mb-0.5">White Days (Al-Ayyam Al-Beed)</p>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        The 13th, 14th &amp; 15th of every Hijri month. It is Sunnah to fast on these days — the Prophet ﷺ
                        used to observe these fasts and encouraged the Ummah to do the same. They are called White Days
                        because the moon is full and the nights are bright.
                      </p>
	                      {monthlyWhiteDayEntries.length > 0 && (
	                        <div className="flex flex-wrap gap-2 mt-2">
	                          {monthlyWhiteDayEntries.map(({ label, date }) => {
	                            const formatted = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
	                            return (
	                              <span key={`${label}-${formatGregorianDDMMYYYY(date)}`} className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-medium">
	                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
	                                {label}: {formatted}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid: Prayer Cards + Calendar */}
	        {viewMode === 'daily' && (
	        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8 max-w-6xl mx-auto">
          {/* Prayer Cards Column */}
          <div className="xl:col-span-3" ref={prayersContainerRef}>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr gap-4 sm:gap-6 h-full">
              {prayers.map((prayer, index) => {
                // Get weather for this prayer time
                const weather = getWeatherForTime(prayer.time);
                const weatherStyle = weather ? getWeatherStyling(weather.code, prayer.name) : null;
                const WeatherIcon = weatherStyle?.icon || SunIcon;

                // Determine prayer state
                const isCurrentPrayer = index === currentPrayerIndex;
                const isNextPrayer = index === nextPrayerIndex;
                const isPastPrayer = index < currentPrayerIndex;
                const hasTopBadge = isCurrentPrayer || (isNextPrayer && !isCurrentPrayer);

                // Calculate total seconds for countdown display
                const totalSeconds = countdown.hours * 3600 + countdown.minutes * 60 + countdown.seconds;
                const countdownDisplay = formatCountdown(totalSeconds);
                const isFlipped = activeFlippedCard === prayer.name;
                const backRows = prayer.name === 'Sunrise'
                  ? SUNRISE_RAKAT_BREAKDOWN.map((item, rowIndex) => ({
                    ...item,
                    key: `${prayer.name}-${rowIndex}`,
                    label: rowIndex === 0 ? 'Ishraq (Nafl)' : 'Duha (Nafl)',
                  }))
                  : (PRAYER_RAKAT_BREAKDOWN[prayer.name as keyof typeof PRAYER_RAKAT_BREAKDOWN] || []).map((item, rowIndex) => ({
                    ...item,
                    key: `${prayer.name}-${item.type}-${rowIndex}`,
                    label: item.type,
                  }));
                const usedRakatTypes = Array.from(new Set(backRows.map((item) => item.type as RakatType)));
                const isGuideOpen = openGuideCard === prayer.name;

                return (
                    <div 
                      ref={(el) => { prayerCardRefs.current[index] = el; }}
                      key={prayer.name} 
                      role="button"
                      tabIndex={0}
                      aria-label={`${prayer.name} prayer card. Tap to flip for rakat breakdown.`}
                      aria-pressed={isFlipped}
                      onPointerUp={(event) => {
                        event.preventDefault();
                        handlePrayerCardFlip(prayer.name);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handlePrayerCardFlip(prayer.name);
                        }
                      }}
                      className="prayer-flip-container relative h-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
                    >
                    <div className={`prayer-flip-inner h-full ${isFlipped ? 'is-flipped' : ''}`}>
                    <div className={`prayer-flip-face prayer-flip-front relative rounded-xl shadow-md p-4 sm:p-6 transition-all duration-300 flex flex-col justify-between
                        ${isCurrentPrayer 
                          ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-500 shadow-lg scale-[1.02]' 
                          : isPastPrayer
                            ? 'bg-gray-50 border-l-4 border-gray-300 opacity-75'
                            : 'bg-white border-l-4 shadow-md'
                        }
                        ${!isCurrentPrayer && !prayer.isSecondary ? 'border-emerald-500 hover:shadow-lg' : ''}
                        ${!isCurrentPrayer && prayer.isSecondary ? 'border-orange-200' : ''}
                        ${isNextPrayer && !isNextDay ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}
                        ${hasTopBadge ? 'pt-7 sm:pt-8' : ''}
                      `}>
                    {/* Current Prayer Badge */}
                    {isCurrentPrayer && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg animate-pulse">
                          Current Prayer
                        </span>
                      </div>
                    )}

                    {/* Next Prayer Badge with Countdown */}
                    {isNextPrayer && !isCurrentPrayer && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          Next
                        </span>
                      </div>
                    )}

                    <div>
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center flex-1 min-w-0">
                            <prayer.icon className={`h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 flex-shrink-0 
                              ${isCurrentPrayer 
                                ? 'text-emerald-600 animate-pulse' 
                                : prayer.isSecondary 
                                  ? 'text-orange-400' 
                                  : 'text-emerald-600'
                              }`} 
                            />
                            <div className="min-w-0 flex-1">
                                <h3 className={`text-base sm:text-lg font-semibold truncate
                                  ${isCurrentPrayer ? 'text-emerald-700' : 'text-gray-900'}
                                `}>
                                  {prayer.name}
                                </h3>
                                <p className="text-xs sm:text-sm text-gray-500 truncate">{prayer.description}</p>
                            </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                            <p className={`text-xl sm:text-2xl font-bold 
                              ${isCurrentPrayer 
                                ? 'text-emerald-600' 
                                : prayer.isSecondary 
                                  ? 'text-gray-700' 
                                  : 'text-emerald-600'
                              }`}
                            >
                              {formatTimeForDisplay(prayer.time)}
                            </p>
                            <p className="text-lg sm:text-xl font-bold font-arabic text-gray-600">{prayer.arabic}</p>
                            </div>
                        </div>
                          <p className="text-[11px] font-medium text-gray-400">Tap to flip</p>
                    </div>

                    {prayer.name === 'Dhuhr' && isFriday && (
                      <div className="mb-3 flex justify-center translate-y-[16px]">
                        <span className="inline-flex min-w-[160px] items-center justify-center rounded-full border border-emerald-300 bg-emerald-100 px-6 py-2 text-sm font-extrabold text-emerald-700 shadow-sm animate-pulse">
                          Friday
                        </span>
                      </div>
                    )}

                    {/* Footer Section: Fasting Info & Weather */}
                    <div className="mt-4 flex min-h-[92px] items-end justify-between border-t border-gray-50 pt-3 sm:min-h-[104px]">
                        {/* Left Side: Fasting Info or Countdown */}
                        <div className="flex-1 min-w-0">
                            {isNextPrayer && !isCurrentPrayer ? (
                              // Show countdown for next prayer
                              <div className="flex flex-col gap-1">
                                <div>
                                  <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide">Starts in</span>
                                  <p className="text-sm sm:text-base font-bold text-amber-600 font-mono">
                                    {countdownDisplay}
                                  </p>
                                </div>
                                {/* Also show fasting time for Fajr and Maghrib */}
                                {prayer.name === 'Fajr' && activeFastingEntry && (
                                  <div className="mt-1 pt-1 border-t border-gray-100">
                                    <span className="text-xs font-medium text-gray-500" title="Imsak - Time to stop eating">Sehri Ends (Imsak)</span>
                                    <p className="text-sm font-bold text-emerald-600">{formatTimeForDisplay(activeFastingEntry.time.sahur)}</p>
                                  </div>
                                )}
                                {prayer.name === 'Maghrib' && activeFastingEntry && (
                                  <div className="mt-1 pt-1 border-t border-gray-100">
                                    <span className="text-xs font-medium text-gray-500">Iftar Time</span>
                                    <p className="text-sm font-bold text-emerald-600">{formatTimeForDisplay(activeFastingEntry.time.iftar)}</p>
                                  </div>
                                )}
                                {/* Show Ishraq/Duha times for Sunrise - ALWAYS VISIBLE even during countdown */}
                                {prayer.name === 'Sunrise' && ishraqTimeDisplay && (
                                  <div className="mt-1 pt-1 border-t border-gray-100">
                                    <span className="text-xs font-medium text-gray-500">Ishraq Starts</span>
                                    <p className="text-sm font-bold text-emerald-600">{ishraqTimeDisplay}</p>
                                  </div>
                                )}
                                {prayer.name === 'Sunrise' && duhaTimeDisplay && (
                                  <div className={`${ishraqTimeDisplay ? 'mt-1 pt-1 border-t border-gray-100' : ''}`}>
                                    <span className="text-xs font-medium text-gray-500">Duha Begins</span>
                                    <p className="text-sm font-bold text-emerald-600">{duhaTimeDisplay}</p>
                                  </div>
                                )}
                              </div>
                            ) : prayer.name === 'Fajr' && activeFastingEntry ? (
                                <div className="flex flex-col gap-1">
                                    {isCurrentPrayer ? (
                                      // When Fajr is current, show "Now" above Sehri time
                                      <>
                                        <div>
                                          <span className="text-[10px] sm:text-xs font-medium text-emerald-600 uppercase tracking-wide font-bold">● Now</span>
                                        </div>
                                        <div className="mt-1 pt-1 border-t border-gray-100">
                                          <span className="text-xs font-medium text-gray-500" title="Imsak - Time to stop eating">Sehri Ends (Imsak)</span>
                                          <p className="text-sm font-bold text-emerald-600">{formatTimeForDisplay(activeFastingEntry.time.sahur)}</p>
                                        </div>
                                      </>
                                    ) : (
                                      <div>
                                          <span className="text-xs font-medium text-gray-500" title="Imsak - Time to stop eating">Sehri Ends (Imsak)</span>
                                          <p className="text-sm font-bold text-emerald-600">{formatTimeForDisplay(activeFastingEntry.time.sahur)}</p>
                                      </div>
                                    )}
                                </div>
                            ) : prayer.name === 'Maghrib' && activeFastingEntry ? (
                                <div className="flex flex-col gap-1">
                                    {isCurrentPrayer ? (
                                      // When Maghrib is current, show "Now" above Iftar time
                                      <>
                                        <div>
                                          <span className="text-[10px] sm:text-xs font-medium text-emerald-600 uppercase tracking-wide font-bold">● Now</span>
                                        </div>
                                        <div className="mt-1 pt-1 border-t border-gray-100">
                                          <span className="text-xs font-medium text-gray-500">Iftar Time</span>
                                          <p className="text-sm font-bold text-emerald-600">{formatTimeForDisplay(activeFastingEntry.time.iftar)}</p>
                                          <span className="text-xs font-medium text-gray-500">Duration</span>
                                          <p className="text-xs font-semibold text-gray-600">{activeFastingEntry.time.duration}</p>
                                        </div>
                                      </>
                                    ) : (
                                      <div>
                                          <span className="text-xs font-medium text-gray-500">Iftar Time</span>
                                          <p className="text-sm font-bold text-emerald-600">{formatTimeForDisplay(activeFastingEntry.time.iftar)}</p>
                                          <span className="text-xs font-medium text-gray-500">Duration</span>
                                          <p className="text-xs font-semibold text-gray-600">{activeFastingEntry.time.duration}</p>
                                      </div>
                                    )}
                                </div>
                            ) : prayer.name === 'Sunrise' ? (
                              <div className="flex flex-col gap-1">
                                {isCurrentPrayer && (
                                  <div>
                                    <span className="text-[10px] sm:text-xs font-medium text-emerald-600 uppercase tracking-wide font-bold">● Now</span>
                                    <p className="text-sm font-bold text-emerald-700">Prayer Time</p>
                                  </div>
                                )}
                                {ishraqTimeDisplay && (
                                  <div className={`${isCurrentPrayer ? 'mt-1 pt-1 border-t border-gray-100' : ''}`}>
                                    <span className="text-xs font-medium text-gray-500">Ishraq Starts</span>
                                    <p className="text-sm font-bold text-emerald-600">{ishraqTimeDisplay}</p>
                                  </div>
                                )}
                                {duhaTimeDisplay && (
                                  <div className={`${ishraqTimeDisplay ? 'mt-1 pt-1 border-t border-gray-100' : ''}`}>
                                    <span className="text-xs font-medium text-gray-500">Duha Begins</span>
                                    <p className="text-sm font-bold text-emerald-600">{duhaTimeDisplay}</p>
                                  </div>
                                )}
                              </div>
                            ) : prayer.name === 'Dhuhr' ? (
                              <div className="flex flex-col gap-1">
                                {isCurrentPrayer && (
                                  <div>
                                    <span className="text-[10px] sm:text-xs font-medium text-emerald-600 uppercase tracking-wide font-bold">● Now</span>
                                    <p className="text-sm font-bold text-emerald-700">Prayer Time</p>
                                  </div>
                                )}
                                {duhaEndDisplay && (
                                  <div className={`${isCurrentPrayer ? 'mt-1 pt-1 border-t border-gray-100' : ''}`}>
                                    <span className="text-xs font-medium text-gray-500">Duha Ends</span>
                                    <p className="text-sm font-bold text-emerald-600">{duhaEndDisplay}</p>
                                  </div>
                                )}
                              </div>
                            ) : prayer.name === 'Isha' ? (
                              <div className="flex flex-col gap-1">
                                {isCurrentPrayer && (
                                  <div>
                                    <span className="text-[10px] sm:text-xs font-medium text-emerald-600 uppercase tracking-wide font-bold">● Now</span>
                                    <p className="text-sm font-bold text-emerald-700">Prayer Time</p>
                                  </div>
                                )}
                                {activePrayerData?.times?.Midnight && (
                                  <div className={`${isCurrentPrayer ? 'mt-1 pt-1 border-t border-gray-100' : ''}`}>
                                    <span className="text-xs font-medium text-gray-500">Islamic Midnight</span>
                                    <p className="text-sm font-bold text-emerald-600">{formatTimeForDisplay(activePrayerData.times.Midnight)}</p>
                                  </div>
                                )}
                                {lastThirdRangeDisplay && (
                                  <div className={`${activePrayerData?.times?.Midnight ? 'mt-1 pt-1 border-t border-gray-100' : ''}`}>
                                    <span className="text-xs font-medium text-gray-500">Tahajjud Time</span>
                                    <p className="text-sm font-bold text-emerald-600">{lastThirdRangeDisplay}</p>
                                  </div>
                                )}
                              </div>
                            ) : isCurrentPrayer ? (
                              // Show "Prayer Time Now" for other current prayers (Dhuhr, Asr)
                              <div className="flex flex-col gap-1">
                                <div>
                                  <span className="text-[10px] sm:text-xs font-medium text-emerald-600 uppercase tracking-wide font-bold">● Now</span>
                                  <p className="text-sm font-bold text-emerald-700">Prayer Time</p>
                                </div>
                              </div>
                            ) : null}
                        </div>

                        {/* Right Side: Enhanced Weather Info with Max/Min */}
                        {weather && weatherStyle && (
                            <div className="flex items-center justify-end text-right flex-shrink-0 ml-2">
                                <div className="mr-2 flex flex-col items-end">
                                    <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-0.5">{weatherStyle.label}</span>
                                    <div className="flex items-baseline">
                                         <span className="text-lg sm:text-xl font-bold text-gray-700 leading-none mr-1.5 sm:mr-2">{Math.round(weather.temp)}°</span>
                                         <div className="flex flex-col text-[9px] sm:text-[10px] text-gray-400 leading-tight">
                                            {weather.max && <span>H: {Math.round(weather.max)}°</span>}
                                            {weather.min && <span>L: {Math.round(weather.min)}°</span>}
                                         </div>
                                    </div>
                                </div>
                                <div className={`p-1.5 sm:p-2 rounded-full bg-gray-50 ${weatherStyle.color.replace('text-', 'bg-').replace('600', '100').replace('500', '100').replace('400', '100').replace('300', '50')}`}>
                                     <WeatherIcon className={`h-6 w-6 sm:h-8 sm:w-8 ${weatherStyle.color}`} />
                                </div>
                            </div>
                        )}
                    </div>
                    </div>
                    <div className={`prayer-flip-face prayer-flip-back rounded-xl p-4 sm:p-6 flex flex-col
                      ${isCurrentPrayer
                        ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-500 shadow-lg'
                        : isPastPrayer
                          ? 'bg-gray-50 border-l-4 border-gray-300'
                          : 'bg-white border-l-4 shadow-md'
                      }
                      ${!isCurrentPrayer && !prayer.isSecondary ? 'border-emerald-500' : ''}
                      ${!isCurrentPrayer && prayer.isSecondary ? 'border-orange-200' : ''}
                      ${isNextPrayer && !isNextDay ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}
                    `}>
                      <div className="mb-3 flex items-start justify-between gap-2 border-b border-emerald-100 pb-2">
                        <div>
                          <p className="text-base sm:text-lg font-semibold text-gray-900">{prayer.name} Rakats</p>
                          <p className="text-xs text-gray-500">{prayer.description}</p>
                        </div>
                        <div className="relative">
                          <button
                            type="button"
                            aria-label={`${prayer.name} rakat guide`}
                            onPointerUp={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenGuideCard((prev) => (prev === prayer.name ? null : prayer.name));
                            }}
                            className="rounded-full p-1 text-emerald-700 hover:bg-emerald-100"
                          >
                            <InformationCircleIcon className="h-4 w-4" />
                          </button>
                          {isGuideOpen && (
                            <div
                              className="absolute right-0 top-8 z-20 w-64 rounded-lg border border-emerald-100 bg-white p-3 text-xs shadow-xl"
                              onPointerUp={(event) => event.stopPropagation()}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <p className="text-gray-700"><span className="font-semibold text-emerald-700">Sunnah Muakkadah:</span> strongly emphasized Sunnah.</p>
                              <p className="mt-2 text-gray-700"><span className="font-semibold text-amber-700">Sunnah Ghair Muakkadah:</span> less emphasized Sunnah.</p>
                              <div className="mt-3 border-t border-gray-100 pt-2">
                                <p className="mb-1 font-semibold text-gray-600">Color key</p>
                                <div className="space-y-1">
                                  {usedRakatTypes.map((type) => {
                                    const meta = RAKAT_TYPE_META[type];
                                    return (
                                      <p key={`${prayer.name}-${type}`} className={`${meta.colorClassName} font-medium`}>
                                        {meta.icon} {type}
                                      </p>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 space-y-1.5">
                        {backRows.map((item) => {
                          const meta = RAKAT_TYPE_META[item.type as RakatType] || RAKAT_TYPE_META.Nafl;
                          return (
                            <div key={item.key} className="flex items-center justify-between gap-2 rounded-md border border-gray-100 bg-white/80 px-2 py-1.5">
                              <p className={`text-[11px] sm:text-xs font-semibold ${meta.colorClassName}`}>
                                {meta.icon} {item.label} - {item.rakat}
                              </p>
                              <span className="text-[10px] text-gray-500">{meta.meaning}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    </div>
                    </div>
                );
              })}
            </div>
          </div>

          {/* Calendar Column */}
          <div className="xl:col-span-1">
            <IslamicCalendar whiteDays={activeFastingData?.white_days || fastingData?.white_days} todayHijri={displayHijriDate || effectiveHijriDate || prayerData?.date?.hijri} adjustmentOffset={resolvedHijriOffset} />
          </div>
        </div>

        )}

        {/* Ramadan View - Mobile Optimized */}
        {viewMode === 'ramadan' && ramadanData && (
          <div className="max-w-6xl mx-auto mb-6 sm:mb-8">
            {/* Dua Card - Mobile Optimized */}
            {ramadanData.resource?.dua && (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-white/10 rounded-full blur-2xl sm:blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-32 sm:w-48 h-32 sm:h-48 bg-white/10 rounded-full blur-2xl sm:blur-3xl"></div>

                <div className="relative">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                        <SparklesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold">{ramadanData?.resource?.dua?.title || 'Daily Dua'}</h3>
                    </div>

                    {/* Share Button */}
                    <button
                      onClick={() => {
                        const shareModal = document.getElementById('share-modal');
                        if (shareModal) {
                            const modalTitle = document.getElementById('share-modal-title');
                            if (modalTitle) modalTitle.textContent = 'Share this Dua';
                            setShareType('dua');
                            shareModal.classList.remove('hidden');
                        }
                      }}
                      className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all text-sm sm:text-base w-full sm:w-auto justify-center"
                      title="Share this Dua"
                    >
                      <ShareIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      <span className="font-semibold">Share</span>
                    </button>
                  </div>

                  <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4">
                    <p className="text-lg sm:text-2xl font-arabic text-right leading-loose mb-3 sm:mb-4" dir="rtl">
                      {ramadanData.resource.dua.arabic}
                    </p>
                    <p className="text-xs sm:text-sm text-emerald-100 italic mb-2">
                      {ramadanData.resource.dua.transliteration}
                    </p>
                    <p className="text-sm sm:text-base text-white">
                      {ramadanData.resource.dua.translation}
                    </p>
                  </div>

                  <p className="text-xs sm:text-sm text-emerald-200 font-semibold">
                    — {ramadanData.resource.dua.reference}
                  </p>
                </div>
              </div>
            )}

            {/* Ratio Selection Modal - Mobile Optimized */}
            {showRatioModal && (
              <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen px-3 sm:px-4">
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
                    onClick={() => setShowRatioModal(false)}
                  ></div>

                  {/* Modal Content */}
                  <div className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full p-4 sm:p-6 md:p-8 z-10 mx-2 sm:mx-0">
                    <button
                      onClick={() => setShowRatioModal(false)}
                      className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 p-1"
                      aria-label="Close modal"
                    >
                      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
                      Choose Format
                    </h3>

                    <div className="space-y-3 sm:space-y-4">
                      {/* Story Option (9:16) */}
                      <button
                        onClick={() => {
                          setSelectedRatio('story');
                          confirmRatioSelection();
                        }}
                        className={`w-full p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl border-2 transition-all ${
                          selectedRatio === 'story'
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-12 h-20 sm:w-16 sm:h-28 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                            <span className="text-white text-xs font-bold">9:16</span>
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <h4 className="text-base sm:text-lg font-bold text-gray-900">Story</h4>
                            <p className="text-xs sm:text-sm text-gray-600 hidden xs:block">Perfect for Instagram Stories, Facebook Stories</p>
                            <p className="text-xs sm:text-sm text-gray-600 xs:hidden">For Stories</p>
                            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">1080 × 1920 px</p>
                          </div>
                        </div>
                      </button>

                      {/* Post Option (4:5) */}
                      <button
                        onClick={() => {
                          setSelectedRatio('post');
                          confirmRatioSelection();
                        }}
                        className={`w-full p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl border-2 transition-all ${
                          selectedRatio === 'post'
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-14 h-16 sm:w-20 sm:h-25 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                            <span className="text-white text-xs font-bold">4:5</span>
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <h4 className="text-base sm:text-lg font-bold text-gray-900">Feed Post</h4>
                            <p className="text-xs sm:text-sm text-gray-600 hidden xs:block">Ideal for Instagram & Facebook Feed</p>
                            <p className="text-xs sm:text-sm text-gray-600 xs:hidden">For Feed Posts</p>
                            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">1080 × 1350 px</p>
                          </div>
                        </div>
                      </button>
                    </div>

                    <p className="text-center text-xs sm:text-sm text-gray-500 mt-4 sm:mt-6">
                      The image will be downloaded to your device
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Hidden Dua Image Template for Generation */}
            <div className="fixed -left-[9999px] top-0">
              <div
                ref={duaImageRef}
                className="relative bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500"
                style={{ width: '1080px', height: selectedRatio === 'story' ? '1920px' : '1350px' }}
              >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                    backgroundSize: '48px 48px'
                  }}></div>
                </div>
                
                {/* Decorative Orbs */}
                <div className="absolute top-20 right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 left-20 w-60 h-60 bg-white/10 rounded-full blur-3xl"></div>

                <div className="relative h-full flex flex-col items-center justify-center p-16 text-white">
                  {/* Header - Top Left Logo & Top Right Email */}
                  <div className="absolute top-0 left-0 right-0 p-12 flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center p-3 shadow-2xl">
                        <img src="/logo.png" alt="HikmahSphere" className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <h2 className="text-4xl font-bold">HikmahSphere</h2>
                        <p className="text-xl text-emerald-100">Islamic Digital Companion</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold">info@hikmahsphere.site</p>
                    </div>
                  </div>

                  {/* Dua Content */}
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-12">
                      <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>

                    <h1 className="text-5xl font-bold mb-8 max-w-5xl">
                      {ramadanData?.resource?.dua?.title || 'Daily Dua'}
                    </h1>

                    <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-12 mb-8 max-w-5xl">
                      <p className="text-6xl font-arabic text-right leading-loose mb-8" dir="rtl">
                        {ramadanData?.resource?.dua?.arabic || ''}
                      </p>
                      <p className="text-3xl text-emerald-100 italic mb-6">
                        {ramadanData?.resource?.dua?.transliteration || ''}
                      </p>
                      <p className="text-3xl">
                        {ramadanData?.resource?.dua?.translation || ''}
                      </p>
                    </div>

                    <p className="text-2xl text-emerald-200 font-semibold">
                      — {ramadanData?.resource?.dua?.reference || ''}
                    </p>
                  </div>

                  {/* Footer - Minimal with Centered URL */}
                  <div className="absolute bottom-0 left-0 right-0 p-12 text-center">
                    <p className="text-4xl font-bold">hikmahsphere.site</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Hidden Hadith Image Template for Generation */}
            <div className="fixed -left-[9999px] top-0">
              <div
                ref={hadithImageRef}
                className="relative bg-gradient-to-br from-amber-500 via-orange-500 to-red-500"
                style={{ width: '1080px', height: selectedRatio === 'story' ? '1920px' : '1350px' }}
              >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                    backgroundSize: '48px 48px'
                  }}></div>
                </div>
                
                {/* Decorative Orbs */}
                <div className="absolute top-20 right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 left-20 w-60 h-60 bg-white/10 rounded-full blur-3xl"></div>

                <div className="relative h-full flex flex-col items-center justify-center p-16 text-white">
                  {/* Header - Top Left Logo & Top Right Email */}
                  <div className="absolute top-0 left-0 right-0 p-12 flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center p-3 shadow-2xl">
                        <img src="/logo.png" alt="HikmahSphere" className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <h2 className="text-4xl font-bold">HikmahSphere</h2>
                        <p className="text-xl text-amber-100">Islamic Digital Companion</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold">info@hikmahsphere.site</p>
                    </div>
                  </div>

                  {/* Hadith Content */}
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-12">
                      <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.076 0-2.104.222-3.043.621.99.17 1.94.454 2.847.844zm10.703-3.317C13.767.602 11.94 0 10 0c-1.94 0-3.767.602-5.203 1.487L5.5 4.804c.908-.39 1.857-.674 2.847-.843A7.968 7.968 0 0110 4c1.076 0 2.104.222 3.043.621zM10 6a3 3 0 100 6 3 3 0 000-6zm-5 3a5 5 0 1110 0 5 5 0 01-10 0zm-3.5 0a8.5 8.5 0 1117 0 8.5 8.5 0 01-17 0z" />
                      </svg>
                    </div>

                    <h1 className="text-5xl font-bold mb-8">Hadith of Ramadan</h1>

                    <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-12 mb-8 max-w-5xl">
                      <p className="text-6xl font-arabic text-right leading-loose mb-8 text-right" dir="rtl">
                        {ramadanData?.resource?.hadith?.arabic || ''}
                      </p>
                      <p className="text-3xl mb-8">
                        {ramadanData?.resource?.hadith?.english || ''}
                      </p>
                    </div>

                    <div className="flex gap-8 text-2xl">
                      <p className="text-amber-100">
                        📚 {ramadanData?.resource?.hadith?.source || ''}
                      </p>
                      <p className="text-amber-100">
                        🏷️ {ramadanData?.resource?.hadith?.grade || ''}
                      </p>
                    </div>
                  </div>

                  {/* Footer - Minimal with Centered URL */}
                  <div className="absolute bottom-0 left-0 right-0 p-12 text-center">
                    <p className="text-4xl font-bold">hikmahsphere.site</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Share Modal */}
            <div id="share-modal" className="hidden fixed inset-0 z-50 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen px-4">
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
                  onClick={() => {
                    const modal = document.getElementById('share-modal');
                    if (modal) modal.classList.add('hidden');
                  }}
                ></div>

                {/* Modal Content - Mobile Optimized */}
                <div className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full p-4 sm:p-6 md:p-8 transform transition-all mx-2 sm:mx-0">
                  {/* Close Button */}
                  <button
                    onClick={() => {
                      const modal = document.getElementById('share-modal');
                      if (modal) modal.classList.add('hidden');
                    }}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 p-1"
                    aria-label="Close modal"
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  {/* Share Template Card */}
                  <div className={`bg-gradient-to-br rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white mb-4 sm:mb-6 relative overflow-hidden ${
                    shareType === 'hadith'
                      ? 'from-amber-500 via-orange-500 to-red-500'
                      : 'from-emerald-500 via-teal-500 to-cyan-500'
                  }`}>
                    {/* Background Decoration */}
                    <div className="absolute top-0 right-0 w-32 sm:w-48 h-32 sm:h-48 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-24 sm:w-32 h-24 sm:h-32 bg-white/10 rounded-full blur-2xl"></div>

                    <div className="relative">
                      {/* Header with Logo */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-xl sm:rounded-2xl flex items-center justify-center p-1.5 sm:p-2 shadow-lg flex-shrink-0">
                            <img src="/logo.png" alt="HikmahSphere" className="w-full h-full object-contain" />
                          </div>
                          <div>
                            <h3 className="text-lg sm:text-2xl font-bold">HikmahSphere</h3>
                            <p className={`${shareType === 'hadith' ? 'text-amber-100' : 'text-emerald-100'} text-xs sm:text-sm`}>
                              Your Islamic Digital Companion
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className={`text-xs sm:text-sm ${shareType === 'hadith' ? 'text-amber-100' : 'text-emerald-100'}`}>Contact</p>
                          <p className="text-sm sm:text-lg font-semibold">info@hikmahsphere.site</p>
                        </div>
                      </div>

                      {/* Content Section (Dua or Hadith) */}
                      {shareType === 'hadith' ? (
                        // Hadith Layout
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                            <BookOpenIcon className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                            <h4 className="text-sm sm:text-lg font-bold">Hadith of Ramadan</h4>
                          </div>
                          <p className="text-lg sm:text-3xl font-arabic text-right leading-loose mb-2 sm:mb-4" dir="rtl">
                            {ramadanData?.resource?.hadith?.arabic || ''}
                          </p>
                          <p className="text-xs sm:text-base">
                            {ramadanData?.resource?.hadith?.english || ''}
                          </p>
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mt-3 sm:mt-4">
                            <p className="text-xs sm:text-sm text-amber-200 font-semibold">
                              — {ramadanData?.resource?.hadith?.source || ''}
                            </p>
                            <span className="text-[10px] sm:text-xs bg-white/20 px-2 py-0.5 sm:py-1 rounded-full">
                              {ramadanData?.resource?.hadith?.grade || ''}
                            </span>
                          </div>
                        </div>
                      ) : (
                        // Dua Layout
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                            <SparklesIcon className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                            <h4 className="text-sm sm:text-lg font-bold">{ramadanData?.resource?.dua?.title || 'Daily Dua'}</h4>
                          </div>
                          <p className="text-lg sm:text-3xl font-arabic text-right leading-loose mb-2 sm:mb-4" dir="rtl">
                            {ramadanData?.resource?.dua?.arabic || ''}
                          </p>
                          <p className="text-xs sm:text-sm text-emerald-100 italic mb-1.5 sm:mb-2">
                            {ramadanData?.resource?.dua?.transliteration || ''}
                          </p>
                          <p className="text-xs sm:text-base">
                            {ramadanData?.resource?.dua?.translation || ''}
                          </p>
                          <p className="text-xs sm:text-sm text-emerald-200 font-semibold mt-2 sm:mt-4">
                            — {ramadanData?.resource?.dua?.reference || ''}
                          </p>
                        </div>
                      )}

                      {/* Invitation */}
                      {/* <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-4">
                        <div className="flex flex-wrap gap-3 text-sm">
                          <span className="flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-full">
                            <span className="text-lg">🕌</span> Prayer Times
                          </span>
                          <span className="flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-full">
                            <span className="text-lg">📖</span> Quran Reader
                          </span>
                          <span className="flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-full">
                            <span className="text-lg">💰</span> Zakat Calculator
                          </span>
                          <span className="flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-full">
                            <span className="text-lg">🌍</span> Global Community
                          </span>
                        </div>
                      </div> */}

                      {/* Website & Contact */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                        <a 
                          href="https://hikmahsphere.site" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 hover:bg-white/20 px-4 py-2 rounded-xl transition-all"
                        >
                          <GlobeAltIcon className="w-5 h-5" />
                          <span className="font-semibold">hikmahsphere.site</span>
                        </a>
                        <a 
                          href="mailto:info@hikmahsphere.site" 
                          className="flex items-center gap-2 hover:bg-white/20 px-4 py-2 rounded-xl transition-all"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span className="font-semibold">info@hikmahsphere.site</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Social Share Buttons - Mobile Optimized */}
                  <div className="text-center mb-4">
                    <h4 id="share-modal-title" className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">
                      Share this {shareType === 'hadith' ? 'Hadith' : 'Dua'}
                    </h4>
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-2 sm:gap-3">
                      <button
                        onClick={() => {
                          if (shareType === 'hadith') {
                            shareHadith('whatsapp');
                          } else {
                            shareDua('whatsapp');
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all transform hover:scale-105 shadow-lg text-xs sm:text-sm"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                        </svg>
                        <span className="hidden xs:inline">WhatsApp</span><span className="xs:hidden">Share</span>
                      </button>
                      <button
                        onClick={() => {
                          if (shareType === 'hadith') {
                            shareHadith('twitter');
                          } else {
                            shareDua('twitter');
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-all transform hover:scale-105 shadow-lg text-xs sm:text-sm"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span className="hidden xs:inline">Twitter</span><span className="xs:hidden">Tweet</span>
                      </button>
                      <button
                        onClick={() => {
                          if (shareType === 'hadith') {
                            shareHadith('facebook');
                          } else {
                            shareDua('facebook');
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all transform hover:scale-105 shadow-lg text-xs sm:text-sm"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        <span className="hidden xs:inline">Facebook</span><span className="xs:hidden">Share</span>
                      </button>
                      <button
                        onClick={() => {
                          if (shareType === 'hadith') {
                            shareHadith('instagram');
                          } else {
                            shareDua('instagram');
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white rounded-xl hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 transition-all transform hover:scale-105 shadow-lg text-xs sm:text-sm"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                        <span className="hidden xs:inline">Instagram</span><span className="xs:hidden">Share</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-center text-xs sm:text-sm text-gray-500">
                    Click on a platform to share this beautiful {shareType === 'hadith' ? 'Hadith' : 'Dua'} with your friends and family
                  </p>
                </div>
              </div>
            </div>

            {/* Ramadan Timetable - Card Grid - Mobile Optimized */}
            <div className="mb-6">
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl sm:rounded-3xl shadow-xl px-4 sm:px-6 md:px-8 py-4 sm:py-6 mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                      <MoonIcon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-3xl font-bold text-white">Ramadan {ramadanData.ramadan_year}</h2>
                      <p className="text-xs sm:text-sm text-emerald-100">Complete 30-Day Fasting Schedule</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right text-white">
                    <p className="text-xs sm:text-sm text-emerald-100">White Days</p>
                    <p className="text-sm sm:text-lg font-semibold">
                      {ramadanData.white_days?.days?.['13th'] ? new Date(ramadanData.white_days.days['13th']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '13th'} •
                      {ramadanData.white_days?.days?.['14th'] ? new Date(ramadanData.white_days.days['14th']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '14th'} •
                      {ramadanData.white_days?.days?.['15th'] ? new Date(ramadanData.white_days.days['15th']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '15th'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {ramadanData.fasting.map((day: any, idx: number) => {
                  // Safety checks for undefined values — hijri optional (fallback may omit it)
                  if (!day || !day.date || !day.time) {
                    return null;
                  }
                  
                  const dayDate = parseGregorianYYYYMMDDLocal(day.date) || new Date(day.date);
                  const isToday = dayDate.toDateString() === civilTodayGregorianDate.toDateString();
                  // Use hijri day number if available, else fall back to 1-based index
                  const dayNumber = day.hijri
                    ? (parseInt(day.hijri.split('-')[2] || String(idx + 1)) || idx + 1)
                    : idx + 1;
                  const dateObj = dayDate;
                  const hijriText = day.hijri_readable || day.hijri || 'Ramadan';

                  return (
                    <div
                      key={idx}
                      data-ramadan-today={isToday ? 'true' : undefined}
                      className={`bg-white rounded-xl sm:rounded-2xl shadow-md sm:shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden border-2 ${
                        isToday
                          ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50'
                          : 'border-gray-100'
                      }`}
                    >
                      {/* Day Number Badge */}
                      <div className={`px-3 sm:px-4 py-2.5 sm:py-3 ${
                        isToday
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                          : dayNumber <= 10
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                            : dayNumber <= 20
                              ? 'bg-gradient-to-r from-teal-400 to-teal-500'
                              : 'bg-gradient-to-r from-cyan-400 to-cyan-500'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-2xl sm:text-3xl font-bold text-white">Day {dayNumber}</span>
                          {isToday && (
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/20 backdrop-blur-sm rounded-md sm:rounded-lg text-xs font-semibold text-white">
                              Today
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="p-3 sm:p-4">
                        {/* Day Name */}
                        <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1.5 sm:mb-2">{day.day || 'Day'}</p>

                        {/* Gregorian Date */}
                        <p className="text-sm sm:text-base font-semibold text-gray-900 mb-1">
                          {isNaN(dateObj.getTime())
                            ? day.date
                            : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>

                        {/* Hijri Date */}
                        <p className="text-xs sm:text-sm font-arabic text-emerald-600 mb-3 sm:mb-4" dir="rtl">
                          {hijriText}
                        </p>

                        {/* Times Grid */}
                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-2.5 sm:mb-3">
                          <div className="bg-orange-50 rounded-lg sm:rounded-xl p-1.5 sm:p-2 text-center">
                            <p className="text-[10px] sm:text-xs text-orange-600 font-medium mb-0.5 sm:mb-1">Sehri Ends (Imsak)</p>
                            <p className="text-base sm:text-lg font-bold text-orange-700" title="Imsak - Time to stop eating (before Fajr)">{formatTimeForDisplay(day.time?.sahur || day.time?.fajr)}</p>
                          </div>
                          <div className="bg-emerald-50 rounded-lg sm:rounded-xl p-1.5 sm:p-2 text-center">
                            <p className="text-[10px] sm:text-xs text-emerald-600 font-medium mb-0.5 sm:mb-1">Iftar</p>
                            <p className="text-base sm:text-lg font-bold text-emerald-700">{formatTimeForDisplay(day.time?.iftar || day.time?.maghrib)}</p>
                          </div>
                        </div>

                        {/* Duration */}
                        <div className="bg-gray-50 rounded-lg sm:rounded-xl p-1.5 sm:p-2 text-center">
                          <p className="text-[10px] sm:text-xs text-gray-500 font-medium">Duration</p>
                          <p className="text-xs sm:text-sm font-bold text-gray-700">{day.time?.duration || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hadith Card - Mobile Optimized */}
            {ramadanData.resource?.hadith && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl sm:rounded-3xl shadow-lg p-4 sm:p-6 md:p-8 border-l-4 border-amber-500">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                      <BookOpenIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">Hadith of Ramadan</h3>
                  </div>

                  {/* Share Button */}
                  <button
                    onClick={() => {
                      const shareModal = document.getElementById('share-modal');
                      if (shareModal) {
                        const modalTitle = document.getElementById('share-modal-title');
                        if (modalTitle) modalTitle.textContent = 'Share this Hadith';
                        setShareType('hadith');
                        shareModal.classList.remove('hidden');
                      }
                    }}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-amber-100 text-amber-700 rounded-xl hover:bg-amber-200 transition-all text-sm sm:text-base w-full sm:w-auto justify-center"
                    title="Share this Hadith"
                  >
                    <ShareIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="font-semibold">Share</span>
                  </button>
                </div>

                <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4">
                  <p className="text-base sm:text-xl font-arabic text-right leading-loose mb-3 sm:mb-4 text-gray-800" dir="rtl">
                    {ramadanData.resource.hadith.arabic}
                  </p>
                  <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                    {ramadanData.resource.hadith.english}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                  <p className="text-sm font-semibold text-amber-700">
                    — {ramadanData.resource.hadith.source}
                  </p>
                  <span className="text-xs font-medium text-amber-600 bg-amber-100 px-3 py-1 rounded-full">
                    {ramadanData.resource.hadith.grade}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Qibla & Info Section - Mobile Optimized */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 md:col-span-1">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
                    <GlobeAltIcon className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600 mr-2" />
                    Qibla Direction
                </h2>
                <div className="flex flex-col items-center justify-center py-3 sm:py-4">
                    <p className="mt-3 text-center text-xs sm:text-sm text-gray-600">
                      Need more accurate direction? Use the live compass view.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/prayers/qibla')}
                      className="mt-3 inline-flex items-center justify-center rounded-full bg-teal-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-teal-700"
                    >
                      Click Here for Qibla Compass
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 md:col-span-2">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <MoonIcon className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 mr-2" />
                  {currentReminder?.title || 'Daily Reminder'}
                </h2>
                {currentReminder ? (
                  <div className="space-y-2.5 sm:space-y-3">
                    {/* Arabic Text */}
                    <div className="text-center py-2 sm:py-2.5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg">
                      <p className="text-lg sm:text-xl md:text-2xl font-arabic leading-relaxed text-gray-800 px-2 sm:px-4" dir="rtl">
                        {currentReminder.arabic}
                      </p>
                    </div>

                    {/* Transliteration & Translation in two columns on larger screens */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3">
                      <div className="text-center lg:text-left lg:border-r lg:border-gray-100 lg:pr-3">
                        <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide mb-1">Transliteration</p>
                        <p className="text-xs sm:text-sm italic text-gray-600 leading-relaxed">
                          "{currentReminder.transliteration}"
                        </p>
                      </div>

                      <div className="text-center lg:text-left">
                        <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide mb-1">Translation</p>
                        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                          "{currentReminder.translation}"
                        </p>
                      </div>
                    </div>

                    {/* Source */}
                    <div className="text-center border-t border-gray-100 pt-2">
                      <p className="text-xs text-gray-500 font-medium">
                        — {currentReminder.source}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-base sm:text-lg font-arabic text-gray-700 mb-2 px-2" dir="rtl">
                      "إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا"
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 italic px-2">
                      "Indeed, prayer has been decreed upon the believers a decree of specified times."
                    </p>
                    <p className="text-xs text-gray-400 mt-2">— Quran 4:103</p>
                  </div>
                )}
            </div>
        </div>
      </div>
      </div>
    </>
  );
};

export default PrayerTimes;
