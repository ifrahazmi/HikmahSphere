import type { CSSProperties } from 'react';
import type { BookmarkColor } from '../types/quran';

export type BookmarkTheme = 'light' | 'dark';

type BookmarkTone = {
  lightBg: string;
  darkBg: string;
  lightList: string;
  darkList: string;
  swatch: string;
  lightSelection: string;
  darkSelection: string;
  lightRgb: string;
  darkRgb: string;
};

const BOOKMARK_TONES: Record<BookmarkColor, BookmarkTone> = {
  emerald: {
    lightBg: 'bg-emerald-300/55',
    darkBg: 'bg-emerald-400/40 ring-1 ring-inset ring-emerald-300/80',
    lightList: 'border-emerald-600 bg-emerald-50',
    darkList: 'border-emerald-400 bg-emerald-900/55',
    swatch: 'bg-emerald-500',
    lightSelection: 'ring-2 ring-emerald-500',
    darkSelection: 'ring-2 ring-emerald-300',
    lightRgb: '16, 185, 129',
    darkRgb: '52, 211, 153',
  },
  red: {
    lightBg: 'bg-red-300/55',
    darkBg: 'bg-red-400/40 ring-1 ring-inset ring-red-300/80',
    lightList: 'border-red-600 bg-red-50',
    darkList: 'border-red-400 bg-red-900/55',
    swatch: 'bg-red-500',
    lightSelection: 'ring-2 ring-red-500',
    darkSelection: 'ring-2 ring-red-300',
    lightRgb: '220, 38, 38',
    darkRgb: '248, 113, 113',
  },
  teal: {
    lightBg: 'bg-teal-300/55',
    darkBg: 'bg-teal-400/40 ring-1 ring-inset ring-teal-300/80',
    lightList: 'border-teal-600 bg-teal-50',
    darkList: 'border-teal-400 bg-teal-900/55',
    swatch: 'bg-teal-500',
    lightSelection: 'ring-2 ring-teal-500',
    darkSelection: 'ring-2 ring-teal-300',
    lightRgb: '13, 148, 136',
    darkRgb: '45, 212, 191',
  },
  indigo: {
    lightBg: 'bg-indigo-300/55',
    darkBg: 'bg-indigo-400/40 ring-1 ring-inset ring-indigo-300/80',
    lightList: 'border-indigo-600 bg-indigo-50',
    darkList: 'border-indigo-400 bg-indigo-900/55',
    swatch: 'bg-indigo-500',
    lightSelection: 'ring-2 ring-indigo-500',
    darkSelection: 'ring-2 ring-indigo-300',
    lightRgb: '79, 70, 229',
    darkRgb: '129, 140, 248',
  },
  blue: {
    lightBg: 'bg-blue-300/55',
    darkBg: 'bg-blue-400/40 ring-1 ring-inset ring-blue-300/80',
    lightList: 'border-blue-600 bg-blue-50',
    darkList: 'border-blue-400 bg-blue-900/55',
    swatch: 'bg-blue-500',
    lightSelection: 'ring-2 ring-blue-500',
    darkSelection: 'ring-2 ring-blue-300',
    lightRgb: '37, 99, 235',
    darkRgb: '96, 165, 250',
  },
  purple: {
    lightBg: 'bg-purple-300/55',
    darkBg: 'bg-purple-400/40 ring-1 ring-inset ring-purple-300/80',
    lightList: 'border-purple-600 bg-purple-50',
    darkList: 'border-purple-400 bg-purple-900/55',
    swatch: 'bg-purple-500',
    lightSelection: 'ring-2 ring-purple-500',
    darkSelection: 'ring-2 ring-purple-300',
    lightRgb: '147, 51, 234',
    darkRgb: '196, 181, 253',
  },
  amber: {
    lightBg: 'bg-amber-300/55',
    darkBg: 'bg-amber-400/40 ring-1 ring-inset ring-amber-300/80',
    lightList: 'border-amber-600 bg-amber-50',
    darkList: 'border-amber-400 bg-amber-900/55',
    swatch: 'bg-amber-500',
    lightSelection: 'ring-2 ring-amber-500',
    darkSelection: 'ring-2 ring-amber-300',
    lightRgb: '217, 119, 6',
    darkRgb: '251, 191, 36',
  },
  rose: {
    lightBg: 'bg-rose-300/55',
    darkBg: 'bg-rose-400/40 ring-1 ring-inset ring-rose-300/80',
    lightList: 'border-rose-600 bg-rose-50',
    darkList: 'border-rose-400 bg-rose-900/55',
    swatch: 'bg-rose-500',
    lightSelection: 'ring-2 ring-rose-500',
    darkSelection: 'ring-2 ring-rose-300',
    lightRgb: '225, 29, 72',
    darkRgb: '251, 113, 133',
  },
};

export const getBookmarkBackgroundClass = (
  color: BookmarkColor | undefined,
  theme: BookmarkTheme
): string => {
  if (!color) return '';
  return theme === 'dark' ? BOOKMARK_TONES[color].darkBg : BOOKMARK_TONES[color].lightBg;
};

export const getBookmarkSelectionClass = (
  color: BookmarkColor | undefined,
  theme: BookmarkTheme
): string => {
  if (!color) {
    return theme === 'dark'
      ? 'bg-emerald-400/40 ring-2 ring-emerald-300'
      : 'bg-emerald-400/40 ring-2 ring-emerald-500';
  }

  return theme === 'dark' ? BOOKMARK_TONES[color].darkSelection : BOOKMARK_TONES[color].lightSelection;
};

export const getBookmarkHoverClass = (
  color: BookmarkColor | undefined,
  theme: BookmarkTheme
): string => {
  if (color) return '';
  return theme === 'dark' ? 'hover:bg-emerald-400/25' : 'hover:bg-emerald-100/30';
};

export const getBookmarkListClass = (
  color: BookmarkColor | undefined,
  theme: BookmarkTheme
): string => {
  if (!color) {
    return theme === 'dark' ? 'border-gray-500 bg-gray-700' : 'border-gray-300 bg-gray-50';
  }

  return theme === 'dark' ? BOOKMARK_TONES[color].darkList : BOOKMARK_TONES[color].lightList;
};

export const getBookmarkSwatchClass = (color: BookmarkColor): string => {
  return BOOKMARK_TONES[color]?.swatch || 'bg-emerald-500';
};

export const getBookmarkSwatchSelectedClass = (theme: BookmarkTheme): string => {
  return theme === 'dark'
    ? 'border-white ring-2 ring-white scale-110'
    : 'border-gray-900 scale-110';
};

export const getBookmarkBlockStyle = (
  color: BookmarkColor | undefined,
  theme: BookmarkTheme,
  opacityLight: number,
  opacityDark: number
): CSSProperties | undefined => {
  if (!color) return undefined;

  const isDark = theme === 'dark';
  const tone = BOOKMARK_TONES[color];
  const rgb = isDark ? tone.darkRgb : tone.lightRgb;
  const opacity = isDark ? Math.max(opacityDark, 0.4) : opacityLight;

  return {
    backgroundColor: `rgba(${rgb}, ${opacity})`,
    borderColor: `rgba(${rgb}, ${isDark ? 0.9 : 0.4})`,
    boxShadow: isDark ? `inset 3px 0 0 0 rgb(${rgb})` : undefined,
  };
};

export const getBookmarkListBlockStyle = (
  color: BookmarkColor | undefined,
  theme: BookmarkTheme,
  opacityLight: number,
  opacityDark: number
): CSSProperties | undefined => {
  return (
    getBookmarkBlockStyle(color, theme, opacityLight, opacityDark) ??
    (theme === 'dark'
      ? {
          backgroundColor: 'rgba(55, 65, 81, 0.92)',
          borderColor: 'rgba(156, 163, 175, 0.65)',
        }
      : undefined)
  );
};
