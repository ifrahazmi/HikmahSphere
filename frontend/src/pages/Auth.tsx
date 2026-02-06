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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-24 w-24 flex items-center justify-center rounded-full bg-white shadow-md overflow-hidden p-2">
             <img src="/nav_logo.jpeg" alt="HikmahSphere Logo" className="h-full w-full object-cover" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {showPasswordChange ? 'Change Password' : (isLogin ? 'Sign in to your account' : 'Create your account')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {showPasswordChange ? 'Please set a new password for your account' : 'Join the global Muslim community'}
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            
            {showPasswordChange && (
                 <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                    New Password
                    </label>
                    <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 focus:z-10 sm:text-sm"
                    placeholder="Enter new password (min 6 chars)"
                    />
                </div>
            )}

            {!showPasswordChange && !isLogin && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required={!isLogin}
                  value={formData.name}
                  onChange={handleInputChange}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your full name"
                />
              </div>
            )}
            
            {!showPasswordChange && (
                <>
                <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 focus:z-10 sm:text-sm"
                    placeholder="Enter your email"
                />
                </div>
                
                <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 focus:z-10 sm:text-sm"
                    placeholder="Enter your password"
                />
                </div>
                </>
            )}
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              {showPasswordChange ? 'Update Password' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </div>

          {!showPasswordChange && (
            <div className="text-center">
                <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-emerald-600 hover:text-emerald-500 font-medium"
                >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
            </div>
          )}
        </form>

        <div className="text-center">
          <p className="text-xs text-gray-500 font-arabic">"وَقُل رَّبِّ زِدْنِي عِلْمًا"</p>
          <p className="text-xs text-gray-400 italic mt-1">"And say, My Lord, increase me in knowledge" - Quran 20:114</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
