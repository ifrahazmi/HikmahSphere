import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { API_URL } from '../config';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isAdmin?: boolean; 
  role?: 'superadmin' | 'manager' | 'user'; // Add Role
  createdAt?: string; 
  gender?: string; 
  phoneNumber?: string; 
  address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
  };
  madhab?: string; 
  bio?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (roles: string[]) => boolean; // Add role check helper definition
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const mapUser = (apiUser: any): User => {
      return {
        id: apiUser._id,
        name: `${apiUser.firstName} ${apiUser.lastName}`,
        email: apiUser.email,
        isAdmin: apiUser.isAdmin,
        role: apiUser.role || (apiUser.isAdmin ? 'superadmin' : 'user'), // Map role
        createdAt: apiUser.createdAt,
        gender: apiUser.gender,
        phoneNumber: apiUser.phoneNumber,
        address: apiUser.address,
        madhab: apiUser.preferences?.madhab,
        bio: apiUser.profile?.bio,
        avatar: apiUser.profile?.avatar
      };
  };

  const checkAuthStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        try {
            const response = await fetch(`${API_URL}/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                 const data = await response.json();
                 if (data && data.data && data.data.user) {
                     setUser(mapUser(data.data.user));
                 } else {
                     localStorage.removeItem('token');
                     setUser(null);
                 }
            } else {
                 localStorage.removeItem('token');
                 setUser(null);
            }
        } catch (err) {
            console.error("Failed to fetch profile", err);
            localStorage.removeItem('token');
            setUser(null);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
         try {
            const profileResponse = await fetch(`${API_URL}/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${data.token}`
                }
            });
            const profileData = await profileResponse.json();
            if (profileData && profileData.data && profileData.data.user) {
                 setUser(mapUser(profileData.data.user));
            } else if (data.user) {
                 setUser({
                    id: data.user.id,
                    name: `${data.user.firstName} ${data.user.lastName}`,
                    email: data.user.email,
                    role: 'user' // Default fallback
                 });
            }
         } catch(e) {
             console.error("Failed to fetch full profile after login", e);
             if (data.user) {
                 setUser({
                    id: data.user.id,
                    name: `${data.user.firstName} ${data.user.lastName}`,
                    email: data.user.email,
                    role: 'user'
                 });
             }
         }

      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      setLoading(true);
      const [firstName, ...lastNameParts] = name.split(' ');
      const lastName = lastNameParts.join(' ') || 'User';

      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            firstName, 
            lastName, 
            email, 
            password,
            username: email.split('@')[0] + Math.floor(Math.random() * 1000) 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        await checkAuthStatus();
      } else {
        throw new Error(data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // Implement hasRole helper
  const hasRole = (roles: string[]) => {
      if (!user || !user.role) return false;
      return roles.includes(user.role);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    hasRole
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
