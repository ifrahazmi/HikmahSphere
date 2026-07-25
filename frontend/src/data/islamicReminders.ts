// Islamic Reminders Data and Utilities

export interface IslamicReminder {
  id: string;
  prayerWindow: 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'midnight' | 'lastthird';
  title: string;
  subtitle?: string;
  arabicText?: string;
  arabic?: string;
  transliteration?: string;
  translation: string;
  reference?: string;
  source?: string;
  category: 'dua' | 'hadith' | 'quran' | 'reminder' | 'sunnah';
  priority: number;
}

const islamicReminders: IslamicReminder[] = [
  // Fajr Reminders
  {
    id: 'fajr-1',
    prayerWindow: 'fajr',
    title: 'Dua upon waking',
    arabicText: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
    transliteration: 'Alhamdu lillahil-ladhi ahyana ba\'da ma amatana wa ilayhin-nushur',
    translation: 'All praise is for Allah who gave us life after having taken it from us and unto Him is the resurrection.',
    reference: 'Bukhari',
    category: 'dua',
    priority: 1
  },
  {
    id: 'fajr-2',
    prayerWindow: 'fajr',
    title: 'Virtue of Fajr Prayer',
    translation: 'The Prophet (ﷺ) said: "Whoever prays Fajr is under the protection of Allah."',
    reference: 'Muslim',
    category: 'hadith',
    priority: 2
  },
  // Sunrise Reminders
  {
    id: 'sunrise-1',
    prayerWindow: 'sunrise',
    title: 'Morning Dhikr',
    arabicText: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ',
    transliteration: 'Asbahna wa asbahal-mulku lillah',
    translation: 'We have entered morning and the kingdom belongs to Allah.',
    reference: 'Muslim',
    category: 'dua',
    priority: 1
  },
  // Dhuhr Reminders
  {
    id: 'dhuhr-1',
    prayerWindow: 'dhuhr',
    title: 'Sunnah before Dhuhr',
    translation: 'The Prophet (ﷺ) said: "Whoever prays twelve rak\'ahs in the day and night, Allah will build a house for him in Paradise."',
    reference: 'Muslim',
    category: 'hadith',
    priority: 1
  },
  // Asr Reminders
  {
    id: 'asr-1',
    prayerWindow: 'asr',
    title: 'Importance of Asr',
    translation: 'The Prophet (ﷺ) said: "Whoever misses the Asr prayer, it is as if he has lost his family and wealth."',
    reference: 'Bukhari',
    category: 'hadith',
    priority: 1
  },
  // Maghrib Reminders
  {
    id: 'maghrib-1',
    prayerWindow: 'maghrib',
    title: 'Breaking the Fast (if fasting)',
    arabicText: 'ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الأَجْرُ إِنْ شَاءَ اللَّهُ',
    transliteration: 'Dhahaba adh-dhama\'u wabtallatil-\'uruqu wa thabatal-ajru in sha Allah',
    translation: 'The thirst is gone, the veins are moistened, and the reward is confirmed, if Allah wills.',
    reference: 'Abu Dawud',
    category: 'dua',
    priority: 1
  },
  // Isha Reminders
  {
    id: 'isha-1',
    prayerWindow: 'isha',
    title: 'Before Sleep',
    arabicText: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
    transliteration: 'Bismika Allahumma amutu wa ahya',
    translation: 'In Your name, O Allah, I die and I live.',
    reference: 'Bukhari',
    category: 'dua',
    priority: 1
  },
  // Last Third of Night
  {
    id: 'lastthird-1',
    prayerWindow: 'lastthird',
    title: 'Tahajjud Prayer',
    translation: 'The Prophet (ﷺ) said: "Our Lord descends to the lowest heaven during the last third of the night, asking: \'Who will call upon Me so that I may respond to him? Who will ask Me so that I may give him? Who will seek My forgiveness so that I may forgive him?\'"',
    reference: 'Bukhari, Muslim',
    category: 'hadith',
    priority: 1
  }
];

export function getCurrentPrayerWindow(
  prayerTimes: any,
  currentTime: Date = new Date()
): 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'midnight' | 'lastthird' | null {
  if (!prayerTimes || !prayerTimes.timings) {
    return null;
  }

  const timings = prayerTimes.timings;
  const now = currentTime.getHours() * 60 + currentTime.getMinutes();

  const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const fajrTime = parseTime(timings.Fajr);
  const sunriseTime = parseTime(timings.Sunrise);
  const dhuhrTime = parseTime(timings.Dhuhr);
  const asrTime = parseTime(timings.Asr);
  const maghribTime = parseTime(timings.Maghrib);
  const ishaTime = parseTime(timings.Isha);
  const midnightTime = parseTime(timings.Midnight || '00:00');
  const lastThirdTime = parseTime(timings.Lastthird || '03:00');

  if (now >= fajrTime && now < sunriseTime) return 'fajr';
  if (now >= sunriseTime && now < dhuhrTime) return 'sunrise';
  if (now >= dhuhrTime && now < asrTime) return 'dhuhr';
  if (now >= asrTime && now < maghribTime) return 'asr';
  if (now >= maghribTime && now < ishaTime) return 'maghrib';
  if (now >= ishaTime && now < midnightTime) return 'isha';
  if (now >= midnightTime && now < lastThirdTime) return 'midnight';
  if (now >= lastThirdTime && now < fajrTime) return 'lastthird';

  return null;
}

export function selectReminder(
  prayerWindow: 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'midnight' | 'lastthird' | null,
  islamicEvents?: any,
  dayOfWeek?: number,
  seed?: number
): IslamicReminder | null {
  if (!prayerWindow) {
    return null;
  }

  const relevantReminders = islamicReminders.filter(r => r.prayerWindow === prayerWindow);

  if (relevantReminders.length === 0) {
    return null;
  }

  // Sort by priority and select based on seed if provided, otherwise random
  relevantReminders.sort((a, b) => a.priority - b.priority);
  const topPriority = relevantReminders[0].priority;
  const topReminders = relevantReminders.filter(r => r.priority === topPriority);

  if (seed !== undefined) {
    return topReminders[seed % topReminders.length];
  }

  return topReminders[Math.floor(Math.random() * topReminders.length)];
}

export default islamicReminders;
