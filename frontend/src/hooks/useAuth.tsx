import { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from 'react';
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
  sessionStatus: 'ready' | 'reconnecting';
}

// Render Free cold starts commonly take close to a minute. Profile validation
// runs in the background, so allow the wake request to finish without blocking
// cached UI or converting a timeout into a logout.
const AUTH_FETCH_TIMEOUT_MS = 75000;
const PROFILE_RETRY_DELAYS_MS = [0, 2000] as const;

class ProfileRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ProfileRequestError';
    this.status = status;
  }
}

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

const isDefinitiveAuthFailure = (error: unknown): boolean =>
  error instanceof ProfileRequestError
  && (error.status === 401 || error.status === 403);

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  // Tracks the initial session check only. AppContent swaps the whole router for a
  // spinner while this is true, so sign-in requests must not toggle it.
  const [loading, setLoading] = useState(true);
  const [sessionStatus, setSessionStatus] = useState<'ready' | 'reconnecting'>('ready');
  const profileSyncRef = useRef<Promise<boolean> | null>(null);

  const mapUser = useCallback((apiUser: any): User => {
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
        madhab: apiUser.preferences?.madhab || apiUser.madhab,
        bio: apiUser.profile?.bio || apiUser.bio,
        avatar: apiUser.profile?.avatar || apiUser.avatar
      };
  }, []);

  const persistUser = useCallback((apiUser: any) => {
    const mappedUser = mapUser(apiUser);
    setUser(mappedUser);
    try {
      // Cache the compact UI shape rather than the full API document. Large
      // profile payloads previously exceeded localStorage and removed warm start.
      const cacheUser = {
        ...mappedUser,
        avatar: mappedUser.avatar?.startsWith('data:') ? undefined : mappedUser.avatar,
      };
      localStorage.setItem('user', JSON.stringify(cacheUser));
    } catch {
      // In-memory identity remains valid; never delete the auth token because a
      // best-effort profile cache could not be written.
    }
  }, [mapUser]);

  const clearSession = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setSessionStatus('ready');
  }, []);

  const fetchProfile = useCallback(async (): Promise<boolean> => {
    const token = localStorage.getItem('token');
    if (!token) return false;

    const response = await fetchWithTimeout(`${API_URL}/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ProfileRequestError(`Profile request failed (${response.status})`, response.status);
    }

    const data = await response.json();
    if (!data?.data?.user) {
      throw new Error('Profile response missing user');
    }

    // Logout or account switching may happen while a slow cold-start request
    // is in flight. Never restore a profile for a token that is no longer active.
    if (localStorage.getItem('token') !== token) {
      return false;
    }

    persistUser(data.data.user);
    return true;
  }, [persistUser]);

  const syncProfileWithRecovery = useCallback((): Promise<boolean> => {
    if (profileSyncRef.current) {
      return profileSyncRef.current;
    }

    const syncPromise = (async () => {
      setSessionStatus('reconnecting');
      let lastError: unknown;

      for (let attempt = 0; attempt < PROFILE_RETRY_DELAYS_MS.length; attempt += 1) {
        const retryDelay = PROFILE_RETRY_DELAYS_MS[attempt];
        if (retryDelay > 0) {
          await delay(retryDelay);
        }

        if (!navigator.onLine) {
          lastError = new Error('Browser is offline');
          break;
        }

        try {
          const refreshed = await fetchProfile();
          setSessionStatus('ready');
          return refreshed;
        } catch (error) {
          lastError = error;
          if (isDefinitiveAuthFailure(error)) {
            clearSession();
            return false;
          }
        }
      }

      // Timeouts, offline state, rate limits, and server failures are
      // recoverable. Preserve cached identity and retry on foreground/online.
      console.warn('Profile refresh deferred; cached session retained.', lastError);
      setSessionStatus('reconnecting');
      return false;
    })().finally(() => {
      profileSyncRef.current = null;
    });

    profileSyncRef.current = syncPromise;
    return syncPromise;
  }, [clearSession, fetchProfile]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token) {
      localStorage.removeItem('user');
      setUser(null);
      setLoading(false);
      return;
    }

    if (isJwtExpired(token)) {
      clearSession();
      setLoading(false);
      return;
    }

    let restoredFromCache = false;
    if (storedUser) {
      try {
        setUser(mapUser(JSON.parse(storedUser)));
        restoredFromCache = true;
      } catch {
        localStorage.removeItem('user');
      }
    }

    // Cached sessions render immediately. Legacy sessions without a cache get
    // one profile request before the initial spinner is released.
    if (restoredFromCache) {
      setLoading(false);
      void syncProfileWithRecovery();
    } else {
      void syncProfileWithRecovery().finally(() => setLoading(false));
    }
  }, [clearSession, mapUser, syncProfileWithRecovery]);

  useEffect(() => {
    const retryWhenAvailable = () => {
      const currentToken = localStorage.getItem('token');
      if (!currentToken || isJwtExpired(currentToken)) return;
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void syncProfileWithRecovery();
      }
    };

    document.addEventListener('visibilitychange', retryWhenAvailable);
    window.addEventListener('online', retryWhenAvailable);

    return () => {
      document.removeEventListener('visibilitychange', retryWhenAvailable);
      window.removeEventListener('online', retryWhenAvailable);
    };
  }, [syncProfileWithRecovery]);

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
    setSessionStatus('ready');
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
    hasRole,
    sessionStatus,
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
