import React, { useState, useEffect } from 'react';
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
} from '@heroicons/react/24/outline';
import { useQuran } from '../contexts/QuranContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { DEFAULT_TRANSLATIONS } from '../types/quran';

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
  } = useQuran();

  const [searchTerm, setSearchTerm] = useState('');
  const [bookmarkConfirm, setBookmarkConfirm] = useState<{
    surahNum: number;
    ayahNum: number;
    x: number;
    y: number;
  } | null>(null);

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
      'amiri': 'font-arabic',
      'scheherazade': 'font-scheherazade',
      'noto-naskh': 'font-noto-naskh',
      'cairo': 'font-cairo',
      'lateef': 'font-lateef',
    };
    return fontMap[settings.arabicFont] || 'font-arabic';
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

  // Handle ayah click for bookmarking
  const handleAyahClick = (e: React.MouseEvent, surahNum: number, ayahNum: number) => {
    e.preventDefault();
    e.stopPropagation();
    setBookmarkConfirm({
      surahNum,
      ayahNum,
      x: e.clientX,
      y: e.clientY,
    });
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
        addBookmark(bookmarkConfirm.surahNum, bookmarkConfirm.ayahNum);
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

  return (
    <div className={`min-h-screen ${settings.theme === 'dark' ? 'bg-gray-900' : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50'} pt-16`}>
      <div className="w-full px-2 py-2">
        {/* Header */}
        <div className="text-center mb-3">
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Left Sidebar - Settings */}
          <div className="lg:col-span-2">
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
                  <button
                    onClick={() => updateSettings({ arabicOnlyMode: !settings.arabicOnlyMode })}
                    className={`w-full flex items-center justify-between p-2 text-sm rounded-md ${
                      settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    }`}
                  >
                    <span className={settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                      {settings.arabicOnlyMode ? 'Arabic Only' : 'With Translations'}
                    </span>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      settings.arabicOnlyMode 
                        ? 'bg-emerald-500 border-emerald-500' 
                        : 'border-gray-400'
                    }`}>
                      {settings.arabicOnlyMode && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
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
                      max="32"
                      value={settings.fontSize}
                      onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <button
                      onClick={() => updateSettings({ fontSize: Math.min(32, settings.fontSize + 2) })}
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
                    className={`w-full p-2 text-sm rounded-md border ${
                      settings.theme === 'dark' 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="amiri">Amiri (Traditional)</option>
                    <option value="scheherazade">Scheherazade (Classic)</option>
                    <option value="noto-naskh">Noto Naskh Arabic</option>
                    <option value="cairo">Cairo (Modern)</option>
                    <option value="lateef">Lateef (Clean)</option>
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

                {/* Translations - only show if not in Arabic-only mode */}
                {!settings.arabicOnlyMode && (
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      Translations (max 3)
                    </label>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {DEFAULT_TRANSLATIONS.map((trans) => (
                        <label key={trans.identifier} className="flex items-center text-xs">
                          <input
                            type="checkbox"
                            checked={settings.selectedTranslations.includes(trans.identifier)}
                            onChange={(e) => {
                              if (e.target.checked && settings.selectedTranslations.length < 3) {
                                updateSettings({
                                  selectedTranslations: [...settings.selectedTranslations, trans.identifier],
                                });
                              } else if (!e.target.checked) {
                                updateSettings({
                                  selectedTranslations: settings.selectedTranslations.filter((t) => t !== trans.identifier),
                                });
                              }
                            }}
                            className="mr-1.5"
                          />
                          <span className={`${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                            {trans.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

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
                          className={`p-2 rounded-md ${
                            settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <button
                              onClick={() => goToSurah(bookmark.surahNumber)}
                              className="text-left flex-1"
                            >
                              <p className={`text-sm font-medium ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {bookmark.surahName}
                              </p>
                              <p className={`text-xs ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                Ayah {bookmark.ayahNumber}
                              </p>
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
              <div className={`${settings.theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-3`}>
                {/* Surah Header */}
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
                  <div>
                    <h2 className={`text-xl font-bold ${getFontFamilyClass()} mb-1 ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {surahData.name}
                    </h2>
                    <p className={`text-xs ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      {surahData.englishName} • {surahData.englishNameTranslation} • {surahData.numberOfAyahs} Ayahs • {surahData.revelationType}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={previousSurah}
                      disabled={currentSurah === 1}
                      className={`p-1.5 rounded-md transition-colors ${
                        currentSurah === 1
                          ? 'opacity-50 cursor-not-allowed'
                          : settings.theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={nextSurah}
                      disabled={currentSurah === 114}
                      className={`p-1.5 rounded-md transition-colors ${
                        currentSurah === 114
                          ? 'opacity-50 cursor-not-allowed'
                          : settings.theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Bismillah (except for Surah 9) */}
                {surahData.number !== 9 && (
                  <div className="text-center mb-4 py-3">
                    <p className={`text-2xl ${getFontFamilyClass()} text-emerald-600 leading-loose`}>
                      بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                    </p>
                  </div>
                )}

                {/* Ayahs */}
                {settings.arabicOnlyMode ? (
                  /* Continuous Arabic text in Arabic-only mode */
                  <div className={`p-3 rounded-lg ${getReaderBackgroundClass()}`}>
                    <p
                      className={`${getFontFamilyClass()} leading-loose text-right ${getFontColorClass()}`}
                      style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineSpacing }}
                      dir="rtl"
                    >
                      {surahData.ayahs
                        .filter(ayah => !(surahData.number === 1 && ayah.numberInSurah === 1))
                        .map((ayah, index) => (
                        <span key={ayah.numberInSurah}>
                          <span
                            onClick={(e) => handleAyahClick(e, surahData.number, ayah.numberInSurah)}
                            className={`cursor-pointer hover:bg-emerald-100 hover:bg-opacity-30 rounded px-1 ${
                              isBookmarked(surahData.number, ayah.numberInSurah) ? 'bg-emerald-200 bg-opacity-20' : ''
                            }`}
                          >
                            {removeBismillah(ayah.text, surahData.number, ayah.numberInSurah)}
                          </span>
                          {' '}
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-emerald-600 text-emerald-600 text-xs font-bold mx-1">
                            {ayah.numberInSurah}
                          </span>
                          {index < surahData.ayahs.filter(a => !(surahData.number === 1 && a.numberInSurah === 1)).length - 1 && ' '}
                        </span>
                      ))}
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
                        className={`pb-3 border-b last:border-b-0 ${
                          settings.theme === 'dark' ? 'border-gray-700' : 'border-gray-100'
                        }`}
                      >
                        {/* Arabic Text with inline ayah number */}
                        <div 
                          className={`mb-2 p-3 rounded-lg ${getReaderBackgroundClass()}`}
                        >
                          <p
                            className={`${getFontFamilyClass()} leading-loose text-right ${getFontColorClass()}`}
                            style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineSpacing }}
                            dir="rtl"
                          >
                            <span
                              onClick={(e) => handleAyahClick(e, surahData.number, ayah.numberInSurah)}
                              className={`cursor-pointer hover:bg-emerald-100 hover:bg-opacity-30 rounded px-1 ${
                                isBookmarked(surahData.number, ayah.numberInSurah) ? 'bg-emerald-200 bg-opacity-20' : ''
                              }`}
                            >
                              {removeBismillah(ayah.text, surahData.number, ayah.numberInSurah)}
                            </span>
                            {' '}
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-emerald-600 text-emerald-600 text-xs font-bold mx-1">
                              {ayah.numberInSurah}
                            </span>
                          </p>
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
                        {translations.map((translation, idx) => (
                          <div key={idx} className="mb-2">
                            <p className={`text-xs font-medium mb-1 ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                              {translation.edition.name}
                            </p>
                            <p className={`text-sm leading-relaxed ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                              {translation.ayahs[ayah.numberInSurah - 1]?.text}
                            </p>
                          </div>
                        ))}
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

          {/* Right Sidebar - Surah List */}
          <div className="lg:col-span-2">
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
                  className={`w-full pl-10 pr-3 py-1.5 text-sm border rounded-md focus:ring-emerald-500 focus:border-emerald-500 ${
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

      {/* Bookmark Confirmation Popup */}
      {bookmarkConfirm && (
        <div
          className={`fixed z-50 rounded-lg shadow-xl border-2 border-emerald-500 p-4 ${
            settings.theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          }`}
          style={{
            left: `${bookmarkConfirm.x}px`,
            top: `${bookmarkConfirm.y}px`,
            transform: 'translate(-50%, -100%) translateY(-10px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className={`text-sm mb-3 ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            {isBookmarked(bookmarkConfirm.surahNum, bookmarkConfirm.ayahNum)
              ? 'Remove this ayah from bookmarks?'
              : 'Bookmark this ayah?'}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setBookmarkConfirm(null)}
              className={`px-3 py-1.5 text-xs rounded-md ${
                settings.theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={confirmBookmark}
              className="px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isBookmarked(bookmarkConfirm.surahNum, bookmarkConfirm.ayahNum) ? 'Remove' : 'Bookmark'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuranReader;
