import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { API_URL } from '../config';
import { getPushDeviceId, getStoredPushToken, storePushToken } from '../firebase';

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
  login: (email: string, password: string) => Promise<{ passwordChangeRequired: boolean }>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (roles: string[]) => boolean; // Add role check helper definition
}

const AUTH_FETCH_TIMEOUT_MS = 15000;

const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = AUTH_FETCH_TIMEOUT_MS): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const getJwtExpiryMs = (token: string): number | null => {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }

    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
    const decodedPayload = JSON.parse(window.atob(paddedPayload)) as { exp?: number };

    return typeof decodedPayload.exp === 'number'
      ? decodedPayload.exp * 1000
      : null;
  } catch {
    return null;
  }
};

const isJwtExpired = (token: string, clockSkewMs = 30_000): boolean => {
  const expiryMs = getJwtExpiryMs(token);
  if (!expiryMs) {
    return false;
  }

  return Date.now() >= expiryMs - clockSkewMs;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  // Tracks the initial session check only. AppContent swaps the whole router for a
  // spinner while this is true, so sign-in requests must not toggle it.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mapUser = (apiUser: any): User => {
      const firstName = typeof apiUser.firstName === 'string' ? apiUser.firstName.trim() : '';
      const lastName = typeof apiUser.lastName === 'string' ? apiUser.lastName.trim() : '';
      const composedName = `${firstName} ${lastName}`.trim();
      const fallbackName =
        typeof apiUser.name === 'string' && apiUser.name.trim().length > 0
          ? apiUser.name.trim()
          : typeof apiUser.username === 'string' && apiUser.username.trim().length > 0
            ? apiUser.username.trim()
            : 'User';

      return {
        id: apiUser._id || apiUser.id,
        name: composedName || fallbackName,
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

  const persistUser = (apiUser: any) => {
    setUser(mapUser(apiUser));
    try {
      localStorage.setItem('user', JSON.stringify(apiUser));
    } catch {
      // Avatars are data URLs, so this cache can exceed the storage quota. The
      // in-memory user stays authoritative; the cache is only a warm-start hint.
      localStorage.removeItem('user');
    }
  };

  const clearSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const fetchProfile = async (): Promise<boolean> => {
    const token = localStorage.getItem('token');
    if (!token) return false;

    const response = await fetchWithTimeout(`${API_URL}/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Profile request failed (${response.status})`);
    }

    const data = await response.json();
    if (!data?.data?.user) {
      throw new Error('Profile response missing user');
    }

    persistUser(data.data.user);
    return true;
  };

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (token && isJwtExpired(token)) {
        clearSession();
        return;
      }

      // Only set user from localStorage if we have a token
      // Otherwise wait for API validation
      if (token && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(mapUser(parsedUser));
        } catch (e) {
          localStorage.removeItem('user');
        }
      }

      if (token) {
        try {
            await fetchProfile();
        } catch (err) {
            console.error("Failed to fetch profile", err);
            clearSession();
        }
      } else {
        // No token - clear any stored user data
        localStorage.removeItem('user');
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ passwordChangeRequired: boolean }> => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await fetchWithTimeout(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.passwordChangeRequired) {
          if (data.token) {
            localStorage.setItem('token', data.token);
          }
          return { passwordChangeRequired: true };
        }

        localStorage.setItem('token', data.token);

        if (data.user) {
          persistUser(data.user);
          // Older backends return identity fields only, so top the profile up in
          // the background rather than making the caller wait for a second call.
          void fetchProfile().catch((err) => {
            console.error('Failed to refresh profile after login', err);
          });
        } else {
          await fetchProfile();
        }

        return { passwordChangeRequired: false };
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const [firstName, ...lastNameParts] = name.split(' ');
      const lastName = lastNameParts.join(' ') || 'User';

      const response = await fetchWithTimeout(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            firstName, 
            lastName, 
            email: normalizedEmail, 
            password,
            username: normalizedEmail.split('@')[0] + Math.floor(Math.random() * 1000) 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        if (data.user) {
          persistUser(data.user);
        } else {
          await fetchProfile();
        }
      } else {
        throw new Error(data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = () => {
    const authToken = localStorage.getItem('token');
    const pushToken = getStoredPushToken();
    const deviceId = getPushDeviceId();

    if (authToken && (pushToken || deviceId)) {
      void fetch(`${API_URL}/notifications/token`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token: pushToken,
          deviceId,
        }),
      }).catch((error) => {
        console.error('Failed to remove FCM token during logout:', error);
      });
    }

    storePushToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
