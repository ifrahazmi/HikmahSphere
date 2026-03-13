import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { onMessageListener } from '../firebase';
import { toast } from 'react-hot-toast';
import { MessagePayload } from 'firebase/messaging';

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
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
const STORAGE_KEY = 'notifications';
const SW_MESSAGE_TYPE = 'HIKMAH_BACKGROUND_NOTIFICATION';

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
  const [notifications, setNotifications] = useState<Notification[]>(parseStoredNotifications);
  const processedNotificationIdsRef = useRef(new Set(parseStoredNotifications().map((notification) => notification.id)));

  const unreadCount = notifications.filter(n => !n.read).length;
  const addNotification = useCallback((newNotification: Notification) => {
    setNotifications(prev => {
      if (prev.some(existing => existing.id === newNotification.id)) {
        return prev;
      }
      return [newNotification, ...prev];
    });
  }, []);

  const shouldProcessNotification = useCallback((notificationId: string) => {
    if (processedNotificationIdsRef.current.has(notificationId)) {
      return false;
    }

    processedNotificationIdsRef.current.add(notificationId);
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

  const showNativeNotification = useCallback((payload: MessagePayload) => {
    if (!('Notification' in window)) {
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
  }, []);

  useEffect(() => {
    // Save to local storage whenever notifications change
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    const unsubscribe = onMessageListener((payload: MessagePayload) => {
      console.log('Received foreground message in Context: ', payload);
      const notification = createNotificationFromPayload(payload);

      if (!shouldProcessNotification(notification.id)) {
        return;
      }

      playNotificationSound();
      showNativeNotification(payload);
      addNotification(notification);

      if (document.visibilityState !== 'visible') {
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
  }, [addNotification, playNotificationSound, shouldProcessNotification, showNativeNotification]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const handleServiceWorkerMessage = (event: MessageEvent<ServiceWorkerMessageData>) => {
      if (!event.data || event.data.type !== SW_MESSAGE_TYPE || !event.data.payload) {
        return;
      }

      const notificationFromSw = createNotificationFromServiceWorkerPayload(event.data.payload);

      if (!shouldProcessNotification(notificationFromSw.id)) {
        return;
      }

      addNotification(notificationFromSw);
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [addNotification, shouldProcessNotification]);

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success('All notifications marked as read');
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      markAsRead, 
      markAllAsRead, 
      deleteNotification 
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
