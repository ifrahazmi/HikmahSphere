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
    description: "Every answer rooted in Quran and authentic Sunnah, reviewed by qualified scholars"
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
      "Complete Quran Reader & Audio",
      "Qibla Finder with AR",
      "Zakat Calculator & Management",
      "Community Connection Hub"
    ]
  },
  {
    phase: "Phase 2",
    title: "The Assistant (Coming)",
    description: "AI Scholar assistant providing instant access to reliable Islamic guidance and fatwa.",
    status: "in-progress",
    icon: Bot,
    period: "Q2 2026",
    features: [
      "AI-Powered Fatwa Assistant",
      "Instant Islamic Guidance",
      "Scholar-Verified Answers",
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
    title: "Scholarly Oversight",
    description: "Partner with recognized Islamic institutions and qualified scholars for authentic verification."
  },
  {
    icon: "/Transparency.png",
    title: "Transparency",
    description: "Every ruling shows its evidence and scholarly reasoning for your understanding and verification."
  },
  {
    icon: "/Unity-in-Diversity.png",
    title: "Unity in Diversity",
    description: "Respect valid scholarly differences while staying firmly rooted in Ahl al-Sunnah wal-Jama'ah."
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
    description: "Never miss the connection with your Lord. Ultra-precise calculations with real-time geolocation, multiple scholarly methods (MWL, ISNA, Umm al-Qura), high latitude corrections, and beautiful shareable prayer cards."
  },
  {
    icon: "/Quran-Reader.png",
    title: "Quran Reader",
    description: "Understand His words in your language. Complete 114 Surahs with 10+ translations, semantic AI search, audio recitations, bookmarks, Indopak script, and seamless navigation that transforms your reading experience."
  },
  {
    icon: "/Zakat.png",
    title: "Zakat Management",
    description: "Purify your wealth with confidence. Complete dashboard for Zakat collection and distribution, donor tracking, real-time balance, leaderboards, and transparent fund management with export capabilities."
  },
  {
    icon: "/Global-Community.png",
    title: "Global Community",
    description: "Find your brothers and sisters across continents. Connect through forums, discover local events, join meaningful discussions, and strengthen the bonds of Islamic brotherhood worldwide."
  },
  {
    icon: "/Qibla-Finder-AR.png",
    title: "Qibla Finder AR",
    description: "Face the House of Allah with confidence. Augmented reality guidance, 3D compass, precise geolocation calculations, and visual overlay showing the exact direction to the Kaaba from anywhere on Earth."
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
    title: 'Scholar-Verified Content',
    description: 'All Islamic content is reviewed by qualified scholars and rooted in authentic Quran and Sunnah.',
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
    id: 'hiring',
    name: "We Are Hiring!",
    role: "Full Stack Developer / Project Manager",
    bio: "Join our team! We're looking for talented developers to help manage and improve HikmahSphere. Work on database optimization, lead the complete Zakat management system, and shape the future of Islamic technology.",
    expertise: ['Full Stack Development', 'Database Management', 'Project Leadership', 'MongoDB', 'React & Node.js'],
    image: '/Coming-Soon.png',
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
