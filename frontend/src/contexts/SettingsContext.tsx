import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { API_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export interface PrayerNotifications {
  fajr: boolean;
  dhuhr: boolean;
  asr: boolean;
  maghrib: boolean;
  isha: boolean;
  jumuah: boolean;
  advanceMinutes: number;
  sound: 'default' | 'adhan' | 'soft' | 'bird' | 'mosque' | 'silent';
  volume: number;
}

export interface ReminderSettings {
  dhikr: {
    enabled: boolean;
    frequency: 'morning' | 'evening' | 'both' | 'custom';
    customTimes: { time: string; enabled: boolean }[];
  };
  quran: {
    enabled: boolean;
    dailyGoal: number;
    reminderTime: string;
  };
  istikhara: boolean;
  fasting: {
    enabled: boolean;
    remindBeforeSuhoor: boolean;
    remindBeforeIftar: boolean;
    iftarRemindMinutes: number;
  };
}

export interface UserPreferences {
  language: string;
  prayerCalculationMethod: string;
  madhab: 'hanafi' | 'shafi' | 'maliki' | 'hanbali';
  timeFormat: '12h' | '24h';
  theme: 'light' | 'dark' | 'system';
  notifications: {
    prayers: boolean;
    events: boolean;
    community: boolean;
    email: boolean;
    push: boolean;
  };
  prayerNotifications: PrayerNotifications;
  reminders: ReminderSettings;
}

interface SettingsContextType {
  preferences: UserPreferences | null;
  isLoading: boolean;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  updatePrayerNotifications: (prayerNotifs: Partial<PrayerNotifications>) => Promise<void>;
  updateReminders: (reminders: Partial<ReminderSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const defaultPreferences: UserPreferences = {
  language: 'en',
  prayerCalculationMethod: 'MWL',
  madhab: 'hanafi',
  timeFormat: '12h',
  theme: 'system',
  notifications: {
    prayers: true,
    events: true,
    community: true,
    email: false,
    push: true,
  },
  prayerNotifications: {
    fajr: true,
    dhuhr: true,
    asr: true,
    maghrib: true,
    isha: true,
    jumuah: true,
    advanceMinutes: 10,
    sound: 'default',
    volume: 80,
  },
  reminders: {
    dhikr: {
      enabled: false,
      frequency: 'both',
      customTimes: [],
    },
    quran: {
      enabled: false,
      dailyGoal: 5,
      reminderTime: '09:00',
    },
    istikhara: false,
    fasting: {
      enabled: false,
      remindBeforeSuhoor: true,
      remindBeforeIftar: true,
      iftarRemindMinutes: 30,
    },
  },
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPreferences = useCallback(async () => {
    if (!user) {
      setPreferences(null);
      setIsLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.status === 'success' && data.data?.user) {
        const userPrefs = data.data.user.preferences || {};
        setPreferences({
          language: userPrefs.language ?? defaultPreferences.language,
          prayerCalculationMethod: userPrefs.prayerCalculationMethod ?? defaultPreferences.prayerCalculationMethod,
          madhab: userPrefs.madhab ?? defaultPreferences.madhab,
          timeFormat: userPrefs.timeFormat ?? defaultPreferences.timeFormat,
          theme: userPrefs.theme ?? defaultPreferences.theme,
          notifications: {
            prayers: userPrefs.notifications?.prayers ?? defaultPreferences.notifications.prayers,
            events: userPrefs.notifications?.events ?? defaultPreferences.notifications.events,
            community: userPrefs.notifications?.community ?? defaultPreferences.notifications.community,
            email: userPrefs.notifications?.email ?? defaultPreferences.notifications.email,
            push: userPrefs.notifications?.push ?? defaultPreferences.notifications.push,
          },
          prayerNotifications: {
            fajr: userPrefs.prayerNotifications?.fajr ?? defaultPreferences.prayerNotifications.fajr,
            dhuhr: userPrefs.prayerNotifications?.dhuhr ?? defaultPreferences.prayerNotifications.dhuhr,
            asr: userPrefs.prayerNotifications?.asr ?? defaultPreferences.prayerNotifications.asr,
            maghrib: userPrefs.prayerNotifications?.maghrib ?? defaultPreferences.prayerNotifications.maghrib,
            isha: userPrefs.prayerNotifications?.isha ?? defaultPreferences.prayerNotifications.isha,
            jumuah: userPrefs.prayerNotifications?.jumuah ?? defaultPreferences.prayerNotifications.jumuah,
            advanceMinutes: userPrefs.prayerNotifications?.advanceMinutes ?? defaultPreferences.prayerNotifications.advanceMinutes,
            sound: userPrefs.prayerNotifications?.sound ?? defaultPreferences.prayerNotifications.sound,
            volume: userPrefs.prayerNotifications?.volume ?? defaultPreferences.prayerNotifications.volume,
          },
          reminders: {
            dhikr: {
              enabled: userPrefs.reminders?.dhikr?.enabled ?? defaultPreferences.reminders.dhikr.enabled,
              frequency: userPrefs.reminders?.dhikr?.frequency ?? defaultPreferences.reminders.dhikr.frequency,
              customTimes: userPrefs.reminders?.dhikr?.customTimes ?? defaultPreferences.reminders.dhikr.customTimes,
            },
            quran: {
              enabled: userPrefs.reminders?.quran?.enabled ?? defaultPreferences.reminders.quran.enabled,
              dailyGoal: userPrefs.reminders?.quran?.dailyGoal ?? defaultPreferences.reminders.quran.dailyGoal,
              reminderTime: userPrefs.reminders?.quran?.reminderTime ?? defaultPreferences.reminders.quran.reminderTime,
            },
            istikhara: userPrefs.reminders?.istikhara ?? defaultPreferences.reminders.istikhara,
            fasting: {
              enabled: userPrefs.reminders?.fasting?.enabled ?? defaultPreferences.reminders.fasting.enabled,
              remindBeforeSuhoor: userPrefs.reminders?.fasting?.remindBeforeSuhoor ?? defaultPreferences.reminders.fasting.remindBeforeSuhoor,
              remindBeforeIftar: userPrefs.reminders?.fasting?.remindBeforeIftar ?? defaultPreferences.reminders.fasting.remindBeforeIftar,
              iftarRemindMinutes: userPrefs.reminders?.fasting?.iftarRemindMinutes ?? defaultPreferences.reminders.fasting.iftarRemindMinutes,
            },
          },
        });
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchPreferences();
  }, [fetchPreferences]);

  const updatePreferences = useCallback(async (prefs: Partial<UserPreferences>) => {
    if (!user) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(prefs),
      });

      const data = await response.json();
      if (data.status === 'success') {
        setPreferences((prev) => (prev ? { ...prev, ...prefs } : null));
        toast.success('Settings updated successfully!');
        await fetchPreferences();
      } else {
        toast.error(data.message || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Failed to update preferences:', error);
      toast.error('Failed to update settings');
    }
  }, [user, fetchPreferences]);

  const updatePrayerNotifications = useCallback(async (prayerNotifs: Partial<PrayerNotifications>) => {
    await updatePreferences({
      prayerNotifications: {
        ...(preferences?.prayerNotifications || defaultPreferences.prayerNotifications),
        ...prayerNotifs,
      },
    });
  }, [updatePreferences, preferences?.prayerNotifications]);

  const updateReminders = useCallback(async (reminders: Partial<ReminderSettings>) => {
    await updatePreferences({
      reminders: {
        ...(preferences?.reminders || defaultPreferences.reminders),
        ...reminders,
      },
    });
  }, [updatePreferences, preferences?.reminders]);

  const refreshSettings = useCallback(async () => {
    await fetchPreferences();
  }, [fetchPreferences]);

  return (
    <SettingsContext.Provider
      value={{
        preferences,
        isLoading,
        updatePreferences,
        updatePrayerNotifications,
        updateReminders,
        refreshSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
