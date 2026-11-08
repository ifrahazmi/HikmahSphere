import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDarkMode } from '../contexts/DarkModeContext';
import NotificationBell from './Notifications/NotificationBell'; // Import the new NotificationBell
import SettingsModal from './SettingsModal';
import toast from 'react-hot-toast';
import {
  Bars3Icon,
  XMarkIcon,
  UserIcon,
  ChevronDownIcon,
  CalendarDaysIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

interface NavbarProps {
  user?: any;
}

const APP_VERSION_LABEL = `v1.1.0 ${process.env.NODE_ENV === 'production' ? 'Prod' : 'Dev'}`;

const Navbar: React.FC<NavbarProps> = ({ user: propUser }) => {
  const { user: authUser, logout, hasRole } = useAuth();
  const { isDarkMode } = useDarkMode();
  const user = propUser || authUser;
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPrayerMenuOpen, setIsPrayerMenuOpen] = useState(false);
  const [isQuranMenuOpen, setIsQuranMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const prayerDesktopMenuRef = useRef<HTMLDivElement>(null);
  const prayerMobileMenuRef = useRef<HTMLDivElement>(null);
  const quranDesktopMenuRef = useRef<HTMLDivElement>(null);
  const quranMobileMenuRef = useRef<HTMLDivElement>(null);

  const goToPrayerPage = (path: string) => {
    navigate(path);
    setIsPrayerMenuOpen(false);
    setIsQuranMenuOpen(false);
    setIsOpen(false);
  };

  const goToQuranPage = (path: string) => {
    navigate(path);
    setIsQuranMenuOpen(false);
    setIsOpen(false);
  };

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsPrayerMenuOpen(false);
    setIsQuranMenuOpen(false);
    setIsOpen(false);
    setIsProfileOpen(false);
    setIsToolsOpen(false);
    setIsMobileToolsOpen(false);
  }, [location.pathname]);

  // Check if we're on Quran page and get theme from localStorage
  const [quranTheme, setQuranTheme] = useState<'light' | 'dark'>('light');
  const isQuranPage = location.pathname.startsWith('/quran');
  const [qiblaTheme, setQiblaTheme] = useState<'light' | 'dark'>('light');
  const isQiblaPage = location.pathname === '/prayers/qibla';

  useEffect(() => {
    const updateTheme = () => {
      const savedSettings = localStorage.getItem('quranSettings');
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          setQuranTheme(settings.theme || 'light');
        } catch (e) {
          setQuranTheme('light');
        }
      } else {
        setQuranTheme('light');
      }

      const savedQiblaTheme = localStorage.getItem('qiblaTheme');
      setQiblaTheme(savedQiblaTheme === 'dark' ? 'dark' : 'light');
    };

    updateTheme();

    const handleStorageChange = () => {
      updateTheme();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('quranSettingsChanged', handleStorageChange);
    window.addEventListener('qiblaThemeChanged', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('quranSettingsChanged', handleStorageChange);
      window.removeEventListener('qiblaThemeChanged', handleStorageChange);
    };
  }, []);

  const navigation = [
    { name: 'Home', href: '/', current: location.pathname === '/' },
    { name: 'About', href: '/about', current: location.pathname === '/about' },
    { name: 'Prayer', href: '/prayers', current: location.pathname.startsWith('/prayers') },
    { name: 'Dhikr & Dua', href: '/dhikr-dua', current: location.pathname === '/dhikr-dua' },
    { name: 'Quran', href: '/quran', current: location.pathname.startsWith('/quran') },
    { name: 'Zakat', href: '/zakat', current: location.pathname === '/zakat' },
    { name: 'Maktab', href: '/maktab', current: location.pathname === '/maktab' },
    { name: 'Community', href: '/community', current: location.pathname === '/community' },
    { name: 'Hajj Guide', href: '/hajj-guide', current: location.pathname === '/hajj-guide' },
    { name: 'Contact', href: '/contact', current: location.pathname === '/contact' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsOpen(false);
    setIsProfileOpen(false);
    setIsToolsOpen(false);
    setIsMobileToolsOpen(false);
  };

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
        setIsToolsOpen(false);
      }

      const clickedInsideDesktopPrayer = prayerDesktopMenuRef.current?.contains(event.target as Node);
      const clickedInsideMobilePrayer = prayerMobileMenuRef.current?.contains(event.target as Node);
      const clickedInsideDesktopQuran = quranDesktopMenuRef.current?.contains(event.target as Node);
      const clickedInsideMobileQuran = quranMobileMenuRef.current?.contains(event.target as Node);

      if (!clickedInsideDesktopPrayer && !clickedInsideMobilePrayer) {
        setIsPrayerMenuOpen(false);
      }

      if (!clickedInsideDesktopQuran && !clickedInsideMobileQuran) {
        setIsQuranMenuOpen(false);
      }
    };

    if (isProfileOpen || isPrayerMenuOpen || isQuranMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen, isPrayerMenuOpen, isQuranMenuOpen]);

  // Lock body scroll and listen for Escape key when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setIsOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen]);

  // Check for Super Admin Role
  const isSuperAdmin = hasRole && hasRole(['superadmin']);
  // Super Admins get the full dashboard; Managers get Fund Management only.
  const canAccessDashboard = hasRole && hasRole(['superadmin', 'manager']);

  // Determine if we should use dark mode
  const isDark = (isQuranPage && quranTheme === 'dark') || (isQiblaPage && qiblaTheme === 'dark');

  return (
    <>
      {/* Mobile Menu Backdrop: completely blurs the background in mobile mode only */}
      {isOpen && (
        <div
          data-testid="mobile-menu-backdrop"
          className="xl:hidden fixed inset-0 top-16 bg-black/60 backdrop-blur-2xl z-40 transition-opacity duration-200"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
      <nav className={`shadow-lg fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ${
        isDark ? 'bg-gray-800/95 backdrop-blur-md' : 'bg-white/95 backdrop-blur-md'
      }`}>
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-2 min-w-0">
          {/* Natural width only: a growing brand would starve the centered menu,
              whose nowrap items would then spill over the action icons. */}
          <div className="flex items-center min-w-0 shrink">
            <Link to="/" className="flex items-center min-w-0 max-w-full">
              <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 xl:w-11 xl:h-11 2xl:w-12 2xl:h-12 flex items-center justify-center overflow-hidden rounded-full bg-white shrink-0">
                <img src="/logo.png" alt="HikmahSphere Logo" className="h-full w-full object-cover" />
              </div>
              {/* Stacked so the badge costs no extra width, and short enough to keep the h-16 bar */}
              <div className="ml-2 flex flex-col justify-center min-w-0">
                <span className={`text-sm sm:text-base md:text-lg xl:text-xl 2xl:text-2xl font-bold leading-tight truncate ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>HikmahSphere</span>
                <span className={`self-start inline-flex text-[8px] xl:text-[9px] font-semibold leading-none px-1.5 py-0.5 rounded-full ${
                  isDark
                    ? 'bg-emerald-900 text-emerald-300'
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {APP_VERSION_LABEL}
                </span>
              </div>
            </Link>
          </div>

          {/* Full nav from xl up — lg was too tight after adding Maktab */}
          <div className="hidden xl:flex flex-1 items-center justify-center gap-0.5 2xl:gap-1.5 min-w-0">
            {navigation.map((item) => {
              if (item.name === 'Prayer') {
                return (
                  <div key={item.name} className="relative" ref={prayerDesktopMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsPrayerMenuOpen((prev) => !prev)}
                      className={`px-1.5 2xl:px-2.5 py-2 rounded-md text-xs xl:text-[13px] 2xl:text-sm font-medium whitespace-nowrap transition-colors duration-200 inline-flex items-center gap-0.5 ${
                        item.current
                          ? isDark
                            ? 'bg-emerald-900 text-emerald-300'
                            : 'bg-emerald-100 text-emerald-700'
                          : isDark
                          ? 'text-gray-300 hover:text-emerald-400 hover:bg-gray-700'
                          : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      {item.name}
                      <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${isPrayerMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isPrayerMenuOpen && (
                      <div className={`absolute left-0 mt-2 w-52 rounded-md shadow-lg py-1 z-50 ${isDark ? 'bg-gray-700' : 'bg-white'}`}>
                        <button
                          type="button"
                          onClick={() => goToPrayerPage('/prayers')}
                          className={`block w-full px-4 py-2 text-left text-sm ${
                            isDark
                              ? 'text-gray-200 hover:bg-gray-600'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          Prayer Times
                        </button>
                        <button
                          type="button"
                          onClick={() => goToPrayerPage('/prayers/qibla')}
                          className={`block w-full px-4 py-2 text-left text-sm ${
                            isDark
                              ? 'text-gray-200 hover:bg-gray-600'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          Qibla Direction
                        </button>
                        <button
                          type="button"
                          onClick={() => goToPrayerPage('/prayers?tab=mosques')}
                          className={`block w-full px-4 py-2 text-left text-sm ${
                            isDark
                              ? 'text-gray-200 hover:bg-gray-600'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          Find Mosque
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              if (item.name === 'Quran') {
                return (
                  <div key={item.name} className="relative" ref={quranDesktopMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsQuranMenuOpen((prev) => !prev)}
                      className={`px-1.5 2xl:px-2.5 py-2 rounded-md text-xs xl:text-[13px] 2xl:text-sm font-medium whitespace-nowrap transition-colors duration-200 inline-flex items-center gap-0.5 ${
                        item.current
                          ? isDark
                            ? 'bg-emerald-900 text-emerald-300'
                            : 'bg-emerald-100 text-emerald-700'
                          : isDark
                          ? 'text-gray-300 hover:text-emerald-400 hover:bg-gray-700'
                          : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      {item.name}
                      <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${isQuranMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isQuranMenuOpen && (
                      <div className={`absolute left-0 mt-2 w-64 rounded-md shadow-lg py-1 z-50 ${isDark ? 'bg-gray-700' : 'bg-white'}`}>
                        <button
                          type="button"
                          onClick={() => goToQuranPage('/quran')}
                          className={`block w-full px-4 py-2 text-left text-sm ${
                            isDark
                              ? 'text-gray-200 hover:bg-gray-600'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          Quran and Translation
                        </button>
                        <button
                          type="button"
                          onClick={() => goToQuranPage('/quran/tafsir')}
                          className={`block w-full px-4 py-2 text-left text-sm ${
                            isDark
                              ? 'text-gray-200 hover:bg-gray-600'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          Tafsir e Quran
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`px-1.5 2xl:px-2.5 py-2 rounded-md text-xs xl:text-[13px] 2xl:text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
                    item.current
                      ? isDark
                        ? 'bg-emerald-900 text-emerald-300'
                        : 'bg-emerald-100 text-emerald-700'
                      : isDark
                      ? 'text-gray-300 hover:text-emerald-400 hover:bg-gray-700'
                      : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Right Section - Responsive sizing */}
          <div className="relative z-20 hidden xl:flex items-center gap-1.5 2xl:gap-2 shrink-0">
            {user ? (
              <>
                {/* Notification Bell */}
                <NotificationBell />

                {/* Dark Mode Toggle */}
                <button
                  onClick={() => toast.success('Coming Soon!')}
                  className={`p-1.5 lg:p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors duration-200 ${
                    isDark
                      ? 'text-gray-300 hover:text-emerald-400'
                      : 'text-gray-700 hover:text-emerald-600'
                  }`}
                  title="Toggle dark mode"
                >
                  {isDarkMode ? (
                    <SunIcon className="h-4 w-4 lg:h-5 lg:w-5" />
                  ) : (
                    <MoonIcon className="h-4 w-4 lg:h-5 lg:w-5" />
                  )}
                </button>

                {/* Settings Icon */}
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className={`p-1.5 lg:p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors duration-200 ${
                    isDark
                      ? 'text-gray-300 hover:text-emerald-400'
                      : 'text-gray-700 hover:text-emerald-600'
                  }`}
                  title="Settings"
                  aria-label="Settings"
                >
                  <Cog6ToothIcon className="h-4 w-4 lg:h-5 lg:w-5" />
                </button>

                <div className="relative" ref={profileMenuRef}>
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className={`flex items-center gap-1 lg:gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-md p-1.5 lg:p-2 transition-colors duration-200 ${
                      isDark
                        ? 'text-gray-300 hover:text-emerald-400'
                        : 'text-gray-700 hover:text-emerald-600'
                    }`}
                  >
                    <UserIcon className="h-4 w-4 lg:h-5 lg:w-5" />
                    <span className="text-[11px] lg:text-xs xl:text-sm font-medium max-w-[60px] lg:max-w-[80px] xl:max-w-[100px] 2xl:max-w-[120px] truncate">{user.name}</span>
                  </button>

                  {isProfileOpen && (
                    <div className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 z-50 animate-fade-in-down ${
                      isDark ? 'bg-gray-700' : 'bg-white'
                    }`}>
                      <Link
                        to="/profile"
                        className={`flex items-center px-4 py-2 text-sm ${
                          isDark
                            ? 'text-gray-300 hover:bg-gray-600'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <UserIcon className="h-4 w-4 mr-2" />
                        Profile
                      </Link>

                      {/* Tools dropdown item */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setIsToolsOpen((prev) => !prev)}
                          className={`flex items-center justify-between w-full px-4 py-2 text-sm transition-colors duration-150 ${
                            isDark
                              ? 'text-gray-300 hover:bg-gray-600'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                          aria-expanded={isToolsOpen}
                        >
                          <span className="flex items-center">
                            <WrenchScrewdriverIcon className="h-4 w-4 mr-2" />
                            Tools
                          </span>
                          <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${isToolsOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isToolsOpen && (
                          <div className={`py-1 space-y-0.5 ${isDark ? 'bg-gray-800/70' : 'bg-gray-50'}`}>
                            <Link
                              to="/salah-tracker"
                              className={`flex items-center pl-8 pr-4 py-1.5 text-xs font-medium transition-colors duration-150 ${
                                isDark
                                  ? 'text-gray-300 hover:bg-gray-600/80 hover:text-emerald-400'
                                  : 'text-gray-700 hover:bg-gray-100 hover:text-emerald-600'
                              }`}
                              onClick={() => {
                                setIsProfileOpen(false);
                                setIsToolsOpen(false);
                              }}
                            >
                              <CalendarDaysIcon className="h-3.5 w-3.5 mr-2" />
                              Muhasabah Tracker
                            </Link>

                            <Link
                              to="/halal-check"
                              className={`flex items-center pl-8 pr-4 py-1.5 text-xs font-medium transition-colors duration-150 ${
                                isDark
                                  ? 'text-gray-300 hover:bg-gray-600/80 hover:text-emerald-400'
                                  : 'text-gray-700 hover:bg-gray-100 hover:text-emerald-600'
                              }`}
                              onClick={() => {
                                setIsProfileOpen(false);
                                setIsToolsOpen(false);
                              }}
                            >
                              <ShieldCheckIcon className="h-3.5 w-3.5 mr-2" />
                              Halal Check
                            </Link>
                          </div>
                        )}
                      </div>
                      
                      {/* Dashboard for Super Admin (full) and Manager (funds only) */}
                      {canAccessDashboard && (
                          <Link
                          to="/dashboard"
                          className={`flex items-center px-4 py-2 text-sm ${
                            isDark
                              ? 'text-gray-300 hover:bg-gray-600'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                          onClick={() => setIsProfileOpen(false)}
                          >
                          <Cog6ToothIcon className="h-4 w-4 mr-2" />
                          {isSuperAdmin ? 'Dashboard' : 'Fund Management'}
                          </Link>
                      )}
                      
                      <button
                        onClick={handleLogout}
                        className={`flex items-center w-full px-4 py-2 text-sm ${
                          isDark
                            ? 'text-gray-300 hover:bg-gray-600'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link
                to="/auth"
                className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors duration-200"
              >
                Sign In
              </Link>
            )}
          </div>

          <div className="relative z-20 ml-auto xl:hidden flex items-center gap-1 shrink-0">
            {/* Mobile Notification Bell */}
            {user && <NotificationBell />}

            {/* Dark Mode Toggle */}
            <button
              onClick={() => toast.success('Coming Soon!')}
              className={`p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors duration-200 ${
                isDark
                  ? 'text-gray-300 hover:text-emerald-400'
                  : 'text-gray-700 hover:text-emerald-600'
              }`}
              title="Toggle dark mode"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <SunIcon className="h-5 w-5" />
              ) : (
                <MoonIcon className="h-5 w-5" />
              )}
            </button>

            {user && (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className={`p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors duration-200 ${
                  isDark
                    ? 'text-gray-300 hover:text-emerald-400'
                    : 'text-gray-700 hover:text-emerald-600'
                }`}
                title="Settings"
                aria-label="Settings"
              >
                <Cog6ToothIcon className="h-5 w-5" />
              </button>
            )}

            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className={`focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-md p-2 transition-colors duration-200 ${
                isDark
                  ? 'text-gray-300 hover:text-emerald-400'
                  : 'text-gray-700 hover:text-emerald-600'
              }`}
            >
              {isOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="xl:hidden max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain">
          <div className={`px-2 pt-1.5 pb-4 space-y-0.5 sm:px-3 border-t transition-colors duration-200 ${
            isDark ? 'bg-gray-900/95 border-gray-700/80' : 'bg-white/95 border-gray-200/80'
          } backdrop-blur-2xl shadow-2xl`}>
            {navigation.map((item) => {
              if (item.name === 'Prayer') {
                return (
                  <div
                    key={item.name}
                    className="rounded-md border border-emerald-100 bg-emerald-50/40 px-2 py-1"
                    ref={prayerMobileMenuRef}
                  >
                    <button
                      type="button"
                      onClick={() => setIsPrayerMenuOpen((prev) => !prev)}
                      className={`w-full px-2.5 py-1.5 rounded-md text-sm sm:text-base font-medium transition-colors duration-200 inline-flex items-center justify-between ${
                        item.current
                          ? isDark
                            ? 'bg-emerald-900 text-emerald-300'
                            : 'bg-emerald-100 text-emerald-700'
                          : isDark
                          ? 'text-gray-300 hover:text-emerald-400 hover:bg-gray-700'
                          : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      Prayer
                      <ChevronDownIcon className={`h-4 w-4 transition-transform ${isPrayerMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isPrayerMenuOpen && (
                      <div className="mt-0.5 space-y-0.5">
                        <button
                          type="button"
                          className={`block w-full px-3 py-1.5 rounded-md text-left text-sm font-medium ${
                            isDark
                              ? 'text-gray-300 hover:bg-gray-700 hover:text-emerald-400'
                              : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-600'
                          }`}
                          onClick={() => goToPrayerPage('/prayers')}
                        >
                          Prayer Times
                        </button>
                        <button
                          type="button"
                          className={`block w-full px-3 py-1.5 rounded-md text-left text-sm font-medium ${
                            isDark
                              ? 'text-gray-300 hover:bg-gray-700 hover:text-emerald-400'
                              : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-600'
                          }`}
                          onClick={() => goToPrayerPage('/prayers/qibla')}
                        >
                          Qibla Direction
                        </button>
                        <button
                          type="button"
                          className={`block w-full px-3 py-1.5 rounded-md text-left text-sm font-medium ${
                            isDark
                              ? 'text-gray-300 hover:bg-gray-700 hover:text-emerald-400'
                              : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-600'
                          }`}
                          onClick={() => goToPrayerPage('/prayers?tab=mosques')}
                        >
                          Find Mosque
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              if (item.name === 'Quran') {
                return (
                  <div
                    key={item.name}
                    className="rounded-md border border-emerald-100 bg-emerald-50/40 px-2 py-1"
                    ref={quranMobileMenuRef}
                  >
                    <button
                      type="button"
                      onClick={() => setIsQuranMenuOpen((prev) => !prev)}
                      className={`w-full px-2.5 py-1.5 rounded-md text-sm sm:text-base font-medium transition-colors duration-200 inline-flex items-center justify-between ${
                        item.current
                          ? isDark
                            ? 'bg-emerald-900 text-emerald-300'
                            : 'bg-emerald-100 text-emerald-700'
                          : isDark
                          ? 'text-gray-300 hover:text-emerald-400 hover:bg-gray-700'
                          : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      Quran
                      <ChevronDownIcon className={`h-4 w-4 transition-transform ${isQuranMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isQuranMenuOpen && (
                      <div className="mt-0.5 space-y-0.5">
                        <button
                          type="button"
                          className={`block w-full px-3 py-1.5 rounded-md text-left text-sm font-medium ${
                            isDark
                              ? 'text-gray-300 hover:bg-gray-700 hover:text-emerald-400'
                              : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-600'
                          }`}
                          onClick={() => goToQuranPage('/quran')}
                        >
                          Quran and Translation
                        </button>
                        <button
                          type="button"
                          className={`block w-full px-3 py-1.5 rounded-md text-left text-sm font-medium ${
                            isDark
                              ? 'text-gray-300 hover:bg-gray-700 hover:text-emerald-400'
                              : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-600'
                          }`}
                          onClick={() => goToQuranPage('/quran/tafsir')}
                        >
                          Tafsir e Quran
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`block px-3 py-1.5 rounded-md text-sm sm:text-base font-medium transition-colors duration-200 ${
                    item.current
                      ? isDark
                        ? 'bg-emerald-900 text-emerald-300'
                        : 'bg-emerald-100 text-emerald-700'
                      : isDark
                      ? 'text-gray-300 hover:text-emerald-400 hover:bg-gray-700'
                      : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  {item.name}
                </Link>
              );
            })}

            <div className={`pt-2.5 pb-2 border-t transition-colors duration-200 ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}>
              {user ? (
                <>
                  <div className="px-3 py-1">
                    <div className={`text-sm sm:text-base font-medium ${
                      isDark ? 'text-gray-200' : 'text-gray-800'
                    }`}>{user.name}</div>
                    <div className={`text-xs sm:text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>{user.email}</div>
                  </div>
                  <Link
                    to="/profile"
                    className={`block px-3 py-1.5 text-sm sm:text-base font-medium rounded-md transition-colors duration-200 ${
                      isDark
                        ? 'text-gray-300 hover:text-emerald-400 hover:bg-gray-700'
                        : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    Profile
                  </Link>

                  {/* Mobile Tools Collapsible */}
                  <div className="rounded-md">
                    <button
                      type="button"
                      onClick={() => setIsMobileToolsOpen((prev) => !prev)}
                      className={`w-full px-3 py-1.5 rounded-md text-sm sm:text-base font-medium transition-colors duration-200 inline-flex items-center justify-between ${
                        isDark
                          ? 'text-gray-300 hover:text-emerald-400 hover:bg-gray-700'
                          : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
                      }`}
                      aria-expanded={isMobileToolsOpen}
                    >
                      <span className="inline-flex items-center">
                        <WrenchScrewdriverIcon className="h-5 w-5 mr-2" />
                        Tools
                      </span>
                      <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${isMobileToolsOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isMobileToolsOpen && (
                      <div className="mt-0.5 pl-3 space-y-0.5">
                        <Link
                          to="/salah-tracker"
                          className={`flex items-center px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors duration-200 ${
                            isDark
                              ? 'text-gray-300 hover:text-emerald-400 hover:bg-gray-700'
                              : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          onClick={() => {
                            setIsOpen(false);
                            setIsMobileToolsOpen(false);
                          }}
                        >
                          <CalendarDaysIcon className="h-4 w-4 mr-2" />
                          Muhasabah Tracker
                        </Link>
                        <Link
                          to="/halal-check"
                          className={`flex items-center px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors duration-200 ${
                            isDark
                              ? 'text-gray-300 hover:text-emerald-400 hover:bg-gray-700'
                              : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          onClick={() => {
                            setIsOpen(false);
                            setIsMobileToolsOpen(false);
                          }}
                        >
                          <ShieldCheckIcon className="h-4 w-4 mr-2" />
                          Halal Check
                        </Link>
                      </div>
                    )}
                  </div>
                  {canAccessDashboard && (
                    <Link
                        to="/dashboard"
                        className={`block px-3 py-1.5 text-sm sm:text-base font-medium rounded-md transition-colors duration-200 ${
                          isDark
                            ? 'text-gray-300 hover:text-emerald-400 hover:bg-gray-700'
                            : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                        onClick={() => setIsOpen(false)}
                    >
                        {isSuperAdmin ? 'Dashboard' : 'Fund Management'}
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className={`flex items-center w-full px-3 py-1.5 text-sm sm:text-base font-medium rounded-md transition-colors duration-200 ${
                      isDark
                        ? 'text-gray-300 hover:text-emerald-400 hover:bg-gray-700'
                        : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
                    Sign out
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  className="block px-3 py-2 text-base font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md mx-3"
                  onClick={() => setIsOpen(false)}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
    {user && (
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    )}
    </>
  );
};

export default Navbar;
