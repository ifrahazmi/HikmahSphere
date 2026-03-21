import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, User, Check, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface UserSuggestion {
    id: string;
    username: string;
    email: string;
    permission: 'granted' | 'denied' | 'default' | 'unknown';
    preferences: {
        prayers: boolean;
        events: boolean;
        community: boolean;
    };
    hasValidNotificationDevice: boolean;
    isLive: boolean;
    lastSeenAt: string | null;
}

const formatPermissionLabel = (permission: UserSuggestion['permission']) => {
    if (permission === 'granted') return 'Permission Granted';
    if (permission === 'denied') return 'Permission Denied';
    if (permission === 'default') return 'Permission Default';
    return 'Permission Unknown';
};

const formatLastSeen = (value: string | null) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const AdminNotificationPanel = () => {
    const [targetType, setTargetType] = useState<'broadcast' | 'user'>('broadcast');
    const [userId, setUserId] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserSuggestion | null>(null);
    const [usernameInput, setUsernameInput] = useState('');
    const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(false);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Use relative URL to leverage package.json proxy
    const API_URL = '/api';

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch user suggestions with debounce
    useEffect(() => {
        if (!usernameInput || usernameInput.length < 1 || targetType !== 'user') {
            setSuggestions([]);
            return;
        }

        setIsLoadingSuggestions(true);
        const debounceTimer = setTimeout(async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get(`${API_URL}/notifications/search-users`, {
                    params: { query: usernameInput },
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.data.status === 'success') {
                    setSuggestions(response.data.data);
                    setShowSuggestions(true);
                }
            } catch (error) {
                console.error('Failed to fetch suggestions:', error);
                setSuggestions([]);
            } finally {
                setIsLoadingSuggestions(false);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(debounceTimer);
    }, [usernameInput, targetType]);

    const handleUserSelect = (user: UserSuggestion) => {
        setSelectedUser(user);
        setUserId(user.id);
        setUsernameInput(user.username);
        setShowSuggestions(false);
        inputRef.current?.blur();
    };

    const handleClearSelection = () => {
        setSelectedUser(null);
        setUserId('');
        setUsernameInput('');
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();

        if (targetType === 'user' && selectedUser) {
            if (!selectedUser.hasValidNotificationDevice) {
                toast.error('Cannot send: selected user has no valid notification device/token.');
                return;
            }

            if (selectedUser.permission === 'denied') {
                toast('Warning: user denied browser notification permission. Delivery may fail.', { icon: '!' });
            }

            if (!selectedUser.isLive) {
                toast('Warning: user is offline right now. Notification may arrive later.', { icon: '!' });
            }
        }

        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const endpoint = targetType === 'broadcast'
                ? `${API_URL}/notifications/broadcast`
                : `${API_URL}/notifications/send-user`;

            const payload = targetType === 'broadcast'
                ? { title, body }
                : { userId, title, body };

            await axios.post(endpoint, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success('Notification sent successfully!');
            setTitle('');
            setBody('');
            setUserId('');
            setSelectedUser(null);
            setUsernameInput('');
        } catch (error: any) {
            console.error('Failed to send:', error);
            toast.error(error.response?.data?.message || 'Failed to send notification');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 md:p-8">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
                <Send className="w-5 h-5 text-emerald-600" />
                Push Notification Manager
            </h2>

            <form onSubmit={handleSend} className="space-y-6">
                {/* Target Selection */}
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <button
                        type="button"
                        onClick={() => setTargetType('broadcast')}
                        className={`flex-1 py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                            targetType === 'broadcast' 
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold' 
                            : 'border-gray-200 text-gray-500 hover:border-emerald-200 hover:bg-emerald-50/50'
                        }`}
                    >
                        <Users className="w-5 h-5" />
                        Broadcast (All Users)
                    </button>
                    <button
                        type="button"
                        onClick={() => setTargetType('user')}
                        className={`flex-1 py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                            targetType === 'user' 
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold' 
                            : 'border-gray-200 text-gray-500 hover:border-emerald-200 hover:bg-emerald-50/50'
                        }`}
                    >
                        <User className="w-5 h-5" />
                        Specific User
                    </button>
                </div>

                {/* User ID Input (Conditional) */}
                {targetType === 'user' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                            Username <span className="text-red-500">*</span>
                        </label>
                        <div className="relative" ref={suggestionsRef}>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={usernameInput}
                                    onChange={(e) => {
                                        setUsernameInput(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => {
                                        if (suggestions.length > 0) setShowSuggestions(true);
                                    }}
                                    placeholder="Start typing username (e.g., ahmed)"
                                    className="w-full pl-10 pr-10 py-3 rounded-lg border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                                    required
                                    autoComplete="off"
                                />
                                {selectedUser && (
                                    <button
                                        type="button"
                                        onClick={handleClearSelection}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        title="Clear selection"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            
                            {/* Suggestions Dropdown */}
                            {showSuggestions && (suggestions.length > 0 || isLoadingSuggestions) && (
                                <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto">
                                    {isLoadingSuggestions ? (
                                        <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                            Searching...
                                        </div>
                                    ) : (
                                        <>
                                            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                                Select User
                                            </div>
                                            {suggestions.map((user) => (
                                                <button
                                                    key={user.id}
                                                    type="button"
                                                    onClick={() => handleUserSelect(user)}
                                                    className="w-full px-4 py-3 text-left hover:bg-emerald-50 transition-colors border-b border-gray-50 last:border-b-0 flex items-center justify-between group"
                                                >
                                                    <div>
                                                        <div className="font-medium text-gray-900 group-hover:text-emerald-700">
                                                            @{user.username}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {user.email}
                                                        </div>
                                                    </div>
                                                    {selectedUser?.id === user.id && (
                                                        <Check className="w-5 h-5 text-emerald-600" />
                                                    )}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                            
                            {showSuggestions && suggestions.length === 0 && !isLoadingSuggestions && usernameInput.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3 text-sm text-gray-500 text-center">
                                    No users found matching "{usernameInput}"
                                </div>
                            )}
                        </div>
                        {selectedUser && (
                            <div className="space-y-2 text-xs bg-emerald-50 px-3 py-3 rounded-lg border border-emerald-100">
                                <div className="flex items-center gap-2 text-emerald-700">
                                    <Check className="w-4 h-4" />
                                    Selected: @{selectedUser.username} ({selectedUser.email})
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className={`px-2 py-1 rounded-full font-medium ${selectedUser.permission === 'granted' ? 'bg-emerald-100 text-emerald-800' : selectedUser.permission === 'denied' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>
                                        {formatPermissionLabel(selectedUser.permission)}
                                    </span>
                                    <span className={`px-2 py-1 rounded-full font-medium ${selectedUser.hasValidNotificationDevice ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                        {selectedUser.hasValidNotificationDevice ? 'Valid Device' : 'No Valid Device'}
                                    </span>
                                    <span className={`px-2 py-1 rounded-full font-medium ${selectedUser.isLive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                                        {selectedUser.isLive ? 'Live' : 'Offline'}
                                    </span>
                                </div>
                                <div className="text-gray-600">
                                    Last seen: {formatLastSeen(selectedUser.lastSeenAt)}
                                </div>
                                <div className="text-gray-600">
                                    In-app prefs: {selectedUser.preferences.prayers || selectedUser.preferences.events || selectedUser.preferences.community ? 'Enabled' : 'Disabled'}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Message Content */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Notification Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., New Feature Update!"
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all font-medium"
                            required
                            maxLength={50}
                        />
                        <div className="text-xs text-right text-gray-400">{title.length}/50</div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Message Body <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Type your message here..."
                            rows={4}
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all resize-none"
                            required
                            maxLength={200}
                        />
                        <div className="text-xs text-right text-gray-400">{body.length}/200</div>
                    </div>
                </div>

                {/* Preview Box */}
                <div className="bg-gray-50 rounded-lg p-4 border border-dashed border-gray-200">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Device Preview</h4>
                    <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 max-w-sm mx-auto sm:mx-0">
                        <div className="flex gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                <Send className="w-5 h-5" />
                            </div>
                            <div>
                                <h5 className="font-semibold text-gray-900 text-sm">{title || 'Notification Title'}</h5>
                                <p className="text-xs text-gray-600 line-clamp-2">{body || 'Message body will appear here...'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={loading || !title || !body || (targetType === 'user' && (!userId || !selectedUser?.hasValidNotificationDevice))}
                    className={`w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] ${
                        loading 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-emerald-500/30'
                    }`}
                >
                    {loading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Sending...
                        </>
                    ) : (
                        <>
                            <Send className="w-5 h-5" />
                            Send Notification
                        </>
                    )}
                </button>
            </form>
        </div>
    );
};

export default AdminNotificationPanel;
