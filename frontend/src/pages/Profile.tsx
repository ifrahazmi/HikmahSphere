import React, { useState, useEffect } from 'react';
import { UserIcon, ChartBarIcon, BookOpenIcon, XMarkIcon, PhotoIcon, PencilIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

const Profile: React.FC = () => {
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Profile Info & Edit State
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
      firstName: '',
      lastName: '',
      phoneNumber: '',
      gender: '',
      madhab: 'hanafi',
      street: '',
      city: '',
      country: '',
      bio: '',
      avatar: ''
  });

  // Initialize form data
  useEffect(() => {
    if (authUser) {
      setFormData({
          firstName: authUser.name?.split(' ')[0] || '',
          lastName: authUser.name?.split(' ').slice(1).join(' ') || '',
          phoneNumber: authUser.phoneNumber || '',
          gender: authUser.gender || '',
          madhab: authUser.madhab || 'hanafi',
          street: authUser.address?.street || '',
          city: authUser.address?.city || '',
          country: authUser.address?.country || '',
          bio: authUser.bio || '',
          avatar: authUser.avatar || ''
      });
    }
  }, [authUser, showEditModal]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_URL}/auth/profile`, {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(formData)
          });
          
          const data = await response.json();
          
          if (data.status === 'success') {
              toast.success('Profile updated successfully!');
              setShowEditModal(false);
              window.location.reload(); 
          } else {
              toast.error(data.message || 'Failed to update profile');
          }
          
      } catch (error) {
          console.error('Failed to update profile', error);
          toast.error('Failed to update profile');
      }
  };

  // Mock data for other tabs
  const activities = [
    { activity: 'Completed Fajr prayer', time: '2 hours ago', type: 'prayer' },
    { activity: 'Read Surah Al-Baqarah', time: '1 day ago', type: 'quran' },
    { activity: 'Calculated Zakat on savings', time: '3 days ago', type: 'zakat' },
    { activity: 'Joined community discussion', time: '1 week ago', type: 'community' }
  ];

  const achievements = [
    { title: 'First Prayer', description: 'Completed your first prayer tracking', earned: true },
    { title: 'Quran Reader', description: 'Read 100 verses', earned: true },
    { title: 'Community Member', description: 'Made your first community post', earned: true },
    { title: 'Zakat Calculator', description: 'Used the Zakat calculator', earned: false }
  ];

  const tabs = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'activity', name: 'Activity', icon: ClockIcon }, // Changed icon to avoid dup
    { id: 'achievements', name: 'Achievements', icon: BookOpenIcon },
    { id: 'info', name: 'Profile Info', icon: UserIcon } // Renamed from Settings
  ];
  
  // Need to import ClockIcon locally for tabs since I used it above
  function ClockIcon(props: any) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }

  if (!authUser) {
      return (
          <div className="min-h-screen pt-20 flex justify-center">
              <p>Please sign in to view your profile.</p>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center space-x-6">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden border-4 border-emerald-100">
              {authUser.avatar ? (
                <img src={authUser.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="h-12 w-12 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{authUser.name}</h1>
              <p className="text-gray-600">{authUser.email}</p>
              <div className="flex items-center mt-2 text-sm text-gray-500">
                 <span className="mr-4">Member since {authUser.createdAt ? new Date(authUser.createdAt).toLocaleDateString() : 'N/A'}</span>
                 {authUser.madhab && <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full capitalize">{authUser.madhab}</span>}
              </div>
              {authUser.bio && <p className="text-gray-700 mt-3 italic">"{authUser.bio}"</p>}
            </div>
            {/* Quick Edit Button */}
            <button 
                onClick={() => setShowEditModal(true)}
                className="bg-gray-100 text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors"
                title="Edit Profile"
            >
              <PencilIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs Navigation */}
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

        {/* Overview Tab (Stats) */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Prayers Completed</span>
                  <span className="font-semibold text-emerald-600">127</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Verses Read</span>
                  <span className="font-semibold text-blue-600">2,847</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Zakat Calculations</span>
                  <span className="font-semibold text-yellow-600">5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Community Posts</span>
                  <span className="font-semibold text-purple-600">23</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Reflection</h3>
              <div className="text-center py-4">
                <p className="text-lg font-arabic text-gray-700 mb-2">
                  "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ"
                </p>
                <p className="text-sm text-gray-500 italic">
                  "Our Lord, give us good in this world and good in the next world, and save us from the punishment of the Fire."
                </p>
                <p className="text-xs text-gray-400 mt-2">- Quran 2:201</p>
              </div>
            </div>
          </div>
        )}

        {/* Profile Info Tab (Replaces Settings) */}
        {activeTab === 'info' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                <button 
                    onClick={() => setShowEditModal(true)}
                    className="text-emerald-600 hover:text-emerald-700 font-medium text-sm flex items-center"
                >
                    <PencilIcon className="h-4 w-4 mr-1" /> Edit
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="border-b border-gray-100 pb-3">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Full Name</label>
                    <p className="text-gray-900 font-medium mt-1 text-lg">{authUser.name}</p>
                </div>
                <div className="border-b border-gray-100 pb-3">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
                    <p className="text-gray-900 font-medium mt-1 text-lg">{authUser.email}</p>
                </div>
                <div className="border-b border-gray-100 pb-3">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Phone Number</label>
                    <p className="text-gray-900 font-medium mt-1 text-lg">{authUser.phoneNumber || 'Not set'}</p>
                </div>
                <div className="border-b border-gray-100 pb-3">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Gender</label>
                    <p className="text-gray-900 font-medium mt-1 text-lg capitalize">{authUser.gender || 'Not set'}</p>
                </div>
                <div className="border-b border-gray-100 pb-3">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">School of Thought</label>
                    <p className="text-gray-900 font-medium mt-1 text-lg capitalize">{authUser.madhab || 'Not set'}</p>
                </div>
                <div className="border-b border-gray-100 pb-3">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Location</label>
                    <p className="text-gray-900 font-medium mt-1 text-lg">
                        {[authUser.address?.street, authUser.address?.city, authUser.address?.country].filter(Boolean).join(', ') || 'Not set'}
                    </p>
                </div>
                <div className="md:col-span-2 pt-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Bio</label>
                    <p className="text-gray-700 mt-2 leading-relaxed">{authUser.bio || 'No bio added yet.'}</p>
                </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {activities.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3 py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900">{activity.activity}</p>
                    <p className="text-sm text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {achievements.map((achievement, index) => (
              <div key={index} className={`bg-white rounded-lg shadow-md p-6 ${achievement.earned ? '' : 'opacity-60'}`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    achievement.earned ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <BookOpenIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{achievement.title}</h4>
                    <p className="text-sm text-gray-600">{achievement.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Profile Modal */}
        {showEditModal && (
            <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all scale-100">
                    <div className="sticky top-0 bg-white z-10 flex justify-between items-center p-6 border-b border-gray-100">
                        <h3 className="text-xl font-bold text-gray-900">Edit Profile</h3>
                        <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>
                    
                    <form onSubmit={handleSaveProfile} className="p-6 space-y-6">
                        {/* Profile Picture Upload */}
                        <div className="flex flex-col items-center justify-center space-y-4 pb-4 border-b border-gray-100">
                            <div className="relative group">
                                <div className="w-32 h-32 rounded-full bg-gray-100 overflow-hidden border-4 border-white shadow-lg">
                                    {formData.avatar ? (
                                        <img src={formData.avatar} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex items-center justify-center h-full">
                                            <PhotoIcon className="h-12 w-12 text-gray-400" />
                                        </div>
                                    )}
                                </div>
                                <label className="absolute bottom-0 right-0 bg-emerald-600 text-white p-2 rounded-full cursor-pointer hover:bg-emerald-700 shadow-md transition-transform transform group-hover:scale-110">
                                    <PencilIcon className="h-4 w-4" />
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                            <p className="text-sm text-gray-500">Click pencil icon to change profile photo</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                <input
                                    type="text"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                <input
                                    type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                value={authUser.email}
                                disabled
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                <input
                                    type="text"
                                    name="phoneNumber"
                                    value={formData.phoneNumber}
                                    onChange={handleInputChange}
                                    placeholder="+91 00000 00000"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                                <select
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                >
                                    <option value="">Select Gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">School of Thought (Madhab)</label>
                                <select
                                    name="madhab"
                                    value={formData.madhab}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                >
                                    <option value="hanafi">Hanafi</option>
                                    <option value="shafi">Shafi'i</option>
                                    <option value="maliki">Maliki</option>
                                    <option value="hanbali">Hanbali</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                                <input
                                    type="text"
                                    name="country"
                                    value={formData.country}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Address / City</label>
                            <input
                                type="text"
                                name="street"
                                placeholder="Street Address or City"
                                value={formData.street}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                            <textarea
                                name="bio"
                                value={formData.bio}
                                onChange={handleInputChange}
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                placeholder="Tell us a bit about yourself..."
                            />
                        </div>

                        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setShowEditModal(false)}
                                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 shadow-md hover:shadow-lg transition-all"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default Profile;
