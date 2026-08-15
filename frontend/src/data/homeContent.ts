import {
  BookOpenIcon,
  ClockIcon,
  GlobeAltIcon,
  HeartIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

export type HomeFeature = {
  icon: string;
  title: string;
  path?: string;
  description: string;
  color: string;
  bgColor: string;
  gradient: string;
  disabled?: boolean;
};

export const MAKTAB_SLIDES = [
  {
    src: '/maktab/students-hero.jpg',
    alt: 'Boys and girls seated with their teacher during Maktab class',
    caption: 'Every child deserves a place to learn',
    eyebrow: 'For the next generation',
  },
  {
    src: '/maktab/students-boys-line.jpg',
    alt: 'Maktab boys standing in line for assembly',
    caption: 'Classrooms kept open by your sponsorship',
    eyebrow: 'Growing campaign',
  },
  {
    src: '/maktab/students-girls-line.jpg',
    alt: 'Maktab girls lined up in the prayer hall',
    caption: 'Free seats for Quran & Tajweed',
    eyebrow: 'Quran first',
  },
  {
    src: '/maktab/hifz.jpg',
    alt: 'Open Qurans on wooden stands for Hifz memorisation',
    caption: 'Support a child’s Hifz journey',
    eyebrow: 'Hifz pathway',
  },
  {
    src: '/maktab/students-salah-girls.jpg',
    alt: 'Girls practising salah with their teacher',
    caption: 'Deen, Hadith & Islamic culture',
    eyebrow: 'Character & knowledge',
  },
  {
    src: '/maktab/program-classroom.jpg',
    alt: 'Notebooks and stationery for Maktab classroom support',
    caption: 'Books & classroom needs',
    eyebrow: 'Practical support',
  },
] as const;

export const MAKTAB_HIGHLIGHTS = [
  'Hafiz teachers with 10+ years experience',
  'Quran, Hifz, Urdu & Deen curriculum',
  'Inverter backup for calm study',
  'Free books & copies when needed',
] as const;

/** Short “why” pillars — not full feature blurbs */
export const HOME_PILLARS: Array<{
  label: string;
  description: string;
  icon: IconType;
  color: string;
  bgColor: string;
}> = [
  {
    label: 'Worship, on time',
    description: 'Salah, Qibla, and nearby mosques stay aligned with where you are.',
    icon: ClockIcon,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
  },
  {
    label: 'Learn with depth',
    description: 'Quran, Tafsir, and translations in one calm reading flow.',
    icon: BookOpenIcon,
    color: 'text-sky-700',
    bgColor: 'bg-sky-100',
  },
  {
    label: 'Remember daily',
    description: 'Authentic adhkar and duas with a built-in tasbih companion.',
    icon: HeartIcon,
    color: 'text-teal-700',
    bgColor: 'bg-teal-100',
  },
  {
    label: 'Give with clarity',
    description: 'Zakat tools and transparent fund workflows when you manage giving.',
    icon: SparklesIcon,
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
  },
  {
    label: 'Grow together',
    description: 'Community spaces and Islamic quizzes that keep learning social.',
    icon: GlobeAltIcon,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
  },
];

export const HOME_TRUST = ['Free forever', 'No ads', 'Privacy first', 'Built for the Ummah'] as const;

/** Site story — complementary to Features grid; does not re-list product blurbs */
export const HOME_STORY = {
  heading: 'Built for real Muslim life, not another tool pile',
  lead:
    'HikmahSphere exists because faith is lived in ordinary hours — before Fajr, between meetings, on a journey, and with family. We built one sincere islamic digital platform so worship, learning, and community do not feel scattered across a dozen apps.',
  chapters: [
    {
      id: 'day',
      title: 'A quieter rhythm through the day',
      body: 'Morning intention, midday pause, evening remembrance — the platform is meant to stay out of the way until you need it. Accurate timing, a clear direction of prayer, and calm reading spaces help you return to Allah without hunting for settings or switching contexts.',
    },
    {
      id: 'family',
      title: 'For individuals, families, and local communities',
      body: 'Students revising an ayah, parents teaching children, travelers finding a mosque, and organisers recording Zakat with transparency all share one home. HikmahSphere is a muslim app designed for India and the global Ummah — practical where you live, respectful of how you worship.',
    },
    {
      id: 'sincerity',
      title: 'Sincerity over noise',
      body: 'No ads competing with dua. No pressure to scroll. Privacy-first by design, free forever for everyday use, and shaped around authentic sources so knowledge stays trustworthy. When you give back, Maktab sponsorship extends that sincerity to children who need free Islamic education.',
    },
  ],
  moments: [
    { label: 'Before Salah', text: 'Know the time and face the Qibla with calm confidence.' },
    { label: 'In study', text: 'Move from recitation to meaning without leaving your flow.' },
    { label: 'In remembrance', text: 'Return to adhkar and duas when the heart needs stillness.' },
    { label: 'In giving', text: 'Calculate and manage charity with clarity and accountability.' },
  ],
  closing:
    'Explore the tools above when you are ready — HikmahSphere is simply the place that holds them together, so your digital life can serve your Deen instead of distracting from it.',
};

/** Long-tail FAQ content — adds crawlable text + FAQPage rich-result eligibility */
export const HOME_FAQ: Array<{ question: string; answer: string }> = [
  {
    question: 'Is HikmahSphere free to use?',
    answer:
      'Yes. HikmahSphere is a completely free, ad-free Islamic app. Prayer times, the Quran reader, Dhikr & Dua, the Zakat calculator, community features, and Hajj guidance are all available at no cost, with no hidden charges and no advertisements interrupting your worship.',
  },
  {
    question: 'How accurate are the prayer times on HikmahSphere?',
    answer:
      'Prayer times are calculated from your real-time location using trusted methods including Muslim World League (MWL), ISNA, Umm al-Qura, and University of Islamic Sciences Karachi, with astronomical corrections for high-latitude regions. You can pick your madhab and calculation method so Salah timings match your local mosque.',
  },
  {
    question: 'Which Quran translations and reading features are available?',
    answer:
      'You can read the complete Quran (all 114 surahs) with Arabic text in Indo-Pak Nastaleeq script, transliteration, and translations in English, Urdu, Hindi and more. Audio recitations from renowned reciters, ayah bookmarks, last-read tracking, and verse-by-verse Tafsir help you study the Quran with meaning and context.',
  },
  {
    question: 'Can I calculate my Zakat with HikmahSphere?',
    answer:
      'Yes. The Zakat calculator uses live nisab values and current gold and silver prices, supports cash, savings, gold, silver, business assets and cryptocurrency, and applies the 2.5% rate using authentic methodologies — so you can work out your annual Zakat accurately in minutes.',
  },
  {
    question: 'Does HikmahSphere help with daily Dhikr and Dua?',
    answer:
      'The Dhikr & Dua library contains authentic morning and evening adhkar and everyday duas with full references, Arabic text, transliteration, and English/Urdu translation. A built-in online tasbih counter, favorites, and adjustable Arabic and transliteration font sizes make daily remembrance simple.',
  },
  {
    question: 'Is my data private on HikmahSphere?',
    answer:
      'HikmahSphere is privacy-first by design. There are no ads, we do not sell your data, and personal preferences stay tied to your account only to sync your experience across devices. You can explore most features without sharing anything beyond your location for prayer times.',
  },
  {
    question: 'What is HikmahSphere Maktab?',
    answer:
      'HikmahSphere Maktab is a sponsorship campaign that funds free Islamic education for children who cannot afford fees — covering Quran, Tajweed, Hifz, Hadith, Deen and Islamic culture, plus books and classroom needs. Your sponsorship keeps classrooms open for families in need.',
  },
  {
    question: 'Can I use HikmahSphere in India and worldwide?',
    answer:
      'Yes. HikmahSphere is a Muslim app designed for India and the global Ummah. Location-based prayer times, Qibla direction, and the mosque finder work anywhere in the world, and translations cover multiple languages for Muslims across different regions.',
  },
];

export type HomeTestimonial = {
  name: string;
  location: string;
  text: string;
  rating: number;
  avatar: string;
  feature: string;
  special?: boolean;
};

export const HOME_TESTIMONIALS: HomeTestimonial[] = [
  {
    name: 'Tasneem Fatima',
    location: 'Kolkata, India',
    text: 'The prayer times feature has transformed my daily Salah routine. The accurate geolocation-based calculations and beautiful prayer cards I can share with family make staying connected to my faith effortless. The notifications are perfectly timed!',
    rating: 5,
    avatar: '👩🏽',
    feature: 'Prayer Times',
  },
  {
    name: 'Ahemed Khan',
    location: 'Bangalore, India',
    text: 'The Zakat calculator is incredibly comprehensive. It calculated my Zakat considering gold, silver, savings, and even my investments. The live nisab rates gave me confidence that my calculation was accurate. Made my annual Zakat so much easier!',
    rating: 4,
    avatar: '👨🏽',
    feature: 'Zakat Calculator',
  },
  {
    name: 'Zafia Chowdhury',
    location: 'Bangalore, India',
    text: 'As someone who reads Quran daily, the multi-translation reader with Indopak script is a blessing. I can compare translations, bookmark my favorite ayahs, and the audio recitations help me improve my Tajweed. The semantic search finds exactly what I need!',
    rating: 5,
    avatar: '👩🏽',
    feature: 'Quran Reader',
  },
  {
    name: 'Zeenat Chowdhury',
    location: 'Kolkata, India',
    text: 'As a mother, my heart fills with pride seeing my son create something so beneficial for the Ummah. This platform beautifully combines technology with Islamic values. May Allah accept this sincere effort, bless you abundantly, and grant you the ability to continue serving the Deen. Aameen.',
    rating: 5,
    avatar: '👩🏽',
    feature: "Mother's Message",
    special: true,
  },
];

export const HOME_SEO = {
  title: 'HikmahSphere: Unified Islamic Platform for Quran, Prayer Times & Community',
  description:
    'HikmahSphere is a comprehensive, free, and privacy-focused Islamic app. Get accurate prayer times worldwide, read the Quran with Tafsir & audio, calculate Zakat, find Qibla direction, learn authentic Duas, and connect with a global Muslim community.',
  keywords: [
    'islamic app',
    'muslim app',
    'islamic platform',
    'islamic digital platform',
    'accurate prayer times',
    'prayer times india',
    'salah times',
    'namaz times',
    'quran reader',
    'quran with audio',
    'quran with translation',
    'quran tafsir',
    'tafsir e quran',
    'urdu quran',
    'indo pak quran',
    'qibla compass',
    'qibla direction',
    'mosque finder',
    'dhikr and dua',
    'morning evening adhkar',
    'online tasbih counter',
    'zakat calculator',
    'zakat calculator india',
    'nisab value today',
    'muslim community app',
    'islamic quiz games',
    'hajj guide',
    'hajj preparation app',
    'ramadan fasting times',
    'maktab sponsorship',
    'free islamic education',
    'hikmahsphere',
  ],
  siteLinks: [
    { name: 'Prayer Times', url: 'https://hikmahsphere.site/prayers' },
    { name: 'Qibla Compass', url: 'https://hikmahsphere.site/prayers/qibla' },
    { name: 'Quran Reader', url: 'https://hikmahsphere.site/quran' },
    { name: 'Tafsir e Quran', url: 'https://hikmahsphere.site/quran/tafsir' },
    { name: 'Dhikr & Dua', url: 'https://hikmahsphere.site/dhikr-dua' },
    { name: 'Zakat Calculator', url: 'https://hikmahsphere.site/zakat' },
    { name: 'Maktab', url: 'https://hikmahsphere.site/maktab' },
    { name: 'Community', url: 'https://hikmahsphere.site/community' },
    { name: 'Hajj Guide', url: 'https://hikmahsphere.site/hajj-guide' },
    { name: 'Salah Tracker', url: 'https://hikmahsphere.site/salah-tracker' },
  ],
} as const;

export const getHomeFeatures = (hasManagementAccess: boolean): HomeFeature[] => [
  {
    icon: '/Smart-Prayer-Times.png',
    title: 'Smart Prayer Times',
    path: '/prayers',
    description:
      'Ultra-precise prayer times with real-time geolocation, multiple calculation methods (MWL, ISNA, Umm al-Qura), astronomical corrections for high latitudes, and beautiful shareable prayer cards',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: '/Quran-Reader.png',
    title: 'Quran Reader',
    path: '/quran',
    description:
      'Read the complete Quran with Arabic text, translations, bookmarks, recitations, and seamless ayah navigation designed for daily study',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: '/Qibla-Compass.png',
    title: 'Qibla Compass',
    path: '/prayers/qibla',
    description:
      'Find Qibla direction with a live compass and map-assisted fallback so your prayer setup stays accurate wherever you are',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    gradient: 'from-cyan-500 to-sky-500',
  },
  {
    icon: '/mosque-find.png',
    title: 'Mosque Finder',
    path: '/prayers?tab=mosques',
    description:
      'Discover nearby mosques with distance, directions, and map support so you can join congregation wherever you travel',
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    gradient: 'from-sky-500 to-blue-500',
  },
  {
    icon: '/Tafsir.png',
    title: 'Tafsir e Quran',
    path: '/quran/tafsir',
    description:
      'Go deeper with ayah-by-ayah tafsir and translations to understand meaning, context, and practical lessons from the Quran',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    gradient: 'from-indigo-500 to-blue-500',
  },
  {
    icon: '/Zakat.png',
    title: hasManagementAccess ? 'Zakat Management' : 'Zakat Calculator',
    path: '/zakat',
    description: hasManagementAccess
      ? 'Complete Zakat dashboard with donor tracking, collection/spending records, real-time balance, donor leaderboards, and export capabilities for transparent fund management'
      : 'Intelligent Zakat calculator with live nisab rates, support for gold/silver/assets/crypto, 2.5% calculation, and multiple verified authentic source methodologies',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    gradient: 'from-yellow-500 to-amber-500',
  },
  {
    icon: '/maktab.png',
    title: 'Maktab Sponsorship',
    path: '/maktab',
    description:
      'Sponsor free Quran, Tajweed, Hifz, and Deen education for children who cannot afford fees — a growing HikmahSphere campaign for the Ummah’s next generation',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    gradient: 'from-indigo-500 to-violet-500',
  },
  {
    icon: '/Global-Community.png',
    title: 'Global Community',
    path: '/community',
    description:
      'Connect in forums, discover events, and grow through Islamic quiz games that make knowledge-building engaging for all ages',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    gradient: 'from-violet-500 to-fuchsia-500',
  },
  {
    icon: '/Tasbih.png',
    title: 'Dhikr & Dua',
    path: '/dhikr-dua',
    description:
      'Authentic daily duas and adhkar with Arabic, transliteration, English/Urdu translation, verified references, favorites, and a built-in online tasbih counter for daily remembrance',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    gradient: 'from-teal-500 to-emerald-500',
  },
  {
    icon: '/Hajj-guide.png',
    title: 'Hajj Guide',
    path: '/hajj-guide',
    description:
      'Prepare for pilgrimage with practical step-by-step Hajj guidance and essential ritual references in one guided experience',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    gradient: 'from-orange-500 to-amber-500',
  },
  {
    icon: '/salah.png',
    title: 'Muhasabah Tracker',
    path: '/salah-tracker',
    description:
      'A comprehensive daily Islamic habit tracker for your Prayers, Fasting, Quran reading, and daily Dhikr',
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    gradient: 'from-rose-500 to-pink-500',
  },
  {
    icon: '/AI-Scholar-Assistant.png',
    title: 'AI Assistant',
    description:
      'Islamic AI assistant for religious questions and guidance — powered by verified authentic source references',
    color: 'text-gray-400',
    bgColor: 'bg-gray-100',
    disabled: true,
    gradient: 'from-gray-400 to-gray-500',
  },
];

export const HOME_JSON_LD = {
  person: {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Ifrahuddin Azmi',
    alternateName: ['Ifrah Azmi', 'Ifrahuddin', 'Azmi', 'Ifrah A.', 'Ifrahuddin A.'],
    url: 'https://hikmahsphere.site',
    image: 'https://hikmahsphere.site/admin-pic.png',
    jobTitle: 'Lead Architect & Developer | Founder',
    worksFor: {
      '@type': 'Organization',
      name: 'HikmahSphere',
      url: 'https://hikmahsphere.site',
      sameAs: 'https://github.com/yani2298/HikmahSphere',
    },
    description:
      'Founder and Lead Developer of HikmahSphere - a unified Islamic digital platform serving the global Muslim community. Expert in React, Node.js, TypeScript, MongoDB, Python, AI/ML, and Islamic digital solutions.',
    sameAs: [
      'https://github.com/ifrahazmi',
      'https://www.linkedin.com/in/ifrahuddin-azmi-8869787a/',
      'https://twitter.com/ifrahazmi',
    ],
    knowsAbout: [
      'React.js',
      'Node.js',
      'TypeScript',
      'MongoDB',
      'Python',
      'Artificial Intelligence',
      'Machine Learning',
      'Test Automation',
      'System Architecture',
      'Islamic Studies',
      'Full-Stack Development',
      'Web Development',
    ],
    award: 'Developer of HikmahSphere Islamic Platform',
  },
  organization: {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'HikmahSphere',
    url: 'https://hikmahsphere.site',
    logo: {
      '@type': 'ImageObject',
      url: 'https://hikmahsphere.site/logo.png',
    },
    description:
      'A Unified Islamic Digital Platform for the global Muslim community - providing prayer times, Quran reader, Dhikr & Dua, Zakat calculator, Maktab sponsorship, and community features',
    founder: {
      '@type': 'Person',
      name: 'Ifrahuddin Azmi',
      url: 'https://hikmahsphere.site/about',
      sameAs: [
        'https://github.com/ifrahazmi',
        'https://www.linkedin.com/in/ifrahuddin-azmi-8869787a/',
      ],
    },
    sameAs: ['https://github.com/yani2298/HikmahSphere'],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'ifrahazmi@hikmahsphere.site',
      contactType: 'developer',
      availableLanguage: ['English', 'Urdu', 'Hindi', 'Arabic'],
    },
    areaServed: {
      '@type': 'Country',
      name: 'Worldwide',
    },
  },
  software: {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'HikmahSphere',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web, Android, iOS',
    url: 'https://hikmahsphere.site',
    description: HOME_SEO.description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'Prayer Times',
      'Qibla Compass',
      'Mosque Finder',
      'Quran Reader',
      'Tafsir e Quran',
      'Dhikr & Dua',
      'Zakat Calculator',
      'Maktab Sponsorship',
      'Community & Islamic Quizzes',
      'Hajj Guide',
    ],
  },
  faq: {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOME_FAQ.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  },
} as const;
