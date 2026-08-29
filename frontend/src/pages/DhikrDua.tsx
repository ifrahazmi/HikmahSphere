import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  BookmarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  ShareIcon,
  SpeakerWaveIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import PageSEO from '../components/PageSEO';
import { API_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import { requestForToken, storePushToken, getPushDeviceId, getPushSupportInfo } from '../firebase';
import {
  DUA_CATEGORIES,
  DUA_LIBRARY,
  DUA_LIBRARY_META,
  QUICK_ACCESS_ITEMS,
  SITUATION_FILTERS,
  TASBIH_PRESETS,
  TIME_OF_DAY_SLOT_META,
  getTimeOfDaySlot,
  getSuggestedDuas,
  type DuaCategoryId,
  type DuaEntry,
  type SituationFilterId,
  type TimeOfDaySlot,
} from '../data/dhikrDuaLibrary';

type ReminderScheduleType = 'periodic' | 'specific';

interface ReminderSettings {
  enabled: boolean;
  morning: boolean;
  evening: boolean;
  friday: boolean;
  scheduleType: ReminderScheduleType;
  periodicIntervalMinutes: number;
  specificTime: string;
  includeDhikr: boolean;
  includeDua: boolean;
  timezone?: string;
}

interface ReminderSupportState {
  supported: boolean;
  reason: string | null;
  permission: NotificationPermission | 'unsupported';
}

interface DailyDhikrTracker {
  date: string;
  counts: Record<string, number>;
}

type TasbihMode = 'stone' | 'tap';

interface DhikrUserStatePayload {
  bookmarks?: string[];
  lastViewedDuaId?: string | null;
  tasbih?: {
    presetId: string;
    count: number;
    mode?: TasbihMode;
  };
  dailyTracker?: DailyDhikrTracker | null;
  reminders?: ReminderSettings;
  settings?: {
    darkMode: boolean;
    translationLanguage: 'english' | 'urdu';
    arabicFontScale?: number;
    transliterationFontScale?: number;
  };
}

const BOOKMARKS_STORAGE_KEY = 'hikmahsphere:dhikr-dua:bookmarks';
const LAST_VIEWED_STORAGE_KEY = 'hikmahsphere:dhikr-dua:last-viewed';
const TASBIH_STORAGE_KEY = 'hikmahsphere:dhikr-dua:tasbih';
const DAILY_DHIKR_STORAGE_KEY = 'hikmahsphere:dhikr-dua:daily-tracker';
const REMINDER_STORAGE_KEY = 'hikmahsphere:dhikr-dua:reminders';
const REMINDER_LAST_SENT_KEY = 'hikmahsphere:dhikr-dua:reminders:last-sent';
const DARK_MODE_STORAGE_KEY = 'hikmahsphere:dhikr-dua:dark-mode';
const TRANSLATION_LANGUAGE_KEY = 'hikmahsphere:dhikr-dua:translation-language';
const ARABIC_FONT_SCALE_KEY = 'hikmahsphere:dhikr-dua:arabic-font-scale';
const TRANSLIT_FONT_SCALE_KEY = 'hikmahsphere:dhikr-dua:transliteration-font-scale';
const REMINDER_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const REMINDER_INTERVAL_OPTIONS = [30, 60, 120, 180, 360];
const DEFAULT_ARABIC_FONT_SCALE = 1;
const DEFAULT_TRANSLIT_FONT_SCALE = 1;
const MIN_FONT_SCALE = 0.8;
const MAX_FONT_SCALE = 1.6;
const FONT_SCALE_STEP = 0.1;
const getDeviceTimezone = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
};

const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  morning: true,
  evening: true,
  friday: true,
  scheduleType: 'periodic',
  periodicIntervalMinutes: 180,
  specificTime: '08:00',
  includeDhikr: true,
  includeDua: true,
};

const createEmptyDailyCounts = (): Record<string, number> => {
  return TASBIH_PRESETS.reduce<Record<string, number>>((accumulator, preset) => {
    accumulator[preset.id] = 0;
    return accumulator;
  }, {});
};

const getTodayKey = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalize = (value: string): string => value.toLowerCase().trim();

const MORNING_EVENING_1_REF = 'HM-27-75';
const MORNING_EVENING_2_REF = 'HM-27-76';
const BEFORE_SLEEP_1_REF = 'HM-28-99';

const ARABIC_HEADINGS = [
  'أَعُوذُ بِاللَّهِ مِنَ الشَّيطَانِ الرَّجِيمِ',
  'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ',
  'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
  'بسم الله الرحمن الرحيم',
];

const normalizeArabicForDisplay = (arabicText: string): string => {
  return arabicText
    .replace(/[﴿﴾]/g, ' ')
    .replace(/\*+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,،؛:]+|[\s.,،؛:]+$/g, '')
    .trim();
};

const extractArabicBracketBlocks = (arabicText: string): string[] => {
  const blocks = Array.from(arabicText.matchAll(/\(([^()]+)\)/g))
    .map((match) => normalizeArabicForDisplay(match[1]))
    .filter(Boolean);

  if (blocks.length > 0) {
    return blocks;
  }

  const fallback = normalizeArabicForDisplay(arabicText);
  return fallback ? [fallback] : [];
};

const extractBeforeSleepSurahBlocks = (arabicText: string): string[] => {
  const surahBlocks = (arabicText.match(/بسم الله الرحمن الرحيم\s*﴿[^﴾]+﴾/g) || [])
    .map((block) => normalizeArabicForDisplay(block))
    .filter(Boolean);

  if (surahBlocks.length > 0) {
    return surahBlocks;
  }

  return extractArabicBracketBlocks(arabicText).slice(0, 3);
};

const renderArabicWithStopMarkers = (
  arabicText: string,
  keyPrefix: string,
  isDarkMode: boolean,
  justifyClass: string = 'justify-start'
): React.ReactNode => {
  const normalized = normalizeArabicForDisplay(arabicText);
  
  // Split by spaces to render word-by-word for IndoPak v3 compatibility
  const words = normalized.split(/\s+/).filter(Boolean);

  return (
    <div
      className={`flex flex-wrap items-baseline ${justifyClass} gap-[0.08em] sm:gap-[0.12em]`}
      dir="rtl"
    >
      {words.map((word, idx) => {
        const hasComma = word.includes('،');
        const cleanWord = word.replace(/،/g, '');
        
        return (
          <React.Fragment key={`${keyPrefix}-${idx}`}>
            {cleanWord && (
              <span
                className="inline-block indopak-v3-word-container px-[0.06em] sm:px-[0.12em] my-[0.04em]"
                style={{
                  textRendering: 'auto',
                  WebkitFontSmoothing: 'subpixel-antialiased',
                  MozOsxFontSmoothing: 'auto',
                  WebkitTextSizeAdjust: '100%',
                  fontVariantLigatures: 'common-ligatures contextual',
                  fontFeatureSettings: '"liga" 1, "clig" 1, "calt" 1, "mark" 1, "mkmk" 1',
                  letterSpacing: '0.02em',
                  wordSpacing: '0.08em'
                }}
              >
                {cleanWord}
              </span>
            )}
            {hasComma && (
              <span className="inline-flex items-center mx-1">
                <span className="font-indopak-nastaleeq-v3">،</span>
                <span
                  aria-hidden="true"
                  className={`mx-1 inline-block h-1.5 w-1.5 align-middle rounded-full ${
                    isDarkMode ? 'bg-emerald-300' : 'bg-emerald-600'
                  }`}
                />
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const splitArabicHeading = (arabicText: string): { heading: string; body: string } => {
  const clean = normalizeArabicForDisplay(arabicText);
  for (const heading of ARABIC_HEADINGS) {
    if (clean.startsWith(heading)) {
      const body = clean.slice(heading.length).trim();
      return { heading, body };
    }
  }
  return { heading: '', body: clean };
};

const normalizeFontScale = (value: unknown, fallback: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric * 10) / 10;
  if (rounded < MIN_FONT_SCALE || rounded > MAX_FONT_SCALE) return fallback;
  return rounded;
};

const adjustFontScale = (current: number, delta: number): number => {
  const next = Math.round((current + delta) * 10) / 10;
  return Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, next));
};

const DhikrDua: React.FC = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<DuaCategoryId | 'all'>('all');
  const [activeSituation, setActiveSituation] = useState<SituationFilterId | 'all'>('all');
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [expandedDuaId, setExpandedDuaId] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [lastViewedDuaId, setLastViewedDuaId] = useState<string | null>(null);
  const [focusedDuaId, setFocusedDuaId] = useState<string | null>(null);

  const [selectedPresetId, setSelectedPresetId] = useState<string>(TASBIH_PRESETS[0].id);
  const [tasbihMode, setTasbihMode] = useState<TasbihMode>('stone');
  const [tasbihCount, setTasbihCount] = useState(0);
  const [dailyTracker, setDailyTracker] = useState<DailyDhikrTracker>({
    date: getTodayKey(),
    counts: createEmptyDailyCounts(),
  });

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [translationLanguage, setTranslationLanguage] = useState<'english' | 'urdu'>('english');
  const [arabicFontScale, setArabicFontScale] = useState<number>(DEFAULT_ARABIC_FONT_SCALE);
  const [transliterationFontScale, setTransliterationFontScale] = useState<number>(
    DEFAULT_TRANSLIT_FONT_SCALE
  );
  const [playingDuaId, setPlayingDuaId] = useState<string | null>(null);
  const [beadRotation, setBeadRotation] = useState(0);
  const [activeMobileSection, setActiveMobileSection] = useState<'search' | 'tasbih' | 'profile'>('search');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [areCategoriesOpen, setAreCategoriesOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 768;
  });
  const [areSituationsOpen, setAreSituationsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 768;
  });
  const [reminders, setReminders] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [reminderSupport, setReminderSupport] = useState<ReminderSupportState>({
    supported: false,
    reason: null,
    permission: 'unsupported',
  });

  const selectedPreset = useMemo(
    () => TASBIH_PRESETS.find((preset) => preset.id === selectedPresetId) || TASBIH_PRESETS[0],
    [selectedPresetId]
  );

  // Classic trio (33/33/34): show all three progress rows together.
  // Any other dhikr: show only the selected preset's counter.
  const CORE_TASBIH_IDS = useMemo(
    () => new Set(['subhanallah', 'alhamdulillah', 'allahu-akbar']),
    []
  );
  const progressPresets = useMemo(() => {
    if (CORE_TASBIH_IDS.has(selectedPreset.id)) {
      return TASBIH_PRESETS.filter((preset) => CORE_TASBIH_IDS.has(preset.id));
    }
    return [selectedPreset];
  }, [CORE_TASBIH_IDS, selectedPreset]);

  const progressPercent = Math.min(100, Math.round((tasbihCount / selectedPreset.target) * 100));
  const completedCycles = Math.floor(tasbihCount / selectedPreset.target);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const searchSectionRef = useRef<HTMLDivElement | null>(null);
  const tasbihSectionRef = useRef<HTMLDivElement | null>(null);
  const profileSectionRef = useRef<HTMLDivElement | null>(null);
  const listSectionRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const beadMotionRef = useRef<{ startY: number; lastDirection: 1 | -1 } | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const arabicSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isHydratingCloudStateRef = useRef(false);
  const hasLoadedCloudStateRef = useRef(false);
  const localMutatedDuringHydrationRef = useRef(false);

  const normalizeBookmarkedIds = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const items: string[] = [];

    value.forEach((item) => {
      if (typeof item !== 'string') return;
      const normalized = item.trim();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      items.push(normalized);
    });

    return items;
  };

  const normalizeDailyTracker = (value: unknown): DailyDhikrTracker | null => {
    if (!value || typeof value !== 'object') return null;

    const raw = value as Record<string, unknown>;
    const date = typeof raw.date === 'string' ? raw.date : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

    const countsRaw = raw.counts;
    const baseCounts = createEmptyDailyCounts();
    if (!countsRaw || typeof countsRaw !== 'object' || Array.isArray(countsRaw)) {
      return { date, counts: baseCounts };
    }

    const counts = { ...baseCounts };
    Object.entries(countsRaw as Record<string, unknown>).forEach(([key, entry]) => {
      const numeric = Number(entry);
      if (!Number.isInteger(numeric) || numeric < 0) return;
      counts[key] = numeric;
    });

    return { date, counts };
  };

  const normalizeReminders = (value: unknown): ReminderSettings => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_REMINDER_SETTINGS;
    const raw = value as Record<string, unknown>;
    const scheduleType = raw.scheduleType === 'specific' ? 'specific' : 'periodic';
    const periodicIntervalMinutesRaw = Number(raw.periodicIntervalMinutes);
    const periodicIntervalMinutes = REMINDER_INTERVAL_OPTIONS.includes(periodicIntervalMinutesRaw)
      ? periodicIntervalMinutesRaw
      : DEFAULT_REMINDER_SETTINGS.periodicIntervalMinutes;
    const specificTimeRaw = typeof raw.specificTime === 'string' ? raw.specificTime.trim() : '';
    const specificTime = REMINDER_TIME_PATTERN.test(specificTimeRaw)
      ? specificTimeRaw
      : DEFAULT_REMINDER_SETTINGS.specificTime;

    return {
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_REMINDER_SETTINGS.enabled,
      morning: typeof raw.morning === 'boolean' ? raw.morning : DEFAULT_REMINDER_SETTINGS.morning,
      evening: typeof raw.evening === 'boolean' ? raw.evening : DEFAULT_REMINDER_SETTINGS.evening,
      friday: typeof raw.friday === 'boolean' ? raw.friday : DEFAULT_REMINDER_SETTINGS.friday,
      scheduleType,
      periodicIntervalMinutes,
      specificTime,
      includeDhikr:
        typeof raw.includeDhikr === 'boolean'
          ? raw.includeDhikr
          : DEFAULT_REMINDER_SETTINGS.includeDhikr,
      includeDua:
        typeof raw.includeDua === 'boolean' ? raw.includeDua : DEFAULT_REMINDER_SETTINGS.includeDua,
      timezone:
        typeof raw.timezone === 'string' && raw.timezone.trim()
          ? raw.timezone.trim()
          : getDeviceTimezone(),
    };
  };

  const normalizeTranslationLanguage = (value: unknown): 'english' | 'urdu' => {
    return value === 'urdu' ? 'urdu' : 'english';
  };

  const hasCustomReminderConfiguration = (settings: ReminderSettings): boolean => {
    return (
      settings.enabled !== DEFAULT_REMINDER_SETTINGS.enabled ||
      settings.scheduleType !== DEFAULT_REMINDER_SETTINGS.scheduleType ||
      settings.periodicIntervalMinutes !== DEFAULT_REMINDER_SETTINGS.periodicIntervalMinutes ||
      settings.specificTime !== DEFAULT_REMINDER_SETTINGS.specificTime ||
      settings.includeDhikr !== DEFAULT_REMINDER_SETTINGS.includeDhikr ||
      settings.includeDua !== DEFAULT_REMINDER_SETTINGS.includeDua
    );
  };

  const getReminderSupportSnapshot = (): ReminderSupportState => {
    if (typeof window === 'undefined') {
      return {
        supported: false,
        reason: 'Notifications are unavailable in this environment.',
        permission: 'unsupported',
      };
    }

    const hasNotificationApi = 'Notification' in window;
    const isLocalhost =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isSecureOrigin = window.isSecureContext || isLocalhost;

    if (!hasNotificationApi) {
      return {
        supported: false,
        reason: 'This browser/app does not support notifications.',
        permission: 'unsupported',
      };
    }

    if (!isSecureOrigin) {
      return {
        supported: false,
        reason: 'Notifications require HTTPS.',
        permission: Notification.permission,
      };
    }

    if (Notification.permission === 'denied') {
      return {
        supported: true,
        reason: 'Notifications are blocked in browser settings.',
        permission: Notification.permission,
      };
    }

    return {
      supported: true,
      reason: null,
      permission: Notification.permission,
    };
  };

  useEffect(() => {
    const refreshReminderSupport = () => {
      setReminderSupport(getReminderSupportSnapshot());
    };

    refreshReminderSupport();
    window.addEventListener('focus', refreshReminderSupport);
    document.addEventListener('visibilitychange', refreshReminderSupport);

    return () => {
      window.removeEventListener('focus', refreshReminderSupport);
      document.removeEventListener('visibilitychange', refreshReminderSupport);
    };
  }, []);

  useEffect(() => {
    try {
      const savedBookmarks = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
      if (savedBookmarks) {
        const parsed = JSON.parse(savedBookmarks);
        if (Array.isArray(parsed)) setBookmarkedIds(parsed);
      }

      const savedLastViewed = localStorage.getItem(LAST_VIEWED_STORAGE_KEY);
      if (savedLastViewed) setLastViewedDuaId(savedLastViewed);

      const savedTasbih = localStorage.getItem(TASBIH_STORAGE_KEY);
      if (savedTasbih) {
        const parsed = JSON.parse(savedTasbih);
        if (typeof parsed?.presetId === 'string') setSelectedPresetId(parsed.presetId);
        if (typeof parsed?.count === 'number' && parsed.count >= 0) setTasbihCount(parsed.count);
        if (parsed?.mode === 'stone' || parsed?.mode === 'tap') setTasbihMode(parsed.mode);
      }

      const savedDailyTracker = localStorage.getItem(DAILY_DHIKR_STORAGE_KEY);
      if (savedDailyTracker) {
        const parsed = JSON.parse(savedDailyTracker);
        if (parsed?.date === getTodayKey() && parsed?.counts) {
          setDailyTracker(parsed);
        }
      }

      const savedReminders = localStorage.getItem(REMINDER_STORAGE_KEY);
      if (savedReminders) {
        const parsed = JSON.parse(savedReminders);
        setReminders(normalizeReminders(parsed));
      }

      const savedDarkMode = localStorage.getItem(DARK_MODE_STORAGE_KEY);
      if (savedDarkMode) {
        setIsDarkMode(savedDarkMode === '1');
      }

      const savedTranslationLanguage = localStorage.getItem(TRANSLATION_LANGUAGE_KEY);
      if (savedTranslationLanguage === 'urdu' || savedTranslationLanguage === 'english') {
        setTranslationLanguage(savedTranslationLanguage);
      }

      const savedArabicFontScale = localStorage.getItem(ARABIC_FONT_SCALE_KEY);
      if (savedArabicFontScale !== null) {
        setArabicFontScale(normalizeFontScale(savedArabicFontScale, DEFAULT_ARABIC_FONT_SCALE));
      }

      const savedTranslitFontScale = localStorage.getItem(TRANSLIT_FONT_SCALE_KEY);
      if (savedTranslitFontScale !== null) {
        setTransliterationFontScale(
          normalizeFontScale(savedTranslitFontScale, DEFAULT_TRANSLIT_FONT_SCALE)
        );
      }
    } catch (error) {
      console.error('Failed to load Dhikr & Dua state:', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarkedIds));
  }, [bookmarkedIds]);

  useEffect(() => {
    if (lastViewedDuaId) {
      localStorage.setItem(LAST_VIEWED_STORAGE_KEY, lastViewedDuaId);
    }
  }, [lastViewedDuaId]);

  useEffect(() => {
    localStorage.setItem(
      TASBIH_STORAGE_KEY,
      JSON.stringify({ presetId: selectedPresetId, count: tasbihCount, mode: tasbihMode })
    );
  }, [selectedPresetId, tasbihCount, tasbihMode]);

  useEffect(() => {
    localStorage.setItem(DAILY_DHIKR_STORAGE_KEY, JSON.stringify(dailyTracker));
  }, [dailyTracker]);

  useEffect(() => {
    localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    localStorage.setItem(DARK_MODE_STORAGE_KEY, isDarkMode ? '1' : '0');
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem(TRANSLATION_LANGUAGE_KEY, translationLanguage);
  }, [translationLanguage]);

  useEffect(() => {
    localStorage.setItem(ARABIC_FONT_SCALE_KEY, String(arabicFontScale));
  }, [arabicFontScale]);

  useEffect(() => {
    localStorage.setItem(TRANSLIT_FONT_SCALE_KEY, String(transliterationFontScale));
  }, [transliterationFontScale]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      hasLoadedCloudStateRef.current = false;
      isHydratingCloudStateRef.current = false;
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const loadUserDhikrState = async () => {
      isHydratingCloudStateRef.current = true;
      localMutatedDuringHydrationRef.current = false;

      try {
        const response = await fetch(`${API_URL}/dhikr/user-state`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch dhikr user state (${response.status})`);
        }

        const result = await response.json();
        const remote = (result?.data || {}) as Record<string, unknown>;

        const remoteBookmarks = normalizeBookmarkedIds(remote.bookmarks);
        const remoteLastViewed =
          typeof remote.lastViewedDuaId === 'string' && remote.lastViewedDuaId.trim()
            ? remote.lastViewedDuaId
            : null;

        const remoteTasbihRaw =
          remote.tasbih && typeof remote.tasbih === 'object'
            ? (remote.tasbih as Record<string, unknown>)
            : null;
        const isValidPreset = TASBIH_PRESETS.some(
          (preset) => preset.id === remoteTasbihRaw?.presetId
        );
        const remoteTasbih =
          remoteTasbihRaw &&
          typeof remoteTasbihRaw.presetId === 'string' &&
          Number.isInteger(remoteTasbihRaw.count) &&
          Number(remoteTasbihRaw.count) >= 0 &&
          isValidPreset
            ? {
                presetId: remoteTasbihRaw.presetId,
                count: Number(remoteTasbihRaw.count),
              }
            : null;

        const remoteDailyTracker = normalizeDailyTracker(remote.dailyTracker);
        const remoteReminders = normalizeReminders(remote.reminders);
        const remoteSettings =
          remote.settings && typeof remote.settings === 'object'
            ? (remote.settings as Record<string, unknown>)
            : {};
        const remoteDarkMode =
          typeof remoteSettings.darkMode === 'boolean' ? remoteSettings.darkMode : false;
        const remoteTranslation = normalizeTranslationLanguage(remoteSettings.translationLanguage);
        const remoteArabicScale = normalizeFontScale(
          remoteSettings.arabicFontScale,
          DEFAULT_ARABIC_FONT_SCALE
        );
        const remoteTransliterationScale = normalizeFontScale(
          remoteSettings.transliterationFontScale,
          DEFAULT_TRANSLIT_FONT_SCALE
        );
        const hasRemoteReminderState = hasCustomReminderConfiguration(remoteReminders);
        const hasRemoteSettingsState =
          remoteDarkMode !== false ||
          remoteTranslation !== 'english' ||
          remoteArabicScale !== DEFAULT_ARABIC_FONT_SCALE ||
          remoteTransliterationScale !== DEFAULT_TRANSLIT_FONT_SCALE;

        const hasRemoteState =
          Boolean(remote.updatedAt) ||
          remoteBookmarks.length > 0 ||
          !!remoteLastViewed ||
          !!remoteTasbih ||
          !!remoteDailyTracker ||
          hasRemoteReminderState ||
          hasRemoteSettingsState;

        if (hasRemoteState) {
          setBookmarkedIds(remoteBookmarks);
          setLastViewedDuaId(remoteLastViewed);
          if (!localMutatedDuringHydrationRef.current) {
            if (remoteTasbih) {
              setSelectedPresetId(remoteTasbih.presetId);
              setTasbihCount(remoteTasbih.count);
            }
            if (remoteDailyTracker) {
              setDailyTracker(remoteDailyTracker);
            }
          }
          setReminders(remoteReminders);
          setIsDarkMode(remoteDarkMode);
          setTranslationLanguage(remoteTranslation);
          setArabicFontScale(remoteArabicScale);
          setTransliterationFontScale(remoteTransliterationScale);
        } else {
          const readJson = (key: string): unknown => {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            try {
              return JSON.parse(raw);
            } catch {
              return null;
            }
          };

          const localBookmarks = normalizeBookmarkedIds(readJson(BOOKMARKS_STORAGE_KEY));
          const localLastViewed = localStorage.getItem(LAST_VIEWED_STORAGE_KEY) || lastViewedDuaId;
          const localTasbihRaw = readJson(TASBIH_STORAGE_KEY) as Record<string, unknown> | null;
          const localDailyTracker = normalizeDailyTracker(readJson(DAILY_DHIKR_STORAGE_KEY)) || dailyTracker;
          const localReminders = normalizeReminders(readJson(REMINDER_STORAGE_KEY) || reminders);
          const localDarkModeRaw = localStorage.getItem(DARK_MODE_STORAGE_KEY);
          const hasLocalDarkMode = localDarkModeRaw !== null;
          const localDarkMode = localDarkModeRaw === '1';
          const localTranslationRaw = localStorage.getItem(TRANSLATION_LANGUAGE_KEY);
          const localTranslation =
            localTranslationRaw === null
              ? translationLanguage
              : normalizeTranslationLanguage(localTranslationRaw);
          const localArabicScaleRaw = localStorage.getItem(ARABIC_FONT_SCALE_KEY);
          const localArabicScale = normalizeFontScale(
            localArabicScaleRaw === null ? DEFAULT_ARABIC_FONT_SCALE : Number(localArabicScaleRaw),
            DEFAULT_ARABIC_FONT_SCALE
          );
          const localTranslitScaleRaw = localStorage.getItem(TRANSLIT_FONT_SCALE_KEY);
          const localTranslitScale = normalizeFontScale(
            localTranslitScaleRaw === null
              ? DEFAULT_TRANSLIT_FONT_SCALE
              : Number(localTranslitScaleRaw),
            DEFAULT_TRANSLIT_FONT_SCALE
          );

          const payload: DhikrUserStatePayload = {
            bookmarks: localBookmarks.length ? localBookmarks : bookmarkedIds,
            lastViewedDuaId: localLastViewed,
            tasbih: {
              presetId:
                typeof localTasbihRaw?.presetId === 'string' ? localTasbihRaw.presetId : selectedPresetId,
              count:
                Number.isInteger(localTasbihRaw?.count) && Number(localTasbihRaw?.count) >= 0
                  ? Number(localTasbihRaw?.count)
                  : tasbihCount,
            },
            dailyTracker: localDailyTracker,
            reminders: localReminders,
            settings: {
              darkMode: hasLocalDarkMode ? localDarkMode : isDarkMode,
              translationLanguage: localTranslation,
              arabicFontScale: localArabicScale,
              transliterationFontScale: localTranslitScale,
            },
          };

          await fetch(`${API_URL}/dhikr/user-state`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
        }
      } catch (error) {
        console.error('Failed to load Dhikr user state:', error);
      } finally {
        hasLoadedCloudStateRef.current = true;
        isHydratingCloudStateRef.current = false;
      }
    };

    loadUserDhikrState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (!hasLoadedCloudStateRef.current || isHydratingCloudStateRef.current) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const payload: DhikrUserStatePayload = {
      bookmarks: bookmarkedIds,
      lastViewedDuaId,
      tasbih: {
        presetId: selectedPresetId,
        count: tasbihCount,
      },
      dailyTracker,
      reminders: {
        ...reminders,
        timezone: getDeviceTimezone() || reminders.timezone,
      },
      settings: {
        darkMode: isDarkMode,
        translationLanguage,
        arabicFontScale,
        transliterationFontScale,
      },
    };

    const timeout = window.setTimeout(async () => {
      try {
        await fetch(`${API_URL}/dhikr/user-state`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        console.error('Failed to sync Dhikr user state:', error);
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [
    bookmarkedIds,
    lastViewedDuaId,
    selectedPresetId,
    tasbihCount,
    dailyTracker,
    reminders,
    isDarkMode,
    translationLanguage,
    arabicFontScale,
    transliterationFontScale,
    isAuthenticated,
    authLoading,
  ]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!reminders.enabled) return;
    if (!reminderSupport.supported) return;
    if (reminderSupport.permission !== 'granted') return;
    // Signed-in users receive reminders from the server through FCM (works in
    // the background too), so the page-scoped interval would cause duplicates.
    // Keep it only as a foreground fallback for signed-out visitors.
    if (authLoading || isAuthenticated) return;

    const topicLabel = (() => {
      if (reminders.includeDhikr && reminders.includeDua) return 'dhikr and dua';
      if (reminders.includeDhikr) return 'dhikr';
      if (reminders.includeDua) return 'dua';
      return '';
    })();

    if (!topicLabel) return;

    const scheduleCheck = () => {
      const now = new Date();
      const today = getTodayKey();
      const hour = now.getHours();
      const minute = now.getMinutes();

      let lastSent: Record<string, string> = {};
      try {
        const raw = localStorage.getItem(REMINDER_LAST_SENT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            lastSent = parsed as Record<string, string>;
          }
        }
      } catch {
        lastSent = {};
      }

      const saveLastSent = () => {
        localStorage.setItem(REMINDER_LAST_SENT_KEY, JSON.stringify(lastSent));
      };

      const sendNotification = (key: string, title: string, body: string, oncePerDay: boolean) => {
        if (oncePerDay && lastSent[key] === today) return;

        // On iOS PWA (and Android PWA), `new Notification()` is not allowed from
        // the page context – we must route through the service worker registration.
        const options: NotificationOptions = {
          body,
          icon: '/logo.png',
          badge: '/logo.png',
        };
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready
            .then((registration) => registration.showNotification(title, options))
            .catch(() => {
              // Fallback for environments where SW is not ready
              try { new Notification(title, options); } catch (_) {}
            });
        } else {
          try { new Notification(title, options); } catch (_) {}
        }

        lastSent[key] = oncePerDay ? today : new Date().toISOString();
        saveLastSent();
      };

      if (reminders.scheduleType === 'specific') {
        const parsedTime = reminders.specificTime.match(REMINDER_TIME_PATTERN);
        if (!parsedTime) return;

        const targetHour = Number(parsedTime[1]);
        const targetMinute = Number(parsedTime[2]);
        if (hour !== targetHour || minute !== targetMinute) return;

        sendNotification(
          `specific:${reminders.specificTime}`,
          'Dhikr & Dua Reminder',
          `It is time for your ${topicLabel}.`,
          true
        );
        return;
      }

      const intervalMs = reminders.periodicIntervalMinutes * 60 * 1000;
      const topicKey = `${Number(reminders.includeDhikr)}${Number(reminders.includeDua)}`;
      const periodicKey = `periodic:${reminders.periodicIntervalMinutes}:${topicKey}`;
      const lastSentAt = Date.parse(lastSent[periodicKey] || '');

      if (!Number.isFinite(lastSentAt)) {
        lastSent[periodicKey] = now.toISOString();
        saveLastSent();
        return;
      }

      if (now.getTime() - lastSentAt < intervalMs) return;

      sendNotification(
        periodicKey,
        'Dhikr & Dua Reminder',
        `Take a short break for ${topicLabel}.`,
        false
      );
    };

    scheduleCheck();
    const intervalId = window.setInterval(scheduleCheck, 60000);
    return () => window.clearInterval(intervalId);
  }, [reminders, reminderSupport.permission, reminderSupport.supported, authLoading, isAuthenticated]);

  useEffect(() => {
    if (dailyTracker.date !== getTodayKey()) {
      setDailyTracker({ date: getTodayKey(), counts: createEmptyDailyCounts() });
    }
  }, [dailyTracker.date]);

  const categoryCounts = useMemo(
    () =>
      DUA_CATEGORIES.reduce<Record<DuaCategoryId, number>>((accumulator, category) => {
        accumulator[category.id] = DUA_LIBRARY.filter((dua) => dua.categoryId === category.id).length;
        return accumulator;
      }, {} as Record<DuaCategoryId, number>),
    []
  );

  const hajjStepMap = useMemo(() => {
    const map = new Map<string, number>();
    DUA_LIBRARY.filter((dua) => dua.categoryId === 'hajj-umrah').forEach((dua, index) => {
      map.set(dua.id, index + 1);
    });
    return map;
  }, []);

  const filteredDuas = useMemo(() => {
    const query = normalize(searchQuery);

    return DUA_LIBRARY.filter((dua) => {
      if (activeCategory !== 'all' && dua.categoryId !== activeCategory) return false;
      if (activeSituation !== 'all' && !dua.situationTags.includes(activeSituation)) return false;
      if (bookmarksOnly && !bookmarkedIds.includes(dua.id)) return false;

      if (!query) return true;

      const haystack = [
        dua.title,
        dua.sectionTitle,
        dua.arabic,
        dua.transliteration,
        dua.translation,
        dua.translationUrdu,
        dua.virtue,
        dua.reference.source,
        dua.reference.book,
        dua.reference.hadithNumber,
        ...dua.tags,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [searchQuery, activeCategory, activeSituation, bookmarksOnly, bookmarkedIds]);

  // Time-of-day suggestions: only surfaced when the user has not applied any
  // explicit filter, so they never fight an active search or category choice.
  const [timeSlot, setTimeSlot] = useState<TimeOfDaySlot>(() => getTimeOfDaySlot());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTimeSlot((previous) => {
        const next = getTimeOfDaySlot();
        return next === previous ? previous : next;
      });
    }, 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  const suggestionsActive =
    !normalize(searchQuery) &&
    activeCategory === 'all' &&
    activeSituation === 'all' &&
    !bookmarksOnly;

  const suggestedDuas = useMemo(
    () => (suggestionsActive ? getSuggestedDuas(timeSlot, 6) : []),
    [suggestionsActive, timeSlot]
  );

  // With suggestions active, hoist the suggested duas to the top of the list
  // so the first screen matches the current time of day.
  const orderedDuas = useMemo(() => {
    if (!suggestedDuas.length) return filteredDuas;
    const suggestedIds = new Set(suggestedDuas.map((dua) => dua.id));
    return [...suggestedDuas, ...filteredDuas.filter((dua) => !suggestedIds.has(dua.id))];
  }, [filteredDuas, suggestedDuas]);

  const timeSlotMeta = TIME_OF_DAY_SLOT_META[timeSlot];

  const lastViewedDua = useMemo(
    () => DUA_LIBRARY.find((dua) => dua.id === lastViewedDuaId) || null,
    [lastViewedDuaId]
  );

  const scrollCardIntoView = (id: string) => {
    const element = arabicSectionRefs.current[id] || cardRefs.current[id];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const markAsViewed = (id: string) => {
    setLastViewedDuaId(id);
    setFocusedDuaId(id);
  };

  useEffect(() => {
    if (!expandedDuaId) return;
    const timerId = window.setTimeout(() => {
      scrollCardIntoView(expandedDuaId);
    }, 120);

    return () => window.clearTimeout(timerId);
  }, [expandedDuaId]);

  const toggleCard = (id: string) => {
    setExpandedDuaId((previous) => {
      const nextId = previous === id ? null : id;
      if (nextId) {
        markAsViewed(id);
      }
      return nextId;
    });
  };

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((previous) => {
      if (previous.includes(id)) {
        return previous.filter((item) => item !== id);
      }
      return [...previous, id];
    });
  };

  const stopAudioPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setPlayingDuaId(null);
  };

  const playAudio = (dua: DuaEntry) => {
    if (playingDuaId === dua.id) {
      stopAudioPlayback();
      return;
    }

    stopAudioPlayback();

    if (dua.audioUrl) {
      const audio = new Audio(dua.audioUrl);
      audioRef.current = audio;
      setPlayingDuaId(dua.id);

      audio.onended = () => {
        setPlayingDuaId(null);
      };
      audio.onerror = () => {
        setPlayingDuaId(null);
        toast.error('Audio failed to play.');
      };

      audio.play().catch((error) => {
        console.error('Audio playback failed:', error);
        setPlayingDuaId(null);
        toast.error('Unable to start audio playback.');
      });
      return;
    }

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(`${dua.arabic}. ${dua.translation}`);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.9;
      utteranceRef.current = utterance;
      setPlayingDuaId(dua.id);

      utterance.onend = () => setPlayingDuaId(null);
      utterance.onerror = () => {
        setPlayingDuaId(null);
        toast.error('Text-to-speech failed.');
      };

      window.speechSynthesis.speak(utterance);
      return;
    }

    toast('Audio is unavailable in this browser.', { icon: 'i' });
  };

  const shareDua = async (dua: DuaEntry) => {
    const url = `${window.location.origin}/dua/${dua.slug}`;
    const shareMessage = `${dua.title}\n\n${dua.arabic}\n${dua.transliteration}\n\n${dua.translation}\n\n${url}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${dua.title} | HikmahSphere`,
          text: shareMessage,
          url,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareMessage);
        toast.success('Dua copied for sharing.');
      }
    } catch (error) {
      console.error('Share failed:', error);
      toast.error('Unable to share this dua.');
    }
  };

  const updatePreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    setTasbihCount(0);
  };

  const incrementTasbih = () => {
    localMutatedDuringHydrationRef.current = true;
    setTasbihCount((previous) => previous + 1);
    setDailyTracker((previous) => ({
      date: getTodayKey(),
      counts: {
        ...previous.counts,
        [selectedPreset.id]: (previous.counts[selectedPreset.id] || 0) + 1,
      },
    }));

    if (navigator.vibrate) {
      navigator.vibrate(12);
    }
  };

  const decrementTasbih = () => {
    localMutatedDuringHydrationRef.current = true;
    setTasbihCount((previous) => Math.max(0, previous - 1));
    setDailyTracker((previous) => ({
      date: getTodayKey(),
      counts: {
        ...previous.counts,
        [selectedPreset.id]: Math.max(0, (previous.counts[selectedPreset.id] || 0) - 1),
      },
    }));
  };

  const resetTasbih = () => {
    localMutatedDuringHydrationRef.current = true;
    const presetId = selectedPreset.id;
    setTasbihCount(0);
    setDailyTracker((previous) => ({
      date: getTodayKey(),
      counts: {
        ...previous.counts,
        [presetId]: 0,
      },
    }));
  };

  const applyTasbihMotion = (direction: 1 | -1) => {
    if (direction > 0) {
      incrementTasbih();
    } else {
      decrementTasbih();
    }
    setBeadRotation((previous) => previous + direction * 18);
  };

  const focusDuaCard = (duaId: string, fromMobileProfile = false) => {
    const scheduleFocusScroll = (delayMs = 140) => {
      window.setTimeout(() => {
        scrollCardIntoView(duaId);
      }, delayMs);
    };

    if (fromMobileProfile && isMobileView()) {
      setActiveMobileSection('search');
      window.setTimeout(() => {
        setExpandedDuaId(duaId);
        markAsViewed(duaId);
        scheduleFocusScroll(180);
      }, 180);
      return;
    }

    setExpandedDuaId(duaId);
    markAsViewed(duaId);
    scheduleFocusScroll();
  };

  const resumeReading = () => {
    if (!lastViewedDuaId) return;
    setSearchQuery('');
    setActiveCategory('all');
    setActiveSituation('all');
    setBookmarksOnly(false);
    focusDuaCard(lastViewedDuaId, true);
  };

  const isMobileView = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  };

  // On mobile the tasbih view is a fixed, viewport-height panel: freeze the
  // page scroll behind it so the counter never drifts while tapping.
  useEffect(() => {
    if (activeMobileSection !== 'tasbih') return;

    const applyLock = () => {
      document.body.style.overflow = window.innerWidth < 768 ? 'hidden' : '';
    };

    applyLock();
    window.addEventListener('resize', applyLock);
    return () => {
      window.removeEventListener('resize', applyLock);
      document.body.style.overflow = '';
    };
  }, [activeMobileSection]);

  const scrollToLibrary = (
    behavior: ScrollBehavior = isMobileView() ? 'auto' : 'smooth',
    block: ScrollLogicalPosition = 'start'
  ) => {
    listSectionRef.current?.scrollIntoView({ behavior, block });
  };

  const clearPrimaryFilters = () => {
    setActiveCategory('all');
    setActiveSituation('all');
    setBookmarksOnly(false);
    setActiveMobileSection('search');
    scrollToLibrary();
  };

  const scrollToSection = (section: 'search' | 'tasbih' | 'profile') => {
    setActiveMobileSection(section);

    if (isMobileView()) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    if (section === 'search') {
      searchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (section === 'tasbih') {
      tasbihSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    profileSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const applyCategoryFilter = (categoryId: DuaCategoryId) => {
    setActiveCategory((previous) => (previous === categoryId ? 'all' : categoryId));
    setActiveSituation('all');
    setBookmarksOnly(false);
    setActiveMobileSection('search');
    scrollToLibrary();
  };

  const applySituationFilter = (situationId: SituationFilterId) => {
    setActiveSituation((previous) => (previous === situationId ? 'all' : situationId));
    setActiveCategory('all');
    setBookmarksOnly(false);
    setActiveMobileSection('search');
    scrollToLibrary();
  };

  const openFavoritesView = () => {
    setSearchQuery('');
    setActiveCategory('all');
    setActiveSituation('all');
    setBookmarksOnly(true);
    setActiveMobileSection('search');
    if (isMobileView()) {
      window.setTimeout(() => scrollToLibrary('smooth', 'center'), 180);
      return;
    }
    scrollToLibrary('smooth', 'center');
  };

  const handleQuickAccess = (label: (typeof QUICK_ACCESS_ITEMS)[number]) => {
    if (label === 'Morning Adhkar') {
      setActiveCategory('all');
      setActiveSituation('morning');
      setBookmarksOnly(false);
      setActiveMobileSection('search');
      scrollToLibrary();
      return;
    }

    if (label === 'Evening Adhkar') {
      setActiveCategory('all');
      setActiveSituation('evening');
      setBookmarksOnly(false);
      setActiveMobileSection('search');
      scrollToLibrary();
      return;
    }

    if (label === 'Daily Duas') {
      setActiveCategory('daily-life');
      setActiveSituation('all');
      setBookmarksOnly(false);
      setActiveMobileSection('search');
      scrollToLibrary();
      return;
    }

    if (label === 'Tasbih Counter') {
      scrollToSection('tasbih');
      return;
    }

    if (label === 'Favorites') {
      openFavoritesView();
    }
  };

  const moveFocusBySwipe = (direction: 'next' | 'previous') => {
    if (!orderedDuas.length) return;

    const activeId = focusedDuaId || lastViewedDuaId || orderedDuas[0].id;
    const currentIndex = orderedDuas.findIndex((dua) => dua.id === activeId);

    if (currentIndex < 0) {
      const first = orderedDuas[0];
      focusDuaCard(first.id);
      return;
    }

    const targetIndex = direction === 'next'
      ? Math.min(orderedDuas.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1);

    const target = orderedDuas[targetIndex];
    focusDuaCard(target.id);
  };

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.changedTouches[0].clientX;
    touchStartYRef.current = event.changedTouches[0].clientY;
  };

  const onTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;

    const deltaX = event.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = event.changedTouches[0].clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (Math.abs(deltaX) < 60) return;
    if (Math.abs(deltaY) > 80) return;
    if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;
    if (deltaX < 0) {
      moveFocusBySwipe('next');
    } else {
      moveFocusBySwipe('previous');
    }
  };

  // Server-side reminders are delivered over FCM, so a signed-in user needs a
  // registered push token. App.tsx registers one on load, but if permission was
  // granted just now (from this page) that pass will have been skipped.
  const registerPushTokenForReminders = async () => {
    if (!isAuthenticated) return;
    const authToken = localStorage.getItem('token');
    if (!authToken) return;

    try {
      const pushSupport = await getPushSupportInfo();
      const token = await requestForToken();
      if (!token) return;
      storePushToken(token);
      await fetch(`${API_URL}/notifications/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token,
          deviceId: getPushDeviceId(),
          userAgent: navigator.userAgent,
          permission: typeof Notification !== 'undefined' ? Notification.permission : 'unknown',
          capability: {
            supportsWebPush: pushSupport.supported,
            isIOS: pushSupport.isIOS,
            isStandalone: pushSupport.isStandalone,
          },
          visibilityState: document.visibilityState,
          heartbeatAt: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to register push token for dhikr reminders:', error);
    }
  };

  const requestReminderPermission = async (): Promise<boolean> => {
    const supportSnapshot = getReminderSupportSnapshot();
    setReminderSupport(supportSnapshot);

    if (!supportSnapshot.supported) {
      toast.error(supportSnapshot.reason || 'Notifications are not supported in this browser/app.');
      return false;
    }

    if (!reminders.includeDhikr && !reminders.includeDua) {
      toast.error('Select Dhikr or Dua before enabling reminders.');
      return false;
    }

    if (supportSnapshot.permission === 'denied') {
      toast.error('Notifications are blocked. Enable them from browser/app settings.');
      return false;
    }

    if (supportSnapshot.permission === 'granted') {
      setReminders((previous) => ({ ...previous, enabled: true }));
      void registerPushTokenForReminders();
      toast.success('Reminder notifications enabled.');
      return true;
    }

    const result = await Notification.requestPermission();
    const refreshedSupport = getReminderSupportSnapshot();
    setReminderSupport(refreshedSupport);

    if (result === 'granted') {
      setReminders((previous) => ({ ...previous, enabled: true }));
      void registerPushTokenForReminders();
      toast.success('Reminders enabled. Choose periodic or specific time below.');
      return true;
    }

    if (result === 'denied') {
      toast.error('Notification permission denied. You can enable it from browser/app settings.');
      return false;
    }

    toast.error('Notification permission was not granted.');
    return false;
  };

  const enableReminderNotifications = async () => {
    await requestReminderPermission();
  };

  const disableReminderNotifications = () => {
    setReminders((previous) => ({ ...previous, enabled: false }));
    toast.success('Reminder notifications disabled.');
  };

  const handleReminderTypeToggle = (key: 'includeDhikr' | 'includeDua', checked: boolean) => {
    setReminders((previous) => {
      const next = { ...previous, [key]: checked };
      if (!next.includeDhikr && !next.includeDua) {
        toast.error('At least one reminder type is required.');
        return previous;
      }
      return next;
    });
  };

  const handleReminderScheduleTypeChange = (scheduleType: ReminderScheduleType) => {
    setReminders((previous) => ({ ...previous, scheduleType }));
  };

  const handleReminderIntervalChange = (value: string) => {
    const interval = Number(value);
    if (!REMINDER_INTERVAL_OPTIONS.includes(interval)) return;
    setReminders((previous) => ({ ...previous, periodicIntervalMinutes: interval }));
  };

  const handleReminderTimeChange = (value: string) => {
    setReminders((previous) => ({ ...previous, specificTime: value }));
  };

  const pageBg = isDarkMode
    ? 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100'
    : 'bg-gradient-to-b from-emerald-50 via-white to-emerald-50/70 text-gray-900';

  const cardBg = isDarkMode
    ? 'border-slate-700 bg-slate-900/90'
    : 'border-emerald-100 bg-white';

  const mutedText = isDarkMode ? 'text-slate-300' : 'text-gray-600';
  const headingText = isDarkMode ? 'text-white' : 'text-gray-900';
  const activeCategoryLabel = activeCategory === 'all'
    ? 'All categories'
    : DUA_CATEGORIES.find((category) => category.id === activeCategory)?.title || 'All categories';
  const activeSituationLabel = activeSituation === 'all'
    ? 'All situations'
    : SITUATION_FILTERS.find((filter) => filter.id === activeSituation)?.label || 'All situations';
  const canConfigureReminderSettings =
    reminderSupport.supported && reminderSupport.permission === 'granted';
  const formatReminderTime = (time: string): string => {
    const parsed = time.match(REMINDER_TIME_PATTERN);
    if (!parsed) return time;
    const sampleDate = new Date();
    sampleDate.setHours(Number(parsed[1]), Number(parsed[2]), 0, 0);
    return sampleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const reminderStatus =
    reminders.enabled && canConfigureReminderSettings
      ? 'Enabled'
      : reminders.enabled
      ? 'Paused (Permission Needed)'
      : 'Disabled';
  const reminderScheduleLabel =
    reminders.scheduleType === 'periodic'
      ? `Periodic (${reminders.periodicIntervalMinutes} min)`
      : `Specific Time (${formatReminderTime(reminders.specificTime)})`;
  const siteUrl = 'https://hikmahsphere.site';
  const duaPageUrl = `${siteUrl}/dhikr-dua`;
  const featuredDuaSchemaItems = DUA_LIBRARY.slice(0, 12).map((dua, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: dua.title,
    url: `${siteUrl}/dua/${dua.slug}`,
  }));

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${duaPageUrl}#webpage`,
      name: 'Dhikr & Dua',
      url: duaPageUrl,
      inLanguage: ['en', 'ar', 'ur'],
      description:
        'Authentic daily adhkar and duas with Arabic text, transliteration, English and Urdu translation, and a free online tasbih counter.',
      isPartOf: {
        '@type': 'WebSite',
        '@id': `${siteUrl}#website`,
        name: 'HikmahSphere',
        url: siteUrl,
      },
      mainEntity: { '@id': `${duaPageUrl}#dua-list` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      '@id': `${duaPageUrl}#dua-list`,
      name: 'Popular Dhikr and Dua',
      numberOfItems: featuredDuaSchemaItems.length,
      itemListElement: featuredDuaSchemaItems,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Online Tasbih Counter',
      applicationCategory: 'ReligiousApplication',
      operatingSystem: 'Web',
      url: `${duaPageUrl}#tasbih-counter`,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Does HikmahSphere provide authentic dua references?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Every dua card includes source, book name, hadith number, and grading details.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can I read translations in Urdu and English?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. You can switch between English and Urdu translations from settings.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is there a free online tasbih counter?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. HikmahSphere includes a free tasbih counter with preset adhkar and daily progress tracking.',
          },
        },
      ],
    },
  ];

  return (
    <>
      <PageSEO
        title="Hisn al-Muslim: Authentic Islamic Duas & Daily Dhikr"
        description="Read authentic Islamic Duas and daily Dhikr from Hisn al-Muslim (Fortress of the Muslim). Includes Arabic text, transliteration, English translation, audio, and a digital Tasbih counter."
        path="/dhikr-dua"
        keywords={[
          'dhikr and dua',
          'dua and zikr',
          'authentic duas',
          'hisn al muslim',
          'morning evening adhkar',
          'daily duas online',
          'dua for anxiety',
          'dua for depression',
          'travel dua',
          'islamic supplications',
          'dua with arabic and translation',
          'dua in urdu',
          'dua in english',
          'online dua counter',
          'tasbih counter',
          'online tasbih counter',
          'digital tasbih',
          'islamic remembrance',
          'adhkar al muslim',
          'prophetic duas',
          'hikmahsphere dua'
        ]}
      />
      <Helmet>
        {structuredData.map((schemaObject, index) => (
          <script key={`dhikr-seo-${index}`} type="application/ld+json">
            {JSON.stringify(schemaObject)}
          </script>
        ))}
      </Helmet>

      <div className={`min-h-screen pb-24 md:pb-8 ${pageBg}`}>
        <section className={`relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 text-white ${
          activeMobileSection === 'search' ? 'block' : 'hidden md:block'
        }`}>
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.75) 1px, transparent 0)',
            backgroundSize: '30px 30px',
          }} />

          <div className="absolute -right-14 -top-14 h-52 w-52 rounded-full border-[14px] border-amber-300/30" />
          <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pb-20">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/30 bg-white/10 px-4 py-2 text-sm font-medium text-emerald-100">
                  <MoonIcon className="h-4 w-4" />
                  Digital Hisn-ul-Muslim Experience
                </div>
                <h1 className="text-4xl font-bold sm:text-5xl lg:text-6xl">Dhikr & Dua</h1>
                <p className="mt-3 max-w-2xl text-lg text-emerald-100">
                  Daily remembrance and supplications for every moment of life.
                </p>
                <p className="mt-2 text-sm text-emerald-200">
                  {DUA_LIBRARY_META.totalDuas}+ duas from {DUA_LIBRARY_META.source}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsDarkMode((previous) => !previous)}
                className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                {isDarkMode ? 'Light Mode' : 'Dark Mode'}
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {QUICK_ACCESS_ITEMS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleQuickAccess(item)}
                  className="rounded-full border border-emerald-200/30 bg-white/10 px-4 py-2 text-sm font-medium text-emerald-50 transition hover:bg-white/20"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section
          className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${
            activeMobileSection === 'tasbih' ? 'py-0 md:py-8' : 'py-8'
          }`}
        >
          {lastViewedDua && (
            <div className={`mb-6 rounded-2xl border p-4 shadow-sm ${cardBg} ${
              activeMobileSection === 'search' ? 'block' : 'hidden md:block'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${mutedText}`}>Continue Reading</p>
                  <h2 className={`text-lg font-bold ${headingText}`}>{lastViewedDua.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={resumeReading}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Open Last Viewed Dua
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-12">
            <div className={`space-y-6 lg:col-span-8 ${activeMobileSection === 'search' ? 'block' : 'hidden lg:block'}`}>
              <div ref={searchSectionRef} className={`scroll-mt-24 rounded-2xl border p-4 shadow-sm sm:p-6 ${cardBg}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className={`text-lg font-bold ${headingText}`}>Search & Filter</h2>
                    <p className={`text-sm ${mutedText}`}>Find duas by text, source, translation, or daily need.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen((previous) => !previous)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      isDarkMode
                        ? 'border-slate-600 bg-slate-800 text-slate-100 hover:border-emerald-400'
                        : 'border-emerald-200 bg-white text-emerald-700 hover:border-emerald-400'
                    }`}
                  >
                    <AdjustmentsHorizontalIcon className="h-4 w-4" />
                    Settings
                    {isSettingsOpen ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                  </button>
                </div>

                <label className="relative mt-4 block">
                  <span className="sr-only">Search dua</span>
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-500" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by dua text, translation, source, book, or topic"
                    className={`w-full rounded-xl border py-3 pl-12 pr-4 text-sm outline-none transition ${
                      isDarkMode
                        ? 'border-slate-600 bg-slate-800 text-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                        : 'border-emerald-200 bg-emerald-50/50 text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'
                    }`}
                  />
                </label>

                {isSettingsOpen && (
                  <div className={`mt-4 space-y-4 rounded-2xl border p-4 ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-emerald-100 bg-emerald-50/50'}`}>
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wide ${mutedText}`}>Translation</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setTranslationLanguage('english')}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            translationLanguage === 'english'
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : isDarkMode
                              ? 'border-slate-500 bg-slate-800 text-slate-100'
                              : 'border-emerald-200 bg-white text-emerald-700'
                          }`}
                        >
                          English
                        </button>
                        <button
                          type="button"
                          onClick={() => setTranslationLanguage('urdu')}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            translationLanguage === 'urdu'
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : isDarkMode
                              ? 'border-slate-500 bg-slate-800 text-slate-100'
                              : 'border-emerald-200 bg-white text-emerald-700'
                          }`}
                        >
                          Urdu
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wide ${mutedText}`}>Text Size</p>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        <div className={`rounded-xl border p-3 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-emerald-100 bg-white'}`}>
                          <p className={`text-[11px] font-semibold uppercase tracking-wide ${mutedText}`}>Arabic</p>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setArabicFontScale((prev) => adjustFontScale(prev, -FONT_SCALE_STEP))}
                              className={`rounded-lg px-2.5 py-1 text-sm font-bold ${isDarkMode ? 'bg-slate-700 text-slate-100' : 'bg-emerald-100 text-emerald-800'}`}
                              aria-label="Decrease Arabic font size"
                            >
                              A-
                            </button>
                            <span className={`min-w-[3.2rem] text-center text-xs font-semibold ${mutedText}`}>
                              {arabicFontScale.toFixed(1)}x
                            </span>
                            <button
                              type="button"
                              onClick={() => setArabicFontScale((prev) => adjustFontScale(prev, FONT_SCALE_STEP))}
                              className={`rounded-lg px-2.5 py-1 text-sm font-bold ${isDarkMode ? 'bg-slate-700 text-slate-100' : 'bg-emerald-100 text-emerald-800'}`}
                              aria-label="Increase Arabic font size"
                            >
                              A+
                            </button>
                          </div>
                        </div>
                        <div className={`rounded-xl border p-3 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-emerald-100 bg-white'}`}>
                          <p className={`text-[11px] font-semibold uppercase tracking-wide ${mutedText}`}>Transliteration</p>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setTransliterationFontScale((prev) => adjustFontScale(prev, -FONT_SCALE_STEP))}
                              className={`rounded-lg px-2.5 py-1 text-sm font-bold ${isDarkMode ? 'bg-slate-700 text-slate-100' : 'bg-emerald-100 text-emerald-800'}`}
                              aria-label="Decrease transliteration font size"
                            >
                              A-
                            </button>
                            <span className={`min-w-[3.2rem] text-center text-xs font-semibold ${mutedText}`}>
                              {transliterationFontScale.toFixed(1)}x
                            </span>
                            <button
                              type="button"
                              onClick={() => setTransliterationFontScale((prev) => adjustFontScale(prev, FONT_SCALE_STEP))}
                              className={`rounded-lg px-2.5 py-1 text-sm font-bold ${isDarkMode ? 'bg-slate-700 text-slate-100' : 'bg-emerald-100 text-emerald-800'}`}
                              aria-label="Increase transliteration font size"
                            >
                              A+
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={`rounded-xl border p-4 sm:p-5 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-amber-100 bg-gradient-to-br from-amber-50/50 to-orange-50/50'}`}>
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🔔</span>
                          <div>
                            <h3 className={`font-bold ${headingText}`}>Dhikr &amp; Dua Reminder</h3>
                            <p className={`text-xs ${mutedText}`}>{reminderScheduleLabel}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => reminders.enabled ? disableReminderNotifications() : enableReminderNotifications()}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                            reminders.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              reminders.enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {(!reminderSupport.supported || reminderSupport.reason || !canConfigureReminderSettings) && (
                        <div className={`mb-4 rounded-lg border p-3 text-[11px] ${isDarkMode ? 'border-slate-600 bg-slate-900/50' : 'border-amber-200 bg-amber-50'}`}>
                          <p className="font-semibold text-amber-600">Note on Notifications</p>
                          {!reminderSupport.supported && <p className="mt-1 text-slate-500">Your browser does not support notifications.</p>}
                          {reminderSupport.reason && <p className="mt-1 text-slate-500">{reminderSupport.reason}</p>}
                          {!canConfigureReminderSettings && reminderSupport.supported && (
                            <p className="mt-1 text-slate-500">Please enable the toggle above and grant permission to configure reminders.</p>
                          )}
                        </div>
                      )}

                      <div className={`space-y-4 transition-opacity ${!canConfigureReminderSettings ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div>
                          <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>Include in Reminders</p>
                          <div className="flex gap-3">
                            <label className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition ${
                              reminders.includeDhikr ? (isDarkMode ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50') : (isDarkMode ? 'border-slate-600' : 'border-gray-200')
                            }`}>
                              <input
                                type="checkbox"
                                checked={reminders.includeDhikr}
                                onChange={(event) => handleReminderTypeToggle('includeDhikr', event.target.checked)}
                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-sm font-medium">Dhikr</span>
                            </label>
                            <label className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition ${
                              reminders.includeDua ? (isDarkMode ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50') : (isDarkMode ? 'border-slate-600' : 'border-gray-200')
                            }`}>
                              <input
                                type="checkbox"
                                checked={reminders.includeDua}
                                onChange={(event) => handleReminderTypeToggle('includeDua', event.target.checked)}
                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-sm font-medium">Dua</span>
                            </label>
                          </div>
                        </div>

                        <div>
                          <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>Schedule Type</p>
                          <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
                            <button
                              type="button"
                              onClick={() => handleReminderScheduleTypeChange('periodic')}
                              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                                reminders.scheduleType === 'periodic'
                                  ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-400'
                                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                              }`}
                            >
                              Periodic
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReminderScheduleTypeChange('specific')}
                              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                                reminders.scheduleType === 'specific'
                                  ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-400'
                                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                              }`}
                            >
                              Specific Time
                            </button>
                          </div>
                        </div>

                        <div className={`rounded-lg border p-3 ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-gray-100 bg-white'}`}>
                          {reminders.scheduleType === 'periodic' ? (
                            <label className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium">Frequency</span>
                              <select
                                value={reminders.periodicIntervalMinutes}
                                onChange={(event) => handleReminderIntervalChange(event.target.value)}
                                className={`rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-emerald-400 ${
                                  isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-gray-200 bg-white'
                                }`}
                              >
                                {REMINDER_INTERVAL_OPTIONS.map((minutes) => (
                                  <option key={minutes} value={minutes}>
                                    Every {minutes} min
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <label className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium">Time of day</span>
                              <input
                                type="time"
                                value={reminders.specificTime}
                                onChange={(event) => handleReminderTimeChange(event.target.value)}
                                className={`rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-emerald-400 ${
                                  isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-gray-200 bg-white'
                                }`}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={clearPrimaryFilters}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      activeCategory === 'all' && activeSituation === 'all' && !bookmarksOnly
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : isDarkMode
                        ? 'border-slate-500 bg-slate-800 text-slate-100 hover:border-emerald-400'
                        : 'border-emerald-200 bg-white text-emerald-700 hover:border-emerald-400'
                    }`}
                  >
                    All Duas ({DUA_LIBRARY.length})
                  </button>

                  <button
                    type="button"
                    onClick={openFavoritesView}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                      bookmarksOnly
                        ? 'border-amber-500 bg-amber-500 text-white'
                        : isDarkMode
                        ? 'border-amber-300/50 bg-slate-800 text-amber-300 hover:border-amber-300'
                        : 'border-amber-200 bg-white text-amber-700 hover:border-amber-400'
                    }`}
                  >
                    <BookmarkIcon className="h-4 w-4" />
                    Favorites ({bookmarkedIds.length})
                  </button>
                </div>
              </div>

              <div className={`rounded-2xl border p-4 shadow-sm sm:p-6 ${cardBg}`}>
                <button
                  type="button"
                  onClick={() => setAreCategoriesOpen((previous) => !previous)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <h3 className={`text-base font-semibold ${headingText}`}>Categories</h3>
                    <p className={`text-sm ${mutedText}`}>{activeCategoryLabel}</p>
                  </div>
                  {areCategoriesOpen ? <ChevronUpIcon className="h-5 w-5 text-emerald-600" /> : <ChevronDownIcon className="h-5 w-5 text-emerald-600" />}
                </button>

                {areCategoriesOpen && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {DUA_CATEGORIES.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => applyCategoryFilter(category.id)}
                        className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                          activeCategory === category.id
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                            : isDarkMode
                            ? 'border-slate-700 bg-slate-900 text-slate-100'
                            : 'border-emerald-100 bg-white text-gray-900'
                        }`}
                      >
                        <p className="text-lg font-semibold">{category.emoji} {category.title}</p>
                        <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>{category.description}</p>
                        <p className="mt-2 text-xs font-semibold text-emerald-700">{categoryCounts[category.id]} duas</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className={`rounded-2xl border p-4 shadow-sm sm:p-6 ${cardBg}`}>
                <button
                  type="button"
                  onClick={() => setAreSituationsOpen((previous) => !previous)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <h3 className={`text-base font-semibold ${headingText}`}>Dua Search by Situation</h3>
                    <p className={`text-sm ${mutedText}`}>{activeSituationLabel}</p>
                  </div>
                  {areSituationsOpen ? <ChevronUpIcon className="h-5 w-5 text-emerald-600" /> : <ChevronDownIcon className="h-5 w-5 text-emerald-600" />}
                </button>

                {areSituationsOpen && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSituation('all');
                        setActiveCategory('all');
                        setBookmarksOnly(false);
                        setActiveMobileSection('search');
                        scrollToLibrary();
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        activeSituation === 'all'
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : isDarkMode
                          ? 'border-slate-600 bg-slate-800 text-slate-100'
                          : 'border-emerald-200 bg-white text-emerald-700'
                      }`}
                    >
                      All Situations
                    </button>

                    {SITUATION_FILTERS.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => applySituationFilter(filter.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          activeSituation === filter.id
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : isDarkMode
                            ? 'border-slate-600 bg-slate-800 text-slate-100'
                            : 'border-emerald-200 bg-white text-emerald-700'
                        }`}
                      >
                        {filter.emoji} {filter.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div
                ref={listSectionRef}
                className={`rounded-2xl border p-4 shadow-sm sm:p-6 ${cardBg}`}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className={`text-xl font-bold ${headingText}`}>
                      {bookmarksOnly ? 'Favorite Dua Library' : 'Supplications Library'}
                    </h2>
                    <p className={`text-sm ${mutedText}`}>{filteredDuas.length} duas found</p>
                  </div>
                  <p className={`text-xs font-semibold ${mutedText}`}>
                    Swipe left/right on mobile to move next/previous dua
                  </p>
                </div>

                {suggestedDuas.length > 0 && (
                  <div
                    className={`mb-4 overflow-hidden rounded-2xl border shadow-sm ${
                      isDarkMode
                        ? 'border-emerald-800/70 bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-slate-900'
                        : 'border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-teal-50'
                    }`}
                  >
                    <div className="flex items-start gap-3 p-4 sm:p-5">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl shadow-sm ${
                          isDarkMode ? 'bg-emerald-600/20 text-emerald-200' : 'bg-emerald-100 text-emerald-700'
                        }`}
                        aria-hidden="true"
                      >
                        {timeSlotMeta.emoji}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className={`text-sm font-bold ${isDarkMode ? 'text-emerald-200' : 'text-emerald-800'}`}>
                            Suggested for now · {timeSlotMeta.title}
                          </p>
                          <span
                            className={`inline-flex w-fit items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                              isDarkMode
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                                : 'border-emerald-300 bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            Recommended
                          </span>
                        </div>

                        <p className={`mt-1 text-xs leading-5 ${mutedText}`}>
                          {timeSlotMeta.description} The top {Math.min(suggestedDuas.length, 3)} duas are chosen to fit this moment of the day.
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {suggestedDuas.slice(0, 3).map((dua) => (
                            <span
                              key={`suggested-pill-${dua.id}`}
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${
                                isDarkMode
                                  ? 'border-emerald-700/50 bg-slate-900/70 text-emerald-100'
                                  : 'border-emerald-200 bg-white text-emerald-700'
                              }`}
                            >
                              {dua.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {orderedDuas.length === 0 ? (
                  <div className={`rounded-xl border border-dashed p-8 text-center ${isDarkMode ? 'border-slate-600 bg-slate-900' : 'border-emerald-200 bg-emerald-50/40'}`}>
                    <p className={`text-base font-semibold ${headingText}`}>No duas matched your filters.</p>
                    <p className={`mt-1 text-sm ${mutedText}`}>Try another keyword or clear situation/category filters.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orderedDuas.map((dua) => {
                      const isExpanded = expandedDuaId === dua.id;
                      const isBookmarked = bookmarkedIds.includes(dua.id);
                      const isPlaying = playingDuaId === dua.id;
                      const isMorningEveningOne = dua.reference.hadithNumber === MORNING_EVENING_1_REF;
                      const isMorningEveningTwo = dua.reference.hadithNumber === MORNING_EVENING_2_REF;
                      const isBeforeSleepOne = dua.reference.hadithNumber === BEFORE_SLEEP_1_REF;
                      const requiresRawArabic = isMorningEveningTwo || isBeforeSleepOne;
                      const arabicSource = requiresRawArabic ? (dua.rawArabic || dua.arabic) : dua.arabic;
                      const arabicBlocks = isMorningEveningTwo
                        ? extractArabicBracketBlocks(arabicSource)
                        : isBeforeSleepOne
                        ? extractBeforeSleepSurahBlocks(arabicSource)
                        : [];
                      const shouldRenderArabicBlocks = (isMorningEveningTwo || isBeforeSleepOne) && arabicBlocks.length > 0;
                      const normalizedArabic = normalizeArabicForDisplay(arabicSource);
                      const { heading: arabicHeading, body: arabicBody } = splitArabicHeading(normalizedArabic);
                      const selectedTranslation = translationLanguage === 'urdu' ? dua.translationUrdu : dua.translation;
                      const hajjStep = hajjStepMap.get(dua.id);

                      return (
                        <article
                          key={dua.id}
                          ref={(node) => {
                            cardRefs.current[dua.id] = node;
                          }}
                          className={`overflow-hidden rounded-3xl border shadow-sm transition hover:shadow-md ${
                            isDarkMode
                              ? 'border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800'
                              : 'border-emerald-100 bg-gradient-to-br from-white to-emerald-50/40'
                          }`}
                        >
                          <div className="p-4 sm:p-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                    {dua.sectionTitle}
                                  </p>
                                  {hajjStep && (
                                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                                      Step {hajjStep}
                                    </span>
                                  )}
                                </div>
                                <h3 className={`mt-1 text-base font-bold sm:text-lg ${headingText}`}>
                                  <Link
                                    to={`/dua/${dua.slug}`}
                                    className="hover:text-emerald-600"
                                    onClick={() => markAsViewed(dua.id)}
                                  >
                                    {dua.title}
                                  </Link>
                                </h3>
                                <p className={`mt-1 text-sm ${mutedText}`}>{dua.shortDescription}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {dua.reference.source}
                                  </span>
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    Hadith {dua.reference.hadithNumber}
                                  </span>
                                </div>
                              </div>

                              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                                <button
                                  type="button"
                                  onClick={() => toggleBookmark(dua.id)}
                                  className={`rounded-full p-2.5 transition ${
                                    isBookmarked
                                      ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                                      : isDarkMode
                                      ? 'bg-slate-700 text-slate-100 hover:bg-slate-600'
                                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                  }`}
                                  aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark dua'}
                                >
                                  {isBookmarked ? <BookmarkSolidIcon className="h-5 w-5" /> : <BookmarkIcon className="h-5 w-5" />}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => playAudio(dua)}
                                  className="rounded-full bg-emerald-100 p-2.5 text-emerald-700 transition hover:bg-emerald-200"
                                  aria-label="Play dua audio"
                                >
                                  {isPlaying ? <StopIcon className="h-5 w-5" /> : <SpeakerWaveIcon className="h-5 w-5" />}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => shareDua(dua)}
                                  className="rounded-full bg-emerald-100 p-2.5 text-emerald-700 transition hover:bg-emerald-200"
                                  aria-label="Share dua"
                                >
                                  <ShareIcon className="h-5 w-5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => toggleCard(dua.id)}
                                  className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-400 sm:w-auto"
                                  aria-expanded={isExpanded}
                                >
                                  {isExpanded ? 'Collapse' : 'Expand'}
                                  {isExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className={`border-t px-4 pb-5 pt-4 sm:px-5 ${isDarkMode ? 'border-slate-700 bg-slate-900/70' : 'border-emerald-100 bg-white/90'}`}>
                              <div className="space-y-4">
                                <div>
                                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Arabic</p>
                                  <div
                                    ref={(node) => {
                                      arabicSectionRefs.current[dua.id] = node;
                                    }}
                                    className={`rounded-xl p-4 text-right leading-relaxed ${
                                    isDarkMode ? 'bg-slate-800 text-emerald-100' : 'bg-emerald-50 text-emerald-950'
                                  }`}>
                                    {shouldRenderArabicBlocks ? (
                                      <div className="space-y-3">
                                        {arabicBlocks.map((block, index) => {
                                          const { heading: blockHeading, body: blockBody } = splitArabicHeading(block);
                                          return (
                                            <div
                                              key={`${dua.id}-block-${index}`}
                                              className={`rounded-lg border p-3 ${
                                                isDarkMode
                                                  ? 'border-slate-700 bg-slate-900/70'
                                                  : 'border-emerald-200 bg-white/80'
                                              }`}
                                            >
                                              <p className="mb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                                                Dua {index + 1}
                                              </p>
                                              {blockHeading && (
                                                <p
                                                  className="mb-2 text-center font-semibold font-indopak-nastaleeq-v3"
                                                  dir="rtl"
                                                  style={{
                                                    textRendering: 'auto',
                                                    fontVariantLigatures: 'common-ligatures contextual',
                                                    fontFeatureSettings: '"liga" 1, "clig" 1, "calt" 1, "mark" 1, "mkmk" 1',
                                                    fontSize: `${1.25 * arabicFontScale}rem`,
                                                  }}
                                                >
                                                  {blockHeading}
                                                </p>
                                              )}
                                              <p
                                                className="font-indopak-nastaleeq-v3"
                                                dir="rtl"
                                                style={{
                                                  textRendering: 'auto',
                                                  fontVariantLigatures: 'common-ligatures contextual',
                                                  fontFeatureSettings: '"liga" 1, "clig" 1, "calt" 1, "mark" 1, "mkmk" 1',
                                                  fontSize: `${1.7 * arabicFontScale}rem`,
                                                  lineHeight: 2.5,
                                                }}
                                              >
                                                {renderArabicWithStopMarkers(blockBody || block, `${dua.id}-block-text-${index}`, isDarkMode)}
                                              </p>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <>
                                        {arabicHeading && (
                                          <p
                                            className="mb-2 text-center font-semibold font-indopak-nastaleeq-v3"
                                            dir="rtl"
                                            style={{
                                              textRendering: 'auto',
                                              fontVariantLigatures: 'common-ligatures contextual',
                                              fontFeatureSettings: '"liga" 1, "clig" 1, "calt" 1, "mark" 1, "mkmk" 1',
                                              fontSize: `${(isMorningEveningOne ? 1.45 : 1.25) * arabicFontScale}rem`,
                                            }}
                                          >
                                            {arabicHeading}
                                          </p>
                                        )}
                                        <p
                                          className="font-indopak-nastaleeq-v3"
                                          dir="rtl"
                                          style={{
                                            textRendering: 'auto',
                                            fontVariantLigatures: 'common-ligatures contextual',
                                            fontFeatureSettings: '"liga" 1, "clig" 1, "calt" 1, "mark" 1, "mkmk" 1',
                                            fontSize: `${1.9 * arabicFontScale}rem`,
                                            lineHeight: 2.45,
                                          }}
                                        >
                                          {renderArabicWithStopMarkers(arabicBody || normalizedArabic || dua.arabic, `${dua.id}-body`, isDarkMode)}
                                        </p>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-700">Transliteration</p>
                                  <p
                                    className={`rounded-xl p-4 leading-relaxed ${isDarkMode ? 'bg-slate-800 text-slate-100' : 'bg-teal-50 text-teal-900'}`}
                                    style={{ fontSize: `${0.95 * transliterationFontScale}rem` }}
                                  >
                                    {dua.transliteration}
                                  </p>
                                </div>

                                <div>
                                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                    Translation ({translationLanguage === 'urdu' ? 'Urdu' : 'English'})
                                  </p>
                                  <p
                                    className={`rounded-xl p-4 text-sm leading-relaxed ${
                                      isDarkMode ? 'bg-slate-800 text-slate-100' : 'bg-emerald-50/80 text-gray-800'
                                    } ${translationLanguage === 'urdu' ? 'font-jameel-noori text-right text-[1.7rem] leading-[3.05rem] sm:text-[2.4rem] sm:leading-[4.1rem]' : ''}`}
                                    dir={translationLanguage === 'urdu' ? 'rtl' : 'ltr'}
                                    style={translationLanguage === 'urdu' ? { unicodeBidi: 'plaintext' } : undefined}
                                  >
                                    {selectedTranslation}
                                  </p>
                                </div>

                                <div>
                                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Reference</p>
                                  <div className={`rounded-xl p-4 text-sm ${isDarkMode ? 'bg-slate-800 text-slate-100' : 'bg-amber-50 text-amber-900'}`}>
                                    <p><strong>Source:</strong> {dua.reference.source}</p>
                                    <p><strong>Book:</strong> {dua.reference.book}</p>
                                    <p><strong>Hadith Number:</strong> {dua.reference.hadithNumber}</p>
                                    <p><strong>Grade:</strong> {dua.reference.grade}</p>
                                    {dua.reference.notes && <p><strong>Notes:</strong> {dua.reference.notes}</p>}
                                  </div>
                                </div>

                                <div>
                                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">Virtue</p>
                                  <p className={`rounded-xl p-4 text-sm leading-relaxed ${isDarkMode ? 'bg-slate-800 text-slate-100' : 'bg-indigo-50 text-indigo-900'}`}>
                                    {dua.virtue}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <aside className={`space-y-6 lg:col-span-4 ${activeMobileSection === 'tasbih' ? 'block' : 'hidden lg:block'}`}>
              <div
                id="tasbih-counter"
                ref={tasbihSectionRef}
                className={`scroll-mt-24 rounded-2xl border p-4 shadow-sm sm:p-5 lg:sticky lg:top-24 max-md:fixed max-md:inset-x-0 max-md:top-16 max-md:bottom-[4.25rem] max-md:z-30 max-md:flex max-md:flex-col max-md:overflow-hidden max-md:rounded-none max-md:border-0 max-md:px-4 max-md:py-3 ${cardBg}`}
              >
                <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col">
                  <div className="flex shrink-0 flex-col gap-3">
                    <div className="rounded-full border border-emerald-200/70 bg-emerald-50/70 p-1 shadow-inner shadow-emerald-900/5 dark:border-slate-700 dark:bg-slate-900/80">
                      <div className="grid grid-cols-2 gap-1">
                        {(['stone', 'tap'] as const).map((mode) => {
                          const isActive = tasbihMode === mode;
                          const label = mode === 'stone' ? 'Stone / Scroll' : 'Tap';

                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setTasbihMode(mode)}
                              aria-label={label}
                              className={`rounded-full px-3 py-2 text-xs font-semibold tracking-[0.12em] uppercase transition-all duration-200 ${
                                isActive
                                  ? isDarkMode
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-900/30'
                                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200'
                                  : isDarkMode
                                    ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                                    : 'text-emerald-700 hover:bg-white hover:text-emerald-900'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="relative min-w-0">
                      <select
                        value={selectedPreset.id}
                        onChange={(event) => updatePreset(event.target.value)}
                        aria-label="Select dhikr"
                        className={`w-full appearance-none rounded-full border py-2 pl-4 pr-9 text-sm font-semibold outline-none transition focus:ring-2 focus:ring-emerald-400/40 ${
                          isDarkMode
                            ? 'border-slate-600/80 bg-slate-800/80 text-slate-100'
                            : 'border-emerald-100 bg-white text-emerald-900 shadow-sm'
                        }`}
                      >
                        {TASBIH_PRESETS.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                        <svg className={`h-4 w-4 ${isDarkMode ? 'text-slate-400' : 'text-emerald-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  </div>

                  {/* Arabic / current dhikr — compact, never overflows */}
                  <div className="mt-3 shrink-0 text-center max-md:mt-2">
                    <p className={`text-[11px] font-semibold tracking-wide ${mutedText}`}>{selectedPreset.label}</p>
                    <div
                      className={`mt-1 flex flex-wrap items-baseline justify-center gap-x-[0.1em] font-indopak-nastaleeq-v3 ${
                        isDarkMode ? 'text-emerald-100' : 'text-emerald-900'
                      }`}
                      dir="rtl"
                      lang="ar"
                      style={{
                        fontSize: `min(${(selectedPreset.compact ? 1.15 : 1.7) * arabicFontScale}rem, 6.8vw)`,
                        lineHeight: 1.85,
                      }}
                    >
                      {selectedPreset.arabic.split(/\s+/).filter(Boolean).map((word, idx) => (
                        <span
                          key={idx}
                          className="inline-block indopak-v3-word-container px-[0.05em]"
                          style={{
                            textRendering: 'auto',
                            WebkitFontSmoothing: 'subpixel-antialiased',
                            fontVariantLigatures: 'common-ligatures contextual',
                            fontFeatureSettings: '"liga" 1, "clig" 1, "calt" 1, "mark" 1, "mkmk" 1',
                            letterSpacing: 0,
                            wordSpacing: '0.06em',
                          }}
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                    {selectedPreset.transliteration && (
                      <p
                        className={`mt-1 line-clamp-2 px-1 text-center font-medium italic leading-snug ${mutedText}`}
                        style={{ fontSize: `${0.68 * transliterationFontScale}rem` }}
                      >
                        {selectedPreset.transliteration}
                      </p>
                    )}
                  </div>

                  {/* Soft tap circle — fills remaining space, never clipped */}
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-2 max-md:py-1">
                    <button
                      type="button"
                      onPointerDown={(event) => {
                        if (event.pointerType === 'mouse' && event.button !== 0) return;
                        const target = event.currentTarget;
                        target.setPointerCapture?.(event.pointerId);

                        if (tasbihMode === 'tap') {
                          incrementTasbih();
                          return;
                        }

                        beadMotionRef.current = { startY: event.clientY, lastDirection: 1 };
                      }}
                      onPointerMove={(event) => {
                        if (tasbihMode !== 'stone' || !beadMotionRef.current) return;
                        const deltaY = event.clientY - beadMotionRef.current.startY;
                        if (Math.abs(deltaY) < 18) return;
                        const direction = deltaY > 0 ? 1 : -1;
                        if (direction !== beadMotionRef.current.lastDirection) {
                          applyTasbihMotion(direction);
                          beadMotionRef.current.lastDirection = direction;
                          beadMotionRef.current.startY = event.clientY;
                        }
                      }}
                      onPointerUp={() => {
                        beadMotionRef.current = null;
                      }}
                      onPointerLeave={() => {
                        beadMotionRef.current = null;
                      }}
                      onWheel={(event) => {
                        if (tasbihMode !== 'stone') return;
                        event.preventDefault();
                        const direction = event.deltaY > 0 ? 1 : -1;
                        applyTasbihMotion(direction);
                      }}
                      onClick={(event) => {
                        if (tasbihMode === 'stone') {
                          event.preventDefault();
                          return;
                        }
                        incrementTasbih();
                      }}
                      onContextMenu={(event) => event.preventDefault()}
                      aria-label={tasbihMode === 'stone' ? 'Stone / Scroll counter' : 'Tap counter'}
                      className="group relative flex aspect-square w-[min(52vw,13.5rem)] shrink-0 select-none touch-manipulation items-center justify-center rounded-full transition-transform duration-150 active:scale-[0.96] sm:w-44"
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute inset-[-10%] rounded-full blur-xl transition-opacity ${
                          isDarkMode ? 'bg-emerald-400/20' : 'bg-emerald-300/40'
                        }`}
                      />
                      <svg
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full -rotate-90"
                        viewBox="0 0 100 100"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="46"
                          fill="none"
                          strokeWidth="3.5"
                          className={isDarkMode ? 'stroke-slate-700' : 'stroke-emerald-100'}
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="46"
                          fill="none"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 46}`}
                          strokeDashoffset={`${2 * Math.PI * 46 * (1 - progressPercent / 100)}`}
                          className="stroke-emerald-400 transition-[stroke-dashoffset] duration-300 ease-out"
                        />
                      </svg>
                      <span
                        className={`absolute inset-[8%] rounded-full opacity-90 ${
                          isDarkMode
                            ? 'bg-[radial-gradient(circle_at_30%_30%,rgba(110,231,183,0.65),rgba(15,118,110,0.75)_30%,rgba(2,6,23,0.9)_68%)]'
                            : 'bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.9),rgba(167,243,208,0.72)_20%,rgba(110,231,183,0.7)_32%,rgba(6,78,59,0.98)_75%)]'
                        }`}
                        style={{ transform: `rotate(${beadRotation}deg)` }}
                      />
                      <span
                        className={`relative z-[1] flex h-[74%] w-[74%] flex-col items-center justify-center rounded-full shadow-[0_20px_40px_rgba(16,185,129,0.28)] ring-1 ring-white/40 backdrop-blur-sm transition-all duration-200 active:scale-[0.98] ${
                          isDarkMode
                            ? 'bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 text-emerald-50'
                            : 'bg-gradient-to-b from-white via-emerald-50 to-emerald-100 text-emerald-800'
                        }`}
                        style={{ transform: `rotate(${beadRotation * 0.6}deg)` }}
                      >
                        <span className="text-[2.6rem] font-black leading-none tabular-nums tracking-tight max-md:text-[2.35rem]">
                          {tasbihCount}
                        </span>
                        <span className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${mutedText}`}>
                          {tasbihMode === 'stone' ? 'Stone / Scroll' : 'Tap'}
                        </span>
                      </span>
                    </button>

                    <p className={`mt-3 text-center text-xs font-medium tabular-nums max-md:mt-2 ${mutedText}`}>
                      {tasbihCount} / {selectedPreset.target}
                      <span className={`mx-1.5 ${isDarkMode ? 'text-slate-600' : 'text-emerald-200'}`}>·</span>
                      {progressPercent}%
                      {completedCycles > 0 && (
                        <>
                          <span className={`mx-1.5 ${isDarkMode ? 'text-slate-600' : 'text-emerald-200'}`}>·</span>
                          {completedCycles} cycle{completedCycles > 1 ? 's' : ''}
                        </>
                      )}
                    </p>
                  </div>

                  {/* Undo / Reset */}
                  <div className="mt-1 grid shrink-0 grid-cols-2 gap-2 max-md:mt-0">
                    <button
                      type="button"
                      onClick={decrementTasbih}
                      className={`inline-flex w-full items-center justify-center gap-1 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        isDarkMode
                          ? 'border-slate-600/80 text-slate-300 active:bg-slate-800'
                          : 'border-emerald-100 bg-white text-emerald-700 active:bg-emerald-50'
                      }`}
                    >
                      ← Undo
                    </button>
                    <button
                      type="button"
                      onClick={resetTasbih}
                      className={`inline-flex w-full items-center justify-center gap-1 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        isDarkMode
                          ? 'border-slate-600/80 text-slate-300 active:bg-slate-800'
                          : 'border-emerald-100 bg-white text-emerald-700 active:bg-emerald-50'
                      }`}
                    >
                      <ArrowPathIcon className="h-3.5 w-3.5" />
                      Reset
                    </button>
                  </div>

                  {/* Today's progress — trio when classic dhikr, else only selected */}
                  <div
                    className={`mt-3 shrink-0 rounded-2xl border px-3 py-2.5 max-md:mt-2 max-md:py-2 ${
                      isDarkMode ? 'border-slate-700/70 bg-slate-800/50' : 'border-emerald-100/80 bg-white/80'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <h3 className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        Today
                      </h3>
                      <span className={`text-[10px] font-medium ${mutedText}`}>
                        {progressPresets.length === 3 ? '33 · 33 · 34' : `Target ${selectedPreset.target}`}
                      </span>
                    </div>
                    <div className={`gap-2 ${progressPresets.length > 1 ? 'grid grid-cols-3' : 'grid grid-cols-1'}`}>
                      {progressPresets.map((preset) => {
                        const count = dailyTracker.counts[preset.id] || 0;
                        const pct = Math.min(100, Math.round((count / preset.target) * 100));
                        const isActive = preset.id === selectedPreset.id;
                        const shortLabel =
                          progressPresets.length === 3
                            ? (
                                {
                                  subhanallah: 'Subhan',
                                  alhamdulillah: 'Alhamd',
                                  'allahu-akbar': 'Akbar',
                                } as Record<string, string>
                              )[preset.id] || preset.label
                            : preset.label;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => updatePreset(preset.id)}
                            className={`rounded-xl px-1.5 py-1.5 text-left transition ${
                              isActive
                                ? isDarkMode
                                  ? 'bg-emerald-500/15 ring-1 ring-emerald-400/40'
                                  : 'bg-emerald-50 ring-1 ring-emerald-200'
                                : ''
                            }`}
                          >
                            <p className={`truncate text-[10px] font-semibold leading-tight ${isActive ? headingText : mutedText}`}>
                              {shortLabel}
                            </p>
                            <p className={`mt-0.5 text-xs font-bold tabular-nums ${pct >= 100 ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600') : headingText}`}>
                              {count}/{preset.target}{pct >= 100 ? ' ✓' : ''}
                            </p>
                            <div className={`mt-1 h-1 w-full overflow-hidden rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-emerald-100'}`}>
                              <div
                                className={`h-1 rounded-full transition-all duration-300 ${pct >= 100 ? 'bg-emerald-500' : 'bg-emerald-400'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <div
            ref={profileSectionRef}
            className={`scroll-mt-24 mt-6 gap-4 md:hidden ${activeMobileSection === 'profile' ? 'grid' : 'hidden'}`}
          >
            <div className={`scroll-mt-24 rounded-2xl border p-4 shadow-sm ${cardBg}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className={`text-base font-bold ${headingText}`}>Saved Duas</h3>
                  <p className={`text-sm ${mutedText}`}>{bookmarkedIds.length} favorites saved</p>
                </div>
                <button
                  type="button"
                  onClick={openFavoritesView}
                  className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white"
                >
                  Open Favorites
                </button>
              </div>
            </div>

            {lastViewedDua && (
              <div className={`rounded-2xl border p-4 shadow-sm ${cardBg}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide ${mutedText}`}>Continue Reading</p>
                <h3 className={`mt-1 text-base font-bold ${headingText}`}>{lastViewedDua.title}</h3>
                <p className={`mt-1 text-sm ${mutedText}`}>{lastViewedDua.shortDescription}</p>
                <button
                  type="button"
                  onClick={resumeReading}
                  className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Open Last Viewed Dua
                </button>
              </div>
            )}

            <div className={`rounded-2xl border p-4 shadow-sm ${cardBg}`}>
              <h3 className={`text-base font-bold ${headingText}`}>Today&apos;s Dhikr Tracker</h3>
              <div className="mt-3 space-y-2 text-sm">
                {TASBIH_PRESETS.map((preset) => (
                  <div key={preset.id} className="flex items-center justify-between gap-3">
                    <span className={mutedText}>{preset.label}</span>
                    <span className={`font-semibold ${headingText}`}>{dailyTracker.counts[preset.id] || 0}/{preset.target}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`rounded-2xl border p-4 shadow-sm ${cardBg}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className={`text-base font-bold ${headingText}`}>Reminder & Language</h3>
                  <p className={`text-sm ${mutedText}`}>
                    {reminderStatus} • {reminderScheduleLabel} • Translation: {translationLanguage === 'urdu' ? 'Urdu' : 'English'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen((previous) => !previous)}
                  className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700"
                >
                  {isSettingsOpen ? 'Hide Settings' : 'Open Settings'}
                </button>
              </div>
            </div>

            {isSettingsOpen && (
              <div className={`rounded-2xl border p-4 shadow-sm ${cardBg}`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className={`text-base font-bold ${headingText}`}>Settings</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={enableReminderNotifications}
                      disabled={reminders.enabled}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        reminders.enabled
                          ? 'cursor-not-allowed bg-emerald-600 text-white'
                          : isDarkMode
                          ? 'border border-slate-500 bg-slate-900 text-slate-100'
                          : 'border border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      {reminders.enabled ? 'Enabled' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={disableReminderNotifications}
                      disabled={!reminders.enabled}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        !reminders.enabled
                          ? 'cursor-not-allowed bg-rose-600 text-white'
                          : isDarkMode
                          ? 'border border-slate-500 bg-slate-900 text-slate-100'
                          : 'border border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      {!reminders.enabled ? 'Disabled' : 'Disable'}
                    </button>
                  </div>
                </div>

                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${mutedText}`}>Translation</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setTranslationLanguage('english')}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        translationLanguage === 'english'
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : isDarkMode
                          ? 'border-slate-500 bg-slate-800 text-slate-100'
                          : 'border-emerald-200 bg-white text-emerald-700'
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setTranslationLanguage('urdu')}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        translationLanguage === 'urdu'
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : isDarkMode
                          ? 'border-slate-500 bg-slate-800 text-slate-100'
                          : 'border-emerald-200 bg-white text-emerald-700'
                      }`}
                    >
                      Urdu
                    </button>
                  </div>
                </div>

                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${mutedText}`}>Text Size</p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div className={`rounded-xl border p-3 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-emerald-100 bg-white'}`}>
                      <p className={`text-[11px] font-semibold uppercase tracking-wide ${mutedText}`}>Arabic</p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setArabicFontScale((prev) => adjustFontScale(prev, -FONT_SCALE_STEP))}
                          className={`rounded-lg px-2.5 py-1 text-sm font-bold ${isDarkMode ? 'bg-slate-700 text-slate-100' : 'bg-emerald-100 text-emerald-800'}`}
                          aria-label="Decrease Arabic font size"
                        >
                          A-
                        </button>
                        <span className={`min-w-[3.2rem] text-center text-xs font-semibold ${mutedText}`}>
                          {arabicFontScale.toFixed(1)}x
                        </span>
                        <button
                          type="button"
                          onClick={() => setArabicFontScale((prev) => adjustFontScale(prev, FONT_SCALE_STEP))}
                          className={`rounded-lg px-2.5 py-1 text-sm font-bold ${isDarkMode ? 'bg-slate-700 text-slate-100' : 'bg-emerald-100 text-emerald-800'}`}
                          aria-label="Increase Arabic font size"
                        >
                          A+
                        </button>
                      </div>
                    </div>
                    <div className={`rounded-xl border p-3 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-emerald-100 bg-white'}`}>
                      <p className={`text-[11px] font-semibold uppercase tracking-wide ${mutedText}`}>Transliteration</p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setTransliterationFontScale((prev) => adjustFontScale(prev, -FONT_SCALE_STEP))}
                          className={`rounded-lg px-2.5 py-1 text-sm font-bold ${isDarkMode ? 'bg-slate-700 text-slate-100' : 'bg-emerald-100 text-emerald-800'}`}
                          aria-label="Decrease transliteration font size"
                        >
                          A-
                        </button>
                        <span className={`min-w-[3.2rem] text-center text-xs font-semibold ${mutedText}`}>
                          {transliterationFontScale.toFixed(1)}x
                        </span>
                        <button
                          type="button"
                          onClick={() => setTransliterationFontScale((prev) => adjustFontScale(prev, FONT_SCALE_STEP))}
                          className={`rounded-lg px-2.5 py-1 text-sm font-bold ${isDarkMode ? 'bg-slate-700 text-slate-100' : 'bg-emerald-100 text-emerald-800'}`}
                          aria-label="Increase transliteration font size"
                        >
                          A+
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`mt-6 rounded-xl border p-4 sm:p-5 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-amber-100 bg-gradient-to-br from-amber-50/50 to-orange-50/50'}`}>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🔔</span>
                      <div>
                        <h3 className={`font-bold ${headingText}`}>Dhikr &amp; Dua Reminder</h3>
                        <p className={`text-xs ${mutedText}`}>{reminderScheduleLabel}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => reminders.enabled ? disableReminderNotifications() : enableReminderNotifications()}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                        reminders.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          reminders.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {(!reminderSupport.supported || reminderSupport.reason || !canConfigureReminderSettings) && (
                    <div className={`mb-4 rounded-lg border p-3 text-[11px] ${isDarkMode ? 'border-slate-600 bg-slate-900/50' : 'border-amber-200 bg-amber-50'}`}>
                      <p className="font-semibold text-amber-600">Note on Notifications</p>
                      {!reminderSupport.supported && <p className="mt-1 text-slate-500">Your browser does not support notifications.</p>}
                      {reminderSupport.reason && <p className="mt-1 text-slate-500">{reminderSupport.reason}</p>}
                      {!canConfigureReminderSettings && reminderSupport.supported && (
                        <p className="mt-1 text-slate-500">Please enable the toggle above and grant permission to configure reminders.</p>
                      )}
                    </div>
                  )}

                  <div className={`space-y-4 transition-opacity ${!canConfigureReminderSettings ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div>
                      <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>Include in Reminders</p>
                      <div className="flex gap-3">
                        <label className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition ${
                          reminders.includeDhikr ? (isDarkMode ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50') : (isDarkMode ? 'border-slate-600' : 'border-gray-200')
                        }`}>
                          <input
                            type="checkbox"
                            checked={reminders.includeDhikr}
                            onChange={(event) => handleReminderTypeToggle('includeDhikr', event.target.checked)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-sm font-medium">Dhikr</span>
                        </label>
                        <label className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition ${
                          reminders.includeDua ? (isDarkMode ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50') : (isDarkMode ? 'border-slate-600' : 'border-gray-200')
                        }`}>
                          <input
                            type="checkbox"
                            checked={reminders.includeDua}
                            onChange={(event) => handleReminderTypeToggle('includeDua', event.target.checked)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-sm font-medium">Dua</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>Schedule Type</p>
                      <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => handleReminderScheduleTypeChange('periodic')}
                          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                            reminders.scheduleType === 'periodic'
                              ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-400'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          Periodic
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReminderScheduleTypeChange('specific')}
                          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                            reminders.scheduleType === 'specific'
                              ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-400'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          Specific Time
                        </button>
                      </div>
                    </div>

                    <div className={`rounded-lg border p-3 ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-gray-100 bg-white'}`}>
                      {reminders.scheduleType === 'periodic' ? (
                        <label className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">Frequency</span>
                          <select
                            value={reminders.periodicIntervalMinutes}
                            onChange={(event) => handleReminderIntervalChange(event.target.value)}
                            className={`rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-emerald-400 ${
                              isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-gray-200 bg-white'
                            }`}
                          >
                            {REMINDER_INTERVAL_OPTIONS.map((minutes) => (
                              <option key={minutes} value={minutes}>
                                Every {minutes} min
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <label className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">Time of day</span>
                          <input
                            type="time"
                            value={reminders.specificTime}
                            onChange={(event) => handleReminderTimeChange(event.target.value)}
                            className={`rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-emerald-400 ${
                              isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-gray-200 bg-white'
                            }`}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </section>

        <nav className={`fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur md:hidden ${
          isDarkMode ? 'border-slate-700 bg-slate-950/95' : 'border-emerald-200 bg-white/95'
        }`}>
          <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2 px-3 py-2 text-center text-xs font-semibold">
            <button
              type="button"
              onClick={() => scrollToSection('search')}
              className={`rounded-2xl px-2 py-2 ${
                activeMobileSection === 'search'
                  ? 'bg-emerald-600 text-white'
                  : isDarkMode
                  ? 'text-slate-100 hover:bg-slate-800'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <MagnifyingGlassIcon className="mx-auto h-4 w-4" />
              Search
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('tasbih')}
              className={`rounded-2xl px-2 py-2 ${
                activeMobileSection === 'tasbih'
                  ? 'bg-emerald-600 text-white'
                  : isDarkMode
                  ? 'text-slate-100 hover:bg-slate-800'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <MoonIcon className="mx-auto h-4 w-4" />
              Tasbih
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('profile')}
              className={`rounded-2xl px-2 py-2 ${
                activeMobileSection === 'profile'
                  ? 'bg-emerald-600 text-white'
                  : isDarkMode
                  ? 'text-slate-100 hover:bg-slate-800'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <BookmarkIcon className="mx-auto h-4 w-4" />
              Profile
            </button>
          </div>
        </nav>
      </div>
    </>
  );
};

export default DhikrDua;
