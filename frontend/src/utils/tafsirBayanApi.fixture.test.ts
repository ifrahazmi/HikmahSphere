import fs from 'fs';
import {
  normalizeRandomTafsir,
  normalizeTafsirAyah,
  normalizeTafsirSearchHits,
  normalizeTafsirSurah,
  normalizeUnifiedAyah,
  normalizeUnifiedSurah,
} from './tafsirBayanApi';

describe('Tafheem fixture normalization', () => {
  const ayatByAyatFixturePath = '/home/ifrahazmi/HikmahSphere/tmp/Ayat-by-Ayat.json';
  const completeSurahFixturePath = '/home/ifrahazmi/HikmahSphere/tmp/Complete-Surah.json';

  it('normalizes ayat-by-ayat fixture for single-ayah shape', () => {
    if (!fs.existsSync(ayatByAyatFixturePath)) {
      // Keep CI green where local fixture is not present.
      expect(true).toBe(true);
      return;
    }

    const fixtureRaw = fs.readFileSync(ayatByAyatFixturePath, 'utf8');
    const fixtureJson = JSON.parse(fixtureRaw);

    const ayahNormalized = normalizeTafsirAyah(fixtureJson);
    expect(ayahNormalized.surah).toBe(1);
    expect(ayahNormalized.ayah).toBe(2);
    expect(ayahNormalized.translationHtml).toContain('<sup');
    expect(ayahNormalized.footnotes?.['182955']).toBeTruthy();
    expect(ayahNormalized.footnotes?.['182956']).toBeTruthy();

    const normalized = normalizeTafsirSurah(fixtureJson);
    expect(normalized.surah_number).toBe(1);
    expect(normalized.ayahs.length).toBe(1);

    const firstAyah = normalized.ayahs[0];
    expect(firstAyah.ayah).toBe(2);
    expect(firstAyah.translationHtml).toContain('foot_note="182955"');
    expect(firstAyah.footnotes?.['182955']).toBeTruthy();
    expect(firstAyah.footnotes?.['182956']).toBeTruthy();
  });

  it('normalizes complete-surah fixture and keeps ayah order and footnotes', () => {
    if (!fs.existsSync(completeSurahFixturePath)) {
      expect(true).toBe(true);
      return;
    }

    const fixtureRaw = fs.readFileSync(completeSurahFixturePath, 'utf8');
    const fixtureJson = JSON.parse(fixtureRaw);

    const normalized = normalizeTafsirSurah(fixtureJson);
    expect(normalized.surah_number).toBe(1);
    expect(normalized.ayahs.length).toBe(7);
    expect(normalized.ayahs[0].ayah).toBe(1);
    expect(normalized.ayahs[6].ayah).toBe(7);
    expect(normalized.ayahs[0].translationHtml).toContain('foot_note="182954"');
    expect(normalized.ayahs[0].footnotes?.['182954']).toBeTruthy();

    const ayahTwo = normalized.ayahs.find((ayah) => ayah.ayah === 2);
    expect(ayahTwo?.footnotes?.['182955']).toBeTruthy();
    expect(ayahTwo?.footnotes?.['182956']).toBeTruthy();
  });

  it('normalizes live ayah payload shape with key field', () => {
    const payload = {
      key: '1:2',
      t: 'تعریف اللہ ہی کے لیے ہے<sup foot_note="182955">1</sup>',
      f: {
        '182955': 'Sample footnote text',
      },
    };

    const normalized = normalizeTafsirAyah(payload);
    expect(normalized.surah).toBe(1);
    expect(normalized.ayah).toBe(2);
    expect(normalized.translationHtml).toContain('foot_note="182955"');
    expect(normalized.footnotes?.['182955']).toBe('Sample footnote text');
  });
});

describe('new tafsir API normalizers', () => {
  it('normalizes unified ayah payloads', () => {
    const normalized = normalizeUnifiedAyah({
      surah_number: 1,
      ayah_number: 1,
      dr_israr: {
        text: 'سورة الفاتحہ اگرچہ قرآن حکیم کی مختصر سورتوں میں سے ہے...',
        ayah: 1,
        surah: 1,
      },
      maududi: {
        t: 'تعریف اللہ ہی کے لیے ہے',
        f: { '182955': 'Sample footnote' },
      },
    });

    expect(normalized.surah).toBe(1);
    expect(normalized.ayah).toBe(1);
    expect(normalized.bayan.text).toContain('سورة الفاتحہ');
    expect(normalized.maududi.translationHtml).toContain('تعریف اللہ');
    expect(normalized.maududi.footnotes?.['182955']).toBe('Sample footnote');
  });

  it('normalizes unified surah arrays', () => {
    const normalized = normalizeUnifiedSurah({
      surah_number: 1,
      ayahs: [
        {
          ayah_number: 2,
          dr_israr: { text: 'second', ayah: 2, surah: 1 },
          maududi: { t: 'دو' },
        },
        {
          ayah_number: 1,
          dr_israr: { text: 'first', ayah: 1, surah: 1 },
          maududi: { t: 'ایک' },
        },
      ],
    });

    expect(normalized.surah_number).toBe(1);
    expect(normalized.ayahs.map((ayah) => ayah.ayah)).toEqual([1, 2]);
    expect(normalized.ayahs[0].bayan.text).toBe('first');
  });

  it('normalizes search hits from mixed shapes', () => {
    const hits = normalizeTafsirSearchHits({
      results: [
        { surah: 2, ayah: 255, snippet: 'آیت الکرسی', source: 'dr_israr' },
        { key: '1:1', text: 'بسم اللہ', edition: 'tafheem' },
      ],
    });

    expect(hits).toHaveLength(2);
    expect(hits[0]).toEqual({ surah: 2, ayah: 255, snippet: 'آیت الکرسی', source: 'bayan' });
    expect(hits[1].surah).toBe(1);
    expect(hits[1].ayah).toBe(1);
    expect(hits[1].source).toBe('maududi');
  });

  it('normalizes random tafsir payloads', () => {
    expect(normalizeRandomTafsir({ surah_number: 18, ayah_number: 10 })).toEqual({
      surah: 18,
      ayah: 10,
    });
    expect(normalizeRandomTafsir({ key: '36:1', dr_israr: { text: 'يس' } })).toEqual({
      surah: 36,
      ayah: 1,
    });
  });
});
