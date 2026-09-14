export const URDU_READING_FONTS = [
  { id: 'jameel-noori', label: 'Jameel Noori Nastaleeq', hint: 'Classic Urdu book style' },
  { id: 'noto-nastaliq', label: 'Noto Nastaliq Urdu', hint: 'Best symbols and honorifics' },
  { id: 'alvi-nastaleeq', label: 'Alvi Nastaleeq', hint: 'Lighter Nastaleeq' },
  { id: 'lateef', label: 'Lateef Naskh', hint: 'Clear mixed Arabic + Urdu' },
] as const;

export const ENGLISH_READING_FONTS = [
  { id: 'noto-serif', label: 'Noto Serif', hint: 'Best mixed Arabic and symbols' },
  { id: 'merriweather', label: 'Merriweather', hint: 'Comfortable long reading' },
  { id: 'lora', label: 'Lora', hint: 'Warm book serif' },
  { id: 'source-serif', label: 'Source Serif', hint: 'Clean modern book face' },
] as const;

export type UrduReadingFont = (typeof URDU_READING_FONTS)[number]['id'];
export type EnglishReadingFont = (typeof ENGLISH_READING_FONTS)[number]['id'];

const URDU_FONT_IDS = new Set<string>(URDU_READING_FONTS.map((font) => font.id));
const ENGLISH_FONT_IDS = new Set<string>(ENGLISH_READING_FONTS.map((font) => font.id));

export const DEFAULT_URDU_READING_FONT: UrduReadingFont = 'jameel-noori';
export const DEFAULT_ENGLISH_READING_FONT: EnglishReadingFont = 'noto-serif';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export const isUrduReadingFont = (value: unknown): value is UrduReadingFont => {
  return typeof value === 'string' && URDU_FONT_IDS.has(value);
};

export const isEnglishReadingFont = (value: unknown): value is EnglishReadingFont => {
  return typeof value === 'string' && ENGLISH_FONT_IDS.has(value);
};

export const resolveUrduReadingFont = (value: unknown): UrduReadingFont => {
  return isUrduReadingFont(value) ? value : DEFAULT_URDU_READING_FONT;
};

export const resolveEnglishReadingFont = (value: unknown): EnglishReadingFont => {
  return isEnglishReadingFont(value) ? value : DEFAULT_ENGLISH_READING_FONT;
};

export const getUrduFontClass = (font?: unknown): string => {
  switch (resolveUrduReadingFont(font)) {
    case 'noto-nastaliq':
      return 'font-urdu-noto-nastaliq';
    case 'alvi-nastaleeq':
      return 'font-urdu-alvi-nastaleeq';
    case 'lateef':
      return 'font-urdu-lateef';
    default:
      return 'font-urdu-jameel-noori';
  }
};

export const getEnglishFontClass = (font?: unknown): string => {
  switch (resolveEnglishReadingFont(font)) {
    case 'merriweather':
      return 'font-en-merriweather';
    case 'lora':
      return 'font-en-lora';
    case 'source-serif':
      return 'font-en-source-serif';
    default:
      return 'font-en-noto-serif';
  }
};

export const decodeReadingEntities = (value: string): string => {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X'
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
        return match;
      }
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }

    return NAMED_ENTITIES[entity] ?? match;
  });
};

export const normalizeReadingText = (value?: string | null): string => {
  return decodeReadingEntities(String(value || ''))
    .replace(/\uFFFD/g, '')
    .replace(/\uFEFF/g, '')
    .trim();
};

export const getTafsirReadingClass = (
  language: 'english' | 'urdu' | 'hindi',
  fonts: { urduFont?: unknown; englishFont?: unknown }
): string => {
  if (language === 'urdu') {
    return `quran-urdu-tafsir quran-reading-text ${getUrduFontClass(fonts.urduFont)}`;
  }
  if (language === 'hindi') {
    return 'quran-hindi-translation font-hindi quran-reading-text text-left';
  }
  return `text-left whitespace-pre-wrap quran-reading-text ${getEnglishFontClass(fonts.englishFont)}`;
};
