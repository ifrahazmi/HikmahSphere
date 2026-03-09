import hisnMuslimEnglish from './hisnMuslimEnglish.json';
import urduTranslations from './urduTranslations.json';

export type DuaCategoryId =
  | 'morning-evening'
  | 'daily-life'
  | 'salah'
  | 'ramadan'
  | 'hajj-umrah'
  | 'situational'
  | 'family';

export type SituationFilterId =
  | 'anxiety'
  | 'debt'
  | 'health'
  | 'protection'
  | 'travel'
  | 'marriage'
  | 'forgiveness'
  | 'before-sleep'
  | 'after-waking'
  | 'bathroom-entry'
  | 'bathroom-exit'
  | 'thunder'
  | 'rain'
  | 'before-study'
  | 'knowledge'
  | 'evil-eye'
  | 'morning'
  | 'evening';

export interface DuaReferenceDetails {
  source: string;
  book: string;
  hadithNumber: string;
  grade: string;
  notes?: string;
}

export interface DuaEntry {
  id: string;
  slug: string;
  categoryId: DuaCategoryId;
  title: string;
  shortDescription: string;
  sectionTitle: string;
  arabic: string;
  rawArabic?: string;
  transliteration: string;
  translation: string;
  translationUrdu: string;
  virtue: string;
  reference: DuaReferenceDetails;
  tags: string[];
  situationTags: SituationFilterId[];
  audioUrl?: string;
}

export interface DuaCategoryMeta {
  id: DuaCategoryId;
  title: string;
  description: string;
  emoji: string;
}

export interface SituationFilterMeta {
  id: SituationFilterId;
  label: string;
  emoji: string;
}

interface RawDuaItem {
  ID: number;
  ARABIC_TEXT: string;
  LANGUAGE_ARABIC_TRANSLATED_TEXT: string;
  TRANSLATED_TEXT: string;
  REPEAT: number;
  AUDIO?: string;
}

interface RawSection {
  ID: number;
  TITLE: string;
  AUDIO_URL?: string;
  TEXT?: RawDuaItem[];
}

const RAW_SECTIONS: RawSection[] = ((hisnMuslimEnglish as any).English || []) as RawSection[];

export const DUA_CATEGORIES: DuaCategoryMeta[] = [
  {
    id: 'morning-evening',
    title: 'Morning & Evening',
    description: 'Daily adhkar around Fajr and Maghrib.',
    emoji: '🕌',
  },
  {
    id: 'daily-life',
    title: 'Daily Life',
    description: 'Duas for food, home, sleep, travel, and routines.',
    emoji: '🍽',
  },
  {
    id: 'salah',
    title: 'Salah',
    description: 'Supplications from wudu to post-prayer.',
    emoji: '🧎',
  },
  {
    id: 'ramadan',
    title: 'Ramadan',
    description: 'Fasting and blessed-night supplications.',
    emoji: '🌙',
  },
  {
    id: 'hajj-umrah',
    title: 'Hajj & Umrah',
    description: 'Pilgrimage adhkar for sacred rituals.',
    emoji: '🕋',
  },
  {
    id: 'situational',
    title: 'Situational',
    description: 'Anxiety, hardship, illness, protection, and guidance.',
    emoji: '💙',
  },
  {
    id: 'family',
    title: 'Family',
    description: 'Parents, children, marriage, and forgiveness.',
    emoji: '👨‍👩‍👧',
  },
];

export const SITUATION_FILTERS: SituationFilterMeta[] = [
  { id: 'anxiety', label: 'Anxiety', emoji: '🫶' },
  { id: 'debt', label: 'Debt', emoji: '💳' },
  { id: 'health', label: 'Health', emoji: '🩺' },
  { id: 'protection', label: 'Protection', emoji: '🛡️' },
  { id: 'travel', label: 'Travel', emoji: '🧳' },
  { id: 'marriage', label: 'Marriage', emoji: '💍' },
  { id: 'forgiveness', label: 'Forgiveness', emoji: '🤲' },
  { id: 'before-sleep', label: 'Before Sleeping', emoji: '😴' },
  { id: 'after-waking', label: 'After Waking Up', emoji: '🌅' },
  { id: 'bathroom-entry', label: 'Before Entering Bathroom', emoji: '🚪' },
  { id: 'bathroom-exit', label: 'After Leaving Bathroom', emoji: '✅' },
  { id: 'thunder', label: 'When Hearing Thunder', emoji: '⚡' },
  { id: 'rain', label: 'When Rain Falls', emoji: '🌧️' },
  { id: 'before-study', label: 'Before Study', emoji: '📘' },
  { id: 'knowledge', label: 'For Knowledge', emoji: '🧠' },
  { id: 'evil-eye', label: 'Protection from Evil Eye', emoji: '👁️' },
];

const QUICK_ACCESS_TOPICS: Record<string, SituationFilterId> = {
  'Morning Adhkar': 'morning',
  'Evening Adhkar': 'evening',
  'Daily Duas': 'morning',
};

export const QUICK_ACCESS_ITEMS = [
  'Morning Adhkar',
  'Evening Adhkar',
  'Daily Duas',
  'Tasbih Counter',
  'Favorites',
] as const;

const CATEGORY_RULES: Array<{ id: DuaCategoryId; patterns: RegExp[] }> = [
  {
    id: 'morning-evening',
    patterns: [
      /morning/i,
      /evening/i,
      /sunrise/i,
      /sunset/i,
    ],
  },
  {
    id: 'salah',
    patterns: [
      /prayer/i,
      /salah/i,
      /athan/i,
      /wudu/i,
      /ablution/i,
      /mosque/i,
      /tashahhud/i,
      /ruki/i,
      /sujood/i,
      /qunut/i,
      /witr/i,
      /istikharah/i,
    ],
  },
  {
    id: 'ramadan',
    patterns: [
      /ramadan/i,
      /fast/i,
      /new moon/i,
      /iftar/i,
      /suhur/i,
    ],
  },
  {
    id: 'hajj-umrah',
    patterns: [
      /hajj/i,
      /umrah/i,
      /arafat/i,
      /mina/i,
      /safa/i,
      /marwah/i,
      /black stone/i,
      /muzdalifah/i,
      /pilgrim/i,
      /yemenite/i,
    ],
  },
  {
    id: 'family',
    patterns: [
      /family/i,
      /parents/i,
      /children/i,
      /child/i,
      /groom/i,
      /wedding/i,
      /marriage/i,
      /new parents/i,
      /intercourse/i,
    ],
  },
  {
    id: 'situational',
    patterns: [
      /worry/i,
      /grief/i,
      /anguish/i,
      /fear/i,
      /sick/i,
      /ill/i,
      /debt/i,
      /enemy/i,
      /harm/i,
      /evil/i,
      /rain/i,
      /thunder/i,
      /wind/i,
      /protection/i,
      /nightmare/i,
      /sin/i,
      /forgiveness/i,
      /repentance/i,
      /devil/i,
    ],
  },
  {
    id: 'daily-life',
    patterns: [
      /eating/i,
      /food/i,
      /home/i,
      /sleep/i,
      /wake/i,
      /restroom/i,
      /dress/i,
      /travel/i,
      /vehicle/i,
      /city/i,
      /market/i,
      /sneez/i,
      /assembly/i,
      /greetings/i,
      /pain/i,
      /study/i,
      /knowledge/i,
    ],
  },
];

const inferGrade = (source: string): string => {
  if (/bukhari|muslim/i.test(source)) return 'Sahih';
  if (/quran/i.test(source)) return 'Quranic Verse';
  if (/tirmidhi|abi dawud|nasa|ibn majah|ahmad|sunni|hakim/i.test(source)) {
    return 'Hasan / Sahih (reported)';
  }
  return 'Authentic (as compiled in Hisn al-Muslim)';
};

const URDU_TRANSLATION_MAP = urduTranslations as Record<string, string>;

const sanitizeArabicText = (value?: string): string => {
  return (value || '')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[﴿﴾]/g, ' ')
    .replace(/\*+/g, ' ')
    .replace(/\.{2,}/g, ' ')
    .replace(/[“”"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const getSafeText = (value?: string): string => (value || '').replace(/\s+/g, ' ').trim();

const sanitizeNarrativeText = (value?: string): string => {
  let text = getSafeText(value);
  if (!text) return '';

  let previous = '';
  while (text !== previous) {
    previous = text;
    text = text
      .replace(/^\(\s*(.*)\s*\)\.?$/u, '$1')
      .replace(/^\[\s*(.*)\s*\]\.?$/u, '$1')
      .replace(/^\{\s*(.*)\s*\}\.?$/u, '$1')
      .trim();
  }

  return text;
};

const getUrduTranslation = (originalEnglishTranslation: string, sanitizedEnglishTranslation: string): string => {
  const candidates = [
    originalEnglishTranslation,
    sanitizedEnglishTranslation,
    `(${sanitizedEnglishTranslation})`,
    `${sanitizedEnglishTranslation}.`,
  ];

  for (const key of candidates) {
    const normalizedKey = getSafeText(key);
    if (!normalizedKey) continue;
    const mapped = URDU_TRANSLATION_MAP[normalizedKey];
    if (mapped) {
      return sanitizeNarrativeText(mapped);
    }
  }

  return 'اردو ترجمہ دستیاب نہیں ہے۔';
};

const getSimpleTitleFromContext = (
  categoryId: DuaCategoryId,
  sectionTitle: string,
  translation: string
): string => {
  const section = sectionTitle.toLowerCase();
  const plain = translation
    .replace(/<[^>]+>/g, ' ')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const combined = `${sectionTitle} ${plain}`.toLowerCase();

  if (/words of remembrance for morning and evening/.test(section)) return 'Morning & Evening';
  if (/before sleeping/.test(section)) return 'Before Sleep';
  if (/when you wake up/.test(section)) return 'After Waking';
  if (/entering the restroom/.test(section)) return 'Enter Bathroom';
  if (/leaving the restroom/.test(section)) return 'Leave Bathroom';
  if (/before performing ablution/.test(section)) return 'Before Wudu';
  if (/completing ablution/.test(section)) return 'After Wudu';
  if (/leaving the home/.test(section)) return 'Leave Home';
  if (/entering the home/.test(section)) return 'Enter Home';
  if (/going to the mosque/.test(section)) return 'Go to Masjid';
  if (/entering the mosque/.test(section)) return 'Enter Masjid';
  if (/leaving the mosque/.test(section)) return 'Leave Masjid';
  if (/hearing the athan/.test(section)) return 'Hear Adhan';
  if (/beginning of the prayer/.test(section)) return 'Start Prayer';
  if (/during ruki/.test(section)) return 'Ruku';
  if (/rising from the ruki/.test(section)) return 'Rise from Ruku';
  if (/during sujood/.test(section)) return 'Sujood';
  if (/between two prostrations/.test(section)) return 'Between Sujood';
  if (/tashahhud/.test(section)) return 'Tashahhud';
  if (/before ending the prayer/.test(section)) return 'Before Salam';
  if (/after completing the prayer/.test(section)) return 'After Prayer';
  if (/stir in the night/.test(section)) return 'Night Wake Up';
  if (/afraid to go to sleep|lonely and depressed/.test(section)) return 'Sleep Anxiety';
  if (/bad dream|nightmare/.test(section)) return 'Bad Dream';
  if (/qunut in the witr prayer/.test(section)) return 'Witr Qunut';
  if (/following the witr prayer/.test(section)) return 'After Witr';
  if (/worry and grief/.test(section)) return 'Anxiety Relief';
  if (/anguish/.test(section)) return 'Hardship Relief';
  if (/adversary|powerful ruler/.test(section)) return 'Facing an Enemy';
  if (/fear people may harm you/.test(section)) return 'Fear of Harm';
  if (/setting of a debt/.test(section)) return 'Debt Relief';
  if (/distractions of satan/.test(section)) return 'Prayer Focus';
  if (/find something becoming difficult/.test(section)) return 'When Life Feels Hard';
  if (/commit a sin/.test(section)) return 'After Sin';
  if (/devil and his promptings/.test(section)) return 'Against Shaytan';
  if (/protection for children/.test(section)) return 'For Children';
  if (/visiting the sick/.test(section)) return 'Visit the Sick';
  if (/terminal ill/.test(section)) return 'Terminal Illness';
  if (/tragedy strikes/.test(section)) return 'At Tragedy';
  if (/wind blows/.test(section)) return 'Strong Wind';
  if (/when it thunder/.test(section)) return 'Thunder';
  if (/some invocations for rain/.test(section)) return 'Rain';
  if (/when it rains/.test(section)) return 'Rainfall';
  if (/after it rains/.test(section)) return 'After Rain';
  if (/breaking the fast/.test(section)) return 'At Iftar';
  if (/before eating/.test(section)) return 'Before Eating';
  if (/after eating/.test(section)) return 'After Eating';
  if (/first dates of the season/.test(section)) return 'First Fruits';
  if (/for sneezing/.test(section)) return 'After Sneezing';
  if (/for the groom/.test(section)) return 'For Marriage';
  if (/wedding night/.test(section)) return 'Wedding Night';
  if (/traveling/.test(section)) return 'Travel';
  if (/traveler's invocation at dawn/.test(section)) return 'Travel at Dawn';
  if (/resident's invocations for the traveler/.test(section)) return 'For a Traveler';
  if (/traveler leaves behind/.test(section)) return 'Traveler Farewell';
  if (/new parents/.test(section)) return 'For New Parents';
  if (/repentance and seeking forgiveness/.test(section)) return 'Forgiveness';

  if (/morning/.test(combined)) return 'Morning Dhikr';
  if (/evening/.test(combined)) return 'Evening Dhikr';
  if (/before (sleep|sleeping)|sleep/.test(combined)) return 'Before Sleep';
  if (/after waking|wake up|waking up/.test(combined)) return 'After Waking';
  if (/before eating|start eating/.test(combined)) return 'Before Eating';
  if (/after eating|finish eating/.test(combined)) return 'After Eating';
  if (/entering home|enter home/.test(combined)) return 'Enter Home';
  if (/leaving home|leave home/.test(combined)) return 'Leave Home';
  if (/entering the mosque|enter mosque|masjid/.test(combined)) return 'Enter Masjid';
  if (/travel|journey|vehicle/.test(combined)) return 'Travel';
  if (/wudu|ablution/.test(combined)) return 'Wudu';
  if (/ruku/.test(combined)) return 'Ruku';
  if (/sujood/.test(combined)) return 'Sujood';
  if (/tashahhud/.test(combined)) return 'Tashahhud';
  if (/seek refuge|protection|evil|devil/.test(combined)) return 'Protection';
  if (/forgive|forgiveness|repent/.test(combined)) return 'Forgiveness';
  if (/guid/.test(combined)) return 'Guidance';
  if (/heal|sick|ill|pain/.test(combined)) return 'Healing';
  if (/debt/.test(combined)) return 'Debt Relief';
  if (/rain/.test(combined)) return 'Rain';
  if (/thunder/.test(combined)) return 'Thunder';
  if (/knowledge|learn|study/.test(combined)) return 'Knowledge';
  if (/prayer|salah|adhan/.test(combined)) return 'Prayer';

  if (categoryId === 'morning-evening') return 'Daily Adhkar';
  if (categoryId === 'daily-life') return 'Daily Life';
  if (categoryId === 'salah') return 'Salah';
  if (categoryId === 'ramadan') return 'Ramadan';
  if (categoryId === 'family') return 'Family';
  if (categoryId === 'situational') return 'Situational';
  if (categoryId === 'hajj-umrah') return 'Hajj';

  const words = plain.split(' ').filter(Boolean).slice(0, 2);
  return words.length ? words.join(' ') : 'Daily Dua';
};

const getPurposeDescription = (
  categoryId: DuaCategoryId,
  sectionTitle: string,
  translation: string
): string => {
  const section = sectionTitle.toLowerCase();
  const combined = `${sectionTitle} ${translation}`.toLowerCase();

  if (/words of remembrance for morning and evening/.test(section)) return 'For morning and evening remembrance.';
  if (/before sleeping/.test(section)) return 'Read before sleeping for peace and safety.';
  if (/when you wake up/.test(section)) return 'Read after waking to thank Allah.';
  if (/entering the restroom/.test(section)) return 'Read before entering the bathroom.';
  if (/leaving the restroom/.test(section)) return 'Read after leaving the bathroom.';
  if (/before performing ablution/.test(section)) return 'Read before starting wudu.';
  if (/completing ablution/.test(section)) return 'Read after finishing wudu.';
  if (/leaving the home/.test(section)) return 'Read when leaving home for protection.';
  if (/entering the home/.test(section)) return 'Read when entering home for barakah.';
  if (/going to the mosque/.test(section)) return 'Read on the way to the masjid.';
  if (/entering the mosque/.test(section)) return 'Read when entering the masjid.';
  if (/leaving the mosque/.test(section)) return 'Read when leaving the masjid.';
  if (/hearing the athan/.test(section)) return 'Read after hearing the adhan.';
  if (/beginning of the prayer/.test(section)) return 'Read at the start of salah.';
  if (/during ruki/.test(section)) return 'Read while in ruku.';
  if (/rising from the ruki/.test(section)) return 'Read after rising from ruku.';
  if (/during sujood/.test(section)) return 'Read while in sujood.';
  if (/between two prostrations/.test(section)) return 'Read while sitting between two sajdahs.';
  if (/tashahhud/.test(section)) return 'Read during tashahhud in salah.';
  if (/after completing the prayer/.test(section)) return 'Read after finishing salah.';
  if (/worry and grief/.test(section)) return 'For anxiety, grief, and emotional stress.';
  if (/anguish/.test(section)) return 'For hardship and deep distress.';
  if (/setting of a debt/.test(section)) return 'For debt relief and financial ease.';
  if (/find something becoming difficult/.test(section)) return 'Read when life feels difficult.';
  if (/commit a sin/.test(section)) return 'Read after a mistake and seek forgiveness.';
  if (/protection for children/.test(section)) return 'For the protection of children.';
  if (/visiting the sick/.test(section)) return 'Read when visiting someone ill.';
  if (/when it thunder/.test(section)) return 'Read when hearing thunder.';
  if (/when it rains/.test(section)) return 'Read when rain falls.';
  if (/after it rains/.test(section)) return 'Read after rain as gratitude.';
  if (/before eating/.test(section)) return 'Read before eating.';
  if (/after eating/.test(section)) return 'Read after eating.';
  if (/traveling/.test(section)) return 'Read when starting a journey.';
  if (/repentance and seeking forgiveness/.test(section)) return 'For regular repentance and forgiveness.';

  if (/morning/.test(combined)) return 'For morning protection and blessings.';
  if (/evening/.test(combined)) return 'For evening peace and protection.';
  if (/before (sleep|sleeping)|sleep/.test(combined)) return 'Read before sleeping for safety and calm.';
  if (/after waking|wake up|waking up/.test(combined)) return 'Read after waking to thank Allah.';
  if (/before eating|start eating/.test(combined)) return 'Read before eating to begin with Allah’s name.';
  if (/after eating|finish eating/.test(combined)) return 'Read after eating to thank Allah for food.';
  if (/entering home|enter home/.test(combined)) return 'Read when entering home for barakah.';
  if (/leaving home|leave home/.test(combined)) return 'Read when leaving home for protection.';
  if (/entering the mosque|enter mosque|masjid/.test(combined)) return 'Read when entering the masjid.';
  if (/travel|journey|vehicle/.test(combined)) return 'Read while starting or during travel.';
  if (/wudu|ablution/.test(combined)) return 'Read around wudu and purification.';
  if (/salah|prayer/.test(combined)) return 'Read during or after salah.';
  if (/anxiety|grief|worry|hardship/.test(combined)) return 'For anxiety, grief, and hardship relief.';
  if (/debt/.test(combined)) return 'For debt relief and ease in finances.';
  if (/heal|sick|ill|pain/.test(combined)) return 'For healing and wellbeing.';
  if (/forgive|forgiveness|repent/.test(combined)) return 'For forgiveness and repentance.';
  if (/guid/.test(combined)) return 'For guidance and right decisions.';
  if (/protect|protection|evil|devil|refuge/.test(combined)) return 'For protection from harm and evil.';
  if (/knowledge|learn|study/.test(combined)) return 'For beneficial knowledge and learning.';

  if (categoryId === 'morning-evening') return 'For daily remembrance in the morning and evening.';
  if (categoryId === 'daily-life') return 'For everyday moments and practical routines.';
  if (categoryId === 'salah') return 'For prayer-related remembrance and supplications.';
  if (categoryId === 'ramadan') return 'For fasting and blessed Ramadan moments.';
  if (categoryId === 'hajj-umrah') return 'For pilgrimage rituals during Hajj and Umrah.';
  if (categoryId === 'family') return 'For family wellbeing, marriage, and children.';
  if (categoryId === 'situational') return 'For hardship, fear, anxiety, and seeking protection.';
  return `For ${sectionTitle.toLowerCase()}.`;
};

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const inferCategory = (title: string): DuaCategoryId => {
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(title))) return rule.id;
  }
  return 'daily-life';
};

const inferSituationTags = (title: string, textBlob: string): SituationFilterId[] => {
  const combined = `${title} ${textBlob}`.toLowerCase();
  const tags = new Set<SituationFilterId>();

  if (/anxiety|grief|worry|anguish|depressed/.test(combined)) tags.add('anxiety');
  if (/debt/.test(combined)) tags.add('debt');
  if (/sick|ill|pain|health|terminal/.test(combined)) tags.add('health');
  if (/protection|evil|enemy|devil|harm|fear|refuge/.test(combined)) tags.add('protection');
  if (/travel|vehicle|journey|town|city|market|returning/.test(combined)) tags.add('travel');
  if (/marriage|groom|wedding|intercourse/.test(combined)) tags.add('marriage');
  if (/forgiveness|repentance|sin|istighfar/.test(combined)) tags.add('forgiveness');
  if (/before sleeping|sleep|night/.test(combined)) tags.add('before-sleep');
  if (/wake up|waking/.test(combined)) tags.add('after-waking');
  if (/entering the restroom/.test(combined)) tags.add('bathroom-entry');
  if (/leaving the restroom/.test(combined)) tags.add('bathroom-exit');
  if (/thunder/.test(combined)) tags.add('thunder');
  if (/rain/.test(combined)) tags.add('rain');
  if (/study|learn|knowledge|beneficial knowledge/.test(combined)) {
    tags.add('knowledge');
  }
  if (/evil eye/.test(combined)) tags.add('evil-eye');
  if (/morning/.test(combined)) tags.add('morning');
  if (/evening/.test(combined)) tags.add('evening');

  return Array.from(tags);
};

const buildVirtueText = (repeat: number, sectionTitle: string): string => {
  const repeatText = repeat > 1 ? `Recite ${repeat} times as taught in the Sunnah.` : 'Recite with presence and sincerity.';
  return `${repeatText} This remembrance is from the ${sectionTitle} section of Hisn al-Muslim and helps keep the heart connected to Allah.`;
};

const BASE_MANUAL_DUAS: DuaEntry[] = [
  {
    id: 'manual-dua-anxiety',
    slug: 'dua-for-anxiety',
    categoryId: 'situational',
    title: 'Anxiety Relief',
    shortDescription: 'For anxiety, sadness, and emotional stress.',
    sectionTitle: 'Situational Duas',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ',
    transliteration: "Allahumma inni a'udhu bika min al-hammi wal-hazan.",
    translation: 'O Allah, I seek refuge in You from anxiety and grief.',
    translationUrdu: 'اے اللہ! میں پریشانی اور غم سے تیری پناہ مانگتا ہوں۔',
    virtue: 'The Prophet ﷺ taught this dua for relief from emotional burden and distress.',
    reference: {
      source: 'Sahih al-Bukhari',
      book: 'Book of Invocations (Kitab ad-Da\'awat)',
      hadithNumber: '6369',
      grade: 'Sahih',
      notes: 'Also reported in related wording in other authentic collections.',
    },
    tags: ['anxiety', 'grief', 'worry', 'hisn al muslim'],
    situationTags: ['anxiety', 'protection', 'forgiveness'],
  },
  {
    id: 'manual-dua-before-study',
    slug: 'dua-before-study',
    categoryId: 'daily-life',
    title: 'Before Study',
    shortDescription: 'Read before studying or learning.',
    sectionTitle: 'Seeking Knowledge',
    arabic: 'اللَّهُمَّ انْفَعْنِي بِمَا عَلَّمْتَنِي وَعَلِّمْنِي مَا يَنْفَعُنِي',
    transliteration: 'Allahumma anfa\'ni bima allamtani wa allimni ma yanfa\'uni.',
    translation: 'O Allah, benefit me with what You have taught me and teach me what will benefit me.',
    translationUrdu: 'اے اللہ! مجھے اس علم سے فائدہ دے جو تو نے سکھایا، اور مجھے وہ سکھا جو میرے لیے نفع بخش ہو۔',
    virtue: 'A beautiful supplication to begin learning with humility and barakah.',
    reference: {
      source: 'Jami al-Tirmidhi',
      book: 'Book of Supplications',
      hadithNumber: '3599',
      grade: 'Hasan / Sahih (reported)',
      notes: 'Commonly recited by students and teachers seeking beneficial knowledge.',
    },
    tags: ['study', 'knowledge', 'education'],
    situationTags: ['before-study', 'knowledge'],
  },
  {
    id: 'manual-dua-knowledge',
    slug: 'dua-for-knowledge',
    categoryId: 'daily-life',
    title: 'More Knowledge',
    shortDescription: 'For increase in beneficial knowledge.',
    sectionTitle: 'Seeking Knowledge',
    arabic: 'رَبِّ زِدْنِي عِلْمًا',
    transliteration: 'Rabbi zidni ilma.',
    translation: 'My Lord, increase me in knowledge.',
    translationUrdu: 'اے میرے رب! میرے علم میں اضافہ فرما۔',
    virtue: 'A Quranic prayer for steady growth in beneficial knowledge.',
    reference: {
      source: 'Quran - Surah Taha',
      book: 'Quran',
      hadithNumber: '20:114',
      grade: 'Quranic Verse',
    },
    tags: ['knowledge', 'quran'],
    situationTags: ['knowledge', 'before-study'],
  },
  {
    id: 'manual-dua-evil-eye',
    slug: 'dua-for-protection-from-evil-eye',
    categoryId: 'situational',
    title: 'Evil Eye Protection',
    shortDescription: 'For protection from evil eye and hidden harm.',
    sectionTitle: 'Protection Duas',
    arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّةِ مِنْ كُلِّ شَيْطَانٍ وَهَامَّةٍ وَمِنْ كُلِّ عَيْنٍ لَامَّةٍ',
    transliteration: "A'udhu bikalimatillahit-tammati min kulli shaytanin wa hammah wa min kulli aynin lammah.",
    translation: 'I seek refuge in the perfect words of Allah from every devil, harmful creature, and every evil eye.',
    translationUrdu: 'میں اللہ کے کامل کلمات کے ذریعے ہر شیطان، نقصان دہ چیز اور بری نظر سے پناہ مانگتا ہوں۔',
    virtue: 'The Prophet ﷺ used this for protection, especially for children.',
    reference: {
      source: 'Sahih al-Bukhari',
      book: 'Book of Prophets',
      hadithNumber: '3371',
      grade: 'Sahih',
    },
    tags: ['evil eye', 'protection', 'children'],
    situationTags: ['evil-eye', 'protection', 'health'],
  },
];

const PRIORITY_HAJJ_UMRAH_DUAS: DuaEntry[] = [
  {
    id: 'hajj-step-1-talbiyah',
    slug: 'hajj-talbiyah',
    categoryId: 'hajj-umrah',
    title: 'Talbiyah',
    shortDescription: 'Repeat from Ihram throughout your pilgrimage.',
    sectionTitle: 'Hajj & Umrah Duas (Step-by-Step)',
    arabic: 'لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكَ، لَا شَرِيكَ لَكَ',
    transliteration: "Labbayk Allahumma labbayk, labbayka la sharika laka labbayk. Innal hamda wan-ni'mata laka wal-mulk, la sharika lak.",
    translation: 'Here I am, O Allah, here I am. You have no partner. Surely all praise, blessing, and sovereignty belong to You.',
    translationUrdu: 'میں حاضر ہوں اے اللہ! میں حاضر ہوں۔ تیرا کوئی شریک نہیں۔ بے شک سب تعریف، نعمت اور بادشاہی تیرے ہی لیے ہے۔',
    virtue: 'Recite from Ihram and during the journey of rituals.',
    reference: {
      source: 'Sahih al-Bukhari',
      book: 'Book of Hajj',
      hadithNumber: '1549',
      grade: 'Sahih',
    },
    tags: ['hajj', 'umrah', 'talbiyah'],
    situationTags: ['travel'],
  },
  {
    id: 'hajj-step-2-masjid-entry',
    slug: 'hajj-entering-masjid-al-haram',
    categoryId: 'hajj-umrah',
    title: 'Enter Haram',
    shortDescription: 'Read when entering Masjid al-Haram.',
    sectionTitle: 'Hajj & Umrah Duas (Step-by-Step)',
    arabic: 'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ',
    transliteration: 'Allahumma iftah li abwaba rahmatik.',
    translation: 'O Allah, open for me the gates of Your mercy.',
    translationUrdu: 'اے اللہ! میرے لیے اپنی رحمت کے دروازے کھول دے۔',
    virtue: 'Sunnah dua when entering any masjid, including Masjid al-Haram.',
    reference: {
      source: 'Sahih Muslim',
      book: 'Book of Mosques',
      hadithNumber: '713',
      grade: 'Sahih',
    },
    tags: ['hajj', 'umrah', 'masjid'],
    situationTags: ['travel'],
  },
  {
    id: 'hajj-step-3-first-kaaba',
    slug: 'hajj-first-sight-of-kaaba',
    categoryId: 'hajj-umrah',
    title: 'First Kaaba View',
    shortDescription: 'Read when seeing the Kaaba for the first time.',
    sectionTitle: 'Hajj & Umrah Duas (Step-by-Step)',
    arabic: 'رَبَّنَا تَقَبَّلْ مِنَّا إِنَّكَ أَنْتَ السَّمِيعُ الْعَلِيمُ',
    transliteration: "Rabbana taqabbal minna innaka antas-Sami'ul-Alim.",
    translation: 'Our Lord, accept from us. Indeed, You are the All-Hearing, All-Knowing.',
    translationUrdu: 'اے ہمارے رب! ہم سے قبول فرما، بے شک تو خوب سننے والا، خوب جاننے والا ہے۔',
    virtue: 'A Quranic dua for acceptance at the Sacred House.',
    reference: {
      source: 'Quran',
      book: 'Surah Al-Baqarah',
      hadithNumber: '2:127',
      grade: 'Quranic Verse',
    },
    tags: ['hajj', 'umrah', 'kaaba'],
    situationTags: ['travel', 'forgiveness'],
  },
  {
    id: 'hajj-step-4-start-tawaf',
    slug: 'hajj-starting-tawaf',
    categoryId: 'hajj-umrah',
    title: 'Start Tawaf',
    shortDescription: 'At Hajar al-Aswad, begin with Bismillah and Takbir.',
    sectionTitle: 'Hajj & Umrah Duas (Step-by-Step)',
    arabic: 'بِسْمِ اللَّهِ، اللَّهُ أَكْبَرُ',
    transliteration: 'Bismillah, Allahu Akbar.',
    translation: 'In the name of Allah, Allah is the Greatest.',
    translationUrdu: 'اللہ کے نام سے، اللہ سب سے بڑا ہے۔',
    virtue: 'Begin each tawaf round at the Black Stone with takbir.',
    reference: {
      source: 'Sahih al-Bukhari',
      book: 'Book of Hajj',
      hadithNumber: '1613',
      grade: 'Sahih',
      notes: 'Saying “Bismillah” is reported in additional narrations.',
    },
    tags: ['hajj', 'umrah', 'tawaf'],
    situationTags: ['travel'],
  },
  {
    id: 'hajj-step-5-rukn-yamani',
    slug: 'hajj-rukn-yamani-and-hajar-aswad-dua',
    categoryId: 'hajj-umrah',
    title: 'Between Two Corners',
    shortDescription: 'Read between Rukn Yamani and Hajar al-Aswad.',
    sectionTitle: 'Hajj & Umrah Duas (Step-by-Step)',
    arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
    transliteration: 'Rabbana atina fid-dunya hasanah wa fil-akhirati hasanah wa qina adhaban-nar.',
    translation: 'Our Lord, grant us good in this world and good in the Hereafter, and protect us from the Fire.',
    translationUrdu: 'اے ہمارے رب! ہمیں دنیا میں بھلائی دے، آخرت میں بھلائی دے اور ہمیں آگ کے عذاب سے بچا۔',
    virtue: 'Most commonly recited dua in tawaf.',
    reference: {
      source: 'Quran',
      book: 'Surah Al-Baqarah',
      hadithNumber: '2:201',
      grade: 'Quranic Verse',
    },
    tags: ['hajj', 'umrah', 'tawaf'],
    situationTags: ['forgiveness', 'protection'],
  },
  {
    id: 'hajj-step-6-safa-marwah',
    slug: 'hajj-safa-marwah-dhikr',
    categoryId: 'hajj-umrah',
    title: 'Safa & Marwah',
    shortDescription: 'Recite at Safa and Marwah during Sa’i.',
    sectionTitle: 'Hajj & Umrah Duas (Step-by-Step)',
    arabic: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
    transliteration: "La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa ala kulli shay'in qadir.",
    translation: 'None has the right to be worshipped except Allah alone. His is the kingdom and praise, and He has power over all things.',
    translationUrdu: 'اللہ کے سوا کوئی معبود نہیں، وہ اکیلا ہے، اس کا کوئی شریک نہیں۔ اسی کی بادشاہی ہے، اسی کے لیے حمد ہے، اور وہ ہر چیز پر قادر ہے۔',
    virtue: 'Core dhikr taught by the Prophet ﷺ at Safa and Marwah.',
    reference: {
      source: 'Sahih Muslim',
      book: 'Book of Hajj',
      hadithNumber: '1218',
      grade: 'Sahih',
    },
    tags: ['hajj', 'umrah', 'safa', 'marwah'],
    situationTags: ['travel'],
  },
  {
    id: 'hajj-step-7-talbiyah-repeat',
    slug: 'hajj-talbiyah-during-pilgrimage',
    categoryId: 'hajj-umrah',
    title: 'Repeat Talbiyah',
    shortDescription: 'Keep repeating this during pilgrimage travel.',
    sectionTitle: 'Hajj & Umrah Duas (Step-by-Step)',
    arabic: 'لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكَ، لَا شَرِيكَ لَكَ',
    transliteration: "Labbayk Allahumma labbayk, labbayka la sharika laka labbayk. Innal hamda wan-ni'mata laka wal-mulk, la sharika lak.",
    translation: 'Here I am, O Allah, here I am. You have no partner. Surely all praise, blessing, and sovereignty belong to You.',
    translationUrdu: 'میں حاضر ہوں اے اللہ! میں حاضر ہوں۔ تیرا کوئی شریک نہیں۔ بے شک سب تعریف، نعمت اور بادشاہی تیرے ہی لیے ہے۔',
    virtue: 'Continue reciting regularly until the rites require stopping it.',
    reference: {
      source: 'Sahih al-Bukhari',
      book: 'Book of Hajj',
      hadithNumber: '1549',
      grade: 'Sahih',
    },
    tags: ['hajj', 'umrah', 'talbiyah'],
    situationTags: ['travel'],
  },
  {
    id: 'hajj-step-8-arafah',
    slug: 'hajj-best-dua-of-arafah',
    categoryId: 'hajj-umrah',
    title: 'Arafah Dhikr',
    shortDescription: 'Best dhikr to repeat on the Day of Arafah.',
    sectionTitle: 'Hajj & Umrah Duas (Step-by-Step)',
    arabic: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
    transliteration: "La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa ala kulli shay'in qadir.",
    translation: 'None has the right to be worshipped except Allah alone. His is the kingdom and praise, and He has power over all things.',
    translationUrdu: 'اللہ کے سوا کوئی معبود نہیں، وہ اکیلا ہے، اس کا کوئی شریک نہیں۔ اسی کی بادشاہی ہے، اسی کے لیے حمد ہے، اور وہ ہر چیز پر قادر ہے۔',
    virtue: 'The Prophet ﷺ called this the best statement on Arafah.',
    reference: {
      source: 'Jami al-Tirmidhi',
      book: 'Book of Supplications',
      hadithNumber: '3585',
      grade: 'Hasan / Sahih (reported)',
    },
    tags: ['hajj', 'arafah'],
    situationTags: ['forgiveness'],
  },
  {
    id: 'hajj-step-9-muzdalifah',
    slug: 'hajj-dhikr-at-muzdalifah',
    categoryId: 'hajj-umrah',
    title: 'Muzdalifah Dhikr',
    shortDescription: "Remember Allah at al-Mash'ar al-Haram in Muzdalifah.",
    sectionTitle: 'Hajj & Umrah Duas (Step-by-Step)',
    arabic: 'اللَّهُ أَكْبَرُ، لَا إِلَهَ إِلَّا اللَّهُ وَاللَّهُ أَكْبَرُ، وَلِلَّهِ الْحَمْدُ',
    transliteration: 'Allahu Akbar, la ilaha illallah, wallahu Akbar, wa lillahil-hamd.',
    translation: 'Allah is the Greatest. None has the right to be worshipped except Allah. Allah is the Greatest, and all praise is for Allah.',
    translationUrdu: 'اللہ سب سے بڑا ہے۔ اللہ کے سوا کوئی معبود نہیں۔ اللہ سب سے بڑا ہے اور سب تعریف اللہ کے لیے ہے۔',
    virtue: 'Pilgrims are commanded to remember Allah at Muzdalifah.',
    reference: {
      source: 'Quran',
      book: 'Surah Al-Baqarah',
      hadithNumber: '2:198',
      grade: 'Quranic Verse',
      notes: 'Practice described in Sahih Muslim 1218.',
    },
    tags: ['hajj', 'muzdalifah'],
    situationTags: ['travel'],
  },
  {
    id: 'hajj-step-10-jamarat',
    slug: 'hajj-takbir-jamarat',
    categoryId: 'hajj-umrah',
    title: 'Jamarat Takbir',
    shortDescription: 'Say with every throw while stoning.',
    sectionTitle: 'Hajj & Umrah Duas (Step-by-Step)',
    arabic: 'اللَّهُ أَكْبَرُ',
    transliteration: 'Allahu Akbar.',
    translation: 'Allah is the Greatest.',
    translationUrdu: 'اللہ سب سے بڑا ہے۔',
    virtue: 'The Prophet ﷺ said takbir with each pebble throw.',
    reference: {
      source: 'Sahih al-Bukhari',
      book: 'Book of Hajj',
      hadithNumber: '1751',
      grade: 'Sahih',
    },
    tags: ['hajj', 'jamarat', 'takbir'],
    situationTags: ['travel'],
  },
];

const generatedDuas: DuaEntry[] = [];

for (const section of RAW_SECTIONS) {
  const sectionTitle = getSafeText(section.TITLE) || 'General Duas';
  const categoryId = inferCategory(sectionTitle);
  const sectionItems = section.TEXT || [];

  sectionItems.forEach((item, itemIndex) => {
    const arabic = sanitizeArabicText(item.ARABIC_TEXT);
    const transliteration = sanitizeNarrativeText(item.LANGUAGE_ARABIC_TRANSLATED_TEXT) || 'Transliteration available in source audio.';
    const rawTranslation = getSafeText(item.TRANSLATED_TEXT);
    const translation = sanitizeNarrativeText(item.TRANSLATED_TEXT) || 'Translation not available in source dataset.';
    const translationUrdu = getUrduTranslation(rawTranslation, translation);
    const repeat = typeof item.REPEAT === 'number' ? item.REPEAT : 1;
    const simpleTitle = getSimpleTitleFromContext(categoryId, sectionTitle, translation);
    const title = sectionItems.length > 1 ? `${simpleTitle} ${itemIndex + 1}` : simpleTitle;
    const shortDescription = getPurposeDescription(categoryId, sectionTitle, translation);

    const source = 'Hisn al-Muslim (Fortress of the Muslim)';
    const hadithNumber = `HM-${section.ID}-${item.ID}`;

    const textBlob = `${sectionTitle} ${title} ${arabic} ${transliteration} ${translation}`;
    const situationTags = inferSituationTags(title, textBlob);

    generatedDuas.push({
      id: `hisn-${section.ID}-${item.ID}`,
      slug: toSlug(`${title} ${item.ID}`),
      categoryId,
      title,
      shortDescription,
      sectionTitle,
      arabic,
      rawArabic: getSafeText(item.ARABIC_TEXT),
      transliteration,
      translation,
      translationUrdu,
      virtue: buildVirtueText(repeat, sectionTitle),
      reference: {
        source,
        book: sectionTitle,
        hadithNumber,
        grade: inferGrade(source),
        notes: 'Reference ID from the Hisn al-Muslim source dataset.',
      },
      tags: [
        sectionTitle.toLowerCase(),
        ...situationTags,
      ],
      situationTags,
      audioUrl: (item.AUDIO || '').replace('http://', 'https://') || undefined,
    });
  });
}

const mergeAndDedupe = (manual: DuaEntry[], generated: DuaEntry[]): DuaEntry[] => {
  const byArabic = new Set<string>();
  const merged: DuaEntry[] = [];

  for (const dua of [...manual, ...generated]) {
    const key = dua.arabic.replace(/\s+/g, ' ').trim();
    if (!key) continue;
    if (byArabic.has(key)) continue;
    byArabic.add(key);
    merged.push(dua);
  }

  return merged;
};

const generatedWithoutHajj = generatedDuas.filter((dua) => dua.categoryId !== 'hajj-umrah');

export const DUA_LIBRARY: DuaEntry[] = mergeAndDedupe(
  [...PRIORITY_HAJJ_UMRAH_DUAS, ...BASE_MANUAL_DUAS],
  generatedWithoutHajj
);

export const DUA_LIBRARY_META = {
  totalDuas: DUA_LIBRARY.length,
  source: 'Hisn al-Muslim plus curated additions',
};

const slugMap = new Map<string, DuaEntry>();
for (const dua of DUA_LIBRARY) {
  if (!slugMap.has(dua.slug)) {
    slugMap.set(dua.slug, dua);
  }
}

export const getDuaBySlug = (slug?: string): DuaEntry | undefined => {
  if (!slug) return undefined;
  return slugMap.get(slug);
};

export const getDuaById = (id?: string): DuaEntry | undefined => {
  if (!id) return undefined;
  return DUA_LIBRARY.find((dua) => dua.id === id);
};

export const getCategoryTitle = (categoryId: DuaCategoryId): string => {
  return DUA_CATEGORIES.find((category) => category.id === categoryId)?.title || 'General';
};

export const quickAccessToSituationTag = (label: string): SituationFilterId | null => {
  return QUICK_ACCESS_TOPICS[label] || null;
};
