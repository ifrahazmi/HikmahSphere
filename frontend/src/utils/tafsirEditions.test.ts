import {
  BAYAN_EDITION_SLUG,
  FALLBACK_TAFSIR_EDITIONS,
  MAUDUDI_URDU_SLUG,
  UNIFIED_TAFSIR_EDITION,
  filterCommentaryTafsirEditions,
  getRetiredTafsirTranslation,
  getTafsirLanguageFromSlug,
  getTafsirTextDirection,
  getTranslationDisplayStyle,
  groupEditionsByLanguage,
  isTranslationStyleEdition,
  migrateTafsirEdition,
  resolveEditionsApiSlug,
} from './tafsirEditions';

describe('tafsir edition helpers', () => {
  it('migrates legacy edition IDs to catalog slugs', () => {
    expect(migrateTafsirEdition('bayan-ul-quran-dr-israr-ahmed')).toBe(BAYAN_EDITION_SLUG);
    expect(migrateTafsirEdition('tafheem-ul-quran-syed-abu-ala-maududi')).toBe(BAYAN_EDITION_SLUG);
    expect(migrateTafsirEdition(MAUDUDI_URDU_SLUG)).toBe(BAYAN_EDITION_SLUG);
    expect(migrateTafsirEdition('hi-farooq')).toBe(BAYAN_EDITION_SLUG);
    expect(migrateTafsirEdition(UNIFIED_TAFSIR_EDITION, false)).toBe(BAYAN_EDITION_SLUG);
    expect(migrateTafsirEdition(UNIFIED_TAFSIR_EDITION, true)).toBe(UNIFIED_TAFSIR_EDITION);
    expect(migrateTafsirEdition('en-tafisr-ibn-kathir')).toBe('en-tafisr-ibn-kathir');
    expect(migrateTafsirEdition('not a valid slug')).toBe(BAYAN_EDITION_SLUG);
  });

  it('treats Maududi and Farooqi as translation-style editions', () => {
    expect(isTranslationStyleEdition('ur-maududi')).toBe(true);
    expect(isTranslationStyleEdition('en-maududi')).toBe(true);
    expect(isTranslationStyleEdition('hi-farooq')).toBe(true);
    expect(isTranslationStyleEdition('en-tafisr-ibn-kathir')).toBe(false);
  });

  it('uses RTL only for Urdu commentary', () => {
    expect(getTafsirLanguageFromSlug('ur-tafsir-bayan-ul-quran')).toBe('urdu');
    expect(getTafsirLanguageFromSlug('en-tafisr-ibn-kathir')).toBe('english');
    expect(getTafsirLanguageFromSlug('hi-farooq')).toBe('hindi');
    expect(getTafsirTextDirection('urdu')).toBe('rtl');
    expect(getTafsirTextDirection('english')).toBe('ltr');
    expect(getTafsirTextDirection('hindi')).toBe('ltr');
  });

  it('styles translation languages independently of the tafsir edition', () => {
    expect(getTranslationDisplayStyle('Urdu')).toMatchObject({ dir: 'rtl', lang: 'ur' });
    expect(getTranslationDisplayStyle('Urdu').className).toContain('quran-urdu-translation');
    expect(getTranslationDisplayStyle('Hindi')).toMatchObject({ dir: 'ltr', lang: 'hi' });
    expect(getTranslationDisplayStyle('Hindi').className).toContain('quran-hindi-translation');
    expect(getTranslationDisplayStyle('English')).toMatchObject({ dir: 'ltr', lang: 'en' });
  });

  it('groups the commentary catalog as Urdu then English', () => {
    const groups = groupEditionsByLanguage(FALLBACK_TAFSIR_EDITIONS);
    expect(groups.map((group) => group.language)).toEqual(['urdu', 'english']);
    expect(groups[0].editions.some((edition) => edition.slug === BAYAN_EDITION_SLUG)).toBe(true);
    expect(groups.some((group) => group.editions.some((edition) => edition.slug === 'ur-maududi'))).toBe(false);
    expect(groups.some((group) => group.editions.some((edition) => edition.slug === 'hi-farooq'))).toBe(false);
  });

  it('moves retired tafsir slugs onto the translation list', () => {
    expect(getRetiredTafsirTranslation('ur-maududi')).toBe(MAUDUDI_URDU_SLUG);
    expect(getRetiredTafsirTranslation('tafheem-ul-quran-syed-abu-ala-maududi')).toBe(MAUDUDI_URDU_SLUG);
    expect(getRetiredTafsirTranslation('hi-farooq')).toBe('hi-farooq');
    expect(getRetiredTafsirTranslation(BAYAN_EDITION_SLUG)).toBeNull();
    expect(filterCommentaryTafsirEditions([
      { slug: BAYAN_EDITION_SLUG, name: 'Bayan', author_name: 'Israr', language_name: 'urdu' },
      { slug: MAUDUDI_URDU_SLUG, name: 'Maududi', author_name: 'Maududi', language_name: 'urdu' },
      { slug: 'hi-farooq', name: 'Farooqi', author_name: 'Farooq', language_name: 'hindi' },
    ]).map((edition) => edition.slug)).toEqual([BAYAN_EDITION_SLUG]);
  });

  it('keeps Maududi and Farooqi slugs when fetching translation text', () => {
    expect(resolveEditionsApiSlug('ur-maududi')).toBe('ur-maududi');
    expect(resolveEditionsApiSlug('hi-farooq')).toBe('hi-farooq');
    expect(resolveEditionsApiSlug('bayan-ul-quran-dr-israr-ahmed')).toBe(BAYAN_EDITION_SLUG);
    expect(resolveEditionsApiSlug('en-tafisr-ibn-kathir')).toBe('en-tafisr-ibn-kathir');
  });
});
