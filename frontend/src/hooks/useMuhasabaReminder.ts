import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { API_URL } from '../config';
import { getPushDeviceId, getPushSupportInfo, requestForToken, storePushToken } from '../firebase';
import { useAuth } from './useAuth';
import {
  DEFAULT_MUHASABA_REMINDER_TIME,
  MUHASABA_REMINDER_STORAGE_KEY,
  normalizeMuhasabaReminderTime,
} from '../utils/muhasabaReminder';

const REMINDER_SYNC_EVENT = 'hikmahsphere:muhasaba-reminder';

const getDeviceTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
};

export const readMuhasabaReminderCache = (): { enabled: boolean; time: string } => {
  try {
    const raw = localStorage.getItem(MUHASABA_REMINDER_STORAGE_KEY);
    if (!raw) return { enabled: false, time: DEFAULT_MUHASABA_REMINDER_TIME };
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed?.enabled),
      time: normalizeMuhasabaReminderTime(parsed?.time),
    };
  } catch {
    return { enabled: false, time: DEFAULT_MUHASABA_REMINDER_TIME };
  }
};

export const writeMuhasabaReminderCache = (enabled: boolean, time: string) => {
  const next = { enabled, time: normalizeMuhasabaReminderTime(time) };
  try {
    localStorage.setItem(MUHASABA_REMINDER_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private-mode failures
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REMINDER_SYNC_EVENT, { detail: next }));
  }
};

export const useMuhasabaReminder = (options?: { hydrate?: boolean }) => {
  const hydrateOnMount = options?.hydrate !== false;
  const { user: authUser } = useAuth();
  const cached = readMuhasabaReminderCache();
  const [enabled, setEnabled] = useState(cached.enabled);
  const [time, setTime] = useState(cached.time);
  const [isSaving, setIsSaving] = useState(false);
  const timeSaveTimeoutRef = useRef<number | null>(null);

  const persist = useCallback(async (next: { enabled: boolean; time: string }) => {
    const token = localStorage.getItem('token');
    if (!authUser?.id || !token) return false;

    const nextTime = normalizeMuhasabaReminderTime(next.time);
    const timezone = getDeviceTimezone();
    setIsSaving(true);

    try {
      const response = await fetch(`${API_URL}/salah-tracker/reminder`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          enabled: next.enabled,
          time: nextTime,
          ...(timezone ? { timezone } : {}),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || `Reminder save failed: ${response.status}`);
      }

      const savedEnabled = Boolean(payload?.data?.enabled);
      const savedTime = normalizeMuhasabaReminderTime(payload?.data?.time, nextTime);
      setEnabled(savedEnabled);
      setTime(savedTime);
      writeMuhasabaReminderCache(savedEnabled, savedTime);
      return true;
    } catch (error) {
      console.error('Failed to save Muhasabah reminder settings:', error);
      toast.error('Could not save the daily reminder. Please try again.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [authUser?.id]);

  const registerPushTokenForReminders = useCallback(async () => {
    const authToken = localStorage.getItem('token');
    if (!authUser?.id || !authToken) return;

    try {
      const pushSupport = await getPushSupportInfo();
      const token = await requestForToken();
      if (!token) return;
      storePushToken(token);
      await fetch(`${API_URL}/notifications/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token,
          deviceId: getPushDeviceId(),
          userAgent: navigator.userAgent,
          permission: typeof Notification !== 'undefined' ? Notification.permission : 'unknown',
          capability: {
            supportsWebPush: pushSupport.supported,
            isIOS: pushSupport.isIOS,
            isStandalone: pushSupport.isStandalone,
          },
          visibilityState: document.visibilityState,
          heartbeatAt: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to register push token for Muhasabah reminders:', error);
    }
  }, [authUser?.id]);

  useEffect(() => {
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean; time?: string }>).detail;
      if (!detail) return;
      setEnabled(Boolean(detail.enabled));
      setTime(normalizeMuhasabaReminderTime(detail.time));
    };

    window.addEventListener(REMINDER_SYNC_EVENT, onSync);
    return () => window.removeEventListener(REMINDER_SYNC_EVENT, onSync);
  }, []);

  useEffect(() => {
    if (!hydrateOnMount) return;

    let isCancelled = false;
    const token = localStorage.getItem('token');
    if (!authUser?.id || !token) {
      return;
    }

    const hydrateReminder = async () => {
      try {
        const response = await fetch(`${API_URL}/salah-tracker/reminder`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Reminder fetch failed: ${response.status}`);
        }

        const payload = await response.json();
        if (isCancelled) return;

        const nextEnabled = Boolean(payload?.data?.enabled);
        const nextTime = normalizeMuhasabaReminderTime(payload?.data?.time);
        setEnabled(nextEnabled);
        setTime(nextTime);
        writeMuhasabaReminderCache(nextEnabled, nextTime);

        const timezone = getDeviceTimezone();
        if (nextEnabled && timezone) {
          await fetch(`${API_URL}/salah-tracker/reminder`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ timezone }),
          });
        }
      } catch (error) {
        console.error('Failed to load Muhasabah reminder settings:', error);
      }
    };

    void hydrateReminder();

    return () => {
      isCancelled = true;
    };
  }, [authUser?.id, hydrateOnMount]);

  useEffect(() => {
    return () => {
      if (timeSaveTimeoutRef.current) {
        window.clearTimeout(timeSaveTimeoutRef.current);
      }
    };
  }, []);

  const toggle = useCallback(async () => {
    if (isSaving || !authUser?.id) return;

    if (!enabled) {
      if (typeof Notification === 'undefined') {
        toast.error('Notifications are not supported in this browser.');
        return;
      }

      if (Notification.permission === 'denied') {
        toast.error('Notifications are blocked. Enable them from browser settings.');
        return;
      }

      if (Notification.permission !== 'granted') {
        const result = await Notification.requestPermission();
        if (result !== 'granted') {
          toast.error('Notification permission was not granted.');
          return;
        }
      }

      void registerPushTokenForReminders();
      const saved = await persist({ enabled: true, time });
      if (saved) {
        toast.success('Daily Muhasabah reminder enabled.');
      }
      return;
    }

    const saved = await persist({ enabled: false, time });
    if (saved) {
      toast.success('Daily reminder turned off.');
    }
  }, [authUser?.id, enabled, isSaving, persist, registerPushTokenForReminders, time]);

  const changeTime = useCallback((value: string) => {
    const nextTime = normalizeMuhasabaReminderTime(value);
    setTime(nextTime);
    writeMuhasabaReminderCache(enabled, nextTime);

    if (timeSaveTimeoutRef.current) {
      window.clearTimeout(timeSaveTimeoutRef.current);
    }

    timeSaveTimeoutRef.current = window.setTimeout(() => {
      void persist({ enabled, time: nextTime });
    }, 400);
  }, [enabled, persist]);

  return {
    isSignedIn: Boolean(authUser?.id),
    enabled,
    time,
    isSaving,
    toggle,
    changeTime,
  };
};
