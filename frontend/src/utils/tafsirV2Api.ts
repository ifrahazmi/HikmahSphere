import type { TafsirAyahResponse, TafsirEditionMeta, TafsirSurahResponse } from '../types/tafsir';
import { API_URL } from '../config';
import { fetchJsonWithRecovery } from './fetchWithRecovery';
import { normalizeReadingText } from './quranReadingFonts';
import {
  BAYAN_EDITION_SLUG,
  MAUDUDI_FULL_SLUG,
  MAUDUDI_SHORT_SLUG,
  isV2TafsirEdition,
} from './tafsirEditions';

const REQUEST_TIMEOUT_MS = Number(process.env.REACT_APP_TAFSIR_TIMEOUT_MS || 30000);
const EMPTY_AYAHS_CACHE_TTL_MS = 10 * 60 * 1000;

export type TafsirV2Resource = 'ayah' | 'surah' | 'empty-ayahs' | 'introduction';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const emptyAyahsCache = new Map<number, CacheEntry<number[]>>();

const isBrowserDirectTafsirUrl = (url: string): boolean => {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(url);
};

const resolveOptionalDirectUrl = (value?: string): string | null => {
  const normalized = (value || '').trim().replace(/\/$/, '');
  if (!normalized || !isBrowserDirectTafsirUrl(normalized)) {
    return null;
  }
  return normalized;
};

export const getTafsirV2ApiUrl = (): string => {
  return resolveOptionalDirectUrl(process.env.REACT_APP_TAFSIR_V2_API_URL) || `${API_URL}/quran/tafsir-v2`;
};

export const getTafsirV2Path = (
  slug: string,
  resource: TafsirV2Resource,
  surah: number,
  ayah?: number
): string => {
  if (slug === MAUDUDI_SHORT_SLUG) {
    if (resource === 'ayah') {
      return `/maududi/surah/${surah}/ayah/${ayah}`;
    }
    return `/maududi/surah/${surah}`;
  }

  if (slug === MAUDUDI_FULL_SLUG) {
    if (resource === 'ayah') {
      return `/maududi-full/surah/${surah}/ayah/${ayah}`;
    }
    if (resource === 'introduction') {
      return `/maududi-full/surah/${surah}/introduction`;
    }
    return `/maududi-full/surah/${surah}`;
  }

  if (resource === 'ayah') {
    return `/surah/${surah}/ayah/${ayah}`;
  }
  if (resource === 'empty-ayahs') {
    return `/surah/${surah}/empty-ayahs`;
  }
  return `/surah/${surah}`;
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const assertNoV2Error = (payload: unknown): void => {
  const record = toRecord(payload);
  const message = typeof record?.error === 'string' ? record.error.trim() : '';
  if (message) {
    throw new Error(message);
  }
};

const parseAyahFromKey = (key: string): { surah: number; ayah: number } | null => {
  const match = key.match(/^(\d+):(\d+)$/);
  if (!match) return null;
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  if (!Number.isFinite(surah) || !Number.isFinite(ayah)) return null;
  return { surah, ayah };
};

const normalizeFootnotes = (value: unknown): Record<string, string> => {
  const record = toRecord(value);
  if (!record) return {};

  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => key.trim().length > 0)
      .map(([key, text]) => [key, normalizeReadingText(String(text ?? ''))] as const)
      .filter(([, text]) => text.length > 0)
  );
};

const normalizeSourcePages = (value: unknown): number[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const pages = value
    .map((item) => Number(item))
    .filter((page) => Number.isInteger(page) && page > 0);
  return pages.length > 0 ? pages : undefined;
};

const unwrapPayload = (payload: unknown): unknown => {
  const record = toRecord(payload);
  if (record && 'data' in record && record.data !== undefined) {
    return record.data;
  }
  return payload;
};

export const normalizeTafsirV2Ayah = (
  payload: unknown,
  fallbackSurah: number,
  fallbackAyah: number
): TafsirAyahResponse => {
  assertNoV2Error(payload);
  const data = unwrapPayload(payload);

  if (data && typeof data === 'object' && !Array.isArray(data) && typeof (data as { key?: unknown }).key === 'string') {
    const parsed = parseAyahFromKey(String((data as { key: string }).key));
    if (parsed) {
      return normalizeTafsirV2AyahEntry(data, parsed.surah, parsed.ayah);
    }
  }

  if (data && typeof data === 'object' && !Array.isArray(data) && !('ayah' in (data as object)) && !('surah' in (data as object))) {
    const keyedEntry = Object.entries(data as Record<string, unknown>).find(([key]) => /^\d+:\d+$/.test(key));
    if (keyedEntry) {
      const parsed = parseAyahFromKey(keyedEntry[0]);
      if (parsed) {
        return normalizeTafsirV2AyahEntry(keyedEntry[1], parsed.surah, parsed.ayah);
      }
    }
  }

  return normalizeTafsirV2AyahEntry(data, fallbackSurah, fallbackAyah);
};

export const normalizeTafsirV2AyahEntry = (
  rawAyah: unknown,
  fallbackSurah: number,
  fallbackAyah: number
): TafsirAyahResponse => {
  const ayahRecord = toRecord(rawAyah) || {};
  const translationHtml = normalizeReadingText(String(ayahRecord.t ?? ayahRecord.translationHtml ?? ''));
  const translationPlain = normalizeReadingText(String(ayahRecord.translationPlain ?? ayahRecord.translation ?? ''));
  const text = normalizeReadingText(String(ayahRecord.text ?? ayahRecord.tafsir ?? ''));
  const volume = Number(ayahRecord.volume);
  const keyParsed = typeof ayahRecord.key === 'string' ? parseAyahFromKey(ayahRecord.key) : null;

  return {
    text,
    ayah: Number(ayahRecord.ayah ?? keyParsed?.ayah ?? fallbackAyah),
    surah: Number(ayahRecord.surah ?? keyParsed?.surah ?? fallbackSurah),
    translationHtml: translationHtml || undefined,
    translationPlain: translationPlain || undefined,
    footnotes: normalizeFootnotes(ayahRecord.f ?? ayahRecord.footnotes),
    volume: Number.isInteger(volume) && volume > 0 ? volume : undefined,
    source_pages: normalizeSourcePages(ayahRecord.source_pages ?? ayahRecord.sourcePages),
    introduction: typeof ayahRecord.introduction === 'string'
      ? normalizeReadingText(ayahRecord.introduction)
      : undefined,
  };
};

export const normalizeTafsirV2Surah = (
  payload: unknown,
  fallbackSurah: number
): TafsirSurahResponse => {
  assertNoV2Error(payload);
  const data = unwrapPayload(payload);
  const record = toRecord(data);
  const surahNumber = Number(
    record?.surah_number ?? record?.surah ?? record?.surahNumber ?? fallbackSurah
  );

  const normalizeKeyedAyahMap = (source: Record<string, unknown>) =>
    Object.entries(source)
      .map(([key, value]) => {
        const parsed = parseAyahFromKey(key);
        if (!parsed) return null;
        return normalizeTafsirV2AyahEntry(value, parsed.surah, parsed.ayah);
      })
      .filter((ayah): ayah is TafsirAyahResponse => Boolean(ayah))
      .sort((first, second) => first.ayah - second.ayah);

  if (Array.isArray(data)) {
    const ayahs = data.map((ayah, index) =>
      normalizeTafsirV2AyahEntry(ayah, surahNumber, index + 1)
    );
    if (!ayahs.length) {
      throw new Error('Unexpected tafsir v2 surah response format');
    }
    return { surah_number: ayahs[0].surah || surahNumber, ayahs };
  }

  if (record && Array.isArray(record.ayahs)) {
    const ayahs = record.ayahs.map((ayah, index) =>
      normalizeTafsirV2AyahEntry(ayah, surahNumber, Number((ayah as { ayah?: number })?.ayah ?? index + 1))
    );
    return {
      surah_number: surahNumber || ayahs[0]?.surah || fallbackSurah,
      ayahs: ayahs.sort((first, second) => first.ayah - second.ayah),
      introduction: typeof record.introduction === 'string'
        ? normalizeReadingText(record.introduction)
        : undefined,
    };
  }

  if (record?.ayahs && typeof record.ayahs === 'object' && !Array.isArray(record.ayahs)) {
    const ayahs = normalizeKeyedAyahMap(record.ayahs as Record<string, unknown>);
    if (!ayahs.length) {
      throw new Error('Unexpected tafsir v2 surah response format');
    }
    return {
      surah_number: surahNumber || ayahs[0].surah,
      ayahs,
      introduction: typeof record.introduction === 'string'
        ? normalizeReadingText(record.introduction)
        : undefined,
    };
  }

  if (record && !Array.isArray(record) && !('surah_number' in record) && !('ayahs' in record)) {
    const ayahs = normalizeKeyedAyahMap(record);
    if (ayahs.length) {
      return { surah_number: ayahs[0].surah, ayahs };
    }
  }

  throw new Error('Unexpected tafsir v2 surah response format');
};

export const normalizeTafsirV2Editions = (payload: unknown): TafsirEditionMeta[] => {
  assertNoV2Error(payload);
  const data = unwrapPayload(payload);
  const rows = Array.isArray(data) ? data : [];

  return rows
    .map((row): TafsirEditionMeta | null => {
      const record = toRecord(row);
      if (!record) return null;
      const slug = String(record.slug || '').trim();
      if (!isV2TafsirEdition(slug)) return null;
      return {
        id: typeof record.id === 'number' ? record.id : undefined,
        slug,
        name: String(record.name || slug),
        author_name: String(record.author_name || ''),
        language_name: String(record.language_name || 'urdu'),
        source: typeof record.source === 'string' ? record.source : undefined,
      };
    })
    .filter((edition): edition is TafsirEditionMeta => Boolean(edition));
};

export const normalizeTafsirV2EmptyAyahs = (payload: unknown): number[] => {
  const data = unwrapPayload(payload);
  const list = Array.isArray(data)
    ? data
    : Array.isArray((toRecord(data) || {}).empty_ayahs)
      ? (toRecord(data) as { empty_ayahs: unknown[] }).empty_ayahs
      : Array.isArray((toRecord(data) || {}).emptyAyahs)
        ? (toRecord(data) as { emptyAyahs: unknown[] }).emptyAyahs
        : [];

  return list
    .map((item) => {
      if (typeof item === 'number') return item;
      if (typeof item === 'string' && /^\d+$/.test(item)) return Number(item);
      const record = toRecord(item);
      return Number(record?.ayah ?? record?.ayah_number);
    })
    .filter((ayah) => Number.isInteger(ayah) && ayah > 0);
};

export const normalizeTafsirV2Introduction = (payload: unknown): string => {
  assertNoV2Error(payload);
  const data = unwrapPayload(payload);
  if (typeof data === 'string') {
    return normalizeReadingText(data);
  }
  const record = toRecord(data);
  return normalizeReadingText(String(
    record?.text ?? record?.introduction ?? record?.intro ?? ''
  ));
};

const fetchV2Json = async <T>(path: string, fallbackMessage: string): Promise<T> => {
  return fetchJsonWithRecovery<T>(`${getTafsirV2ApiUrl()}${path}`, {
    cacheTtlMs: 0,
    timeoutMs: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
    retryOnStatuses: [429],
    fallbackMessage,
  });
};

export const fetchTafsirV2Editions = async (): Promise<TafsirEditionMeta[]> => {
  const payload = await fetchJsonWithRecovery<unknown>(`${getTafsirV2ApiUrl()}/editions`, {
    cacheTtlMs: 10 * 60 * 1000,
    timeoutMs: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
    retryOnStatuses: [429],
    fallbackMessage: 'Failed to load tafsir v2 editions',
  });
  return normalizeTafsirV2Editions(payload);
};

export const fetchTafsirV2EmptyAyahs = async (surahNumber: number): Promise<number[]> => {
  const cached = emptyAyahsCache.get(surahNumber);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const payload = await fetchV2Json<unknown>(
      getTafsirV2Path(BAYAN_EDITION_SLUG, 'empty-ayahs', surahNumber),
      'Failed to load empty tafsir ayahs'
    );
    const emptyAyahs = normalizeTafsirV2EmptyAyahs(payload);
    emptyAyahsCache.set(surahNumber, {
      value: emptyAyahs,
      expiresAt: Date.now() + EMPTY_AYAHS_CACHE_TTL_MS,
    });
    return emptyAyahs;
  } catch {
    return [];
  }
};

export const fetchTafsirV2Introduction = async (surahNumber: number): Promise<string> => {
  const payload = await fetchV2Json<unknown>(
    getTafsirV2Path(MAUDUDI_FULL_SLUG, 'introduction', surahNumber),
    'Failed to load tafsir introduction'
  );
  return normalizeTafsirV2Introduction(payload);
};

const applyEmptyAyahFlags = (
  ayahs: TafsirAyahResponse[],
  emptyAyahs: number[],
  surahNumber: number,
  ayahCount?: number
): TafsirAyahResponse[] => {
  const emptySet = new Set(emptyAyahs);
  const byAyah = new Map(ayahs.map((ayah) => [ayah.ayah, { ...ayah, empty: emptySet.has(ayah.ayah) || ayah.empty }]));
  const total = ayahCount && ayahCount > 0
    ? ayahCount
    : Math.max(0, ...ayahs.map((ayah) => ayah.ayah), ...emptyAyahs);

  if (total <= 0) {
    return ayahs.map((ayah) => ({ ...ayah, empty: emptySet.has(ayah.ayah) || ayah.empty }));
  }

  return Array.from({ length: total }, (_, index) => {
    const ayahNumber = index + 1;
    return byAyah.get(ayahNumber) || {
      text: '',
      ayah: ayahNumber,
      surah: surahNumber,
      empty: emptySet.has(ayahNumber),
    };
  });
};

export const fetchTafsirV2Ayah = async (
  surahNumber: number,
  ayahNumber: number,
  slug: string
): Promise<TafsirAyahResponse> => {
  const payload = await fetchV2Json<unknown>(
    getTafsirV2Path(slug, 'ayah', surahNumber, ayahNumber),
    'Failed to load tafsir for this ayah'
  );
  const normalized = normalizeTafsirV2Ayah(payload, surahNumber, ayahNumber);
  if (slug === BAYAN_EDITION_SLUG) {
    const emptyAyahs = await fetchTafsirV2EmptyAyahs(surahNumber);
    if (emptyAyahs.includes(ayahNumber)) {
      return { ...normalized, empty: true };
    }
  }
  return normalized;
};

export const fetchTafsirV2Surah = async (
  surahNumber: number,
  slug: string,
  ayahCount?: number
): Promise<TafsirSurahResponse> => {
  const payload = await fetchV2Json<unknown>(
    getTafsirV2Path(slug, 'surah', surahNumber),
    'Failed to load tafsir for this surah'
  );
  const normalized = normalizeTafsirV2Surah(payload, surahNumber);

  if (slug === BAYAN_EDITION_SLUG) {
    const emptyAyahs = await fetchTafsirV2EmptyAyahs(surahNumber);
    return {
      ...normalized,
      emptyAyahs,
      ayahs: applyEmptyAyahFlags(normalized.ayahs, emptyAyahs, surahNumber, ayahCount),
    };
  }

  if (slug === MAUDUDI_FULL_SLUG && !normalized.introduction) {
    try {
      const introduction = await fetchTafsirV2Introduction(surahNumber);
      return { ...normalized, introduction };
    } catch {
      return normalized;
    }
  }

  return normalized;
};
