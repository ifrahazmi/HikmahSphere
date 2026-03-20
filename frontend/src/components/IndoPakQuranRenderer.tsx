/**
 * IndoPak Quran Word-by-Word Renderer
 *
 * This component demonstrates proper rendering of IndoPak Quran text
 * with correct letter joining, symbol support, and RTL handling.
 *
 * Features:
 * - Proper IndoPak font with fallbacks
 * - OpenType features for Arabic shaping (calt, liga, mark, mkmk)
 * - RTL direction and text alignment
 * - React-safe word rendering without breaking shaping
 * - Support for tajweed marks and waqf symbols
 */

import React from 'react';

// Types
interface Word {
  position: number;
  text: string;
  location: string;
}

interface Ayah {
  ayah: number;
  words: Word[];
  text: string;
}

interface IndoPakQuranRendererProps {
  ayahs: Ayah[];
  surahNumber: number;
  showTranslation?: boolean;
  translations?: string[];
  fontSize?: number;
  theme?: 'light' | 'dark';
}

/**
 * Renders a single word with proper Arabic shaping
 * Uses inline-flex to prevent breaking the shaping context
 */
const WordSpan: React.FC<{
  word: Word;
  wordIndex: number;
  surahNumber: number;
  ayahNumber: number;
  onClick?: (word: Word) => void;
}> = React.memo(({ word, wordIndex, surahNumber, ayahNumber, onClick }) => {
  // Skip ayah number markers
  if (/^\d+$/.test(word.text.trim())) {
    return null;
  }

  return (
    <span
      className="indopak-v3-word-container px-[0.06em] sm:px-[0.12em] my-[0.04em] rounded transition-colors cursor-pointer hover:bg-emerald-100 hover:bg-opacity-30"
      onClick={() => onClick?.(word)}
      title={`Word ${word.position}: ${word.location}`}
      style={{
        // Prevent React from breaking the text shaping
        textRendering: 'auto',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        WebkitTextSizeAdjust: '100%',
        fontVariantLigatures: 'contextual common-ligatures',
        fontFeatureSettings: '"calt" 1, "liga" 1, "clig" 1, "rlig" 1, "ccmp" 1',
        letterSpacing: '0.02em',
        wordSpacing: '0.08em',
      }}
    >
      {word.text}
    </span>
  );
});

WordSpan.displayName = 'WordSpan';

/**
 * Renders the Bismillah with special styling
 */
const Bismillah: React.FC<{
  surahNumber: number;
  theme: 'light' | 'dark';
}> = ({ surahNumber, theme }) => {
  // Skip for Surah 9 (At-Tawbah)
  if (surahNumber === 9) return null;

  return (
    <div className="text-center mb-6 py-3">
      <p
        className="text-2xl text-emerald-600 leading-loose mb-4 bismillah-text"
        dir="rtl"
        lang="ar"
        style={{
          fontFeatureSettings: '"rlig" 1, "liga" 1, "calt" 1, "ccmp" 1, "mark" 1, "mkmk" 1',
        }}
      >
        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
      </p>
      {/* Islamic Divider */}
      <div className="flex items-center justify-center gap-3">
        <div className="h-px w-16 sm:w-24 bg-gradient-to-r from-transparent via-emerald-400 to-emerald-500" />
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
        <div className="h-px w-16 sm:w-24 bg-gradient-to-l from-transparent via-emerald-400 to-emerald-500" />
      </div>
    </div>
  );
};

/**
 * Main IndoPak Quran Renderer Component
 */
export const IndoPakQuranRenderer: React.FC<IndoPakQuranRendererProps> = ({
  ayahs,
  surahNumber,
  showTranslation = false,
  translations = [],
  fontSize = 20,
  theme = 'light',
}) => {
  const handleWordClick = React.useCallback((word: Word) => {
    console.log('Word clicked:', word);
    // Add your word click handling logic here
  }, []);

  return (
    <div className={`font-indopak-nastaleeq-v3 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
      {/* Bismillah */}
      <Bismillah surahNumber={surahNumber} theme={theme} />

      {/* Ayahs */}
      <div className="space-y-4">
        {ayahs.map((ayah) => {
          // Skip first ayah of Surah 1 (Al-Fatiha) as Bismillah is shown separately
          const isFirstAyahFatiha = surahNumber === 1 && ayah.ayah === 1;
          if (isFirstAyahFatiha) return null;

          return (
            <div
              key={ayah.ayah}
              id={`ayah-${ayah.ayah}`}
              className={`pb-5 border-b last:border-b-0 ${
                theme === 'dark' ? 'border-gray-700/80' : 'border-emerald-100'
              }`}
            >
              {/* Arabic Text - Word by Word */}
              <div
                className="relative mb-4 overflow-hidden rounded-2xl p-3 sm:p-5 bg-white bg-opacity-50 dark:bg-gray-800 dark:bg-opacity-50"
                dir="rtl"
                lang="ar"
              >
                <div
                  className="flex flex-wrap items-baseline gap-[0.08em] sm:gap-[0.12em] leading-[2.4] sm:leading-[2.6]"
                  style={{
                    fontSize: `${fontSize}px`,
                    textRendering: 'auto',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    fontVariantLigatures: 'contextual common-ligatures',
                    fontFeatureSettings: '"calt" 1, "liga" 1, "clig" 1, "rlig" 1, "mark" 1, "mkmk" 1',
                  }}
                >
                  {/* Render each word */}
                  {ayah.words.map((word, wordIndex) => (
                    <WordSpan
                      key={`${surahNumber}:${ayah.ayah}:${word.position}`}
                      word={word}
                      wordIndex={wordIndex}
                      surahNumber={surahNumber}
                      ayahNumber={ayah.ayah}
                      onClick={handleWordClick}
                    />
                  ))}

                </div>
              </div>

              {/* Transliteration (if enabled) */}
              {showTranslation && (
                <div className="mb-3 text-left ltr" dir="ltr">
                  <p className={`text-xs font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    Transliteration
                  </p>
                  <p
                    className={`text-sm italic leading-relaxed transliteration-text ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    }`}
                    dir="ltr"
                  >
                    {/* Add transliteration text here */}
                  </p>
                </div>
              )}

              {/* Translations (if enabled) */}
              {showTranslation && translations.length > 0 && (
                <div className="space-y-2">
                  {translations.map((translation, index) => (
                    <div key={index} className="text-left" dir="ltr">
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        {translation}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IndoPakQuranRenderer;
