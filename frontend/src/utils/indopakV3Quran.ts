// IndoPak Nastaleeq V3 - Word by Word Quran Data Fetcher
// This utility fetches Quran data from the backend API without any Unicode conversion
import { API_URL } from '../config';
import { fetchJsonWithRecovery } from './fetchWithRecovery';

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

const API_BASE_URL = `${API_URL}/quran/indopak-v3`;
const INDOPAK_CACHE_TTL_MS = 1000 * 60 * 10;

/**
 * Fetch complete Surah from IndoPak V3 API
 * No Unicode conversion - fetch and display as-is
 */
export const fetchIndopakV3Surah = async (surahNumber: number): Promise<IndopakV3Surah> => {
  const result = await fetchJsonWithRecovery<{ status: string; data: IndopakV3Surah; message?: string }>(
    `${API_BASE_URL}/surah/${surahNumber}`,
    {
      cacheTtlMs: INDOPAK_CACHE_TTL_MS,
      fallbackMessage: 'Failed to fetch IndoPak V3 Surah',
    }
  );

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
  const result = await fetchJsonWithRecovery<{ status: string; data: IndopakV3SingleAyah; message?: string }>(
    `${API_BASE_URL}/ayah/${surahNumber}/${ayahNumber}`,
    {
      cacheTtlMs: INDOPAK_CACHE_TTL_MS,
      fallbackMessage: 'Failed to fetch IndoPak V3 Ayah',
    }
  );

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
