import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserGroupIcon, ChatBubbleLeftIcon, XMarkIcon, TrophyIcon } from '@heroicons/react/24/outline';
import PageSEO from '../components/PageSEO';
import IslamicGames from '../components/IslamicGames';

const Community: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const isFromLogin = tabParam === 'games';
  const [activeTab, setActiveTab] = useState(isFromLogin ? 'games' : 'forums');
  const [showUnderConstruction, setShowUnderConstruction] = useState(!isFromLogin);

  // Set active tab based on URL query parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'games') {
      setActiveTab('games');
      setShowUnderConstruction(false); // Hide popup when redirected from login
    } else {
      setActiveTab('forums');
    }
  }, [searchParams]);

  // Auto-hide popup after 10 seconds (only if not from login redirect)
  useEffect(() => {
    if (!isFromLogin) {
      const timer = setTimeout(() => {
        setShowUnderConstruction(false);
      }, 15000);

      return () => clearTimeout(timer);
    }
  }, [isFromLogin]);

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
    { id: 'posts', name: 'Recent Posts', icon: UserGroupIcon },
    { id: 'games', name: 'Games', icon: TrophyIcon },
  ];

  return (
    <>
      <PageSEO
        title="Muslim Community Forums and Events"
        description="Join the HikmahSphere Muslim community for Islamic discussions, Quran study circles, worship insights, and local events that strengthen brotherhood and learning."
        path="/community"
        keywords={[
          'muslim community app',
          'muslim community online',
          'islamic discussion forum',
          'quran study circle',
          'muslim events',
          'hikmahsphere community',
        ]}
      />
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-16">
      {/* Under Construction Popup Modal - Compact & Mobile Optimized */}
      {showUnderConstruction && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowUnderConstruction(false)}
          ></div>

          {/* Modal Content - fits portrait & landscape on all screen sizes */}
          <div className="flex min-h-full items-center justify-center p-2">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto p-4 border-2 border-emerald-300">
              {/* Close Button */}
              <button
                onClick={() => setShowUnderConstruction(false)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all shadow-md z-10"
                aria-label="Close"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>

              {/* Icon + Title row */}
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full p-2.5 shadow-lg shrink-0">
                  <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-emerald-700 leading-tight">🚧 Under Construction</h2>
                  <p className="text-xs text-gray-500">✨ Something amazing is coming!</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-gray-700 bg-emerald-50 rounded-xl p-2.5 mb-3 leading-relaxed border border-emerald-200">
                Our <span className="font-bold text-emerald-700">Community</span> page is being developed. Soon you'll connect with Muslims worldwide, join discussions, and be part of a thriving Islamic community! 🌍
              </p>

              {/* Features grid - 4 in a row */}
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {[
                  { icon: '💬', label: 'Forums' },
                  { icon: '👥', label: 'Groups' },
                  { icon: '🎮', label: 'Games' },
                  { icon: '🎯', label: 'More' },
                ].map(({ icon, label }) => (
                  <div key={label} className="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-200">
                    <div className="text-xl mb-0.5">{icon}</div>
                    <p className="text-xs font-semibold text-gray-700">{label}</p>
                  </div>
                ))}
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-600 font-semibold mb-1">
                  <span>🚀 Progress</span>
                  <span className="text-emerald-600 font-bold">75%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2.5 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => setShowUnderConstruction(false)}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-2.5 px-4 rounded-xl font-bold text-sm hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md"
              >
                Got it! 👍
              </button>

              {/* Coming Soon Badge */}
              <div className="mt-2 text-center">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold border border-amber-300">
                  ✨ Coming Soon ✨
                </span>
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

        {/* Games Tab */}
        {activeTab === 'games' && (
          <IslamicGames />
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
    </>
  );
};

export default Community;
