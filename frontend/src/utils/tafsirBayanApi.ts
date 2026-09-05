import type {
  RandomTafsirAyah,
  TafsirAyahResponse,
  TafsirEditionMeta,
  TafsirSearchHit,
  TafsirSearchSource,
  TafsirSurahResponse,
  UnifiedTafsirAyahResponse,
  UnifiedTafsirSurahResponse,
} from '../types/tafsir';
import { API_URL } from '../config';
import { fetchJsonWithRecovery } from './fetchWithRecovery';
import {
  BAYAN_EDITION_SLUG,
  FALLBACK_TAFSIR_EDITIONS,
  MAUDUDI_URDU_SLUG,
  filterCommentaryTafsirEditions,
  resolveEditionsApiSlug,
} from './tafsirEditions';

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

const isBrowserDirectTafsirUrl = (url: string): boolean => {
  // The browser may only talk to a tafsir process on this machine.
  // Tailscale Funnel / AWS hosts belong on the Express proxy — visitors and
  // HTTPS pages cannot reach *.ts.net, and a dead tunnel hangs the page.
  return /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(url);
};

const resolveOptionalDirectUrl = (value?: string): string | null => {
  const normalized = (value || '').trim().replace(/\/$/, '');
  if (!normalized || !isBrowserDirectTafsirUrl(normalized)) {
    return null;
  }
  return normalized;
};

export const getTafsirApiUrl = (): string => {
  return resolveOptionalDirectUrl(process.env.REACT_APP_TAFSIR_API_URL) || `${API_URL}/quran/tafsir`;
};

const TAFSIR_API_URL = getTafsirApiUrl();

export const getMaududiApiUrl = (): string => {
  return resolveOptionalDirectUrl(process.env.REACT_APP_MAUDUDI_API_URL) || `${API_URL}/quran/tafsir`;
};

const MAUDUDI_API_URL = getMaududiApiUrl();

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

  if (data && typeof data === 'object' && Array.isArray((data as { ayahs?: unknown }).ayahs)) {
    const ayahs = ((data as { ayahs: unknown[] }).ayahs).map((ayah, index) =>
      normalizeAyahEntry(
        ayah,
        Number((data as { surah_number?: number; surah?: number }).surah_number ?? (data as { surah?: number }).surah ?? 0),
        Number((ayah as { ayah?: number })?.ayah ?? index + 1)
      )
    );
    if (ayahs.length > 0) {
      return {
        surah_number: Number(
          (data as { surah_number?: number; surah?: number }).surah_number
          ?? (data as { surah?: number }).surah
          ?? ayahs[0].surah
        ),
        ayahs: ayahs.sort((first, second) => first.ayah - second.ayah),
      };
    }
  }

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

export const getTafsirEditionsApiUrl = (): string => `${API_URL}/quran/tafsir/editions`;

const getEditionsApiUrl = (): string => getTafsirEditionsApiUrl();

const resolveEditionSlug = (edition?: string): string => resolveEditionsApiSlug(edition);

export const fetchTafsirEditions = async (): Promise<TafsirEditionMeta[]> => {
  try {
    const payload = await fetchJsonWithRecovery<{ status?: string; data?: TafsirEditionMeta[] }>(
      getEditionsApiUrl(),
      {
        cacheTtlMs: 10 * 60 * 1000,
        timeoutMs: REQUEST_TIMEOUT_MS,
        maxRetries: 1,
        retryOnStatuses: [429],
        fallbackMessage: 'Failed to load tafsir editions',
      }
    );
    const rows = filterCommentaryTafsirEditions(Array.isArray(payload?.data) ? payload.data : []);
    if (rows.length > 0) {
      return rows;
    }
  } catch {
    // Fall through to the local catalog so the picker still works offline.
  }

  return FALLBACK_TAFSIR_EDITIONS;
};

const fetchEditionAyahsInParallel = async (
  slug: string,
  surahNumber: number,
  ayahCount: number
): Promise<TafsirSurahResponse> => {
  const ayahs: TafsirAyahResponse[] = [];
  const concurrency = 6;

  for (let start = 1; start <= ayahCount; start += concurrency) {
    const batch = Array.from(
      { length: Math.min(concurrency, ayahCount - start + 1) },
      (_, index) => fetchTafsirAyah(surahNumber, start + index, slug)
    );
    ayahs.push(...await Promise.all(batch));
  }

  return {
    surah_number: surahNumber,
    ayahs: ayahs.sort((first, second) => first.ayah - second.ayah),
  };
};

export const fetchTafsirSurah = async (
  surahNumber: number,
  edition?: string,
  ayahCount?: number
): Promise<TafsirSurahResponse> => {
  const slug = resolveEditionSlug(edition);
  const cacheKey = `editions|surah|${surahNumber}|${slug}|${ayahCount || ''}`;

  const cached = getCached(surahCache, cacheKey);
  if (cached) return cached;

  const existingRequest = surahInFlight.get(cacheKey);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    try {
      const payload = await fetchJsonWithRecovery<any>(`${getEditionsApiUrl()}/${slug}/${surahNumber}`, {
        cacheTtlMs: 0,
        timeoutMs: REQUEST_TIMEOUT_MS,
        maxRetries: 1,
        retryOnStatuses: [429],
        fallbackMessage: 'Failed to load tafsir for this surah',
      });
      const normalized = normalizeTafsirSurah(payload);
      setCached(surahCache, cacheKey, normalized);
      return normalized;
    } catch (error) {
      if (ayahCount && ayahCount > 0) {
        const fallback = await fetchEditionAyahsInParallel(slug, surahNumber, ayahCount);
        setCached(surahCache, cacheKey, fallback);
        return fallback;
      }
      throw error;
    }
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
  const slug = resolveEditionSlug(edition);
  const cacheKey = `editions|ayah|${surahNumber}|${ayahNumber}|${slug}`;

  const cached = getCached(ayahCache, cacheKey);
  if (cached) return cached;

  const existingRequest = ayahInFlight.get(cacheKey);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const payload = await fetchJsonWithRecovery<any>(
      `${getEditionsApiUrl()}/${slug}/${surahNumber}/${ayahNumber}`,
      {
        cacheTtlMs: 0,
        timeoutMs: REQUEST_TIMEOUT_MS,
        maxRetries: 1,
        retryOnStatuses: [429],
        fallbackMessage: 'Failed to load tafsir for this ayah',
      }
    );
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

const getTafsirFeatureUrl = (path: string, query = ''): string => {
  return `${TAFSIR_API_URL}${path}${query}`;
};

const pickNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

const pickSnippet = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.replace(/<[^>]+>/g, '').trim();
    }
  }
  return '';
};

const normalizeSearchSource = (value: unknown): TafsirSearchSource => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('maududi') || normalized.includes('tafheem')) {
    return 'maududi';
  }
  if (normalized.includes('israr') || normalized.includes('bayan')) {
    return 'bayan';
  }
  return 'unknown';
};

export const normalizeUnifiedAyah = (
  payload: unknown,
  fallbackSurah?: number,
  fallbackAyah?: number
): UnifiedTafsirAyahResponse => {
  const data = toRecord((payload as { data?: unknown })?.data ?? payload) || {};
  const nested = toRecord(data.unified) || data;
  const surah =
    pickNumber(nested.surah_number, nested.surah, nested.surahNumber, fallbackSurah) || 0;
  const ayah =
    pickNumber(nested.ayah_number, nested.ayah, nested.ayahNumber, fallbackAyah) || 0;
  const bayanRaw = nested.dr_israr ?? nested.bayan ?? nested.bayan_ul_quran;
  const maududiRaw = nested.maududi ?? nested.tafheem;

  if (!surah || !ayah) {
    throw new Error('Unexpected unified tafsir ayah response format');
  }

  return {
    surah,
    ayah,
    bayan: normalizeAyahEntry(bayanRaw, surah, ayah),
    maududi: normalizeAyahEntry(maududiRaw, surah, ayah),
  };
};

export const normalizeUnifiedSurah = (payload: unknown): UnifiedTafsirSurahResponse => {
  const data = toRecord((payload as { data?: unknown })?.data ?? payload) || {};
  const surahNumber = pickNumber(data.surah_number, data.surah, data.surahNumber) || 0;
  const rawAyahs = data.ayahs ?? data.verses ?? data.items;

  if (Array.isArray(rawAyahs)) {
    const ayahs = rawAyahs
      .map((item, index) => normalizeUnifiedAyah(item, surahNumber, index + 1))
      .sort((first, second) => first.ayah - second.ayah);

    if (!ayahs.length) {
      throw new Error('Unexpected unified tafsir surah response format');
    }

    return {
      surah_number: surahNumber || ayahs[0].surah,
      ayahs,
    };
  }

  if (rawAyahs && typeof rawAyahs === 'object') {
    const ayahs = Object.entries(rawAyahs as Record<string, unknown>)
      .map(([key, value]) => {
        const parsed = parseAyahFromKey(key);
        return normalizeUnifiedAyah(value, parsed?.surah || surahNumber, parsed?.ayah);
      })
      .sort((first, second) => first.ayah - second.ayah);

    if (!ayahs.length) {
      throw new Error('Unexpected unified tafsir surah response format');
    }

    return {
      surah_number: surahNumber || ayahs[0].surah,
      ayahs,
    };
  }

  throw new Error('Unexpected unified tafsir surah response format');
};

export const normalizeTafsirSearchHits = (payload: unknown): TafsirSearchHit[] => {
  const data = (payload as { data?: unknown })?.data ?? payload;
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { results?: unknown })?.results)
      ? (data as { results: unknown[] }).results
      : Array.isArray((data as { hits?: unknown })?.hits)
        ? (data as { hits: unknown[] }).hits
        : Array.isArray((data as { items?: unknown })?.items)
          ? (data as { items: unknown[] }).items
          : [];

  return list
    .map((item): TafsirSearchHit | null => {
      const record = toRecord(item) || {};
      const keyParsed = typeof record.key === 'string' ? parseAyahFromKey(record.key) : null;
      const surah = pickNumber(record.surah, record.surah_number, record.surahNumber, keyParsed?.surah);
      const ayah = pickNumber(record.ayah, record.ayah_number, record.ayahNumber, keyParsed?.ayah);
      if (!surah || !ayah) {
        return null;
      }

      return {
        surah,
        ayah,
        snippet: pickSnippet(record.snippet, record.text, record.excerpt, record.t, record.match),
        source: normalizeSearchSource(record.source || record.edition || record.author),
      };
    })
    .filter((hit): hit is TafsirSearchHit => Boolean(hit));
};

export const normalizeRandomTafsir = (payload: unknown): RandomTafsirAyah => {
  const data = toRecord((payload as { data?: unknown })?.data ?? payload) || {};
  const nested = toRecord(data.dr_israr) || toRecord(data.maududi) || data;
  const keyParsed = typeof data.key === 'string'
    ? parseAyahFromKey(data.key)
    : typeof nested.key === 'string'
      ? parseAyahFromKey(nested.key)
      : null;
  const surah = pickNumber(
    data.surah_number,
    data.surah,
    data.surahNumber,
    nested.surah,
    nested.surah_number,
    keyParsed?.surah
  );
  const ayah = pickNumber(
    data.ayah_number,
    data.ayah,
    data.ayahNumber,
    nested.ayah,
    nested.ayah_number,
    keyParsed?.ayah
  );

  if (!surah || !ayah) {
    throw new Error('Unexpected random tafsir response format');
  }

  return { surah, ayah };
};

export const fetchUnifiedAyah = async (
  surahNumber: number,
  ayahNumber: number
): Promise<UnifiedTafsirAyahResponse> => {
  const [bayan, maududi] = await Promise.all([
    fetchTafsirAyah(surahNumber, ayahNumber, BAYAN_EDITION_SLUG),
    fetchTafsirAyah(surahNumber, ayahNumber, MAUDUDI_URDU_SLUG),
  ]);

  return {
    surah: surahNumber,
    ayah: ayahNumber,
    bayan,
    maududi,
  };
};

export const fetchUnifiedSurah = async (
  surahNumber: number,
  ayahCount?: number
): Promise<UnifiedTafsirSurahResponse> => {
  const [bayanSurah, maududiSurah] = await Promise.all([
    fetchTafsirSurah(surahNumber, BAYAN_EDITION_SLUG, ayahCount),
    fetchTafsirSurah(surahNumber, MAUDUDI_URDU_SLUG, ayahCount),
  ]);

  const maududiByAyah = new Map(maududiSurah.ayahs.map((ayah) => [ayah.ayah, ayah]));
  const ayahs = bayanSurah.ayahs.map((bayan) => ({
    surah: surahNumber,
    ayah: bayan.ayah,
    bayan,
    maududi: maududiByAyah.get(bayan.ayah) || {
      text: '',
      ayah: bayan.ayah,
      surah: surahNumber,
    },
  }));

  if (ayahs.length === 0) {
    throw new Error('No unified tafsir data found for this Surah');
  }

  return {
    surah_number: surahNumber,
    ayahs,
  };
};

export const searchTafsir = async (query: string): Promise<TafsirSearchHit[]> => {
  const runtimeIssue = getTafsirRuntimeIssue();
  if (runtimeIssue) {
    throw new Error(runtimeIssue);
  }

  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const payload = await fetchJsonWithRecovery<any>(
    getTafsirFeatureUrl('/search', `?q=${encodeURIComponent(trimmed)}`),
    {
      cacheTtlMs: 30_000,
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxRetries: 1,
      retryOnStatuses: [429],
      fallbackMessage: 'Failed to search tafsir',
    }
  );

  return normalizeTafsirSearchHits(payload);
};

export const fetchRandomTafsir = async (): Promise<RandomTafsirAyah> => {
  const runtimeIssue = getTafsirRuntimeIssue();
  if (runtimeIssue) {
    throw new Error(runtimeIssue);
  }

  const payload = await fetchJsonWithRecovery<any>(getTafsirFeatureUrl('/random'), {
    cacheTtlMs: 0,
    timeoutMs: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
    retryOnStatuses: [429],
    fallbackMessage: 'Failed to load tafsir of the day',
  });

  return normalizeRandomTafsir(payload);
};
