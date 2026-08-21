import type { TafsirAyahResponse, TafsirSurahResponse } from '../types/tafsir';
import { API_URL } from '../config';
import { fetchJsonWithRecovery } from './fetchWithRecovery';

const TAFHEEM_EDITION = 'tafheem-ul-quran-syed-abu-ala-maududi';
const REQUEST_TIMEOUT_MS = Number(process.env.REACT_APP_TAFSIR_TIMEOUT_MS || 30000);
const TAFSIR_CACHE_TTL_MS = Number(process.env.REACT_APP_TAFSIR_CACHE_TTL_MS || 300000);

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const surahCache = new Map<string, CacheEntry<TafsirSurahResponse>>();
const ayahCache = new Map<string, CacheEntry<TafsirAyahResponse>>();
const surahInFlight = new Map<string, Promise<TafsirSurahResponse>>();
const ayahInFlight = new Map<string, Promise<TafsirAyahResponse>>();

export const getTafsirApiUrl = (): string => {
  if (process.env.REACT_APP_TAFSIR_API_URL) {
    return process.env.REACT_APP_TAFSIR_API_URL.replace(/\/$/, '');
  }

  // Default: route through the Express backend proxy (works on Vercel + Render)
  return `${API_URL}/quran/tafsir`;
};

const TAFSIR_API_URL = getTafsirApiUrl();

export const getMaududiApiUrl = (): string => {
  if (process.env.REACT_APP_MAUDUDI_API_URL) {
    return process.env.REACT_APP_MAUDUDI_API_URL.replace(/\/$/, '');
  }

  // Production: use the Render proxy. The Tailscale tunnel stays on the backend.
  return `${API_URL}/quran/tafsir`;
};

const MAUDUDI_API_URL = getMaududiApiUrl();

const isTafheemEdition = (edition?: string): boolean => {
  return (edition || '').trim().toLowerCase() === TAFHEEM_EDITION;
};

const resolveTafsirEndpoint = (
  surahNumber: number,
  ayahNumber: number | null,
  edition?: string
): string => {
  const endpointBase = isTafheemEdition(edition) ? MAUDUDI_API_URL : TAFSIR_API_URL;
  const path =
    ayahNumber === null
      ? `${endpointBase}/surah/${surahNumber}`
      : `${endpointBase}/surah/${surahNumber}/ayah/${ayahNumber}`;

  // Render needs the edition to choose the Maududi proxy. A direct local
  // Maududi upstream does not accept the edition query parameter.
  const usesDirectMaududiUpstream =
    isTafheemEdition(edition) && Boolean(process.env.REACT_APP_MAUDUDI_API_URL);
  const query =
    edition && !usesDirectMaududiUpstream
      ? `?edition=${encodeURIComponent(edition)}`
      : '';
  return `${path}${query}`;
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const normalizeFootnotes = (value: unknown): Record<string, string> => {
  const record = toRecord(value);
  if (!record) return {};

  const entries = Object.entries(record)
    .filter(([key]) => key.trim().length > 0)
    .map(([key, text]) => [key, String(text ?? '').trim()] as const)
    .filter(([, text]) => text.length > 0);

  return Object.fromEntries(entries);
};

const parseAyahFromKey = (key: string): { surah: number; ayah: number } | null => {
  const match = key.match(/^(\d+):(\d+)$/);
  if (!match) return null;

  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  if (!Number.isFinite(surah) || !Number.isFinite(ayah)) return null;

  return { surah, ayah };
};

const normalizeAyahEntry = (
  rawAyah: unknown,
  fallbackSurah: number,
  fallbackAyah: number
): TafsirAyahResponse => {
  const ayahRecord = toRecord(rawAyah) || {};
  const translationHtml = String(ayahRecord.t ?? ayahRecord.translationHtml ?? '').trim();
  const translationPlain = String(ayahRecord.translationPlain ?? ayahRecord.translation ?? '').trim();
  const text = String(ayahRecord.text ?? ayahRecord.tafsir ?? '').trim();

  return {
    text,
    ayah: Number(ayahRecord.ayah ?? fallbackAyah),
    surah: Number(ayahRecord.surah ?? fallbackSurah),
    translationHtml: translationHtml || undefined,
    translationPlain: translationPlain || undefined,
    footnotes: normalizeFootnotes(ayahRecord.f ?? ayahRecord.footnotes),
  };
};

export const getTafsirRuntimeIssue = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const usesInsecureApi =
    /^http:\/\//i.test(TAFSIR_API_URL) || /^http:\/\//i.test(MAUDUDI_API_URL);
  if (window.location.protocol === 'https:' && usesInsecureApi) {
    return 'Tafsir API is using HTTP while this site is HTTPS. Browser mixed-content protection blocks this request. Use HTTPS for the API or proxy this endpoint through your backend domain.';
  }

  return null;
};

const getCached = <T>(cache: Map<string, CacheEntry<T>>, key: string): T | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

const setCached = <T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void => {
  cache.set(key, {
    value,
    expiresAt: Date.now() + TAFSIR_CACHE_TTL_MS,
  });
};

export const normalizeTafsirSurah = (payload: any): TafsirSurahResponse => {
  const data = payload?.data ?? payload;

  const normalizeKeyedAyahMap = (source: Record<string, unknown>) => {
    return Object.entries(source)
      .map(([key, value]) => {
        const parsed = parseAyahFromKey(key);
        if (!parsed) return null;
        return normalizeAyahEntry(value, parsed.surah, parsed.ayah);
      })
      .filter((ayah): ayah is TafsirAyahResponse => Boolean(ayah))
      .sort((first, second) => first.ayah - second.ayah);
  };

  if (data && typeof data === 'object' && !Array.isArray(data) && !('surah_number' in data)) {
    const keyedAyahs = normalizeKeyedAyahMap(data as Record<string, unknown>);

    if (!keyedAyahs.length) {
      throw new Error('Unexpected tafsir surah response format');
    }

    return {
      surah_number: keyedAyahs[0].surah,
      ayahs: keyedAyahs,
    };
  }

  if (
    data
    && typeof data === 'object'
    && !Array.isArray(data)
    && typeof data.surah_number === 'number'
    && data.ayahs
    && typeof data.ayahs === 'object'
    && !Array.isArray(data.ayahs)
  ) {
    const keyedAyahs = normalizeKeyedAyahMap(data.ayahs as Record<string, unknown>);
    if (!keyedAyahs.length) {
      throw new Error('Unexpected tafsir surah response format');
    }

    return {
      surah_number: Number(data.surah_number),
      ayahs: keyedAyahs,
    };
  }

  if (!data || typeof data.surah_number !== 'number' || !Array.isArray(data.ayahs)) {
    throw new Error('Unexpected tafsir surah response format');
  }

  return {
    surah_number: data.surah_number,
    ayahs: data.ayahs.map((ayah: any) => normalizeAyahEntry(ayah, Number(data.surah_number), Number(ayah?.ayah ?? 0))),
  };
};

export const normalizeTafsirAyah = (payload: any): TafsirAyahResponse => {
  const data = payload?.data ?? payload;

  if (
    data
    && typeof data === 'object'
    && !Array.isArray(data)
    && typeof (data as Record<string, unknown>).key === 'string'
  ) {
    const parsed = parseAyahFromKey(String((data as Record<string, unknown>).key));
    if (parsed) {
      return normalizeAyahEntry(data, parsed.surah, parsed.ayah);
    }
  }

  if (data && typeof data === 'object' && !Array.isArray(data) && !('ayah' in data) && !('surah' in data)) {
    const keyedEntry = Object.entries(data as Record<string, unknown>).find(([key]) => /^(\d+):(\d+)$/.test(key));
    if (keyedEntry) {
      const parsed = parseAyahFromKey(keyedEntry[0]);
      if (parsed) {
        return normalizeAyahEntry(keyedEntry[1], parsed.surah, parsed.ayah);
      }
    }
  }

  if (!data || typeof data.ayah !== 'number' || typeof data.surah !== 'number') {
    throw new Error('Unexpected tafsir ayah response format');
  }

  return normalizeAyahEntry(data, Number(data.surah), Number(data.ayah));
};

export const fetchTafsirSurah = async (surahNumber: number, edition?: string): Promise<TafsirSurahResponse> => {
  const runtimeIssue = getTafsirRuntimeIssue();
  if (runtimeIssue) {
    throw new Error(runtimeIssue);
  }

  const url = resolveTafsirEndpoint(surahNumber, null, edition);
  const cacheKey = `${isTafheemEdition(edition) ? 'tafheem' : 'default'}|surah|${surahNumber}|${edition || ''}`;

  const cached = getCached(surahCache, cacheKey);
  if (cached) return cached;

  const existingRequest = surahInFlight.get(cacheKey);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const payload = await fetchJsonWithRecovery<any>(url, {
      cacheTtlMs: 0,
      timeoutMs: REQUEST_TIMEOUT_MS,
      fallbackMessage: 'Failed to load tafsir for this surah',
    });
    const normalized = normalizeTafsirSurah(payload);
    setCached(surahCache, cacheKey, normalized);
    return normalized;
  })();

  surahInFlight.set(cacheKey, request);

  try {
    return await request;
  } finally {
    surahInFlight.delete(cacheKey);
  }
};

export const fetchTafsirAyah = async (
  surahNumber: number,
  ayahNumber: number,
  edition?: string
): Promise<TafsirAyahResponse> => {
  const runtimeIssue = getTafsirRuntimeIssue();
  if (runtimeIssue) {
    throw new Error(runtimeIssue);
  }

  const url = resolveTafsirEndpoint(surahNumber, ayahNumber, edition);
  const cacheKey = `${isTafheemEdition(edition) ? 'tafheem' : 'default'}|ayah|${surahNumber}|${ayahNumber}|${edition || ''}`;

  const cached = getCached(ayahCache, cacheKey);
  if (cached) return cached;

  const existingRequest = ayahInFlight.get(cacheKey);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const payload = await fetchJsonWithRecovery<any>(url, {
      cacheTtlMs: 0,
      timeoutMs: REQUEST_TIMEOUT_MS,
      fallbackMessage: 'Failed to load tafsir for this ayah',
    });
    const normalized = normalizeTafsirAyah(payload);
    setCached(ayahCache, cacheKey, normalized);
    return normalized;
  })();

  ayahInFlight.set(cacheKey, request);

  try {
    return await request;
  } finally {
    ayahInFlight.delete(cacheKey);
  }
};
