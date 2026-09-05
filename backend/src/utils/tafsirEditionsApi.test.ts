import { describe, expect, it } from '@jest/globals';
import {
  DEFAULT_TAFSIR_EDITIONS_API_URL,
  buildEditionAyahPath,
  buildEditionSurahPath,
  filterTafsirEditionsCatalog,
  getTafsirEditionsApiBase,
  isValidEditionSlug,
  normalizeEditionAyahPayload,
} from './tafsirEditionsApi';

describe('tafsir editions API helpers', () => {
  it('builds the public ayah and surah paths', () => {
    expect(buildEditionAyahPath('ur-maududi', 2, 258)).toBe('/editions/ur-maududi/2/258');
    expect(buildEditionSurahPath('en-tafisr-ibn-kathir', 2)).toBe('/editions/en-tafisr-ibn-kathir/2');
    expect(getTafsirEditionsApiBase(null)).toBe(DEFAULT_TAFSIR_EDITIONS_API_URL);
    expect(getTafsirEditionsApiBase(' https://example.test/ ')).toBe('https://example.test');
  });

  it('keeps only English, Urdu, and Hindi catalog rows', () => {
    const filtered = filterTafsirEditionsCatalog([
      { slug: 'ur-maududi', name: 'Maududi', author_name: 'Maududi', language_name: 'urdu' },
      { slug: 'ur-tafseer-ibn-e-kaseer', name: 'Ibn Kathir Urdu', author_name: 'Ibn Kathir', language_name: 'urdu' },
      { slug: 'en-tafisr-ibn-kathir', name: 'Ibn Kathir', author_name: 'Ibn Kathir', language_name: 'english' },
      { slug: 'hi-farooq', name: 'Farooqi', author_name: 'Farooq', language_name: 'hindi' },
      { slug: 'ar-tafsir-ibn-kathir', name: 'Arabic Ibn Kathir', author_name: 'Ibn Kathir', language_name: 'arabic' },
      { slug: 'bn-tafisr-fathul-majid', name: 'Bengali', author_name: 'X', language_name: 'bengali' },
      { slug: 'not a slug', name: 'Bad', author_name: 'X', language_name: 'english' },
    ]);

    expect(filtered.map((item) => item.slug)).toEqual([
      'en-tafisr-ibn-kathir',
      'ur-tafseer-ibn-e-kaseer',
    ]);
  });

  it('normalizes a simple ayah payload', () => {
    expect(isValidEditionSlug('ur-maududi')).toBe(true);
    expect(normalizeEditionAyahPayload({ ayah: 258, surah: 2, text: 'ترجمہ' }, 1, 1)).toEqual({
      ayah: 258,
      surah: 2,
      text: 'ترجمہ',
    });
  });
});
