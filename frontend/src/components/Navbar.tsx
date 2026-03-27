import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import NotificationBell from './Notifications/NotificationBell'; // Import the new NotificationBell
import {
  Bars3Icon,
  XMarkIcon,
  UserIcon,
  ChevronDownIcon,
  CalendarDaysIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

interface NavbarProps {
  user?: any;
}

const Navbar: React.FC<NavbarProps> = ({ user: propUser }) => {
  const { user: authUser, logout, hasRole } = useAuth();
  const user = propUser || authUser;
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPrayerMenuOpen, setIsPrayerMenuOpen] = useState(false);
  const [isQuranMenuOpen, setIsQuranMenuOpen] = useState(false);
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
    { name: 'Community', href: '/community', current: location.pathname === '/community' },
    { name: 'Hajj Guide', href: '/hajj-guide', current: location.pathname === '/hajj-guide' },
    { name: 'Contact', href: '/contact', current: location.pathname === '/contact' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsOpen(false);
    setIsProfileOpen(false);
  };

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
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

  // Check for Super Admin Role
  const isSuperAdmin = hasRole && hasRole(['superadmin']);

  // Determine if we should use dark mode
  const isDark = (isQuranPage && quranTheme === 'dark') || (isQiblaPage && qiblaTheme === 'dark');

  return (
    <nav className={`shadow-lg fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ${
      isDark ? 'bg-gray-800' : 'bg-white'
    }`}>
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 lg:w-11 lg:h-11 xl:w-12 xl:h-12 flex items-center justify-center overflow-hidden rounded-full bg-white">
                <img src="/logo.png" alt="HikmahSphere Logo" className="h-full w-full object-cover" />
              </div>
              <div className="ml-2 flex items-baseline">
                <span className={`text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>HikmahSphere</span>
                <span className={`hidden lg:inline-flex ml-0.5 text-[8px] sm:text-[9px] lg:text-[10px] xl:text-xs font-semibold px-0.5 py-0.5 rounded-full ${
                  isDark
                    ? 'bg-emerald-900 text-emerald-300'
                    : 'bg-emerald-100 text-emerald-700'
                } -translate-y-0.5`}>
                  v3.0 Beta
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links - Responsive sizing based on screen width */}
          <div className="hidden lg:flex flex-1 items-center justify-center gap-0.5 xl:gap-1 2xl:gap-2 min-w-0">
            {navigation.map((item) => {
              if (item.name === 'Prayer') {
                return (
                  <div key={item.name} className="relative" ref={prayerDesktopMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsPrayerMenuOpen((prev) => !prev)}
                      className={`px-1.5 lg:px-2 xl:px-2.5 py-1.5 lg:py-2 xl:py-2.5 rounded-md text-[11px] lg:text-xs xl:text-sm 2xl:text-base font-medium whitespace-nowrap transition-colors duration-200 inline-flex items-center gap-1 ${
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
                      className={`px-1.5 lg:px-2 xl:px-2.5 py-1.5 lg:py-2 xl:py-2.5 rounded-md text-[11px] lg:text-xs xl:text-sm 2xl:text-base font-medium whitespace-nowrap transition-colors duration-200 inline-flex items-center gap-1 ${
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
                          Tafsir Bayan-ul-Quran
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
                  className={`px-1.5 lg:px-2 xl:px-2.5 py-1.5 lg:py-2 xl:py-2.5 rounded-md text-[11px] lg:text-xs xl:text-sm 2xl:text-base font-medium whitespace-nowrap transition-colors duration-200 ${
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
          <div className="hidden lg:flex items-center gap-1 lg:gap-1.5 xl:gap-2 shrink-0">
            {user ? (
              <>
                {/* Notification Bell */}
                <NotificationBell />

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

                      <Link
                        to="/salah-tracker"
                        className={`flex items-center px-4 py-2 text-sm ${
                          isDark
                            ? 'text-gray-300 hover:bg-gray-600'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <CalendarDaysIcon className="h-4 w-4 mr-2" />
                        Salah Tracker
                      </Link>

                      <Link
                        to="/settings"
                        className={`flex items-center px-4 py-2 text-sm ${
                          isDark
                            ? 'text-gray-300 hover:bg-gray-600'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <Cog6ToothIcon className="h-4 w-4 mr-2" />
                        Settings
                      </Link>

                      {/* Dashboard only for Super Admin */}
                      {isSuperAdmin && (
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
                          Dashboard
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

          <div className="lg:hidden flex items-center gap-2">
            {/* Mobile Notification Bell */}
            {user && <NotificationBell />}
            
            <button
              onClick={() => setIsOpen(!isOpen)}
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
        <div className="lg:hidden">
          <div className={`px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t transition-colors duration-200 ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'
          }`}>
            {navigation.map((item) => {
              if (item.name === 'Prayer') {
                return (
                  <div
                    key={item.name}
                    className="rounded-md border border-emerald-100 bg-emerald-50/40 px-2 py-2"
                    ref={prayerMobileMenuRef}
                  >
                    <button
                      type="button"
                      onClick={() => setIsPrayerMenuOpen((prev) => !prev)}
                      className={`w-full px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 inline-flex items-center justify-between ${
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
                      <div className="mt-1 space-y-1">
                        <button
                          type="button"
                          className={`block w-full px-4 py-2 rounded-md text-left text-sm font-medium ${
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
                          className={`block w-full px-4 py-2 rounded-md text-left text-sm font-medium ${
                            isDark
                              ? 'text-gray-300 hover:bg-gray-700 hover:text-emerald-400'
                              : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-600'
                          }`}
                          onClick={() => goToPrayerPage('/prayers/qibla')}
                        >
                          Qibla Direction
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
                    className="rounded-md border border-emerald-100 bg-emerald-50/40 px-2 py-2"
                    ref={quranMobileMenuRef}
                  >
                    <button
                      type="button"
                      onClick={() => setIsQuranMenuOpen((prev) => !prev)}
                      className={`w-full px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 inline-flex items-center justify-between ${
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
                      <div className="mt-1 space-y-1">
                        <button
                          type="button"
                          className={`block w-full px-4 py-2 rounded-md text-left text-sm font-medium ${
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
                          className={`block w-full px-4 py-2 rounded-md text-left text-sm font-medium ${
                            isDark
                              ? 'text-gray-300 hover:bg-gray-700 hover:text-emerald-400'
                              : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-600'
                          }`}
                          onClick={() => goToQuranPage('/quran/tafsir')}
                        >
                          Tafsir Bayan-ul-Quran
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
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${
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

            <div className={`pt-4 pb-3 border-t transition-colors duration-200 ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}>
              {user ? (
                <>
                  <div className="px-3 py-2">
                    <div className={`text-base font-medium ${
                      isDark ? 'text-gray-200' : 'text-gray-800'
                    }`}>{user.name}</div>
                    <div className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>{user.email}</div>
                  </div>
                  <Link
                    to="/profile"
                    className={`block px-3 py-2 text-base font-medium transition-colors duration-200 ${
                      isDark
                        ? 'text-gray-300 hover:text-emerald-400 hover:bg-gray-700'
                        : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    Profile
                  </Link>
                  <Link
                    to="/salah-tracker"
                    className={`block px-3 py-2 text-base font-medium transition-colors duration-200 ${
                      isDark
                        ? 'text-gray-300 hover:text-emerald-400 hover:bg-gray-700'
                        : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    Salah Tracker
                  </Link>
                  <Link
                    to="/settings"
                    className={`block px-3 py-2 text-base font-medium transition-colors duration-200 ${
                      isDark
                        ? 'text-gray-300 hover:text-emerald-400 hover:bg-gray-700'
                        : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    Settings
                  </Link>
                  {isSuperAdmin && (
                    <Link
                        to="/dashboard"
                        className={`block px-3 py-2 text-base font-medium transition-colors duration-200 ${
                          isDark
                            ? 'text-gray-300 hover:text-emerald-400 hover:bg-gray-700'
                            : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                        onClick={() => setIsOpen(false)}
                    >
                        Dashboard
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className={`block w-full text-left px-3 py-2 text-base font-medium transition-colors duration-200 ${
                      isDark
                        ? 'text-gray-300 hover:text-emerald-400 hover:bg-gray-700'
                        : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
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
  );
};

export default Navbar;
