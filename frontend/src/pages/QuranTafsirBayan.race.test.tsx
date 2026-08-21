import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useQuran } from '../contexts/QuranContext';
import { fetchJsonWithRecovery } from '../utils/fetchWithRecovery';
import { fetchIndopakV3Ayah, fetchIndopakV3Surah } from '../utils/indopakV3Quran';
import { fetchTafsirAyah } from '../utils/tafsirBayanApi';
import QuranTafsirBayan from './QuranTafsirBayan';
import {
  DEFAULT_QURAN_SETTINGS,
  DEFAULT_TAFSIR_TRANSLATION_PREFERENCES,
  type QuranSettings,
  type TafsirEdition,
} from '../types/quran';

jest.mock('../contexts/QuranContext', () => ({ useQuran: jest.fn() }));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: false, loading: false, user: null }),
}));

jest.mock('../components/PageSEO', () => () => null);

jest.mock('../firebase', () => ({ getPushDeviceId: () => 'test-device' }));

jest.mock('../utils/fetchWithRecovery', () => ({
  fetchJsonWithRecovery: jest.fn(),
  isRateLimitError: () => false,
}));

jest.mock('../utils/indopakV3Quran', () => ({
  fetchIndopakV3Ayah: jest.fn(),
  fetchIndopakV3Surah: jest.fn(),
}));

jest.mock('../utils/tafsirBayanApi', () => ({
  getTafsirRuntimeIssue: () => null,
  fetchTafsirAyah: jest.fn(),
  fetchTafsirSurah: jest.fn(),
  fetchUnifiedAyah: jest.fn(),
  fetchUnifiedSurah: jest.fn(),
  searchTafsir: jest.fn(),
  fetchRandomTafsir: jest.fn(),
}));

const BAYAN: TafsirEdition = 'bayan-ul-quran-dr-israr-ahmed';
const MAUDUDI: TafsirEdition = 'tafheem-ul-quran-syed-abu-ala-maududi';
const BAYAN_BODY = 'bayan tafsir body';
const MAUDUDI_BODY = 'maududi tafsir body';

const settingsFor = (edition: TafsirEdition): QuranSettings => ({
  ...DEFAULT_QURAN_SETTINGS,
  tafsirEdition: edition,
  // Keep the active translation aligned with the edition, otherwise the reader waits
  // for the alignment effect instead of fetching.
  selectedTranslations: [DEFAULT_TAFSIR_TRANSLATION_PREFERENCES[edition]],
});

const quranValue = (settings: QuranSettings, settingsReady: boolean) => ({
  settings,
  settingsReady,
  updateSettings: jest.fn(),
  surahs: [{ number: 1, name: 'الفاتحة', englishName: 'Al-Faatiha', numberOfAyahs: 7 }],
  bookmarks: [],
  addBookmark: jest.fn(),
  removeBookmark: jest.fn(),
  currentSurah: null,
  translations: [],
});

type QuranValue = ReturnType<typeof quranValue>;

/** Renders the page and lets the test swap the context value between renders. */
const renderReader = (initial: QuranValue) => {
  (useQuran as jest.Mock).mockReturnValue(initial);
  let applyContext = (_next: QuranValue) => {};

  const Harness: React.FC = () => {
    const [, forceRender] = React.useState(0);
    applyContext = (next) => {
      (useQuran as jest.Mock).mockReturnValue(next);
      forceRender((count) => count + 1);
    };
    return <QuranTafsirBayan />;
  };

  render(<Harness />);
  return { swapContext: (next: QuranValue) => applyContext(next) };
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolveFn) => {
    resolve = resolveFn;
  });
  return { promise, resolve };
};

const tafsirAyah = (text: string) => ({ text, ayah: 1, surah: 1, footnotes: {} });

describe('QuranTafsirBayan edition consistency', () => {
  const originalInitialLoadingMs = process.env.REACT_APP_TAFSIR_INITIAL_LOADING_MS;

  beforeAll(() => {
    // Skip the intro splash so the reader body is in the DOM.
    process.env.REACT_APP_TAFSIR_INITIAL_LOADING_MS = '0';
  });

  afterAll(() => {
    process.env.REACT_APP_TAFSIR_INITIAL_LOADING_MS = originalInitialLoadingMs;
  });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Create React App runs Jest with resetMocks, so implementations declared in the
    // module factories above are gone by the time a test starts.
    (fetchJsonWithRecovery as jest.Mock).mockResolvedValue({
      status: 'success',
      data: [{ ayahs: [{ numberInSurah: 1, text: 'translation text' }] }],
    });
    (fetchIndopakV3Ayah as jest.Mock).mockResolvedValue({
      surah: 1,
      ayah: 1,
      text: 'arabic text',
      words: [],
    });
    (fetchIndopakV3Surah as jest.Mock).mockResolvedValue({
      surah_number: 1,
      ayahs: [{ surah: 1, ayah: 1, text: 'arabic text', words: [] }],
    });
  });

  it('does not request tafsir before the stored settings have hydrated', async () => {
    (fetchTafsirAyah as jest.Mock).mockResolvedValue(tafsirAyah(BAYAN_BODY));

    renderReader(quranValue(settingsFor(BAYAN), false));

    await waitFor(() => expect(screen.getByText('Loading Tafsir...')).toBeInTheDocument());
    expect(fetchTafsirAyah).not.toHaveBeenCalled();
  });

  it('keeps the selected edition when a superseded request resolves last', async () => {
    const bayanRequest = deferred<ReturnType<typeof tafsirAyah>>();
    const maududiRequest = deferred<ReturnType<typeof tafsirAyah>>();

    (fetchTafsirAyah as jest.Mock).mockImplementation((_surah, _ayah, edition) =>
      edition === MAUDUDI ? maududiRequest.promise : bayanRequest.promise
    );

    const { swapContext } = renderReader(quranValue(settingsFor(BAYAN), true));
    await waitFor(() => expect(fetchTafsirAyah).toHaveBeenCalledWith(1, 1, BAYAN));

    act(() => {
      swapContext(quranValue(settingsFor(MAUDUDI), true));
    });
    await waitFor(() => expect(fetchTafsirAyah).toHaveBeenCalledWith(1, 1, MAUDUDI));

    await act(async () => {
      maududiRequest.resolve(tafsirAyah(MAUDUDI_BODY));
    });
    expect(await screen.findByText(MAUDUDI_BODY)).toBeInTheDocument();

    // The Bayan request was started first but answers last, which is what used to
    // overwrite the reader with the wrong edition on a cold backend.
    await act(async () => {
      bayanRequest.resolve(tafsirAyah(BAYAN_BODY));
    });

    expect(screen.getByText(MAUDUDI_BODY)).toBeInTheDocument();
    expect(screen.queryByText(BAYAN_BODY)).not.toBeInTheDocument();
  });
});
