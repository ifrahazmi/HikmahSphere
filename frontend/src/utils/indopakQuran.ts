// Indopak Quran Data Loader
import indopakData from '../data/indopak-v1.3.json';

export interface IndopakWord {
  id: number;
  surah: string;
  ayah: string;
  word: string;
  location: string;
  text: string;
  position?: number;
}

export interface IndopakAyah {
  surah: number;
  ayah: number;
  words: Array<IndopakWord & { position: number }>;
  text: string;
}

export interface IndopakSurah {
  surah: number;
  ayahs: IndopakAyah[];
}

// Comprehensive Tajweed and Quranic Mark Unicode Ranges for IndoPak Script
// These include all standard Arabic, Arabic Extended-A, Arabic Presentation Forms,
// and IndoPak-specific symbols from the Unicode specification

// Normalize Quranic marks to ensure proper rendering across all fonts and platforms.
// This function preserves tajweed marks while removing problematic symbols.
const normalizeIndopakMarks = (text: string): string => {
  return text
    // Remove South IndoPak stop symbols that may render inconsistently:
    // U+06D9 (small high lam-alef) and U+06DA (small high jeem)
    .replace(/[\u06D9\u06DA]/g, '')
    // Remove box/end markers in Private Use Area (U+F500-F8FF range)
    .replace(/[\uF500-\uF8FF]/g, '')
    // Remove Arabic Small High Rounded Zero (۟ U+06DF)
    .replace(/\u06DF/g, '')
    // Remove Private Use Area characters that might cause rendering issues
    .replace(/[\uE000-\uF8FF]/g, '')
    // Preserve all standard tajweed marks (these should render correctly)
    // U+064B-065F: Arabic combining marks (fathatan, dammatan, kasratan, fatha, damma, kasra, shadda, sukun, etc.)
    // U+0670: Arabic superscript alef
    // U+06D6-06DC: Quranic annotation signs (high rounded zero, high dotless zero, etc.)
    // U+06DD: Arabic end of ayah marker
    // U+06DE: Arabic start of rub el hizb
    // U+06E0-06E4: Small high signs (mim, jeem, etc.)
    // U+06E7-06E8: Small high yeh and small high jeem
    // U+06EA-06ED: Empty centre low stop, low safha, low meem, etc.
    // U+08D4-08E1: Arabic small high words (sajdah, etc.)
    // U+FB50-FDFF: Arabic Presentation Forms-A (ligatures, etc.)
    // U+FE70-FEFF: Arabic Presentation Forms-B (positional forms)
    ;
};

// Regex pattern to identify tajweed marks for special handling
export const TAJWEED_MARKS_PATTERN = /[\u064B-\u065F\u0670\u06D6-\u06DC\u06DE\u06DF\u06E0-\u06E4\u06E7\u06E8\u06EA-\u06ED\u08D4-\u08E1\uFB50-\uFDFF\uFE70-\uFEFF]/g;

// Regex pattern to identify waqf (pause) symbols
export const WAQF_MARKS_PATTERN = /[\u06D6\u06D7\u06D8\u06DB\u06DC\u06DE\u06E0-\u06E4\u06E5\u06E6\u06E9\u06EA-\u06ED]/g;

// Specific tajweed mark Unicode characters
export const TAJWEED_MARKS = {
  // Vowel marks (Harakat)
  FATHATAN: '\u064B', // ً
  DAMMATAN: '\u064C', // ٌ
  KASRATAN: '\u064D', // ٍ
  FATHA: '\u064E',    // َ
  DAMMA: '\u064F',    // ُ
  KASRA: '\u0650',    // ِ
  SHADDA: '\u0651',   // ّ
  SUKUN: '\u0652',    // ْ
  
  // Superscript Alef
  SUPERSCRIPT_ALEF: '\u0670', // ٰ
  
  // Quranic annotation signs
  HIGH_ROUNDED_ZERO: '\u06D6', // ۖ
  HIGH_DOTLESS_ZERO: '\u06D7', // ۗ
  SMALL_HIGH_DOTLESS_ZERO_HEAD: '\u06D8', // ۘ
  SMALL_LOW_DOTLESS_ZERO_HEAD: '\u06D9', // ۙ
  SMALL_LOW_ZERO_HEAD: '\u06DA', // ۚ
  SMALL_HIGH_ZERO: '\u06DB', // ۛ
  SMALL_HIGH_DOTLESS_ZERO: '\u06DC', // ۜ
  END_OF_AYAH: '\u06DD', // ۝
  START_OF_RUB_EL_HIZB: '\u06DE', // ۞
  
  // Small high signs
  SMALL_HIGH_MEEM_INITIAL: '\u06E0', // ۠
  SMALL_HIGH_MEEM_ISOLATED: '\u06E1', // ۡ
  SMALL_LOW_MEEM: '\u06E2', // ۢ
  SMALL_MEEM_ABOVE: '\u06E3', // ۣ
  SMALL_WAW: '\u06E4', // ۤ
  SMALL_YEH: '\u06E5', // ۥ
  SMALL_YEH_BAR: '\u06E6', // ۦ
  SMALL_HIGH_YEH: '\u06E7', // ۧ
  SMALL_HIGH_NOON: '\u06E8', // ۨ
  PLACE_OF_SAJDAH: '\u06E9', // ۩
  
  // Low stops
  EMPTY_CENTRE_LOW_STOP: '\u06EA', // ۪
  LOW_SAFHA: '\u06EB', // ۫
  LOW_MEEM: '\u06EC', // ۬
  LOW_KAF: '\u06ED', // ۭ
};

// Function to extract tajweed marks from text for special rendering
export const extractTajweedMarks = (text: string): string[] => {
  const matches = text.match(TAJWEED_MARKS_PATTERN);
  return matches || [];
};

// Function to check if text contains tajweed marks
export const hasTajweedMarks = (text: string): boolean => {
  return TAJWEED_MARKS_PATTERN.test(text);
};

// Function to identify waqf type from mark
export const getWaqfType = (mark: string): string => {
  switch (mark) {
    case TAJWEED_MARKS.HIGH_ROUNDED_ZERO:
      return 'mim'; // Meem (وقف)
    case TAJWEED_MARKS.HIGH_DOTLESS_ZERO:
      return 'la'; // La (لا) - prohibited
    case TAJWEED_MARKS.SMALL_HIGH_DOTLESS_ZERO_HEAD:
      return 'meem'; // Meem (م) - obligatory
    case TAJWEED_MARKS.SMALL_LOW_DOTLESS_ZERO_HEAD:
      return 'qaf'; // Qaf (ق) - stop better
    case TAJWEED_MARKS.SMALL_LOW_ZERO_HEAD:
      return 'sad'; // Sad (ص) - connection
    case TAJWEED_MARKS.SMALL_HIGH_ZERO:
      return 'ha'; // Ha (ح) - permissible
    case TAJWEED_MARKS.SMALL_HIGH_DOTLESS_ZERO:
      return 'jaiz'; // Jaiz (ج) - allowed
    case TAJWEED_MARKS.PLACE_OF_SAJDAH:
      return 'sajdah'; // Sajdah verse
    default:
      return 'standard';
  }
};

/**
 * Parse the Indopak JSON data and group by Surah and Ayah
 */
export const loadIndopakQuran = (): Map<number, IndopakSurah> => {
  const surahMap = new Map<number, IndopakSurah>();

  // Convert JSON object to array and sort by ID
  const words: IndopakWord[] = Object.values(indopakData).sort((a, b) => a.id - b.id);

  // Group words by Surah and Ayah
  words.forEach((word) => {
    const surahNum = parseInt(word.surah);
    const ayahNum = parseInt(word.ayah);

    // Get or create Surah
    if (!surahMap.has(surahNum)) {
      surahMap.set(surahNum, { surah: surahNum, ayahs: [] });
    }

    const surah = surahMap.get(surahNum)!;

    // Get or create Ayah
    let ayah = surah.ayahs.find(a => a.ayah === ayahNum);
    if (!ayah) {
      ayah = { surah: surahNum, ayah: ayahNum, words: [], text: '' };
      surah.ayahs.push(ayah);
    }

    // Add word to ayah with position
    ayah.words.push({
      ...word,
      position: parseInt(word.word),
    });
  });

  // Build complete text for each ayah by joining words
  surahMap.forEach((surah) => {
    surah.ayahs.forEach((ayah) => {
      ayah.text = normalizeIndopakMarks(ayah.words.map(w => w.text).join(' '));
      // Also clean each word's text
      ayah.words.forEach(word => {
        word.text = normalizeIndopakMarks(word.text);
      });
    });

    // Sort ayahs by ayah number
    surah.ayahs.sort((a, b) => a.ayah - b.ayah);
  });

  return surahMap;
};

/**
 * Get a specific Surah from the loaded data
 */
export const getIndopakSurah = (surahMap: Map<number, IndopakSurah>, surahNumber: number): IndopakSurah | undefined => {
  return surahMap.get(surahNumber);
};

/**
 * Get a specific Ayah from the loaded data
 */
export const getIndopakAyah = (
  surahMap: Map<number, IndopakSurah>,
  surahNumber: number,
  ayahNumber: number
): IndopakAyah | undefined => {
  const surah = surahMap.get(surahNumber);
  if (!surah) return undefined;
  
  return surah.ayahs.find(a => a.ayah === ayahNumber);
};

/**
 * Get total number of ayahs in a Surah
 */
export const getIndopakSurahAyahCount = (surahMap: Map<number, IndopakSurah>, surahNumber: number): number => {
  const surah = surahMap.get(surahNumber);
  return surah ? surah.ayahs.length : 0;
};

/**
 * Get all Surah numbers available
 */
export const getAvailableSurahs = (surahMap: Map<number, IndopakSurah>): number[] => {
  return Array.from(surahMap.keys()).sort((a, b) => a - b);
};

// Pre-load the Quran data
let cachedSurahMap: Map<number, IndopakSurah> | null = null;

export const getIndopakQuranData = (): Map<number, IndopakSurah> => {
  if (!cachedSurahMap) {
    cachedSurahMap = loadIndopakQuran();
  }
  return cachedSurahMap;
};
