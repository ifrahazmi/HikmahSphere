import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import NotificationBell from './Notifications/NotificationBell'; // Import the new NotificationBell
import {
  Bars3Icon,
  XMarkIcon,
  UserIcon,
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
  const location = useLocation();
  const navigate = useNavigate();
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  // Check if we're on Quran page and get theme from localStorage
  const [quranTheme, setQuranTheme] = useState<'light' | 'dark'>('light');
  const isQuranPage = location.pathname === '/quran';

  useEffect(() => {
    const updateTheme = () => {
      if (isQuranPage) {
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
      }
    };

    // Update theme immediately when navigating to Quran page
    updateTheme();

    // Listen for storage changes
    const handleStorageChange = () => {
      updateTheme();
    };

    window.addEventListener('storage', handleStorageChange);
    // Custom event for same-tab updates
    window.addEventListener('quranSettingsChanged', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('quranSettingsChanged', handleStorageChange);
    };
  }, [isQuranPage]);

  const navigation = [
    { name: 'Home', href: '/', current: location.pathname === '/' },
    { name: 'About', href: '/about', current: location.pathname === '/about' },
    { name: 'Prayer Times', href: '/prayers', current: location.pathname === '/prayers' },
    { name: 'Quran', href: '/quran', current: location.pathname === '/quran' },
    { name: 'Zakat', href: '/zakat', current: location.pathname === '/zakat' },
    { name: 'Community', href: '/community', current: location.pathname === '/community' },
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
    };

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen]);

  // Check for Super Admin Role
  const isSuperAdmin = hasRole && hasRole(['superadmin']);

  // Determine if we should use dark mode
  const isDark = isQuranPage && quranTheme === 'dark';

  return (
    <nav className={`shadow-lg fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ${
      isDark ? 'bg-gray-800' : 'bg-white'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <div className="w-10 h-10 flex items-center justify-center overflow-hidden rounded-full bg-white">
                <img src="/logo.png" alt="HikmahSphere Logo" className="h-full w-full object-cover" />
              </div>
              <div className="ml-3 flex items-baseline">
                <span className={`text-xl font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>HikmahSphere</span>
                <span className={`ml-2 text-xs font-semibold px-2 py-1 rounded-full ${
                  isDark
                    ? 'bg-emerald-900 text-emerald-300'
                    : 'bg-emerald-100 text-emerald-700'
                } -translate-y-1`}>
                  v2.1 Beta
                </span>
              </div>
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
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
            ))}
          </div>

          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                {/* Notification Bell */}
                <NotificationBell />

                <div className="relative" ref={profileMenuRef}>
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className={`flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-md p-2 transition-colors duration-200 ${
                      isDark
                        ? 'text-gray-300 hover:text-emerald-400'
                        : 'text-gray-700 hover:text-emerald-600'
                    }`}
                  >
                    <UserIcon className="h-6 w-6" />
                    <span className="text-sm font-medium">{user.name}</span>
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

          <div className="md:hidden flex items-center gap-2">
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
        <div className="md:hidden">
          <div className={`px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t transition-colors duration-200 ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'
          }`}>
            {navigation.map((item) => (
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
            ))}

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
