import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdjustmentsHorizontalIcon,
  BookOpenIcon,
  BookmarkIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  MoonIcon,
  PlusIcon,
  Squares2X2Icon,
  SunIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';
import PageSEO from '../components/PageSEO';
import { useQuran } from '../contexts/QuranContext';
import { useAuth } from '../hooks/useAuth';
import { API_URL } from '../config';
import { fetchIndopakV3Ayah, fetchIndopakV3Surah } from '../utils/indopakV3Quran';
import { fetchTafsirAyah, fetchTafsirSurah, getTafsirRuntimeIssue } from '../utils/tafsirBayanApi';
import type { TafsirAyah } from '../types/tafsir';
import { BOOKMARK_COLOR_OPTIONS, DEFAULT_TRANSLATIONS, DEFAULT_URDU_TRANSLATION, type BookmarkColor } from '../types/quran';

interface DisplayAyah {
  ayahNumber: number;
  arabicText: string;
  translationText: string;
  translationHtml?: string;
  translationPlain?: string;
  footnotes: Record<string, string>;
  tafsirText: string;
}

interface TranslationSegment {
  type: 'text' | 'footnote';
  value: string;
  footnoteId?: string;
}

type ReaderMode = 'ayah' | 'surah';

const DEFAULT_TEXT_AREA_BG = '#f8fffb';
const DEFAULT_TEXT_AREA_BG_DARK = '#111827';
const DEFAULT_ARABIC_AREA_BG = '#dcfce7';
const DEFAULT_ARABIC_AREA_BG_DARK = '#1f2937';
const DEFAULT_TRANSLATION_AREA_BG = '#ecfdf3';
const DEFAULT_TRANSLATION_AREA_BG_DARK = '#0f172a';
const DEFAULT_TAFSIR_AREA_BG = '#f0fdf4';
const DEFAULT_TAFSIR_AREA_BG_DARK = '#111827';
const DEFAULT_TAFSIR_TEXT_COLOR = '#1f2937';
const DEFAULT_TAFSIR_TEXT_COLOR_DARK = '#f3f4f6';

const AREA_BACKGROUND_OPTIONS = [
  { label: 'Default Gradient', value: '#ecfdf5', swatchClass: 'bg-gradient-to-br from-emerald-50 to-teal-50' },
  { label: 'White', value: '#ffffff', swatchClass: 'bg-white' },
  { label: 'Cream', value: '#fffbeb', swatchClass: 'bg-amber-50' },
  { label: 'Light Blue', value: '#eff6ff', swatchClass: 'bg-blue-50' },
  { label: 'Soft Peach', value: '#fff7ed', swatchClass: 'bg-orange-50' },
];

const TAFSIR_EDITION_OPTIONS = [
  { value: 'bayan-ul-quran-dr-israr-ahmed', label: 'Bayan-ul-Quran by Dr Israr Ahmed' },
  { value: 'tafheem-ul-quran-syed-abu-ala-maududi', label: "Tafheem e Qur'an - Syed Abu Ala Maududi" },
] as const;

const TAFSIR_TEXT_COLOR_OPTIONS = [
  { label: 'Default', value: '#1f2937', textClass: 'text-gray-800' },
  { label: 'Emerald', value: '#059669', textClass: 'text-emerald-600' },
  { label: 'Blue', value: '#2563eb', textClass: 'text-blue-600' },
  { label: 'Amber', value: '#d97706', textClass: 'text-amber-600' },
  { label: 'Rose', value: '#e11d48', textClass: 'text-rose-600' },
];

const FOOTNOTE_SUP_REGEX = /<sup\s+[^>]*foot_note\s*=\s*["']([^"']+)["'][^>]*>(.*?)<\/sup>/gi;

const stripHtml = (value: string): string => value.replace(/<[^>]+>/g, '').trim();

const parseTranslationWithFootnotes = (translationHtml: string): TranslationSegment[] => {
  if (!translationHtml) return [];

  const segments: TranslationSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = FOOTNOTE_SUP_REGEX.exec(translationHtml)) !== null) {
    const [fullMatch, footnoteIdRaw, markerRaw] = match;
    const start = match.index;
    const before = translationHtml.slice(lastIndex, start);

    if (before) {
      const cleanedBefore = stripHtml(before);
      if (cleanedBefore) {
        segments.push({ type: 'text', value: cleanedBefore });
      }
    }

    const marker = stripHtml(markerRaw) || String(segments.filter((item) => item.type === 'footnote').length + 1);
    segments.push({
      type: 'footnote',
      value: marker,
      footnoteId: String(footnoteIdRaw || '').trim(),
    });

    lastIndex = start + fullMatch.length;
  }

  const tail = translationHtml.slice(lastIndex);
  if (tail) {
    const cleanedTail = stripHtml(tail);
    if (cleanedTail) {
      segments.push({ type: 'text', value: cleanedTail });
    }
  }

  return segments;
};

const QuranTafsirBayan: React.FC = () => {
  const configuredInitialLoadingMs = Number(process.env.REACT_APP_TAFSIR_INITIAL_LOADING_MS || '5000');
  const initialLoadingMs = Number.isFinite(configuredInitialLoadingMs) ? configuredInitialLoadingMs : 5000;
  const configuredBookmarkTapCount = Number(process.env.REACT_APP_TAFSIR_BOOKMARK_TAP_COUNT || '2');
  const bookmarkTapCount = Number.isFinite(configuredBookmarkTapCount)
    ? Math.max(1, Math.floor(configuredBookmarkTapCount))
    : 2;
  const configuredBookmarkTapIntervalMs = Number(process.env.REACT_APP_TAFSIR_BOOKMARK_TAP_INTERVAL_MS || '2000');
  const bookmarkTapIntervalMs = Number.isFinite(configuredBookmarkTapIntervalMs)
    ? Math.max(250, Math.floor(configuredBookmarkTapIntervalMs))
    : 2000;

  const { surahs, settings, updateSettings, bookmarks, addBookmark, removeBookmark } = useQuran();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [readerMode, setReaderMode] = useState<ReaderMode>('ayah');
  const [selectedSurah, setSelectedSurah] = useState<number>(1);
  const [selectedAyah, setSelectedAyah] = useState<number>(1);
  const [initialScreenLoading, setInitialScreenLoading] = useState(true);
  const [surahSearch, setSurahSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ayahList, setAyahList] = useState<DisplayAyah[]>([]);
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const [showMobileSurahSearch, setShowMobileSurahSearch] = useState(false);
  const [allowMobileSurahSearchFocus, setAllowMobileSurahSearchFocus] = useState(false);
  const [showMobileSurahPicker, setShowMobileSurahPicker] = useState(false);
  const [showMobileAyahPicker, setShowMobileAyahPicker] = useState(false);
  const [showMobileTranslationPicker, setShowMobileTranslationPicker] = useState(false);
  const [showMobileTafsirPicker, setShowMobileTafsirPicker] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'display' | 'bookmarks'>('display');
  const [pendingBookmarkTarget, setPendingBookmarkTarget] = useState<{ surahNumber: number; ayahNumber: number } | null>(null);
  const [bookmarkConfirm, setBookmarkConfirm] = useState<{
    surahNum: number;
    ayahNum: number;
    x: number;
    y: number;
    note?: string;
    color?: BookmarkColor;
  } | null>(null);
  const [bookmarkModalViewport, setBookmarkModalViewport] = useState<{ height: number; offsetTop: number } | null>(null);
  const readerContentRef = useRef<HTMLDivElement | null>(null);
  const bookmarkViewportRafRef = useRef<number | null>(null);
  const mobileSettingsSwipeStartYRef = useRef<number | null>(null);
  const mobileSettingsSwipeCurrentYRef = useRef<number | null>(null);
  const tapTrackerRef = useRef<{ ayahNum: number | null; count: number; lastAt: number }>({
    ayahNum: null,
    count: 0,
    lastAt: 0,
  });
  const touchGestureRef = useRef<{
    ayahNum: number | null;
    startX: number;
    startY: number;
    moved: boolean;
    startAt: number;
  }>({
    ayahNum: null,
    startX: 0,
    startY: 0,
    moved: false,
    startAt: 0,
  });

  const getScrollBehavior = useCallback((): ScrollBehavior => {
    if (typeof window === 'undefined') return 'auto';
    return window.matchMedia('(max-width: 1023px)').matches ? 'auto' : 'smooth';
  }, []);

  const onMobileSettingsTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    mobileSettingsSwipeStartYRef.current = touch?.clientY ?? null;
    mobileSettingsSwipeCurrentYRef.current = touch?.clientY ?? null;
  }, []);

  const onMobileSettingsTouchMove = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (mobileSettingsSwipeStartYRef.current === null || !touch) return;
    mobileSettingsSwipeCurrentYRef.current = touch.clientY;
  }, []);

  const onMobileSettingsTouchEnd = useCallback(() => {
    if (mobileSettingsSwipeStartYRef.current === null || mobileSettingsSwipeCurrentYRef.current === null) {
      mobileSettingsSwipeStartYRef.current = null;
      mobileSettingsSwipeCurrentYRef.current = null;
      return;
    }

    const deltaY = mobileSettingsSwipeCurrentYRef.current - mobileSettingsSwipeStartYRef.current;
    mobileSettingsSwipeStartYRef.current = null;
    mobileSettingsSwipeCurrentYRef.current = null;

    if (deltaY > 90) {
      setShowMobileSettings(false);
    }
  }, []);

  const activeSurahMeta = useMemo(
    () => surahs.find((surah) => surah.number === selectedSurah),
    [selectedSurah, surahs]
  );

  const ayahOptions = useMemo(() => {
    const count = activeSurahMeta?.numberOfAyahs || 1;
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [activeSurahMeta]);

  const surahOptions = surahs.length
    ? surahs
    : Array.from({ length: 114 }, (_, index) => ({
        number: index + 1,
        name: `Surah ${index + 1}`,
        englishName: `Surah ${index + 1}`,
      }));

  const translationOptions = useMemo(() => {
    return DEFAULT_TRANSLATIONS.filter(
      (translation) => translation.language === 'English' || translation.language === 'Urdu'
    );
  }, []);

  const selectedTranslation = settings.selectedTranslations[0] || DEFAULT_URDU_TRANSLATION.identifier;
  const tafsirEdition = settings.tafsirEdition || 'bayan-ul-quran-dr-israr-ahmed';
  const tafsirFontSize = settings.tafsirFontSize ?? 26;
  const textAreaBackgroundColor = settings.tafsirTextAreaBackground || DEFAULT_TEXT_AREA_BG;
  const tafsirAreaBackgroundColor = settings.tafsirAreaBackground || DEFAULT_TAFSIR_AREA_BG;
  const tafsirTextColor = settings.tafsirTextColor || DEFAULT_TAFSIR_TEXT_COLOR;

  const selectedTranslationMeta = useMemo(() => {
    return translationOptions.find((translation) => translation.identifier === selectedTranslation);
  }, [selectedTranslation, translationOptions]);

  const setSelectedTranslation = useCallback((value: string) => {
    updateSettings({
      selectedTranslations: [value],
      arabicOnlyMode: false,
    });
  }, [updateSettings]);

  const setTafsirEdition = useCallback((value: string) => {
    const matchedOption = TAFSIR_EDITION_OPTIONS.find((option) => option.value === value);
    if (!matchedOption) return;
    updateSettings({ tafsirEdition: matchedOption.value });
  }, [updateSettings]);

  const setTafsirFontSize = useCallback((value: React.SetStateAction<number>) => {
    const resolved = typeof value === 'function' ? value(tafsirFontSize) : value;
    updateSettings({ tafsirFontSize: Math.max(14, Math.min(38, resolved)) });
  }, [tafsirFontSize, updateSettings]);

  const setTextAreaBackgroundColor = useCallback((value: string) => {
    updateSettings({ tafsirTextAreaBackground: value });
  }, [updateSettings]);

  const setTafsirAreaBackgroundColor = useCallback((value: string) => {
    updateSettings({ tafsirAreaBackground: value });
  }, [updateSettings]);

  const setTafsirTextColor = useCallback((value: string) => {
    updateSettings({ tafsirTextColor: value });
  }, [updateSettings]);

  const tafsirEditionLabel = useMemo(() => {
    if (tafsirEdition === 'tafheem-ul-quran-syed-abu-ala-maududi') {
      return "Tafheem e Qur'an - Syed Abu Ala Maududi";
    }
    return 'Bayan-ul-Quran by Dr Israr Ahmed';
  }, [tafsirEdition]);

  const isTafheemEdition = tafsirEdition === 'tafheem-ul-quran-syed-abu-ala-maududi';

  const isTranslationUrdu = selectedTranslationMeta?.language === 'Urdu';

  const filteredSurahs = useMemo(() => {
    return surahs.filter((surah) => {
      const query = surahSearch.trim().toLowerCase();
      if (!query) return true;

      return (
        surah.number.toString().includes(query) ||
        surah.name.includes(surahSearch.trim()) ||
        surah.englishName.toLowerCase().includes(query)
      );
    });
  }, [surahs, surahSearch]);

  const isAyahMode = readerMode === 'ayah';
  const resolvedTextAreaBackground =
    settings.theme === 'dark' && textAreaBackgroundColor === DEFAULT_TEXT_AREA_BG
      ? DEFAULT_TEXT_AREA_BG_DARK
      : textAreaBackgroundColor;
  const resolvedTafsirAreaBackground =
    settings.theme === 'dark' && tafsirAreaBackgroundColor === DEFAULT_TAFSIR_AREA_BG
      ? DEFAULT_TAFSIR_AREA_BG_DARK
      : tafsirAreaBackgroundColor;
  const resolvedTafsirTextColor =
    settings.theme === 'dark' && tafsirTextColor === DEFAULT_TAFSIR_TEXT_COLOR
      ? DEFAULT_TAFSIR_TEXT_COLOR_DARK
      : tafsirTextColor;
  const mobilePrevDisabled = isAyahMode ? selectedAyah <= 1 : selectedSurah <= 1;
  const mobileNextDisabled = isAyahMode
    ? selectedAyah >= ayahOptions.length
    : selectedSurah >= surahOptions.length;

  const handleMobilePrev = useCallback(() => {
    setShowMobileSurahPicker(false);
    setShowMobileAyahPicker(false);

    if (isAyahMode) {
      setSelectedAyah((prev) => Math.max(1, prev - 1));
      return;
    }

    setSelectedSurah((prev) => Math.max(1, prev - 1));
    setSelectedAyah(1);
  }, [isAyahMode]);

  const handleMobileNext = useCallback(() => {
    setShowMobileSurahPicker(false);
    setShowMobileAyahPicker(false);

    if (isAyahMode) {
      setSelectedAyah((prev) => Math.min(ayahOptions.length, prev + 1));
      return;
    }

    setSelectedSurah((prev) => Math.min(surahOptions.length, prev + 1));
    setSelectedAyah(1);
  }, [ayahOptions.length, isAyahMode, surahOptions.length]);

  const isBookmarked = useCallback(
    (surahNum: number, ayahNum: number) => {
      return bookmarks.some((bookmark) => bookmark.surahNumber === surahNum && bookmark.ayahNumber === ayahNum);
    },
    [bookmarks]
  );

  const getBookmarkSwatchClass = useCallback((color: BookmarkColor): string => {
    const swatchMap: Record<BookmarkColor, string> = {
      emerald: 'bg-emerald-600',
      red: 'bg-red-600',
      teal: 'bg-teal-600',
      indigo: 'bg-indigo-600',
      blue: 'bg-blue-600',
      purple: 'bg-purple-600',
      amber: 'bg-amber-600',
      rose: 'bg-rose-600',
    };
    return swatchMap[color] || 'bg-emerald-600';
  }, []);

  const getBookmarkTint = useCallback(
    (color: BookmarkColor) => {
      const tintMap: Record<BookmarkColor, { light: string; dark: string; border: string }> = {
        emerald: { light: '16, 185, 129', dark: '16, 185, 129', border: '16, 185, 129' },
        red: { light: '220, 38, 38', dark: '248, 113, 113', border: '220, 38, 38' },
        teal: { light: '13, 148, 136', dark: '45, 212, 191', border: '13, 148, 136' },
        indigo: { light: '79, 70, 229', dark: '129, 140, 248', border: '79, 70, 229' },
        blue: { light: '37, 99, 235', dark: '96, 165, 250', border: '37, 99, 235' },
        purple: { light: '147, 51, 234', dark: '196, 181, 253', border: '147, 51, 234' },
        amber: { light: '217, 119, 6', dark: '251, 191, 36', border: '217, 119, 6' },
        rose: { light: '225, 29, 72', dark: '251, 113, 133', border: '225, 29, 72' },
      };
      return tintMap[color] || tintMap.emerald;
    },
    []
  );

  const getBookmarkBlockStyle = useCallback(
    (color: BookmarkColor | undefined, opacityLight: number, opacityDark: number): React.CSSProperties | undefined => {
      if (!color) return undefined;
      const tint = getBookmarkTint(color);
      const isDark = settings.theme === 'dark';

      return {
        backgroundColor: `rgba(${isDark ? tint.dark : tint.light}, ${isDark ? opacityDark : opacityLight})`,
        borderColor: `rgba(${tint.border}, ${isDark ? 0.65 : 0.35})`,
      };
    },
    [getBookmarkTint, settings.theme]
  );

  const getBookmarkByAyah = useCallback(
    (ayahNum: number) => {
      return bookmarks.find((bookmark) => bookmark.surahNumber === selectedSurah && bookmark.ayahNumber === ayahNum);
    },
    [bookmarks, selectedSurah]
  );

  const getRenderBlockStyle = useCallback(
    (
      bookmarkColor: BookmarkColor | undefined,
      defaultBackgroundColorLight: string,
      defaultBackgroundColorDark: string,
      bookmarkOpacityLight: number,
      bookmarkOpacityDark: number
    ): React.CSSProperties => {
      const bookmarkStyle = getBookmarkBlockStyle(bookmarkColor, bookmarkOpacityLight, bookmarkOpacityDark);
      if (bookmarkStyle) {
        return bookmarkStyle;
      }

      return {
        backgroundColor: settings.theme === 'dark' ? defaultBackgroundColorDark : defaultBackgroundColorLight,
        borderColor: settings.theme === 'dark' ? 'rgba(75, 85, 99, 0.7)' : 'rgba(16, 185, 129, 0.24)',
      };
    },
    [getBookmarkBlockStyle, settings.theme]
  );

  const handleReaderModeChange = useCallback(
    (mode: ReaderMode) => {
      if (mode === readerMode) return;

      setLoading(true);
      setError(null);
      setAyahList([]);
      setPendingBookmarkTarget(null);
      setShowMobileSurahPicker(false);
      setShowMobileAyahPicker(false);

      if (mode === 'ayah') {
        setSelectedAyah(1);
      }

      setReaderMode(mode);

      const behavior = getScrollBehavior();

      if (readerContentRef.current) {
        readerContentRef.current.scrollIntoView({ behavior, block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior });
      }
    },
    [getScrollBehavior, readerMode]
  );

  const registerBookmarkTap = useCallback(
    (event: React.TouchEvent, ayahNum: number) => {
      const now = Date.now();
      const tracker = tapTrackerRef.current;

      if (tracker.ayahNum === ayahNum && now - tracker.lastAt <= bookmarkTapIntervalMs) {
        tracker.count += 1;
      } else {
        tracker.ayahNum = ayahNum;
        tracker.count = 1;
      }

      tracker.lastAt = now;

      if (tracker.count >= bookmarkTapCount) {
        const touch = event.changedTouches[0] || event.touches[0];
        const x = touch?.clientX ?? window.innerWidth / 2;
        const y = touch?.clientY ?? window.innerHeight / 2;

        setBookmarkConfirm({
          surahNum: selectedSurah,
          ayahNum,
          x,
          y,
        });

        tracker.count = 0;
        tracker.ayahNum = null;
      }
    },
    [bookmarkTapCount, bookmarkTapIntervalMs, selectedSurah]
  );

  const beginBookmarkGesture = useCallback((event: React.TouchEvent, ayahNum: number) => {
    const touch = event.touches[0];
    touchGestureRef.current = {
      ayahNum,
      startX: touch?.clientX ?? 0,
      startY: touch?.clientY ?? 0,
      moved: false,
      startAt: Date.now(),
    };
  }, []);

  const trackBookmarkGestureMove = useCallback((event: React.TouchEvent, ayahNum: number) => {
    const gesture = touchGestureRef.current;
    if (gesture.ayahNum !== ayahNum) return;

    const touch = event.touches[0];
    if (!touch) return;

    const deltaX = Math.abs(touch.clientX - gesture.startX);
    const deltaY = Math.abs(touch.clientY - gesture.startY);
    if (deltaX > 12 || deltaY > 12) {
      gesture.moved = true;
    }
  }, []);

  const finishBookmarkGesture = useCallback(
    (event: React.TouchEvent, ayahNum: number) => {
      const gesture = touchGestureRef.current;
      if (gesture.ayahNum !== ayahNum) return;

      const durationMs = Date.now() - gesture.startAt;
      const isStaticTap = !gesture.moved && durationMs <= 450;

      touchGestureRef.current = {
        ayahNum: null,
        startX: 0,
        startY: 0,
        moved: false,
        startAt: 0,
      };

      if (!isStaticTap) return;
      registerBookmarkTap(event, ayahNum);
    },
    [registerBookmarkTap]
  );

  const cancelBookmarkGesture = useCallback(() => {
    touchGestureRef.current = {
      ayahNum: null,
      startX: 0,
      startY: 0,
      moved: false,
      startAt: 0,
    };
  }, []);

  const confirmBookmark = useCallback(() => {
    if (!bookmarkConfirm) return;

    if (!isBookmarked(bookmarkConfirm.surahNum, bookmarkConfirm.ayahNum) && !bookmarkConfirm.color) {
      alert('Please select a highlight color for your bookmark.');
      return;
    }

    if (isBookmarked(bookmarkConfirm.surahNum, bookmarkConfirm.ayahNum)) {
      const existing = bookmarks.find(
        (bookmark) =>
          bookmark.surahNumber === bookmarkConfirm.surahNum && bookmark.ayahNumber === bookmarkConfirm.ayahNum
      );
      if (existing) removeBookmark(existing.id);
    } else {
      addBookmark(bookmarkConfirm.surahNum, bookmarkConfirm.ayahNum, bookmarkConfirm.note, bookmarkConfirm.color);
    }

    setBookmarkConfirm(null);
  }, [addBookmark, bookmarkConfirm, bookmarks, isBookmarked, removeBookmark]);

  const navigateToBookmark = useCallback(
    (surahNumber: number, ayahNumber: number, closeMobile = false) => {
      if (readerMode === 'ayah') {
        setSelectedSurah(surahNumber);
        setSelectedAyah(ayahNumber);
      } else {
        setSelectedSurah(surahNumber);
        setPendingBookmarkTarget({ surahNumber, ayahNumber });
      }

      if (closeMobile) {
        setShowMobileSettings(false);
      }
    },
    [readerMode]
  );

  const fetchTranslationMap = useCallback(async (surahNumber: number, translationIdentifier: string) => {
    const parseTranslationPayload = (payload: any) => {
      const translationSurah = Array.isArray(payload.data) ? payload.data[0] : payload.data;
      const map = new Map<number, string>();

      (translationSurah?.ayahs || []).forEach((ayah: any) => {
        const ayahNo = Number(ayah.numberInSurah || ayah.ayah || 0);
        if (!ayahNo) return;
        map.set(ayahNo, String(ayah.text || ''));
      });

      return map;
    };

    try {
      const response = await fetch(
        `${API_URL}/quran/surah/${surahNumber}/editions?editions=${encodeURIComponent(translationIdentifier)}`
      );

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({ message: 'Failed to load Urdu translation' }));
        throw new Error(errorPayload.message || 'Failed to load Urdu translation');
      }

      const payload = await response.json();
      if (payload.status !== 'success') {
        throw new Error(payload.message || 'Failed to load Urdu translation');
      }

      return parseTranslationPayload(payload);
    } catch (backendError: any) {
      // Fallback: fetch translation directly from AlQuran Cloud if backend editions route fails.
      const fallbackResponse = await fetch(
        `https://api.alquran.cloud/v1/surah/${surahNumber}/editions/${encodeURIComponent(translationIdentifier)}`
      );

      if (!fallbackResponse.ok) {
        throw new Error(
          backendError?.message || 'Failed to load Urdu translation from both backend and fallback source'
        );
      }

      const fallbackPayload = await fallbackResponse.json();
      if (fallbackPayload.code !== 200 || !fallbackPayload.data) {
        throw new Error(
          backendError?.message || fallbackPayload?.status || 'Failed to load Urdu translation from fallback source'
        );
      }

      return parseTranslationPayload({ data: fallbackPayload.data });
    }
  }, []);

  const buildDisplayAyahs = useCallback(async () => {
    const surahNumber = selectedSurah;
    const translationIdentifier = selectedTranslation;
    const selectedTafsirEdition = tafsirEdition;

    if (readerMode === 'ayah') {
      const [arabicAyah, translationMap, tafsirAyah] = await Promise.all([
        fetchIndopakV3Ayah(surahNumber, selectedAyah),
        fetchTranslationMap(surahNumber, translationIdentifier),
        fetchTafsirAyah(surahNumber, selectedAyah, selectedTafsirEdition),
      ]);

      const derivedArabicText =
        arabicAyah.text || (Array.isArray(arabicAyah.words) ? arabicAyah.words.map((word) => word.text).join(' ') : '');

      return [
        {
          ayahNumber: tafsirAyah.ayah,
          arabicText: derivedArabicText,
          translationText: tafsirAyah.translationPlain || stripHtml(tafsirAyah.translationHtml || '') || translationMap.get(tafsirAyah.ayah) || '',
          translationHtml: tafsirAyah.translationHtml,
          translationPlain: tafsirAyah.translationPlain,
          footnotes: tafsirAyah.footnotes || {},
          tafsirText: tafsirAyah.text,
        },
      ];
    }

    const [arabicSurah, translationMap, tafsirSurah] = await Promise.all([
      fetchIndopakV3Surah(surahNumber),
      fetchTranslationMap(surahNumber, translationIdentifier),
      fetchTafsirSurah(surahNumber, selectedTafsirEdition),
    ]);

    const arabicMap = new Map<number, string>();
    arabicSurah.ayahs.forEach((ayah) => {
      const text = ayah.text || (Array.isArray(ayah.words) ? ayah.words.map((word) => word.text).join(' ') : '');
      arabicMap.set(ayah.ayah, text);
    });

    const tafsirAyahs: TafsirAyah[] = tafsirSurah.ayahs;
    if (tafsirAyahs.length === 0) {
      throw new Error('No tafsir data found for this Surah');
    }

    return tafsirAyahs
      .sort((first, second) => first.ayah - second.ayah)
      .map((ayah) => ({
        ayahNumber: ayah.ayah,
        arabicText: arabicMap.get(ayah.ayah) || '',
        translationText: ayah.translationPlain || stripHtml(ayah.translationHtml || '') || translationMap.get(ayah.ayah) || '',
        translationHtml: ayah.translationHtml,
        translationPlain: ayah.translationPlain,
        footnotes: ayah.footnotes || {},
        tafsirText: ayah.text,
      }));
  }, [fetchTranslationMap, readerMode, selectedAyah, selectedSurah, selectedTranslation, tafsirEdition]);

  const handleFetch = useCallback(
    async () => {
      const runtimeIssue = getTafsirRuntimeIssue();
      if (runtimeIssue) {
        setError(runtimeIssue);
        setLoading(false);
        return;
      }

      if (selectedSurah < 1 || selectedSurah > 114) {
        setError('Please select a valid Surah number (1-114).');
        return;
      }

      if (readerMode === 'ayah' && (selectedAyah < 1 || selectedAyah > (activeSurahMeta?.numberOfAyahs || 286))) {
        setError('Please enter a valid ayah number.');
        return;
      }

      setLoading(true);
      setError(null);
      setAyahList([]);

      try {
        const displayAyahs = await buildDisplayAyahs();
        setAyahList(displayAyahs);
      } catch (err: any) {
        setError(err.message || 'Failed to load tafsir. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [activeSurahMeta?.numberOfAyahs, buildDisplayAyahs, readerMode, selectedAyah, selectedSurah]
  );

  useEffect(() => {
    void handleFetch();
  }, [handleFetch]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setInitialScreenLoading(false);
    }, initialLoadingMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [initialLoadingMs]);

  useEffect(() => {
    if (selectedAyah > (activeSurahMeta?.numberOfAyahs || 1)) {
      setSelectedAyah(1);
    }
  }, [activeSurahMeta?.numberOfAyahs, selectedAyah]);

  useEffect(() => {
    setShowMobileSurahPicker(false);
    setShowMobileAyahPicker(false);
  }, [isAyahMode]);

  useEffect(() => {
    if (!bookmarkConfirm) {
      setBookmarkModalViewport(null);
      return;
    }

    const vv = window.visualViewport;
    const updateViewport = () => {
      if (vv) {
        setBookmarkModalViewport({ height: vv.height, offsetTop: vv.offsetTop });
      } else {
        setBookmarkModalViewport({ height: window.innerHeight, offsetTop: 0 });
      }
    };

    const requestViewportUpdate = () => {
      if (bookmarkViewportRafRef.current !== null) return;
      bookmarkViewportRafRef.current = window.requestAnimationFrame(() => {
        updateViewport();
        bookmarkViewportRafRef.current = null;
      });
    };

    updateViewport();
    vv?.addEventListener('resize', requestViewportUpdate);
    vv?.addEventListener('scroll', requestViewportUpdate);
    window.addEventListener('resize', requestViewportUpdate);

    return () => {
      vv?.removeEventListener('resize', requestViewportUpdate);
      vv?.removeEventListener('scroll', requestViewportUpdate);
      window.removeEventListener('resize', requestViewportUpdate);
      if (bookmarkViewportRafRef.current !== null) {
        window.cancelAnimationFrame(bookmarkViewportRafRef.current);
        bookmarkViewportRafRef.current = null;
      }
    };
  }, [bookmarkConfirm]);

  useEffect(() => {
    if (!showMobileSettings || settingsTab !== 'display') {
      setShowMobileTranslationPicker(false);
      setShowMobileTafsirPicker(false);
    }
  }, [settingsTab, showMobileSettings]);

  useEffect(() => {
    if (authLoading || isAuthenticated) return;
    if (typeof window === 'undefined') return;

    // Set Urdu default only for first-time guest users; keep any saved guest preference untouched.
    const hasGuestSettings = Boolean(localStorage.getItem('quranSettings:guest'));
    if (hasGuestSettings) return;

    if (selectedTranslation !== DEFAULT_URDU_TRANSLATION.identifier) {
      setSelectedTranslation(DEFAULT_URDU_TRANSLATION.identifier);
    }
  }, [authLoading, isAuthenticated, selectedTranslation, setSelectedTranslation]);

  useEffect(() => {
    if (!pendingBookmarkTarget) return;
    if (readerMode !== 'surah') {
      setPendingBookmarkTarget(null);
      return;
    }
    if (loading) return;
    if (selectedSurah !== pendingBookmarkTarget.surahNumber) return;

    const timeoutId = window.setTimeout(() => {
      const targetElement = document.getElementById(`bayan-ayah-${pendingBookmarkTarget.ayahNumber}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: getScrollBehavior(), block: 'center' });
        setPendingBookmarkTarget(null);
      }
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [ayahList, getScrollBehavior, loading, pendingBookmarkTarget, readerMode, selectedSurah]);

  const renderedAyahCards = useMemo(
    () =>
      ayahList.map((ayah) => (
        <article
          key={ayah.ayahNumber}
          id={`bayan-ayah-${ayah.ayahNumber}`}
          className={`rounded-lg shadow-md border p-4 sm:p-5 ${settings.theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
          style={{
            backgroundColor: resolvedTextAreaBackground,
            borderColor: settings.theme === 'dark' ? '#374151' : '#d1d5db',
          }}
        >
          {(() => {
            const bookmark = getBookmarkByAyah(ayah.ayahNumber);
            const translationSegments = parseTranslationWithFootnotes(ayah.translationHtml || '');
            const hasFootnoteMarkers = translationSegments.some(
              (segment) => segment.type === 'footnote' && segment.footnoteId
            );
            const fallbackFootnotes = Object.entries(ayah.footnotes || {}).map(([footnoteId, text], index) => ({
              footnoteId,
              marker: String(index + 1),
              text,
            }));
            const markerPairs = translationSegments
              .filter((segment): segment is TranslationSegment & { footnoteId: string } => segment.type === 'footnote' && Boolean(segment.footnoteId))
              .map((segment) => ({
                footnoteId: segment.footnoteId,
                marker: segment.value,
                text: ayah.footnotes?.[segment.footnoteId] || '',
              }))
              .filter((item) => item.text);
            const visibleFootnotes = markerPairs.length ? markerPairs : fallbackFootnotes;
            const footnoteTargetMap = new Map(
              visibleFootnotes.map((note) => [
                note.footnoteId,
                `tafheem-footnote-${selectedSurah}-${ayah.ayahNumber}-${note.footnoteId}`,
              ])
            );

            return (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${settings.theme === 'dark' ? 'bg-emerald-900 text-emerald-200' : 'bg-emerald-100 text-emerald-700'}`}>
                    Ayah {ayah.ayahNumber}
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setBookmarkConfirm({
                        surahNum: selectedSurah,
                        ayahNum: ayah.ayahNumber,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                      isBookmarked(selectedSurah, ayah.ayahNumber)
                        ? settings.theme === 'dark'
                          ? 'bg-amber-900/70 text-amber-200'
                          : 'bg-amber-100 text-amber-700'
                        : settings.theme === 'dark'
                        ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    aria-label={isBookmarked(selectedSurah, ayah.ayahNumber) ? 'Edit or remove bookmark' : 'Save bookmark'}
                    title={isBookmarked(selectedSurah, ayah.ayahNumber) ? 'Edit or remove bookmark' : 'Save bookmark'}
                  >
                    <BookmarkIcon className="h-3.5 w-3.5" />
                    {isBookmarked(selectedSurah, ayah.ayahNumber) ? 'Bookmarked' : 'Save'}
                  </button>
                </div>

                <div
                  className="mb-3 rounded-xl p-4 border"
                  style={getRenderBlockStyle(
                    bookmark?.color,
                    DEFAULT_ARABIC_AREA_BG,
                    DEFAULT_ARABIC_AREA_BG_DARK,
                    0.18,
                    0.28
                  )}
                >
                  <p
                    dir="rtl"
                    lang="ar"
                    style={{
                      fontSize: `${settings.fontSize}px`,
                      textRendering: 'optimizeLegibility',
                      fontVariantLigatures: 'common-ligatures contextual',
                      fontFeatureSettings: '"liga" 1, "clig" 1, "calt" 1, "mark" 1, "mkmk" 1',
                      WebkitTextSizeAdjust: '100%'
                    }}
                    className={`font-indopak-nastaleeq-v3 leading-[2.8] text-right tracking-normal whitespace-pre-wrap ${settings.theme === 'dark' ? 'text-gray-100' : 'text-black'}`}
                    onTouchStart={(event) => beginBookmarkGesture(event, ayah.ayahNumber)}
                    onTouchMove={(event) => trackBookmarkGestureMove(event, ayah.ayahNumber)}
                    onTouchEnd={(event) => finishBookmarkGesture(event, ayah.ayahNumber)}
                    onTouchCancel={cancelBookmarkGesture}
                  >
                    {ayah.arabicText || 'Ayah text unavailable in IndoPak source.'}
                  </p>
                </div>

                <div
                  className="mb-3 rounded-xl p-4 border"
                  style={getRenderBlockStyle(
                    bookmark?.color,
                    DEFAULT_TRANSLATION_AREA_BG,
                    DEFAULT_TRANSLATION_AREA_BG_DARK,
                    0.1,
                    0.2
                  )}
                >
                  <h3 className={`mb-2 text-sm font-semibold ${settings.theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'}`}>
                    Urdu Translation
                  </h3>
                  <p
                    dir={isTranslationUrdu ? 'rtl' : 'ltr'}
                    style={{ fontSize: `${settings.translationFontSize}px` }}
                    className={`${isTranslationUrdu ? 'quran-urdu-translation font-jameel-noori text-right' : 'text-left leading-8'} ${settings.theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}
                    onTouchStart={(event) => beginBookmarkGesture(event, ayah.ayahNumber)}
                    onTouchMove={(event) => trackBookmarkGestureMove(event, ayah.ayahNumber)}
                    onTouchEnd={(event) => finishBookmarkGesture(event, ayah.ayahNumber)}
                    onTouchCancel={cancelBookmarkGesture}
                  >
                    {hasFootnoteMarkers
                      ? translationSegments.map((segment, segmentIndex) => {
                          if (segment.type === 'text') {
                            return <span key={`segment-${ayah.ayahNumber}-${segmentIndex}`}>{segment.value} </span>;
                          }

                          const targetId = segment.footnoteId ? footnoteTargetMap.get(segment.footnoteId) : undefined;

                          if (!targetId) {
                            return (
                              <span
                                key={`segment-${ayah.ayahNumber}-${segmentIndex}`}
                                className="mx-0.5 align-super text-xs font-bold leading-none text-emerald-700"
                              >
                                {segment.value}
                              </span>
                            );
                          }

                          return (
                            <button
                              type="button"
                              key={`segment-${ayah.ayahNumber}-${segmentIndex}`}
                              className="mx-0.5 align-super text-xs font-bold leading-none text-emerald-700 underline underline-offset-2 hover:text-emerald-500"
                              aria-label={`Go to footnote ${segment.value} for ayah ${ayah.ayahNumber}`}
                              onClick={() => {
                                const target = document.getElementById(targetId);
                                if (target) {
                                  target.scrollIntoView({ behavior: getScrollBehavior(), block: 'center' });
                                }
                              }}
                            >
                              {segment.value}
                            </button>
                          );
                        })
                      : ayah.translationText || 'Translation unavailable for selected edition.'}
                  </p>
                </div>

                <div
                  className="rounded-xl p-4 border"
                  style={getRenderBlockStyle(
                    bookmark?.color,
                    tafsirAreaBackgroundColor,
                    resolvedTafsirAreaBackground,
                    0.14,
                    0.24
                  )}
                >
                  <h3 className={`mb-2 text-sm font-semibold ${settings.theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'}`}>
                    {tafsirEditionLabel}
                  </h3>
                  {isTafheemEdition && visibleFootnotes.length > 0 ? (
                    <div className="space-y-3" dir="rtl" lang="ur">
                      {visibleFootnotes.map((note) => (
                        <div
                          key={`${ayah.ayahNumber}-${note.footnoteId}`}
                          id={`tafheem-footnote-${selectedSurah}-${ayah.ayahNumber}-${note.footnoteId}`}
                          className={`rounded-md border px-3 py-3 ${settings.theme === 'dark' ? 'border-gray-700 bg-gray-900/40' : 'border-emerald-100 bg-white/70'}`}
                          onTouchStart={(event) => beginBookmarkGesture(event, ayah.ayahNumber)}
                          onTouchMove={(event) => trackBookmarkGestureMove(event, ayah.ayahNumber)}
                          onTouchEnd={(event) => finishBookmarkGesture(event, ayah.ayahNumber)}
                          onTouchCancel={cancelBookmarkGesture}
                        >
                          <p
                            style={{
                              fontSize: `${tafsirFontSize}px`,
                              lineHeight: 2.2,
                              color: resolvedTafsirTextColor,
                            }}
                            className="font-alvi-nastaleeq text-right"
                          >
                            <span className={`ml-2 font-semibold ${settings.theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'}`}>
                              [{note.marker}]
                            </span>
                            {note.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p
                      dir="rtl"
                      lang="ur"
                      style={{
                        fontSize: `${tafsirFontSize}px`,
                        textAlign: 'justify',
                        textJustify: 'inter-word',
                        lineHeight: 2.2,
                        wordSpacing: '0.03em',
                        overflowWrap: 'normal',
                        wordBreak: 'normal',
                        fontVariantLigatures: 'common-ligatures contextual',
                        fontFeatureSettings: '"liga" 1, "clig" 1, "calt" 1, "mark" 1, "mkmk" 1',
                        color: resolvedTafsirTextColor,
                      }}
                      className="quran-urdu-tafsir font-alvi-nastaleeq"
                      onTouchStart={(event) => beginBookmarkGesture(event, ayah.ayahNumber)}
                      onTouchMove={(event) => trackBookmarkGestureMove(event, ayah.ayahNumber)}
                      onTouchEnd={(event) => finishBookmarkGesture(event, ayah.ayahNumber)}
                      onTouchCancel={cancelBookmarkGesture}
                    >
                      {ayah.tafsirText || 'Tafsir unavailable for selected edition.'}
                    </p>
                  )}
                </div>
              </>
            );
          })()}
        </article>
      )),
    [
      ayahList,
      beginBookmarkGesture,
      cancelBookmarkGesture,
      getBookmarkByAyah,
      getRenderBlockStyle,
      finishBookmarkGesture,
      getScrollBehavior,
      isBookmarked,
      isTafheemEdition,
      isTranslationUrdu,
      settings.fontSize,
      settings.theme,
      settings.translationFontSize,
      resolvedTafsirAreaBackground,
      resolvedTafsirTextColor,
      resolvedTextAreaBackground,
      selectedSurah,
      tafsirAreaBackgroundColor,
      tafsirEditionLabel,
      tafsirFontSize,
      trackBookmarkGestureMove,
    ]
  );

  return (
    <>
      <PageSEO
        title="Urdu Tafsir Reader | HikmahSphere"
        description="Read Quran with Urdu translation and tafsir in a focused, responsive reader with footnote support."
        path="/quran/tafsir"
        keywords={['urdu tafsir', 'tafheem ul quran', 'bayan ul quran', 'quran tafsir']}
      />

      {initialScreenLoading && (
        <div className={`fixed inset-0 z-[80] flex items-center justify-center px-5 ${settings.theme === 'dark' ? 'bg-gray-900' : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50'}`}>
          <div className={`w-full max-w-md rounded-2xl border shadow-xl p-6 text-center ${settings.theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-emerald-100'}`}>
            <div className="mb-4">
              <LoadingSpinner size="md" text="" />
            </div>
            <h2 className={`text-lg font-semibold mb-2 ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Preparing Tafsir Experience
            </h2>
            <p className={`text-sm leading-6 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              We are loading the complete Quran with Surah details, Arabic ayat, translation, and tafsir. Please wait a moment.
            </p>
            <p className={`mt-2 text-xs ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Initial warm-up may take a few seconds depending on network speed.
            </p>
          </div>
        </div>
        )}

        {!initialScreenLoading && (
        <div className={`min-h-screen ${settings.theme === 'dark' ? 'bg-gray-900' : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50'}`}>
        <div className="w-full">
          <div className="hidden lg:block text-center mb-3 pt-14">
            <div className="flex items-center justify-center gap-2 mb-1">
              <BookOpenIcon className="h-5 w-5 text-emerald-600" />
              <h1 className={`text-2xl font-bold ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {tafsirEditionLabel}
              </h1>
            </div>
            <p className={`text-xs ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Ayah, Urdu translation, and tafsir together in one reading flow
            </p>
          </div>

          <div className="lg:hidden pt-2 px-2 sticky top-16 z-40">
            <div className={`${settings.theme === 'dark' ? 'bg-gray-800/95 border-gray-700' : 'bg-white/95 border-gray-100'} backdrop-blur-none lg:backdrop-blur-md rounded-xl shadow-lg border p-2`}>
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-1 mb-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowMobileSettings(true)}
                    className={`h-8 w-8 rounded-lg flex items-center justify-center ${settings.theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-emerald-700'}`}
                    aria-label="Open settings"
                    title="Settings"
                  >
                    <AdjustmentsHorizontalIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => updateSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })}
                    className={`h-8 w-8 rounded-lg flex items-center justify-center ${settings.theme === 'dark' ? 'bg-gray-700 text-blue-300' : 'bg-gray-100 text-indigo-600'}`}
                    aria-label="Toggle theme"
                    title="Theme"
                  >
                    {settings.theme === 'light' ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
                  </button>
                </div>

                <div className="min-w-0 flex items-center justify-center gap-1.5">
                  <BookOpenIcon className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                  <h1 className={`text-base font-bold leading-none truncate ${settings.theme === 'dark' ? 'text-white' : 'text-gray-800'}`} style={{ fontFamily: 'Lora, serif' }}>
                    {isTafheemEdition ? 'Tafheem e Qur\'an' : 'Bayan-ul-Quran'}
                  </h1>
                </div>

                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => handleReaderModeChange(readerMode === 'ayah' ? 'surah' : 'ayah')}
                    className={`h-8 w-8 rounded-lg flex items-center justify-center ${settings.theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
                    aria-label="Toggle reader mode"
                    title={readerMode === 'ayah' ? 'Ayat by Ayat' : 'Complete Surah'}
                  >
                    <BookOpenIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setAllowMobileSurahSearchFocus(false);
                      setShowMobileSurahSearch(true);
                    }}
                    className={`h-8 w-8 rounded-lg flex items-center justify-center ${settings.theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-emerald-700'}`}
                    aria-label="Open surah search"
                    title="Search Surah"
                  >
                    <MagnifyingGlassIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 mb-1.5">
                <button
                  onClick={handleMobilePrev}
                  disabled={mobilePrevDisabled}
                  className={`h-10 w-10 rounded-lg flex items-center justify-center ${mobilePrevDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${settings.theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-500'}`}
                  aria-label="Previous"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>

                <div className={`flex-1 h-10 rounded-lg border overflow-hidden ${settings.theme === 'dark' ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}`}>
                  {isAyahMode ? (
                    <div className="grid grid-cols-12 h-full">
                      <div className="col-span-7 px-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowMobileSurahPicker((prev) => !prev);
                            setShowMobileAyahPicker(false);
                          }}
                          className={`w-full h-full bg-transparent text-xs font-semibold border-0 focus:ring-0 flex items-center justify-between ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                        >
                          <span className="truncate">{selectedSurah}. {activeSurahMeta?.englishName || 'Surah'}</span>
                          <ChevronDownIcon className="h-3.5 w-3.5 flex-shrink-0" />
                        </button>
                      </div>
                      <div className={`col-span-5 border-l px-2 ${settings.theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowMobileAyahPicker((prev) => !prev);
                            setShowMobileSurahPicker(false);
                          }}
                          className={`w-full h-full bg-transparent text-xs border-0 focus:ring-0 flex items-center justify-between ${settings.theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}
                        >
                          <span className="truncate">Ayah {selectedAyah}</span>
                          <ChevronDownIcon className="h-3.5 w-3.5 flex-shrink-0" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full px-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowMobileSurahPicker((prev) => !prev);
                          setShowMobileAyahPicker(false);
                        }}
                        className={`w-full h-full bg-transparent text-xs font-semibold border-0 focus:ring-0 flex items-center justify-between ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                      >
                        <span className="truncate">{selectedSurah}. {activeSurahMeta?.englishName || 'Surah'}</span>
                        <ChevronDownIcon className="h-3.5 w-3.5 flex-shrink-0" />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleMobileNext}
                  disabled={mobileNextDisabled}
                  className={`h-10 w-10 rounded-lg flex items-center justify-center ${mobileNextDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${settings.theme === 'dark' ? 'bg-emerald-900 text-emerald-200' : 'bg-emerald-100 text-emerald-600'}`}
                  aria-label="Next"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>

              {activeSurahMeta && (
                <div className="flex items-center justify-center gap-3 px-1">
                  <p className={`text-xl leading-none font-scheherazade ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`} dir="rtl">
                    {activeSurahMeta.name}
                  </p>
                  <p className={`text-[11px] text-center whitespace-nowrap ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    {activeSurahMeta.englishName} • {activeSurahMeta.numberOfAyahs} Ayahs
                  </p>
                </div>
              )}

              {showMobileSurahPicker && (
                <div className={`mt-2 rounded-lg border p-2 max-h-52 overflow-y-auto ${settings.theme === 'dark' ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}>
                  <div className="space-y-1">
                    {surahOptions.map((surah) => (
                      <button
                        key={`mobile-surah-${surah.number}`}
                        type="button"
                        onClick={() => {
                          setSelectedSurah(surah.number);
                          setSelectedAyah(1);
                          setShowMobileSurahPicker(false);
                        }}
                        className={`w-full rounded-md px-2 py-2 text-left text-xs ${selectedSurah === surah.number ? (settings.theme === 'dark' ? 'bg-emerald-900 text-emerald-100' : 'bg-emerald-100 text-emerald-800') : settings.theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-800 hover:bg-gray-50'}`}
                      >
                        {surah.number}. {surah.englishName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isAyahMode && showMobileAyahPicker && (
                <div className={`mt-2 rounded-lg border p-2 max-h-52 overflow-y-auto ${settings.theme === 'dark' ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ayahOptions.map((ayahNumber) => (
                      <button
                        key={`mobile-ayah-${ayahNumber}`}
                        type="button"
                        onClick={() => {
                          setSelectedAyah(ayahNumber);
                          setShowMobileAyahPicker(false);
                        }}
                        className={`rounded-md px-2 py-2 text-xs ${selectedAyah === ayahNumber ? (settings.theme === 'dark' ? 'bg-emerald-900 text-emerald-100' : 'bg-emerald-100 text-emerald-800') : settings.theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-800 hover:bg-gray-50'}`}
                      >
                        {ayahNumber}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-2 sm:px-3 lg:px-4 pb-10 mt-3">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="hidden lg:block lg:col-span-2">
                <div className={`rounded-lg shadow-md p-3 sticky top-16 max-h-[calc(100vh-5rem)] overflow-y-auto ${settings.theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Cog6ToothIcon className="h-4 w-4 text-emerald-600" />
                    <h2 className={`text-sm font-semibold ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      onClick={() => setSettingsTab('display')}
                      className={`rounded-md px-2 py-2 text-xs font-medium ${
                        settingsTab === 'display'
                          ? 'bg-emerald-500 text-white'
                          : settings.theme === 'dark'
                          ? 'bg-gray-700 text-gray-200'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Squares2X2Icon className="h-3.5 w-3.5" />
                        Display
                      </span>
                    </button>
                    <button
                      onClick={() => setSettingsTab('bookmarks')}
                      className={`rounded-md px-2 py-2 text-xs font-medium ${
                        settingsTab === 'bookmarks'
                          ? 'bg-amber-500 text-white'
                          : settings.theme === 'dark'
                          ? 'bg-gray-700 text-gray-200'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <BookmarkIcon className="h-3.5 w-3.5" />
                        Bookmarks
                      </span>
                    </button>
                  </div>

                  {settingsTab === 'display' && (
                  <div className="space-y-3">
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        Reader Mode
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            handleReaderModeChange('ayah');
                          }}
                          className={`rounded-md px-2 py-2 text-xs font-medium ${
                            readerMode === 'ayah'
                              ? 'bg-emerald-500 text-white'
                              : settings.theme === 'dark'
                              ? 'bg-gray-700 text-gray-200'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          Ayat by Ayat
                        </button>
                        <button
                          onClick={() => handleReaderModeChange('surah')}
                          className={`rounded-md px-2 py-2 text-xs font-medium ${
                            readerMode === 'surah'
                              ? 'bg-emerald-500 text-white'
                              : settings.theme === 'dark'
                              ? 'bg-gray-700 text-gray-200'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          Complete Surah
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={`block text-xs font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        Translation
                      </label>
                      <select
                        value={selectedTranslation}
                        onChange={(event) => setSelectedTranslation(event.target.value)}
                        className={`w-full rounded-md border px-2 py-2 text-xs ${settings.theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'}`}
                      >
                        {translationOptions.map((translation) => (
                          <option key={translation.identifier} value={translation.identifier}>
                            {translation.language} - {translation.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={`block text-xs font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        Tafsir
                      </label>
                      <select
                        value={tafsirEdition}
                        onChange={(event) => setTafsirEdition(event.target.value)}
                        className={`w-full rounded-md border px-2 py-2 text-xs ${settings.theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'}`}
                      >
                        <option value="bayan-ul-quran-dr-israr-ahmed">Bayan-ul-Quran by Dr Israr Ahmed</option>
                        <option value="tafheem-ul-quran-syed-abu-ala-maududi">Tafheem e Qur'an - Syed Abu Ala Maududi</option>
                      </select>
                    </div>

                    <div>
                      <label className={`block text-xs font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        Theme
                      </label>
                      <button
                        onClick={() => updateSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })}
                        className={`w-full flex items-center justify-between rounded-md px-2.5 py-2 text-xs ${settings.theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`}
                      >
                        <span>{settings.theme === 'light' ? 'Light' : 'Dark'}</span>
                        {settings.theme === 'light' ? <SunIcon className="h-4 w-4 text-yellow-500" /> : <MoonIcon className="h-4 w-4 text-blue-300" />}
                      </button>
                    </div>

                    <div>
                      <label className={`block text-xs font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        Quran Font Size: {settings.fontSize}px
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateSettings({ fontSize: Math.max(14, settings.fontSize - 1) })}
                          className={`p-1.5 rounded ${settings.theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
                        >
                          <MinusIcon className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="range"
                          min="14"
                          max="38"
                          value={settings.fontSize}
                          onChange={(event) => updateSettings({ fontSize: Number(event.target.value) })}
                          className="flex-1 h-2"
                        />
                        <button
                          onClick={() => updateSettings({ fontSize: Math.min(38, settings.fontSize + 1) })}
                          className={`p-1.5 rounded ${settings.theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
                        >
                          <PlusIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={`block text-xs font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        Translation Size: {settings.translationFontSize}px
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateSettings({ translationFontSize: Math.max(14, settings.translationFontSize - 1) })}
                          className={`p-1.5 rounded ${settings.theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
                        >
                          <MinusIcon className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="range"
                          min="14"
                          max="38"
                          value={settings.translationFontSize}
                          onChange={(event) => updateSettings({ translationFontSize: Number(event.target.value) })}
                          className="flex-1 h-2"
                        />
                        <button
                          onClick={() => updateSettings({ translationFontSize: Math.min(38, settings.translationFontSize + 1) })}
                          className={`p-1.5 rounded ${settings.theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
                        >
                          <PlusIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={`block text-xs font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        Tafsir Size: {tafsirFontSize}px
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setTafsirFontSize((prev) => Math.max(14, prev - 1))}
                          className={`p-1.5 rounded ${settings.theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
                        >
                          <MinusIcon className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="range"
                          min="14"
                          max="38"
                          value={tafsirFontSize}
                          onChange={(event) => setTafsirFontSize(Number(event.target.value))}
                          className="flex-1 h-2"
                        />
                        <button
                          onClick={() => setTafsirFontSize((prev) => Math.min(38, prev + 1))}
                          className={`p-1.5 rounded ${settings.theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
                        >
                          <PlusIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className={`text-xs leading-5 ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      Arabic ayat are rendered using IndoPak Nastaleeq v3 styling to match Quran and Translation page.
                    </p>

                    <div>
                      <label className={`block text-xs font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        Text Area Background
                      </label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {AREA_BACKGROUND_OPTIONS.map((option) => (
                          <button
                            key={`text-bg-${option.label}`}
                            type="button"
                            onClick={() => setTextAreaBackgroundColor(option.value)}
                            className={`h-8 rounded-md border-2 ${
                              textAreaBackgroundColor === option.value ? 'border-emerald-500 border-[3px]' : 'border-gray-300'
                            } ${option.swatchClass}`}
                            title={option.label}
                            aria-label={option.label}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className={`block text-xs font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        Tafsir Area Background
                      </label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {AREA_BACKGROUND_OPTIONS.map((option) => (
                          <button
                            key={`tafsir-bg-${option.label}`}
                            type="button"
                            onClick={() => setTafsirAreaBackgroundColor(option.value)}
                            className={`h-8 rounded-md border-2 ${
                              tafsirAreaBackgroundColor === option.value ? 'border-emerald-500 border-[3px]' : 'border-gray-300'
                            } ${option.swatchClass}`}
                            title={option.label}
                            aria-label={option.label}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className={`block text-xs font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        Tafsir Text Color
                      </label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {TAFSIR_TEXT_COLOR_OPTIONS.map((option) => (
                          <button
                            key={`tafsir-text-${option.label}`}
                            type="button"
                            onClick={() => setTafsirTextColor(option.value)}
                            className={`h-8 rounded-md border-2 flex items-center justify-center ${
                              tafsirTextColor === option.value ? 'border-emerald-500 border-[3px]' : 'border-gray-300'
                            } bg-white`}
                            title={option.label}
                            aria-label={option.label}
                          >
                            <span className={`text-[10px] font-bold ${option.textClass}`}>Aa</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  )}

                  {settingsTab === 'bookmarks' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <BookmarkIcon className="h-3.5 w-3.5 text-emerald-600" />
                        <p className={`text-xs font-semibold ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          Saved Bookmarks
                        </p>
                      </div>
                      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                        {bookmarks.length > 0 ? (
                          bookmarks.map((bookmark) => (
                            <div
                              key={bookmark.id}
                              className="rounded-md border p-2"
                              style={getBookmarkBlockStyle(bookmark.color, 0.12, 0.22)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <button
                                  onClick={() => navigateToBookmark(bookmark.surahNumber, bookmark.ayahNumber, false)}
                                  className="flex-1 text-left"
                                >
                                  <p className={`text-xs font-semibold ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    {bookmark.surahName}
                                  </p>
                                  <p className={`text-[11px] ${settings.theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                                    Ayah {bookmark.ayahNumber}
                                  </p>
                                  {bookmark.note && (
                                    <p className={`text-[11px] italic mt-0.5 ${settings.theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                                      "{bookmark.note}"
                                    </p>
                                  )}
                                </button>
                                <button
                                  onClick={() => removeBookmark(bookmark.id)}
                                  className="inline-flex items-center justify-center rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-600"
                                  aria-label="Remove bookmark"
                                  title="Remove bookmark"
                                >
                                  <TrashIcon className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className={`text-xs py-2 text-center ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            No bookmarks saved yet
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div ref={readerContentRef} className="lg:col-span-8 space-y-3">
                {readerMode === 'ayah' && (
                  <div className="hidden lg:block">
                  <div className={`rounded-lg shadow-md p-3 ${settings.theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className={`block text-xs font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                          Surah
                        </label>
                        <select
                          value={selectedSurah}
                          onChange={(event) => {
                            setSelectedSurah(Number(event.target.value));
                            setSelectedAyah(1);
                          }}
                          className={`w-full rounded-md border px-2 py-2 text-sm ${settings.theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'}`}
                        >
                          {surahOptions.map((surah) => (
                            <option key={surah.number} value={surah.number}>
                              {surah.number}. {surah.name} ({surah.englishName})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-1 lg:col-span-2">
                        <label className={`block text-xs font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                          Ayah
                        </label>
                        <select
                          value={selectedAyah}
                          onChange={(event) => setSelectedAyah(Number(event.target.value))}
                          className={`w-full rounded-md border px-2 py-2 text-sm ${settings.theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'}`}
                        >
                          {ayahOptions.map((ayahNumber) => (
                            <option key={ayahNumber} value={ayahNumber}>
                              Ayah {ayahNumber}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-1 lg:col-span-2 flex items-end gap-2">
                        <button
                          onClick={() => setSelectedAyah((prev) => Math.max(1, prev - 1))}
                          disabled={selectedAyah <= 1}
                          className={`flex-1 rounded-md px-2 py-2 text-sm font-semibold ${selectedAyah <= 1 ? 'cursor-not-allowed opacity-50' : ''} ${settings.theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
                        >
                          <span className="inline-flex items-center gap-1"><ChevronLeftIcon className="h-4 w-4" /> Prev</span>
                        </button>
                        <button
                          onClick={() => setSelectedAyah((prev) => Math.min(ayahOptions.length, prev + 1))}
                          disabled={selectedAyah >= ayahOptions.length}
                          className={`flex-1 rounded-md px-2 py-2 text-sm font-semibold ${selectedAyah >= ayahOptions.length ? 'cursor-not-allowed opacity-50' : ''} ${settings.theme === 'dark' ? 'bg-emerald-900 text-emerald-200' : 'bg-emerald-100 text-emerald-700'}`}
                        >
                          <span className="inline-flex items-center gap-1">Next <ChevronRightIcon className="h-4 w-4" /></span>
                        </button>
                      </div>
                    </div>
                  </div>
                  </div>
                )}

                {loading && (
                  <div className={`rounded-lg shadow-md p-4 ${settings.theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
                    <LoadingSpinner size="sm" text="Loading Tafsir..." />
                  </div>
                )}

                {!loading && error && (
                  <div className={`rounded-lg shadow-md p-4 text-sm ${settings.theme === 'dark' ? 'bg-red-950/30 border border-red-900 text-red-200' : 'bg-red-50 border border-red-300 text-red-700'}`}>
                    {error}
                  </div>
                )}

                {!loading && !error && ayahList.length === 0 && (
                  <div className={`rounded-lg shadow-md p-4 text-center text-sm ${settings.theme === 'dark' ? 'bg-gray-800 border border-gray-700 text-gray-300' : 'bg-white border border-gray-200 text-gray-600'}`}>
                    No tafsir data available for this selection.
                  </div>
                )}

                {!loading && (
                <div className="space-y-3">
                  {renderedAyahCards}
                </div>
                )}
              </div>

              <aside className="hidden lg:block lg:col-span-2">
                <div className={`rounded-lg shadow-md p-3 sticky top-16 max-h-[calc(100vh-5rem)] overflow-y-auto ${settings.theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <MagnifyingGlassIcon className="h-4 w-4 text-emerald-600" />
                    <h2 className={`text-sm font-semibold ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Surah Finder
                    </h2>
                  </div>

                  <input
                    type="text"
                    value={surahSearch}
                    onChange={(event) => setSurahSearch(event.target.value)}
                    placeholder="Search surah..."
                    className={`mb-3 w-full rounded-md border pl-8 pr-2 py-2 text-sm ${settings.theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'}`}
                  />

                  <div className="max-h-[65vh] space-y-1 overflow-y-auto">
                    {filteredSurahs.map((surah) => (
                      <button
                        key={surah.number}
                        onClick={() => {
                          setSelectedSurah(surah.number);
                          setSelectedAyah(1);
                        }}
                        className={`w-full rounded-md px-2 py-2 text-left text-sm transition-colors ${
                          selectedSurah === surah.number
                            ? 'bg-emerald-100 text-black'
                            : settings.theme === 'dark'
                            ? 'text-gray-100 hover:bg-gray-700'
                            : 'text-gray-900 hover:bg-emerald-50'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-baseline gap-1.5">
                            <span className={`text-xs ${selectedSurah === surah.number ? 'text-black' : settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{surah.number}.</span>
                            <p className={`font-scheherazade text-lg leading-tight ${selectedSurah === surah.number ? 'text-black' : settings.theme === 'dark' ? 'text-white' : 'text-black'}`} dir="rtl">{surah.name}</p>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs truncate leading-tight ${selectedSurah === surah.number ? 'text-black' : settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{surah.englishName}</p>
                            <span className={`text-xs whitespace-nowrap ${selectedSurah === surah.number ? 'text-black' : settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                              {surah.numberOfAyahs} Ayahs
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
      )}

      {showMobileSettings && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => setShowMobileSettings(false)} />
          <div
            className={`absolute bottom-0 left-0 right-0 ${settings.theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col animate-slide-up`}
            onTouchStart={onMobileSettingsTouchStart}
            onTouchMove={onMobileSettingsTouchMove}
            onTouchEnd={onMobileSettingsTouchEnd}
          >
            <div className="flex items-center justify-center pt-3 pb-2">
              <div className={`w-12 h-1.5 ${settings.theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'} rounded-full`} />
            </div>

            <div className={`px-4 py-3 border-b ${settings.theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className={`text-lg font-bold ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
                <button
                  onClick={() => setShowMobileSettings(false)}
                  className={`p-2 rounded-lg ${settings.theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  <XMarkIcon className={`h-5 w-5 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSettingsTab('display')}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    settingsTab === 'display'
                      ? 'bg-emerald-500 text-white'
                      : settings.theme === 'dark'
                      ? 'bg-gray-700 text-gray-200'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Squares2X2Icon className="h-4 w-4" />
                    Display
                  </span>
                </button>
                <button
                  onClick={() => setSettingsTab('bookmarks')}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    settingsTab === 'bookmarks'
                      ? 'bg-amber-500 text-white'
                      : settings.theme === 'dark'
                      ? 'bg-gray-700 text-gray-200'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <BookmarkIcon className="h-4 w-4" />
                    Bookmarks
                  </span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">

            {settingsTab === 'display' && (
            <div className="space-y-3">
              <div>
                <label className={`block text-sm font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Reader Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      handleReaderModeChange('ayah');
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium ${
                      readerMode === 'ayah'
                        ? 'bg-emerald-500 text-white'
                        : settings.theme === 'dark'
                        ? 'bg-gray-700 text-gray-200'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Ayat by Ayat
                  </button>
                  <button
                    onClick={() => handleReaderModeChange('surah')}
                    className={`rounded-lg px-3 py-2 text-sm font-medium ${
                      readerMode === 'surah'
                        ? 'bg-emerald-500 text-white'
                        : settings.theme === 'dark'
                        ? 'bg-gray-700 text-gray-200'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Complete Surah
                  </button>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Translation
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileTranslationPicker((prev) => !prev);
                    setShowMobileTafsirPicker(false);
                  }}
                  className={`w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm ${settings.theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'}`}
                >
                  <span className="truncate text-left">
                    {selectedTranslationMeta
                      ? `${selectedTranslationMeta.language} - ${selectedTranslationMeta.name}`
                      : selectedTranslation}
                  </span>
                  <ChevronDownIcon className={`h-4 w-4 transition-transform ${showMobileTranslationPicker ? 'rotate-180' : ''}`} />
                </button>
                {showMobileTranslationPicker && (
                  <div className={`mt-2 max-h-56 overflow-y-auto rounded-md border p-1.5 space-y-1 ${settings.theme === 'dark' ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                    {translationOptions.map((translation) => {
                      const isSelected = selectedTranslation === translation.identifier;
                      return (
                        <button
                          key={`mobile-translation-${translation.identifier}`}
                          type="button"
                          onClick={() => {
                            setSelectedTranslation(translation.identifier);
                            setShowMobileTranslationPicker(false);
                          }}
                          className={`w-full rounded-md px-2.5 py-2 text-left text-sm ${
                            isSelected
                              ? settings.theme === 'dark'
                                ? 'bg-emerald-900 text-emerald-100'
                                : 'bg-emerald-100 text-emerald-800'
                              : settings.theme === 'dark'
                              ? 'text-gray-100 hover:bg-gray-700'
                              : 'text-gray-800 hover:bg-gray-100'
                          }`}
                        >
                          {translation.language} - {translation.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Tafsir
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileTafsirPicker((prev) => !prev);
                    setShowMobileTranslationPicker(false);
                  }}
                  className={`w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm ${settings.theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'}`}
                >
                  <span className="truncate text-left">{tafsirEditionLabel}</span>
                  <ChevronDownIcon className={`h-4 w-4 transition-transform ${showMobileTafsirPicker ? 'rotate-180' : ''}`} />
                </button>
                {showMobileTafsirPicker && (
                  <div className={`mt-2 max-h-56 overflow-y-auto rounded-md border p-1.5 space-y-1 ${settings.theme === 'dark' ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                    {TAFSIR_EDITION_OPTIONS.map((option) => {
                      const isSelected = tafsirEdition === option.value;
                      return (
                        <button
                          key={`mobile-tafsir-${option.value}`}
                          type="button"
                          onClick={() => {
                            setTafsirEdition(option.value);
                            setShowMobileTafsirPicker(false);
                          }}
                          className={`w-full rounded-md px-2.5 py-2 text-left text-sm ${
                            isSelected
                              ? settings.theme === 'dark'
                                ? 'bg-emerald-900 text-emerald-100'
                                : 'bg-emerald-100 text-emerald-800'
                              : settings.theme === 'dark'
                              ? 'text-gray-100 hover:bg-gray-700'
                              : 'text-gray-800 hover:bg-gray-100'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                onClick={() => updateSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-3 text-sm ${settings.theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}`}
              >
                <span>Theme: {settings.theme === 'light' ? 'Light' : 'Dark'}</span>
                {settings.theme === 'light' ? <SunIcon className="h-4 w-4 text-yellow-500" /> : <MoonIcon className="h-4 w-4 text-blue-300" />}
              </button>

              <div>
                <label className={`block text-sm font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Quran Font Size: {settings.fontSize}px
                </label>
                <input
                  type="range"
                  min="14"
                  max="38"
                  value={settings.fontSize}
                  onChange={(event) => updateSettings({ fontSize: Number(event.target.value) })}
                  className="w-full h-2"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Translation Size: {settings.translationFontSize}px
                </label>
                <input
                  type="range"
                  min="14"
                  max="38"
                  value={settings.translationFontSize}
                  onChange={(event) => updateSettings({ translationFontSize: Number(event.target.value) })}
                  className="w-full h-2"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Tafsir Size: {tafsirFontSize}px
                </label>
                <input
                  type="range"
                  min="14"
                  max="38"
                  value={tafsirFontSize}
                  onChange={(event) => setTafsirFontSize(Number(event.target.value))}
                  className="w-full h-2"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Text Area Background
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {AREA_BACKGROUND_OPTIONS.map((option) => (
                    <button
                      key={`m-text-bg-${option.label}`}
                      type="button"
                      onClick={() => setTextAreaBackgroundColor(option.value)}
                      className={`h-10 rounded-md border-2 ${
                        textAreaBackgroundColor === option.value ? 'border-emerald-500 border-[3px]' : 'border-gray-300'
                      } ${option.swatchClass}`}
                      title={option.label}
                      aria-label={option.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Tafsir Area Background
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {AREA_BACKGROUND_OPTIONS.map((option) => (
                    <button
                      key={`m-tafsir-bg-${option.label}`}
                      type="button"
                      onClick={() => setTafsirAreaBackgroundColor(option.value)}
                      className={`h-10 rounded-md border-2 ${
                        tafsirAreaBackgroundColor === option.value ? 'border-emerald-500 border-[3px]' : 'border-gray-300'
                      } ${option.swatchClass}`}
                      title={option.label}
                      aria-label={option.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Tafsir Text Color
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {TAFSIR_TEXT_COLOR_OPTIONS.map((option) => (
                    <button
                      key={`m-tafsir-text-${option.label}`}
                      type="button"
                      onClick={() => setTafsirTextColor(option.value)}
                      className={`h-10 rounded-md border-2 flex items-center justify-center ${
                        tafsirTextColor === option.value ? 'border-emerald-500 border-[3px]' : 'border-gray-300'
                      } bg-white`}
                      title={option.label}
                      aria-label={option.label}
                    >
                      <span className={`text-xs font-bold ${option.textClass}`}>Aa</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowMobileSettings(false)}
                className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white"
              >
                Close
              </button>
            </div>
            )}

            {settingsTab === 'bookmarks' && (
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {bookmarks.length > 0 ? (
                  bookmarks.map((bookmark) => (
                    <div
                      key={bookmark.id}
                      className="rounded-lg border p-3"
                      style={getBookmarkBlockStyle(bookmark.color, 0.14, 0.24)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => navigateToBookmark(bookmark.surahNumber, bookmark.ayahNumber, true)}
                          className="flex-1 text-left"
                        >
                          <p className={`text-sm font-semibold ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {bookmark.surahName}
                          </p>
                          <p className={`text-xs ${settings.theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                            Ayah {bookmark.ayahNumber}
                          </p>
                          {bookmark.note && (
                            <p className={`text-xs italic mt-1 ${settings.theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                              "{bookmark.note}"
                            </p>
                          )}
                        </button>
                        <button
                          onClick={() => removeBookmark(bookmark.id)}
                          className="inline-flex items-center justify-center rounded p-1.5 text-red-500 hover:bg-red-50 hover:text-red-600"
                          aria-label="Remove bookmark"
                          title="Remove bookmark"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={`text-sm py-6 text-center ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    No bookmarks saved yet
                  </p>
                )}
                <button
                  onClick={() => setShowMobileSettings(false)}
                  className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white"
                >
                  Close
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {showMobileSurahSearch && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setAllowMobileSurahSearchFocus(false);
              setShowMobileSurahSearch(false);
            }}
          />
          <div className={`absolute bottom-0 left-0 right-0 rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto ${settings.theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-base font-semibold ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Surah Finder</h2>
              <button
                onClick={() => {
                  setAllowMobileSurahSearchFocus(false);
                  setShowMobileSurahSearch(false);
                }}
              >
                <XMarkIcon className={`h-5 w-5 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} />
              </button>
            </div>

            <input
              type="text"
              value={surahSearch}
              onChange={(event) => setSurahSearch(event.target.value)}
              onTouchStart={() => setAllowMobileSurahSearchFocus(true)}
              onMouseDown={() => setAllowMobileSurahSearchFocus(true)}
              onFocus={(event) => {
                if (!allowMobileSurahSearchFocus) {
                  event.target.blur();
                }
              }}
              placeholder="Search surah..."
              style={{ fontSize: '16px' }}
              className={`mb-3 w-full rounded-md border px-3 py-2 text-base ${settings.theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'}`}
            />

            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {filteredSurahs.map((surah) => (
                <button
                  key={surah.number}
                  onClick={() => {
                    setSelectedSurah(surah.number);
                    setSelectedAyah(1);
                    setAllowMobileSurahSearchFocus(false);
                    setShowMobileSurahSearch(false);
                  }}
                  className={`w-full rounded-md px-2 py-2 text-left text-sm transition-colors ${
                    selectedSurah === surah.number
                      ? 'bg-emerald-100 text-black'
                      : settings.theme === 'dark'
                      ? 'text-gray-100 hover:bg-gray-700'
                      : 'text-gray-900 hover:bg-emerald-50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-xs ${selectedSurah === surah.number ? 'text-black' : settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{surah.number}.</span>
                      <p className={`font-scheherazade text-lg leading-tight ${selectedSurah === surah.number ? 'text-black' : settings.theme === 'dark' ? 'text-white' : 'text-black'}`} dir="rtl">{surah.name}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate leading-tight ${selectedSurah === surah.number ? 'text-black' : settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{surah.englishName}</p>
                      <span className={`text-xs whitespace-nowrap ${selectedSurah === surah.number ? 'text-black' : settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        {surah.numberOfAyahs} Ayahs
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {bookmarkConfirm && (
        <>
          <div
            className="fixed inset-x-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-none lg:backdrop-blur-sm lg:hidden"
            style={{
              top: bookmarkModalViewport?.offsetTop ?? 0,
              height: bookmarkModalViewport ? `${bookmarkModalViewport.height}px` : '100dvh',
            }}
            onClick={() => setBookmarkConfirm(null)}
          >
            <div
              className={`relative w-full max-w-sm rounded-xl shadow-2xl border-2 border-emerald-500 p-4 ${
                settings.theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              }`}
              style={{ overflowY: 'auto', maxHeight: '90%' }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                onClick={() => setBookmarkConfirm(null)}
                className="absolute top-3 right-3 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>

              {!isBookmarked(bookmarkConfirm.surahNum, bookmarkConfirm.ayahNum) ? (
                <>
                  <p className={`text-base font-semibold mb-3 ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Add Bookmark
                  </p>

                  <div className="mb-3">
                    <label className={`block text-sm font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      Note (optional)
                    </label>
                    <input
                      type="text"
                      value={bookmarkConfirm.note || ''}
                      onChange={(event) => setBookmarkConfirm({ ...bookmarkConfirm, note: event.target.value })}
                      placeholder="Add a note..."
                      className={`w-full px-3 py-2 text-base rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                        settings.theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                  </div>

                  <div className="mb-4">
                    <label className={`block text-sm font-medium mb-2 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      Highlight Color
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {BOOKMARK_COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setBookmarkConfirm({ ...bookmarkConfirm, color })}
                          className={`w-9 h-9 rounded-lg border-2 transition-all transform hover:scale-110 ${
                            bookmarkConfirm.color === color ? 'border-gray-900 scale-110' : 'border-transparent'
                          } ${getBookmarkSwatchClass(color)}`}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p className={`text-base mb-3 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Remove this ayah from bookmarks?
                </p>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setBookmarkConfirm(null)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg ${
                    settings.theme === 'dark'
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBookmark}
                  className={`px-4 py-2 text-sm font-medium rounded-lg ${
                    isBookmarked(bookmarkConfirm.surahNum, bookmarkConfirm.ayahNum)
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {isBookmarked(bookmarkConfirm.surahNum, bookmarkConfirm.ayahNum) ? 'Remove' : 'Save Bookmark'}
                </button>
              </div>
            </div>
          </div>

          <div
            className={`hidden lg:block fixed z-50 rounded-xl shadow-2xl border-2 border-emerald-500 p-5 ${
              settings.theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            }`}
            style={{
              left: `${bookmarkConfirm.x}px`,
              top: `${bookmarkConfirm.y}px`,
              transform: 'translate(-50%, -100%) translateY(-10px)',
              maxWidth: '320px',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {!isBookmarked(bookmarkConfirm.surahNum, bookmarkConfirm.ayahNum) ? (
              <>
                <p className={`text-sm font-semibold mb-3 ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Add Bookmark
                </p>

                <div className="mb-3">
                  <label className={`block text-xs font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Note (optional)
                  </label>
                  <input
                    type="text"
                    value={bookmarkConfirm.note || ''}
                    onChange={(event) => setBookmarkConfirm({ ...bookmarkConfirm, note: event.target.value })}
                    placeholder="Add a note..."
                    className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      settings.theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                  />
                </div>

                <div className="mb-4">
                  <label className={`block text-xs font-medium mb-2 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Highlight Color
                  </label>
                  <div className="flex gap-2">
                    {BOOKMARK_COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setBookmarkConfirm({ ...bookmarkConfirm, color })}
                        className={`w-8 h-8 rounded-lg border-2 transition-all transform hover:scale-110 ${
                          bookmarkConfirm.color === color ? 'border-gray-900 scale-110' : 'border-transparent'
                        } ${getBookmarkSwatchClass(color)}`}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className={`text-sm mb-3 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Remove this ayah from bookmarks?
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setBookmarkConfirm(null)}
                className={`px-4 py-2 text-xs font-medium rounded-lg ${
                  settings.theme === 'dark'
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={confirmBookmark}
                className={`px-4 py-2 text-xs font-medium rounded-lg ${
                  isBookmarked(bookmarkConfirm.surahNum, bookmarkConfirm.ayahNum)
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {isBookmarked(bookmarkConfirm.surahNum, bookmarkConfirm.ayahNum) ? 'Remove' : 'Save Bookmark'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default QuranTafsirBayan;
