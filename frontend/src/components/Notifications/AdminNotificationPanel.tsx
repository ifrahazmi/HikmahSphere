import React, { useState } from 'react';
import { Send, Users, User } from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const AdminNotificationPanel = () => {
    const [targetType, setTargetType] = useState<'broadcast' | 'user'>('broadcast');
    const [userId, setUserId] = useState('');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(false);

    // Use relative URL to leverage package.json proxy
    const API_URL = '/api';

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
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
                            User ID <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            placeholder="Enter User MongoDB ID (e.g., 65f...)"
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                            required
                        />
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
                    disabled={loading || !title || !body || (targetType === 'user' && !userId)}
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
