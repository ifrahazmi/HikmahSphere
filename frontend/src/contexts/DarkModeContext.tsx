import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface DarkModeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

// Key bumped from 'hikmah-dark-mode' so any value that the old code auto-saved
// from the device's system theme is discarded and everyone resets to light.
const DARK_MODE_KEY = 'hikmah-theme';

export const DarkModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    // Only honour an explicit, previously-saved user choice.
    try {
      const saved = localStorage.getItem(DARK_MODE_KEY);
      if (saved !== null) {
        return JSON.parse(saved) === true;
      }
    } catch {
      // Ignore malformed storage values.
    }

    // Default to light. Intentionally do NOT follow the OS/system theme —
    // the app is light by default unless the user explicitly turns dark on.
    return false;
  });

  // Apply dark mode to HTML element
  useEffect(() => {
    const htmlElement = document.documentElement;
    if (isDarkMode) {
      htmlElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      htmlElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
    localStorage.setItem(DARK_MODE_KEY, JSON.stringify(isDarkMode));
    console.log('[DarkMode]', isDarkMode ? 'Dark mode enabled' : 'Light mode enabled');
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const setDarkMode = (isDark: boolean) => {
    setIsDarkMode(isDark);
  };

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode, setDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
};

export const useDarkMode = (): DarkModeContextType => {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within DarkModeProvider');
  }
  return context;
};
