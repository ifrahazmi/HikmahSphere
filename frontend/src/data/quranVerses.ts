// Quran Verses Data

export interface QuranVerse {
  verse: string;
  translation: string;
  chapter: string;
  reference: string;
}

const quranVerses: QuranVerse[] = [
  {
    verse: "إِنَّ مَعَ الْعُسْرِ يُسْرًا",
    translation: "Indeed, with hardship comes ease.",
    chapter: "Surah Ash-Sharh (The Relief)",
    reference: "94:6"
  },
  {
    verse: "وَاذْكُر رَّبَّكَ إِذَا نَسِيتَ",
    translation: "And remember your Lord when you forget.",
    chapter: "Surah Al-Kahf (The Cave)",
    reference: "18:24"
  },
  {
    verse: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا",
    translation: "For indeed, with hardship comes ease.",
    chapter: "Surah Ash-Sharh (The Relief)",
    reference: "94:5"
  },
  {
    verse: "وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ",
    translation: "And do not despair of the mercy of Allah.",
    chapter: "Surah Yusuf (Joseph)",
    reference: "12:87"
  },
  {
    verse: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ",
    translation: "Indeed, Allah is with the patient.",
    chapter: "Surah Al-Baqarah (The Cow)",
    reference: "2:153"
  },
  {
    verse: "فَاذْكُرُونِي أَذْكُرْكُمْ",
    translation: "So remember Me; I will remember you.",
    chapter: "Surah Al-Baqarah (The Cow)",
    reference: "2:152"
  },
  {
    verse: "وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ",
    translation: "And He is with you wherever you are.",
    chapter: "Surah Al-Hadid (The Iron)",
    reference: "57:4"
  },
  {
    verse: "رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا",
    translation: "Our Lord, do not let our hearts deviate after You have guided us.",
    chapter: "Surah Ali 'Imran (The Family of Imran)",
    reference: "3:8"
  },
  {
    verse: "وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا",
    translation: "And whoever fears Allah - He will make for him a way out.",
    chapter: "Surah At-Talaq (The Divorce)",
    reference: "65:2"
  },
  {
    verse: "إِنَّ اللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّىٰ يُغَيِّرُوا مَا بِأَنفُسِهِمْ",
    translation: "Indeed, Allah will not change the condition of a people until they change what is in themselves.",
    chapter: "Surah Ar-Ra'd (The Thunder)",
    reference: "13:11"
  }
];

export function getRandomVerse(): QuranVerse {
  const randomIndex = Math.floor(Math.random() * quranVerses.length);
  return quranVerses[randomIndex];
}

export default quranVerses;
