import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { onMessageListener } from '../firebase';
import { toast } from 'react-hot-toast';
import { MessagePayload } from 'firebase/messaging';
import { API_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import { playAdhanAudio, setupAdhanAudioUnlock } from '../utils/adhanAudio';

export interface Notification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'alert' | 'success';
  data?: any;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  addSystemNotification: (title: string, body: string, type?: 'info' | 'alert' | 'success', data?: any) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
const STORAGE_KEY = 'notifications';
const SW_MESSAGE_TYPE = 'HIKMAH_BACKGROUND_NOTIFICATION';
const PLAY_ADHAN_MESSAGE_TYPE = 'HIKMAH_PLAY_ADHAN';
const MONGO_OBJECT_ID_REGEX = /^[a-f0-9]{24}$/i;

interface BackgroundNotificationPayload {
  id?: string;
  messageId?: string;
  title?: string;
  body?: string;
  timestamp?: string;
  data?: Record<string, string>;
  type?: Notification['type'];
}

interface ServiceWorkerMessageData {
  type: string;
  payload?: BackgroundNotificationPayload;
}

const parseStoredNotifications = (): Notification[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse notifications from local storage', error);
    return [];
  }
};

const isServerNotificationId = (id: string): boolean => MONGO_OBJECT_ID_REGEX.test(id);

const getDataString = (data: any, key: string): string => {
  const value = data?.[key];
  return typeof value === 'string' ? value.trim() : '';
};

const getDedupKey = (notification: Notification): string => {
  return getDataString(notification.data, 'notificationId') || notification.id;
};

const getProcessedKeys = (notification: Notification): string[] => {
  return Array.from(new Set([
    notification.id,
    getDataString(notification.data, 'notificationId'),
  ].filter(Boolean)));
};

const areLikelySameNotification = (first: Notification, second: Notification): boolean => {
  if (getDedupKey(first) === getDedupKey(second)) {
    return true;
  }

  if (getDataString(first.data, 'notificationId') || getDataString(second.data, 'notificationId')) {
    return false;
  }

  const firstMeetingId = getDataString(first.data, 'meetingId');
  const secondMeetingId = getDataString(second.data, 'meetingId');
  const firstType = getDataString(first.data, 'type');
  const secondType = getDataString(second.data, 'type');

  if (!firstMeetingId || firstMeetingId !== secondMeetingId || firstType !== secondType) {
    return false;
  }

  const firstTime = new Date(first.timestamp).getTime();
  const secondTime = new Date(second.timestamp).getTime();
  const timestampsAreClose = !Number.isNaN(firstTime)
    && !Number.isNaN(secondTime)
    && Math.abs(firstTime - secondTime) <= 10 * 60 * 1000;

  return timestampsAreClose && first.title === second.title && first.body === second.body;
};

const mergeNotificationPair = (first: Notification, second: Notification): Notification => {
  const firstIsServerNotification = isServerNotificationId(first.id);
  const secondIsServerNotification = isServerNotificationId(second.id);
  const firstTime = new Date(first.timestamp).getTime();
  const secondTime = new Date(second.timestamp).getTime();
  const secondIsNewer = Number.isNaN(firstTime) || (!Number.isNaN(secondTime) && secondTime >= firstTime);
  const preferSecond = secondIsServerNotification || (!firstIsServerNotification && secondIsNewer);
  const preferred = preferSecond ? second : first;
  const fallback = preferSecond ? first : second;

  return {
    ...fallback,
    ...preferred,
    read: first.read || second.read,
    data: { ...(fallback.data || {}), ...(preferred.data || {}) },
  };
};

const mergeNotifications = (incoming: Notification[], existing: Notification[]): Notification[] => {
  const mergedNotifications: Notification[] = [];

  for (const notification of [...incoming, ...existing]) {
    const existingIndex = mergedNotifications.findIndex((existingNotification) => (
      areLikelySameNotification(existingNotification, notification)
    ));

    if (existingIndex === -1) {
      mergedNotifications.push(notification);
      continue;
    }

    mergedNotifications[existingIndex] = mergeNotificationPair(mergedNotifications[existingIndex], notification);
  }

  return mergedNotifications.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
};

type ApiHistoryNotification = {
  _id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  read?: boolean;
  createdAt?: string;
};

const toClientNotification = (row: ApiHistoryNotification): Notification => ({
  id: row._id,
  title: row.title || 'New Notification',
  body: row.body || '',
  timestamp: row.createdAt || new Date().toISOString(),
  read: row.read === true,
  type: 'info',
  data: row.data || {},
});

const createNotificationFromPayload = (payload: MessagePayload): Notification => {
  const generatedId = `fcm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: payload.data?.notificationId || payload.messageId || generatedId,
    title: payload.notification?.title || payload.data?.title || 'New Notification',
    body: payload.notification?.body || payload.data?.body || '',
    timestamp: new Date().toISOString(),
    read: false,
    type: 'info',
    data: payload.data
  };
};

const createNotificationFromServiceWorkerPayload = (payload: BackgroundNotificationPayload): Notification => {
  const generatedId = `sw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: payload.id || payload.messageId || generatedId,
    title: payload.title || payload.data?.title || 'New Notification',
    body: payload.body || payload.data?.body || '',
    timestamp: payload.timestamp || new Date().toISOString(),
    read: false,
    type: payload.type || 'info',
    data: payload.data
  };
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>(() => mergeNotifications(parseStoredNotifications(), []));
  const processedNotificationIdsRef = useRef(new Set(parseStoredNotifications().flatMap(getProcessedKeys)));

  const unreadCount = notifications.filter(n => !n.read).length;
  const addNotification = useCallback((newNotification: Notification) => {
    setNotifications(prev => {
      return mergeNotifications([newNotification], prev);
    });
  }, []);

  const syncServerHistory = useCallback(async () => {
    if (!user) {
      return;
    }

    const authToken = localStorage.getItem('token');
    if (!authToken) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/notifications/history?limit=300`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const payload = await response.json();
      if (!response.ok || payload?.status !== 'success') {
        return;
      }

      const serverRows: ApiHistoryNotification[] = Array.isArray(payload?.data?.notifications)
        ? payload.data.notifications
        : [];
      const serverNotifications = serverRows.map(toClientNotification);

      setNotifications((prev) => {
        const merged = mergeNotifications(serverNotifications, prev);
        processedNotificationIdsRef.current = new Set(merged.flatMap(getProcessedKeys));
        return merged;
      });
    } catch (error) {
      console.error('Failed to sync notification history', error);
    }
  }, [user]);

  const shouldProcessNotification = useCallback((notification: Notification) => {
    const keys = getProcessedKeys(notification);
    if (keys.some((key) => processedNotificationIdsRef.current.has(key))) {
      return false;
    }

    keys.forEach((key) => processedNotificationIdsRef.current.add(key));
    return true;
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(e => console.log('Audio play failed (user interaction might be needed)', e));
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }, []);

  const isAdhanPayload = useCallback((payload: MessagePayload | Notification | BackgroundNotificationPayload | null | undefined) => {
    const dataType = (payload as any)?.data?.type || (payload as any)?.type;
    return dataType === 'adhan' || (payload as any)?.data?.playAdhan === '1';
  }, []);

  const showNativeNotification = useCallback((payload: MessagePayload) => {
    if (!('Notification' in window)) {
      return;
    }

    // Adhan OS tray is shown by the service worker (single notification).
    if (isAdhanPayload(payload)) {
      return;
    }

    if (Notification.permission === 'granted') {
      const title = payload.notification?.title || payload.data?.title || 'New Notification';
      const options: NotificationOptions = {
        body: payload.notification?.body || payload.data?.body || '',
        icon: '/small_logo.jpeg',
        tag: payload.data?.notificationId || payload.messageId || undefined,
        data: payload.data
      };
      try {
        new Notification(title, options);
      } catch (e) {
        console.error('Native notification failed:', e);
      }
    }
  }, [isAdhanPayload]);

  useEffect(() => {
    // Save to local storage whenever notifications change
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    setupAdhanAudioUnlock();
  }, []);

  // Play Adhan when user taps a background notification, or opens /prayers?playAdhan=1
  useEffect(() => {
    const playFromQuery = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('playAdhan') === '1') {
          playAdhanAudio();
          params.delete('playAdhan');
          const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
          window.history.replaceState({}, '', next);
        }
      } catch {
        // ignore
      }
    };

    playFromQuery();

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === PLAY_ADHAN_MESSAGE_TYPE) {
        playAdhanAudio();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      processedNotificationIdsRef.current = new Set();
      return;
    }

    void syncServerHistory();
    const historyInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void syncServerHistory();
      }
    }, 60 * 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncServerHistory();
      }
    };
    const onOnline = () => void syncServerHistory();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);

    return () => {
      window.clearInterval(historyInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
    };
  }, [syncServerHistory, user]);

  useEffect(() => {
    const unsubscribe = onMessageListener((payload: MessagePayload) => {
      console.log('Received foreground message in Context: ', payload);
      const notification = createNotificationFromPayload(payload);

      if (!shouldProcessNotification(notification)) {
        return;
      }

      // Adhan while app is open: client scheduler already plays full Adhan + toast.
      // Skip short ping + OS tray to avoid duplicate Chrome/mobile popups.
      if (!isAdhanPayload(payload)) {
        playNotificationSound();
        showNativeNotification(payload);
      }
      addNotification(notification);

      if (document.visibilityState !== 'visible') {
        return;
      }

      if (isAdhanPayload(payload)) {
        return;
      }

      // Show Toast (Custom UI)
      toast.custom((t) => (
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 cursor-pointer`}
          onClick={() => {
            toast.dismiss(t.id);
          }}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <img
                  className="h-10 w-10 rounded-full"
                  src="/small_logo.jpeg"
                  alt="App Logo"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40';
                  }}
                />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {payload.notification?.title || payload.data?.title || 'New Notification'}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {payload.notification?.body || payload.data?.body || ''}
                </p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-gray-200">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toast.dismiss(t.id);
              }}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Close
            </button>
          </div>
        </div>
      ), { duration: 5000 });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [addNotification, isAdhanPayload, playNotificationSound, shouldProcessNotification, showNativeNotification]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const handleServiceWorkerMessage = (event: MessageEvent<ServiceWorkerMessageData>) => {
      if (!event.data || event.data.type !== SW_MESSAGE_TYPE || !event.data.payload) {
        return;
      }

      const notificationFromSw = createNotificationFromServiceWorkerPayload(event.data.payload);

      if (!shouldProcessNotification(notificationFromSw)) {
        return;
      }

      addNotification(notificationFromSw);
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [addNotification, shouldProcessNotification]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );

    if (!isServerNotificationId(id)) {
      return;
    }

    const authToken = localStorage.getItem('token');
    if (!authToken) {
      return;
    }

    try {
      await fetch(`${API_URL}/notifications/history/${id}/read`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
    } catch (error) {
      console.error('Failed to mark notification as read', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success('All notifications marked as read');

    const authToken = localStorage.getItem('token');
    if (!authToken || !user) {
      return;
    }

    try {
      await fetch(`${API_URL}/notifications/history/read-all`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
    } catch (error) {
      console.error('Failed to mark all notifications as read', error);
    }
  }, [user]);

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));

    if (!isServerNotificationId(id)) {
      return;
    }

    const authToken = localStorage.getItem('token');
    if (!authToken) {
      return;
    }

    try {
      await fetch(`${API_URL}/notifications/history/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
    } catch (error) {
      console.error('Failed to delete notification', error);
    }
  }, []);

  const addSystemNotification = useCallback((title: string, body: string, type: 'info' | 'alert' | 'success' = 'info', data?: any) => {
    const stableId = typeof data?.notificationId === 'string' && data.notificationId.trim()
      ? data.notificationId.trim()
      : `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const notification: Notification = {
      id: stableId,
      title,
      body,
      timestamp: new Date().toISOString(),
      read: false,
      type,
      data
    };

    if (!shouldProcessNotification(notification)) {
      return;
    }

    addNotification(notification);

    // Skip OS tray for Adhan — FCM/service worker owns the single system popup.
    // This prevents "Chrome notification + mobile notification" doubles.
    if (data?.type === 'adhan') {
      return;
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new window.Notification(title, {
          body,
          icon: '/small_logo.jpeg',
          tag: stableId,
          data
        });
      } catch (e) {
        console.error('Native notification failed:', e);
      }
    }
  }, [addNotification, shouldProcessNotification]);

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      markAsRead, 
      markAllAsRead, 
      deleteNotification,
      addSystemNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
