import React, { useState, useEffect } from 'react';
import { UserGroupIcon, ChatBubbleLeftIcon, CalendarIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline';

const Community: React.FC = () => {
  const [activeTab, setActiveTab] = useState('forums');
  const [showUnderConstruction, setShowUnderConstruction] = useState(true);

  // Auto-hide popup after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowUnderConstruction(false);
    }, 15000);

    return () => clearTimeout(timer);
  }, []);

  const forums = [
    {
      id: 1,
      title: 'General Islamic Discussion',
      description: 'Discuss various aspects of Islam, faith, and spirituality',
      members: 15420,
      posts: 8934,
      lastActivity: '2 hours ago'
    },
    {
      id: 2,
      title: 'Quran Study Circle',
      description: 'Weekly Quran study and tafseer discussions',
      members: 3256,
      posts: 1876,
      lastActivity: '1 day ago'
    },
    {
      id: 3,
      title: 'Prayer & Worship',
      description: 'Share experiences and ask questions about prayers',
      members: 7890,
      posts: 4521,
      lastActivity: '3 hours ago'
    }
  ];

  const events = [
    {
      id: 1,
      title: 'Community Iftar Gathering',
      date: '2024-04-15',
      time: '18:30',
      location: 'Masjid Al-Noor',
      attendees: 156,
      type: 'iftar'
    },
    {
      id: 2,
      title: 'Friday Khutbah: Patience in Islam',
      date: '2024-04-12',
      time: '13:00',
      location: 'Islamic Center',
      attendees: 89,
      type: 'lecture'
    },
    {
      id: 3,
      title: 'Youth Islamic Quiz Competition',
      date: '2024-04-20',
      time: '15:00',
      location: 'Community Hall',
      attendees: 45,
      type: 'competition'
    }
  ];

  const recentPosts = [
    {
      id: 1,
      author: 'Ahmed Ali',
      title: 'Beautiful hadith about patience',
      content: 'The Prophet (peace be upon him) said: "And whoever remains patient, Allah will make him patient..."',
      time: '1 hour ago',
      replies: 12,
      likes: 24
    },
    {
      id: 2,
      author: 'Fatima Hassan',
      title: 'Question about Wudu',
      content: 'Assalamu alaikum, I have a question about the validity of wudu when...',
      time: '3 hours ago',
      replies: 8,
      likes: 15
    }
  ];

  const tabs = [
    { id: 'forums', name: 'Forums', icon: ChatBubbleLeftIcon },
    { id: 'events', name: 'Events', icon: CalendarIcon },
    { id: 'posts', name: 'Recent Posts', icon: UserGroupIcon }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-16">
      {/* Under Construction Popup Modal - Enhanced & Mobile Optimized */}
      {showUnderConstruction && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Enhanced Backdrop with animated blur */}
          <div
            className="fixed inset-0 bg-gradient-to-br from-black/60 via-black/50 to-black/60 backdrop-blur-md transition-opacity animate-fade-in"
            onClick={() => setShowUnderConstruction(false)}
          ></div>

          {/* Modal Content - Mobile Optimized */}
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
            <div className="relative bg-gradient-to-br from-white via-emerald-50/30 to-white rounded-3xl shadow-2xl max-w-md w-full p-5 sm:p-8 transform transition-all animate-scale-in border-4 border-emerald-400/30">
              {/* Glowing border effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400 rounded-3xl opacity-30 blur-xl animate-pulse"></div>
              
              {/* Content wrapper with relative positioning */}
              <div className="relative">
                {/* Close Button - Enhanced visibility */}
                <button
                  onClick={() => setShowUnderConstruction(false)}
                  className="absolute -top-2 -right-2 sm:top-0 sm:right-0 p-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all transform hover:scale-110 shadow-lg z-10"
                  aria-label="Close"
                >
                  <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>

                {/* Animated Icon - Larger on mobile */}
                <div className="flex justify-center mb-4 sm:mb-6">
                  <div className="relative">
                    {/* Multiple animated pulse rings */}
                    <div className="absolute inset-0 bg-emerald-300 rounded-full animate-ping opacity-60"></div>
                    <div className="absolute inset-0 bg-teal-300 rounded-full animate-ping opacity-40" style={{ animationDelay: '0.5s' }}></div>
                    {/* Main icon container with gradient and shadow */}
                    <div className="relative bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 rounded-full p-5 sm:p-6 shadow-2xl animate-float">
                      <svg className="h-14 w-14 sm:h-16 sm:w-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Title - Larger and more vibrant */}
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-center mb-2 sm:mb-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 bg-clip-text text-transparent animate-gradient">
                  🚧 Under Construction 🚧
                </h2>

                {/* Subtitle - Enhanced typography */}
                <p className="text-center text-gray-700 font-semibold text-base sm:text-lg mb-4 sm:mb-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                  ✨ We're building something amazing! ✨
                </p>

                {/* Description - Enhanced card with border */}
                <div className="bg-gradient-to-r from-emerald-100 via-teal-100 to-emerald-100 rounded-2xl p-4 sm:p-5 mb-4 sm:mb-6 border-2 border-emerald-300/50 shadow-lg animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                  <p className="text-sm sm:text-base text-gray-800 text-center leading-relaxed font-medium">
                    Our <span className="font-bold text-emerald-700 text-lg">Community</span> page is currently being developed. 
                    Soon you'll be able to <span className="font-semibold text-teal-700">connect with Muslims worldwide</span>, join discussions, attend events, and be part of 
                    a thriving Islamic community! 🌍
                  </p>
                </div>

                {/* Features Preview - Enhanced with hover effects */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                  <div className="bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl p-3 sm:p-4 text-center border-2 border-emerald-300/50 hover:scale-105 transition-transform shadow-md">
                    <div className="text-3xl sm:text-4xl mb-1 animate-bounce">💬</div>
                    <p className="text-xs sm:text-sm font-bold text-gray-800">Forums</p>
                  </div>
                  <div className="bg-gradient-to-br from-teal-100 to-teal-200 rounded-xl p-3 sm:p-4 text-center border-2 border-teal-300/50 hover:scale-105 transition-transform shadow-md">
                    <div className="text-3xl sm:text-4xl mb-1 animate-bounce" style={{ animationDelay: '0.1s' }}>📅</div>
                    <p className="text-xs sm:text-sm font-bold text-gray-800">Events</p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl p-3 sm:p-4 text-center border-2 border-emerald-300/50 hover:scale-105 transition-transform shadow-md">
                    <div className="text-3xl sm:text-4xl mb-1 animate-bounce" style={{ animationDelay: '0.2s' }}>👥</div>
                    <p className="text-xs sm:text-sm font-bold text-gray-800">Groups</p>
                  </div>
                  <div className="bg-gradient-to-br from-teal-100 to-teal-200 rounded-xl p-3 sm:p-4 text-center border-2 border-teal-300/50 hover:scale-105 transition-transform shadow-md">
                    <div className="text-3xl sm:text-4xl mb-1 animate-bounce" style={{ animationDelay: '0.3s' }}>🎯</div>
                    <p className="text-xs sm:text-sm font-bold text-gray-800">Activities</p>
                  </div>
                </div>

                {/* Progress Bar - Enhanced with glow */}
                <div className="mb-5 sm:mb-6 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                  <div className="flex justify-between text-xs sm:text-sm text-gray-700 font-semibold mb-2">
                    <span>🚀 Development Progress</span>
                    <span className="text-emerald-600 font-bold">65%</span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-4 overflow-hidden shadow-inner">
                    <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 h-4 rounded-full transition-all duration-1000 shadow-lg relative animate-progress" style={{ width: '65%' }}>
                      <div className="absolute inset-0 bg-white/30 animate-shimmer"></div>
                    </div>
                  </div>
                </div>

                {/* Action Button - Enhanced with glow effect */}
                <button
                  onClick={() => setShowUnderConstruction(false)}
                  className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white py-3 sm:py-4 px-6 rounded-xl font-bold text-base sm:text-lg hover:from-emerald-600 hover:to-teal-600 transition-all transform hover:scale-105 shadow-2xl relative overflow-hidden group animate-fade-in-up"
                  style={{ animationDelay: '0.6s' }}
                >
                  <span className="relative z-10">Got it! I'll Check Back Later 👍</span>
                  <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                </button>

                {/* Coming Soon Badge - Enhanced */}
                <div className="mt-4 sm:mt-5 text-center animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-200 text-amber-900 rounded-full text-xs sm:text-sm font-bold shadow-lg border-2 border-amber-300">
                    <span className="animate-pulse text-base">✨</span>
                    <span className="animate-pulse">Coming Soon</span>
                    <span className="animate-pulse text-base">✨</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Community</h1>
          <p className="text-gray-600">Connect with Muslims worldwide</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Forums Tab */}
        {activeTab === 'forums' && (
          <div className="space-y-4">
            {forums.map((forum) => (
              <div key={forum.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{forum.title}</h3>
                    <p className="text-gray-600 mb-4">{forum.description}</p>
                    <div className="flex items-center space-x-6 text-sm text-gray-500">
                      <span className="flex items-center">
                        <UserGroupIcon className="h-4 w-4 mr-1" />
                        {forum.members.toLocaleString()} members
                      </span>
                      <span className="flex items-center">
                        <ChatBubbleLeftIcon className="h-4 w-4 mr-1" />
                        {forum.posts.toLocaleString()} posts
                      </span>
                      <span>Last activity: {forum.lastActivity}</span>
                    </div>
                  </div>
                  <button className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition-colors">
                    Join Discussion
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div key={event.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{event.title}</h3>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-gray-600">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    <span>{event.date} at {event.time}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <MapPinIcon className="h-4 w-4 mr-2" />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <UserGroupIcon className="h-4 w-4 mr-2" />
                    <span>{event.attendees} attending</span>
                  </div>
                </div>
                <button className="w-full bg-emerald-600 text-white py-2 px-4 rounded-md hover:bg-emerald-700 transition-colors">
                  Join Event
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Recent Posts Tab */}
        {activeTab === 'posts' && (
          <div className="space-y-4">
            {recentPosts.map((post) => (
              <div key={post.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{post.title}</h3>
                    <p className="text-sm text-gray-500">by {post.author} • {post.time}</p>
                  </div>
                </div>
                <p className="text-gray-700 mb-4">{post.content}</p>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>{post.replies} replies</span>
                  <span>{post.likes} likes</span>
                  <button className="text-emerald-600 hover:text-emerald-700">Read more</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Islamic Quote */}
        <div className="mt-12 bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-lg font-arabic text-gray-700 mb-2">
            "وَالْمُؤْمِنُونَ وَالْمُؤْمِنَاتُ بَعْضُهُمْ أَوْلِيَاءُ بَعْضٍ"
          </p>
          <p className="text-sm text-gray-500 italic">
            "The believing men and believing women are allies of one another"
          </p>
          <p className="text-xs text-gray-400 mt-2">- Quran 9:71</p>
        </div>
      </div>
    </div>
  );
};

export default Community;
