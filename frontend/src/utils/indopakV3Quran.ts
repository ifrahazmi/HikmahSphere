// IndoPak Nastaleeq V3 - Word by Word Quran Data Fetcher
// This utility fetches Quran data from the backend API without any Unicode conversion

export interface IndopakV3Word {
  position: number;
  text: string;
  location: string;
}

export interface IndopakV3Ayah {
  ayah: number;
  words: IndopakV3Word[];
  text: string;
}

export interface IndopakV3Surah {
  surah: number;
  ayahs: IndopakV3Ayah[];
  script_type: 'text_indopak_nastaleeq';
  font_family: 'indopak-nastaleeq-v3';
}

export interface IndopakV3SingleAyah {
  surah: number;
  ayah: number;
  words: IndopakV3Word[];
  text: string;
  script_type: 'text_indopak_nastaleeq';
  font_family: 'indopak-nastaleeq-v3';
}

const API_BASE_URL = '/api/quran/indopak-v3';

/**
 * Fetch complete Surah from IndoPak V3 API
 * No Unicode conversion - fetch and display as-is
 */
export const fetchIndopakV3Surah = async (surahNumber: number): Promise<IndopakV3Surah> => {
  const response = await fetch(`${API_BASE_URL}/surah/${surahNumber}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch IndoPak V3 Surah' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  
  const result = await response.json();
  
  if (result.status !== 'success') {
    throw new Error(result.message || 'Failed to fetch IndoPak V3 Surah');
  }
  
  return result.data;
};

/**
 * Fetch specific Ayah from IndoPak V3 API
 * No Unicode conversion - fetch and display as-is
 */
export const fetchIndopakV3Ayah = async (
  surahNumber: number,
  ayahNumber: number
): Promise<IndopakV3SingleAyah> => {
  const response = await fetch(`${API_BASE_URL}/ayah/${surahNumber}/${ayahNumber}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch IndoPak V3 Ayah' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  
  const result = await response.json();
  
  if (result.status !== 'success') {
    throw new Error(result.message || 'Failed to fetch IndoPak V3 Ayah');
  }
  
  return result.data;
};

/**
 * Render words as continuous text for Arabic-only mode
 * Words are joined with spaces, ayahs flow continuously
 */
export const renderContinuousAyahText = (ayahs: IndopakV3Ayah[]): string => {
  return ayahs.map(ayah => ayah.text).join('  ');
};
