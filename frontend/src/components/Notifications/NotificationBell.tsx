import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2, MailOpen } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';

interface Notification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'alert' | 'success';
}

// Mock notifications for demonstration (replace with API call later)
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'Welcome to HikmahSphere',
    body: 'Assalamu Alaikum! Welcome to our community platform.',
    timestamp: new Date().toISOString(),
    read: false,
    type: 'success'
  },
  {
    id: '2',
    title: 'Prayer Time Alert',
    body: 'Asr prayer time is approaching in 15 minutes.',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    read: true,
    type: 'info'
  }
];

const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 60000); // minutes

    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-xl shadow-2xl ring-1 ring-black ring-opacity-5 transform origin-top-right transition-all z-50 overflow-hidden border border-emerald-100">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1 transition-colors"
              >
                <Check className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <MailOpen className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id}
                    className={`group px-4 py-3 hover:bg-gray-50 transition-colors relative ${!notification.read ? 'bg-emerald-50/30' : ''}`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div 
                        className="flex-1 cursor-pointer" 
                        onClick={() => markAsRead(notification.id)}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`text-sm font-medium ${!notification.read ? 'text-emerald-900' : 'text-gray-700'}`}>
                            {notification.title}
                          </h4>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                            {formatTime(notification.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                          {notification.body}
                        </p>
                      </div>

                      {/* Delete Action (appears on hover) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    {/* Unread Indicator */}
                    {!notification.read && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-500 rounded-r-full" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
            <button className="text-xs text-gray-500 hover:text-emerald-600 transition-colors font-medium">
              View all history
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
