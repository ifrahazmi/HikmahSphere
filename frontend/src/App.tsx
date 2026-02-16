import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster, toast } from 'react-hot-toast';
import { requestForToken, onMessageListener } from './firebase';
import axios from 'axios'; // Import axios

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LoadingSpinner from './components/LoadingSpinner';
import ProtectedRoute from './components/ProtectedRoute'; // Import ProtectedRoute

// Pages
import Home from './pages/Home';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import PrayerTimes from './pages/PrayerTimes';
import QuranReader from './pages/QuranReader';
import ZakatCalculator from './pages/ZakatCalculator';
import Community from './pages/Community';
import Profile from './pages/Profile';
import About from './pages/About';

// Hooks
import { useAuth, AuthProvider } from './hooks/useAuth';

// Contexts
import { QuranProvider } from './contexts/QuranContext';

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

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  
  useEffect(() => {
    // 1. Request Token & Register with Backend
    const registerToken = async () => {
      try {
        const token = await requestForToken();
        
        if (token) {
            console.log("FCM Token Generated:", token);
            const authToken = localStorage.getItem('token');
            if (authToken) {
                try {
                    await axios.post(`${API_URL}/notifications/token`, 
                        { token },
                        { headers: { Authorization: `Bearer ${authToken}` } }
                    );
                    console.log("✅ FCM Token saved to backend");
                } catch (apiError) {
                    console.error("❌ Failed to save FCM token to backend:", apiError);
                }
            }
        }
      } catch (err) {
        console.error('Error getting token:', err);
      }
    };

    registerToken();

    // 2. Listen for Incoming Messages (Foreground)
    const unsubscribe = onMessageListener((payload: any) => {
        console.log('Received foreground message: ', payload);
        
        // Play a sound (optional)
        // const audio = new Audio('/notification.mp3');
        // audio.play().catch(e => console.log('Audio play failed', e));

        toast.custom((t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
          >
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <img
                    className="h-10 w-10 rounded-full"
                    src="/logo192.png" 
                    alt="App Logo"
                  />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {payload?.notification?.title || 'New Notification'}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {payload?.notification?.body}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-gray-200">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Close
              </button>
            </div>
          </div>
        ), { duration: 5000 });
    });

    return () => {
        if (unsubscribe) unsubscribe();
    };
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
          <Route path="/auth" element={<Auth />} />
          <Route path="/prayers" element={<PrayerTimes />} />
          <Route path="/quran" element={
            <QuranProvider>
              <QuranReader />
            </QuranProvider>
          } />
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
        </Routes>
      </main>

      {/* Footer */}
      <Footer />

      {/* Global Notifications */}
      <Toaster />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>

      {/* React Query Devtools (development only) */}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
};

export default App;
