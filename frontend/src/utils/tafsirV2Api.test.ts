import {
  getTafsirV2ApiUrl,
  getTafsirV2Path,
  normalizeTafsirV2Ayah,
  normalizeTafsirV2Editions,
  normalizeTafsirV2EmptyAyahs,
  normalizeTafsirV2Introduction,
  normalizeTafsirV2Surah,
} from './tafsirV2Api';
import { BAYAN_EDITION_SLUG, MAUDUDI_FULL_SLUG, MAUDUDI_SHORT_SLUG } from './tafsirEditions';

describe('tafsir v2 paths', () => {
  const originalV2 = process.env.REACT_APP_TAFSIR_V2_API_URL;

  afterEach(() => {
    process.env.REACT_APP_TAFSIR_V2_API_URL = originalV2;
  });

  it('ignores the public apiv2 host and uses the backend proxy', () => {
    process.env.REACT_APP_TAFSIR_V2_API_URL = 'https://apiv2.hikmahsphere.site/api';
    expect(getTafsirV2ApiUrl()).toMatch(/\/quran\/tafsir-v2$/);
  });

  it('still allows a local v2 server from the browser', () => {
    process.env.REACT_APP_TAFSIR_V2_API_URL = 'http://localhost:8081/api';
    expect(getTafsirV2ApiUrl()).toBe('http://localhost:8081/api');
  });

  it('maps editions to native v2 paths', () => {
    expect(getTafsirV2Path(BAYAN_EDITION_SLUG, 'surah', 1)).toBe('/surah/1');
    expect(getTafsirV2Path(BAYAN_EDITION_SLUG, 'ayah', 1, 1)).toBe('/surah/1/ayah/1');
    expect(getTafsirV2Path(BAYAN_EDITION_SLUG, 'empty-ayahs', 2)).toBe('/surah/2/empty-ayahs');
    expect(getTafsirV2Path(MAUDUDI_SHORT_SLUG, 'surah', 1)).toBe('/maududi/surah/1');
    expect(getTafsirV2Path(MAUDUDI_SHORT_SLUG, 'ayah', 1, 2)).toBe('/maududi/surah/1/ayah/2');
    expect(getTafsirV2Path(MAUDUDI_FULL_SLUG, 'surah', 1)).toBe('/maududi-full/surah/1');
    expect(getTafsirV2Path(MAUDUDI_FULL_SLUG, 'ayah', 1, 1)).toBe('/maududi-full/surah/1/ayah/1');
    expect(getTafsirV2Path(MAUDUDI_FULL_SLUG, 'introduction', 1)).toBe('/maududi-full/surah/1/introduction');
  });
});

describe('tafsir v2 normalizers', () => {
  it('normalizes Bayan commentary ayahs', () => {
    const ayah = normalizeTafsirV2Ayah({
      text: 'سورة الفاتحہ اگرچہ قرآن حکیم کی مختصر سورتوں میں سے ہے',
      ayah: 1,
      surah: 1,
    }, 1, 1);

    expect(ayah).toMatchObject({
      surah: 1,
      ayah: 1,
    });
    expect(ayah.text).toContain('سورة الفاتحہ');
  });

  it('normalizes Maududi Short translation and footnotes', () => {
    const ayah = normalizeTafsirV2Ayah({
      key: '1:1',
      t: 'اللہ کےنام سے جو رحمان و رحیم ہے<sup foot_note="182954">1</sup>',
      f: { '182954': 'اسلام جو تہذیب انسان کو سکھاتاہے' },
    }, 1, 1);

    expect(ayah.surah).toBe(1);
    expect(ayah.ayah).toBe(1);
    expect(ayah.translationHtml).toContain('foot_note="182954"');
    expect(ayah.footnotes?.['182954']).toContain('تہذیب');
  });

  it('normalizes Maududi Short keyed surah maps', () => {
    const surah = normalizeTafsirV2Surah({
      surah_number: 1,
      ayahs: {
        '1:1': { t: 'ایک<sup foot_note="1">1</sup>', f: { '1': 'نوٹ' } },
        '1:2': { t: 'دو' },
      },
    }, 1);

    expect(surah.surah_number).toBe(1);
    expect(surah.ayahs.map((ayah) => ayah.ayah)).toEqual([1, 2]);
    expect(surah.ayahs[0].translationHtml).toContain('foot_note="1"');
    expect(surah.ayahs[0].footnotes?.['1']).toBe('نوٹ');
  });

  it('normalizes Maududi Full ayah metadata', () => {
    const ayah = normalizeTafsirV2Ayah({
      key: '1:1',
      surah: 1,
      ayah: 1,
      text: 'The complete detailed text of the Maududi Tafsir goes here...',
      footnotes: { '1': 'Detailed explanation of a specific word.' },
      volume: 1,
      source_pages: [12, 13],
      edition: 'tafheem-ul-quran-full',
    }, 1, 1);

    expect(ayah.text).toContain('complete detailed text');
    expect(ayah.footnotes?.['1']).toContain('Detailed explanation');
    expect(ayah.volume).toBe(1);
    expect(ayah.source_pages).toEqual([12, 13]);
  });

  it('throws when Full Maududi is not configured', () => {
    expect(() => normalizeTafsirV2Ayah({
      error: 'Full Maududi dataset is not configured or unavailable',
    }, 1, 1)).toThrow('Full Maududi dataset is not configured or unavailable');
  });

  it('normalizes empty-ayah lists and introductions', () => {
    expect(normalizeTafsirV2EmptyAyahs([])).toEqual([]);
    expect(normalizeTafsirV2EmptyAyahs([3, { ayah: 5 }, '7'])).toEqual([3, 5, 7]);
    expect(normalizeTafsirV2Introduction({ text: 'دیباچہ' })).toBe('دیباچہ');
  });

  it('keeps only Maududi v2 edition slugs and drops Bayan', () => {
    const editions = normalizeTafsirV2Editions([
      { slug: BAYAN_EDITION_SLUG, name: 'Tafsir Bayan ul Quran', author_name: 'Dr. Israr Ahmad', language_name: 'urdu' },
      { slug: MAUDUDI_SHORT_SLUG, name: 'Tafhim-ul-Quran (Short)', author_name: 'Syed Abul Ala Maududi', language_name: 'urdu' },
      { slug: 'en-tafisr-ibn-kathir', name: 'Ibn Kathir', author_name: 'Ibn Kathir', language_name: 'english' },
    ]);

    expect(editions.map((edition) => edition.slug)).toEqual([MAUDUDI_SHORT_SLUG]);
  });
});
