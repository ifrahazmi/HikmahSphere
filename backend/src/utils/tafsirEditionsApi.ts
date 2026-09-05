export const DEFAULT_TAFSIR_EDITIONS_API_URL = 'https://api.hikmahsphere.site';
export const ALLOWED_TAFSIR_LANGUAGES = ['english', 'urdu', 'hindi'] as const;

export type AllowedTafsirLanguage = (typeof ALLOWED_TAFSIR_LANGUAGES)[number];

export type TafsirEditionCatalogItem = {
  id?: number;
  slug: string;
  name: string;
  author_name: string;
  language_name: string;
  source?: string;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const LANGUAGE_SET = new Set<string>(ALLOWED_TAFSIR_LANGUAGES);

export const TRANSLATION_ONLY_EDITION_SLUGS = new Set(['ur-maududi', 'hi-farooq']);

export const FALLBACK_TAFSIR_EDITIONS: TafsirEditionCatalogItem[] = [
  { slug: 'ur-tafsir-bayan-ul-quran', name: 'Tafsir Bayan ul Quran', author_name: 'Dr. Israr Ahmad', language_name: 'urdu' },
  { slug: 'ur-tafseer-ibn-e-kaseer', name: 'Tafsir Ibn Kathir', author_name: 'Hafiz Ibn Kathir', language_name: 'urdu' },
  { slug: 'ur-tazkirul-quran', name: 'Tazkirul Quran (Maulana Wahiduddin Khan)', author_name: 'Maulana Wahid Uddin Khan', language_name: 'urdu' },
  { slug: 'en-tafisr-ibn-kathir', name: 'Tafsir Ibn Kathir (abridged)', author_name: 'Hafiz Ibn Kathir', language_name: 'english' },
  { slug: 'en-tafsir-maarif-ul-quran', name: 'Maarif-ul-Quran', author_name: 'Mufti Muhammad Shafi', language_name: 'english' },
  { slug: 'en-tazkirul-quran', name: 'Tazkirul Quran (Maulana Wahiduddin Khan)', author_name: 'Maulana Wahid Uddin Khan', language_name: 'english' },
  { slug: 'en-kashf-al-asrar-tafsir', name: 'Kashf Al-Asrar Tafsir', author_name: 'Kashf Al-Asrar Tafsir', language_name: 'english' },
  { slug: 'en-al-qushairi-tafsir', name: 'Al Qushairi Tafsir', author_name: 'Al Qushairi Tafsir', language_name: 'english' },
  { slug: 'en-kashani-tafsir', name: 'Kashani Tafsir', author_name: 'Kashani Tafsir', language_name: 'english' },
  { slug: 'en-tafsir-al-tustari', name: 'Tafsir al-Tustari', author_name: 'Tafsir al-Tustari', language_name: 'english' },
  { slug: 'en-asbab-al-nuzul-by-al-wahidi', name: 'Asbab Al-Nuzul by Al-Wahidi', author_name: 'Al-Wahidi', language_name: 'english' },
  { slug: 'en-tafsir-ibn-abbas', name: "Tanwir al-Miqbas min Tafsir Ibn Abbas", author_name: "Tanwir al-Miqbas min Tafsir Ibn Abbas", language_name: 'english' },
  { slug: 'en-al-jalalayn', name: 'Al-Jalalayn', author_name: 'Al-Jalalayn', language_name: 'english' },
  { slug: 'en-maududi', name: 'Towards Understanding the Quran (Maududi)', author_name: "Sayyid Abul A'ala Maududi", language_name: 'english' },
];

export const getTafsirEditionsApiBase = (configured?: string | null): string => {
  const normalized = (configured || '').trim().replace(/\/$/, '');
  return normalized || DEFAULT_TAFSIR_EDITIONS_API_URL;
};

export const isValidEditionSlug = (slug: unknown): slug is string => {
  return typeof slug === 'string' && SLUG_RE.test(slug.trim());
};

export const normalizeLanguageName = (value: unknown): string => {
  return String(value || '').trim().toLowerCase();
};

export const isAllowedTafsirLanguage = (value: unknown): value is AllowedTafsirLanguage => {
  return LANGUAGE_SET.has(normalizeLanguageName(value));
};

export const buildEditionAyahPath = (slug: string, surah: number, ayah: number): string => {
  return `/editions/${encodeURIComponent(slug)}/${surah}/${ayah}`;
};

export const buildEditionSurahPath = (slug: string, surah: number): string => {
  return `/editions/${encodeURIComponent(slug)}/${surah}`;
};

export const filterTafsirEditionsCatalog = (value: unknown): TafsirEditionCatalogItem[] => {
  const rows = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const items: TafsirEditionCatalogItem[] = [];

  rows.forEach((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return;
    }

    const record = row as Record<string, unknown>;
    const slug = String(record.slug || '').trim();
    const language = normalizeLanguageName(record.language_name);
    if (!isValidEditionSlug(slug) || !isAllowedTafsirLanguage(language) || TRANSLATION_ONLY_EDITION_SLUGS.has(slug)) {
      return;
    }
    if (seen.has(slug)) {
      return;
    }

    const item: TafsirEditionCatalogItem = {
      slug,
      name: String(record.name || slug).trim(),
      author_name: String(record.author_name || '').trim(),
      language_name: language,
    };
    const parsedId = Number(record.id);
    if (Number.isFinite(parsedId)) {
      item.id = parsedId;
    }
    if (typeof record.source === 'string') {
      item.source = record.source;
    }

    seen.add(slug);
    items.push(item);
  });

  return items.sort((first, second) => {
    const languageOrder = ALLOWED_TAFSIR_LANGUAGES.indexOf(first.language_name as AllowedTafsirLanguage)
      - ALLOWED_TAFSIR_LANGUAGES.indexOf(second.language_name as AllowedTafsirLanguage);
    if (languageOrder !== 0) {
      return languageOrder;
    }
    return first.name.localeCompare(second.name);
  });
};

export const normalizeEditionAyahPayload = (
  payload: unknown,
  fallbackSurah: number,
  fallbackAyah: number
): { ayah: number; surah: number; text: string } => {
  const record = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const data = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : record;

  const ayah = Number(data.ayah ?? fallbackAyah);
  const surah = Number(data.surah ?? fallbackSurah);
  const text = String(data.text ?? data.tafsir ?? '').trim();

  return {
    ayah: Number.isInteger(ayah) && ayah > 0 ? ayah : fallbackAyah,
    surah: Number.isInteger(surah) && surah > 0 ? surah : fallbackSurah,
    text,
  };
};

export const normalizeEditionSurahPayload = (
  payload: unknown,
  fallbackSurah: number
): { surah_number: number; ayahs: Array<{ ayah: number; surah: number; text: string }> } => {
  const record = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const data = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : record;

  const ayahsRaw = Array.isArray(data.ayahs) ? data.ayahs : Array.isArray(payload) ? payload : [];
  const ayahs = ayahsRaw
    .map((item, index) => normalizeEditionAyahPayload(item, fallbackSurah, index + 1))
    .filter((item) => item.text.length > 0 || item.ayah > 0)
    .sort((first, second) => first.ayah - second.ayah);

  return {
    surah_number: Number(data.surah_number ?? data.surah ?? fallbackSurah) || fallbackSurah,
    ayahs,
  };
};
