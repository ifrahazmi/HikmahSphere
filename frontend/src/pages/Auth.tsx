import React, { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import PageSEO from '../components/PageSEO';
import { API_URL } from '../config';

const ONBOARDING_REQUIRED_KEY = 'onboardingRequiredAfterRegister';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordChangeToken, setPasswordChangeToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingData, setOnboardingData] = useState({
    gender: '',
    madhab: '',
  });

  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    newPassword: ''
  });

  React.useEffect(() => {
    if (!user) {
      return;
    }

    const shouldShowOnboarding = localStorage.getItem(ONBOARDING_REQUIRED_KEY) === '1';
    if (!shouldShowOnboarding) {
      return;
    }

    setOnboardingData((prev) => ({
      gender: prev.gender || user.gender || '',
      madhab: prev.madhab || user.madhab || '',
    }));
    setShowOnboardingModal(true);
    setIsLogin(false);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const submittedData = new FormData(e.currentTarget);
    const submittedName = String(submittedData.get('name') || formData.name).trim();
    const submittedEmail = String(submittedData.get('email') || formData.email).trim().toLowerCase();
    const submittedPassword = String(submittedData.get('password') || formData.password);
    const submittedNewPassword = String(submittedData.get('newPassword') || formData.newPassword);

    setFormData(prev => ({
      ...prev,
      name: submittedName,
      email: submittedEmail,
      password: submittedPassword,
      newPassword: submittedNewPassword,
    }));

    try {
        if (showPasswordChange) {
            // Handle Password Change
            const response = await fetch(`${API_URL}/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${passwordChangeToken}`
                },
                body: JSON.stringify({ newPassword: submittedNewPassword })
            });
            const data = await response.json();
            if (data.status === 'success') {
                toast.success('Password changed successfully. Please login.');
                setShowPasswordChange(false);
                setPasswordChangeToken('');
                setFormData(prev => ({ ...prev, password: '', newPassword: '' }));
                setShowNewPassword(false);
                setIsLogin(true);
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
                body: JSON.stringify({ email: submittedEmail, password: submittedPassword })
            });

            const data = await response.json();

            if (data.status === 'success') {
                if (data.passwordChangeRequired) {
                    toast.error('You must change your password to proceed.');
                    setPasswordChangeToken(data.token);
                    setShowPasswordChange(true);
                } else {
                    // Use the login function from auth context to properly update state
                    await login(submittedEmail, submittedPassword);
                    toast.success('Successfully logged in!');
                    navigate(redirectParam || '/profile', { replace: true });
                }
            } else {
                  const normalizedMessage = typeof data.message === 'string' ? data.message : '';
                  // Treat any missing-user or wiped-credential responses as a prompt to re-register
                  const shouldShowRecovery = /invalid user|invalid credentials|user not found|account not found|no user/i.test(normalizedMessage);
                  if (shouldShowRecovery) {
                    setShowRecoveryModal(true);
                  }
                  toast.error(normalizedMessage || 'Login failed. Please check your credentials.');
            }

        } else {
            await register(submittedName, submittedEmail, submittedPassword);
            toast.success('Account created successfully! You can optionally complete profile details.');
            localStorage.setItem(ONBOARDING_REQUIRED_KEY, '1');
            setOnboardingData({
              gender: '',
              madhab: '',
            });
            setShowOnboardingModal(true);
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

  const completeOnboardingAndContinue = () => {
    localStorage.removeItem(ONBOARDING_REQUIRED_KEY);
    setShowOnboardingModal(false);
    const targetPath = redirectParam || '/profile';
    window.location.assign(targetPath);
  };

  const handleOnboardingSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const normalizedGender = onboardingData.gender === 'male' || onboardingData.gender === 'female'
      ? onboardingData.gender
      : '';
    const normalizedMadhab = onboardingData.madhab;

    if (!normalizedGender && !normalizedMadhab) {
      completeOnboardingAndContinue();
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Session expired. Please login again.');
      return;
    }

    setOnboardingSaving(true);
    try {
      const response = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...(normalizedGender ? { gender: normalizedGender } : {}),
          ...(normalizedMadhab ? { madhab: normalizedMadhab } : {}),
        }),
      });

      const payload = await response.json();
      if (!response.ok || payload?.status !== 'success') {
        throw new Error(payload?.message || 'Failed to save profile details');
      }

      if (payload?.data?.user) {
        localStorage.setItem('user', JSON.stringify(payload.data.user));
      }

      toast.success('Profile info updated');
      completeOnboardingAndContinue();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save profile details');
    } finally {
      setOnboardingSaving(false);
    }
  };

  const onboardingRequired = localStorage.getItem(ONBOARDING_REQUIRED_KEY) === '1';

  if (user && !showOnboardingModal && !onboardingRequired) {
    return <Navigate to="/profile" replace />;
  }

  if (loading) {
    return (
      <>
        <PageSEO
          title="Sign In"
          description="Sign in or create your account to access prayer tools, Quran features, and personalized Islamic resources."
          path="/auth"
          noIndex
          noFollow
        />
        <LoadingSpinner fullScreen text={isLogin ? 'Signing in...' : 'Processing...'} />
      </>
    );
  }

  return (
    <>
      <PageSEO
        title="Sign In"
        description="Sign in or create your account to access prayer tools, Quran features, and personalized Islamic resources."
        path="/auth"
        noIndex
        noFollow
      />
      <div className="min-h-screen flex items-start justify-center bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 pt-10 pb-4 sm:items-center sm:py-6 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
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
              <div className="lg:hidden mx-auto h-20 w-20 flex items-center justify-center rounded-full bg-white shadow-lg overflow-hidden p-2 mb-4">
                <img src="/logo.png" alt="HikmahSphere Logo" className="h-full w-full object-cover rounded-full" />
              </div>
              <h2 className="text-center text-3xl font-bold text-gray-900">
                {showPasswordChange ? 'Change Password' : (isLogin ? 'Welcome Back' : 'Create Account')}
              </h2>
              <p className="mt-2 text-center text-gray-600">
                {showPasswordChange ? 'Set a new password for your account' : (isLogin ? 'Sign in to continue your journey' : 'Join our global Muslim community')}
              </p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit} autoComplete="on">
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
                        type={showNewPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={formData.newPassword}
                        onChange={handleInputChange}
                        onInput={handleInputChange}
                        className="appearance-none relative block w-full px-4 pr-20 py-3 border-2 border-gray-200 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(prev => !prev)}
                        className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                      >
                        {showNewPassword ? 'Hide' : 'Show'}
                      </button>
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
                        autoComplete="name"
                        required={!isLogin}
                        value={formData.name}
                        onChange={handleInputChange}
                        onInput={handleInputChange}
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
                          autoComplete={isLogin ? 'username' : 'email'}
                          autoCapitalize="none"
                          autoCorrect="off"
                          required
                          value={formData.email}
                          onChange={handleInputChange}
                          onInput={handleInputChange}
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
                          type={showPassword ? 'text' : 'password'}
                          autoComplete={isLogin ? 'current-password' : 'new-password'}
                          required
                          value={formData.password}
                          onChange={handleInputChange}
                          onInput={handleInputChange}
                          className="appearance-none relative block w-full px-4 pr-20 py-3 border-2 border-gray-200 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                          placeholder="Enter your password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(prev => !prev)}
                          className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
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

      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true"></div>
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl p-6 sm:p-8 text-center space-y-4">
            <h3 className="text-2xl font-bold text-gray-900">We are really sorry</h3>
            <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
              Last Saturday, a technical issue caused a server crash and we lost all saved credentials. If you had already registered, please create your account again so we can keep you connected. If you are signing up for the first time, you can safely continue to register now.
            </p>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setShowRecoveryModal(false); }}
              className="w-full inline-flex justify-center items-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm sm:text-base font-semibold text-white shadow-lg hover:from-emerald-600 hover:to-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              Go to registration
            </button>
          </div>
        </div>
      )}

      {showOnboardingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true"></div>
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl p-6 sm:p-8 space-y-4">
            <h3 className="text-2xl font-bold text-gray-900 text-center">Complete Your Profile</h3>
            <p className="text-sm sm:text-base text-gray-700 text-center">
              Optional: update your profile details now, or skip and continue.
            </p>

            <form className="space-y-4" onSubmit={handleOnboardingSubmit}>
              <div>
                <label htmlFor="onboarding-gender" className="block text-sm font-semibold text-gray-700 mb-2">
                  Gender (Optional)
                </label>
                <select
                  id="onboarding-gender"
                  value={onboardingData.gender}
                  onChange={(e) => setOnboardingData((prev) => ({ ...prev, gender: e.target.value }))}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div>
                <label htmlFor="onboarding-madhab" className="block text-sm font-semibold text-gray-700 mb-2">
                  School of Thought (Optional)
                </label>
                <select
                  id="onboarding-madhab"
                  value={onboardingData.madhab}
                  onChange={(e) => setOnboardingData((prev) => ({ ...prev, madhab: e.target.value }))}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Prefer not to say</option>
                  <option value="hanafi">Hanafi</option>
                  <option value="shafi">Shafi</option>
                  <option value="maliki">Maliki</option>
                  <option value="hanbali">Hanbali</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={onboardingSaving}
                  onClick={completeOnboardingAndContinue}
                  className="w-full inline-flex justify-center items-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm sm:text-base font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={onboardingSaving}
                  className="w-full inline-flex justify-center items-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm sm:text-base font-semibold text-white shadow-lg hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50"
                >
                  {onboardingSaving ? 'Saving...' : 'Save Info'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Auth;
