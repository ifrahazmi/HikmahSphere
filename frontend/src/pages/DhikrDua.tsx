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
import {
  DUA_CATEGORIES,
  DUA_LIBRARY,
  DUA_LIBRARY_META,
  QUICK_ACCESS_ITEMS,
  SITUATION_FILTERS,
  type DuaCategoryId,
  type DuaEntry,
  type SituationFilterId,
} from '../data/dhikrDuaLibrary';

interface DhikrPreset {
  id: string;
  label: string;
  arabic: string;
  target: number;
}

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

interface DhikrUserStatePayload {
  bookmarks?: string[];
  lastViewedDuaId?: string | null;
  tasbih?: {
    presetId: string;
    count: number;
  };
  dailyTracker?: DailyDhikrTracker | null;
  reminders?: ReminderSettings;
  settings?: {
    darkMode: boolean;
    translationLanguage: 'english' | 'urdu';
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
const REMINDER_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const REMINDER_INTERVAL_OPTIONS = [30, 60, 120, 180, 360];
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

const TASBIH_PRESETS: DhikrPreset[] = [
  { id: 'subhanallah', label: 'SubhanAllah', arabic: 'سُبْحَانَ ٱللَّٰهِ', target: 33 },
  { id: 'alhamdulillah', label: 'Alhamdulillah', arabic: 'ٱلْحَمْدُ لِلَّٰهِ', target: 33 },
  { id: 'allahu-akbar', label: 'Allahu Akbar', arabic: 'ٱللَّٰهُ أَكْبَر', target: 34 },
  { id: 'astaghfirullah', label: 'Astaghfirullah', arabic: 'أَسْتَغْفِرُ ٱللَّٰهَ', target: 100 },
  { id: 'la-ilaha-illa-allah', label: 'La ilaha illa Allah', arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ', target: 100 },
];

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
  isDarkMode: boolean
): React.ReactNode => {
  const normalized = normalizeArabicForDisplay(arabicText);
  const parts = normalized.split('،').map((part) => part.trim()).filter(Boolean);

  if (parts.length <= 1) {
    return normalized;
  }

  return parts.map((part, index) => (
    <React.Fragment key={`${keyPrefix}-${index}`}>
      {part}
      {index < parts.length - 1 && (
        <>
          {'، '}
          <span
            aria-hidden="true"
            className={`mx-1 inline-block h-1.5 w-1.5 align-middle rounded-full ${
              isDarkMode ? 'bg-emerald-300' : 'bg-emerald-600'
            }`}
          />
          {' '}
        </>
      )}
    </React.Fragment>
  ));
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
  const [tasbihCount, setTasbihCount] = useState(0);
  const [dailyTracker, setDailyTracker] = useState<DailyDhikrTracker>({
    date: getTodayKey(),
    counts: createEmptyDailyCounts(),
  });

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [translationLanguage, setTranslationLanguage] = useState<'english' | 'urdu'>('english');
  const [playingDuaId, setPlayingDuaId] = useState<string | null>(null);
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
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const arabicSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isHydratingCloudStateRef = useRef(false);
  const hasLoadedCloudStateRef = useRef(false);

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
    localStorage.setItem(TASBIH_STORAGE_KEY, JSON.stringify({ presetId: selectedPresetId, count: tasbihCount }));
  }, [selectedPresetId, tasbihCount]);

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
        const hasRemoteReminderState = hasCustomReminderConfiguration(remoteReminders);
        const hasRemoteSettingsState = remoteDarkMode !== false || remoteTranslation !== 'english';

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
          if (remoteTasbih) {
            setSelectedPresetId(remoteTasbih.presetId);
            setTasbihCount(remoteTasbih.count);
          }
          if (remoteDailyTracker) {
            setDailyTracker(remoteDailyTracker);
          }
          setReminders(remoteReminders);
          setIsDarkMode(remoteDarkMode);
          setTranslationLanguage(remoteTranslation);
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
      reminders,
      settings: {
        darkMode: isDarkMode,
        translationLanguage,
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

        new Notification(title, {
          body,
          icon: '/logo.png',
          badge: '/logo.png',
        });

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
  }, [reminders, reminderSupport.permission, reminderSupport.supported]);

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
    setTasbihCount(0);
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
    if (!filteredDuas.length) return;

    const activeId = focusedDuaId || lastViewedDuaId || filteredDuas[0].id;
    const currentIndex = filteredDuas.findIndex((dua) => dua.id === activeId);

    if (currentIndex < 0) {
      const first = filteredDuas[0];
      focusDuaCard(first.id);
      return;
    }

    const targetIndex = direction === 'next'
      ? Math.min(filteredDuas.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1);

    const target = filteredDuas[targetIndex];
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
      toast.success('Reminder notifications enabled.');
      return true;
    }

    const result = await Notification.requestPermission();
    const refreshedSupport = getReminderSupportSnapshot();
    setReminderSupport(refreshedSupport);

    if (result === 'granted') {
      setReminders((previous) => ({ ...previous, enabled: true }));
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
  const reminderPermissionLabel =
    reminderSupport.permission === 'unsupported'
      ? 'Unsupported'
      : reminderSupport.permission === 'granted'
      ? 'Granted'
      : reminderSupport.permission === 'denied'
      ? 'Denied'
      : 'Ask';
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
        title="Dhikr & Dua with Authentic References, Urdu/English Translation & Online Tasbih Counter"
        description="Read authentic daily duas and adhkar with Arabic text, transliteration, English and Urdu translation, hadith references, bookmarks, and a free online tasbih counter on HikmahSphere."
        path="/dhikr-dua"
        keywords={[
          'dhikr and dua',
          'dua and zikr',
          'authentic duas',
          'hisn al muslim duas',
          'morning evening adhkar',
          'daily duas online',
          'dua for anxiety',
          'dua with arabic and translation',
          'dua in urdu',
          'online dua counter',
          'tasbih counter',
          'online tasbih counter',
          'islamic supplications with references',
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

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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

                    <div className={`rounded-xl border p-4 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-amber-100 bg-white'}`}>
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className={`text-sm font-bold ${headingText}`}>Dhikr &amp; Dua Reminder</h3>
                          <p className={`text-xs ${mutedText}`}>Status: {reminderStatus} • {reminderScheduleLabel}</p>
                        </div>
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

                      <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${isDarkMode ? 'border-slate-600 bg-slate-900' : 'border-emerald-200 bg-emerald-50'}`}>
                        <p className={mutedText}>
                          Support: {reminderSupport.supported ? 'Available' : 'Not Available'} • Permission: {reminderPermissionLabel}
                        </p>
                        {reminderSupport.reason && (
                          <p className={`${mutedText} mt-1`}>{reminderSupport.reason}</p>
                        )}
                        {!canConfigureReminderSettings && (
                          <p className={`${mutedText} mt-1`}>
                            Grant notification permission to configure reminder type and timing.
                          </p>
                        )}
                      </div>

                      <div className="space-y-3 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 px-3 py-2">
                            <span className={mutedText}>Dhikr</span>
                            <input
                              type="checkbox"
                              checked={reminders.includeDhikr}
                              disabled={!canConfigureReminderSettings}
                              onChange={(event) => handleReminderTypeToggle('includeDhikr', event.target.checked)}
                            />
                          </label>
                          <label className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 px-3 py-2">
                            <span className={mutedText}>Dua</span>
                            <input
                              type="checkbox"
                              checked={reminders.includeDua}
                              disabled={!canConfigureReminderSettings}
                              onChange={(event) => handleReminderTypeToggle('includeDua', event.target.checked)}
                            />
                          </label>
                        </div>

                        <div>
                          <p className={`text-xs font-semibold uppercase tracking-wide ${mutedText}`}>Schedule Type</p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={!canConfigureReminderSettings}
                              onClick={() => handleReminderScheduleTypeChange('periodic')}
                              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                reminders.scheduleType === 'periodic'
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : isDarkMode
                                  ? 'border-slate-500 bg-slate-900 text-slate-100'
                                  : 'border-emerald-200 bg-white text-emerald-700'
                              }`}
                            >
                              Periodic
                            </button>
                            <button
                              type="button"
                              disabled={!canConfigureReminderSettings}
                              onClick={() => handleReminderScheduleTypeChange('specific')}
                              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                reminders.scheduleType === 'specific'
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : isDarkMode
                                  ? 'border-slate-500 bg-slate-900 text-slate-100'
                                  : 'border-emerald-200 bg-white text-emerald-700'
                              }`}
                            >
                              Specific Time
                            </button>
                          </div>
                        </div>

                        {reminders.scheduleType === 'periodic' ? (
                          <label className="flex items-center justify-between gap-3">
                            <span className={mutedText}>Frequency</span>
                            <select
                              value={reminders.periodicIntervalMinutes}
                              disabled={!canConfigureReminderSettings}
                              onChange={(event) => handleReminderIntervalChange(event.target.value)}
                              className={`rounded-lg border px-2 py-1 text-sm ${
                                isDarkMode
                                  ? 'border-slate-500 bg-slate-900 text-slate-100'
                                  : 'border-emerald-200 bg-white text-gray-900'
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
                            <span className={mutedText}>Reminder time</span>
                            <input
                              type="time"
                              value={reminders.specificTime}
                              disabled={!canConfigureReminderSettings}
                              onChange={(event) => handleReminderTimeChange(event.target.value)}
                              className={`rounded-lg border px-2 py-1 text-sm ${
                                isDarkMode
                                  ? 'border-slate-500 bg-slate-900 text-slate-100'
                                  : 'border-emerald-200 bg-white text-gray-900'
                              }`}
                            />
                          </label>
                        )}

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

                {filteredDuas.length === 0 ? (
                  <div className={`rounded-xl border border-dashed p-8 text-center ${isDarkMode ? 'border-slate-600 bg-slate-900' : 'border-emerald-200 bg-emerald-50/40'}`}>
                    <p className={`text-base font-semibold ${headingText}`}>No duas matched your filters.</p>
                    <p className={`mt-1 text-sm ${mutedText}`}>Try another keyword or clear situation/category filters.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredDuas.map((dua) => {
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
                                                <p className="mb-2 text-center text-xl font-semibold font-indopak-nastaleeq">
                                                  {blockHeading}
                                                </p>
                                              )}
                                              <p className="text-[1.6rem] sm:text-[1.85rem] font-indopak-nastaleeq">
                                                {renderArabicWithStopMarkers(blockBody || block, `${dua.id}-block-text-${index}`, isDarkMode)}
                                              </p>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <>
                                        {arabicHeading && (
                                          <p className={`mb-2 text-center text-xl font-semibold font-indopak-nastaleeq ${
                                            isMorningEveningOne ? 'sm:text-[1.65rem]' : ''
                                          }`}>
                                            {arabicHeading}
                                          </p>
                                        )}
                                        <p className="text-[1.75rem] sm:text-[2rem] font-indopak-nastaleeq">
                                          {renderArabicWithStopMarkers(arabicBody || normalizedArabic || dua.arabic, `${dua.id}-body`, isDarkMode)}
                                        </p>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-700">Transliteration</p>
                                  <p className={`rounded-xl p-4 text-sm leading-relaxed ${isDarkMode ? 'bg-slate-800 text-slate-100' : 'bg-teal-50 text-teal-900'}`}>
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
              <div id="tasbih-counter" ref={tasbihSectionRef} className={`scroll-mt-24 rounded-2xl border p-5 shadow-sm lg:sticky lg:top-24 ${cardBg}`}>
                <div className="mx-auto w-full max-w-md">
                  <h2 className={`text-center text-xl font-bold ${headingText}`}>Tasbih Counter</h2>
                  <p className={`mt-1 text-center text-sm ${mutedText}`}>Large tap area with vibration feedback on mobile.</p>

                  <div className="mt-4">
                    <label className={`mb-1 block text-xs font-semibold uppercase tracking-wide ${mutedText}`}>Select Dhikr</label>
                    <select
                      value={selectedPreset.id}
                      onChange={(event) => updatePreset(event.target.value)}
                      className={`w-full rounded-xl border px-3 py-2 text-[1.1rem] font-indopak-nastaleeq outline-none ${
                        isDarkMode
                          ? 'border-slate-600 bg-slate-800 text-slate-100'
                          : 'border-emerald-200 bg-white text-gray-900'
                      }`}
                    >
                      {TASBIH_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label}   {preset.arabic}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={`mt-5 rounded-2xl border p-4 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-emerald-100 bg-emerald-50/60'}`}>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-emerald-700">Current Dhikr</p>
                      <p className={`mt-1 text-lg font-semibold ${headingText}`}>{selectedPreset.label}</p>
                      <p className={`mt-1 font-indopak-nastaleeq text-3xl ${
                        isDarkMode ? 'text-emerald-100' : 'text-emerald-900'
                      }`}>
                        {selectedPreset.arabic}
                      </p>
                    </div>

                    <button
                      type="button"
                      onPointerDown={(event) => {
                        if (event.pointerType === 'mouse' && event.button !== 0) return;
                        incrementTasbih();
                      }}
                      onContextMenu={(event) => event.preventDefault()}
                      className="mx-auto mt-4 flex h-[62vw] w-[62vw] min-h-[11rem] min-w-[11rem] max-h-56 max-w-56 select-none touch-manipulation items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-center text-white shadow-xl transition active:scale-[0.98] hover:from-emerald-700 hover:to-teal-700"
                    >
                      <div>
                        <p className="text-5xl font-bold">{tasbihCount}</p>
                        <p className="mt-1 text-sm font-semibold">Tap to Count</p>
                        <p className="mt-2 text-xs">{selectedPreset.label}</p>
                      </div>
                    </button>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={decrementTasbih}
                        className={`inline-flex w-full items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                          isDarkMode
                            ? 'border-slate-600 text-slate-100 hover:border-slate-500'
                            : 'border-emerald-200 text-emerald-700 hover:border-emerald-400'
                        }`}
                      >
                        Undo -1
                      </button>
                      <button
                        type="button"
                        onClick={incrementTasbih}
                        className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                      >
                        +1 Tasbih
                      </button>
                    </div>

                    <div className="mt-4">
                      <div className="mb-1 flex justify-between text-xs font-medium">
                        <span className={mutedText}>Progress</span>
                        <span className={mutedText}>{progressPercent}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <p className={`mt-2 text-xs ${mutedText}`}>
                        Target: {selectedPreset.target} | Cycles completed: {completedCycles}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={resetTasbih}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-400"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                      Reset Counter
                    </button>
                  </div>

                  <div className={`mt-5 rounded-xl border p-4 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-emerald-100 bg-white'}`}>
                    <h3 className={`text-sm font-bold ${headingText}`}>Today's Dhikr Tracker</h3>
                    <div className="mt-2 space-y-1 text-sm">
                      {TASBIH_PRESETS.slice(0, 3).map((preset) => (
                        <p key={preset.id} className={mutedText}>
                          {preset.label} {dailyTracker.counts[preset.id] || 0}/{preset.target}
                        </p>
                      ))}
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
                {TASBIH_PRESETS.slice(0, 3).map((preset) => (
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

                <div className={`mt-4 rounded-lg border px-3 py-2 text-xs ${isDarkMode ? 'border-slate-600 bg-slate-900' : 'border-emerald-200 bg-emerald-50'}`}>
                  <p className={mutedText}>
                    Support: {reminderSupport.supported ? 'Available' : 'Not Available'} • Permission: {reminderPermissionLabel}
                  </p>
                  {reminderSupport.reason && (
                    <p className={`${mutedText} mt-1`}>{reminderSupport.reason}</p>
                  )}
                  {!canConfigureReminderSettings && (
                    <p className={`${mutedText} mt-1`}>
                      Grant notification permission to configure reminder type and timing.
                    </p>
                  )}
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 px-3 py-2">
                      <span className={mutedText}>Dhikr</span>
                      <input
                        type="checkbox"
                        checked={reminders.includeDhikr}
                        disabled={!canConfigureReminderSettings}
                        onChange={(event) => handleReminderTypeToggle('includeDhikr', event.target.checked)}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 px-3 py-2">
                      <span className={mutedText}>Dua</span>
                      <input
                        type="checkbox"
                        checked={reminders.includeDua}
                        disabled={!canConfigureReminderSettings}
                        onChange={(event) => handleReminderTypeToggle('includeDua', event.target.checked)}
                      />
                    </label>
                  </div>

                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${mutedText}`}>Schedule Type</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={!canConfigureReminderSettings}
                        onClick={() => handleReminderScheduleTypeChange('periodic')}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                          reminders.scheduleType === 'periodic'
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : isDarkMode
                            ? 'border-slate-500 bg-slate-900 text-slate-100'
                            : 'border-emerald-200 bg-white text-emerald-700'
                        }`}
                      >
                        Periodic
                      </button>
                      <button
                        type="button"
                        disabled={!canConfigureReminderSettings}
                        onClick={() => handleReminderScheduleTypeChange('specific')}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                          reminders.scheduleType === 'specific'
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : isDarkMode
                            ? 'border-slate-500 bg-slate-900 text-slate-100'
                            : 'border-emerald-200 bg-white text-emerald-700'
                        }`}
                      >
                        Specific Time
                      </button>
                    </div>
                  </div>

                  {reminders.scheduleType === 'periodic' ? (
                    <label className="flex items-center justify-between gap-3">
                      <span className={mutedText}>Frequency</span>
                      <select
                        value={reminders.periodicIntervalMinutes}
                        disabled={!canConfigureReminderSettings}
                        onChange={(event) => handleReminderIntervalChange(event.target.value)}
                        className={`rounded-lg border px-2 py-1 text-sm ${
                          isDarkMode
                            ? 'border-slate-500 bg-slate-900 text-slate-100'
                            : 'border-emerald-200 bg-white text-gray-900'
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
                      <span className={mutedText}>Reminder time</span>
                      <input
                        type="time"
                        value={reminders.specificTime}
                        disabled={!canConfigureReminderSettings}
                        onChange={(event) => handleReminderTimeChange(event.target.value)}
                        className={`rounded-lg border px-2 py-1 text-sm ${
                          isDarkMode
                            ? 'border-slate-500 bg-slate-900 text-slate-100'
                            : 'border-emerald-200 bg-white text-gray-900'
                        }`}
                      />
                    </label>
                  )}

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
