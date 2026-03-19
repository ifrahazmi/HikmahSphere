import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EID_DATE = new Date("2026-03-20T00:00:00"); // Adjust yearly

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
}

interface LanguageText {
  title: string;
  message: string;
  countdown: string;
  continue: string;
  muteSound: string;
  playSound: string;
}

export default function RamadanElitePopup() {
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0 });
  const [darkMode, setDarkMode] = useState(false);
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [soundOn, setSoundOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Detect Language
  useEffect(() => {
    const browserLang = navigator.language;
    if (browserLang.startsWith("ar")) setLang("ar");
  }, []);

  // Auto Dark Mode
  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkMode(prefersDark);
  }, []);

  // Show Once Per Session
  useEffect(() => {
    if (!sessionStorage.getItem("ramadanEliteShown")) {
      setTimeout(() => setVisible(true), 1000);
      sessionStorage.setItem("ramadanEliteShown", "true");
    }
  }, []);

  // Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      const diff = EID_DATE.getTime() - new Date().getTime();
      if (diff > 0) {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / 1000 / 60) % 60),
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sound Control
  const toggleSound = () => {
    if (!audioRef.current) return;
    if (soundOn) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setSoundOn(!soundOn);
  };

  const text: Record<"en" | "ar", LanguageText> = useMemo(() => ({
    en: {
      title: "Ramadan Mubarak 🌙",
      message:
        "May this sacred month illuminate your heart with faith and fill your life with peace and prosperity.",
      countdown: "Eid Countdown",
      continue: "Enter Website",
      muteSound: "Mute Sound",
      playSound: "Play Ambient Sound",
    },
    ar: {
      title: "رمضان مبارك 🌙",
      message:
        "نسأل الله أن يملأ قلوبكم نورًا وإيمانًا ويمنحكم السلام والبركة في هذا الشهر الكريم.",
      countdown: "العد التنازلي للعيد",
      continue: "دخول الموقع",
      muteSound: "كتم الصوت",
      playSound: "تشغيل الصوت",
    },
  }), []);

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md 
        ${darkMode ? "bg-black/70" : "bg-black/40"}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.6 }}
          className={`relative w-[90%] max-w-lg rounded-2xl p-8 shadow-2xl overflow-hidden
          ${darkMode 
            ? "bg-gradient-to-br from-emerald-900 to-emerald-700 text-white" 
            : "bg-white text-gray-800"}`}
        >
          {/* Mosque Background */}
          <div className="absolute bottom-0 left-0 w-full opacity-10">
            <svg viewBox="0 0 800 200" fill="currentColor" className="w-full h-32">
              <path d="M0 150 Q200 50 400 150 T800 150 V200 H0 Z" />
            </svg>
          </div>

          {/* Close */}
          <button
            onClick={() => setVisible(false)}
            className="absolute top-4 right-4 text-2xl hover:scale-110 transition-transform"
            aria-label="Close"
          >
            ✕
          </button>

          {/* Title */}
          <h1 className="text-3xl font-bold mb-4 text-center" dir={lang === "ar" ? "rtl" : "ltr"}>
            {text[lang].title}
          </h1>

          {/* Message */}
          <p className="text-center mb-6 leading-relaxed" dir={lang === "ar" ? "rtl" : "ltr"}>
            {text[lang].message}
          </p>

          {/* Countdown */}
          <div className="text-center mb-6">
            <h3 className="font-semibold mb-2">{text[lang].countdown}</h3>
            <div className="flex justify-center gap-4 text-2xl font-bold">
              <div className="bg-white/20 px-4 py-2 rounded-lg">
                {String(timeLeft.days).padStart(2, "0")}d
              </div>
              <div className="bg-white/20 px-4 py-2 rounded-lg">
                {String(timeLeft.hours).padStart(2, "0")}h
              </div>
              <div className="bg-white/20 px-4 py-2 rounded-lg">
                {String(timeLeft.minutes).padStart(2, "0")}m
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3 items-center relative z-10">
            <button
              onClick={() => setVisible(false)}
              className="px-8 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black rounded-full font-semibold hover:scale-105 transition-transform shadow-lg"
            >
              {text[lang].continue}
            </button>

            <button
              onClick={toggleSound}
              className="text-sm underline hover:text-yellow-400 transition-colors"
            >
              {soundOn ? text[lang].muteSound : text[lang].playSound}
            </button>
          </div>

          {/* Audio */}
          <audio
            ref={audioRef}
            loop
            src="/ramadan-ambient.mp3"
          />

          {/* Star Particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <motion.span
                key={i}
                className="absolute w-1 h-1 bg-yellow-300 rounded-full"
                initial={{ y: -10, opacity: 0 }}
                animate={{
                  y: 300,
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
                style={{ left: `${Math.random() * 100}%` }}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
