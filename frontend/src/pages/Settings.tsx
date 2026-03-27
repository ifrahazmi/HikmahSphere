import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BellIcon,
  SpeakerWaveIcon,
  ClockIcon,
  GlobeAltIcon,
  MoonIcon,
  SunIcon,
  ComputerDesktopIcon,
  CheckCircleIcon,
  ArrowLeftOnRectangleIcon,
  HandRaisedIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../contexts/SettingsContext';
import PageSEO from '../components/PageSEO';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { preferences, isLoading, updatePreferences, updatePrayerNotifications, updateReminders } = useSettings();
  const [activeTab, setActiveTab] = useState<'prayer' | 'general' | 'notifications' | 'reminders'>('prayer');

  const [localPrefs, setLocalPrefs] = useState(preferences);

  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
    }
  }, [preferences]);

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (isLoading || !localPrefs) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          </div>
        </div>
      </div>
    );
  }

  const handlePrayerNotificationToggle = async (prayer: keyof typeof prayerNames, value: boolean) => {
    await updatePrayerNotifications({ [prayer]: value });
  };

  const handleAdvanceTimeChange = async (minutes: number) => {
    await updatePrayerNotifications({ advanceMinutes: minutes });
  };

  const handleSoundChange = async (sound: 'default' | 'adhan' | 'soft' | 'bird' | 'mosque' | 'silent') => {
    await updatePrayerNotifications({ sound });
    // Play preview sound
    playSoundPreview(sound);
  };

  const handleVolumeChange = async (volume: number) => {
    await updatePrayerNotifications({ volume });
  };

  const playSoundPreview = (sound: 'default' | 'adhan' | 'soft' | 'bird' | 'mosque' | 'silent') => {
    // In a real implementation, this would play actual audio files
    const audioFiles: Record<'default' | 'adhan' | 'soft' | 'bird' | 'mosque' | 'silent', string> = {
      default: '/sounds/notification-default.mp3',
      adhan: '/sounds/adhan.mp3',
      soft: '/sounds/notification-soft.mp3',
      bird: '/sounds/birds-chirping.mp3',
      mosque: '/sounds/mosque-bell.mp3',
      silent: '',
    };

    if (sound !== 'silent' && audioFiles[sound]) {
      try {
        const audio = new Audio(audioFiles[sound]);
        audio.volume = localPrefs.prayerNotifications.volume / 100;
        audio.play().catch(() => {
          // Silent fail if audio not available
        });
      } catch (e) {
        // Audio file not available, that's okay
      }
    }
  };

  const prayerNames = {
    fajr: 'Fajr (Dawn)',
    dhuhr: 'Dhuhr (Noon)',
    asr: 'Asr (Afternoon)',
    maghrib: 'Maghrib (Sunset)',
    isha: 'Isha (Night)',
    jumuah: "Jumu'ah (Friday)",
  };

  const calculationMethods = [
    { value: 'MWL', label: 'Muslim World League' },
    { value: 'ISNA', label: 'Islamic Society of North America' },
    { value: 'EGYPT', label: 'Egyptian General Authority' },
    { value: 'MAKKAH', label: 'Umm al-Qura University, Makkah' },
    { value: 'KARACHI', label: 'University of Islamic Sciences, Karachi' },
    { value: 'TEHRAN', label: 'Institute of Geophysics, Tehran' },
    { value: 'JAFARI', label: 'Shia Ithna-Ashari, Leva Institute, Qum' },
    { value: 'SINGAPORE', label: 'Majlis Ugama Islam, Singapura' },
  ];

  const advanceTimeOptions = [
    { value: 0, label: 'At prayer time' },
    { value: 5, label: '5 minutes before' },
    { value: 10, label: '10 minutes before' },
    { value: 15, label: '15 minutes before' },
    { value: 30, label: '30 minutes before' },
    { value: 45, label: '45 minutes before' },
    { value: 60, label: '1 hour before' },
  ];

  const soundOptions = [
    { value: 'default', label: 'Default', description: 'Simple notification tone' },
    { value: 'adhan', label: 'Adhan', description: 'Traditional call to prayer' },
    { value: 'soft', label: 'Soft', description: 'Gentle melodic tone' },
    { value: 'bird', label: 'Birds Chirping', description: 'Natural bird sounds' },
    { value: 'mosque', label: 'Mosque Bell', description: 'Traditional mosque bell' },
    { value: 'silent', label: 'Silent', description: 'Visual notification only' },
  ];

  const tabs = [
    { id: 'prayer', name: 'Prayer Notifications', icon: BellIcon },
    { id: 'general', name: 'General Settings', icon: GlobeAltIcon },
    { id: 'notifications', name: 'App Notifications', icon: SpeakerWaveIcon },
    { id: 'reminders', name: 'Reminders', icon: ClockIcon },
  ];

  return (
    <>
      <PageSEO
        title="Settings - HikmahSphere"
        description="Manage your prayer notifications, app preferences, and reminders"
        path="/settings"
      />
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-20 pb-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              <ArrowLeftOnRectangleIcon className="mr-1 h-4 w-4" />
              Back
            </button>
            <h1 className="mt-3 text-3xl font-bold text-gray-900">Settings</h1>
            <p className="mt-1 text-sm text-gray-600">Customize your HikmahSphere experience</p>
          </div>

          {/* Tabs */}
          <nav className="mb-6">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                      isActive
                        ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.name}</span>
                    <span className="sm:hidden">{tab.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Tab Content */}
          <div className="space-y-6">
            {/* Prayer Notifications Tab */}
            {activeTab === 'prayer' && (
              <div className="space-y-6">
                {/* Prayer Time Notifications */}
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">Prayer Time Notifications</h3>
                  <p className="mb-6 text-sm text-gray-600">
                    Choose which prayers you want to be notified about
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(Object.entries(prayerNames) as [keyof typeof prayerNames, string][]).map(([prayer, name]) => (
                      <label
                        key={prayer}
                        className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition ${
                          localPrefs.prayerNotifications[prayer]
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-6 w-6 items-center justify-center rounded-full ${
                              localPrefs.prayerNotifications[prayer]
                                ? 'bg-emerald-600'
                                : 'bg-gray-300'
                            }`}
                          >
                            {localPrefs.prayerNotifications[prayer] && (
                              <CheckCircleIcon className="h-4 w-4 text-white" />
                            )}
                          </div>
                          <span className="font-medium text-gray-900">{name}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={localPrefs.prayerNotifications[prayer]}
                          onChange={(e) =>
                            handlePrayerNotificationToggle(prayer, e.target.checked)
                          }
                          className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Advance Notification Time */}
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">Notification Timing</h3>
                  <p className="mb-4 text-sm text-gray-600">
                    How early should we notify you before each prayer?
                  </p>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    {advanceTimeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleAdvanceTimeChange(option.value)}
                        className={`rounded-lg px-3 py-3 text-sm font-medium transition ${
                          localPrefs.prayerNotifications.advanceMinutes === option.value
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-emerald-100 hover:text-emerald-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notification Sound */}
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">Notification Sound</h3>
                  <p className="mb-4 text-sm text-gray-600">
                    Choose the sound for your prayer notifications
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {soundOptions.map((sound) => (
                      <button
                        key={sound.value}
                        onClick={() => handleSoundChange(sound.value as 'default' | 'adhan' | 'soft' | 'bird' | 'mosque' | 'silent')}
                        className={`rounded-xl border p-4 text-left transition ${
                          localPrefs.prayerNotifications.sound === sound.value
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 bg-gray-50 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">{sound.label}</p>
                            <p className="mt-1 text-xs text-gray-600">{sound.description}</p>
                          </div>
                          {localPrefs.prayerNotifications.sound === sound.value && (
                            <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Volume Control */}
                  <div className="mt-6">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Volume: {localPrefs.prayerNotifications.volume}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={localPrefs.prayerNotifications.volume}
                      onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-emerald-600"
                    />
                    <div className="mt-1 flex justify-between text-xs text-gray-500">
                      <span>Silent</span>
                      <span>Loud</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* General Settings Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                {/* Appearance */}
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">Appearance</h3>
                  
                  <div className="mb-6">
                    <label className="mb-2 block text-sm font-medium text-gray-700">Theme</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => updatePreferences({ theme: 'light' })}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${
                          localPrefs.theme === 'light'
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 bg-gray-50 hover:border-emerald-300'
                        }`}
                      >
                        <SunIcon className="h-6 w-6 text-amber-500" />
                        <span className="text-sm font-medium">Light</span>
                      </button>
                      <button
                        onClick={() => updatePreferences({ theme: 'dark' })}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${
                          localPrefs.theme === 'dark'
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 bg-gray-50 hover:border-emerald-300'
                        }`}
                      >
                        <MoonIcon className="h-6 w-6 text-gray-700" />
                        <span className="text-sm font-medium">Dark</span>
                      </button>
                      <button
                        onClick={() => updatePreferences({ theme: 'system' })}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${
                          localPrefs.theme === 'system'
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 bg-gray-50 hover:border-emerald-300'
                        }`}
                      >
                        <ComputerDesktopIcon className="h-6 w-6 text-blue-500" />
                        <span className="text-sm font-medium">System</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Time Format</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => updatePreferences({ timeFormat: '12h' })}
                        className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                          localPrefs.timeFormat === '12h'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-emerald-300'
                        }`}
                      >
                        12-hour (AM/PM)
                      </button>
                      <button
                        onClick={() => updatePreferences({ timeFormat: '24h' })}
                        className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                          localPrefs.timeFormat === '24h'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-emerald-300'
                        }`}
                      >
                        24-hour
                      </button>
                    </div>
                  </div>
                </div>

                {/* Prayer Calculation */}
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">Prayer Calculation</h3>
                  
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Calculation Method
                    </label>
                    <select
                      value={localPrefs.prayerCalculationMethod}
                      onChange={(e) => updatePreferences({ prayerCalculationMethod: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                    >
                      {calculationMethods.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      School of Thought (Madhab)
                    </label>
                    <select
                      value={localPrefs.madhab}
                      onChange={(e) => updatePreferences({ madhab: e.target.value as typeof localPrefs.madhab })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="hanafi">Hanafi</option>
                      <option value="shafi">Shafi</option>
                      <option value="maliki">Maliki</option>
                      <option value="hanbali">Hanbali</option>
                    </select>
                  </div>
                </div>

                {/* Language */}
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">Language & Region</h3>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Language</label>
                    <select
                      value={localPrefs.language}
                      onChange={(e) => updatePreferences({ language: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="en">English</option>
                      <option value="ar">Arabic</option>
                      <option value="ur">Urdu</option>
                      <option value="tr">Turkish</option>
                      <option value="id">Indonesian</option>
                      <option value="fr">French</option>
                    </select>
                    <p className="mt-2 text-xs text-gray-500">
                      More languages coming soon!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* App Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">Notification Preferences</h3>
                  <p className="mb-6 text-sm text-gray-600">
                    Manage how you receive notifications from HikmahSphere
                  </p>

                  <div className="space-y-4">
                    <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center gap-3">
                        <BellIcon className="h-6 w-6 text-emerald-600" />
                        <div>
                          <p className="font-medium text-gray-900">Push Notifications</p>
                          <p className="text-xs text-gray-500">Receive notifications on your device</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={localPrefs.notifications.push}
                        onChange={(e) =>
                          updatePreferences({
                            notifications: { ...localPrefs.notifications, push: e.target.checked },
                          })
                        }
                        className="h-5 w-5 text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>

                    <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center gap-3">
                        <SpeakerWaveIcon className="h-6 w-6 text-blue-600" />
                        <div>
                          <p className="font-medium text-gray-900">Prayer Notifications</p>
                          <p className="text-xs text-gray-500">Get notified for prayer times</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={localPrefs.notifications.prayers}
                        onChange={(e) =>
                          updatePreferences({
                            notifications: { ...localPrefs.notifications, prayers: e.target.checked },
                          })
                        }
                        className="h-5 w-5 text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>

                    <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center gap-3">
                        <CalendarDaysIcon className="h-6 w-6 text-purple-600" />
                        <div>
                          <p className="font-medium text-gray-900">Event Notifications</p>
                          <p className="text-xs text-gray-500">Islamic events and reminders</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={localPrefs.notifications.events}
                        onChange={(e) =>
                          updatePreferences({
                            notifications: { ...localPrefs.notifications, events: e.target.checked },
                          })
                        }
                        className="h-5 w-5 text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>

                    <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center gap-3">
                        <HandRaisedIcon className="h-6 w-6 text-amber-600" />
                        <div>
                          <p className="font-medium text-gray-900">Community Notifications</p>
                          <p className="text-xs text-gray-500">Community updates and announcements</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={localPrefs.notifications.community}
                        onChange={(e) =>
                          updatePreferences({
                            notifications: { ...localPrefs.notifications, community: e.target.checked },
                          })
                        }
                        className="h-5 w-5 text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Reminders Tab */}
            {activeTab === 'reminders' && (
              <div className="space-y-6">
                {/* Dhikr Reminders */}
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Dhikr Reminders</h3>
                      <p className="text-sm text-gray-600">Daily reminders for remembrance of Allah</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={localPrefs.reminders.dhikr.enabled}
                      onChange={(e) =>
                        updateReminders({
                          dhikr: { ...localPrefs.reminders.dhikr, enabled: e.target.checked },
                        })
                      }
                      className="h-5 w-5 text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>

                  {localPrefs.reminders.dhikr.enabled && (
                    <div className="mt-4">
                      <label className="mb-2 block text-sm font-medium text-gray-700">Frequency</label>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {(['morning', 'evening', 'both', 'custom'] as const).map((freq) => (
                          <button
                            key={freq}
                            onClick={() =>
                              updateReminders({
                                dhikr: { ...localPrefs.reminders.dhikr, frequency: freq },
                              })
                            }
                            className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition ${
                              localPrefs.reminders.dhikr.frequency === freq
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-emerald-100'
                            }`}
                          >
                            {freq}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quran Reading Reminder */}
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Quran Reading Reminder</h3>
                      <p className="text-sm text-gray-600">Daily reminder to read Quran</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={localPrefs.reminders.quran.enabled}
                      onChange={(e) =>
                        updateReminders({
                          quran: { ...localPrefs.reminders.quran, enabled: e.target.checked },
                        })
                      }
                      className="h-5 w-5 text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>

                  {localPrefs.reminders.quran.enabled && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Daily Goal (pages)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="604"
                          value={localPrefs.reminders.quran.dailyGoal}
                          onChange={(e) =>
                            updateReminders({
                              quran: { ...localPrefs.reminders.quran, dailyGoal: parseInt(e.target.value) || 1 },
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">Reminder Time</label>
                        <input
                          type="time"
                          value={localPrefs.reminders.quran.reminderTime}
                          onChange={(e) =>
                            updateReminders({
                              quran: { ...localPrefs.reminders.quran, reminderTime: e.target.value },
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Fasting Reminders */}
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Fasting Reminders</h3>
                      <p className="text-sm text-gray-600">Suhoor and Iftar reminders during Ramadan</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={localPrefs.reminders.fasting.enabled}
                      onChange={(e) =>
                        updateReminders({
                          fasting: { ...localPrefs.reminders.fasting, enabled: e.target.checked },
                        })
                      }
                      className="h-5 w-5 text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>

                  {localPrefs.reminders.fasting.enabled && (
                    <div className="space-y-4">
                      <label className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                        <span className="text-sm font-medium text-gray-700">Remind before Suhoor</span>
                        <input
                          type="checkbox"
                          checked={localPrefs.reminders.fasting.remindBeforeSuhoor}
                          onChange={(e) =>
                            updateReminders({
                              fasting: { ...localPrefs.reminders.fasting, remindBeforeSuhoor: e.target.checked },
                            })
                          }
                          className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                        />
                      </label>
                      <label className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                        <span className="text-sm font-medium text-gray-700">Remind before Iftar</span>
                        <input
                          type="checkbox"
                          checked={localPrefs.reminders.fasting.remindBeforeIftar}
                          onChange={(e) =>
                            updateReminders({
                              fasting: { ...localPrefs.reminders.fasting, remindBeforeIftar: e.target.checked },
                            })
                          }
                          className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                        />
                      </label>
                      {localPrefs.reminders.fasting.remindBeforeIftar && (
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Iftar reminder (minutes before)
                          </label>
                          <select
                            value={localPrefs.reminders.fasting.iftarRemindMinutes}
                            onChange={(e) =>
                              updateReminders({
                                fasting: { ...localPrefs.reminders.fasting, iftarRemindMinutes: parseInt(e.target.value) },
                              })
                            }
                            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="15">15 minutes</option>
                            <option value="30">30 minutes</option>
                            <option value="45">45 minutes</option>
                            <option value="60">1 hour</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings;
