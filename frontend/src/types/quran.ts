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
  fontSize: number;                // 14-38px
  theme: 'light' | 'dark';
  arabicFont: 'al-mushaf' | 'indopak-nastaleeq' | 'indopak-nastaleeq-v2' | 'amiri' | 'scheherazade' | 'noto-naskh' | 'cairo' | 'lateef' | 'reem-kufi';
  fontColor: 'default' | 'emerald' | 'blue' | 'amber' | 'rose';
  readerBackground: 'default' | 'white' | 'cream' | 'blue' | 'green';
  lineSpacing: number;             // 1.5-3.0
  wordHighlight: boolean;
  showTafsir: boolean;
  autoScroll: boolean;
  reciter: string;                 // Reciter identifier
  autoPlayNext: boolean;
  audioEnabled: boolean;           // Enable audio playback feature
  audioMode: 'ayah' | 'surah';     // 'ayah' for ayat-by-ayat, 'surah' for complete surah
}

export const BOOKMARK_COLORS = [
  'emerald',
  'red',
  'teal',
  'indigo',
  'blue',
  'purple',
  'amber',
  'rose',
] as const;

export type BookmarkColor = (typeof BOOKMARK_COLORS)[number];

export const BOOKMARK_COLOR_OPTIONS = [
  'red',
  'teal',
  'indigo',
  'blue',
  'purple',
  'amber',
  'rose',
] as const satisfies readonly BookmarkColor[];

export interface Bookmark {
  id: string;
  surahNumber: number;
  ayahNumber: number;
  surahName: string;
  timestamp: Date;
  note?: string;
  color?: BookmarkColor;
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
  addBookmark: (surah: number, ayah: number, note?: string, color?: BookmarkColor) => void;
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
  isPaused: boolean;           // Audio is paused (not stopped)
  isAudioLoading: boolean;       // Audio buffering state
  currentPlayingAyah: number | null;
  currentPlayingSurah: number | null;
  audioProgress: number;           // 0-100 percentage
  audioDuration: number;           // Duration in seconds (total for surah mode)
  audioCurrentTime: number;        // Current time in seconds (cumulative for surah mode)
  currentQueueIndex: number;       // Current ayah index in surah play queue
  totalSurahDuration: number;      // Total estimated duration for complete surah
  cumulativeTime: number;          // Cumulative time from previous ayahs
  playAyah: (surahNumber: number, ayahNumber: number, isContinuing?: boolean) => void;
  pauseAyah: () => void;
  resumeAyah: () => void;
  stopAyah: () => void;
  playSurah: (surahNumber: number) => void;
  togglePlayPause: () => void;
  seekAudio: (time: number) => void;
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

// Available Reciters for Audio Playback
export const AVAILABLE_RECITERS = [
  { identifier: 'ar.alafasy', name: 'Mishary Rashid Alafasy' },
  { identifier: 'ar.abdulbasitmurattal', name: 'Abdul Basit (Murattal)' },
  { identifier: 'ar.abdulsamad', name: 'Abdul Samad' },
  { identifier: 'ar.shaatree', name: 'Abu Bakr al-Shatri' },
  { identifier: 'ar.husary', name: 'Mahmoud Khalil Al-Husary' },
  { identifier: 'ar.minshawi', name: 'Mohamed Siddiq al-Minshawi' },
  { identifier: 'ar.muhammadayyoub', name: 'Muhammad Ayyoub' },
  { identifier: 'ar.muhammadjibreel', name: 'Muhammad Jibreel' },
  { identifier: 'ar.saoodshuraym', name: 'Saood bin Ibraaheem Shuraym' },
  { identifier: 'ar.abdullahbasfar', name: 'Abdullah Basfar' },
];

// Default settings
export const DEFAULT_QURAN_SETTINGS: QuranSettings = {
  selectedTranslations: ['en.sahih'],
  showTransliteration: false,
  arabicOnlyMode: false,
  fontSize: 20,
  theme: 'light',
  arabicFont: 'indopak-nastaleeq',
  fontColor: 'default',
  readerBackground: 'default',
  lineSpacing: 2.0,
  wordHighlight: true,
  showTafsir: false,
  autoScroll: false,
  reciter: 'ar.alafasy',
  autoPlayNext: false,
  audioEnabled: false,
  audioMode: 'ayah',
};
