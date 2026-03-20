import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EID_DATE = new Date("2026-03-21T00:00:00");
const RAMADAN_POPUP_SESSION_KEY = "ramadanEliteShown";
const EID_POPUP_SESSION_KEY = "eidMubarakShown";

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

const EidMubarakCard = ({ visible, setVisible, darkMode, lang, toggleSound, soundOn, audioRef }) => {
  const text = {
    en: {
      title: "Eid Mubarak 🌙",
      greeting: "To you and your family from the HikmahSphere family.",
      dua: "May Allah's blessings be with you today, tomorrow, and always. May He accept our fasts and prayers.",
      continue: "Continue to Website",
    },
    ar: {
      title: "عيد مبارك",
      greeting: "لكم ولعائلتكم من عائلة HikmahSphere.",
      dua: "تقبل الله منا ومنكم صالح الأعمال. عيدكم مبارك.",
      continue: "دخول الموقع",
    },
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md 
        ${darkMode ? "bg-black/80" : "bg-gray-800/60"}`}
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
          bg-gradient-to-br from-green-800 via-teal-700 to-green-800 text-white`}
        >
          {/* Crescent Moon Background */}
          <div className="absolute top-[-50px] left-[-50px] w-48 h-48 text-white/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm-2.5-4.5a.5.5 0 0 1 0-1h5a.5.5 0 0 1 0 1zm-2-4a.5.5 0 0 1 0-1h9a.5.5 0 0 1 0 1zm2-4a.5.5 0 0 1 0-1h5a.5.5 0 0 1 0 1z" />
            </svg>
          </div>

          <button
            onClick={() => setVisible(false)}
            className="absolute top-4 right-4 text-2xl hover:scale-110 transition-transform"
            aria-label="Close"
          >
            ✕
          </button>

          {lang === "ar" ? (
            <div className="mb-3 flex items-center justify-center gap-2 text-yellow-300" dir="rtl">
              <span className="eid-arabic-text text-[2rem] sm:text-[2.35rem]">
                {text.ar.title}
              </span>
              <span className="shrink-0 text-2xl leading-none sm:text-3xl" aria-hidden="true">🌙</span>
            </div>
          ) : (
            <h1 className="text-4xl font-extrabold mb-3 text-center text-yellow-300" dir="ltr">
              {text.en.title}
            </h1>
          )}

          <div className="mb-5 rounded-2xl border border-white/20 bg-white/10 px-4 py-4 text-center shadow-inner">
            <div className="flex items-center justify-center gap-2 text-yellow-100" dir="rtl">
              <span className="eid-arabic-text text-[2rem] sm:text-[2.3rem]">
                عيد مبارك
              </span>
              <span className="shrink-0 text-2xl leading-none sm:text-3xl" aria-hidden="true">🌙</span>
            </div>
            <p className="eid-arabic-text mt-1 text-[1.6rem] text-white sm:text-[1.9rem]" dir="rtl">
              تقبل الله منا ومنكم.
            </p>
          </div>

          <p className="text-center text-lg mb-5" dir={lang === "ar" ? "rtl" : "ltr"}>
            {text[lang].greeting}
          </p>
          <p className="text-center font-semibold text-xl mb-6 bg-white/10 p-3 rounded-lg" dir={lang === "ar" ? "rtl" : "ltr"}>
            {text[lang].dua}
          </p>

          <div className="flex flex-col gap-3 items-center relative z-10">
            <button
              onClick={() => setVisible(false)}
              className="px-8 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black rounded-full font-semibold hover:scale-105 transition-transform shadow-lg"
            >
              {text[lang].continue}
            </button>
          </div>

          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(30)].map((_, i) => (
              <motion.span
                key={i}
                className="absolute w-1.5 h-1.5 bg-yellow-200 rounded-full"
                initial={{ y: -20, x: Math.random() * 400 - 200, opacity: 0 }}
                animate={{ y: 400, opacity: [0, 1, 0] }}
                transition={{
                  duration: Math.random() * 5 + 5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default function RamadanElitePopup() {
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0 });
  const [darkMode, setDarkMode] = useState(false);
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [soundOn, setSoundOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isEidDay, setIsEidDay] = useState(false);

  useEffect(() => {
    const syncOccasionPopup = () => {
      const reachedEid = Date.now() >= EID_DATE.getTime();
      setIsEidDay(reachedEid);

      const storageKey = reachedEid ? EID_POPUP_SESSION_KEY : RAMADAN_POPUP_SESSION_KEY;
      if (!sessionStorage.getItem(storageKey)) {
        setVisible(true);
        sessionStorage.setItem(storageKey, "true");
      }
    };

    const initialTimer = window.setTimeout(syncOccasionPopup, 1000);
    const occasionWatcher = window.setInterval(syncOccasionPopup, 30 * 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(occasionWatcher);
    };
  }, []);
  
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

  if (isEidDay) {
    return (
      <EidMubarakCard
        visible={visible}
        setVisible={setVisible}
        darkMode={darkMode}
        lang={lang}
        toggleSound={toggleSound}
        soundOn={soundOn}
        audioRef={audioRef}
      />
    );
  }

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
