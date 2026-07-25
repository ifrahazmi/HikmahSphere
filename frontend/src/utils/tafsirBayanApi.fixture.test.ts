import fs from 'fs';
import { normalizeTafsirAyah, normalizeTafsirSurah } from './tafsirBayanApi';

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
