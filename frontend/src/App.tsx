import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import {
  requestForToken,
  getPushSupportInfo,
  getPushDeviceId,
  getPushConfigurationIssue,
  storePushToken,
} from './firebase';
import axios from 'axios'; // Import axios
import { toast } from 'react-hot-toast';

// i18n initialization
import './i18n/config';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LoadingSpinner from './components/LoadingSpinner';
import ProtectedRoute from './components/ProtectedRoute'; // Import ProtectedRoute
import InstallAppPrompt from './components/InstallAppPrompt';
import PrayerAdhanScheduler from './components/PrayerAdhanScheduler';
import AdhanPlayPrompt from './components/AdhanPlayPrompt';
import StartupReadinessScreen from './components/StartupReadinessScreen';

// Pages
import Home from './pages/Home';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import PrayerTimes from './pages/PrayerTimes';
import QiblaDirection from './pages/QiblaDirection';
import QuranReader from './pages/QuranReader';
import QuranTafsirBayan from './pages/QuranTafsirBayan';
import ZakatCalculator from './pages/ZakatCalculator';
import Community from './pages/Community';
import ForumDetail from './pages/ForumDetail';
import PostDetail from './pages/PostDetail';
import DhikrDua from './pages/DhikrDua';
import DuaDetail from './pages/DuaDetail';
import Profile from './pages/Profile';
import SalahTracker from './pages/SalahTracker';
import About from './pages/About';
import Contact from './pages/Contact'; // Import Contact page
import Maktab from './pages/Maktab';
import HajjGuide from './pages/HajjGuide';

// Hooks
import { useAuth, AuthProvider } from './hooks/useAuth';
import { useStartupReadiness } from './hooks/useStartupReadiness';

// Contexts
import { QuranProvider } from './contexts/QuranContext';
import { NotificationProvider } from './contexts/NotificationContext'; // Import NotificationProvider
import { DarkModeProvider } from './contexts/DarkModeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { API_URL } from './config';

// Styles
import './App.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 404) return false;
        return failureCount < 3;
      },
    },
  },
});

const IOS_PUSH_GUIDE_SHOWN_KEY = 'iosPushGuideShown';
const PUSH_PERMISSION_TOAST_KEY = 'pushPermissionToastShown';

const AppContent: React.FC = () => {
  const { user, loading, sessionStatus } = useAuth();
  const startupReadiness = useStartupReadiness();

  useEffect(() => {
    if (!user || sessionStatus !== 'ready') {
      return;
    }

    const sendHeartbeat = async () => {
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        return;
      }

      try {
        const support = await getPushSupportInfo();
        await axios.post(`${API_URL}/notifications/heartbeat`, {
          deviceId: getPushDeviceId(),
          permission: typeof Notification !== 'undefined' ? Notification.permission : 'unknown',
          capability: {
            supportsWebPush: support.supported,
            isIOS: support.isIOS,
            isStandalone: support.isStandalone,
          },
          visibilityState: document.visibilityState,
          isOnline: navigator.onLine,
          heartbeatAt: new Date().toISOString(),
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
      } catch (error) {
        console.error('Heartbeat update failed:', error);
      }
    };

    void sendHeartbeat();
    const heartbeatInterval = window.setInterval(() => {
      void sendHeartbeat();
    }, 60 * 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', sendHeartbeat);

    return () => {
      window.clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', sendHeartbeat);
    };
  }, [user, sessionStatus]);
  
  useEffect(() => {
    if (!user || sessionStatus !== 'ready') return;

    let registrationInProgress = false;

    const registerToken = async (allowPermissionPrompt: boolean) => {
      if (registrationInProgress) return;
      if (!allowPermissionPrompt && (
        typeof Notification === 'undefined' || Notification.permission !== 'granted'
      )) {
        return;
      }

      registrationInProgress = true;
      try {
        const pushSupport = await getPushSupportInfo();
        const configurationIssue = getPushConfigurationIssue();

        // Missing VAPID is a deploy/config problem — never show a toast to end users.
        // Presence heartbeats still run; token registration is skipped until the key is set.
        if (configurationIssue) {
          console.warn(configurationIssue);
          const authToken = localStorage.getItem('token');
          if (authToken) {
            try {
              await axios.post(`${API_URL}/notifications/heartbeat`, {
                deviceId: getPushDeviceId(),
                permission: typeof Notification !== 'undefined' ? Notification.permission : 'unknown',
                capability: {
                  supportsWebPush: pushSupport.supported,
                  isIOS: pushSupport.isIOS,
                  isStandalone: pushSupport.isStandalone,
                },
                visibilityState: document.visibilityState,
                isOnline: navigator.onLine,
                heartbeatAt: new Date().toISOString(),
              }, {
                headers: { Authorization: `Bearer ${authToken}` },
              });
            } catch (apiError) {
              console.error('❌ Failed to update notification presence:', apiError);
            }
          }
          return;
        }

        if (!pushSupport.supported && pushSupport.isIOS && !pushSupport.isStandalone) {
          const alreadyShown = sessionStorage.getItem(IOS_PUSH_GUIDE_SHOWN_KEY);
          if (!alreadyShown) {
            toast((t) => (
              <div className="flex items-start gap-3">
                <p className="text-sm leading-snug">
                  For iPhone notifications, install HikmahSphere to Home Screen, then allow notifications.
                </p>
                <button
                  type="button"
                  onClick={() => toast.dismiss(t.id)}
                  className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            ), {
              duration: 7000,
              icon: 'i'
            });
            sessionStorage.setItem(IOS_PUSH_GUIDE_SHOWN_KEY, '1');
          }
        }

        const token = await requestForToken();

        if (token) {
            console.log("FCM Token Generated:", token);
            storePushToken(token);
            const authToken = localStorage.getItem('token');
            if (authToken) {
                try {
                    await axios.post(`${API_URL}/notifications/token`,
                        {
                          token,
                          deviceId: getPushDeviceId(),
                          userAgent: navigator.userAgent,
                          permission: typeof Notification !== 'undefined' ? Notification.permission : 'unknown',
                          capability: {
                            supportsWebPush: pushSupport.supported,
                            isIOS: pushSupport.isIOS,
                            isStandalone: pushSupport.isStandalone,
                          },
                          visibilityState: document.visibilityState,
                          heartbeatAt: new Date().toISOString(),
                        },
                        { headers: { Authorization: `Bearer ${authToken}` } }
                    );
                    console.log("✅ FCM Token saved to backend");
                } catch (apiError) {
                    console.error("❌ Failed to save FCM token to backend:", apiError);
                }
            }
        } else {
            storePushToken(null);
            // Log detailed info for iOS debugging
            console.log("No FCM token generated. Push support:", pushSupport);
            if (pushSupport.isIOS) {
              console.log("iOS detected - ensure PWA is installed to Home Screen and permission granted");
            }
            if (
              typeof Notification !== 'undefined' &&
              Notification.permission === 'denied' &&
              !sessionStorage.getItem(PUSH_PERMISSION_TOAST_KEY)
            ) {
              toast.error('Notifications are blocked. Enable them in your browser site settings, then reopen HikmahSphere.');
              sessionStorage.setItem(PUSH_PERMISSION_TOAST_KEY, '1');
            }
            const authToken = localStorage.getItem('token');
            if (authToken) {
              try {
                await axios.post(`${API_URL}/notifications/heartbeat`, {
                  deviceId: getPushDeviceId(),
                  permission: typeof Notification !== 'undefined' ? Notification.permission : 'unknown',
                  capability: {
                    supportsWebPush: pushSupport.supported,
                    isIOS: pushSupport.isIOS,
                    isStandalone: pushSupport.isStandalone,
                  },
                  visibilityState: document.visibilityState,
                  isOnline: navigator.onLine,
                  heartbeatAt: new Date().toISOString(),
                }, {
                  headers: { Authorization: `Bearer ${authToken}` }
                });
              } catch (apiError) {
                console.error('❌ Failed to update notification permission status:', apiError);
              }
            }
        }
      } catch (err) {
        console.error('Error getting token:', err);
      } finally {
        registrationInProgress = false;
      }
    };

    void registerToken(true);

    const retryRegistration = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void registerToken(false);
      }
    };
    document.addEventListener('visibilitychange', retryRegistration);
    window.addEventListener('online', retryRegistration);

    return () => {
      document.removeEventListener('visibilitychange', retryRegistration);
      window.removeEventListener('online', retryRegistration);
    };
  }, [user, sessionStatus]);

  if (
    startupReadiness.enabled
    && (startupReadiness.state.outcome !== 'ready' || loading)
  ) {
    return (
      <StartupReadinessScreen
        state={startupReadiness.state}
        authReady={!loading}
        onRetry={startupReadiness.retry}
      />
    );
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800 transition-colors duration-300">
      {user && sessionStatus === 'reconnecting' && (
        <div
          className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-gray-900/90 px-4 py-2 text-xs font-medium text-white shadow-lg"
          role="status"
        >
          Reconnecting to the server…
        </div>
      )}
      {/* Navigation */}
      <Navbar user={user} />

      {/* Main Content */}
      <main className="pt-16"> {/* Account for fixed navbar */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/about" element={<About />} />
          <Route path="/about-us" element={<Navigate to="/about" replace />} />
          <Route path="/maktab" element={<Maktab />} />
          <Route path="/contact" element={<Contact />} /> {/* Add Contact Route */}
          <Route path="/hajj-guide" element={<HajjGuide />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/prayers" element={<PrayerTimes />} />
          <Route path="/prayers/qibla" element={<QiblaDirection />} />
          <Route path="/quran" element={
            <QuranProvider>
              <QuranReader />
            </QuranProvider>
          } />
          <Route path="/quran/tafsir" element={
            <QuranProvider>
              <QuranTafsirBayan />
            </QuranProvider>
          } />
          <Route path="/dhikr-dua" element={<DhikrDua />} />
          <Route path="/dua/:slug" element={<DuaDetail />} />
          <Route path="/zakat" element={<ZakatCalculator />} />
          <Route path="/community" element={<Community />} />
          <Route path="/community/forums/:forumId" element={<ForumDetail />} />
          <Route path="/community/forums/:forumId/posts/:postId" element={<PostDetail />} />
          
          {/* Protected Routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/salah-tracker" 
            element={
              <ProtectedRoute>
                <SalahTracker />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </main>

      {/* Footer */}
      <Footer />

      {/* Global Adhan scheduler (fires prayer notifications on any page) */}
      <PrayerAdhanScheduler />

      {/* One-tap Adhan prompt after notification tap or ?playAdhan=1 */}
      <AdhanPlayPrompt />

      {/* Global Notifications */}
      <Toaster />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <DarkModeProvider>
            <LanguageProvider>
              <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                {/* Mount outside AppContent so a slow authentication check or sleeping
                    backend cannot delay/cancel the browser's install opportunity. */}
                <InstallAppPrompt />
                <AppContent />
              </Router>
            </LanguageProvider>
          </DarkModeProvider>
        </NotificationProvider>
      </AuthProvider>

    </QueryClientProvider>
  );
};

export default App;
