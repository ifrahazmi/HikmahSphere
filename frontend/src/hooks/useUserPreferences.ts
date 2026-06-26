import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { API_URL } from '../config';

interface UserPreferences {
  asrMethod: 'standard' | 'hanafi';
  language: string;
  darkMode: boolean;
}

export const useUserPreferences = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>({
    asrMethod: (localStorage.getItem('hikmah-asr-method') as 'standard' | 'hanafi') || 'standard',
    language: localStorage.getItem('hikmah-language') || 'en',
    darkMode: localStorage.getItem('hikmah-dark-mode') === 'true',
  });
  const [loading, setLoading] = useState(false);

  // Fetch preferences from backend
  useEffect(() => {
    if (!user || !user.id) return;

    const fetchPreferences = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/users/${user.id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.preferences) {
            setPreferences((prev) => ({
              ...prev,
              ...data.preferences,
            }));
            // Save to localStorage as fallback
            localStorage.setItem('hikmah-asr-method', data.preferences.asrMethod || 'standard');
            localStorage.setItem('hikmah-language', data.preferences.language || 'en');
            localStorage.setItem('hikmah-dark-mode', JSON.stringify(data.preferences.darkMode || false));
          }
        } else {
          console.warn('[UserPreferences] Backend fetch failed:', response.status);
        }
      } catch (err) {
        console.warn('[UserPreferences] Failed to fetch user preferences:', err);
        // Silently fail - use localStorage defaults
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [user]);

  const updatePreference = useCallback(
    async (key: keyof UserPreferences, value: any) => {
      if (!user || !user.id) {
        // Save to localStorage only if no user
        const newPrefs = { ...preferences, [key]: value };
        setPreferences(newPrefs);
        localStorage.setItem(`hikmah-${key === 'asrMethod' ? 'asr-method' : key}`, 
          typeof value === 'object' ? JSON.stringify(value) : value
        );
        return true;
      }

      try {
        const newPrefs = {
          ...preferences,
          [key]: value,
        };

        // Always save to localStorage first (immediate feedback)
        const storageKey = key === 'asrMethod' ? 'hikmah-asr-method' : 
                          key === 'darkMode' ? 'hikmah-dark-mode' :
                          key === 'language' ? 'hikmah-language' : `hikmah-${key}`;
        localStorage.setItem(storageKey, 
          typeof value === 'object' ? JSON.stringify(value) : String(value)
        );
        setPreferences(newPrefs);

        // Try to sync with backend
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/users/${user.id}/preferences`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ preferences: newPrefs }),
        });

        if (!response.ok) {
          console.warn('[UserPreferences] Backend sync failed:', response.status);
          // Even if backend fails, preferences are saved locally
          return true;
        }
        return true;
      } catch (err) {
        console.error('[UserPreferences] Error updating user preferences:', err);
        // Preferences were already saved locally above
        return true;
      }
    },
    [preferences, user]
  );

  return {
    preferences,
    loading,
    updatePreference,
  };
};

export default useUserPreferences;
