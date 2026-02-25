import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';
import {
  Surah,
  SurahData,
  Ayah,
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
  const [isPaused, setIsPaused] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [currentPlayingAyah, setCurrentPlayingAyah] = useState<number | null>(null);
  const [currentPlayingSurah, setCurrentPlayingSurah] = useState<number | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [totalSurahDuration, setTotalSurahDuration] = useState(0);
  const [cumulativeTime, setCumulativeTime] = useState(0);

  // Audio ref
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [ayahAudioQueue, setAyahAudioQueue] = useState<number[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [isSurahMode, setIsSurahMode] = useState(false);

  // Refs for audio ended handler (to avoid re-registering event listener)
  const ayahAudioQueueRef = React.useRef<number[]>([]);
  const currentQueueIndexRef = React.useRef(0);
  const currentPlayingSurahRef = React.useRef<number | null>(null);
  const cumulativeTimeRef = React.useRef(0);
  const totalSurahDurationRef = React.useRef(0);
  const isSurahModeRef = React.useRef(false);
  const pausedTimeRef = React.useRef(0);
  const isBismillahRef = React.useRef(false);

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
    cumulativeTimeRef.current = cumulativeTime;
  }, [cumulativeTime]);

  useEffect(() => {
    totalSurahDurationRef.current = totalSurahDuration;
  }, [totalSurahDuration]);

  useEffect(() => {
    isSurahModeRef.current = isSurahMode;
  }, [isSurahMode]);
  
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
    // Stop audio playback if playing (any mode)
    if (isPlaying) {
      stopAudio();
    }
    setCurrentSurah(surahNumber);
    setCurrentAyah(1);
    loadSurahData(surahNumber);
  }, [loadSurahData]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Audio playback implementation
  const stopAudio = useCallback(() => {
    console.log('🛑 Stopping audio playback');
    if (audioRef.current) {
      // Remove event listeners before cleaning up
      const audio = audioRef.current;
      audio.removeEventListener('timeupdate', handleAudioTimeUpdate);
      audio.removeEventListener('ended', handleAudioEnded);
      audio.removeEventListener('loadedmetadata', handleAudioTimeUpdate);
      audio.removeEventListener('canplaythrough', () => {});
      audio.removeEventListener('error', () => {});
      
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setIsAudioLoading(false);
    setCurrentPlayingAyah(null);
    setCurrentPlayingSurah(null);
    setAudioProgress(0);
    setAudioDuration(0);
    setAudioCurrentTime(0);
    setTotalSurahDuration(0);
    setCumulativeTime(0);
    setAyahAudioQueue([]);
    setCurrentQueueIndex(0);
    setIsSurahMode(false);
    cumulativeTimeRef.current = 0;
    totalSurahDurationRef.current = 0;
    pausedTimeRef.current = 0;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const playAyah = useCallback(async (surahNumber: number, ayahNumber: number, isContinuing: boolean = false) => {
    try {
      console.log('🎵 Playing ayah:', surahNumber, ':', ayahNumber, 'isContinuing:', isContinuing);
      
      // Stop any current playback (but preserve cumulative time in surah mode)
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Fetch the ayah with audio
      const apiUrl = `${API_URL}/quran/ayah/${surahNumber}:${ayahNumber}?editions=${settings.reciter}`;
      console.log('🎵 Fetching ayah audio from:', apiUrl);

      const response = await fetch(apiUrl);
      const data = await response.json();

      console.log('🎵 API Response:', data);

      // For ayah endpoint, the structure is: data[0].audio (not data[0].ayahs[0].audio)
      if (data.status === 'success' && Array.isArray(data.data) && data.data[0]?.audio) {
        const audioUrl = data.data[0].audio;
        console.log('🎵 Audio URL:', audioUrl);

        // Create new Audio object
        const audio = new Audio();
        audioRef.current = audio;
        
        // Attach event listeners to the new audio object
        audio.addEventListener('timeupdate', handleAudioTimeUpdate);
        audio.addEventListener('ended', handleAudioEnded);
        audio.addEventListener('loadedmetadata', handleAudioTimeUpdate);
        audio.addEventListener('canplaythrough', () => {
          console.log('✅ Audio can play through');
          setIsAudioLoading(false);
        });
        audio.addEventListener('waiting', () => {
          console.log('⏳ Audio buffering...');
          setIsAudioLoading(true);
        });
        audio.addEventListener('playing', () => {
          console.log('▶️ Audio is playing');
          setIsAudioLoading(false);
        });
        audio.addEventListener('error', (e) => {
          console.error('❌ Audio error:', e);
          setIsAudioLoading(false);
        });
        
        console.log('🎵 Event listeners attached');

        audio.src = audioUrl;
        audio.load();

        setCurrentPlayingSurah(surahNumber);
        setCurrentPlayingAyah(ayahNumber);
        
        // Only set isPlaying when audio actually starts
        audio.play().then(() => {
          setIsPlaying(true);
          console.log('✅ Audio playback started successfully');
        }).catch(error => {
          console.error('❌ Audio playback failed:', error);
          setIsPlaying(false);
          setIsAudioLoading(false);
        });
      } else {
        console.error('❌ No audio URL in response:', data);
        console.log('Expected structure: data.data[0].audio');
        console.log('Actual data.data:', data.data);
      }
    } catch (err) {
      console.error('❌ Error playing ayah:', err);
      setIsPlaying(false);
      setIsAudioLoading(false);
    }
  }, [settings.reciter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Play Bismillah separately (for surahs 2-8, 10-114)
  const playBismillah = useCallback(async (surahNumber: number) => {
    try {
      console.log('🎵 Playing Bismillah for Surah', surahNumber);
      
      // Store the surah number for continuation after Bismillah
      currentPlayingSurahRef.current = surahNumber;
      isBismillahRef.current = true; // Mark that Bismillah is playing
      isSurahModeRef.current = true; // Set surah mode
      
      // Bismillah audio URL (Mishary Alafasy)
      const bismillahAudioUrl = 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3';
      
      // Create new Audio object
      const audio = new Audio();
      audioRef.current = audio;
      
      // Attach event listeners
      audio.addEventListener('timeupdate', handleAudioTimeUpdate);
      audio.addEventListener('ended', handleAudioEnded);
      audio.addEventListener('loadedmetadata', handleAudioTimeUpdate);
      audio.addEventListener('canplaythrough', () => {
        console.log('✅ Bismillah can play through');
        setIsAudioLoading(false);
      });
      audio.addEventListener('waiting', () => {
        console.log('⏳ Bismillah buffering...');
        setIsAudioLoading(true);
      });
      audio.addEventListener('playing', () => {
        console.log('▶️ Bismillah is playing');
        setIsAudioLoading(false);
      });
      audio.addEventListener('error', (e) => {
        console.error('❌ Bismillah error:', e);
        setIsAudioLoading(false);
      });
      
      audio.src = bismillahAudioUrl;
      audio.load();
      
      setCurrentPlayingAyah(0); // Mark as Bismillah
      
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const playSurah = useCallback(async (surahNumber: number) => {
    try {
      console.log('🎵 Playing complete surah:', surahNumber);
      setIsSurahMode(true);

      // Stop any current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
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

        console.log('🎵 Audio queue created:', audioQueue);

        // Estimate total duration (average 5 seconds per ayah as fallback)
        const estimatedTotalDuration = ayahs.length * 5;
        setTotalSurahDuration(estimatedTotalDuration);
        totalSurahDurationRef.current = estimatedTotalDuration;

        setAyahAudioQueue(audioQueue);
        // Important: Update ref immediately for handleAudioEnded
        ayahAudioQueueRef.current = audioQueue;
        
        setCurrentQueueIndex(0);
        currentQueueIndexRef.current = 0;
        
        setCurrentPlayingSurah(surahNumber);
        setCumulativeTime(0);
        cumulativeTimeRef.current = 0;

        // For Surah 9 (At-Tawbah), no Bismillah
        // For Surah 1 (Al-Fatiha), Bismillah is part of Ayah 1
        // For other surahs (2-8, 10-114), play Bismillah first
        const hasBismillah = surahNumber !== 1 && surahNumber !== 9;

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
          await playAyah(surahNumber, audioQueue[0]);
        }
      }
    } catch (err) {
      console.error('❌ Error playing surah:', err);
      setIsPlaying(false);
      setIsAudioLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.reciter, playAyah, playBismillah]);

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
  }, [isPlaying, pauseAyah, resumeAyah, currentPlayingAyah, currentPlayingSurah]);

  const seekAudio = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setAudioCurrentTime(time);
    }
  }, []);

  // Handle audio events
  const handleAudioTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      const currentTime = audioRef.current.currentTime;
      const duration = audioRef.current.duration;
      
      // For surah mode, use cumulative time
      if (isSurahModeRef.current) {
        const totalTime = cumulativeTimeRef.current + currentTime;
        console.log('⏱️ Time update (surah mode):', totalTime.toFixed(1), '/', totalSurahDurationRef.current.toFixed(1));
        setAudioCurrentTime(totalTime);
        setAudioDuration(totalSurahDurationRef.current);
        setAudioProgress((totalTime / totalSurahDurationRef.current) * 100);
      } else {
        console.log('⏱️ Time update (ayah mode):', currentTime.toFixed(1), '/', duration.toFixed(1));
        setAudioCurrentTime(currentTime);
        setAudioDuration(duration);
        setAudioProgress((currentTime / duration) * 100);
      }
    }
  }, []);

  const handleAudioEnded = useCallback(async () => {
    console.log('🎵 Audio ended - Queue:', ayahAudioQueueRef.current, 'Current Index:', currentQueueIndexRef.current);
    console.log('🎵 Is Surah Mode:', isSurahModeRef.current);
    console.log('🎵 Is Bismillah:', isBismillahRef.current);
    console.log('🎵 Current Playing Surah (ref):', currentPlayingSurahRef.current);
    
    // Check if Bismillah just finished
    if (isBismillahRef.current && isSurahModeRef.current && currentPlayingSurahRef.current) {
      console.log('🎵 Bismillah finished, continuing to ayah 1 of surah', currentPlayingSurahRef.current);
      isBismillahRef.current = false; // Reset Bismillah flag
      
      const surahNum = currentPlayingSurahRef.current;
      
      // Queue should already be populated by playSurah
      if (ayahAudioQueueRef.current && ayahAudioQueueRef.current.length > 0) {
        // Reset index just in case
        setCurrentQueueIndex(0);
        currentQueueIndexRef.current = 0;
        
        const firstAyah = ayahAudioQueueRef.current[0];
        console.log('🎵 Playing ayah 1 of surah', surahNum, 'from queue:', firstAyah);
        await playAyah(surahNum, firstAyah);
      } else {
        console.error('❌ Audio queue is empty after Bismillah!');
        // Fallback or stop
        stopAudio();
      }
      return;
    }
    
    // Only auto-play next ayah if in surah mode
    if (isSurahModeRef.current && ayahAudioQueueRef.current.length > 0 && currentQueueIndexRef.current < ayahAudioQueueRef.current.length - 1) {
      const nextIndex = currentQueueIndexRef.current + 1;
      const nextAyahNumber = ayahAudioQueueRef.current[nextIndex];
      const surahNum = currentPlayingSurahRef.current;
      
      // Add current ayah duration to cumulative time
      if (audioRef.current) {
        const newCumulativeTime = cumulativeTimeRef.current + audioRef.current.duration;
        console.log('🎵 Adding', audioRef.current.duration.toFixed(1), 's to cumulative time:', cumulativeTimeRef.current.toFixed(1), '->', newCumulativeTime.toFixed(1));
        setCumulativeTime(newCumulativeTime);
        cumulativeTimeRef.current = newCumulativeTime;
      }
      
      console.log('🎵 Playing next ayah:', nextAyahNumber, 'at index:', nextIndex, 'in surah:', surahNum);
      
      setCurrentQueueIndex(nextIndex);
      currentQueueIndexRef.current = nextIndex;

      if (surahNum) {
        await playAyah(surahNum, nextAyahNumber, true);
      }
    } else {
      console.log('🎵 Audio playback complete - stopping');
      // Stop when done (or in ayat-by-ayat mode)
      stopAudio();
    }
  }, [playAyah, stopAudio, settings.reciter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Note: Audio event listeners are now attached in playAyah when creating new Audio object

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
  }, [settings.audioMode, settings.audioEnabled, currentSurah]);

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
    isPaused,
    isAudioLoading,
    currentPlayingAyah,
    currentPlayingSurah,
    audioProgress,
    audioDuration,
    audioCurrentTime,
    currentQueueIndex,
    totalSurahDuration,
    cumulativeTime,
    playAyah,
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
