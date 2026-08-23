import {
  ShieldCheckIcon,
  HeartIcon,
  LockClosedIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { BookOpen, Bot, Globe } from 'lucide-react';

// About Page Content Data

export interface SpiritualFeature {
  id?: string;
  icon: any;
  title: string;
  description: string;
  path?: string;
  color?: string;
  bgColor?: string;
  image?: string;
  disabled?: boolean;
}

export interface Pillar {
  id?: string;
  icon: string;
  title: string;
  description: string;
  image?: string;
}

export interface TimelineItem {
  phase: string;
  title: string;
  description: string;
  status: 'completed' | 'in-progress' | 'planned';
  icon?: any;
  period?: string;
  features?: string[];
}

// Alias for backwards compatibility
export type TimelinePhase = TimelineItem;

export interface Developer {
  id?: string;
  name: string;
  role: string;
  avatar?: string;
  image?: string;
  bio: string;
  expertise?: string[];
  social?: {
    github?: string;
    linkedin?: string;
    twitter?: string;
  };
}

export const heroContent = {
  title: "HikmahSphere",
  headline: "Guiding the Ummah in the Digital Age",
  subtitle: "Where timeless Islamic wisdom meets intelligent technology",
  subheadline: "Where timeless Islamic wisdom meets intelligent technology",
  cta: "Begin Your Journey",
  description: "A comprehensive platform designed to empower every Muslim with instant access to authentic Islamic knowledge, fostering a global community united by correct understanding and practice."
};

export const missionStatement = {
  title: "Our Mission",
  text: "To empower every Muslim with instant access to authentic Islamic knowledge, fostering a global community united by correct understanding and practice."
};

export const pillars: Pillar[] = [
  {
    icon: "/Authenticity.png",
    title: "Authenticity",
    description: "Every answer rooted in Quran and authentic Sunnah, reviewed against verified authentic source references"
  },
  {
    icon: "/Accessibility.png",
    title: "Accessibility",
    description: "Breaking barriers of language, geography, and time zones to serve all Muslims"
  },
  {
    icon: "/Community.png",
    title: "Community",
    description: "Connecting hearts across borders while preserving local identities and values"
  }
];

export const timeline: TimelineItem[] = [
  {
    phase: "Phase 1",
    title: "The Foundation (Current)",
    description: "Essential tools accompanying you from Fajr to Isha. Your daily Islamic companion.",
    status: "completed",
    icon: BookOpen,
    period: "Q1 2026",
    features: [
      "Accurate Prayer Times with Notifications",
      "Qibla Compass for Accurate Direction",
      "Quran Text with Tafsir and Translations",
      "Dhikr & Dua Library with Tasbih Counter",
      "Step-by-Step Hajj Guide",
      "Zakat Calculator & Management",
      "Community Connection Hub with Islamic Quiz Games"
    ]
  },
  {
    phase: "Phase 2",
    title: "The Assistant (Coming)",
    description: "AI assistant providing instant access to reliable Islamic guidance and fatwa from verified authentic source references.",
    status: "in-progress",
    icon: Bot,
    period: "Q2 2026",
    features: [
      "AI-Powered Fatwa Assistant",
      "Instant Islamic Guidance",
      "Verified Authentic Source Answers",
      "Du'a Collections & Translations",
      "Enhanced Community Forums"
    ]
  },
  {
    phase: "Phase 3",
    title: "The Vision (Future)",
    description: "Complete Islamic lifecycle support - from daily practice to major milestones.",
    status: "planned",
    icon: Globe,
    period: "Q3 2026+",
    features: [
      "Virtual Hajj Preparation Course",
      "Islamic Finance & Investment Tools",
      "Family Lineage & Legacy Tracking",
      "Multilingual Support",
      "Advanced Community Features"
    ]
  }
];

export const approachPillars: Pillar[] = [
  {
    icon: "/Authenticity.png",
    title: "Quran & Sunnah",
    description: "Every answer rooted in Quran and the authentic teachings of the Prophet ﷺ through verified Sunnah."
  },
  {
    icon: "🎓",
    title: "Authenticity Oversight",
    description: "Partner with recognized Islamic institutions and verified authentic source references for trustworthy verification."
  },
  {
    icon: "/Transparency.png",
    title: "Transparency",
    description: "Every ruling shows its evidence and verified authentic source reasoning for your understanding and verification."
  },
  {
    icon: "/Unity-in-Diversity.png",
    title: "Unity in Diversity",
    description: "Respect valid interpretive differences while staying firmly rooted in Ahl al-Sunnah wal-Jama'ah."
  },
  {
    icon: "/Accessibility.png",
    title: "Accessibility & Inclusivity",
    description: "Islamic knowledge without barriers. For everyone, regardless of language, location, education level, or background."
  },
  {
    icon: "/gentleness.png",
    title: "Compassion & Gentleness",
    description: "Guidance delivered with mercy (Rahmah), respecting human struggles and following the Prophet's gentle approach to teaching."
  }
];

export const spiritualFeatures: SpiritualFeature[] = [
  {
    icon: "/Smart-Prayer-Times.png",
    title: "Smart Prayer Times",
    path: "/prayers",
    description: "Never miss the connection with your Lord. Ultra-precise daily calculations with real-time geolocation, multiple verified methods, high-latitude adjustments, and Ramadan schedule support."
  },
  {
    icon: "/Quran-Reader.png",
    title: "Quran Reader",
    path: "/quran",
    description: "Read all 114 Surahs with Arabic text, audio recitation, bookmarks, and smooth navigation designed for focused daily recitation and revision."
  },
  {
    icon: "/Qibla-Compass.png",
    title: "Qibla Compass",
    path: "/prayers/qibla",
    description: "Confirm Qibla direction with a live compass and map-supported fallback guidance for better confidence while traveling or praying in new locations."
  },
  {
    icon: "/mosque-find.png",
    title: "Mosque Finder",
    path: "/prayers?tab=mosques",
    description: "Discover nearby mosques with distance, directions, and map support so you can join the congregation wherever life takes you."
  },
  {
    icon: "/Tafsir.png",
    title: "Tafsir e Quran",
    path: "/quran/tafsir",
    description: "Study Quran text with Tafsir and translations in one place so recitation, understanding, and reflection remain connected."
  },
  {
    icon: "/Zakat.png",
    title: "Zakat Management",
    path: "/zakat",
    description: "Purify your wealth with confidence. Complete dashboard for Zakat collection and distribution, donor tracking, real-time balance, leaderboards, and transparent fund management with export capabilities."
  },
  {
    icon: "/maktab.png",
    title: "Maktab Sponsorship",
    path: "/maktab",
    description: "Turn your giving into sadaqah jariyah. Sponsor free Quran, Tajweed, Hifz, and Deen education for children who cannot afford fees — a growing campaign for the Ummah's next generation."
  },
  {
    icon: "/Global-Community.png",
    title: "Global Community",
    path: "/community",
    description: "Find your brothers and sisters across continents through forums, events, beneficial discussions, and Islamic quiz games that make learning interactive."
  },
  {
    icon: "/Tasbih.png",
    title: "Dhikr & Dua",
    path: "/dhikr-dua",
    description: "Keep your heart connected to Allah throughout the day. Access authentic daily duas and adhkar with Arabic text, transliteration, English/Urdu translation, full hadith references, bookmarks, and a focused online tasbih counter."
  },
  {
    icon: "/Hajj-guide.png",
    title: "Hajj Guide",
    path: "/hajj-guide",
    description: "Prepare for pilgrimage with practical, step-by-step Hajj guidance to help you review essential rituals and sequence with confidence."
  },
  {
    icon: "/salah.png",
    title: "Muhasabah Tracker",
    path: "/salah-tracker",
    description: "A comprehensive daily Islamic habit tracker to keep yourself accountable for your Prayers, Fasting, Quran reading, and daily Dhikr."
  },
  {
    icon: "/AI-Scholar-Assistant.png",
    title: "AI Assistant",
    description: "Islamic AI assistant for religious questions and guidance",
    disabled: true,
    color: "text-gray-400",
    bgColor: "bg-gray-100"
  }
];

export const maktabSection = {
  eyebrow: "HikmahSphere Maktab",
  heading: "Knowledge that keeps giving",
  lead:
    "Part of our mission is making sure no child is turned away from learning their Deen because of money. HikmahSphere Maktab funds free Islamic education for children in need — a form of sadaqah jariyah whose reward continues long after the lesson ends.",
  highlights: [
    "Free Quran & Tajweed classes",
    "Hifz pathway support",
    "Deen, Hadith & Islamic culture",
    "Books & classroom needs"
  ],
  primaryCta: { label: "Donate / Sponsor", path: "/maktab#sponsor" },
  secondaryCta: { label: "Learn about Maktab", path: "/maktab" }
};

export const promises = [
  {
    id: 'privacy',
    icon: LockClosedIcon,
    title: 'Privacy as Amanah',
    description: 'Your data is protected as a sacred trust. We never sell your information or share it without your consent.',
    color: 'text-emerald-600'
  },
  {
    id: 'authentic',
    icon: ShieldCheckIcon,
    title: 'Verified Authentic Source Content',
    description: 'All Islamic content is validated using verified authentic source references and rooted in authentic Quran and Sunnah.',
    color: 'text-blue-600'
  },
  {
    id: 'clean',
    icon: SparklesIcon,
    title: 'Sacred Space',
    description: 'No distracting ads that interrupt your ibadah. A clean, reverent platform for spiritual growth.',
    color: 'text-purple-600'
  },
  {
    id: 'community',
    icon: HeartIcon,
    title: 'Community Moderation',
    description: 'Content moderation by Muslims who understand and respect the sanctity of our platform.',
    color: 'text-rose-600'
  }
];

export const journeyOptions = [
  {
    icon: '/Quraan-JTJ.png',
    title: "Explore Quran's Wisdom",
    description: "Start your spiritual journey with the words of Allah in your own language",
    buttonText: "Read Quran",
    buttonAction: "/quran"
  },
  {
    icon: '/Prayer-JTJ.png',
    title: "Connect with Prayer",
    description: "Never miss your connection to Allah. Get accurate prayers times for your location",
    buttonText: "Prayer Times",
    buttonAction: "/prayers"
  },
  {
    icon: '/Comminity-JTJ.png',
    title: "Join Our Ummah",
    description: "Connect with millions of Muslims worldwide. Share, learn, and grow together",
    buttonText: "Join Community",
    buttonAction: "/community"
  }
];

export const storyContent = {
  title: "Our Story",
  headline: "Our Story: The Why",
  text: "Muslims navigating modern life without accessible, authentic guidance. Built by Muslims, for Muslims — to bridge the gap between tradition and technology. HikmahSphere brings together the timeless wisdom of Islam with intelligent, modern tools to empower your spiritual journey.",
  problemStatement: "Muslims navigating modern life without accessible, authentic guidance",
  originStory: [
    "Recognizing the gap between Muslims and their faith in our fast-paced world, we set out to build something different.",
    "Not another app. A digital companion that respects your time, protects your data, and connects you to authentic Islamic knowledge.",
    "HikmahSphere: Where Hikmah (wisdom) meets Sphere (a unified, global community)."
  ],
  nameExplanation: {
    hikma: {
      title: "Hikmah (حكمة)",
      meaning: "Wisdom - The divine knowledge and understanding that guides our actions and decisions according to Quran and Sunnah."
    },
    sphere: {
      title: "Sphere",
      meaning: "A complete, all-encompassing circle - representing our unified global community of Muslims, transcending borders and timezones."
    }
  }
};

export const footerQuote = {
  arabic: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
  translation: "The best of you are those who learn the Quran and teach it.",
  reference: "Hadith - Tirmidhi",
  hadith: "The best of you are those who learn the Quran and teach it. ~ Prophet Muhammad ﷺ"
};

export const developers: Developer[] = [
  {
    id: 'ifrah',
    name: "Ifrahuddin Azmi",
    role: "Lead Architect & Developer | MD | Automation Engineer | AI/ML Engineer",
    bio: "Visionary technologist with 5+ years of experience architecting scalable Islamic digital solutions. Combines expertise in full-stack development, test automation, and machine learning to bridge modern technology with timeless spiritual values.",
    expertise: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'Python', 'AI/ML', 'Test Automation', 'System Architecture', 'Islamic Studies'],
    image: '/admin-pic.png',
    social: {
      github: 'https://github.com/ifrahazmi',
      linkedin: 'https://www.linkedin.com/in/ifrahuddin-azmi-8869787a/',
      twitter: 'https://twitter.com/ifrahazmi'
    }
  },
  {
    id: 'zafia',
    name: "Zafia Chowdhury",
    role: "Creative Director | Content Reviewer & QA",
    bio: "Cyber Security graduate with a passion for creating safe and beautiful digital experiences. Provides creative direction, design insights, and quality assurance to ensure HikmahSphere serves Ummah with excellence. Her expertise in security ensures user data protection while her creative vision shapes the platform's aesthetic appeal.",
    expertise: ['Creative Direction', 'Content Review', 'Quality Assurance', 'Cyber Security', 'User Experience', 'Design Systems', 'Security & Privacy',],
    image: '/zafia.png',
    social: {
      github: 'https://github.com/ifrahazmi/HikmahSphere'
    }
  }
];

const aboutContent = {
  heroContent,
  missionStatement,
  pillars,
  timeline,
  approachPillars,
  spiritualFeatures,
  promises,
  journeyOptions,
  storyContent,
  footerQuote,
  developers
};

export default aboutContent;

// Extend storyContent with additional properties
export const extendedStoryContent = {
  ...storyContent,
  problemStatement: "Muslims navigating modern life without accessible, authentic guidance",
  originStory: [
    "Recognizing the gap between Muslims and their faith in our fast-paced world, we set out to build something different.",
    "Not another app. A digital companion that respects your time, protects your data, and connects you to authentic Islamic knowledge.",
    "HikmahSphere: Where Hikmah (wisdom) meets Sphere (a unified, global community)."
  ]
};
