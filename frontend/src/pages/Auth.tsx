import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordChangeToken, setPasswordChangeToken] = useState('');
  
  const { login, register } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    newPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
        if (showPasswordChange) {
            // Handle Password Change
            const response = await fetch(`${API_URL}/auth/change-password`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${passwordChangeToken}`
                },
                body: JSON.stringify({ newPassword: formData.newPassword })
            });
            const data = await response.json();
            if (data.status === 'success') {
                toast.success('Password changed successfully. Please login.');
                setShowPasswordChange(false);
                setPasswordChangeToken('');
                setFormData(prev => ({ ...prev, password: '', newPassword: '' }));
            } else {
                toast.error(data.message || 'Failed to change password');
            }
            setLoading(false);
            return;
        }

        if (isLogin) {
            // Manual login call to check for passwordChangeRequired flag
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email, password: formData.password })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                if (data.passwordChangeRequired) {
                    toast.error('You must change your password to proceed.');
                    setPasswordChangeToken(data.token);
                    setShowPasswordChange(true);
                } else {
                    await login(formData.email, formData.password);
                    toast.success('Successfully logged in!');
                    navigate('/profile'); 
                }
            } else {
                throw new Error(data.message || 'Login failed');
            }

        } else {
            await register(formData.name, formData.email, formData.password);
            toast.success('Account created successfully!');
            navigate('/profile'); 
        }
    } catch (error: any) {
        console.error('Authentication error:', error);
        toast.error(error.message || 'Authentication failed. Please try again.');
    } finally {
        setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return <LoadingSpinner fullScreen text={isLogin ? 'Signing in...' : 'Processing...'} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: '48px 48px'
        }}></div>
      </div>
      
      {/* Floating Gradient Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="max-w-6xl w-full flex items-center justify-center relative z-10">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 text-white">
          <div className="text-center space-y-6">
            <div className="mx-auto w-32 h-32 flex items-center justify-center rounded-full bg-white shadow-2xl p-4 border border-white/20">
              <img src="/logo.png" alt="HikmahSphere Logo" className="h-full w-full object-cover rounded-full" />
            </div>
            <h1 className="text-5xl font-bold mb-4">
              Welcome to <span className="bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">HikmahSphere</span>
            </h1>
            <p className="text-xl text-emerald-100 leading-relaxed">
              Your complete Islamic digital companion for prayer times, Quran reading, Zakat calculation, and community connection.
            </p>
            <div className="flex flex-col gap-3 text-emerald-200 pt-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span>Accurate Prayer Times</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span>Complete Quran Reader</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span>Smart Zakat Calculator</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span>Global Muslim Community</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="w-full lg:w-1/2 max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 backdrop-blur-sm bg-white/95">
            <div>
              <div className="lg:hidden mx-auto h-20 w-20 flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg overflow-hidden p-2 mb-4">
                <img src="/logo.png" alt="HikmahSphere Logo" className="h-full w-full object-cover rounded-full" />
              </div>
              <h2 className="text-center text-3xl font-bold text-gray-900">
                {showPasswordChange ? 'Change Password' : (isLogin ? 'Welcome Back' : 'Create Account')}
              </h2>
              <p className="mt-2 text-center text-gray-600">
                {showPasswordChange ? 'Set a new password for your account' : (isLogin ? 'Sign in to continue your journey' : 'Join our global Muslim community')}
              </p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-5">

                {showPasswordChange && (
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        required
                        value={formData.newPassword}
                        onChange={handleInputChange}
                        className="appearance-none relative block w-full px-4 py-3 border-2 border-gray-200 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        placeholder="Enter new password"
                      />
                    </div>
                  </div>
                )}

                {!showPasswordChange && !isLogin && (
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required={!isLogin}
                        value={formData.name}
                        onChange={handleInputChange}
                        className="appearance-none relative block w-full px-4 py-3 border-2 border-gray-200 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        placeholder="Enter your full name"
                      />
                    </div>
                  </div>
                )}

                {!showPasswordChange && (
                  <>
                    <div>
                      <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <input
                          id="email"
                          name="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={handleInputChange}
                          className="appearance-none relative block w-full px-4 py-3 border-2 border-gray-200 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                          placeholder="Enter your email"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="password"
                          name="password"
                          type="password"
                          required
                          value={formData.password}
                          onChange={handleInputChange}
                          className="appearance-none relative block w-full px-4 py-3 border-2 border-gray-200 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                          placeholder="Enter your password"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    showPasswordChange ? 'Update Password' : (isLogin ? 'Sign In' : 'Create Account')
                  )}
                </button>
              </div>

              {!showPasswordChange && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-emerald-600 hover:text-emerald-500 font-semibold transition-colors"
                  >
                    {isLogin ? "Don't have an account? Create one" : "Already have an account? Sign in"}
                  </button>
                </div>
              )}
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="text-center">
                <p className="text-sm text-gray-500 font-arabic">"وَقُل رَّبِّ زِدْنِي عِلْمًا"</p>
                <p className="text-xs text-gray-400 italic mt-1">"And say, My Lord, increase me in knowledge" - Quran 20:114</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
