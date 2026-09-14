import { fetchJsonWithRecovery } from './fetchWithRecovery';
import { fetchTafsirAyah, fetchTafsirSurah } from './tafsirBayanApi';
import {
  BAYAN_EDITION_SLUG,
  IBN_KATHIR_ENGLISH_SLUG,
  MAUDUDI_FULL_SLUG,
  MAUDUDI_SHORT_SLUG,
} from './tafsirEditions';

jest.mock('./fetchWithRecovery', () => ({
  fetchJsonWithRecovery: jest.fn(),
}));

const mockedFetch = fetchJsonWithRecovery as jest.MockedFunction<typeof fetchJsonWithRecovery>;

describe('tafsir edition routing', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('keeps Bayan on v1 and sends only Maududi Short/Full through tafsir-v2', async () => {
    mockedFetch.mockImplementation(async (url: string) => {
      if (url.includes('/maududi-full/')) {
        return {
          key: '3:1',
          text: 'full tafsir',
          footnotes: { '1': 'note' },
          volume: 1,
          source_pages: [4],
          surah: 3,
          ayah: 1,
        };
      }
      if (url.includes('/maududi/')) {
        return { key: '2:1', t: 'short <sup foot_note="9">1</sup>', f: { '9': 'footnote' } };
      }
      if (url.includes('/quran/tafsir/editions/')) {
        return { text: 'bayan v1 body', ayah: 1, surah: 4 };
      }
      throw new Error(`unexpected url ${url}`);
    });

    const bayan = await fetchTafsirAyah(4, 1, BAYAN_EDITION_SLUG);
    const short = await fetchTafsirAyah(2, 1, MAUDUDI_SHORT_SLUG);
    const full = await fetchTafsirAyah(3, 1, MAUDUDI_FULL_SLUG);

    expect(bayan.text).toBe('bayan v1 body');
    expect(short.translationHtml).toContain('foot_note="9"');
    expect(full.volume).toBe(1);
    expect(mockedFetch.mock.calls.map(([url]) => String(url))).toEqual(expect.arrayContaining([
      expect.stringMatching(/\/quran\/tafsir\/editions\/ur-tafsir-bayan-ul-quran\/4\/1$/),
      expect.stringMatching(/\/quran\/tafsir-v2\/maududi\/surah\/2\/ayah\/1$/),
      expect.stringMatching(/\/quran\/tafsir-v2\/maududi-full\/surah\/3\/ayah\/1$/),
    ]));
    expect(mockedFetch.mock.calls.some(([url]) => String(url).includes('/quran/tafsir-v2/surah/'))).toBe(false);
  });

  it('keeps Ibn Kathir on the v1 editions proxy', async () => {
    mockedFetch.mockResolvedValue({
      ayah: 1,
      surah: 18,
      text: 'ibn kathir body',
    });

    const ayah = await fetchTafsirAyah(18, 1, IBN_KATHIR_ENGLISH_SLUG);
    expect(ayah.text).toBe('ibn kathir body');
    expect(String(mockedFetch.mock.calls[0][0])).toMatch(/\/quran\/tafsir\/editions\/en-tafisr-ibn-kathir\/18\/1$/);
    expect(String(mockedFetch.mock.calls[0][0])).not.toContain('tafsir-v2');
  });

  it('loads a Maududi Short surah from v2 without using v1 edition URLs', async () => {
    mockedFetch.mockResolvedValue({
      surah_number: 114,
      ayahs: {
        '114:1': { t: 'first' },
        '114:2': { t: 'second' },
      },
    });

    const surah = await fetchTafsirSurah(114, MAUDUDI_SHORT_SLUG);
    expect(surah.ayahs.map((ayah) => ayah.ayah)).toEqual([1, 2]);
    expect(mockedFetch.mock.calls.some(([url]) => String(url).includes('/quran/tafsir/editions/'))).toBe(false);
    expect(mockedFetch.mock.calls.some(([url]) => String(url).includes('/quran/tafsir-v2/maududi/surah/114'))).toBe(true);
  });
});
