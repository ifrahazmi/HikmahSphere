// Indopak Quran Data Loader
import indopakData from '../data/indopak.json';

export interface IndopakWord {
  id: number;
  surah: string;
  ayah: string;
  word: string;
  location: string;
  text: string;
}

export interface IndopakAyah {
  surah: number;
  ayah: number;
  words: IndopakWord[];
  text: string;
}

export interface IndopakSurah {
  surah: number;
  ayahs: IndopakAyah[];
}

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
    
    // Add word to ayah
    ayah.words.push(word);
  });
  
  // Build complete text for each ayah by joining words
  surahMap.forEach((surah) => {
    surah.ayahs.forEach((ayah) => {
      ayah.text = ayah.words.map(w => w.text).join(' ');
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
