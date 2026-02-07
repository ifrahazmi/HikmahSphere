// Quran Data Types and Interfaces

export interface Surah {
  number: number;
  name: string;              // Arabic name
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: 'Meccan' | 'Medinan';
}

export interface Ayah {
  number: number;            // Global ayah number (1-6236)
  numberInSurah: number;
  text: string;              // Arabic text
  surah: {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    numberOfAyahs: number;
    revelationType: string;
  };
  edition: {
    identifier: string;
    language: string;
    name: string;
    englishName: string;
    format: string;
    type: string;
  };
  audio?: string;
  audioSecondary?: string[];
  juz?: number;
  manzil?: number;
  page?: number;
  hizbQuarter?: number;
  sajda?: boolean | {
    id: number;
    recommended: boolean;
    obligatory: boolean;
  };
}

export interface SurahData {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  numberOfAyahs: number;
  ayahs: Ayah[];
  edition: Edition;
}

export interface Edition {
  identifier: string;        // e.g., 'en.sahih', 'ar.alafasy'
  language: string;
  name: string;
  englishName: string;
  format: 'text' | 'audio';
  type: 'translation' | 'transliteration' | 'tafsir' | 'quran';
  direction?: 'ltr' | 'rtl';
}

export interface SearchResult {
  count: number;
  text: string;
  edition: Edition;
  surah: {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    numberOfAyahs: number;
    revelationType: string;
  };
  numberInSurah: number;
  juz: number;
  page: number;
}

export interface QuranSettings {
  selectedTranslations: string[];  // Edition identifiers (up to 3)
  showTransliteration: boolean;
  arabicOnlyMode: boolean;         // Show only Arabic text
  fontSize: number;                // 14-32px
  theme: 'light' | 'dark';
  arabicFont: 'amiri' | 'scheherazade' | 'traditional';
  lineSpacing: number;             // 1.5-3.0
  wordHighlight: boolean;
  showTafsir: boolean;
  autoScroll: boolean;
  reciter: string;                 // Reciter identifier
  autoPlayNext: boolean;
}

export interface Bookmark {
  id: string;
  surahNumber: number;
  ayahNumber: number;
  surahName: string;
  timestamp: Date;
  note?: string;
}

export interface LastRead {
  surahNumber: number;
  ayahNumber: number;
  surahName: string;
  timestamp: Date;
  scrollPosition?: number;
}

export interface QuranContextType {
  // Current state
  currentSurah: number | null;
  currentAyah: number | null;
  surahs: Surah[];
  surahData: SurahData | null;
  translations: SurahData[];
  transliteration: SurahData | null;
  
  // Loading states
  loading: boolean;
  error: string | null;
  
  // Settings
  settings: QuranSettings;
  updateSettings: (settings: Partial<QuranSettings>) => void;
  
  // Reading history  
  bookmarks: Bookmark[];
  lastRead: LastRead | null;
  addBookmark: (surah: number, ayah: number, note?: string) => void;
  removeBookmark: (id: string) => void;
  updateLastRead: (surah: number, ayah: number) => void;
  
  // Navigation
  goToSurah: (surahNumber: number) => void;
  goToAyah: (surahNumber: number, ayahNumber: number) => void;
  nextSurah: () => void;
  previousSurah: () => void;
  
  // Search
  searchResults: SearchResult[];
  search: (query: string) => Promise<void>;
  
  // Audio
  isPlaying: boolean;
  currentPlayingAyah: number | null;
  playAyah: (ayahNumber: number) => void;
  pauseAyah: () => void;
  stopAyah: () => void;
}

// Default translations configuration
export const DEFAULT_TRANSLATIONS = [
  { identifier: 'en.sahih', name: 'Sahih International', language: 'English' },
  { identifier: 'en.pickthall', name: 'Pickthall', language: 'English' },
  { identifier: 'en.yusufali', name: 'Yusuf Ali', language: 'English' },
  { identifier: 'ar.alafasy', name: 'Arabic (Alafasy)', language: 'Arabic' },
  { identifier: 'ur.jalandhry', name: 'Fateh Muhammad Jalandhry', language: 'Urdu' },
  { identifier: 'hi.farooq', name: 'Muhammad Farooq Khan & Ahmed', language: 'Hindi' },
  { identifier: 'fr.hamidullah', name: 'Muhammad Hamidullah', language: 'French' },
  { identifier: 'es.cortes', name: 'Julio Cortes', language: 'Spanish' },
  { identifier: 'id.indonesian', name: 'Bahasa Indonesia', language: 'Indonesian' },
  { identifier: 'tr.diyanet', name: 'Diyanet İşleri', language: 'Turkish' },
];

// Default settings
export const DEFAULT_QURAN_SETTINGS: QuranSettings = {
  selectedTranslations: ['en.sahih'],
  showTransliteration: false,
  arabicOnlyMode: false,
  fontSize: 20,
  theme: 'light',
  arabicFont: 'amiri',
  lineSpacing: 2.0,
  wordHighlight: true,
  showTafsir: false,
  autoScroll: false,
  reciter: 'ar.alafasy',
  autoPlayNext: false,
};
