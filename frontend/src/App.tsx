import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { requestForToken, getPushSupportInfo, getPushDeviceId, storePushToken } from './firebase';
import axios from 'axios'; // Import axios
import { toast } from 'react-hot-toast';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LoadingSpinner from './components/LoadingSpinner';
import ProtectedRoute from './components/ProtectedRoute'; // Import ProtectedRoute
import InstallAppPrompt from './components/InstallAppPrompt';

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
import HajjGuide from './pages/HajjGuide';

// Hooks
import { useAuth, AuthProvider } from './hooks/useAuth';

// Contexts
import { QuranProvider } from './contexts/QuranContext';
import { NotificationProvider } from './contexts/NotificationContext'; // Import NotificationProvider

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

// Use relative URL to leverage package.json proxy for local dev
const API_URL = '/api';
const IOS_PUSH_GUIDE_SHOWN_KEY = 'iosPushGuideShown';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!user) {
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

    return () => {
      window.clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user]);
  
  useEffect(() => {
    // 1. Request Token & Register with Backend
    const registerToken = async () => {
      try {
        const pushSupport = await getPushSupportInfo();
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

        // Wait a bit for service worker to be ready (especially important for iOS)
        await new Promise(resolve => setTimeout(resolve, 500));

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
      }
    };

    // Only register token if user is logged in
    if (user) {
      registerToken();
    }

  }, [user]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Navigation */}
      <Navbar user={user} />

      {/* Main Content */}
      <main className="pt-16"> {/* Account for fixed navbar */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/about" element={<About />} />
          <Route path="/about-us" element={<Navigate to="/about" replace />} />
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

      {/* PWA Install Prompt */}
      <InstallAppPrompt />

      {/* Global Notifications */}
      <Toaster />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider> {/* Wrap with NotificationProvider */}
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppContent />
          </Router>
        </NotificationProvider>
      </AuthProvider>

    </QueryClientProvider>
  );
};

export default App;
