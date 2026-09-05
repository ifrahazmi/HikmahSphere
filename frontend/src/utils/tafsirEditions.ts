import { DEFAULT_ENGLISH_TRANSLATION, DEFAULT_URDU_TRANSLATION, type SurahData } from '../types/quran';
import type { TafsirEditionMeta } from '../types/tafsir';

export const BAYAN_EDITION_SLUG = 'ur-tafsir-bayan-ul-quran';
export const MAUDUDI_URDU_SLUG = 'ur-maududi';
export const MAUDUDI_ENGLISH_SLUG = 'en-maududi';
export const FAROOQI_SLUG = 'hi-farooq';
export const UNIFIED_TAFSIR_EDITION = 'unified-bayan-maududi';

export const EDITIONS_API_TRANSLATIONS = [
  {
    identifier: MAUDUDI_URDU_SLUG,
    slug: MAUDUDI_URDU_SLUG,
    name: 'Tafheem-ul-Quran (Maududi)',
    language: 'Urdu',
    editionLanguage: 'ur',
    direction: 'rtl' as const,
  },
  {
    identifier: FAROOQI_SLUG,
    slug: FAROOQI_SLUG,
    name: 'Farooq Khan & Ahmed (Farooqi)',
    language: 'Hindi',
    editionLanguage: 'hi',
    direction: 'ltr' as const,
  },
] as const;

export const EDITIONS_API_TRANSLATION_SLUGS = new Set<string>(
  EDITIONS_API_TRANSLATIONS.map((translation) => translation.identifier)
);

export const TRANSLATION_STYLE_SLUGS = new Set([
  ...EDITIONS_API_TRANSLATION_SLUGS,
  MAUDUDI_ENGLISH_SLUG,
]);

export const LEGACY_TAFSIR_EDITION_MAP: Record<string, string> = {
  'bayan-ul-quran-dr-israr-ahmed': BAYAN_EDITION_SLUG,
  'tafheem-ul-quran-syed-abu-ala-maududi': BAYAN_EDITION_SLUG,
};

export const FALLBACK_TAFSIR_EDITIONS: TafsirEditionMeta[] = [
  { slug: BAYAN_EDITION_SLUG, name: 'Tafsir Bayan ul Quran', author_name: 'Dr. Israr Ahmad', language_name: 'urdu' },
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
  { slug: MAUDUDI_ENGLISH_SLUG, name: 'Towards Understanding the Quran (Maududi)', author_name: "Sayyid Abul A'ala Maududi", language_name: 'english' },
];

export const isEditionsApiTranslation = (identifier?: string): boolean => {
  return EDITIONS_API_TRANSLATION_SLUGS.has((identifier || '').trim());
};

export const isTranslationStyleEdition = (slug?: string): boolean => {
  return TRANSLATION_STYLE_SLUGS.has((slug || '').trim());
};

export const filterCommentaryTafsirEditions = (editions: TafsirEditionMeta[]): TafsirEditionMeta[] => {
  return editions.filter((edition) => !isEditionsApiTranslation(edition.slug));
};

export const getRetiredTafsirTranslation = (edition: unknown): string | null => {
  const raw = typeof edition === 'string' ? edition.trim() : '';
  if (!raw) return null;
  if (raw === MAUDUDI_URDU_SLUG || raw === 'tafheem-ul-quran-syed-abu-ala-maududi') {
    return MAUDUDI_URDU_SLUG;
  }
  if (raw === FAROOQI_SLUG) {
    return FAROOQI_SLUG;
  }
  return null;
};

export const isUnifiedTafsirEdition = (slug?: string): boolean => {
  return (slug || '').trim() === UNIFIED_TAFSIR_EDITION;
};

const EDITION_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

export const migrateTafsirEdition = (edition: unknown, extrasEnabled = false): string => {
  const raw = typeof edition === 'string' ? edition.trim() : '';
  if (!raw) {
    return BAYAN_EDITION_SLUG;
  }

  if (raw === UNIFIED_TAFSIR_EDITION) {
    return extrasEnabled ? UNIFIED_TAFSIR_EDITION : BAYAN_EDITION_SLUG;
  }

  if (isEditionsApiTranslation(raw)) {
    return BAYAN_EDITION_SLUG;
  }

  const mapped = LEGACY_TAFSIR_EDITION_MAP[raw] || raw;
  return EDITION_SLUG_RE.test(mapped) ? mapped : BAYAN_EDITION_SLUG;
};

export const resolveEditionsApiSlug = (edition?: string): string => {
  const raw = (edition || '').trim();
  if (!raw || raw === UNIFIED_TAFSIR_EDITION) {
    return BAYAN_EDITION_SLUG;
  }
  if (isEditionsApiTranslation(raw)) {
    return raw;
  }
  return migrateTafsirEdition(raw);
};

export const editionTranslationToSurahData = (
  slug: string,
  surahNumber: number,
  ayahs: Array<{ ayah: number; text: string }>,
  template?: Pick<SurahData, 'name' | 'englishName' | 'englishNameTranslation' | 'revelationType' | 'numberOfAyahs'>
): SurahData => {
  const meta = EDITIONS_API_TRANSLATIONS.find((translation) => translation.identifier === slug);
  const ayahCount = template?.numberOfAyahs || Math.max(0, ...ayahs.map((ayah) => ayah.ayah));
  const byAyah = new Map(ayahs.map((ayah) => [ayah.ayah, ayah.text]));
  const edition = {
    identifier: slug,
    language: meta?.editionLanguage || 'en',
    name: meta?.name || slug,
    englishName: meta?.name || slug,
    format: 'text' as const,
    type: 'translation' as const,
    direction: meta?.direction || 'ltr',
  };

  return {
    number: surahNumber,
    name: template?.name || '',
    englishName: template?.englishName || '',
    englishNameTranslation: template?.englishNameTranslation || '',
    revelationType: template?.revelationType || '',
    numberOfAyahs: ayahCount,
    ayahs: Array.from({ length: ayahCount }, (_, index) => ({
      number: 0,
      numberInSurah: index + 1,
      text: byAyah.get(index + 1) || '',
      surah: {
        number: surahNumber,
        name: template?.name || '',
        englishName: template?.englishName || '',
        englishNameTranslation: template?.englishNameTranslation || '',
        numberOfAyahs: ayahCount,
        revelationType: template?.revelationType || '',
      },
      edition,
    })),
    edition,
  };
};

export const getTafsirLanguageFromSlug = (
  slug?: string,
  catalog?: TafsirEditionMeta[]
): 'english' | 'urdu' | 'hindi' => {
  const normalized = (slug || '').trim();
  const fromCatalog = catalog?.find((item) => item.slug === normalized)?.language_name;
  if (fromCatalog === 'urdu' || fromCatalog === 'hindi' || fromCatalog === 'english') {
    return fromCatalog;
  }
  if (normalized.startsWith('ur-')) return 'urdu';
  if (normalized.startsWith('hi-')) return 'hindi';
  return 'english';
};

export const getTafsirTextDirection = (language: string): 'rtl' | 'ltr' => {
  return language === 'urdu' ? 'rtl' : 'ltr';
};

export const getTranslationDisplayStyle = (
  language?: string
): { dir: 'rtl' | 'ltr'; lang: string; className: string } => {
  if (language === 'Urdu') {
    return {
      dir: 'rtl',
      lang: 'ur',
      className: 'quran-urdu-translation font-jameel-noori text-right',
    };
  }
  if (language === 'Hindi') {
    return {
      dir: 'ltr',
      lang: 'hi',
      className: 'quran-hindi-translation font-hindi text-left leading-8',
    };
  }
  return {
    dir: 'ltr',
    lang: 'en',
    className: 'text-left leading-8 whitespace-pre-wrap',
  };
};

export const getPreferredTranslationForEdition = (slug?: string): string => {
  const normalized = (slug || '').trim();
  if (normalized === MAUDUDI_URDU_SLUG || normalized === 'tafheem-ul-quran-syed-abu-ala-maududi') {
    return MAUDUDI_URDU_SLUG;
  }
  if (normalized === FAROOQI_SLUG) {
    return FAROOQI_SLUG;
  }
  if (normalized === MAUDUDI_ENGLISH_SLUG) {
    return 'en.maududi';
  }
  if (normalized.startsWith('en-')) {
    return DEFAULT_ENGLISH_TRANSLATION.identifier;
  }
  return DEFAULT_URDU_TRANSLATION.identifier;
};

export const getEditionDisplayLabel = (edition: TafsirEditionMeta | { slug: string; name?: string; author_name?: string }): string => {
  if (edition.slug === UNIFIED_TAFSIR_EDITION) {
    return 'Both (Bayan + Tafheem)';
  }
  const name = edition.name || edition.slug;
  return edition.author_name && !name.includes(edition.author_name)
    ? `${name} — ${edition.author_name}`
    : name;
};

export const groupEditionsByLanguage = (editions: TafsirEditionMeta[]) => {
  const groups: Array<{ language: 'urdu' | 'english' | 'hindi'; label: string; editions: TafsirEditionMeta[] }> = [
    { language: 'urdu', label: 'Urdu', editions: [] },
    { language: 'english', label: 'English', editions: [] },
    { language: 'hindi', label: 'Hindi', editions: [] },
  ];

  editions.forEach((edition) => {
    const group = groups.find((item) => item.language === edition.language_name);
    if (group) {
      group.editions.push(edition);
    }
  });

  return groups.filter((group) => group.editions.length > 0);
};
