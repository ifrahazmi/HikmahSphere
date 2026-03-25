import type { TafsirAyahResponse, TafsirSurahResponse } from '../types/tafsir';

const DEFAULT_TAFSIR_API_URL = 'http://localhost:8080/api';
const REQUEST_TIMEOUT_MS = Number(process.env.REACT_APP_TAFSIR_TIMEOUT_MS || 30000);
const MAX_RETRY_ATTEMPTS = 2;

export const getTafsirApiUrl = (): string => {
  if (process.env.REACT_APP_TAFSIR_API_URL) {
    return process.env.REACT_APP_TAFSIR_API_URL;
  }

  return DEFAULT_TAFSIR_API_URL;
};

const TAFSIR_API_URL = getTafsirApiUrl();

export const getTafsirRuntimeIssue = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (window.location.protocol === 'https:' && /^http:\/\//i.test(TAFSIR_API_URL)) {
    return 'Tafsir API is using HTTP while this site is HTTPS. Browser mixed-content protection blocks this request. Use HTTPS for the API or proxy this endpoint through your backend domain.';
  }

  return null;
};

const fetchWithTimeout = async (url: string): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    }

    throw new Error('Unable to reach Tafsir API. This is usually a network, CORS, or mixed-content issue.');
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchWithRetry = async (url: string): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fetchWithTimeout(url);
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const message = String(lastError.message || '').toLowerCase();
      const isRetryable = message.includes('timed out') || message.includes('unable to reach tafsir api');

      if (!isRetryable || attempt === MAX_RETRY_ATTEMPTS) {
        throw lastError;
      }

      // Brief backoff to avoid hammering the endpoint when it is temporarily saturated.
      await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
    }
  }

  throw lastError || new Error('Unable to reach Tafsir API.');
};

const handleResponse = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({ message: fallbackMessage }));
    throw new Error(errorPayload.message || fallbackMessage);
  }

  return response.json() as Promise<T>;
};

const normalizeTafsirSurah = (payload: any): TafsirSurahResponse => {
  const data = payload?.data ?? payload;

  if (!data || typeof data.surah_number !== 'number' || !Array.isArray(data.ayahs)) {
    throw new Error('Unexpected tafsir surah response format');
  }

  return {
    surah_number: data.surah_number,
    ayahs: data.ayahs.map((ayah: any) => ({
      text: String(ayah?.text ?? ''),
      ayah: Number(ayah?.ayah ?? 0),
      surah: Number(ayah?.surah ?? data.surah_number),
    })),
  };
};

const normalizeTafsirAyah = (payload: any): TafsirAyahResponse => {
  const data = payload?.data ?? payload;

  if (!data || typeof data.ayah !== 'number' || typeof data.surah !== 'number') {
    throw new Error('Unexpected tafsir ayah response format');
  }

  return {
    text: String(data.text ?? ''),
    ayah: data.ayah,
    surah: data.surah,
  };
};

export const fetchTafsirSurah = async (surahNumber: number): Promise<TafsirSurahResponse> => {
  const runtimeIssue = getTafsirRuntimeIssue();
  if (runtimeIssue) {
    throw new Error(runtimeIssue);
  }

  const response = await fetchWithRetry(`${TAFSIR_API_URL}/surah/${surahNumber}`);
  const payload = await handleResponse<any>(response, 'Failed to load tafsir for this surah');
  return normalizeTafsirSurah(payload);
};

export const fetchTafsirAyah = async (surahNumber: number, ayahNumber: number): Promise<TafsirAyahResponse> => {
  const runtimeIssue = getTafsirRuntimeIssue();
  if (runtimeIssue) {
    throw new Error(runtimeIssue);
  }

  const response = await fetchWithRetry(`${TAFSIR_API_URL}/surah/${surahNumber}/ayah/${ayahNumber}`);
  const payload = await handleResponse<any>(response, 'Failed to load tafsir for this ayah');
  return normalizeTafsirAyah(payload);
};
