import {
  BAYAN_EDITION_SLUG,
  FALLBACK_TAFSIR_EDITIONS,
  MAUDUDI_FULL_SLUG,
  MAUDUDI_SHORT_SLUG,
  MAUDUDI_URDU_SLUG,
  UNIFIED_TAFSIR_EDITION,
  filterCommentaryTafsirEditions,
  getRetiredTafsirTranslation,
  getTafsirLanguageFromSlug,
  getTafsirTextDirection,
  getTranslationDisplayStyle,
  getEditionPickerCopy,
  groupEditionsByLanguage,
  isMaududiFullEdition,
  isMaududiShortEdition,
  isTranslationStyleEdition,
  isV2TafsirEdition,
  mergeTafsirEditionCatalogs,
  migrateTafsirEdition,
  resolveEditionsApiSlug,
} from './tafsirEditions';

describe('tafsir edition helpers', () => {
  it('migrates legacy edition IDs to catalog slugs', () => {
    expect(migrateTafsirEdition('bayan-ul-quran-dr-israr-ahmed')).toBe(BAYAN_EDITION_SLUG);
    expect(migrateTafsirEdition('tafheem-ul-quran-syed-abu-ala-maududi')).toBe(MAUDUDI_SHORT_SLUG);
    expect(migrateTafsirEdition(MAUDUDI_URDU_SLUG)).toBe(BAYAN_EDITION_SLUG);
    expect(migrateTafsirEdition('hi-farooq')).toBe(BAYAN_EDITION_SLUG);
    expect(migrateTafsirEdition(UNIFIED_TAFSIR_EDITION, false)).toBe(BAYAN_EDITION_SLUG);
    expect(migrateTafsirEdition(UNIFIED_TAFSIR_EDITION, true)).toBe(UNIFIED_TAFSIR_EDITION);
    expect(migrateTafsirEdition('en-tafisr-ibn-kathir')).toBe('en-tafisr-ibn-kathir');
    expect(migrateTafsirEdition('en-tafsir-maarif-ul-quran')).toBe('en-tafsir-maarif-ul-quran');
    expect(migrateTafsirEdition('en-al-jalalayn')).toBe('en-al-jalalayn');
    expect(migrateTafsirEdition('en-kashani-tafsir')).toBe('en-tafisr-ibn-kathir');
    expect(migrateTafsirEdition('en-maududi')).toBe('en-tafisr-ibn-kathir');
    expect(migrateTafsirEdition('ur-tazkirul-quran')).toBe(BAYAN_EDITION_SLUG);
    expect(migrateTafsirEdition('en-tazkirul-quran')).toBe('en-tafisr-ibn-kathir');
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
    expect(groups[0].editions.map((edition) => edition.slug)).toEqual([
      BAYAN_EDITION_SLUG,
      MAUDUDI_SHORT_SLUG,
      'ur-tafseer-ibn-e-kaseer',
    ]);
    expect(groups[1].editions.map((edition) => edition.slug)).toEqual([
      'en-tafisr-ibn-kathir',
      'en-tafsir-maarif-ul-quran',
      'en-al-jalalayn',
    ]);
    expect(groups.some((group) => group.editions.some((edition) => edition.slug === 'ur-maududi'))).toBe(false);
    expect(groups.some((group) => group.editions.some((edition) => edition.slug === 'hi-farooq'))).toBe(false);
    expect(groups.some((group) => group.editions.some((edition) => edition.slug === 'ur-tazkirul-quran'))).toBe(false);
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
      { slug: 'en-kashani-tafsir', name: 'Kashani', author_name: 'Kashani', language_name: 'english' },
      { slug: 'en-al-jalalayn', name: 'Jalalayn', author_name: 'Jalalayn', language_name: 'english' },
    ]).map((edition) => edition.slug)).toEqual([BAYAN_EDITION_SLUG, 'en-al-jalalayn']);
  });

  it('keeps Maududi and Farooqi slugs when fetching translation text', () => {
    expect(resolveEditionsApiSlug('ur-maududi')).toBe('ur-maududi');
    expect(resolveEditionsApiSlug('hi-farooq')).toBe('hi-farooq');
    expect(resolveEditionsApiSlug('bayan-ul-quran-dr-israr-ahmed')).toBe(BAYAN_EDITION_SLUG);
    expect(resolveEditionsApiSlug('en-tafisr-ibn-kathir')).toBe('en-tafisr-ibn-kathir');
  });

  it('treats only Maududi Short/Full as v2 tafsir editions', () => {
    expect(isV2TafsirEdition(BAYAN_EDITION_SLUG)).toBe(false);
    expect(isV2TafsirEdition(MAUDUDI_SHORT_SLUG)).toBe(true);
    expect(isV2TafsirEdition(MAUDUDI_FULL_SLUG)).toBe(true);
    expect(isV2TafsirEdition('en-tafisr-ibn-kathir')).toBe(false);
    expect(isMaududiShortEdition(MAUDUDI_SHORT_SLUG)).toBe(true);
    expect(isMaududiFullEdition(MAUDUDI_FULL_SLUG)).toBe(true);
    expect(isTranslationStyleEdition(MAUDUDI_SHORT_SLUG)).toBe(false);
  });

  it('keeps Bayan from v1 and adds Maududi from v2 without duplicating Bayan', () => {
    const mergedWithoutFull = mergeTafsirEditionCatalogs(
      [
        { slug: BAYAN_EDITION_SLUG, name: 'Tafsir Bayan ul Quran', author_name: 'Dr. Israr Ahmad', language_name: 'urdu' },
        { slug: 'en-tafisr-ibn-kathir', name: 'Ibn Kathir', author_name: 'Ibn Kathir', language_name: 'english' },
      ],
      [
        { slug: BAYAN_EDITION_SLUG, name: 'Bayan from v2', author_name: 'Dr. Israr Ahmad', language_name: 'urdu' },
        { slug: MAUDUDI_SHORT_SLUG, name: 'Tafhim-ul-Quran (Short)', author_name: 'Syed Abul Ala Maududi', language_name: 'urdu' },
      ]
    );

    expect(mergedWithoutFull.map((edition) => edition.slug)).toEqual([
      BAYAN_EDITION_SLUG,
      MAUDUDI_SHORT_SLUG,
      'en-tafisr-ibn-kathir',
    ]);
    expect(mergedWithoutFull[0].name).toBe('Tafsir Bayan ul Quran');
    expect(mergedWithoutFull.filter((edition) => edition.slug === BAYAN_EDITION_SLUG)).toHaveLength(1);
    expect(mergedWithoutFull.some((edition) => edition.slug === MAUDUDI_FULL_SLUG)).toBe(false);

    const mergedWithFull = mergeTafsirEditionCatalogs(mergedWithoutFull, [
      { slug: MAUDUDI_FULL_SLUG, name: 'Tafhim-ul-Quran (Full)', author_name: 'Syed Abul Ala Maududi', language_name: 'urdu' },
    ]);
    expect(mergedWithFull.map((edition) => edition.slug)).toContain(MAUDUDI_FULL_SLUG);
  });

  it('shows a clear title, author, and language for the picker', () => {
    expect(getEditionPickerCopy({
      slug: BAYAN_EDITION_SLUG,
      name: 'Tafsir Bayan ul Quran',
      author_name: 'Dr. Israr Ahmad',
      language_name: 'urdu',
    })).toEqual({
      title: 'Tafsir Bayan ul Quran',
      author: 'Dr. Israr Ahmad',
      language: 'Urdu',
    });
    expect(getEditionPickerCopy({
      slug: 'en-tafisr-ibn-kathir',
      name: 'Tafsir Ibn Kathir (abridged)',
      author_name: 'Hafiz Ibn Kathir',
      language_name: 'english',
    }).language).toBe('English');
  });
});
