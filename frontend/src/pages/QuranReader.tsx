import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpenIcon,
  MagnifyingGlassIcon,
  BookmarkIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  PlusIcon,
  MinusIcon,
  MoonIcon,
  SunIcon,
  ChevronDownIcon,
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useQuran } from '../contexts/QuranContext';
import LoadingSpinner from '../components/LoadingSpinner';
import PageSEO from '../components/PageSEO';
import {
  BOOKMARK_COLOR_OPTIONS,
  type BookmarkColor,
  DEFAULT_ENGLISH_TRANSLATION,
  DEFAULT_TRANSLATIONS,
} from '../types/quran';
import { getIndopakQuranData, getIndopakSurah, type IndopakSurah } from '../utils/indopakQuran';

const BOOKMARK_COLOR_CLASS_MAP: Record<
  BookmarkColor,
  {
    background: string;
    border: string;
    list: string;
    swatch: string;
    selection: string;
  }
> = {
  emerald: {
    background: 'bg-emerald-300 bg-opacity-50',
    border: 'border-emerald-600 text-emerald-600',
    list: 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
    swatch: 'bg-emerald-600',
    selection: 'ring-2 ring-emerald-500',
  },
  red: {
    background: 'bg-red-300 bg-opacity-50',
    border: 'border-red-600 text-red-600',
    list: 'border-red-600 bg-red-50 dark:bg-red-900/20',
    swatch: 'bg-red-600',
    selection: 'ring-2 ring-red-500',
  },
  teal: {
    background: 'bg-teal-300 bg-opacity-50',
    border: 'border-teal-600 text-teal-600',
    list: 'border-teal-600 bg-teal-50 dark:bg-teal-900/20',
    swatch: 'bg-teal-600',
    selection: 'ring-2 ring-teal-500',
  },
  indigo: {
    background: 'bg-indigo-300 bg-opacity-50',
    border: 'border-indigo-600 text-indigo-600',
    list: 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20',
    swatch: 'bg-indigo-600',
    selection: 'ring-2 ring-indigo-500',
  },
  blue: {
    background: 'bg-blue-300 bg-opacity-50',
    border: 'border-blue-600 text-blue-600',
    list: 'border-blue-600 bg-blue-50 dark:bg-blue-900/20',
    swatch: 'bg-blue-600',
    selection: 'ring-2 ring-blue-500',
  },
  purple: {
    background: 'bg-purple-300 bg-opacity-50',
    border: 'border-purple-600 text-purple-600',
    list: 'border-purple-600 bg-purple-50 dark:bg-purple-900/20',
    swatch: 'bg-purple-600',
    selection: 'ring-2 ring-purple-500',
  },
  amber: {
    background: 'bg-amber-300 bg-opacity-50',
    border: 'border-amber-600 text-amber-600',
    list: 'border-amber-600 bg-amber-50 dark:bg-amber-900/20',
    swatch: 'bg-amber-600',
    selection: 'ring-2 ring-amber-500',
  },
  rose: {
    background: 'bg-rose-300 bg-opacity-50',
    border: 'border-rose-600 text-rose-600',
    list: 'border-rose-600 bg-rose-50 dark:bg-rose-900/20',
    swatch: 'bg-rose-600',
    selection: 'ring-2 ring-rose-500',
  },
};

const QuranReader: React.FC = () => {
  const {
    surahs,
    surahData,
    translations,
    transliteration,
    loading,
    currentSurah,
    goToSurah,
    nextSurah,
    previousSurah,
    settings,
    updateSettings,
    bookmarks,
    addBookmark,
    removeBookmark,
    updateLastRead,
    isPlaying,
    isPaused,
    isAudioLoading,
    currentPlayingAyah,
    currentPlayingSurah,
    currentPlaybackTrack,
    canSeekAudio,
    audioDuration,
    audioCurrentTime,
    currentQueueIndex,
    playAyah,
    playTranslationAyah,
    pauseAyah,
    resumeAyah,
    stopAyah,
    playSurah,
    togglePlayPause,
    seekAudio,
  } = useQuran();

  const [searchTerm, setSearchTerm] = useState('');
  const [bookmarkConfirm, setBookmarkConfirm] = useState<{
    surahNum: number;
    ayahNum: number;
    x: number;
    y: number;
    note?: string;
    color?: BookmarkColor;
  } | null>(null);
  const [selectedAyahForBookmark, setSelectedAyahForBookmark] = useState<{surah: number, ayah: number} | null>(null);
  // Track visual viewport for iOS keyboard-aware bookmark modal positioning
  const [bookmarkModalViewport, setBookmarkModalViewport] = useState<{ height: number; offsetTop: number } | null>(null);

  // Indopak Quran data state
  const [indopakData, setIndopakData] = useState<Map<number, IndopakSurah> | null>(null);
  const [indopakSurah, setIndopakSurah] = useState<IndopakSurah | null>(null);

  // Load Indopak Quran data on mount
  useEffect(() => {
    const data = getIndopakQuranData();
    setIndopakData(data);
  }, []);

  // Load current Surah from Indopak data when surah or font changes
  useEffect(() => {
    if (indopakData && settings.arabicFont === 'indopak-nastaleeq' && currentSurah) {
      const surah = getIndopakSurah(indopakData, currentSurah);
      setIndopakSurah(surah || null);
    } else {
      setIndopakSurah(null);
    }
  }, [indopakData, settings.arabicFont, currentSurah]);

  // Mobile settings modal state
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const [showSurahSearch, setShowSurahSearch] = useState(false);
  const [tempSettings, setTempSettings] = useState(settings);
  const [selectedAyahForPlay, setSelectedAyahForPlay] = useState<{surah: number, ayah: number} | null>(null);
  const lockedScrollYRef = useRef<number | null>(null);
  
  // Enhanced mobile search state
  const [searchFilter, setSearchFilter] = useState<'all' | 'surah' | 'juz' | 'page'>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  // Mobile settings tab
  const [settingsTab, setSettingsTab] = useState<'display' | 'audio' | 'bookmarks'>('display');

  // Auto-hide header on scroll
  const [showHeader, setShowHeader] = useState(true);
  const isLegacyIndopakFont = settings.arabicFont === 'indopak-nastaleeq';
  const isTempLegacyIndopakFont = tempSettings.arabicFont === 'indopak-nastaleeq';
  const indopakAyahWarningText =
    "IndoPak Nastaleeq (v1) in Only Arabic mode doesn't support Ayat by Ayat audio. Enable translation mode or change Arabic font.";
  const showDesktopIndopakAyahWarning =
    settings.arabicOnlyMode &&
    isLegacyIndopakFont &&
    settings.audioMode === 'ayah';
  const showMobileIndopakAyahWarning =
    tempSettings.arabicOnlyMode &&
    isTempLegacyIndopakFont &&
    tempSettings.audioMode === 'ayah';

  // Scroll to specific ayah
  const scrollToAyahNumber = (ayahNumber: number) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    // iOS Mobile requires multiple attempts with delays for reliable scrolling
    const attemptScroll = (attempt = 0, maxAttempts = 5) => {
      const ayahElement = document.getElementById(`ayah-${ayahNumber}`);
      
      if (!ayahElement) {
        console.log(`🔍 Ayah ${ayahNumber} not found, attempt ${attempt + 1}/${maxAttempts}`);
        // Element not found, retry after delay
        if (attempt < maxAttempts) {
          setTimeout(() => attemptScroll(attempt + 1, maxAttempts), 200);
        } else {
          console.error(`❌ Failed to find ayah ${ayahNumber} after ${maxAttempts} attempts`);
        }
        return;
      }

      console.log(`✅ Found ayah ${ayahNumber}, scrolling... (iOS: ${isIOS})`);

      // Use requestAnimationFrame for better timing on mobile
      requestAnimationFrame(() => {
        if (isIOS) {
          // iOS-specific: Multiple strategies for reliable scrolling
          
          // Force reflow to ensure layout is complete
          void ayahElement.offsetHeight;
          
          // Strategy 1: Direct element focus (helps with keyboard dismissal)
          if (ayahElement.tabIndex === -1) {
            ayahElement.tabIndex = -1;
          }
          
          // Strategy 2: Get element position and scroll
          const rect = ayahElement.getBoundingClientRect();
          const absoluteTop = rect.top + window.pageYOffset;
          const middle = absoluteTop - (window.innerHeight / 2) + (rect.height / 2);
          
          console.log(`📍 Scrolling to position: ${middle}`);
          
          // Use both methods for maximum compatibility
          window.scrollTo(0, middle);
          
          // Backup: Also try scrollIntoView after a frame
          setTimeout(() => {
            ayahElement.scrollIntoView({ 
              behavior: 'auto', 
              block: 'center',
              inline: 'nearest'
            });
            console.log(`📍 Applied scrollIntoView`);
          }, 50);
          
        } else {
          // For other browsers, use smooth scroll
          ayahElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          });
        }
        
        // Highlight the ayah temporarily
        setTimeout(() => {
          ayahElement.classList.add('bg-emerald-200', 'bg-opacity-30');
          setTimeout(() => {
            ayahElement.classList.remove('bg-emerald-200', 'bg-opacity-30');
          }, 2000);
        }, 100);
      });
    };
    
    // Start the scroll attempt
    attemptScroll();
  };

  // Sync temp settings when settings change
  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

  // Auto-hide header on scroll - Mobile only
  useEffect(() => {
    let ticking = false;
    const scrollState = { lastScrollY: 0 };

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Use requestAnimationFrame for smoother updates
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Add a threshold to prevent rapid toggling
          const scrollThreshold = 50;
          
          if (currentScrollY > scrollState.lastScrollY && currentScrollY > scrollThreshold) {
            // Scrolling down - hide header
            setShowHeader(false);
          } else if (currentScrollY < scrollState.lastScrollY - scrollThreshold || currentScrollY < scrollThreshold) {
            // Scrolling up or at top - show header
            setShowHeader(true);
          }
          
          scrollState.lastScrollY = currentScrollY;
          ticking = false;
        });
        
        ticking = true;
      }
    };

    // Add scroll listener with passive option for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Lock background scroll while any front overlay/modal is open.
  // NOTE: bookmarkConfirm is intentionally excluded — locking the body (position:fixed)
  // breaks Android PWA keyboard positioning for the bookmark modal's note input.
  // The full-screen backdrop already prevents accidental background interaction.
  useEffect(() => {
    const shouldLockBody =
      showMobileSettings ||
      showSurahSearch;

    if (shouldLockBody) {
      if (lockedScrollYRef.current !== null) return;

      lockedScrollYRef.current = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${lockedScrollYRef.current}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      return;
    }

    if (lockedScrollYRef.current !== null) {
      const restoreScrollY = lockedScrollYRef.current;
      lockedScrollYRef.current = null;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, restoreScrollY);
    }
  }, [showMobileSettings, showSurahSearch]);

  useEffect(() => {
    return () => {
      if (lockedScrollYRef.current !== null) {
        const restoreScrollY = lockedScrollYRef.current;
        lockedScrollYRef.current = null;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, restoreScrollY);
      }
    };
  }, []);

  // Clear selected ayah when switching to Complete Surah mode or when surah changes
  useEffect(() => {
    if (settings.audioMode === 'surah') {
      setSelectedAyahForPlay(null);
    }
  }, [settings.audioMode]);

  // Clear selected ayah when surah changes (in ayat mode)
  useEffect(() => {
    setSelectedAyahForPlay(null);
  }, [currentSurah]);

  // Open mobile settings modal
  const openMobileSettings = () => {
    setTempSettings(settings);
    setShowMobileSettings(true);
    setSettingsTab('display');
  };

  // Cancel mobile settings
  const cancelMobileSettings = () => {
    setShowMobileSettings(false);
  };

  // Add to recent searches
  const addToRecentSearches = (term: string) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== term);
      return [term, ...filtered].slice(0, 5);
    });
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
  };

  // Update single setting immediately (for instant apply)
  const updateSingleSetting = (key: keyof typeof tempSettings, value: any) => {
    const updated = { ...tempSettings, [key]: value };
    setTempSettings(updated);
    updateSettings(updated);
  };

  // Filter surahs based on search
  const filteredSurahs = surahs.filter(
    (surah) =>
      surah.name.includes(searchTerm) ||
      surah.englishName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      surah.number.toString().includes(searchTerm)
  );

  // Update last read position when ayah is viewed
  useEffect(() => {
    if (currentSurah && surahData) {
      updateLastRead(currentSurah, 1);
    }
  }, [currentSurah, surahData, updateLastRead]);

  // Check if current surah is bookmarked
  const isBookmarked = (surahNum: number, ayahNum: number) => {
    return bookmarks.some(b => b.surahNumber === surahNum && b.ayahNumber === ayahNum);
  };

  // Get bookmark color for a specific ayah
  const getBookmarkColor = (surahNum: number, ayahNum: number): BookmarkColor | undefined => {
    const bookmark = bookmarks.find(b => b.surahNumber === surahNum && b.ayahNumber === ayahNum);
    return bookmark?.color;
  };

  // Get background class based on bookmark color
  const getBookmarkBackgroundClass = (color?: BookmarkColor): string => {
    if (!color) return '';
    return BOOKMARK_COLOR_CLASS_MAP[color]?.background || '';
  };

  // Get border color class based on bookmark color
  const getBookmarkBorderClass = (color?: BookmarkColor): string => {
    if (!color) return 'border-emerald-600 text-emerald-600';
    return BOOKMARK_COLOR_CLASS_MAP[color]?.border || 'border-emerald-600 text-emerald-600';
  };

  const getBookmarkSelectionClass = (color?: BookmarkColor): string => {
    if (!color) return 'bg-emerald-400 bg-opacity-40 ring-2 ring-emerald-500';
    return BOOKMARK_COLOR_CLASS_MAP[color]?.selection || '';
  };

  const getBookmarkHoverClass = (color?: BookmarkColor): string => {
    if (color) return '';
    return 'hover:bg-emerald-100 hover:bg-opacity-30';
  };

  const getBookmarkListClass = (color?: BookmarkColor): string => {
    if (!color) {
      return settings.theme === 'dark' ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50';
    }
    return BOOKMARK_COLOR_CLASS_MAP[color]?.list || '';
  };

  const getBookmarkSwatchClass = (color: BookmarkColor): string => {
    return BOOKMARK_COLOR_CLASS_MAP[color]?.swatch || 'bg-emerald-600';
  };

  // Get font color class based on settings
  const getFontColorClass = () => {
    if (settings.fontColor === 'default') {
      return settings.theme === 'dark' ? 'text-white' : 'text-gray-800';
    }
    const colorMap = {
      emerald: 'text-emerald-600',
      blue: 'text-blue-600',
      amber: 'text-amber-600',
      rose: 'text-rose-600',
    };
    return colorMap[settings.fontColor] || (settings.theme === 'dark' ? 'text-white' : 'text-gray-800');
  };

  // Get font family class based on settings
  const getFontFamilyClass = () => {
    const fontMap: Record<string, string> = {
      'al-mushaf': 'font-al-mushaf',
      'indopak-nastaleeq': 'font-indopak-nastaleeq',
      'indopak-nastaleeq-v2': 'font-indopak-nastaleeq-v2',
      'amiri': 'font-arabic',
      'scheherazade': 'font-scheherazade',
      'noto-naskh': 'font-noto-naskh',
      'cairo': 'font-cairo',
      'lateef': 'font-lateef',
      'reem-kufi': 'font-reem-kufi',
    };
    return fontMap[settings.arabicFont] || 'font-al-mushaf';
  };

  // Get actual font size with multiplier for Al Mushaf
  const getActualFontSize = () => {
    const baseFontSize = settings.fontSize;
    // Al Mushaf font appears smaller, so multiply by 1.35
    if (settings.arabicFont === 'al-mushaf') {
      return Math.round(baseFontSize * 1.35);
    }
    return baseFontSize;
  };

  // Get reader background class based on settings
  const getReaderBackgroundClass = () => {
    if (settings.theme === 'dark') {
      const darkBackgroundMap: Record<string, string> = {
        'default': 'bg-gradient-to-br from-gray-800 to-gray-700',
        'white': 'bg-gray-800',
        'cream': 'bg-amber-950 bg-opacity-40',
        'blue': 'bg-blue-950 bg-opacity-40',
        'green': 'bg-emerald-950 bg-opacity-40',
      };
      return darkBackgroundMap[settings.readerBackground] || 'bg-gradient-to-br from-gray-800 to-gray-700';
    }
    
    const backgroundMap: Record<string, string> = {
      'default': 'bg-gradient-to-br from-emerald-50 to-teal-50',
      'white': 'bg-white',
      'cream': 'bg-amber-50',
      'blue': 'bg-blue-50',
      'green': 'bg-emerald-50',
    };
    return backgroundMap[settings.readerBackground] || 'bg-gradient-to-br from-emerald-50 to-teal-50';
  };

  // Remove Bismillah from beginning of ayah text if present
  const removeBismillah = (text: string, surahNum: number, ayahNum: number) => {
    // For surahs 2-114 (except 9), remove Bismillah from first ayah since it's shown separately at top
    if (surahNum >= 2 && surahNum !== 9 && ayahNum === 1) {
      // Simple approach: if text starts with بِسْمِ (Bismi), remove first 4 words
      // This works because Bismillah is always "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ" (4 words)
      const trimmed = text.trim();
      if (trimmed.startsWith('بِسْمِ') || trimmed.startsWith('بِسۡمِ') || trimmed.startsWith('بسم')) {
        const words = trimmed.split(/\s+/);
        if (words.length > 4) {
          return words.slice(4).join(' ').trim();
        }
      }
    }
    return text;
  };

  // IndoPak v2 DB includes private-use ayah marker glyphs (e.g. U+F500+).
  // Remove them completely from display text for v2 rendering.
  const stripIndopakV2AyahEndMarker = (text: string): string => (
    text.replace(/[\uF500-\uF8FF]+/g, '')
  );

  const INDO_PAK_MARKERS = new Set(['ۚ', 'ۖ', 'ۗ', 'ۘ', 'ۜ', '۩', '۝', 'مـ', 'صلی', 'قلی']);
  const COMBINING_WAQF_MARKERS = new Set(['ۚ', 'ۖ', 'ۗ', 'ۘ', 'ۜ']);
  const markerSplitPattern = /(مـ|صلی|قلی|[ۚۖۗۘۜ۩۝])/g;

  // IndoPak waqf symbols can merge with surrounding letters on mobile shaping engines.
  // Render markers in dedicated spans so they stay visually separate from ayah words.
  const formatIndopakAyahText = (text: string, keyPrefix = 'indopak'): React.ReactNode => {
    const normalizedText = text
      .replace(/صلى/g, 'صلی')
      .replace(/قلى/g, 'قلی')
      // Remove qaf/tah-style stop symbols requested by user (IndoPak-only path).
      .replace(/[\u0615\u06D7\u08D7]/g, '') // small-high tah / qaf variants
      .replace(/[\uE01C\uE021]/g, '') // qaf/tah stop glyphs encoded in IndoPak private-use area
      .replace(/\s+/g, ' ')
      .trim();

    const tokens = normalizedText.split(markerSplitPattern).filter(Boolean);

    return tokens.map((token, index) => {
      if (!INDO_PAK_MARKERS.has(token)) {
        return <React.Fragment key={`${keyPrefix}-text-${index}`}>{token}</React.Fragment>;
      }

      const markerText = COMBINING_WAQF_MARKERS.has(token) ? `\u25CC${token}` : token;
      return (
        <span key={`${keyPrefix}-marker-${index}`} className="indopak-waqf-marker">
          {markerText}
        </span>
      );
    });
  };

  const getActualLineHeight = () => {
    if (settings.arabicFont === 'indopak-nastaleeq' || settings.arabicFont === 'indopak-nastaleeq-v2') {
      return Math.max(settings.lineSpacing, 2.15);
    }
    return settings.lineSpacing;
  };

  const getTranslationDefinition = (identifier: string) => {
    return DEFAULT_TRANSLATIONS.find((translation) => translation.identifier === identifier);
  };

  const translationOptions = DEFAULT_TRANSLATIONS.filter(
    (translation) => translation.language === 'English' || translation.language === 'Urdu'
  );

  const getSingleTranslationSelection = (identifiers: string[]) => {
    const firstSupportedTranslation = identifiers.find((identifier) => {
      const translationLanguage = getTranslationDefinition(identifier)?.language;
      return translationLanguage === 'English' || translationLanguage === 'Urdu';
    });

    return firstSupportedTranslation ? [firstSupportedTranslation] : [DEFAULT_ENGLISH_TRANSLATION.identifier];
  };

  const activeTranslationIdentifier = getSingleTranslationSelection(settings.selectedTranslations)[0];
  const activeTempTranslationIdentifier = getSingleTranslationSelection(tempSettings.selectedTranslations)[0];

  const formatTranslationLanguage = (language: string) => {
    if (language === 'en' || language === 'English') return 'English';
    if (language === 'ur' || language === 'Urdu') return 'Urdu';
    return language;
  };

  const activeTranslationDefinition = getTranslationDefinition(activeTranslationIdentifier);
  const activeTranslationAudioLabel = activeTranslationDefinition
    ? `${formatTranslationLanguage(activeTranslationDefinition.language)} - ${activeTranslationDefinition.name}`
    : 'Selected translation';
  const supportedTranslationAudioIdentifiers = new Set(['en.sahih', 'ur.jalandhry']);
  const isActiveTranslationAudioSupported = supportedTranslationAudioIdentifiers.has(activeTranslationIdentifier);
  const isActiveTempTranslationAudioSupported = supportedTranslationAudioIdentifiers.has(activeTempTranslationIdentifier);

  const getTranslationOptionLabel = (translation: {
    identifier?: string;
    language: string;
    name: string;
  }) => {
    const language = formatTranslationLanguage(translation.language);
    const translationName = translation.identifier
      ? getTranslationDefinition(translation.identifier)?.name ?? translation.name
      : translation.name;

    return `${language} - ${translationName}`;
  };

  const setDesktopDisplayMode = (arabicOnlyMode: boolean) => {
    if (arabicOnlyMode) {
      updateSettings({ arabicOnlyMode: true });
      return;
    }

    updateSettings({
      arabicOnlyMode: false,
      selectedTranslations: [DEFAULT_ENGLISH_TRANSLATION.identifier],
    });
  };

  const setMobileDisplayMode = (arabicOnlyMode: boolean) => {
    if (arabicOnlyMode) {
      const updatedSettings = { ...tempSettings, arabicOnlyMode: true };
      setTempSettings(updatedSettings);
      updateSettings({ arabicOnlyMode: true });
      return;
    }

    const updatedSettings = {
      ...tempSettings,
      arabicOnlyMode: false,
      selectedTranslations: [DEFAULT_ENGLISH_TRANSLATION.identifier],
    };

    setTempSettings(updatedSettings);
    updateSettings({
      arabicOnlyMode: false,
      selectedTranslations: [DEFAULT_ENGLISH_TRANSLATION.identifier],
    });
  };

  const selectDesktopTranslation = (identifier: string) => {
    updateSettings({
      arabicOnlyMode: false,
      selectedTranslations: [identifier],
    });
  };

  const selectMobileTranslation = (identifier: string) => {
    const updatedSettings = {
      ...tempSettings,
      arabicOnlyMode: false,
      selectedTranslations: [identifier],
    };

    setTempSettings(updatedSettings);
    updateSettings({
      arabicOnlyMode: false,
      selectedTranslations: [identifier],
    });
  };

  const renderTranslationSelector = ({
    selectedIdentifier,
    onChange,
    size,
  }: {
    selectedIdentifier: string;
    onChange: (identifier: string) => void;
    size: 'desktop' | 'mobile';
  }) => {
    const labelClass =
      size === 'desktop'
        ? `block text-xs font-medium mb-1.5 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`
        : `block text-sm font-medium mb-2 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`;
    const selectClass =
      size === 'desktop'
        ? `w-full rounded-md border px-2 py-2 text-xs ${
            settings.theme === 'dark'
              ? 'border-gray-600 bg-gray-700 text-white'
              : 'border-gray-300 bg-white text-gray-900'
          }`
        : `w-full rounded-lg border px-3 py-3 text-sm ${
            settings.theme === 'dark'
              ? 'border-gray-600 bg-gray-700 text-white'
              : 'border-gray-300 bg-white text-gray-900'
          }`;

    return (
      <div>
        <label className={labelClass}>Translation</label>
        <select
          value={selectedIdentifier}
          onChange={(e) => onChange(e.target.value)}
          className={selectClass}
        >
          {translationOptions.map((translation) => (
            <option key={translation.identifier} value={translation.identifier}>
              {getTranslationOptionLabel(translation)}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const orderedTranslations = [...translations].sort((first, second) => {
    const priority = (language: string) => {
      if (language === 'ur') return 0;
      if (language === 'en') return 1;
      return 2;
    };

    return priority(first.edition.language) - priority(second.edition.language);
  });

  const getNowPlayingTitle = () => {
    if (currentPlayingSurah && surahs[currentPlayingSurah - 1]) {
      const surahName = surahs[currentPlayingSurah - 1].englishName;

      if (currentPlaybackTrack === 'translation') {
        return `${surahName} - Translation of Ayah ${currentPlayingAyah || currentQueueIndex + 1}`;
      }

      if (currentPlaybackTrack === 'bismillah') {
        return `${surahName} - Bismillah`;
      }

      return `${surahName} - Ayah ${currentPlayingAyah || currentQueueIndex + 1}`;
    }

    if (selectedAyahForPlay && surahs[selectedAyahForPlay.surah - 1]) {
      return `Selected: ${surahs[selectedAyahForPlay.surah - 1].englishName} ${selectedAyahForPlay.ayah}`;
    }

    if (surahData) {
      return `${surahData.englishName} - ${surahData.name}`;
    }

    return 'Select a Surah';
  };

  const getNowPlayingMeta = () => {
    if (currentPlaybackTrack === 'translation') {
      return `${activeTranslationAudioLabel} voice`;
    }

    if (currentPlaybackTrack === 'bismillah') {
      return 'Opening basmalah';
    }

    if (surahData) {
      return `${surahData.numberOfAyahs} Ayahs • ${surahData.revelationType}`;
    }

    return '';
  };

  const renderAyahTranslations = (ayahIndex: number) => {
    const ayahNumber = ayahIndex + 1;
    const translationSurahNumber = currentSurah ?? surahData?.number;
    const ayahTranslations = orderedTranslations
      .map((translation) => {
        const text = translation.ayahs[ayahIndex]?.text?.trim();
        if (!text) return null;

        const isUrdu = translation.edition.language === 'ur';

        return {
          key: `${translation.edition.identifier}-${ayahIndex}`,
          identifier: translation.edition.identifier,
          text,
          isUrdu,
          direction: translation.edition.direction || (isUrdu ? 'rtl' : 'ltr'),
        };
      })
      .filter(Boolean) as Array<{
      key: string;
      identifier: string;
      text: string;
      isUrdu: boolean;
      direction: 'ltr' | 'rtl';
    }>;

    if (ayahTranslations.length === 0) {
      return null;
    }

    return ayahTranslations.map((translation) => {
      const isCurrentTranslationTrack =
        currentPlaybackTrack === 'translation' &&
        currentPlayingSurah === translationSurahNumber &&
        currentPlayingAyah === ayahNumber &&
        translation.identifier === activeTranslationIdentifier;

      return (
        <div
          key={translation.key}
          className={`mb-3 rounded-2xl border p-4 sm:p-5 ${
            settings.theme === 'dark' ? 'border-gray-700 bg-gray-900/30' : 'border-slate-200 bg-slate-50'
          }`}
        >
          {settings.audioEnabled &&
            settings.translationAudioEnabled &&
            settings.audioMode === 'ayah' &&
            translationSurahNumber &&
            isActiveTranslationAudioSupported && (
            <div className="mb-3 flex justify-end">
              <button
                onClick={() => {
                  if (isCurrentTranslationTrack && isPlaying) {
                    pauseAyah();
                    return;
                  }

                  if (isCurrentTranslationTrack && isPaused) {
                    resumeAyah();
                    return;
                  }

                  void playTranslationAyah(translationSurahNumber, ayahNumber);
                }}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isCurrentTranslationTrack && isPlaying
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : isCurrentTranslationTrack && isPaused
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : settings.theme === 'dark'
                    ? 'bg-gray-800 text-emerald-300 hover:bg-gray-700'
                    : 'bg-white text-emerald-700 hover:bg-emerald-50'
                }`}
                title="Play translation audio"
              >
                {isCurrentTranslationTrack && isPlaying ? (
                  <PauseIcon className="h-3.5 w-3.5" />
                ) : (
                  <SpeakerWaveIcon className="h-3.5 w-3.5" />
                )}
                <span>
                  {isCurrentTranslationTrack && isPlaying
                    ? 'Pause translation'
                    : isCurrentTranslationTrack && isPaused
                    ? 'Resume translation'
                    : 'Play translation'}
                </span>
              </button>
            </div>
          )}

          <p
            dir={translation.direction}
            style={{ fontSize: `${settings.translationFontSize}px` }}
            className={
              translation.isUrdu
                ? `quran-urdu-translation ${
                    settings.theme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                  }`
                : `text-left leading-8 ${
                    settings.theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                  }`
            }
          >
            {translation.text}
          </p>
        </div>
      );
    });
  };

  // Handle ayah click for bookmarking (double-click to open popup)
  const handleAyahClick = (e: React.MouseEvent, surahNum: number, ayahNum: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if clicking the same ayah
    if (selectedAyahForBookmark?.surah === surahNum && selectedAyahForBookmark?.ayah === ayahNum) {
      // Second click - open bookmark popup
      setBookmarkConfirm({
        surahNum,
        ayahNum,
        x: e.clientX,
        y: e.clientY,
      });
      setSelectedAyahForBookmark(null); // Reset selection
    } else {
      // First click - select the ayah
      setSelectedAyahForBookmark({ surah: surahNum, ayah: ayahNum });
    }
  };

  // Confirm bookmark
  const confirmBookmark = () => {
    if (bookmarkConfirm) {
      if (isBookmarked(bookmarkConfirm.surahNum, bookmarkConfirm.ayahNum)) {
        const bookmark = bookmarks.find(
          b => b.surahNumber === bookmarkConfirm.surahNum && b.ayahNumber === bookmarkConfirm.ayahNum
        );
        if (bookmark) removeBookmark(bookmark.id);
      } else {
        addBookmark(bookmarkConfirm.surahNum, bookmarkConfirm.ayahNum, bookmarkConfirm.note, bookmarkConfirm.color);
      }
      setBookmarkConfirm(null);
    }
  };

  // Close popup when clicking outside
  useEffect(() => {
    if (!bookmarkConfirm) return;
    
    // Delay adding the listener to prevent immediate closure
    const timeoutId = setTimeout(() => {
      const handleClickOutside = (e: MouseEvent) => {
        setBookmarkConfirm(null);
      };
      document.addEventListener('click', handleClickOutside, { once: true });
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [bookmarkConfirm]);

  // Track visual viewport height/offset so the mobile bookmark modal stays
  // above the on-screen keyboard on both iOS and Android PWA.
  // Android Chrome fires `window.resize` when the keyboard opens; iOS fires
  // `visualViewport.resize`.  We listen to all three events for full coverage.
  useEffect(() => {
    if (!bookmarkConfirm) {
      setBookmarkModalViewport(null);
      return;
    }
    const vv = window.visualViewport;
    const update = () => {
      if (vv) {
        setBookmarkModalViewport({ height: vv.height, offsetTop: vv.offsetTop });
      } else {
        // Fallback: use window.innerHeight (works on Android when visualViewport is absent)
        setBookmarkModalViewport({ height: window.innerHeight, offsetTop: 0 });
      }
    };
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    // Fallback for Android Chrome which fires window resize on keyboard open/close
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [bookmarkConfirm]);

  const timelineMax = Math.max(audioDuration, audioCurrentTime, 1);
  const timelineValue = Math.min(audioCurrentTime, timelineMax);
  const formatPlayerTime = (seconds: number) => {
    const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    const min = Math.floor(safe / 60);
    const sec = Math.floor(safe % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };

  return (
    <>
      <PageSEO
        title="Quran Reader with Audio, Transliteration and Translation"
        description="Read all 114 surahs with audio recitation, transliteration, multiple translations, IndoPak and Uthmani-style Arabic fonts, bookmarks, and personalized Quran reading settings."
        path="/quran"
        keywords={[
          'quran app',
          'quran reader online',
          'quran with audio',
          'quran transliteration',
          'quran translation',
          'online quran search',
          'indo pak quran font',
          'quran bookmarks',
          'hikmahsphere quran',
        ]}
      />
      <div className={`min-h-screen ${settings.theme === 'dark' ? 'bg-gray-900' : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50'}`}>
      <div className="w-full">
        {/* Header - Desktop */}
        <div className="hidden lg:block text-center mb-3 pt-14">
          <div className="flex items-center justify-center gap-2 mb-1">
            <BookOpenIcon className="h-5 w-5 text-emerald-600" />
            <h1 className={`text-2xl font-bold font-arabic ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              القرآن الكريم
            </h1>
          </div>
          <p className={`text-xs ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Read and explore the Holy Quran with translations
          </p>
        </div>

        {/* Mobile Header - Enhanced with Smooth Auto-Hide */}
        <div className={`lg:hidden pt-4 px-2 sticky z-40 transition-all duration-500 ease-out ${
          showHeader ? 'top-16 opacity-100 scale-100' : '-top-40 opacity-0 scale-95'
        }`}>
          <div className={`${settings.theme === 'dark' ? 'bg-gray-800/95' : 'bg-white/95'} backdrop-blur-md rounded-xl shadow-lg p-2.5 border ${settings.theme === 'dark' ? 'border-gray-700' : 'border-gray-100'} transition-shadow duration-300`}>
            {/* Top Bar - Quick Actions */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <button
                  onClick={openMobileSettings}
                  className={`p-2.5 rounded-xl transition-all active:scale-95 ${
                    settings.theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                  aria-label="Settings"
                >
                  <Cog6ToothIcon className="h-5 w-5 text-emerald-600" />
                </button>
                {/* Theme Toggle Button */}
                <button
                  onClick={() => {
                    const newTheme = settings.theme === 'light' ? 'dark' : 'light';
                    updateSettings({ ...settings, theme: newTheme });
                  }}
                  className={`p-2.5 rounded-xl transition-all active:scale-95 ${
                    settings.theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                  aria-label="Toggle theme"
                  title={settings.theme === 'light' ? 'Switch to Dark' : 'Switch to Light'}
                >
                  {settings.theme === 'light' ? (
                    <MoonIcon className="h-5 w-5 text-indigo-600" />
                  ) : (
                    <SunIcon className="h-5 w-5 text-amber-400" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <BookOpenIcon className="h-5 w-5 text-emerald-600" />
                <h1 className={`text-base font-bold font-arabic ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Al-Quran
                </h1>
              </div>

              <div className="flex items-center gap-2">
                {/* Display Mode Toggle */}
                <button
                  onClick={() => {
                    setDesktopDisplayMode(!settings.arabicOnlyMode);
                  }}
                  className={`p-2.5 rounded-xl transition-all active:scale-95 ${
                    settings.arabicOnlyMode
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : settings.theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                  aria-label="Toggle display mode"
                  title={settings.arabicOnlyMode ? 'Show Translation' : 'Arabic Only'}
                >
                  <BookOpenIcon className="h-5 w-5" />
                </button>
                {/* Search Button */}
                <button
                  onClick={() => setShowSurahSearch(!showSurahSearch)}
                  className={`p-2.5 rounded-xl transition-all active:scale-95 ${
                    settings.theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                  aria-label="Search"
                >
                  <MagnifyingGlassIcon className="h-5 w-5 text-emerald-600" />
                </button>
              </div>
            </div>

            {/* Surah Navigation Bar */}
            <div className="flex items-center gap-1.5">
              {/* Previous Surah Button */}
              <button
                onClick={previousSurah}
                disabled={currentSurah === 1}
                className={`p-2.5 rounded-xl transition-all flex-shrink-0 active:scale-95 ${
                  currentSurah === 1
                    ? 'opacity-50 cursor-not-allowed bg-gray-200 dark:bg-gray-700'
                    : settings.theme === 'dark'
                    ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                    : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                }`}
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>

              {/* Surah Selector with Info */}
              <div className="flex-1 relative">
                <select
                  value={currentSurah || ''}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (value) {
                      goToSurah(value);
                    }
                  }}
                  className={`w-full p-3 pr-10 pl-3 rounded-xl font-semibold appearance-none cursor-pointer text-sm ${
                    settings.theme === 'dark'
                      ? 'bg-gray-700 text-white border-gray-600'
                      : 'bg-gray-50 text-gray-900 border-gray-200'
                  } border-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 active:scale-[0.98] transition-transform`}
                >
                  <option value="" disabled>Select Surah</option>
                  {surahs.map((surah) => (
                    <option key={surah.number} value={surah.number}>
                      {surah.number}. {surah.englishName}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="h-5 w-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {/* Next Surah Button */}
              <button
                onClick={nextSurah}
                disabled={currentSurah === 114}
                className={`p-2.5 rounded-xl transition-all flex-shrink-0 active:scale-95 ${
                  currentSurah === 114
                    ? 'opacity-50 cursor-not-allowed bg-gray-200 dark:bg-gray-700'
                    : settings.theme === 'dark'
                    ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                    : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                }`}
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Surah Info */}
            {surahData && (
              <div className={`mt-2 text-center text-xs ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                <span className="font-medium">{surahData.englishNameTranslation}</span> •
                <span className="ml-1">{surahData.numberOfAyahs} Ayahs</span> •
                <span className="ml-1 capitalize">{surahData.revelationType}</span>
              </div>
            )}
          </div>
        </div>
          
        {/* Enhanced Mobile Surah Search Panel - Fixed Overlay */}
        {showSurahSearch && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => {
                setShowSurahSearch(false);
                setSearchTerm('');
              }}
            />
            
            {/* Search Panel - Fixed at top */}
            <div 
              className={`fixed top-0 left-0 right-0 z-50 ${settings.theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-2xl`}
              style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            >
              {/* Header Bar */}
              <div className={`flex items-center gap-3 p-4 border-b ${settings.theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <MagnifyingGlassIcon className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                <span className={`font-semibold text-lg flex-1 ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Search Surah
                </span>
                <button
                  onClick={() => {
                    setShowSurahSearch(false);
                    setSearchTerm('');
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6 text-gray-500" />
                </button>
              </div>
              
              {/* Search Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-4" style={{ paddingBottom: '2rem' }}>
                {/* Search Bar */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Search by surah name or number..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (e.target.value.trim()) {
                        addToRecentSearches(e.target.value);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchTerm.trim()) {
                        addToRecentSearches(searchTerm);
                      }
                    }}
                    className={`w-full px-4 py-4 text-base border-2 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                      settings.theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    autoFocus
                  />
                </div>

                {/* Search Filters */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                  {(['all', 'surah'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setSearchFilter(filter)}
                      className={`px-4 py-2 rounded-lg text-base font-medium whitespace-nowrap transition-all ${
                        searchFilter === filter
                          ? 'bg-emerald-500 text-white'
                          : settings.theme === 'dark'
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {filter === 'all' ? '📖 All' : '📜 Surah'}
                    </button>
                  ))}
                </div>

                {/* Recent Searches */}
                {recentSearches.length > 0 && !searchTerm && (
                  <div className={`mb-4 p-3 rounded-lg ${settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-medium ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        Recent Searches
                      </span>
                      <button
                        onClick={clearRecentSearches}
                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((term, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSearchTerm(term)}
                          className={`px-3 py-2 rounded-full text-base ${
                            settings.theme === 'dark'
                              ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                              : 'bg-white text-gray-600 hover:bg-gray-100'
                          } border ${settings.theme === 'dark' ? 'border-gray-500' : 'border-gray-200'}`}
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search Results */}
                <div className="space-y-2">
                  {filteredSurahs.length > 0 ? (
                    filteredSurahs.map((surah) => (
                      <button
                        key={surah.number}
                        onClick={() => {
                          goToSurah(surah.number);
                          setShowSurahSearch(false);
                          setSearchTerm('');
                        }}
                        className={`w-full text-left p-4 rounded-xl transition-all active:scale-[0.98] ${
                          currentSurah === surah.number
                            ? settings.theme === 'dark'
                              ? 'bg-emerald-900 text-emerald-100'
                              : 'bg-emerald-100 text-emerald-800'
                            : settings.theme === 'dark'
                            ? 'hover:bg-gray-700 text-white'
                            : 'hover:bg-gray-50 text-gray-900'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-bold px-2.5 py-1.5 rounded-lg min-w-[32px] text-center ${
                              currentSurah === surah.number
                                ? 'bg-emerald-600 text-white'
                                : settings.theme === 'dark'
                                ? 'bg-gray-600 text-gray-300'
                                : 'bg-gray-200 text-gray-600'
                            }`}>
                              {surah.number}
                            </span>
                            <div>
                              <p className={`font-medium text-base ${getFontFamilyClass()}`}>{surah.name}</p>
                              <p className={`text-sm ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                {surah.englishName} • {surah.englishNameTranslation}
                              </p>
                            </div>
                          </div>
                          <span className={`text-sm ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`}>
                            {surah.numberOfAyahs} ayahs
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className={`text-center py-12 ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      <MagnifyingGlassIcon className="h-16 w-16 mx-auto mb-3 opacity-50" />
                      <p className="text-base font-medium">No surahs found</p>
                      <p className="text-sm mt-2">Try a different search term</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Left Sidebar - Settings (Desktop Only) */}
          <div className="hidden lg:block lg:col-span-2">
            <div className={`${settings.theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-3 sticky top-16 max-h-[calc(100vh-5rem)] overflow-y-auto`}>
              <h3 className={`text-base font-bold mb-3 flex items-center gap-2 ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <Cog6ToothIcon className="h-4 w-4 text-emerald-600" />
                Settings
              </h3>

              <div className="space-y-3">
                {/* Arabic Only Mode */}
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Display Mode
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setDesktopDisplayMode(true)}
                      className={`p-2 text-xs rounded-md font-medium transition-colors ${
                        settings.arabicOnlyMode
                          ? 'bg-emerald-500 text-white'
                          : settings.theme === 'dark'
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      Only Arabic
                    </button>
                    <button
                      onClick={() => setDesktopDisplayMode(false)}
                      className={`p-2 text-xs rounded-md font-medium transition-colors ${
                        !settings.arabicOnlyMode
                          ? 'bg-emerald-500 text-white'
                          : settings.theme === 'dark'
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      With Translation
                    </button>
                  </div>
                </div>

                {/* Font Size */}
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Font Size: {settings.fontSize}px
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSettings({ fontSize: Math.max(14, settings.fontSize - 2) })}
                      className={`p-1.5 rounded-md ${settings.theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      <MinusIcon className="h-3 w-3" />
                    </button>
                    <input
                      type="range"
                      min="14"
                      max="38"
                      value={settings.fontSize}
                      onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <button
                      onClick={() => updateSettings({ fontSize: Math.min(38, settings.fontSize + 2) })}
                      className={`p-1.5 rounded-md ${settings.theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      <PlusIcon className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Translation Size: {settings.translationFontSize}px
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSettings({ translationFontSize: Math.max(14, settings.translationFontSize - 1) })}
                      className={`p-1.5 rounded-md ${settings.theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      <MinusIcon className="h-3 w-3" />
                    </button>
                    <input
                      type="range"
                      min="14"
                      max="26"
                      value={settings.translationFontSize}
                      onChange={(e) => updateSettings({ translationFontSize: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <button
                      onClick={() => updateSettings({ translationFontSize: Math.min(26, settings.translationFontSize + 1) })}
                      className={`p-1.5 rounded-md ${settings.theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      <PlusIcon className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Theme Toggle */}
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Theme
                  </label>
                  <button
                    onClick={() => {
                      const newTheme = settings.theme === 'light' ? 'dark' : 'light';
                      updateSettings({ theme: newTheme });
                      // Dispatch custom event for same-tab navbar update
                      setTimeout(() => {
                        window.dispatchEvent(new Event('quranSettingsChanged'));
                      }, 0);
                    }}
                    className={`w-full flex items-center justify-between p-2 text-sm rounded-md ${
                      settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    }`}
                  >
                    <span className={settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                      {settings.theme === 'light' ? 'Light' : 'Dark'}
                    </span>
                    {settings.theme === 'light' ? (
                      <SunIcon className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <MoonIcon className="h-4 w-4 text-blue-400" />
                    )}
                  </button>
                </div>

                {/* Arabic Font Family */}
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Arabic Font
                  </label>
                  <select
                    value={settings.arabicFont}
                    onChange={(e) => updateSettings({ arabicFont: e.target.value as any })}
                    className={`w-full p-2.5 text-sm rounded-lg border ${
                      settings.theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="al-mushaf">Al Mushaf - Authentic Quranic Script</option>
                    <option value="indopak-nastaleeq">IndoPak Nastaleeq (South India) - Default</option>
                    <option value="indopak-nastaleeq-v2">IndoPak Nastaleeq v2 - (Tajweed)</option>
                    <option value="amiri">Amiri - Traditional Naskh</option>
                    <option value="scheherazade">Scheherazade - Classic Book Style</option>
                    <option value="noto-naskh">Noto Naskh - Clear & Readable</option>
                    <option value="cairo">Cairo - Modern Geometric</option>
                    <option value="lateef">Lateef - Elegant Cursive</option>
                    <option value="reem-kufi">Reem Kufi - Beautiful Kufic Style</option>
                  </select>
                </div>

                {/* Font Color */}
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Font Color
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    <button
                      onClick={() => updateSettings({ fontColor: 'default' })}
                      className={`h-10 rounded-md border-2 flex items-center justify-center ${
                        settings.fontColor === 'default' ? 'border-emerald-500' : 'border-gray-300'
                      } ${settings.theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-800'}`}
                      title="Default"
                    >
                      <span className="text-xs font-bold">Aa</span>
                    </button>
                    <button
                      onClick={() => updateSettings({ fontColor: 'emerald' })}
                      className={`h-10 rounded-md border-2 ${
                        settings.fontColor === 'emerald' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-white flex items-center justify-center`}
                      title="Emerald"
                    >
                      <span className="text-xs font-bold text-emerald-600">Aa</span>
                    </button>
                    <button
                      onClick={() => updateSettings({ fontColor: 'blue' })}
                      className={`h-10 rounded-md border-2 ${
                        settings.fontColor === 'blue' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-white flex items-center justify-center`}
                      title="Blue"
                    >
                      <span className="text-xs font-bold text-blue-600">Aa</span>
                    </button>
                    <button
                      onClick={() => updateSettings({ fontColor: 'amber' })}
                      className={`h-10 rounded-md border-2 ${
                        settings.fontColor === 'amber' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-white flex items-center justify-center`}
                      title="Amber"
                    >
                      <span className="text-xs font-bold text-amber-600">Aa</span>
                    </button>
                    <button
                      onClick={() => updateSettings({ fontColor: 'rose' })}
                      className={`h-10 rounded-md border-2 ${
                        settings.fontColor === 'rose' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-white flex items-center justify-center`}
                      title="Rose"
                    >
                      <span className="text-xs font-bold text-rose-600">Aa</span>
                    </button>
                  </div>
                </div>

                {/* Reader Background */}
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Reader Background
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    <button
                      onClick={() => updateSettings({ readerBackground: 'default' })}
                      className={`h-10 rounded-md border-2 ${
                        settings.readerBackground === 'default' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center`}
                      title="Default Gradient"
                    >
                      <span className="text-xs font-bold text-gray-700">●</span>
                    </button>
                    <button
                      onClick={() => updateSettings({ readerBackground: 'white' })}
                      className={`h-10 rounded-md border-2 ${
                        settings.readerBackground === 'white' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-white flex items-center justify-center`}
                      title="White"
                    >
                      <span className="text-xs font-bold text-gray-700">●</span>
                    </button>
                    <button
                      onClick={() => updateSettings({ readerBackground: 'cream' })}
                      className={`h-10 rounded-md border-2 ${
                        settings.readerBackground === 'cream' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-amber-50 flex items-center justify-center`}
                      title="Cream"
                    >
                      <span className="text-xs font-bold text-gray-700">●</span>
                    </button>
                    <button
                      onClick={() => updateSettings({ readerBackground: 'blue' })}
                      className={`h-10 rounded-md border-2 ${
                        settings.readerBackground === 'blue' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-blue-50 flex items-center justify-center`}
                      title="Light Blue"
                    >
                      <span className="text-xs font-bold text-gray-700">●</span>
                    </button>
                    <button
                      onClick={() => updateSettings({ readerBackground: 'green' })}
                      className={`h-10 rounded-md border-2 ${
                        settings.readerBackground === 'green' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-emerald-50 flex items-center justify-center`}
                      title="Soft Green"
                    >
                      <span className="text-xs font-bold text-gray-700">●</span>
                    </button>
                  </div>
                </div>

                {/* Transliteration Toggle - only show if not in Arabic-only mode */}
                {!settings.arabicOnlyMode && (
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      Transliteration
                    </label>
                    <button
                      onClick={() => updateSettings({ showTransliteration: !settings.showTransliteration })}
                      className={`w-full flex items-center justify-between p-2 text-sm rounded-md ${
                        settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      }`}
                    >
                      <span className={settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {settings.showTransliteration ? 'On' : 'Off'}
                      </span>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        settings.showTransliteration
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-gray-400'
                      }`}>
                        {settings.showTransliteration && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  </div>
                )}

                {renderTranslationSelector({
                  selectedIdentifier: activeTranslationIdentifier,
                  onChange: selectDesktopTranslation,
                  size: 'desktop',
                })}

                {/* Audio Settings */}
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Audio Playback
                  </label>
                  <button
                    onClick={() => updateSettings({ audioEnabled: !settings.audioEnabled })}
                    className={`w-full flex items-center justify-between p-2 text-sm rounded-md ${
                      settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    }`}
                  >
                    <span className={settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                      {settings.audioEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      settings.audioEnabled
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-gray-400'
                    }`}>
                      {settings.audioEnabled && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                  
                  {settings.audioEnabled && (
                    <div className="mt-2 space-y-2">
                      <label className={`block text-xs ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        Audio Mode
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => updateSettings({ audioMode: 'ayah' })}
                          className={`p-1.5 text-xs rounded-md transition-colors ${
                            settings.audioMode === 'ayah'
                              ? 'bg-emerald-500 text-white'
                              : settings.theme === 'dark'
                              ? 'bg-gray-600 text-gray-300'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          Ayat by Ayat
                        </button>
                        <button
                          onClick={() => updateSettings({ audioMode: 'surah' })}
                          className={`p-1.5 text-xs rounded-md transition-colors ${
                            settings.audioMode === 'surah'
                              ? 'bg-emerald-500 text-white'
                              : settings.theme === 'dark'
                              ? 'bg-gray-600 text-gray-300'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          Complete Surah
                        </button>
                      </div>
                      {!settings.arabicOnlyMode && (
                        <div className="space-y-1.5">
                          <label className={`block text-xs ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            Translation Audio
                          </label>
                          <button
                            onClick={() => updateSettings({ translationAudioEnabled: !settings.translationAudioEnabled })}
                            className={`w-full flex items-center justify-between p-2 text-sm rounded-md ${
                              settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                            }`}
                          >
                            <span className={settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                              {settings.translationAudioEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              settings.translationAudioEnabled
                                ? 'bg-emerald-500 border-emerald-500'
                                : 'border-gray-400'
                            }`}>
                              {settings.translationAudioEnabled && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                          <p className={`text-[11px] leading-relaxed ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            Recorded translation audio is currently available for Urdu - Fateh Muhammad Jalandhry and English - Saheeh International.
                          </p>
                          {!isActiveTranslationAudioSupported && (
                            <p className={`text-[11px] leading-relaxed ${settings.theme === 'dark' ? 'text-amber-300' : 'text-amber-700'}`}>
                              The currently selected translation does not have recorded audio yet.
                            </p>
                          )}
                          <p className={`text-[11px] leading-relaxed ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            {settings.audioMode === 'ayah'
                              ? 'In Ayat by Ayat mode, tap the Arabic ayah for recitation and the translation card for that ayah.'
                              : 'In Complete Surah mode, the selected translation plays automatically after each Arabic ayah.'}
                          </p>
                        </div>
                      )}
                      {showDesktopIndopakAyahWarning && (
                        <div className="group relative mt-2">
                          <div
                            className={`inline-flex cursor-help items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${
                              settings.theme === 'dark'
                                ? 'border-amber-500/60 bg-amber-900/30 text-amber-200'
                                : 'border-amber-300 bg-amber-50 text-amber-700'
                            }`}
                            title={indopakAyahWarningText}
                          >
                            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                            Compatibility warning
                          </div>
                          <div
                            className={`pointer-events-none absolute left-0 top-full z-10 mt-1 w-64 rounded-md px-2 py-1.5 text-[11px] shadow-lg opacity-0 transition-opacity group-hover:opacity-100 ${
                              settings.theme === 'dark'
                                ? 'bg-gray-900 text-amber-100'
                                : 'bg-gray-900 text-white'
                            }`}
                          >
                            {indopakAyahWarningText}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bookmarks */}
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    <BookmarkIcon className="h-3 w-3 inline mr-1" />
                    Bookmarks
                  </label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {bookmarks.length > 0 ? (
                      bookmarks.map((bookmark) => (
                        <div
                          key={bookmark.id}
                          className={`p-2 rounded-md border-l-4 ${getBookmarkListClass(bookmark.color)}`}
                        >
                          <div className="flex items-start justify-between">
                            <button
                              onClick={() => {
                                goToSurah(bookmark.surahNumber);
                                // iOS needs longer delay for DOM to settle
                                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                                const delay = isIOS ? 1000 : 600;
                                setTimeout(() => scrollToAyahNumber(bookmark.ayahNumber), delay);
                              }}
                              className="text-left flex-1"
                            >
                              <p className={`text-sm font-medium ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {bookmark.surahName}
                              </p>
                              <p className={`text-xs ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                Ayah {bookmark.ayahNumber}
                              </p>
                              {bookmark.note && (
                                <p className={`text-xs mt-1 italic ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                  "{bookmark.note}"
                                </p>
                              )}
                            </button>
                            <button
                              onClick={() => removeBookmark(bookmark.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <XMarkIcon className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className={`text-center py-2 text-xs ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        No bookmarks yet
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Middle - Quran Content */}
          <div className="lg:col-span-8">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <LoadingSpinner />
              </div>
            ) : surahData ? (
              <div className={`${settings.theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-4`}>
                {/* Bismillah (except for Surah 9) */}
                {surahData.number !== 9 && (
                  <div className="text-center mb-6 py-3">
                    <p className={`text-2xl ${getFontFamilyClass()} text-emerald-600 leading-loose mb-4`}>
                      بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                    </p>
                    {/* Beautiful Islamic Divider */}
                    <div className="flex items-center justify-center gap-3">
                      <div className="h-px w-16 sm:w-24 bg-gradient-to-r from-transparent via-emerald-400 to-emerald-500"></div>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-2 h-2 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                        </svg>
                        <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                      <div className="h-px w-16 sm:w-24 bg-gradient-to-l from-transparent via-emerald-400 to-emerald-500"></div>
                    </div>
                  </div>
                )}

                {/* Desktop Top Audio Player Card - Only visible in Complete Surah mode */}
                {settings.audioEnabled && settings.audioMode === 'surah' && (
                  <div className="hidden lg:block mb-6">
                    <div className={`p-4 rounded-lg ${settings.theme === 'dark' ? 'bg-gray-700' : 'bg-emerald-50'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isAudioLoading
                              ? 'bg-blue-500 text-white animate-pulse'
                              : isPlaying
                              ? 'bg-emerald-500 text-white'
                              : isPaused
                              ? 'bg-amber-500 text-white'
                              : selectedAyahForPlay
                              ? 'bg-emerald-600 text-white'
                              : settings.theme === 'dark'
                              ? 'bg-gray-600 text-emerald-400'
                              : 'bg-emerald-200 text-emerald-700'
                          }`}>
                            {isAudioLoading ? (
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : isPlaying ? (
                              <PauseIcon className="h-5 w-5" />
                            ) : (
                              <SpeakerWaveIcon className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <h3 className={`text-base font-bold ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              {getNowPlayingTitle()}
                            </h3>
                            <p className={`text-sm ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                              {getNowPlayingMeta()}
                              {isAudioLoading && <span className="ml-2 text-blue-500">(Loading...)</span>}
                              {isPaused && <span className="ml-2 text-amber-500">(Paused)</span>}
                              {selectedAyahForPlay && !isPlaying && !isPaused && <span className="ml-2 text-emerald-500">Ready to play</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(isPlaying || isPaused) && (
                            <>
                              <button
                                onClick={stopAyah}
                                className={`p-2 rounded-lg transition-colors ${
                                  settings.theme === 'dark'
                                    ? 'bg-gray-600 hover:bg-gray-500 text-white'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                }`}
                                title="Stop"
                              >
                                <XMarkIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (isPlaying) {
                                    pauseAyah();
                                  } else {
                                    resumeAyah();
                                  }
                                }}
                                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                                  isPlaying
                                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                }`}
                              >
                                {isPlaying ? 'Pause' : 'Resume'}
                              </button>
                            </>
                          )}
                          {!isPlaying && !isPaused && !isAudioLoading && (
                            <button
                              onClick={() => {
                                if (selectedAyahForPlay && currentSurah) {
                                  playAyah(currentSurah, selectedAyahForPlay.ayah);
                                } else if (settings.audioMode === 'surah' && surahData) {
                                  playSurah(surahData.number);
                                }
                                // In ayat mode without selection, do nothing
                              }}
                              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                                selectedAyahForPlay
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : settings.audioMode === 'surah'
                                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                  : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                              }`}
                              disabled={!selectedAyahForPlay && settings.audioMode !== 'surah'}
                            >
                              {selectedAyahForPlay ? `Play Ayah ${selectedAyahForPlay.ayah}` : settings.audioMode === 'surah' ? 'Play Surah' : 'Select Ayah to Play'}
                            </button>
                          )}
                          {isAudioLoading && (
                            <span className="px-4 py-2 text-sm text-blue-500">Loading...</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ayahs - Indopak Mode */}
                {settings.arabicFont === 'indopak-nastaleeq' && indopakSurah ? (
                  settings.arabicOnlyMode ? (
                    /* Continuous Indopak Arabic text */
                    <div className={`p-3 rounded-lg ${getReaderBackgroundClass()}`}>
                      <p
                        className={`${getFontFamilyClass()} leading-loose text-right ${getFontColorClass()}`}
                        style={{ fontSize: `${getActualFontSize()}px`, lineHeight: getActualLineHeight() }}
                        dir="rtl"
                      >
                        {indopakSurah.ayahs.map((ayah, index) => {
                          const ayahNum = ayah.ayah;
                          const isFirstAyahFatiha = surahData?.number === 1 && ayahNum === 1;
                          if (isFirstAyahFatiha) return null;

                          const bookmarkColor = getBookmarkColor(surahData.number, ayahNum);
                          const bgClass = getBookmarkBackgroundClass(bookmarkColor);
                          const borderClass = getBookmarkBorderClass(bookmarkColor);
                          const isSelectedForBookmark = selectedAyahForBookmark?.surah === surahData.number && selectedAyahForBookmark?.ayah === ayahNum;

                          return (
                            <span key={ayahNum}>
                              <span
                                onClick={(e) => handleAyahClick(e, surahData.number, ayahNum)}
                                className={`cursor-pointer rounded px-1 ${getBookmarkHoverClass(bookmarkColor)} ${bgClass} ${isSelectedForBookmark ? getBookmarkSelectionClass(bookmarkColor) : ''}`}
                              >
                                {formatIndopakAyahText(
                                  removeBismillah(ayah.text, surahData.number, ayahNum),
                                  `indopak-inline-${ayahNum}`
                                )}
                              </span>
                              {' '}
                              <span
                                id={`ayah-${ayahNum}`}
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full border-2 text-xs font-bold mx-1 ${borderClass}`}
                              >
                                {ayahNum}
                              </span>
                              {index < indopakSurah.ayahs.filter(a => !(surahData?.number === 1 && a.ayah === 1)).length - 1 && ' '}
                            </span>
                          );
                        })}
                      </p>
                    </div>
                  ) : (
                    /* Separate Indopak ayahs with translations */
                    <div className="space-y-4">
                      {indopakSurah.ayahs.map((ayah) => {
                        const ayahNum = ayah.ayah;
                        const isFirstAyahFatiha = surahData?.number === 1 && ayahNum === 1;
                        if (isFirstAyahFatiha) return null;
                        
                        return (
                          <div
                            key={ayahNum}
                            id={`ayah-${ayahNum}`}
                            className={`pb-5 border-b last:border-b-0 ${
                              settings.theme === 'dark' ? 'border-gray-700/80' : 'border-emerald-100'
                            }`}
                          >
                            {/* Arabic Text */}
                            <div className={`relative mb-4 overflow-hidden rounded-2xl p-4 sm:p-6 ${getReaderBackgroundClass()}`}>
                              <div className="w-full">
                                <p
                                  className={`${getFontFamilyClass()} block text-right leading-loose ${getFontColorClass()}`}
                                  style={{ fontSize: `${getActualFontSize()}px`, lineHeight: getActualLineHeight() }}
                                  dir="rtl"
                                >
                                  {(() => {
                                    const bookmarkColor = getBookmarkColor(surahData.number, ayahNum);
                                    const bgClass = getBookmarkBackgroundClass(bookmarkColor);
                                    const borderClass = getBookmarkBorderClass(bookmarkColor);
                                    const isSelectedForBookmark =
                                      selectedAyahForBookmark?.surah === surahData.number &&
                                      selectedAyahForBookmark?.ayah === ayahNum;

                                    return (
                                      <>
                                        {settings.audioEnabled && settings.audioMode === 'ayah' && currentSurah && (
                                          <>
                                            <button
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (isPlaying && currentPlayingAyah === ayahNum) {
                                                  pauseAyah();
                                                } else {
                                                  playAyah(currentSurah, ayahNum);
                                                }
                                              }}
                                              className={`inline-flex h-7 w-7 align-middle items-center justify-center rounded-full mx-1 transition-colors ${
                                                isPlaying && currentPlayingAyah === ayahNum
                                                  ? 'bg-emerald-500 text-white'
                                                  : settings.theme === 'dark'
                                                  ? 'bg-gray-700 hover:bg-gray-600 text-emerald-400'
                                                  : 'bg-white text-emerald-600 shadow-sm hover:bg-emerald-50'
                                              }`}
                                              title={isPlaying && currentPlayingAyah === ayahNum ? 'Pause' : 'Play'}
                                            >
                                              {isPlaying && currentPlayingAyah === ayahNum ? (
                                                <PauseIcon className="h-4 w-4" />
                                              ) : (
                                                <PlayIcon className="h-4 w-4" />
                                              )}
                                            </button>
                                            {' '}
                                          </>
                                        )}
                                        <span
                                          onClick={(e) => handleAyahClick(e, surahData.number, ayahNum)}
                                          className={`cursor-pointer rounded px-1 ${getBookmarkHoverClass(bookmarkColor)} ${bgClass} ${isSelectedForBookmark ? getBookmarkSelectionClass(bookmarkColor) : ''}`}
                                        >
                                          {formatIndopakAyahText(
                                            removeBismillah(ayah.text, surahData.number, ayahNum),
                                            `indopak-block-${ayahNum}`
                                          )}
                                        </span>
                                        {' '}
                                        <span
                                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full border-2 text-xs font-bold mx-1 ${borderClass}`}
                                        >
                                          {ayahNum}
                                        </span>
                                      </>
                                    );
                                  })()}
                                </p>
                              </div>
                            </div>

                            {/* Transliteration */}
                            {settings.showTransliteration && transliteration && (
                              <div className="mb-2">
                                <p className={`text-xs font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                  Transliteration
                                </p>
                                <p className={`text-sm italic leading-relaxed ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                  {transliteration.ayahs[ayahNum - 1]?.text}
                                </p>
                              </div>
                            )}

                            {/* Translations */}
                            {renderAyahTranslations(ayahNum - 1)}
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : settings.arabicOnlyMode ? (
                  /* Continuous Arabic text in Arabic-only mode */
                  <div className={`p-3 rounded-lg ${getReaderBackgroundClass()}`}>
                    <p
                      className={`${getFontFamilyClass()} leading-loose text-right ${getFontColorClass()}`}
                      style={{ fontSize: `${getActualFontSize()}px`, lineHeight: getActualLineHeight() }}
                      dir="rtl"
                    >
                      {surahData.ayahs
                        .filter(ayah => !(surahData.number === 1 && ayah.numberInSurah === 1))
                        .map((ayah, index) => {
                          const bookmarkColor = getBookmarkColor(surahData.number, ayah.numberInSurah);
                          const bgClass = getBookmarkBackgroundClass(bookmarkColor);
                          const borderClass = getBookmarkBorderClass(bookmarkColor);
                          const isSelectedForPlay = selectedAyahForPlay?.surah === surahData.number && selectedAyahForPlay?.ayah === ayah.numberInSurah;
                          const isSelectedForBookmark = selectedAyahForBookmark?.surah === surahData.number && selectedAyahForBookmark?.ayah === ayah.numberInSurah;

                          return (
                            <span key={ayah.numberInSurah}>
                              <span
                                onClick={(e) => handleAyahClick(e, surahData.number, ayah.numberInSurah)}
                                className={`cursor-pointer rounded px-1 ${getBookmarkHoverClass(bookmarkColor)} ${bgClass} ${isSelectedForBookmark ? getBookmarkSelectionClass(bookmarkColor) : ''}`}
                              >
                                {settings.arabicFont === 'indopak-nastaleeq-v2'
                                  ? stripIndopakV2AyahEndMarker(ayah.text)
                                  : removeBismillah(ayah.text, surahData.number, ayah.numberInSurah)}
                              </span>
                              {' '}
                              {/* Play button for Arabic-only mode - BEFORE ayah number */}
                              {settings.audioEnabled && settings.audioMode === 'ayah' && currentSurah && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (isSelectedForPlay) {
                                      // If already selected, play it
                                      playAyah(currentSurah, ayah.numberInSurah);
                                    } else {
                                      // Select this ayah
                                      setSelectedAyahForPlay({ surah: currentSurah, ayah: ayah.numberInSurah });
                                    }
                                  }}
                                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full mx-1 transition-colors ${
                                    isSelectedForPlay
                                      ? 'bg-emerald-500 text-white'
                                      : settings.theme === 'dark'
                                      ? 'bg-gray-700 text-emerald-400 hover:bg-gray-600'
                                      : 'bg-gray-200 text-emerald-600 hover:bg-gray-300'
                                  }`}
                                  title={isSelectedForPlay ? 'Play selected ayah' : 'Select ayah for playback'}
                                >
                                  {isSelectedForPlay ? (
                                    <PlayIcon className="h-3 w-3" />
                                  ) : (
                                    <SpeakerWaveIcon className="h-3 w-3" />
                                  )}
                                </button>
                              )}
                              <span
                                id={`ayah-${ayah.numberInSurah}`}
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full border-2 text-xs font-bold ${borderClass}`}
                              >
                                {ayah.numberInSurah}
                              </span>
                              {index < surahData.ayahs.filter(a => !(surahData.number === 1 && a.numberInSurah === 1)).length - 1 && ' '}
                            </span>
                          );
                        })}
                    </p>
                  </div>
                ) : (
                  /* Separate ayahs with translations */
                  <div className="space-y-4">
                    {surahData.ayahs
                      .filter(ayah => !(surahData.number === 1 && ayah.numberInSurah === 1))
                      .map((ayah) => (
                      <div
                        key={ayah.numberInSurah}
                        id={`ayah-${ayah.numberInSurah}`}
                        className={`pb-5 border-b last:border-b-0 ${
                          settings.theme === 'dark' ? 'border-gray-700/80' : 'border-emerald-100'
                        }`}
                      >
                        {/* Arabic Text with inline ayah number */}
                        <div
                          className={`relative mb-4 overflow-hidden rounded-2xl p-4 sm:p-6 ${getReaderBackgroundClass()}`}
                        >
                          <div className="w-full">
                            <p
                              className={`${getFontFamilyClass()} block text-right leading-loose ${getFontColorClass()}`}
                              style={{ fontSize: `${getActualFontSize()}px`, lineHeight: getActualLineHeight() }}
                              dir="rtl"
                            >
                              {(() => {
                                const bookmarkColor = getBookmarkColor(surahData.number, ayah.numberInSurah);
                                const bgClass = getBookmarkBackgroundClass(bookmarkColor);
                                const borderClass = getBookmarkBorderClass(bookmarkColor);
                                const isSelectedForBookmark = selectedAyahForBookmark?.surah === surahData.number && selectedAyahForBookmark?.ayah === ayah.numberInSurah;

                                return (
                                  <>
                                    {settings.audioEnabled && settings.audioMode === 'ayah' && currentSurah && (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (isPlaying && currentPlayingAyah === ayah.numberInSurah) {
                                              pauseAyah();
                                            } else {
                                              playAyah(currentSurah, ayah.numberInSurah);
                                            }
                                          }}
                                          className={`inline-flex h-7 w-7 align-middle items-center justify-center rounded-full mx-1 transition-colors ${
                                            isPlaying && currentPlayingAyah === ayah.numberInSurah
                                              ? 'bg-emerald-500 text-white'
                                              : settings.theme === 'dark'
                                              ? 'bg-gray-700 hover:bg-gray-600 text-emerald-400'
                                              : 'bg-white text-emerald-600 shadow-sm hover:bg-emerald-50'
                                          }`}
                                          title={isPlaying && currentPlayingAyah === ayah.numberInSurah ? 'Pause' : 'Play Ayah'}
                                        >
                                          {isPlaying && currentPlayingAyah === ayah.numberInSurah ? (
                                            <PauseIcon className="h-4 w-4" />
                                          ) : (
                                            <PlayIcon className="h-4 w-4" />
                                          )}
                                        </button>
                                        {' '}
                                      </>
                                    )}
                                    <span
                                      onClick={(e) => handleAyahClick(e, surahData.number, ayah.numberInSurah)}
                                      className={`cursor-pointer rounded px-1 ${getBookmarkHoverClass(bookmarkColor)} ${bgClass} ${isSelectedForBookmark ? getBookmarkSelectionClass(bookmarkColor) : ''}`}
                                    >
                                      {settings.arabicFont === 'indopak-nastaleeq-v2'
                                        ? stripIndopakV2AyahEndMarker(ayah.text)
                                        : removeBismillah(ayah.text, surahData.number, ayah.numberInSurah)}
                                    </span>
                                    {' '}
                                    <span
                                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full border-2 text-xs font-bold mx-1 ${borderClass}`}
                                    >
                                      {ayah.numberInSurah}
                                    </span>
                                  </>
                                );
                              })()}
                            </p>
                          </div>
                        </div>

                        {/* Transliteration - only if not Arabic-only mode */}
                        {settings.showTransliteration && transliteration && (
                          <div className="mb-2">
                            <p className={`text-xs font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                              Transliteration
                            </p>
                            <p className={`text-sm italic leading-relaxed ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                              {transliteration.ayahs[ayah.numberInSurah - 1]?.text}
                            </p>
                          </div>
                        )}

                        {/* Translations */}
                        {renderAyahTranslations(ayah.numberInSurah - 1)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className={`${settings.theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-8 text-center`}>
                <BookOpenIcon className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
                <p className={`text-base ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Select a surah to start reading
                </p>
              </div>
            )}
          </div>

          {/* Right Sidebar - Surah List (Desktop Only) */}
          <div className="hidden lg:block lg:col-span-2">
            <div className={`${settings.theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-3 sticky top-16 max-h-[calc(100vh-5rem)] overflow-y-auto`}>
              <h3 className={`text-base font-bold mb-3 flex items-center gap-2 ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <BookOpenIcon className="h-4 w-4 text-emerald-600" />
                Surahs
              </h3>

              {/* Search Bar */}
              <div className="relative mb-3">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search surahs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-3 py-2 text-base border rounded-md focus:ring-emerald-500 focus:border-emerald-500 ${
                    settings.theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'border-gray-300'
                  }`}
                />
              </div>

              {/* Surah List */}
              <div className="space-y-1">
                {filteredSurahs.map((surah) => (
                  <button
                    key={surah.number}
                    onClick={() => goToSurah(surah.number)}
                    className={`w-full text-left p-2 rounded-md transition-colors ${
                      currentSurah === surah.number
                        ? settings.theme === 'dark'
                          ? 'bg-emerald-900 text-emerald-100'
                          : 'bg-emerald-100 text-emerald-800'
                        : settings.theme === 'dark'
                        ? 'hover:bg-gray-700 text-white'
                        : 'hover:bg-gray-50 text-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-medium ${
                            currentSurah === surah.number
                              ? 'text-emerald-600'
                              : settings.theme === 'dark'
                              ? 'text-gray-400'
                              : 'text-gray-500'
                          }`}>
                            {surah.number}
                          </span>
                          <p className={`font-medium ${getFontFamilyClass()} text-base`}>{surah.name}</p>
                        </div>
                        <p className={`text-xs ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                          {surah.englishName}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`}>
                          {surah.numberOfAyahs}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Settings Modal - Enhanced with Tabs */}
      {showMobileSettings && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
            onClick={cancelMobileSettings}
          ></div>

          {/* Modal Content - Slide up from bottom */}
          <div className={`absolute bottom-0 left-0 right-0 ${settings.theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col animate-slide-up`}>
            {/* Handle Bar */}
            <div className="flex items-center justify-center pt-3 pb-2">
              <div className={`w-12 h-1.5 ${settings.theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'} rounded-full`}></div>
            </div>

            {/* Header with Tabs */}
            <div className={`px-4 py-3 border-b ${settings.theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-lg font-bold flex items-center gap-2 ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  <Cog6ToothIcon className="h-5 w-5 text-emerald-600" />
                  Settings
                </h3>
                <button
                  onClick={cancelMobileSettings}
                  className={`p-2 rounded-lg ${settings.theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                  aria-label="Close settings"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {[
                  { id: 'display', label: '📱 Display', icon: SunIcon },
                  { id: 'audio', label: '🔊 Audio', icon: SpeakerWaveIcon },
                  { id: 'bookmarks', label: '🔖 Bookmarks', icon: BookmarkIcon },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSettingsTab(tab.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      settingsTab === tab.id
                        ? 'bg-emerald-500 text-white'
                        : settings.theme === 'dark'
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {/* Display Tab Content */}
                {settingsTab === 'display' && (
                  <>
                {/* Arabic Only Mode */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Display Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setMobileDisplayMode(true)}
                      className={`p-3 text-sm rounded-lg font-medium transition-colors ${
                        tempSettings.arabicOnlyMode
                          ? 'bg-emerald-500 text-white'
                          : settings.theme === 'dark'
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      Only Arabic
                    </button>
                    <button
                      onClick={() => setMobileDisplayMode(false)}
                      className={`p-3 text-sm rounded-lg font-medium transition-colors ${
                        !tempSettings.arabicOnlyMode
                          ? 'bg-emerald-500 text-white'
                          : settings.theme === 'dark'
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      With Translation
                    </button>
                  </div>
                </div>

                {/* Font Size */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Font Size: {tempSettings.fontSize}px
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateSingleSetting('fontSize', Math.max(14, tempSettings.fontSize - 2))}
                      className={`p-2 rounded-lg ${settings.theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </button>
                    <input
                      type="range"
                      min="14"
                      max="38"
                      value={tempSettings.fontSize}
                      onChange={(e) => updateSingleSetting('fontSize', parseInt(e.target.value))}
                      className="flex-1 h-2"
                    />
                    <button
                      onClick={() => updateSingleSetting('fontSize', Math.min(38, tempSettings.fontSize + 2))}
                      className={`p-2 rounded-lg ${settings.theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Translation Size: {tempSettings.translationFontSize}px
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateSingleSetting('translationFontSize', Math.max(14, tempSettings.translationFontSize - 1))}
                      className={`p-2 rounded-lg ${settings.theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </button>
                    <input
                      type="range"
                      min="14"
                      max="26"
                      value={tempSettings.translationFontSize}
                      onChange={(e) => updateSingleSetting('translationFontSize', parseInt(e.target.value))}
                      className="flex-1 h-2"
                    />
                    <button
                      onClick={() => updateSingleSetting('translationFontSize', Math.min(26, tempSettings.translationFontSize + 1))}
                      className={`p-2 rounded-lg ${settings.theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Theme Toggle */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Theme
                  </label>
                  <button
                    onClick={() => updateSingleSetting('theme', tempSettings.theme === 'light' ? 'dark' : 'light')}
                    className={`w-full flex items-center justify-between p-3 rounded-lg ${
                      settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                    }`}
                  >
                    <span className={settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                      {tempSettings.theme === 'light' ? 'Light' : 'Dark'}
                    </span>
                    {tempSettings.theme === 'light' ? (
                      <SunIcon className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <MoonIcon className="h-5 w-5 text-blue-400" />
                    )}
                  </button>
                </div>

                {/* Arabic Font Family */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Arabic Font
                  </label>
                  <select
                    value={tempSettings.arabicFont}
                    onChange={(e) => updateSingleSetting('arabicFont', e.target.value as any)}
                    className={`w-full p-3 rounded-lg border ${
                      settings.theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="al-mushaf">Al Mushaf - Authentic Quranic Script</option>
                    <option value="indopak-nastaleeq">IndoPak Nastaleeq (South India) - Default</option>
                    <option value="indopak-nastaleeq-v2">IndoPak Nastaleeq v2 - (Tajweed)</option>
                    <option value="amiri">Amiri - Traditional Naskh</option>
                    <option value="scheherazade">Scheherazade - Classic Book Style</option>
                    <option value="noto-naskh">Noto Naskh - Clear & Readable</option>
                    <option value="cairo">Cairo - Modern Geometric</option>
                    <option value="lateef">Lateef - Elegant Cursive</option>
                    <option value="reem-kufi">Reem Kufi - Beautiful Kufic Style</option>
                  </select>
                </div>

                {/* Font Color */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Font Color
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    <button
                      onClick={() => updateSingleSetting('fontColor', 'default')}
                      className={`h-12 rounded-lg border-2 flex items-center justify-center ${
                        tempSettings.fontColor === 'default' ? 'border-emerald-500' : 'border-gray-300'
                      } ${settings.theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-800'}`}
                      title="Default"
                    >
                      <span className="text-sm font-bold">Aa</span>
                    </button>
                    <button
                      onClick={() => updateSingleSetting('fontColor', 'emerald')}
                      className={`h-12 rounded-lg border-2 ${
                        tempSettings.fontColor === 'emerald' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-white flex items-center justify-center`}
                      title="Emerald"
                    >
                      <span className="text-sm font-bold text-emerald-600">Aa</span>
                    </button>
                    <button
                      onClick={() => updateSingleSetting('fontColor', 'blue')}
                      className={`h-12 rounded-lg border-2 ${
                        tempSettings.fontColor === 'blue' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-white flex items-center justify-center`}
                      title="Blue"
                    >
                      <span className="text-sm font-bold text-blue-600">Aa</span>
                    </button>
                    <button
                      onClick={() => updateSingleSetting('fontColor', 'amber')}
                      className={`h-12 rounded-lg border-2 ${
                        tempSettings.fontColor === 'amber' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-white flex items-center justify-center`}
                      title="Amber"
                    >
                      <span className="text-sm font-bold text-amber-600">Aa</span>
                    </button>
                    <button
                      onClick={() => updateSingleSetting('fontColor', 'rose')}
                      className={`h-12 rounded-lg border-2 ${
                        tempSettings.fontColor === 'rose' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-white flex items-center justify-center`}
                      title="Rose"
                    >
                      <span className="text-sm font-bold text-rose-600">Aa</span>
                    </button>
                  </div>
                </div>

                {/* Reader Background */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Reader Background
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    <button
                      onClick={() => updateSingleSetting('readerBackground', 'default')}
                      className={`h-12 rounded-lg border-2 ${
                        tempSettings.readerBackground === 'default' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center`}
                      title="Default Gradient"
                    >
                      <span className="text-sm font-bold text-gray-700">●</span>
                    </button>
                    <button
                      onClick={() => updateSingleSetting('readerBackground', 'white')}
                      className={`h-12 rounded-lg border-2 ${
                        tempSettings.readerBackground === 'white' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-white flex items-center justify-center`}
                      title="White"
                    >
                      <span className="text-sm font-bold text-gray-700">●</span>
                    </button>
                    <button
                      onClick={() => updateSingleSetting('readerBackground', 'cream')}
                      className={`h-12 rounded-lg border-2 ${
                        tempSettings.readerBackground === 'cream' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-amber-50 flex items-center justify-center`}
                      title="Cream"
                    >
                      <span className="text-sm font-bold text-gray-700">●</span>
                    </button>
                    <button
                      onClick={() => setTempSettings({ ...tempSettings, readerBackground: 'blue' })}
                      className={`h-12 rounded-lg border-2 ${
                        tempSettings.readerBackground === 'blue' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-blue-50 flex items-center justify-center`}
                      title="Light Blue"
                    >
                      <span className="text-sm font-bold text-gray-700">●</span>
                    </button>
                    <button
                      onClick={() => setTempSettings({ ...tempSettings, readerBackground: 'green' })}
                      className={`h-12 rounded-lg border-2 ${
                        tempSettings.readerBackground === 'green' ? 'border-emerald-500 border-4' : 'border-gray-300'
                      } bg-emerald-50 flex items-center justify-center`}
                      title="Soft Green"
                    >
                      <span className="text-sm font-bold text-gray-700">●</span>
                    </button>
                  </div>
                </div>

                {/* Transliteration Toggle */}
                {!tempSettings.arabicOnlyMode && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      Transliteration
                    </label>
                    <button
                      onClick={() => {
                        const newValue = !tempSettings.showTransliteration;
                        setTempSettings({ ...tempSettings, showTransliteration: newValue });
                        updateSettings({ showTransliteration: newValue });
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg ${
                        settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                      }`}
                    >
                      <span className={settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {tempSettings.showTransliteration ? 'On' : 'Off'}
                      </span>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        tempSettings.showTransliteration
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-gray-400'
                      }`}>
                        {tempSettings.showTransliteration && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  </div>
                )}

                {renderTranslationSelector({
                  selectedIdentifier: activeTempTranslationIdentifier,
                  onChange: selectMobileTranslation,
                  size: 'mobile',
                })}
              </>
            )}

            {/* Audio Tab Content */}
            {settingsTab === 'audio' && (
              <>
                {/* Audio Settings */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Audio Playback
                  </label>
                  <button
                    onClick={() => {
                      const newAudioEnabled = !tempSettings.audioEnabled;
                      setTempSettings({ ...tempSettings, audioEnabled: newAudioEnabled });
                      updateSettings({ audioEnabled: newAudioEnabled });
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-lg ${
                      settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                    }`}
                  >
                    <span className={settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                      {tempSettings.audioEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      tempSettings.audioEnabled
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-gray-400'
                    }`}>
                      {tempSettings.audioEnabled && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                  {tempSettings.audioEnabled && (
                    <div className="mt-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setTempSettings({ ...tempSettings, audioMode: 'ayah' });
                            updateSettings({ audioMode: 'ayah' });
                          }}
                          className={`p-2 text-sm rounded-lg transition-colors ${
                            tempSettings.audioMode === 'ayah'
                              ? 'bg-emerald-500 text-white'
                              : settings.theme === 'dark'
                              ? 'bg-gray-600 text-gray-300'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          Ayat by Ayat
                        </button>
                        <button
                          onClick={() => {
                            setTempSettings({ ...tempSettings, audioMode: 'surah' });
                            updateSettings({ audioMode: 'surah' });
                          }}
                          className={`p-2 text-sm rounded-lg transition-colors ${
                            tempSettings.audioMode === 'surah'
                              ? 'bg-emerald-500 text-white'
                              : settings.theme === 'dark'
                              ? 'bg-gray-600 text-gray-300'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          Complete Surah
                        </button>
                      </div>
                      {!tempSettings.arabicOnlyMode && (
                        <div className="space-y-2">
                          <label className={`block text-sm font-medium ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                            Translation Audio
                          </label>
                          <button
                            onClick={() => {
                              const newValue = !tempSettings.translationAudioEnabled;
                              setTempSettings({ ...tempSettings, translationAudioEnabled: newValue });
                              updateSettings({ translationAudioEnabled: newValue });
                            }}
                            className={`w-full flex items-center justify-between p-3 rounded-lg ${
                              settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                            }`}
                          >
                            <span className={settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                              {tempSettings.translationAudioEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              tempSettings.translationAudioEnabled
                                ? 'bg-emerald-500 border-emerald-500'
                                : 'border-gray-400'
                            }`}>
                              {tempSettings.translationAudioEnabled && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                          <p className={`text-xs leading-relaxed ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            Recorded translation audio is currently available for Urdu - Fateh Muhammad Jalandhry and English - Saheeh International.
                          </p>
                          {!isActiveTempTranslationAudioSupported && (
                            <p className={`text-xs leading-relaxed ${settings.theme === 'dark' ? 'text-amber-300' : 'text-amber-700'}`}>
                              The currently selected translation does not have recorded audio yet.
                            </p>
                          )}
                          <p className={`text-xs leading-relaxed ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            {tempSettings.audioMode === 'ayah'
                              ? 'In Ayat by Ayat mode, tap the Arabic ayah for recitation and the translation card for that ayah.'
                              : 'In Complete Surah mode, the selected translation plays automatically after each Arabic ayah.'}
                          </p>
                        </div>
                      )}
                      {showMobileIndopakAyahWarning && (
                        <div className="group relative">
                          <div
                            className={`inline-flex cursor-help items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${
                              settings.theme === 'dark'
                                ? 'border-amber-500/60 bg-amber-900/30 text-amber-200'
                                : 'border-amber-300 bg-amber-50 text-amber-700'
                            }`}
                            title={indopakAyahWarningText}
                          >
                            <ExclamationTriangleIcon className="h-4 w-4" />
                            Compatibility warning
                          </div>
                          <div
                            className={`pointer-events-none absolute left-0 top-full z-10 mt-1 w-72 rounded-md px-2 py-1.5 text-[11px] shadow-lg opacity-0 transition-opacity group-hover:opacity-100 ${
                              settings.theme === 'dark'
                                ? 'bg-gray-900 text-amber-100'
                                : 'bg-gray-900 text-white'
                            }`}
                          >
                            {indopakAyahWarningText}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </>
            )}

            {/* Bookmarks Tab Content */}
            {settingsTab === 'bookmarks' && (
              <>
                {/* Bookmarks */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    <BookmarkIcon className="h-4 w-4 inline mr-1" />
                    Bookmarks
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {bookmarks.length > 0 ? (
                      bookmarks.map((bookmark) => (
                        <div
                          key={bookmark.id}
                          className={`p-3 rounded-lg border-l-4 ${getBookmarkListClass(bookmark.color)}`}
                        >
                          <div className="flex items-start justify-between">
                            <button
                              onClick={() => {
                                goToSurah(bookmark.surahNumber);
                                cancelMobileSettings();
                                // iOS needs longer delay for DOM to settle and modal to close
                                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                                const delay = isIOS ? 1200 : 800;
                                setTimeout(() => scrollToAyahNumber(bookmark.ayahNumber), delay);
                              }}
                              className="text-left flex-1"
                            >
                              <p className={`text-sm font-medium ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {bookmark.surahName}
                              </p>
                              <p className={`text-xs ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                Ayah {bookmark.ayahNumber}
                              </p>
                              {bookmark.note && (
                                <p className={`text-xs mt-1 italic ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                  "{bookmark.note}"
                                </p>
                              )}
                            </button>
                            <button
                              onClick={() => removeBookmark(bookmark.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className={`text-center py-8 ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        <BookmarkIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No bookmarks yet</p>
                        <p className="text-xs mt-1">Double-tap any ayah to bookmark it</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
            
            {/* Close Button */}
            <div className={`p-4 border-t ${settings.theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={cancelMobileSettings}
                className="w-full py-3 rounded-lg font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bookmark Confirmation Popup */}
      {bookmarkConfirm && (
        <>
          {/* Mobile - Centered Modal (viewport-aware for iOS keyboard) */}
          <div
            className="fixed inset-x-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm lg:hidden"
            style={{
              top: bookmarkModalViewport?.offsetTop ?? 0,
              height: bookmarkModalViewport ? `${bookmarkModalViewport.height}px` : '100dvh',
            }}
            onClick={(e) => {
              setBookmarkConfirm(null);
            }}
          >
            <div
              className={`relative w-full max-w-sm rounded-xl shadow-2xl border-2 border-emerald-500 p-4 ${
                settings.theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              }`}
              style={{ overflowY: 'auto', maxHeight: '90%' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button for mobile */}
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

                  {/* Note Input */}
                  <div className="mb-3">
                    <label className={`block text-sm font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      Note (optional)
                    </label>
                    <input
                      type="text"
                      value={bookmarkConfirm.note || ''}
                      onChange={(e) => setBookmarkConfirm({ ...bookmarkConfirm, note: e.target.value })}
                      placeholder="Add a note..."
                      className={`w-full px-3 py-2 text-base rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                        settings.theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                  </div>

                  {/* Color Selection */}
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

          {/* Desktop - Original Position at Click Location */}
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
            onClick={(e) => e.stopPropagation()}
          >
            {!isBookmarked(bookmarkConfirm.surahNum, bookmarkConfirm.ayahNum) ? (
              <>
                <p className={`text-sm font-semibold mb-3 ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Add Bookmark
                </p>

                {/* Note Input */}
                <div className="mb-3">
                  <label className={`block text-xs font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Note (optional)
                  </label>
                  <input
                    type="text"
                    value={bookmarkConfirm.note || ''}
                    onChange={(e) => setBookmarkConfirm({ ...bookmarkConfirm, note: e.target.value })}
                    placeholder="Add a note..."
                    className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      settings.theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                  />
                </div>

                {/* Color Selection */}
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

      {/* Floating Audio Player Control Bar - Mobile: Only show when playing/paused or in surah mode. Desktop: Always show when audio enabled */}
      {settings.audioEnabled && (
        <div className={`fixed bottom-0 left-0 right-0 ${
          settings.theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        } border-t shadow-lg p-3 z-50 lg:hidden ${
          // Hide in ayat mode when not playing
          (!isPlaying && !isPaused && !isAudioLoading && settings.audioMode === 'ayah' && !selectedAyahForPlay) ? 'hidden' : ''
        }`}>
          <div className="max-w-6xl mx-auto flex items-center gap-4">
            {/* Play/Pause/Resume Button */}
            <button
              onClick={() => {
                const currentSurahNum = currentPlayingSurah || surahData?.number;
                if (isPlaying) {
                  pauseAyah();
                } else if (isPaused) {
                  resumeAyah();
                } else if (selectedAyahForPlay) {
                  playAyah(selectedAyahForPlay.surah, selectedAyahForPlay.ayah);
                } else if (settings.audioMode === 'surah' && currentSurahNum) {
                  playSurah(currentSurahNum);
                }
              }}
              className={`p-3 rounded-full transition-colors flex-shrink-0 ${
                isAudioLoading
                  ? 'bg-blue-500 text-white cursor-wait'
                  : isPlaying
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : isPaused
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
              }`}
            >
              {isAudioLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <PauseIcon className="h-5 w-5" />
              ) : (
                <PlayIcon className="h-5 w-5" />
              )}
            </button>

            {/* Audio Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <SpeakerWaveIcon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <p className={`text-sm font-medium truncate ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {currentPlayingSurah || currentPlaybackTrack
                    ? getNowPlayingTitle()
                    : selectedAyahForPlay && surahs[selectedAyahForPlay.surah - 1]
                    ? `Selected: ${surahs[selectedAyahForPlay.surah - 1].englishName} ${selectedAyahForPlay.ayah}`
                    : surahData
                    ? `${surahData.englishName}`
                    : isAudioLoading
                    ? 'Loading audio...'
                    : isPaused
                    ? 'Paused'
                    : 'Select Surah'}
                  {isAudioLoading && <span className="ml-2 text-xs">(Buffering)</span>}
                  {isPaused && <span className="ml-2 text-xs text-amber-500">(Paused)</span>}
                  {currentPlaybackTrack === 'translation' && !isAudioLoading && (
                    <span className="ml-2 text-xs text-emerald-500">(Translation)</span>
                  )}
                  {selectedAyahForPlay && !isPlaying && !isPaused && !isAudioLoading && (
                    <span className="ml-2 text-xs text-emerald-500">Click play to listen</span>
                  )}
                  {!isPlaying && !isPaused && !isAudioLoading && currentPlayingSurah && !selectedAyahForPlay && (
                    <span className="ml-2 text-xs text-emerald-500">Ready to play</span>
                  )}
                </p>
              </div>

              {/* Progress Bar - Only show when playing or paused */}
              {(isPlaying || isPaused) && (
                canSeekAudio ? (
                  <div className="flex items-center gap-3">
                    <span className={`text-xs w-10 ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {formatPlayerTime(audioCurrentTime)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={timelineMax}
                      step={1}
                      value={timelineValue}
                      onChange={(e) => seekAudio(Number(e.target.value))}
                      className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-300 accent-emerald-500"
                      aria-label="Seek audio position"
                    />
                    <span className={`text-xs w-10 text-right ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {formatPlayerTime(audioDuration)}
                    </span>
                  </div>
                ) : (
                  <p className={`text-xs ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    Translation voice follows your selected translation and cannot be scrubbed.
                  </p>
                )
              )}
              
              {/* Play Button - Show when not started yet */}
              {!isPlaying && !isPaused && !isAudioLoading && (
                <button
                  onClick={() => {
                    if (selectedAyahForPlay) {
                      // Play selected ayah
                      playAyah(selectedAyahForPlay.surah, selectedAyahForPlay.ayah);
                    } else if (settings.audioMode === 'surah') {
                      // Only play surah in surah mode
                      const currentSurahNum = currentPlayingSurah || surahData?.number;
                      if (currentSurahNum) {
                        playSurah(currentSurahNum);
                      }
                    }
                    // In ayat mode without selection, do nothing
                  }}
                  className={`mt-2 w-full py-2 text-sm font-semibold rounded-lg transition-colors ${
                    selectedAyahForPlay
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : settings.audioMode === 'surah'
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-gray-400 cursor-not-allowed text-gray-200'
                  }`}
                  disabled={!selectedAyahForPlay && settings.audioMode !== 'surah'}
                >
                  {selectedAyahForPlay 
                    ? `Play Ayah ${selectedAyahForPlay.ayah}` 
                    : settings.audioMode === 'surah'
                    ? 'Play Surah'
                    : 'Select Ayah to Play'}
                </button>
              )}
            </div>

            {/* Stop Button */}
            {(isPlaying || isPaused) && (
              <button
                onClick={stopAyah}
                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                  settings.theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                }`}
                title="Stop"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Desktop Floating Audio Player - Only when playing/paused */}
      {settings.audioEnabled && (isPlaying || isPaused) && (currentPlayingAyah || currentPlayingSurah) && (
        <div className={`hidden lg:block fixed bottom-0 left-0 right-0 ${
          settings.theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        } border-t shadow-lg p-3 z-50`}>
          <div className="max-w-6xl mx-auto flex items-center gap-4">
            {/* Play/Pause/Resume Button */}
            <button
              onClick={() => {
                if (isPlaying) {
                  pauseAyah();
                } else if (isPaused) {
                  resumeAyah();
                } else {
                  togglePlayPause();
                }
              }}
              className={`p-3 rounded-full transition-colors flex-shrink-0 ${
                isAudioLoading
                  ? 'bg-blue-500 text-white cursor-wait'
                  : isPlaying
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : isPaused
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
              }`}
            >
              {isAudioLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <PauseIcon className="h-5 w-5" />
              ) : (
                <PlayIcon className="h-5 w-5" />
              )}
            </button>

            {/* Audio Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <SpeakerWaveIcon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <p className={`text-sm font-medium truncate ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {currentPlayingSurah || currentPlaybackTrack
                    ? getNowPlayingTitle()
                    : isAudioLoading
                    ? 'Loading audio...'
                    : isPaused
                    ? 'Paused'
                    : 'Playing...'}
                  {isAudioLoading && <span className="ml-2 text-xs">(Buffering)</span>}
                  {isPaused && <span className="ml-2 text-xs text-amber-500">(Paused)</span>}
                  {currentPlaybackTrack === 'translation' && !isAudioLoading && (
                    <span className="ml-2 text-xs text-emerald-500">(Translation)</span>
                  )}
                </p>
              </div>

              {/* Progress Bar */}
              {canSeekAudio ? (
                <div className="flex items-center gap-3">
                  <span className={`text-xs w-10 ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {formatPlayerTime(audioCurrentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={timelineMax}
                    step={1}
                    value={timelineValue}
                    onChange={(e) => seekAudio(Number(e.target.value))}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-300 accent-emerald-500"
                    aria-label="Seek audio position"
                  />
                  <span className={`text-xs w-10 text-right ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {formatPlayerTime(audioDuration)}
                  </span>
                </div>
              ) : (
                <p className={`text-xs ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  Translation voice follows your selected translation and cannot be scrubbed.
                </p>
              )}
            </div>

            {/* Stop Button */}
            <button
              onClick={stopAyah}
              className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                settings.theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
              title="Stop"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default QuranReader;
