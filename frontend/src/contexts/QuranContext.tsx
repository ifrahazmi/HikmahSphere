import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';
import {
  Surah,
  SurahData,
  QuranContextType,
  QuranSettings,
  Bookmark,
  LastRead,
  SearchResult,
  DEFAULT_QURAN_SETTINGS,
} from '../types/quran';

const QuranContext = createContext<QuranContextType | undefined>(undefined);

export const QuranProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
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
  const [currentPlayingAyah, setCurrentPlayingAyah] = useState<number | null>(null);
  
  // Settings from localStorage
  const [settings, setSettings] = useState<QuranSettings>(() => {
    const saved = localStorage.getItem('quranSettings');
    return saved ? JSON.parse(saved) : DEFAULT_QURAN_SETTINGS;
  });
  
  // Bookmarks from localStorage
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    const saved = localStorage.getItem('quranBookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Last read from localStorage
  const [lastRead, setLastRead] = useState<LastRead | null>(() => {
    const saved = localStorage.getItem('quranLastRead');
    return saved ? JSON.parse(saved) : null;
  });

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
      
      const response = await fetch(
        `${API_URL}/quran/surah/${surahNumber}/editions?editions=${editions.join(',')}`
      );
      const data = await response.json();
      
      if (data.status === 'success') {
        // First edition is always Arabic
        setSurahData(data.data[0]);
        
        if (settings.arabicOnlyMode) {
          // In Arabic-only mode, clear translations and transliteration
          setTransliteration(null);
          setTranslations([]);
        } else {
          // Check if transliteration is included
          let startIndex = 1;
          if (settings.showTransliteration && data.data[1]?.edition?.type === 'transliteration') {
            setTransliteration(data.data[1]);
            startIndex = 2;
          } else {
            setTransliteration(null);
          }
          
          // Rest are translations
          setTranslations(data.data.slice(startIndex));
        }
      } else {
        setError('Failed to load surah data');
      }
    } catch (err) {
      console.error('Load surah error:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [settings.selectedTranslations, settings.showTransliteration, settings.arabicOnlyMode]);

  // Update settings and reload if necessary
  const updateSettings = useCallback((newSettings: Partial<QuranSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('quranSettings', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Navigation
  const goToSurah = useCallback((surahNumber: number) => {
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
  const addBookmark = useCallback((surah: number, ayah: number, note?: string, color?: 'emerald' | 'blue' | 'purple' | 'amber' | 'rose') => {
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
      localStorage.setItem('quranBookmarks', JSON.stringify(updated));
      return updated;
    });
  }, [surahs]);

  const removeBookmark = useCallback((id: string) => {
    setBookmarks(prev => {
      const updated = prev.filter(b => b.id !== id);
      localStorage.setItem('quranBookmarks', JSON.stringify(updated));
      return updated;
    });
  }, []);

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
    localStorage.setItem('quranLastRead', JSON.stringify(lastReadData));
  }, [surahs]);

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

  // Audio playback
  const playAyah = useCallback((ayahNumber: number) => {
    setIsPlaying(true);
    setCurrentPlayingAyah(ayahNumber);
  }, []);

  const pauseAyah = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const stopAyah = useCallback(() => {
    setIsPlaying(false);
    setCurrentPlayingAyah(null);
  }, []);

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
  }, [settings.showTransliteration, settings.arabicOnlyMode, JSON.stringify(settings.selectedTranslations)]);

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
    currentPlayingAyah,
    playAyah,
    pauseAyah,
    stopAyah,
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
