import React, { useState, useEffect } from 'react';
import { XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { getRandomVerse } from '../data/quranVerses';
import type { QuranVerse } from '../data/quranVerses';

const DailyWisdomBanner: React.FC = () => {
  const [verse, setVerse] = useState<QuranVerse | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Load a random verse on component mount
    setVerse(getRandomVerse());
  }, []);

  const handleRefresh = () => {
    setVerse(getRandomVerse());
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!verse || !isVisible) return null;

  return (
    <div className="sticky top-16 z-40 bg-emerald-50 border-b border-emerald-200 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">📖</span>
              <h3 className="text-sm font-semibold text-emerald-900">Daily Wisdom</h3>
            </div>
            <p className="text-emerald-800 font-scheherazade text-lg mb-2">
              {verse.verse}
            </p>
            <p className="text-emerald-700 italic mb-1">
              "{verse.translation}"
            </p>
            <p className="text-xs text-emerald-600 font-medium">
              {verse.chapter} • {verse.reference}
            </p>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleRefresh}
              className="p-2 hover:bg-emerald-100 rounded-lg transition-colors"
              title="Get another verse"
              aria-label="Refresh verse"
            >
              <ArrowPathIcon className="w-5 h-5 text-emerald-600 hover:text-emerald-700" />
            </button>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-emerald-100 rounded-lg transition-colors"
              title="Close banner"
              aria-label="Close banner"
            >
              <XMarkIcon className="w-5 h-5 text-emerald-600 hover:text-emerald-700" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyWisdomBanner;
