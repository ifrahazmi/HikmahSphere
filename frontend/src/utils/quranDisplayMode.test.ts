import { getArabicDisplayModePatch } from './quranDisplayMode';

describe('quran display mode toggle', () => {
  it('does not replace the selected translation when leaving Arabic-only mode', () => {
    expect(getArabicDisplayModePatch(false)).toEqual({ arabicOnlyMode: false });
    expect(getArabicDisplayModePatch(false)).not.toHaveProperty('selectedTranslations');
  });

  it('does not clear the selected translation when entering Arabic-only mode', () => {
    expect(getArabicDisplayModePatch(true)).toEqual({ arabicOnlyMode: true });
    expect(getArabicDisplayModePatch(true)).not.toHaveProperty('selectedTranslations');
  });

  it('keeps the current edition after toggling Arabic-only on and off', () => {
    const settings = {
      arabicOnlyMode: false,
      selectedTranslations: ['ur.maududi'],
    };

    const arabicOnly = { ...settings, ...getArabicDisplayModePatch(true) };
    const backToTranslation = { ...arabicOnly, ...getArabicDisplayModePatch(false) };

    expect(arabicOnly.selectedTranslations).toEqual(['ur.maududi']);
    expect(backToTranslation.selectedTranslations).toEqual(['ur.maududi']);
    expect(backToTranslation.arabicOnlyMode).toBe(false);
  });
});
