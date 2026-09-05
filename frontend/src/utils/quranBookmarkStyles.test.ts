import {
  getBookmarkBackgroundClass,
  getBookmarkBlockStyle,
  getBookmarkListClass,
  getBookmarkSwatchSelectedClass,
} from './quranBookmarkStyles';

describe('quran bookmark styles', () => {
  it('uses a stronger dark-mode highlight instead of a light pastel wash', () => {
    expect(getBookmarkBackgroundClass('red', 'light')).toContain('bg-red-300');
    expect(getBookmarkBackgroundClass('red', 'dark')).toContain('bg-red-400');
    expect(getBookmarkBackgroundClass('red', 'dark')).toContain('ring-red-300');
    expect(getBookmarkBackgroundClass('red', 'dark')).not.toContain('bg-red-300');
  });

  it('does not rely on Tailwind dark: variants for the settings list', () => {
    expect(getBookmarkListClass('amber', 'dark')).toContain('bg-amber-900');
    expect(getBookmarkListClass('amber', 'dark')).not.toMatch(/dark:/);
    expect(getBookmarkListClass('amber', 'light')).toContain('bg-amber-50');
  });

  it('makes the selected color swatch visible on a dark modal', () => {
    expect(getBookmarkSwatchSelectedClass('dark')).toContain('border-white');
    expect(getBookmarkSwatchSelectedClass('light')).toContain('border-gray-900');
  });

  it('keeps tafsir bookmark cards readable in dark mode', () => {
    const style = getBookmarkBlockStyle('purple', 'dark', 0.12, 0.22);

    expect(style?.backgroundColor).toMatch(/rgba\(196, 181, 253, 0\.4/);
    expect(style?.borderColor).toMatch(/rgba\(196, 181, 253, 0\.9/);
    expect(style?.boxShadow).toContain('196, 181, 253');
  });
});
