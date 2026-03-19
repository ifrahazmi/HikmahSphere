import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2, MailOpen, X, ArrowLeft, User, Calendar } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification, Notification } from '../../contexts/NotificationContext';
import { toast } from 'react-hot-toast';

const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotification();

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

  const handleMarkAllAsRead = () => {
    markAllAsRead();
    toast.success('All notifications marked as read');
  };

  const handleViewHistory = () => {
    setIsOpen(false);
    setShowHistory(true);
  };
  
  const openNotificationDetail = (notification: Notification) => {
      markAsRead(notification.id);
      setSelectedNotification(notification);
      // If we are in the dropdown, close it and open history modal
      if (isOpen) {
          setIsOpen(false);
          setShowHistory(true);
      }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 60000); // minutes

    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };
  
  const formatFullTime = (dateString: string) => {
      return new Date(dateString).toLocaleString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
      });
  };

  if (!user) return null;

  return (
    <>
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
          <div className="fixed inset-x-3 top-20 z-50 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl ring-1 ring-black ring-opacity-5 transition-all sm:absolute sm:right-0 sm:top-full sm:mt-3 sm:w-96 sm:inset-x-auto sm:rounded-xl">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notifications
              </h3>
              <div className="flex gap-2">
                  {unreadCount > 0 && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleMarkAllAsRead(); }}
                      className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-emerald-100"
                    >
                      <Check className="w-3 h-3" />
                      Mark all read
                    </button>
                  )}
              </div>
            </div>

            {/* List */}
            <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto custom-scrollbar sm:max-h-[60vh]">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <MailOpen className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.slice(0, 5).map((notification) => ( // Show only recent 5 in dropdown
                    <div 
                      key={notification.id}
                      onClick={() => openNotificationDetail(notification)}
                      className={`group px-4 py-3 hover:bg-gray-50 transition-colors relative cursor-pointer ${!notification.read ? 'bg-emerald-50/30' : ''}`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
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
                          <div className="mt-1 flex items-center text-[10px] text-gray-400">
                             <User className="w-3 h-3 mr-1" /> Admin
                          </div>
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
              <button 
                onClick={handleViewHistory}
                className="text-xs text-gray-500 hover:text-emerald-600 transition-colors font-medium w-full block py-2 hover:bg-gray-100 rounded"
              >
                View all history
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History Modal */}
      {showHistory && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity sm:p-4"
          onClick={() => setShowHistory(false)}
        >
          <div 
            className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl animate-in zoom-in-95 duration-200 sm:h-[85vh] sm:max-w-2xl sm:rounded-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                  {selectedNotification ? (
                    <button 
                        onClick={() => setSelectedNotification(null)}
                        className="p-1.5 hover:bg-gray-200 rounded-full transition-colors group"
                        title="Back to list"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />
                    </button>
                  ) : (
                    <div className="p-2 bg-emerald-100 rounded-lg">
                        <Bell className="w-5 h-5 text-emerald-600" />
                    </div>
                  )}
                  <h2 className="text-lg font-bold text-gray-800">
                    {selectedNotification ? 'Message Details' : 'Notification History'}
                  </h2>
              </div>
              
              <button 
                onClick={() => setShowHistory(false)} 
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="relative flex-1 overflow-y-auto bg-gray-50/30 custom-scrollbar">
              {selectedNotification ? (
                // Detail View
                <div className="animate-in slide-in-from-right-4 duration-300 p-4 sm:p-6 md:p-8">
                   <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8">
                      {/* Decorative background element */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-10 -mt-10 opacity-50" />

                      {/* Sender Info */}
                      <div className="flex items-start gap-4 mb-8 relative z-10">
                         <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center border-4 border-white shadow-sm flex-shrink-0">
                            <User className="w-7 h-7 text-emerald-600" />
                         </div>
                         <div className="flex-1 pt-1">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">Admin</h3>
                                    <p className="text-sm text-emerald-600 font-medium">System Notification</p>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {formatFullTime(selectedNotification.timestamp)}
                                    </div>
                                </div>
                            </div>
                         </div>
                      </div>
                      
                      {/* Content */}
                      <div className="relative z-10 border-t border-gray-100 pt-6">
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-6 leading-tight">
                            {selectedNotification.title}
                        </h1>
                        <div className="prose prose-emerald max-w-none text-gray-600 leading-relaxed whitespace-pre-wrap font-sans text-base">
                            {selectedNotification.body}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="relative z-10 mt-10 flex flex-col gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                        <button 
                            onClick={() => setSelectedNotification(null)}
                            className="rounded-lg px-4 py-2 text-left text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                        >
                            Back to list
                        </button>
                        <button 
                            onClick={() => {
                                deleteNotification(selectedNotification.id);
                                setSelectedNotification(null);
                                toast.success('Message deleted');
                            }}
                            className="flex items-center gap-2 rounded-lg border border-transparent px-5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:border-red-100 hover:bg-red-50 hover:text-red-700"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Message
                        </button>
                      </div>
                   </div>
                </div>
              ) : (
                // List View
                <div className="min-h-full space-y-3 p-4 md:p-6">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <MailOpen className="w-10 h-10 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-600 mb-1">No notifications</h3>
                            <p className="text-sm">You're all caught up!</p>
                        </div>
                    ) : (
                        notifications.map((n) => (
                            <div 
                                key={n.id} 
                                onClick={() => openNotificationDetail(n)} 
                                className={`group relative overflow-hidden rounded-xl border bg-white p-4 transition-all duration-200 cursor-pointer active:scale-[0.99] sm:p-5 sm:hover:-translate-y-0.5 sm:hover:shadow-md ${
                                    n.read ? 'border-gray-100' : 'border-emerald-200 shadow-sm ring-1 ring-emerald-50'
                                }`}
                            >
                                {/* Left colored border for unread */}
                                {!n.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />}

                                <div className="flex justify-between items-start mb-2 pl-2">
                                    <div className="flex-1 pr-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className={`text-sm md:text-base font-bold ${n.read ? 'text-gray-700' : 'text-emerald-900'}`}>
                                                {n.title}
                                            </h4>
                                            {!n.read && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                                                    NEW
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-sm line-clamp-2 ${n.read ? 'text-gray-500' : 'text-gray-600'}`}>
                                            {n.body}
                                        </p>
                                    </div>
                                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 mt-1">
                                        {formatTime(n.timestamp)}
                                    </span>
                                </div>
                                
                                <div className="mt-3 pl-2 flex items-center justify-between border-t border-gray-50 pt-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center">
                                            <User className="w-3 h-3 text-gray-500" />
                                        </div>
                                        <span className="text-xs text-gray-500 font-medium">Admin</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-emerald-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                            Read more <ArrowLeft className="w-3 h-3 rotate-180" />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationBell;
