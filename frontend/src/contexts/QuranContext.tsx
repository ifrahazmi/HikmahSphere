import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { API_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import {
  Surah,
  SurahData,
  Ayah,
  QuranContextType,
  QuranSettings,
  Bookmark,
  BookmarkColor,
  BOOKMARK_COLORS,
  LastRead,
  SearchResult,
  DEFAULT_QURAN_SETTINGS,
  DEFAULT_TRANSLATIONS,
} from '../types/quran';

const QuranContext = createContext<QuranContextType | undefined>(undefined);
const TRANSLATION_AUDIO_SOURCES: Record<string, { baseUrl: string; label: string; provider: string }> = {
  'ur.jalandhry': {
    baseUrl: 'https://everyayah.com/data/translations/urdu_shamshad_ali_khan_46kbps',
    label: 'Urdu - Fateh Muhammad Jalandhry',
    provider: 'EveryAyah',
  },
  'en.sahih': {
    baseUrl: 'https://everyayah.com/data/English/Sahih_Intnl_Ibrahim_Walk_192kbps',
    label: 'English - Saheeh International',
    provider: 'EveryAyah',
  },
};
const LEGACY_QURAN_SETTINGS_KEY = 'quranSettings';
const LEGACY_QURAN_BOOKMARKS_KEY = 'quranBookmarks';
const LEGACY_QURAN_LAST_READ_KEY = 'quranLastRead';

export const QuranProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const { isAuthenticated, loading: authLoading, user } = useAuth();

  // State
  const [currentSurah, setCurrentSurah] = useState<number | null>(null);
  const [currentAyah, setCurrentAyah] = useState<number | null>(null);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [surahData, setSurahData] = useState<SurahData | null>(null);
  const [translations, setTranslations] = useState<SurahData[]>([]);
  const [transliteration, setTransliteration] = useState<SurahData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [currentPlayingAyah, setCurrentPlayingAyah] = useState<number | null>(null);
  const [currentPlayingSurah, setCurrentPlayingSurah] = useState<number | null>(null);
  const [currentPlaybackTrack, setCurrentPlaybackTrack] = useState<'arabic' | 'translation' | 'bismillah' | null>(null);
  const [canSeekAudio, setCanSeekAudio] = useState(true);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [totalSurahDuration, setTotalSurahDuration] = useState(0);
  const [cumulativeTime, setCumulativeTime] = useState(0);

  const DEFAULT_QURAN_TITLE = 'Quran Reader with Audio, Transliteration and Translation | HikmahSphere';
  const PLAYER_BRAND_TITLE = 'Hikmah Sphere - A Unified Islamic Digital Platform';
  const PREFETCH_LOOKAHEAD_AYAHS = 10;
  const SURAH_DURATION_FALLBACK_PER_AYAH = 7;
  const TRANSLATION_SPEECH_SECONDS_PER_WORD = 0.72;
  const TRANSLATION_AUDIO_LOG_PREFIX = '[TranslationAudio]';

  // Audio ref
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [ayahAudioQueue, setAyahAudioQueue] = useState<number[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [isSurahMode, setIsSurahMode] = useState(false);
  const isHydratingCloudStateRef = useRef(false);
  const hasLoadedCloudStateRef = useRef(false);

  // Refs for audio ended handler (to avoid re-registering event listener)
  const ayahAudioQueueRef = React.useRef<number[]>([]);
  const currentQueueIndexRef = React.useRef(0);
  const currentPlayingSurahRef = React.useRef<number | null>(null);
  const currentPlaybackTrackRef = React.useRef<'arabic' | 'translation' | 'bismillah' | null>(null);
  const cumulativeTimeRef = React.useRef(0);
  const totalSurahDurationRef = React.useRef(0);
  const isSurahModeRef = React.useRef(false);
  const pausedTimeRef = React.useRef(0);
  const isBismillahRef = React.useRef(false);
  const ayahAudioUrlMapRef = React.useRef<Map<number, string>>(new Map());
  const prefetchedAyahAudioRef = React.useRef<Map<number, HTMLAudioElement>>(new Map());
  const prefetchedAyahFetchRef = React.useRef<Set<number>>(new Set());
  const surahEditionsCacheRef = useRef<Map<string, SurahData[]>>(new Map());
  const translationSurahCacheRef = useRef<Map<string, SurahData>>(new Map());
  const translationPlaybackContextRef = useRef<{
    surahNumber: number;
    ayahNumber: number;
    continueSurahMode?: boolean;
    nextQueueIndex?: number | null;
  } | null>(null);

  // Stable refs for audio event handlers (delegates to latest handler via ref)
  const handleAudioEndedFnRef = React.useRef<() => void>(() => {});
  const handleAudioErrorFnRef = React.useRef<() => void>(() => {});
  const handleAudioTimeUpdateFnRef = React.useRef<() => void>(() => {});
  const stopAudioRef = React.useRef<() => void>(() => {});

  const userStorageScope = user?.id || user?.email || 'guest';
  const userSettingsStorageKey = `quranSettings:${userStorageScope}`;
  const userBookmarksStorageKey = `quranBookmarks:${userStorageScope}`;
  const userLastReadStorageKey = `quranLastRead:${userStorageScope}`;

  const [settings, setSettings] = useState<QuranSettings>(DEFAULT_QURAN_SETTINGS);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [lastRead, setLastRead] = useState<LastRead | null>(null);
  const selectedTranslationsDependency = settings.selectedTranslations.join('|');

  const getSafeDuration = useCallback((value: number, fallback: number) => {
    if (Number.isFinite(value) && value > 0) return value;
    return fallback;
  }, []);

  const getProjectedSurahDuration = useCallback((currentTrackDuration: number) => {
    const queueLength = ayahAudioQueueRef.current.length;
    if (!queueLength) {
      return getSafeDuration(currentTrackDuration, SURAH_DURATION_FALLBACK_PER_AYAH);
    }

    const completedAyahs = isBismillahRef.current
      ? 0
      : Math.max(0, Math.min(currentQueueIndexRef.current, queueLength));
    const observedAverage =
      completedAyahs > 0
        ? cumulativeTimeRef.current / completedAyahs
        : SURAH_DURATION_FALLBACK_PER_AYAH;
    const estimatedAyahDuration = Math.max(
      SURAH_DURATION_FALLBACK_PER_AYAH,
      getSafeDuration(observedAverage, SURAH_DURATION_FALLBACK_PER_AYAH)
    );
    const safeCurrentTrackDuration = getSafeDuration(currentTrackDuration, estimatedAyahDuration);
    const remainingAyahs = isBismillahRef.current
      ? queueLength
      : Math.max(0, queueLength - (currentQueueIndexRef.current + 1));

    return cumulativeTimeRef.current + safeCurrentTrackDuration + remainingAyahs * estimatedAyahDuration;
  }, [SURAH_DURATION_FALLBACK_PER_AYAH, getSafeDuration]);

  const getTranslationAudioConfig = useCallback((identifier?: string | null) => {
    if (!identifier) return null;
    return TRANSLATION_AUDIO_SOURCES[identifier] ?? null;
  }, []);

  const getTranslationAudioUrl = useCallback((identifier: string | null | undefined, surahNumber: number, ayahNumber: number) => {
    const config = getTranslationAudioConfig(identifier);
    if (!config) return null;

    const surahId = String(surahNumber).padStart(3, '0');
    const ayahId = String(ayahNumber).padStart(3, '0');
    return `${config.baseUrl}/${surahId}${ayahId}.mp3`;
  }, [getTranslationAudioConfig]);

  const estimateTranslationDuration = useCallback((text: string) => {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(3, wordCount * TRANSLATION_SPEECH_SECONDS_PER_WORD);
  }, [TRANSLATION_SPEECH_SECONDS_PER_WORD]);

  const cancelTranslationSpeech = useCallback(() => {
    console.log(`${TRANSLATION_AUDIO_LOG_PREFIX} Clearing translation playback context.`);
    translationPlaybackContextRef.current = null;

    if (currentPlaybackTrackRef.current === 'translation' && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [TRANSLATION_AUDIO_LOG_PREFIX]);

  const getSelectedTranslationData = useCallback(async (surahNumber: number) => {
    const selectedTranslationIdentifier = settings.selectedTranslations[0];
    if (!selectedTranslationIdentifier) {
      console.warn(`${TRANSLATION_AUDIO_LOG_PREFIX} No selected translation identifier was found.`);
      return null;
    }

    const activeTranslation = translations.find(
      (translation) =>
        translation.number === surahNumber &&
        translation.edition.identifier === selectedTranslationIdentifier
    );
    if (activeTranslation) {
      console.log(`${TRANSLATION_AUDIO_LOG_PREFIX} Using translation already loaded in reader state.`, {
        surahNumber,
        identifier: selectedTranslationIdentifier,
      });
      return activeTranslation;
    }

    const cacheKey = `${surahNumber}|${selectedTranslationIdentifier}`;
    const cachedTranslation = translationSurahCacheRef.current.get(cacheKey);
    if (cachedTranslation) {
      console.log(`${TRANSLATION_AUDIO_LOG_PREFIX} Using cached translation data.`, {
        surahNumber,
        identifier: selectedTranslationIdentifier,
      });
      return cachedTranslation;
    }

    try {
      console.log(`${TRANSLATION_AUDIO_LOG_PREFIX} Fetching translation data from API.`, {
        surahNumber,
        identifier: selectedTranslationIdentifier,
      });
      const response = await fetch(
        `${API_URL}/quran/surah/${surahNumber}/editions?editions=${selectedTranslationIdentifier}`
      );
      const data = await response.json();

      if (data.status === 'success' && data.data[0]) {
        translationSurahCacheRef.current.set(cacheKey, data.data[0]);
        if (translationSurahCacheRef.current.size > 24) {
          const oldestKey = translationSurahCacheRef.current.keys().next().value;
          if (oldestKey) {
            translationSurahCacheRef.current.delete(oldestKey);
          }
        }

        return data.data[0] as SurahData;
      }
    } catch (translationError) {
      console.error(`${TRANSLATION_AUDIO_LOG_PREFIX} Failed to load translation audio text:`, translationError);
    }

    console.warn(`${TRANSLATION_AUDIO_LOG_PREFIX} Translation data could not be resolved.`, {
      surahNumber,
      identifier: selectedTranslationIdentifier,
    });
    return null;
  }, [TRANSLATION_AUDIO_LOG_PREFIX, settings.selectedTranslations, translations]);

  // Keep refs in sync with state
  useEffect(() => {
    ayahAudioQueueRef.current = ayahAudioQueue;
  }, [ayahAudioQueue]);

  useEffect(() => {
    currentQueueIndexRef.current = currentQueueIndex;
  }, [currentQueueIndex]);

  useEffect(() => {
    currentPlayingSurahRef.current = currentPlayingSurah;
  }, [currentPlayingSurah]);

  useEffect(() => {
    currentPlaybackTrackRef.current = currentPlaybackTrack;
  }, [currentPlaybackTrack]);

  useEffect(() => {
    cumulativeTimeRef.current = cumulativeTime;
  }, [cumulativeTime]);

  useEffect(() => {
    totalSurahDurationRef.current = totalSurahDuration;
  }, [totalSurahDuration]);

  useEffect(() => {
    isSurahModeRef.current = isSurahMode;
  }, [isSurahMode]);
  
  const saveSettingsToLocal = useCallback((nextSettings: QuranSettings) => {
    const serialized = JSON.stringify(nextSettings);
    localStorage.setItem(userSettingsStorageKey, serialized);
    // Keep legacy key in sync for components that still read the global settings key.
    localStorage.setItem(LEGACY_QURAN_SETTINGS_KEY, serialized);
    window.dispatchEvent(new Event('quranSettingsChanged'));
  }, [userSettingsStorageKey]);

  const saveBookmarksToLocal = useCallback((nextBookmarks: Bookmark[]) => {
    const serialized = JSON.stringify(nextBookmarks);
    localStorage.setItem(userBookmarksStorageKey, serialized);
    if (userStorageScope === 'guest') {
      localStorage.setItem(LEGACY_QURAN_BOOKMARKS_KEY, serialized);
    }
  }, [userBookmarksStorageKey, userStorageScope]);

  const saveLastReadToLocal = useCallback((nextLastRead: LastRead | null) => {
    if (!nextLastRead) {
      localStorage.removeItem(userLastReadStorageKey);
      if (userStorageScope === 'guest') {
        localStorage.removeItem(LEGACY_QURAN_LAST_READ_KEY);
      }
      return;
    }
    const serialized = JSON.stringify(nextLastRead);
    localStorage.setItem(userLastReadStorageKey, serialized);
    if (userStorageScope === 'guest') {
      localStorage.setItem(LEGACY_QURAN_LAST_READ_KEY, serialized);
    }
  }, [userLastReadStorageKey, userStorageScope]);

  const toDate = useCallback((value: unknown): Date => {
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  }, []);

  const normalizeBookmarks = useCallback((value: unknown): Bookmark[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const raw = item as Record<string, unknown>;
        const surahNumber = Number(raw.surahNumber);
        const ayahNumber = Number(raw.ayahNumber);
        const surahName = typeof raw.surahName === 'string' ? raw.surahName : '';
        if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) return null;
        if (!Number.isInteger(ayahNumber) || ayahNumber < 1 || !surahName) return null;
        return {
          id: typeof raw.id === 'string' && raw.id ? raw.id : `${surahNumber}:${ayahNumber}:${Date.now()}-${index}`,
          surahNumber,
          ayahNumber,
          surahName,
          timestamp: toDate(raw.timestamp),
          note: typeof raw.note === 'string' ? raw.note : undefined,
          color:
            typeof raw.color === 'string' && BOOKMARK_COLORS.includes(raw.color as BookmarkColor)
              ? (raw.color as BookmarkColor)
              : undefined,
        } as Bookmark;
      })
      .filter(Boolean) as Bookmark[];
  }, [toDate]);

  const normalizeLastRead = useCallback((value: unknown): LastRead | null => {
    if (!value || typeof value !== 'object') return null;
    const raw = value as Record<string, unknown>;
    const surahNumber = Number(raw.surahNumber);
    const ayahNumber = Number(raw.ayahNumber);
    const surahName = typeof raw.surahName === 'string' ? raw.surahName : '';
    if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) return null;
    if (!Number.isInteger(ayahNumber) || ayahNumber < 1 || !surahName) return null;
    return {
      surahNumber,
      ayahNumber,
      surahName,
      timestamp: toDate(raw.timestamp),
    };
  }, [toDate]);

  const normalizeSelectedTranslations = useCallback((value: unknown): string[] => {
    const supportedTranslations = new Set(
      DEFAULT_TRANSLATIONS
        .filter((translation) => translation.language === 'English' || translation.language === 'Urdu')
        .map((translation) => translation.identifier)
    );

    if (!Array.isArray(value)) {
      return [...DEFAULT_QURAN_SETTINGS.selectedTranslations];
    }

    const firstSupportedTranslation = value.find(
      (translation): translation is string =>
        typeof translation === 'string' && supportedTranslations.has(translation)
    );

    return firstSupportedTranslation
      ? [firstSupportedTranslation]
      : [...DEFAULT_QURAN_SETTINGS.selectedTranslations];
  }, []);

  const normalizeSettings = useCallback((value: unknown): QuranSettings => {
    const mergedSettings =
      value && typeof value === 'object'
        ? ({ ...DEFAULT_QURAN_SETTINGS, ...(value as Partial<QuranSettings>) } as QuranSettings)
        : { ...DEFAULT_QURAN_SETTINGS };

    const legacyTranslationAudioMode =
      value && typeof value === 'object' && 'translationAudioMode' in (value as Record<string, unknown>)
        ? (value as Record<string, unknown>).translationAudioMode
        : null;

    return {
      ...mergedSettings,
      selectedTranslations: normalizeSelectedTranslations(mergedSettings.selectedTranslations),
      translationAudioEnabled:
        typeof mergedSettings.translationAudioEnabled === 'boolean'
          ? mergedSettings.translationAudioEnabled
          : legacyTranslationAudioMode === 'after-arabic',
    };
  }, [normalizeSelectedTranslations]);

  useEffect(() => {
    const parseJson = (raw: string | null): unknown => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };

    const isGuestScope = userStorageScope === 'guest';
    const userSettingsRaw = localStorage.getItem(userSettingsStorageKey);
    const fallbackSettingsRaw = isGuestScope ? localStorage.getItem(LEGACY_QURAN_SETTINGS_KEY) : null;
    const settingsPayload = parseJson(userSettingsRaw) ?? parseJson(fallbackSettingsRaw);
    const hydratedSettings = normalizeSettings(settingsPayload);
    setSettings(hydratedSettings);

    const userBookmarksRaw = localStorage.getItem(userBookmarksStorageKey);
    const fallbackBookmarksRaw = isGuestScope ? localStorage.getItem(LEGACY_QURAN_BOOKMARKS_KEY) : null;
    const bookmarksPayload = parseJson(userBookmarksRaw) ?? parseJson(fallbackBookmarksRaw);
    setBookmarks(normalizeBookmarks(bookmarksPayload));

    const userLastReadRaw = localStorage.getItem(userLastReadStorageKey);
    const fallbackLastReadRaw = isGuestScope ? localStorage.getItem(LEGACY_QURAN_LAST_READ_KEY) : null;
    const lastReadPayload = parseJson(userLastReadRaw) ?? parseJson(fallbackLastReadRaw);
    setLastRead(normalizeLastRead(lastReadPayload));
  }, [
    userSettingsStorageKey,
    userBookmarksStorageKey,
    userLastReadStorageKey,
    userStorageScope,
    normalizeBookmarks,
    normalizeLastRead,
    normalizeSettings,
  ]);

  const syncUserQuranStateToBackend = useCallback(
    async (payload: { settings: QuranSettings; bookmarks: Bookmark[]; lastRead: LastRead | null }) => {
      if (!isAuthenticated) return;
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        await fetch(`${API_URL}/quran/user-state`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.error('Failed to sync Quran state to backend:', err);
      }
    },
    [isAuthenticated]
  );

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      hasLoadedCloudStateRef.current = false;
      return;
    }

    const loadUserQuranState = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      isHydratingCloudStateRef.current = true;

      try {
        const response = await fetch(`${API_URL}/quran/user-state`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch user state (${response.status})`);
        }

        const data = await response.json();
        const remoteSettings = data?.data?.settings;
        const remoteBookmarks = normalizeBookmarks(data?.data?.bookmarks);
        const remoteLastRead = normalizeLastRead(data?.data?.lastRead);

        const hasRemoteState =
          !!remoteSettings || remoteBookmarks.length > 0 || !!remoteLastRead;

        if (hasRemoteState) {
          if (remoteSettings && typeof remoteSettings === 'object') {
            const mergedSettings = normalizeSettings(remoteSettings);
            setSettings(mergedSettings);
            saveSettingsToLocal(mergedSettings);
          }
          setBookmarks(remoteBookmarks);
          saveBookmarksToLocal(remoteBookmarks);

          setLastRead(remoteLastRead);
          saveLastReadToLocal(remoteLastRead);
        } else {
          // First login for existing local user: push local state so it is available across devices.
          await syncUserQuranStateToBackend({
            settings,
            bookmarks,
            lastRead,
          });
        }
      } catch (err) {
        console.error('Failed to load Quran user state:', err);
      } finally {
        hasLoadedCloudStateRef.current = true;
        isHydratingCloudStateRef.current = false;
      }
    };

    loadUserQuranState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (!hasLoadedCloudStateRef.current || isHydratingCloudStateRef.current) return;

    const timeout = setTimeout(() => {
      syncUserQuranStateToBackend({ settings, bookmarks, lastRead });
    }, 500);

    return () => clearTimeout(timeout);
  }, [settings, bookmarks, lastRead, isAuthenticated, authLoading, syncUserQuranStateToBackend]);

  // Load surahs list on mount
  useEffect(() => {
    const fetchSurahs = async () => {
      try {
        const response = await fetch(`${API_URL}/quran/surahs`);
        const data = await response.json();
        if (data.status === 'success') {
          setSurahs(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch surahs:', err);
      }
    };
    fetchSurahs();
  }, []);

  // Load surah data when surah changes
  const loadSurahData = useCallback(async (surahNumber: number) => {
    if (!surahNumber || surahNumber < 1 || surahNumber > 114) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Build editions string (Arabic + transliteration + selected translations)
      const editions = ['ar.alafasy'];
      
      // In Arabic-only mode, skip translations and transliteration
      if (!settings.arabicOnlyMode) {
        if (settings.showTransliteration) {
          editions.push('en.transliteration');
        }
        editions.push(...settings.selectedTranslations);
      }

      const cacheKey = `${surahNumber}|${settings.arabicOnlyMode ? 'arabic' : 'mixed'}|${settings.showTransliteration ? 'translit' : 'plain'}|${settings.arabicFont === 'indopak-nastaleeq-v2' ? 'indopak-v2' : 'standard'}|${settings.selectedTranslations.join(',')}`;

      const applyLoadedEditions = (loadedEditions: SurahData[]) => {
        // First edition is always Arabic
        setSurahData(loadedEditions[0]);

        if (settings.arabicOnlyMode) {
          setTransliteration(null);
          setTranslations([]);
          return;
        }

        let startIndex = 1;
        if (settings.showTransliteration && loadedEditions[1]?.edition?.type === 'transliteration') {
          setTransliteration(loadedEditions[1]);
          startIndex = 2;
        } else {
          setTransliteration(null);
        }

        setTranslations(loadedEditions.slice(startIndex));
      };

      const cachedEditions = surahEditionsCacheRef.current.get(cacheKey);
      if (cachedEditions) {
        applyLoadedEditions(cachedEditions);
        return;
      }
      
      const response = await fetch(
        `${API_URL}/quran/surah/${surahNumber}/editions?editions=${editions.join(',')}`
      );
      const data = await response.json();
      
      if (data.status === 'success') {
        let fetchedEditions: SurahData[] = data.data;

        if (settings.arabicFont === 'indopak-nastaleeq-v2') {
          try {
            const indopakV2Response = await fetch(`${API_URL}/quran/surah/${surahNumber}/indopak-v2`);
            const indopakV2Data = await indopakV2Response.json();

            if (indopakV2Data.status === 'success' && Array.isArray(indopakV2Data.data?.rows)) {
              const ayahTextMap = new Map<number, string>();

              indopakV2Data.data.rows.forEach((row: { ayah: number; text: string }) => {
                if (typeof row.ayah === 'number' && typeof row.text === 'string') {
                  ayahTextMap.set(row.ayah, row.text);
                }
              });

              if (ayahTextMap.size > 0) {
                fetchedEditions = [
                  {
                    ...fetchedEditions[0],
                    edition: {
                      ...fetchedEditions[0].edition,
                      identifier: 'indopak.nastaleeq.v2',
                      name: 'IndoPak Nastaleeq v2',
                      englishName: 'IndoPak Nastaleeq v2',
                    },
                    ayahs: fetchedEditions[0].ayahs.map((ayah) => ({
                      ...ayah,
                      text: ayahTextMap.get(ayah.numberInSurah) ?? ayah.text,
                    })),
                  },
                  ...fetchedEditions.slice(1),
                ];
              }
            }
          } catch (indopakError) {
            console.error('Failed to load IndoPak Nastaleeq v2 data:', indopakError);
          }
        }

        surahEditionsCacheRef.current.set(cacheKey, fetchedEditions);
        if (surahEditionsCacheRef.current.size > 18) {
          const oldestKey = surahEditionsCacheRef.current.keys().next().value;
          if (oldestKey) {
            surahEditionsCacheRef.current.delete(oldestKey);
          }
        }

        applyLoadedEditions(fetchedEditions);
      } else {
        setError('Failed to load surah data');
      }
    } catch (err) {
      console.error('Load surah error:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [settings.selectedTranslations, settings.showTransliteration, settings.arabicOnlyMode, settings.arabicFont]);

  // Update settings and reload if necessary
  const updateSettings = useCallback((newSettings: Partial<QuranSettings>) => {
    setSettings(prev => {
      const updated = normalizeSettings({ ...prev, ...newSettings });
      saveSettingsToLocal(updated);
      return updated;
    });
  }, [normalizeSettings, saveSettingsToLocal]);

  // Navigation
  const goToSurah = useCallback((surahNumber: number) => {
    // Always stop audio when changing surah (uses ref to avoid forward-reference issue)
    stopAudioRef.current();
    setCurrentSurah(surahNumber);
    setCurrentAyah(1);
    loadSurahData(surahNumber);
  }, [loadSurahData]);

  const goToAyah = useCallback((surahNumber: number, ayahNumber: number) => {
    setCurrentSurah(surahNumber);
    setCurrentAyah(ayahNumber);
    loadSurahData(surahNumber);
  }, [loadSurahData]);

  const nextSurah = useCallback(() => {
    if (currentSurah && currentSurah < 114) {
      goToSurah(currentSurah + 1);
    }
  }, [currentSurah, goToSurah]);

  const previousSurah = useCallback(() => {
    if (currentSurah && currentSurah > 1) {
      goToSurah(currentSurah - 1);
    }
  }, [currentSurah, goToSurah]);

  // Bookmarks
  const addBookmark = useCallback((surah: number, ayah: number, note?: string, color?: BookmarkColor) => {
    const surahInfo = surahs.find(s => s.number === surah);
    if (!surahInfo) return;

    const bookmark: Bookmark = {
      id: `${surah}:${ayah}:${Date.now()}`,
      surahNumber: surah,
      ayahNumber: ayah,
      surahName: surahInfo.name,
      timestamp: new Date(),
      note,
      color,
    };

    setBookmarks(prev => {
      const updated = [...prev, bookmark];
      saveBookmarksToLocal(updated);
      return updated;
    });
  }, [surahs, saveBookmarksToLocal]);

  const removeBookmark = useCallback((id: string) => {
    setBookmarks(prev => {
      const updated = prev.filter(b => b.id !== id);
      saveBookmarksToLocal(updated);
      return updated;
    });
  }, [saveBookmarksToLocal]);

  // Last read
  const updateLastRead = useCallback((surah: number, ayah: number) => {
    const surahInfo = surahs.find(s => s.number === surah);
    if (!surahInfo) return;
    
    const lastReadData: LastRead = {
      surahNumber: surah,
      ayahNumber: ayah,
      surahName: surahInfo.name,
      timestamp: new Date(),
    };
    
    setLastRead(lastReadData);
    saveLastReadToLocal(lastReadData);
  }, [surahs, saveLastReadToLocal]);

  // Search
  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/quran/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (data.status === 'success') {
        setSearchResults(data.data.matches || []);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const getSurahDisplayName = useCallback((surahNumber: number | null): string => {
    if (!surahNumber) return 'Quran';
    return surahs.find((s) => s.number === surahNumber)?.englishName || `Surah ${surahNumber}`;
  }, [surahs]);

  const updateNowPlayingMetadata = useCallback((
    surahNumber: number | null,
    ayahNumber: number | null,
    track: 'arabic' | 'translation' | 'bismillah' = 'arabic'
  ) => {
    if (!surahNumber) return;

    const safeAyah = ayahNumber && ayahNumber > 0 ? ayahNumber : 1;
    const surahName = getSurahDisplayName(surahNumber);
    const trackTitle =
      track === 'translation'
        ? `${surahName} - Translation of Ayah ${safeAyah}`
        : track === 'bismillah'
        ? `${surahName} - Bismillah`
        : `${surahName} - Ayah ${safeAyah}`;
    const fullTitle = `${trackTitle} | ${PLAYER_BRAND_TITLE}`;

    document.title = fullTitle;

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: fullTitle,
        artist: track === 'translation' ? 'Quran Translation Audio' : 'Quran Audio',
        album: track === 'translation' ? 'Quran Translation Audio' : 'Quran Audio',
        artwork: [
          { src: '/logo.png', sizes: '96x96', type: 'image/png' },
          { src: '/logo.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png' },
        ],
      });
    }
  }, [getSurahDisplayName, PLAYER_BRAND_TITLE]);

  const clearPrefetchedAyahs = useCallback(() => {
    prefetchedAyahAudioRef.current.forEach((audio) => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    });
    prefetchedAyahAudioRef.current.clear();
    prefetchedAyahFetchRef.current.clear();
    ayahAudioUrlMapRef.current.clear();
  }, []);

  const prefetchUpcomingAyahs = useCallback((fromQueueIndex: number) => {
    if (!isSurahModeRef.current) return;

    const queue = ayahAudioQueueRef.current;
    if (!queue.length) return;

    const endIndex = Math.min(queue.length, fromQueueIndex + PREFETCH_LOOKAHEAD_AYAHS);
    for (let i = fromQueueIndex; i < endIndex; i++) {
      const ayahNumber = queue[i];
      if (prefetchedAyahAudioRef.current.has(ayahNumber)) continue;

      const audioUrl = ayahAudioUrlMapRef.current.get(ayahNumber);
      if (!audioUrl) continue;

      const prefetchAudio = new Audio();
      prefetchAudio.preload = 'auto';
      prefetchAudio.src = audioUrl;
      prefetchAudio.load();
      prefetchedAyahAudioRef.current.set(ayahNumber, prefetchAudio);

      if (!prefetchedAyahFetchRef.current.has(ayahNumber)) {
        prefetchedAyahFetchRef.current.add(ayahNumber);
        void fetch(audioUrl, { cache: 'force-cache' }).catch(() => {
          // Allow retry if this background prefetch request fails.
          prefetchedAyahFetchRef.current.delete(ayahNumber);
        });
      }
    }

    const cleanupBefore = Math.max(0, fromQueueIndex - 1);
    const staleAyahs: number[] = [];
    prefetchedAyahAudioRef.current.forEach((_audio, ayahNumber) => {
      const indexInQueue = queue.indexOf(ayahNumber);
      if (indexInQueue !== -1 && indexInQueue < cleanupBefore) {
        staleAyahs.push(ayahNumber);
      }
    });
    staleAyahs.forEach((ayahNumber) => {
      const staleAudio = prefetchedAyahAudioRef.current.get(ayahNumber);
      if (staleAudio) {
        staleAudio.pause();
        staleAudio.removeAttribute('src');
        staleAudio.load();
      }
      prefetchedAyahAudioRef.current.delete(ayahNumber);
    });
  }, [PREFETCH_LOOKAHEAD_AYAHS]);

  // Initialize or get the persistent Audio element (critical for iOS Safari autoplay chain)
  // iOS Safari only allows .play() on an Audio element that was originally started by a user gesture.
  // Creating new Audio() in the 'ended' handler breaks the chain. Reusing the same element preserves it.
  const initAudioElement = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audioRef.current = audio;

      // Attach persistent event listeners that delegate to latest handlers via refs
      audio.addEventListener('timeupdate', () => handleAudioTimeUpdateFnRef.current());
      audio.addEventListener('loadedmetadata', () => handleAudioTimeUpdateFnRef.current());
      audio.addEventListener('ended', () => handleAudioEndedFnRef.current());
      audio.addEventListener('canplaythrough', () => setIsAudioLoading(false));
      audio.addEventListener('waiting', () => setIsAudioLoading(true));
      audio.addEventListener('playing', () => setIsAudioLoading(false));
      audio.addEventListener('play', () => {
        setIsPlaying(true);
        setIsPaused(false);
      });
      audio.addEventListener('pause', () => {
        if (audio.ended) return;
        setIsPlaying(false);
        if (audio.currentTime > 0) {
          pausedTimeRef.current = audio.currentTime;
          setIsPaused(true);
        }
      });
      audio.addEventListener('error', (e) => {
        console.error('❌ Audio error:', e);
        handleAudioErrorFnRef.current();
      });
    }
    return audioRef.current;
  }, []);

  // Audio playback implementation
  const stopAudio = useCallback(() => {
    console.log('🛑 Stopping audio playback');
    cancelTranslationSpeech();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      // Don't destroy the Audio element - reuse it for iOS autoplay chain compatibility
    }
    setIsPlaying(false);
    setIsPaused(false);
    setIsAudioLoading(false);
    setCurrentPlayingAyah(null);
    setCurrentPlayingSurah(null);
    setCurrentPlaybackTrack(null);
    setCanSeekAudio(true);
    setAudioProgress(0);
    setAudioDuration(0);
    setAudioCurrentTime(0);
    setTotalSurahDuration(0);
    setCumulativeTime(0);
    setAyahAudioQueue([]);
    setCurrentQueueIndex(0);
    setIsSurahMode(false);
    isSurahModeRef.current = false;
    cumulativeTimeRef.current = 0;
    totalSurahDurationRef.current = 0;
    pausedTimeRef.current = 0;
    isBismillahRef.current = false;
    clearPrefetchedAyahs();
    document.title = DEFAULT_QURAN_TITLE;

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
  }, [cancelTranslationSpeech, clearPrefetchedAyahs, DEFAULT_QURAN_TITLE]);

  // Keep stopAudioRef in sync
  useEffect(() => {
    stopAudioRef.current = stopAudio;
  }, [stopAudio]);

  const playAyah = useCallback(async (
    surahNumber: number,
    ayahNumber: number,
    isContinuing: boolean = false,
    preResolvedAudioUrl?: string
  ) => {
    try {
      console.log('🎵 Playing ayah:', surahNumber, ':', ayahNumber, 'isContinuing:', isContinuing);
      cancelTranslationSpeech();
      setIsAudioLoading(true);
      setCurrentPlaybackTrack('arabic');
      setCanSeekAudio(true);

      let audioUrl = preResolvedAudioUrl || ayahAudioUrlMapRef.current.get(ayahNumber);

      // Fallback to endpoint only when queue URL map doesn't have this ayah
      if (!audioUrl) {
        const apiUrl = `${API_URL}/quran/ayah/${surahNumber}:${ayahNumber}?editions=${settings.reciter}`;
        console.log('🎵 Fetching ayah audio from:', apiUrl);

        const response = await fetch(apiUrl);
        const data = await response.json();

        console.log('🎵 API Response:', data);

        if (data.status === 'success' && Array.isArray(data.data) && data.data[0]?.audio) {
          audioUrl = data.data[0].audio;
          ayahAudioUrlMapRef.current.set(ayahNumber, audioUrl);
          console.log('🎵 Audio URL:', audioUrl);
        } else {
          console.error('❌ No audio URL in response:', data);
          console.log('Expected structure: data.data[0].audio');
          console.log('Actual data.data:', data.data);
          return;
        }
      }

      // Reuse persistent Audio element (critical for iOS Safari autoplay chain)
      const audio = initAudioElement();
      audio.pause();
      audio.preload = 'auto';
      audio.src = audioUrl;
      audio.load();

      setCurrentPlayingSurah(surahNumber);
      setCurrentPlayingAyah(ayahNumber);
      updateNowPlayingMetadata(surahNumber, ayahNumber, 'arabic');

      if (isSurahModeRef.current && ayahAudioQueueRef.current.length > 0) {
        const currentIndex = ayahAudioQueueRef.current.indexOf(ayahNumber);
        if (currentIndex >= 0) {
          prefetchUpcomingAyahs(currentIndex + 1);
        }

        const consumedPrefetch = prefetchedAyahAudioRef.current.get(ayahNumber);
        if (consumedPrefetch) {
          consumedPrefetch.pause();
          consumedPrefetch.removeAttribute('src');
          consumedPrefetch.load();
          prefetchedAyahAudioRef.current.delete(ayahNumber);
        }
      }

      // Only set isPlaying when audio actually starts
      audio.play().then(() => {
        setIsPlaying(true);
        console.log('✅ Audio playback started successfully');
      }).catch(error => {
        console.error('❌ Audio playback failed:', error);
        setIsPlaying(false);
        setIsAudioLoading(false);
      });
    } catch (err) {
      console.error('❌ Error playing ayah:', err);
      setIsPlaying(false);
      setIsAudioLoading(false);
    }
  }, [cancelTranslationSpeech, settings.reciter, initAudioElement, prefetchUpcomingAyahs, updateNowPlayingMetadata]);

  const playNextAyahInQueue = useCallback(async (surahNumber: number | null, nextIndex: number) => {
    if (!surahNumber) {
      stopAudio();
      return;
    }

    const nextAyahNumber = ayahAudioQueueRef.current[nextIndex];
    if (!nextAyahNumber) {
      stopAudio();
      return;
    }

    setCurrentQueueIndex(nextIndex);
    currentQueueIndexRef.current = nextIndex;
    await playAyah(surahNumber, nextAyahNumber, true, ayahAudioUrlMapRef.current.get(nextAyahNumber));
  }, [playAyah, stopAudio]);

  const handleTranslationPlaybackFailure = useCallback(async (
    reason: string,
    details?: Record<string, unknown>,
    toastMessage?: string
  ) => {
    const playbackContext = translationPlaybackContextRef.current;

    console.warn(`${TRANSLATION_AUDIO_LOG_PREFIX} Translation audio failed.`, {
      reason,
      ...details,
      playbackContext,
    });

    translationPlaybackContextRef.current = null;
    setIsAudioLoading(false);
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentPlaybackTrack(null);
    setCanSeekAudio(true);

    if (!playbackContext?.continueSurahMode) {
      setCurrentPlayingAyah(null);
      setCurrentPlayingSurah(null);
    }

    if (toastMessage) {
      toast.error(toastMessage);
    }

    if (playbackContext?.continueSurahMode && typeof playbackContext.nextQueueIndex === 'number') {
      await playNextAyahInQueue(playbackContext.surahNumber, playbackContext.nextQueueIndex);
      return;
    }

    if (playbackContext?.continueSurahMode) {
      stopAudio();
    }
  }, [TRANSLATION_AUDIO_LOG_PREFIX, playNextAyahInQueue, stopAudio]);

  const startTranslationPlayback = useCallback(async (
    surahNumber: number,
    ayahNumber: number,
    options?: { continueSurahMode?: boolean; nextQueueIndex?: number | null }
  ) => {
    console.log(`${TRANSLATION_AUDIO_LOG_PREFIX} Translation playback requested.`, {
      surahNumber,
      ayahNumber,
      continueSurahMode: !!options?.continueSurahMode,
      nextQueueIndex: options?.nextQueueIndex ?? null,
      selectedTranslation: settings.selectedTranslations[0] ?? null,
    });

    const selectedTranslationIdentifier = settings.selectedTranslations[0];
    if (!selectedTranslationIdentifier || settings.arabicOnlyMode) {
      console.warn(`${TRANSLATION_AUDIO_LOG_PREFIX} Translation playback aborted before start.`, {
        selectedTranslationIdentifier,
        arabicOnlyMode: settings.arabicOnlyMode,
      });
      return false;
    }

    const translationAudioConfig = getTranslationAudioConfig(selectedTranslationIdentifier);
    if (!translationAudioConfig) {
      console.warn(`${TRANSLATION_AUDIO_LOG_PREFIX} No recorded translation audio source is configured for this translation.`, {
        selectedTranslationIdentifier,
      });
      toast.error('Recorded translation audio is currently available for Urdu - Fateh Muhammad Jalandhry and English - Saheeh International only.');
      return false;
    }

    const translationAudioUrl = getTranslationAudioUrl(selectedTranslationIdentifier, surahNumber, ayahNumber);
    if (!translationAudioUrl) {
      console.warn(`${TRANSLATION_AUDIO_LOG_PREFIX} Failed to construct translation audio URL.`, {
        selectedTranslationIdentifier,
        surahNumber,
        ayahNumber,
      });
      return false;
    }

    cancelTranslationSpeech();
    translationPlaybackContextRef.current = {
      surahNumber,
      ayahNumber,
      continueSurahMode: options?.continueSurahMode,
      nextQueueIndex: options?.nextQueueIndex ?? null,
    };

    const audio = initAudioElement();
    audio.pause();
    audio.preload = 'auto';
    audio.src = translationAudioUrl;
    audio.load();

    setIsAudioLoading(true);
    setCurrentPlaybackTrack('translation');
    setCanSeekAudio(true);
    setCurrentPlayingSurah(surahNumber);
    setCurrentPlayingAyah(ayahNumber);
    updateNowPlayingMetadata(surahNumber, ayahNumber, 'translation');

    console.log(`${TRANSLATION_AUDIO_LOG_PREFIX} Prepared translation audio track.`, {
      surahNumber,
      ayahNumber,
      translationIdentifier: selectedTranslationIdentifier,
      provider: translationAudioConfig.provider,
      label: translationAudioConfig.label,
      translationAudioUrl,
    });

    try {
      console.log(`${TRANSLATION_AUDIO_LOG_PREFIX} Starting translation audio playback.`, {
        surahNumber,
        ayahNumber,
        translationAudioUrl,
      });

      await audio.play();
      return true;
    } catch (error) {
      console.error(`${TRANSLATION_AUDIO_LOG_PREFIX} Translation audio play() failed.`, {
        surahNumber,
        ayahNumber,
        translationAudioUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      await handleTranslationPlaybackFailure(
        'play-promise-rejected',
        {
          surahNumber,
          ayahNumber,
          translationAudioUrl,
          error: error instanceof Error ? error.message : String(error),
        },
        'Translation audio failed to play.'
      );
      return false;
    }
  }, [
    TRANSLATION_AUDIO_LOG_PREFIX,
    cancelTranslationSpeech,
    getTranslationAudioConfig,
    getTranslationAudioUrl,
    handleTranslationPlaybackFailure,
    initAudioElement,
    settings.arabicOnlyMode,
    settings.selectedTranslations,
    updateNowPlayingMetadata,
  ]);

  const playTranslationAyah = useCallback(async (surahNumber: number, ayahNumber: number) => {
    console.log(`${TRANSLATION_AUDIO_LOG_PREFIX} Manual translation playback triggered.`, {
      surahNumber,
      ayahNumber,
      selectedTranslation: settings.selectedTranslations[0] ?? null,
      audioMode: settings.audioMode,
      translationAudioEnabled: settings.translationAudioEnabled,
    });

    const didStartPlayback = await startTranslationPlayback(surahNumber, ayahNumber);

    if (!didStartPlayback) {
      console.warn(`${TRANSLATION_AUDIO_LOG_PREFIX} Manual translation playback request did not start.`);
      setIsAudioLoading(false);
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, [TRANSLATION_AUDIO_LOG_PREFIX, settings.audioMode, settings.selectedTranslations, settings.translationAudioEnabled, startTranslationPlayback]);

  // Play Bismillah separately (for surahs 2-8, 10-114)
  const playBismillah = useCallback(async (surahNumber: number) => {
    try {
      console.log('🎵 Playing Bismillah for Surah', surahNumber);
      cancelTranslationSpeech();
      
      // Store the surah number for continuation after Bismillah
      currentPlayingSurahRef.current = surahNumber;
      isBismillahRef.current = true; // Mark that Bismillah is playing
      isSurahModeRef.current = true; // Set surah mode
      
      // Bismillah audio URL (Mishary Alafasy)
      const bismillahAudioUrl = 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3';
      
      // Reuse persistent Audio element (critical for iOS Safari autoplay chain)
      const audio = initAudioElement();
      audio.pause();
      
      audio.src = bismillahAudioUrl;
      audio.load();
      
      setCurrentPlayingAyah(0); // Mark as Bismillah
      setCurrentPlaybackTrack('bismillah');
      setCanSeekAudio(true);
      updateNowPlayingMetadata(surahNumber, 1, 'bismillah');
      
      // Play
      audio.play().then(() => {
        setIsPlaying(true);
        console.log('✅ Bismillah playback started');
      }).catch(error => {
        console.error('❌ Bismillah playback failed:', error);
        setIsPlaying(false);
        setIsAudioLoading(false);
      });
    } catch (err) {
      console.error('❌ Error playing Bismillah:', err);
      setIsPlaying(false);
      setIsAudioLoading(false);
    }
  }, [cancelTranslationSpeech, initAudioElement, updateNowPlayingMetadata]);

  const playSurah = useCallback(async (surahNumber: number) => {
    try {
      console.log('🎵 Playing complete surah:', surahNumber);
      cancelTranslationSpeech();
      setIsSurahMode(true);
      isSurahModeRef.current = true;
      setCanSeekAudio(true);

      // Stop any current playback (don't destroy the element)
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      setIsAudioLoading(true);

      // Fetch the surah with audio FIRST (before Bismillah)
      // This ensures we have the queue ready when Bismillah ends, preventing autoplay blocks
      const response = await fetch(
        `${API_URL}/quran/surah/${surahNumber}/editions?editions=${settings.reciter}`
      );
      const data = await response.json();

      console.log('🎵 Surah API response:', data);

      if (data.status === 'success' && data.data[0]?.ayahs) {
        const ayahs = data.data[0].ayahs;
        const audioQueue = ayahs.map((ayah: Ayah) => ayah.numberInSurah);
        const audioUrlMap = new Map<number, string>();
        const hasBismillah = surahNumber !== 1 && surahNumber !== 9;
        ayahs.forEach((ayah: Ayah) => {
          if (ayah.audio) {
            audioUrlMap.set(ayah.numberInSurah, ayah.audio);
          }
        });

        console.log('🎵 Audio queue created:', audioQueue);

        // Start with a conservative estimate so the timer does not end before playback.
        const estimatedTotalDuration =
          (ayahs.length + (hasBismillah ? 1 : 0)) * SURAH_DURATION_FALLBACK_PER_AYAH;
        setTotalSurahDuration(estimatedTotalDuration);
        totalSurahDurationRef.current = estimatedTotalDuration;

        setAyahAudioQueue(audioQueue);
        // Important: Update ref immediately for handleAudioEnded
        ayahAudioQueueRef.current = audioQueue;
        ayahAudioUrlMapRef.current = audioUrlMap;
        clearPrefetchedAyahs();
        ayahAudioUrlMapRef.current = audioUrlMap;
        
        setCurrentQueueIndex(0);
        currentQueueIndexRef.current = 0;
        
        setCurrentPlayingSurah(surahNumber);
        setCumulativeTime(0);
        cumulativeTimeRef.current = 0;

        if (
          settings.translationAudioEnabled &&
          !settings.arabicOnlyMode &&
          getTranslationAudioConfig(settings.selectedTranslations[0])
        ) {
          void getSelectedTranslationData(surahNumber).then((translationData) => {
            if (!translationData) return;

            const translationDuration = translationData.ayahs.reduce((total, ayah) => {
              const ayahText = ayah.text?.trim();
              return ayahText ? total + estimateTranslationDuration(ayahText) : total;
            }, 0);

            const updatedTotalDuration = estimatedTotalDuration + translationDuration;
            setTotalSurahDuration(updatedTotalDuration);
            totalSurahDurationRef.current = updatedTotalDuration;
          });
        }

        // For Surah 9 (At-Tawbah), no Bismillah
        // For Surah 1 (Al-Fatiha), Bismillah is part of Ayah 1
        // For other surahs (2-8, 10-114), play Bismillah first
        prefetchUpcomingAyahs(0);

        if (hasBismillah) {
          console.log('🎵 Playing Bismillah first for Surah', surahNumber);
          // Play Bismillah audio first
          await playBismillah(surahNumber);
          // After Bismillah finishes, handleAudioEnded will pick up the queue we just set
          return;
        }

        // Reset Bismillah flag for normal surah playback
        isBismillahRef.current = false;

        // Play first ayah
        if (audioQueue.length > 0) {
          console.log('🎵 Starting with first ayah:', audioQueue[0]);
          await playAyah(surahNumber, audioQueue[0], false, audioUrlMap.get(audioQueue[0]));
        }
      }
    } catch (err) {
      console.error('❌ Error playing surah:', err);
      setIsPlaying(false);
      setIsAudioLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cancelTranslationSpeech,
    clearPrefetchedAyahs,
    estimateTranslationDuration,
    getSelectedTranslationData,
    playAyah,
    playBismillah,
    prefetchUpcomingAyahs,
    settings.arabicOnlyMode,
    settings.reciter,
    settings.translationAudioEnabled,
    settings.selectedTranslations,
    getTranslationAudioConfig,
  ]);

  const pauseAyah = useCallback(() => {
    console.log('⏸️ Pausing audio');
    if (audioRef.current) {
      // Save the current time for resuming
      pausedTimeRef.current = audioRef.current.currentTime;
      audioRef.current.pause();
    }
    setIsPlaying(false);
    setIsPaused(true);
  }, []);

  const resumeAyah = useCallback(() => {
    console.log('▶️ Resuming audio from:', pausedTimeRef.current);
    if (audioRef.current) {
      audioRef.current.currentTime = pausedTimeRef.current;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsPaused(false);
            console.log('✅ Audio resumed successfully');
          })
          .catch(error => {
        console.error('❌ Audio resume failed:', error);
        setIsPlaying(false);
      });
      }
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pauseAyah();
    } else {
      if (currentPlaybackTrack === 'translation' && isPaused) {
        resumeAyah();
        return;
      }

      // If paused, resume; otherwise play current ayah
      if (audioRef.current && pausedTimeRef.current > 0) {
        resumeAyah();
      } else if (audioRef.current && currentPlayingAyah && currentPlayingSurah) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error('Audio playback failed:', error);
          });
        }
        setIsPlaying(true);
      }
    }
  }, [currentPlaybackTrack, isPaused, isPlaying, pauseAyah, resumeAyah, currentPlayingAyah, currentPlayingSurah]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : isPaused ? 'paused' : 'none';
  }, [isPlaying, isPaused]);

  const seekAudio = useCallback((time: number) => {
    if (!audioRef.current || !canSeekAudio) return;

    if (isSurahModeRef.current) {
      const currentTrackDuration = getSafeDuration(audioRef.current.duration, 0);
      const relativeTime = Math.max(0, time - cumulativeTimeRef.current);
      audioRef.current.currentTime = Math.min(relativeTime, currentTrackDuration || relativeTime);
      setAudioCurrentTime(cumulativeTimeRef.current + audioRef.current.currentTime);
      return;
    }

    audioRef.current.currentTime = time;
    setAudioCurrentTime(time);
  }, [canSeekAudio, getSafeDuration]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const mediaSession = navigator.mediaSession;
    const setMediaAction = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null
    ) => {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch (error) {
        // Some browsers do not support every action type.
        console.debug(`Media session action '${action}' not supported`, error);
      }
    };

    setMediaAction('play', () => {
      if (isPaused) {
        resumeAyah();
        return;
      }

      const audio = audioRef.current;
      if (!audio) return;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error('❌ MediaSession play failed:', error);
        });
      }
    });

    setMediaAction('pause', () => {
      pauseAyah();
    });

    setMediaAction('stop', () => {
      stopAudio();
    });

    setMediaAction('seekto', (details) => {
      if (!canSeekAudio) return;
      if (typeof details.seekTime === 'number') {
        seekAudio(details.seekTime);
      }
    });

    setMediaAction('seekforward', (details) => {
      if (!canSeekAudio) return;
      const skip = details.seekOffset ?? 10;
      seekAudio(audioCurrentTime + skip);
    });

    setMediaAction('seekbackward', (details) => {
      if (!canSeekAudio) return;
      const skip = details.seekOffset ?? 10;
      seekAudio(Math.max(0, audioCurrentTime - skip));
    });

    return () => {
      setMediaAction('play', null);
      setMediaAction('pause', null);
      setMediaAction('stop', null);
      setMediaAction('seekto', null);
      setMediaAction('seekforward', null);
      setMediaAction('seekbackward', null);
    };
  }, [audioCurrentTime, canSeekAudio, isPaused, pauseAyah, resumeAyah, seekAudio, stopAudio]);

  const handleAudioError = useCallback(async () => {
    const audioError = audioRef.current?.error;
    const errorDetails = {
      code: audioError?.code ?? null,
      message: audioError?.message ?? null,
      track: currentPlaybackTrackRef.current,
      surahNumber: currentPlayingSurahRef.current,
      ayahNumber: currentPlayingAyah,
    };

    console.error('❌ Audio element error details:', errorDetails);
    setIsAudioLoading(false);

    if (currentPlaybackTrackRef.current === 'translation') {
      await handleTranslationPlaybackFailure(
        'audio-element-error',
        errorDetails,
        'Translation audio file could not be loaded.'
      );
      return;
    }
  }, [currentPlayingAyah, handleTranslationPlaybackFailure]);

  useEffect(() => {
    handleAudioErrorFnRef.current = () => {
      void handleAudioError();
    };
  }, [handleAudioError]);

  // Handle audio events
  const handleAudioTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      const currentTime = audioRef.current.currentTime;
      const duration = audioRef.current.duration;
      
      // For surah mode, project total duration from live playback data.
      if (isSurahModeRef.current) {
        const totalTime = cumulativeTimeRef.current + currentTime;
        const projectedDuration = Math.max(getProjectedSurahDuration(duration), totalTime, 1);
        const queueLength = ayahAudioQueueRef.current.length;
        const remainingAyahs = isBismillahRef.current
          ? queueLength
          : Math.max(0, queueLength - (currentQueueIndexRef.current + 1));
        const rawProgress = (totalTime / projectedDuration) * 100;
        const safeProgress = remainingAyahs > 0 ? Math.min(rawProgress, 99.5) : Math.min(rawProgress, 100);

        console.log('⏱️ Time update (surah mode):', totalTime.toFixed(1), '/', projectedDuration.toFixed(1));
        setAudioCurrentTime(totalTime);
        setAudioDuration(projectedDuration);
        setTotalSurahDuration(projectedDuration);
        totalSurahDurationRef.current = projectedDuration;
        setAudioProgress(safeProgress);
      } else {
        const safeDuration = getSafeDuration(duration, 1);
        console.log('⏱️ Time update (ayah mode):', currentTime.toFixed(1), '/', safeDuration.toFixed(1));
        setAudioCurrentTime(currentTime);
        setAudioDuration(safeDuration);
        setAudioProgress(Math.min((currentTime / safeDuration) * 100, 100));
      }
    }
  }, [getProjectedSurahDuration, getSafeDuration]);

  const handleAudioEnded = useCallback(async () => {
    console.log('🎵 Audio ended - Queue:', ayahAudioQueueRef.current, 'Current Index:', currentQueueIndexRef.current);
    console.log('🎵 Is Surah Mode:', isSurahModeRef.current);
    console.log('🎵 Is Bismillah:', isBismillahRef.current);
    console.log('🎵 Current Playing Surah (ref):', currentPlayingSurahRef.current);
    
    // Check if Bismillah just finished
    if (isBismillahRef.current && isSurahModeRef.current && currentPlayingSurahRef.current) {
      console.log('🎵 Bismillah finished, continuing to ayah 1 of surah', currentPlayingSurahRef.current);
      const introDuration = getSafeDuration(audioRef.current?.duration || 0, 0);
      if (introDuration > 0) {
        const newCumulativeTime = cumulativeTimeRef.current + introDuration;
        setCumulativeTime(newCumulativeTime);
        cumulativeTimeRef.current = newCumulativeTime;
        setAudioCurrentTime(newCumulativeTime);
      }

      isBismillahRef.current = false; // Reset Bismillah flag
      
      const surahNum = currentPlayingSurahRef.current;
      
      // Queue should already be populated by playSurah
      if (ayahAudioQueueRef.current && ayahAudioQueueRef.current.length > 0) {
        // Reset index just in case
        setCurrentQueueIndex(0);
        currentQueueIndexRef.current = 0;
        
        const firstAyah = ayahAudioQueueRef.current[0];
        console.log('🎵 Playing ayah 1 of surah', surahNum, 'from queue:', firstAyah);
        await playAyah(surahNum, firstAyah, true, ayahAudioUrlMapRef.current.get(firstAyah));
      } else {
        console.error('❌ Audio queue is empty after Bismillah!');
        // Fallback or stop
        stopAudio();
      }
      return;
    }

    if (!isSurahModeRef.current || ayahAudioQueueRef.current.length === 0) {
      console.log('🎵 Audio playback complete - stopping');
      stopAudio();
      return;
    }

    const surahNum = currentPlayingSurahRef.current;
    const finishedAyahNumber = currentPlayingAyah;
    const hasNextAyah = currentQueueIndexRef.current < ayahAudioQueueRef.current.length - 1;
    const nextIndex = hasNextAyah ? currentQueueIndexRef.current + 1 : null;

    if (audioRef.current) {
      const finishedTrackDuration = getSafeDuration(audioRef.current.duration, 0);
      const newCumulativeTime = cumulativeTimeRef.current + finishedTrackDuration;
      console.log('🎵 Adding', finishedTrackDuration.toFixed(1), 's to cumulative time:', cumulativeTimeRef.current.toFixed(1), '->', newCumulativeTime.toFixed(1));
      setCumulativeTime(newCumulativeTime);
      cumulativeTimeRef.current = newCumulativeTime;
      setAudioCurrentTime(newCumulativeTime);
    }

    if (currentPlaybackTrackRef.current === 'translation') {
      translationPlaybackContextRef.current = null;

      if (surahNum && typeof nextIndex === 'number') {
        console.log(`${TRANSLATION_AUDIO_LOG_PREFIX} Translation track finished, continuing Arabic queue.`, {
          surahNumber: surahNum,
          nextQueueIndex: nextIndex,
        });
        await playNextAyahInQueue(surahNum, nextIndex);
        return;
      }

      console.log(`${TRANSLATION_AUDIO_LOG_PREFIX} Translation track finished at end of queue.`);
      stopAudio();
      return;
    }

    const shouldPlayTranslation =
      settings.translationAudioEnabled &&
      !settings.arabicOnlyMode &&
      !!getTranslationAudioConfig(settings.selectedTranslations[0]) &&
      !!settings.selectedTranslations[0] &&
      !!surahNum &&
      !!finishedAyahNumber;

    if (shouldPlayTranslation) {
      console.log(`${TRANSLATION_AUDIO_LOG_PREFIX} Auto translation handoff after Arabic ayah.`, {
        surahNumber: surahNum,
        ayahNumber: finishedAyahNumber,
        nextQueueIndex: nextIndex,
        selectedTranslation: settings.selectedTranslations[0],
      });

      const didStartTranslation = await startTranslationPlayback(surahNum, finishedAyahNumber, {
        continueSurahMode: true,
        nextQueueIndex: nextIndex,
      });

      if (didStartTranslation) {
        return;
      }

      console.warn(`${TRANSLATION_AUDIO_LOG_PREFIX} Auto translation handoff did not start; continuing with Arabic queue.`);
    }

    if (surahNum && typeof nextIndex === 'number') {
      await playNextAyahInQueue(surahNum, nextIndex);
      return;
    }

    console.log('🎵 Audio playback complete - stopping');
    stopAudio();
  }, [
    currentPlayingAyah,
    getSafeDuration,
    playAyah,
    playNextAyahInQueue,
    settings.arabicOnlyMode,
    getTranslationAudioConfig,
    settings.selectedTranslations,
    settings.translationAudioEnabled,
    startTranslationPlayback,
    stopAudio,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep handler refs in sync so the persistent audio element's delegated listeners always call latest
  useEffect(() => {
    handleAudioEndedFnRef.current = handleAudioEnded;
  }, [handleAudioEnded]);

  useEffect(() => {
    handleAudioTimeUpdateFnRef.current = handleAudioTimeUpdate;
  }, [handleAudioTimeUpdate]);

  // Stop and reset player when any relevant change occurs
  useEffect(() => {
    if (isPlaying || isPaused) {
      console.log('🛑 Stopping audio due to settings/surah change');
      stopAudio();
    }
    // Reset surah mode flag when audio mode changes
    if (settings.audioMode === 'ayah') {
      setIsSurahMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings.audioMode,
    settings.audioEnabled,
    settings.translationAudioEnabled,
    settings.arabicOnlyMode,
    selectedTranslationsDependency,
    currentSurah,
  ]);

  // Load last read on mount
  useEffect(() => {
    if (lastRead && !currentSurah) {
      goToSurah(lastRead.surahNumber);
    } else if (!currentSurah && surahs.length > 0) {
      // Default to Al-Fatiha
      goToSurah(1);
    }
  }, [lastRead, currentSurah, surahs, goToSurah]);

  // Reload surah when settings that affect data change
  useEffect(() => {
    if (currentSurah && surahData) {
      // Only reload if we already have data loaded (avoid initial double load)
      loadSurahData(currentSurah);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.showTransliteration, settings.arabicOnlyMode, settings.arabicFont, selectedTranslationsDependency]);

  const value: QuranContextType = {
    currentSurah,
    currentAyah,
    surahs,
    surahData,
    translations,
    transliteration,
    loading,
    error,
    settings,
    updateSettings,
    bookmarks,
    lastRead,
    addBookmark,
    removeBookmark,
    updateLastRead,
    goToSurah,
    goToAyah,
    nextSurah,
    previousSurah,
    searchResults,
    search,
    isPlaying,
    isPaused,
    isAudioLoading,
    currentPlayingAyah,
    currentPlayingSurah,
    currentPlaybackTrack,
    canSeekAudio,
    audioProgress,
    audioDuration,
    audioCurrentTime,
    currentQueueIndex,
    totalSurahDuration,
    cumulativeTime,
    playAyah,
    playTranslationAyah,
    pauseAyah,
    resumeAyah,
    stopAyah: stopAudio,
    playSurah,
    togglePlayPause,
    seekAudio,
  };

  return <QuranContext.Provider value={value}>{children}</QuranContext.Provider>;
};

export const useQuran = () => {
  const context = useContext(QuranContext);
  if (!context) {
    throw new Error('useQuran must be used within QuranProvider');
  }
  return context;
};
