import {
  decodeReadingEntities,
  getEnglishFontClass,
  getTafsirReadingClass,
  getUrduFontClass,
  normalizeReadingText,
  resolveEnglishReadingFont,
  resolveUrduReadingFont,
} from './quranReadingFonts';

describe('quran reading fonts', () => {
  it('falls back to the default Urdu and English fonts', () => {
    expect(resolveUrduReadingFont('lateef')).toBe('lateef');
    expect(resolveUrduReadingFont('missing')).toBe('jameel-noori');
    expect(resolveEnglishReadingFont('lora')).toBe('lora');
    expect(resolveEnglishReadingFont('missing')).toBe('noto-serif');
    expect(getUrduFontClass('noto-nastaliq')).toBe('font-urdu-noto-nastaliq');
    expect(getEnglishFontClass('merriweather')).toBe('font-en-merriweather');
  });

  it('decodes honorific entities and keeps readable tafsir text', () => {
    expect(decodeReadingEntities('The Prophet &#xFDFA; said')).toBe('The Prophet ﷺ said');
    expect(normalizeReadingText('Allah &nbsp;&#xFDFB;')).toBe('Allah  ﷻ');
    expect(getTafsirReadingClass('urdu', { urduFont: 'alvi-nastaleeq' })).toContain('font-urdu-alvi-nastaleeq');
    expect(getTafsirReadingClass('english', { englishFont: 'source-serif' })).toContain('font-en-source-serif');
  });
});
