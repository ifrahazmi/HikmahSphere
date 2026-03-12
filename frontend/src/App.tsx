import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { requestForToken, getPushSupportInfo, getPushDeviceId, storePushToken } from './firebase';
import axios from 'axios'; // Import axios
import { toast } from 'react-hot-toast';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LoadingSpinner from './components/LoadingSpinner';
import ProtectedRoute from './components/ProtectedRoute'; // Import ProtectedRoute
import RamadanElitePopup from './components/RamadanElitePopup'; // Ramadan Popup
import InstallAppPrompt from './components/InstallAppPrompt';

// Pages
import Home from './pages/Home';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import PrayerTimes from './pages/PrayerTimes';
import QuranReader from './pages/QuranReader';
import ZakatCalculator from './pages/ZakatCalculator';
import Community from './pages/Community';
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
        }
      } catch (err) {
        console.error('Error getting token:', err);
      }
    };

    registerToken();

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
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} /> {/* Add Contact Route */}
          <Route path="/hajj-guide" element={<HajjGuide />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/prayers" element={<PrayerTimes />} />
          <Route path="/quran" element={
            <QuranProvider>
              <QuranReader />
            </QuranProvider>
          } />
          <Route path="/dhikr-dua" element={<DhikrDua />} />
          <Route path="/dua/:slug" element={<DuaDetail />} />
          <Route path="/zakat" element={<ZakatCalculator />} />
          <Route path="/community" element={<Community />} />
          
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

      {/* Ramadan Elite Popup */}
      <RamadanElitePopup />

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
          <Router>
            <AppContent />
          </Router>
        </NotificationProvider>
      </AuthProvider>

      {/* React Query Devtools (development only) */}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
};

export default App;
