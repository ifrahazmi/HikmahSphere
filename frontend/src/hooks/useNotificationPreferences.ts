import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { API_URL } from '../config';

interface NotificationPreferences {
  fajr: { enabled: boolean; sound: boolean };
  dhuhr: { enabled: boolean; sound: boolean };
  asr: { enabled: boolean; sound: boolean };
  maghrib: { enabled: boolean; sound: boolean };
  isha: { enabled: boolean; sound: boolean };
}

const DEFAULT_PREFS: NotificationPreferences = {
  fajr: { enabled: true, sound: true },
  dhuhr: { enabled: true, sound: true },
  asr: { enabled: true, sound: true },
  maghrib: { enabled: true, sound: true },
  isha: { enabled: true, sound: true },
};

export const useNotificationPreferences = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    // Try to load from localStorage
    try {
      const saved = localStorage.getItem('hikmah-notification-prefs');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[NotificationPreferences] Failed to parse localStorage:', e);
    }
    return DEFAULT_PREFS;
  });
  const [loading, setLoading] = useState(false);

  // Fetch preferences from backend
  useEffect(() => {
    if (!user || !user.id) return;

    const fetchPreferences = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/users/${user.id}/notification-prefs`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          // Only update if it's a valid object with at least one prayer
          if (data.notificationPreferences && Object.keys(data.notificationPreferences).length > 0) {
            setPreferences(data.notificationPreferences);
            localStorage.setItem('hikmah-notification-prefs', JSON.stringify(data.notificationPreferences));
          } else {
            // Initialize backend if empty by sending defaults
            const newDefaults = { ...DEFAULT_PREFS };
            setPreferences(newDefaults);
            fetch(`${API_URL}/users/${user.id}/notification-prefs`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ notificationPreferences: newDefaults }),
            }).catch(e => console.warn('Failed to init prefs', e));
          }
        } else {
          console.warn('[NotificationPreferences] Backend fetch failed:', response.status);
        }
      } catch (err) {
        console.warn('[NotificationPreferences] Failed to fetch notification preferences:', err);
        // Silently fail - use localStorage/defaults
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [user]);

  const updatePreference = useCallback(
    async (prayer: keyof NotificationPreferences, enabled?: boolean, sound?: boolean) => {
      try {
        // Deep copy to prevent reference mutation issues
        const newPrefs = JSON.parse(JSON.stringify(preferences || DEFAULT_PREFS));
        
        // Initialize if it doesn't exist
        if (!newPrefs[prayer]) {
          newPrefs[prayer] = { enabled: true, sound: true };
        }
        
        if (enabled !== undefined) {
          newPrefs[prayer].enabled = enabled;
        }
        if (sound !== undefined) {
          newPrefs[prayer].sound = sound;
        }

        // Always save to localStorage first (immediate feedback)
        localStorage.setItem('hikmah-notification-prefs', JSON.stringify(newPrefs));
        setPreferences(newPrefs);
        console.log(`[NotificationPreferences] ${prayer}:`, newPrefs[prayer]);

        // Try to sync with backend if user exists
        if (user && user.id) {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_URL}/users/${user.id}/notification-prefs`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ notificationPreferences: newPrefs }),
          });

          if (!response.ok) {
            console.warn('[NotificationPreferences] Backend sync failed:', response.status);
            // Even if backend fails, preferences are saved locally
            return true;
          }
        }
        return true;
      } catch (err) {
        console.error('[NotificationPreferences] Error updating notification preferences:', err);
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

export default useNotificationPreferences;
