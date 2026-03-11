import React, { useState, useEffect, useMemo } from 'react';
import {
  UserIcon,
  ChartBarIcon,
  ClockIcon,
  XMarkIcon,
  PhotoIcon,
  PencilIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import PageSEO from '../components/PageSEO';
import { API_URL } from '../config';
import {
  QURAN_STATUS_LABEL,
  filterRecordsFromDate,
  formatCompactDate,
  formatDateKey,
  getAggregatedStats,
  getDailyActivity,
  getSalahTrackerStorageKey,
  TrackerRecords,
  readTrackerFromStorage,
} from '../utils/salahTracker';

const PROFILE_REFLECTION_IMAGE_SRC = '/Gemini_Generated_Image_b40rclb40rclb40r.png';

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

  const trackerStorageKey = useMemo(() => {
    return getSalahTrackerStorageKey(authUser ? { id: authUser.id, email: authUser.email } : null);
  }, [authUser]);

  const [trackerRecords, setTrackerRecords] = useState<TrackerRecords>({});

  useEffect(() => {
    if (!authUser) {
      setTrackerRecords({});
      return;
    }

    setTrackerRecords(readTrackerFromStorage(trackerStorageKey));
  }, [authUser, trackerStorageKey]);

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

  const tabs = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'activity', name: 'Activity', icon: ClockIcon },
    { id: 'info', name: 'Profile Info', icon: UserIcon }
  ];

  const memberSinceDate = authUser?.createdAt ? new Date(authUser.createdAt) : null;
  const memberSinceDateKey = memberSinceDate ? formatDateKey(memberSinceDate) : '0000-01-01';

  const trackerRecordsFromMemberSince = useMemo(() => {
    return filterRecordsFromDate(trackerRecords, memberSinceDateKey);
  }, [trackerRecords, memberSinceDateKey]);

  const trackerStats = useMemo(() => {
    return getAggregatedStats(trackerRecordsFromMemberSince);
  }, [trackerRecordsFromMemberSince]);

  const activityItems = useMemo(() => {
    return getDailyActivity(trackerRecordsFromMemberSince, 60);
  }, [trackerRecordsFromMemberSince]);

  const statCards = [
    { label: 'Tracked Days', value: trackerStats.trackedDays.toLocaleString(), tone: 'text-gray-900' },
    { label: 'Prayed On Time', value: trackerStats.prayersPrayed.toLocaleString(), tone: 'text-emerald-600' },
    { label: 'Qada Logged', value: trackerStats.prayersQada.toLocaleString(), tone: 'text-amber-600' },
    { label: 'Missed Prayers', value: trackerStats.prayersMissed.toLocaleString(), tone: 'text-rose-600' },
    { label: 'Quran Read Days', value: trackerStats.quranReadDays.toLocaleString(), tone: 'text-blue-600' },
    { label: 'Perfect Salah Days', value: trackerStats.perfectDays.toLocaleString(), tone: 'text-teal-600' },
    { label: 'Avg Salah Score', value: `${trackerStats.averagePrayerScore}%`, tone: 'text-emerald-700' },
    { label: 'Avg Quran Score', value: `${trackerStats.averageQuranScore}%`, tone: 'text-sky-700' },
  ];

  if (!authUser) {
      return (
          <>
            <PageSEO
              title="Your HikmahSphere Profile"
              description="Manage your HikmahSphere profile and personalized settings."
              path="/profile"
              noIndex
              noFollow
            />
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-20">
              <div className="mx-auto max-w-lg px-4">
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 text-center shadow-sm">
                  <p className="text-base text-gray-700">Please sign in to view your profile.</p>
                </div>
              </div>
            </div>
          </>
      )
  }

  const memberSince = authUser.createdAt ? new Date(authUser.createdAt).toLocaleDateString() : 'N/A';
  const locationLabel = [authUser.address?.street, authUser.address?.city, authUser.address?.country]
    .filter(Boolean)
    .join(', ') || 'Not set';
  const profileInfoItems = [
    { label: 'Full Name', value: authUser.name },
    { label: 'Email Address', value: authUser.email },
    { label: 'Phone Number', value: authUser.phoneNumber || 'Not set' },
    { label: 'Gender', value: authUser.gender ? authUser.gender.charAt(0).toUpperCase() + authUser.gender.slice(1) : 'Not set' },
    { label: 'School of Thought', value: authUser.madhab ? authUser.madhab.charAt(0).toUpperCase() + authUser.madhab.slice(1) : 'Not set' },
    { label: 'Location', value: locationLabel },
  ];

  return (
    <>
      <PageSEO
        title="Your HikmahSphere Profile"
        description="Manage your HikmahSphere profile and personalized settings."
        path="/profile"
        noIndex
        noFollow
      />
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-16">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <section className="relative mb-6 overflow-hidden rounded-3xl border border-emerald-100 bg-white/95 shadow-lg">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-100/60 to-teal-100/20" />
            <div className="relative p-4 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="mx-auto h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-gray-200 shadow-sm sm:mx-0 sm:h-28 sm:w-28">
                  {authUser.avatar ? (
                    <img src={authUser.avatar} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <UserIcon className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <h1 className="truncate text-2xl font-bold text-gray-900 sm:text-3xl">{authUser.name}</h1>
                  <p className="mt-1 truncate text-sm text-gray-600 sm:text-base">{authUser.email}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 sm:text-sm">
                      Member since {memberSince}
                    </span>
                    {authUser.madhab && (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold capitalize text-emerald-700 sm:text-sm">
                        {authUser.madhab}
                      </span>
                    )}
                  </div>
                  {authUser.bio && (
                    <p className="mt-3 text-sm italic text-gray-700 sm:text-base">
                      "{authUser.bio}"
                    </p>
                  )}
                </div>

                <button
                  onClick={() => setShowEditModal(true)}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:self-start"
                  title="Edit Profile"
                >
                  <PencilIcon className="mr-2 h-4 w-4" />
                  Edit
                </button>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <nav className="grid grid-cols-3 gap-2 pb-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-medium transition sm:gap-2 sm:px-4 sm:text-sm ${
                      isActive
                        ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-700'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="truncate">{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </section>

          {activeTab === 'overview' && (
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="mb-1 text-lg font-semibold text-gray-900">All-Time Worship Statistics</h3>
                <p className="mb-4 text-sm text-gray-600">
                  Calculated from your tracker logs since member date ({memberSince}).
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {statCards.map((item) => (
                    <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{item.label}</p>
                      <p className={`mt-2 text-2xl font-bold ${item.tone}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">Daily Reflection</h3>
                <div className="rounded-xl bg-emerald-50 p-4 text-center sm:p-5">
                  <p className="font-arabic text-lg text-gray-700 sm:text-xl">
                    "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ"
                  </p>
                  <p className="mt-3 text-sm italic text-gray-600">
                    "Our Lord, give us good in this world and good in the next world, and save us from the punishment of the Fire."
                  </p>
                  <p className="mt-2 text-xs text-gray-500">- Quran 2:201</p>

                  <div className="mt-4 overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-sm">
                    <div className="relative">
                      <img
                        src={PROFILE_REFLECTION_IMAGE_SRC}
                        alt="Daily reflection visual"
                        className="h-52 w-full object-cover sm:h-60"
                      />
                      <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-3">
                        <p className="max-w-full truncate rounded-full bg-black/55 px-3 py-2 text-xs font-semibold text-white shadow-sm">
                          {authUser.name || 'User'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'info' && (
            <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="inline-flex items-center text-sm font-semibold text-emerald-600 transition hover:text-emerald-700"
                >
                  <PencilIcon className="mr-1 h-4 w-4" />
                  Edit
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {profileInfoItems.map((item) => (
                  <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
                    <p className="mt-2 break-words text-base font-medium text-gray-900">{item.value}</p>
                  </div>
                ))}
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bio</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-700">{authUser.bio || 'No bio added yet.'}</p>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'activity' && (
            <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-1 text-lg font-semibold text-gray-900">Daily Salah & Quran Activity</h3>
              <p className="mb-4 text-sm text-gray-600">Chronological log of what you completed each day.</p>

              {activityItems.length === 0 ? (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                  No Salah/Quran activity found yet. Start logging from the Salah Tracker page.
                </div>
              ) : (
                <div className="space-y-3">
                  {activityItems.map((item) => (
                    <div key={item.dateKey} className="rounded-xl border border-gray-100 bg-gray-50 p-3 sm:p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 sm:text-base">{formatCompactDate(item.dateKey)}</p>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            Salah {item.prayerScore}%
                          </span>
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            Quran {item.quranScore}%
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          <CheckCircleIcon className="h-3.5 w-3.5" />
                          Prayed: {item.prayed}/5
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                          <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                          Qada: {item.qada}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                          <XCircleIcon className="h-3.5 w-3.5" />
                          Missed: {item.missed}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                          <BookOpenIcon className="h-3.5 w-3.5" />
                          {QURAN_STATUS_LABEL[item.quranStatus]}
                        </span>
                        {item.pending > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                            Pending: {item.pending}
                          </span>
                        )}
                      </div>

                      {item.note && (
                        <p className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs italic text-gray-600 sm:text-sm">
                          "{item.note}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {showEditModal && (
            <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm">
              <div className="mx-auto flex h-full w-full items-end justify-center p-0 sm:items-center sm:p-4">
                <div className="h-[100dvh] w-full overflow-y-auto rounded-none bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl">
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white p-4 sm:p-6">
                    <h3 className="text-lg font-bold text-gray-900 sm:text-xl">Edit Profile</h3>
                    <button
                      onClick={() => setShowEditModal(false)}
                      className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-5 p-4 sm:space-y-6 sm:p-6">
                    <div className="flex flex-col items-center justify-center space-y-3 border-b border-gray-100 pb-5">
                      <div className="relative group">
                        <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-gray-100 shadow-lg sm:h-32 sm:w-32">
                          {formData.avatar ? (
                            <img src={formData.avatar} alt="Preview" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <PhotoIcon className="h-12 w-12 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <label className="absolute bottom-0 right-0 cursor-pointer rounded-full bg-emerald-600 p-2 text-white shadow-md transition hover:bg-emerald-700">
                          <PencilIcon className="h-4 w-4" />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <p className="text-sm text-gray-500">Tap pencil icon to change profile photo</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">First Name</label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Last Name</label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                      <input
                        type="email"
                        value={authUser.email}
                        disabled
                        className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Phone Number</label>
                        <input
                          type="text"
                          name="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={handleInputChange}
                          placeholder="+91 00000 00000"
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Gender</label>
                        <select
                          name="gender"
                          value={formData.gender}
                          onChange={handleInputChange}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">School of Thought (Madhab)</label>
                        <select
                          name="madhab"
                          value={formData.madhab}
                          onChange={handleInputChange}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="hanafi">Hanafi</option>
                          <option value="shafi">Shafi'i</option>
                          <option value="maliki">Maliki</option>
                          <option value="hanbali">Hanbali</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Country</label>
                        <input
                          type="text"
                          name="country"
                          value={formData.country}
                          onChange={handleInputChange}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Address / City</label>
                      <input
                        type="text"
                        name="street"
                        placeholder="Street Address or City"
                        value={formData.street}
                        onChange={handleInputChange}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Bio</label>
                      <textarea
                        name="bio"
                        value={formData.bio}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                        placeholder="Tell us a bit about yourself..."
                      />
                    </div>

                    <div className="sticky bottom-0 -mx-4 border-t border-gray-100 bg-white px-4 pt-4 sm:static sm:mx-0 sm:border-0 sm:p-0">
                      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                        <button
                          type="button"
                          onClick={() => setShowEditModal(false)}
                          className="w-full rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="w-full rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 sm:w-auto"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Profile;
