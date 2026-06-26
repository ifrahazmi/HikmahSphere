import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon, BellIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { useNotification } from '../contexts/NotificationContext';
import { useUserPreferences } from '../hooks/useUserPreferences';
import toast from 'react-hot-toast';

let globalTestAudio: HTMLAudioElement | null = null;

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { preferences: notifPrefs, updatePreference: updateNotif } = useNotificationPreferences();
  const { addSystemNotification } = useNotification();
  const { preferences: userPrefs, updatePreference: updateUserPref } = useUserPreferences();
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleAsrMethodChange = async (method: 'standard' | 'hanafi') => {
    setSaving(true);
    const success = await updateUserPref('asrMethod', method);
    setSaving(false);
    if (success) {
      toast.success(t('settings.save'));
    } else {
      toast.error(t('common.error'));
    }
  };

  const handleNotificationToggle = async (prayer: string, enabled: boolean) => {
    const success = await updateNotif(prayer as any, enabled);
    if (success) {
      toast.success(enabled ? t('notifications.enableNotification') : t('notifications.disableNotification'));
    } else {
      toast.error(t('common.error'));
    }
  };

  const handleSoundToggle = async (prayer: string, sound: boolean) => {
    const success = await updateNotif(prayer as any, undefined, sound);
    if (success) {
      toast.success(sound ? t('notifications.soundEnabled') : t('notifications.soundDisabled'));
    } else {
      toast.error(t('common.error'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        className={`w-full max-w-md rounded-lg bg-white p-6 shadow-2xl dark:bg-gray-900 max-h-[90vh] flex flex-col ${
          isRTL ? 'text-right' : 'text-left'
        }`}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between shrink-0">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('header.settings')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto flex-1 pr-1">
          {/* Asr Method Section */}
          <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
            <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
              {t('settings.asrMethod')}
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="asr-method"
                  value="standard"
                  checked={userPrefs.asrMethod === 'standard'}
                  onChange={() => handleAsrMethodChange('standard')}
                  disabled={saving}
                  className="h-4 w-4"
                />
                <span className="text-gray-700 dark:text-gray-300">{t('settings.standard')}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="asr-method"
                  value="hanafi"
                  checked={userPrefs.asrMethod === 'hanafi'}
                  onChange={() => handleAsrMethodChange('hanafi')}
                  disabled={saving}
                  className="h-4 w-4"
                />
                <span className="text-gray-700 dark:text-gray-300">{t('settings.hanafi')}</span>
              </label>
            </div>
          </div>

          {/* Notifications Section */}
          <div>
            <h3 className="mb-3 font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BellIcon className="h-5 w-5" />
              {t('settings.notifications')}
            </h3>
            <div className="space-y-3">
              {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((prayer) => (
                <div key={prayer} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                  <span className="capitalize text-gray-700 dark:text-gray-300">
                    {t(`prayers.${prayer}`)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleNotificationToggle(prayer, !notifPrefs[prayer]?.enabled)
                      }
                      className={`px-3 py-1 rounded text-sm font-medium transition ${
                        notifPrefs[prayer]?.enabled
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                          : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {notifPrefs[prayer]?.enabled ? t('settings.enable') : t('settings.disable')}
                    </button>
                    <button
                      onClick={() =>
                        handleSoundToggle(prayer, !notifPrefs[prayer]?.sound)
                      }
                      className={`px-3 py-1 rounded text-sm font-medium transition ${
                        notifPrefs[prayer]?.sound
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                          : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {notifPrefs[prayer]?.sound ? '🔊' : '🔇'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4">
              <button
                onClick={() => {
                  const anyEnabled = Object.values(notifPrefs).some(p => p.enabled);
                  const anySound = Object.values(notifPrefs).some(p => p.sound);
                  
                  if (anyEnabled) {
                    // Request notification permission if needed
                    if ('Notification' in window && Notification.permission === 'default') {
                      Notification.requestPermission();
                    }

                    // Add to in-app bell and show system push
                    addSystemNotification(
                      'Test Adhan Notification',
                      'This is a test to verify your notification settings.',
                      'info',
                      { type: 'adhan-test' }
                    );

                    toast.success('Test successful: Notification displayed!');
                    if (anySound) {
                      try {
                        if (globalTestAudio) {
                          globalTestAudio.pause();
                          globalTestAudio.currentTime = 0;
                        }
                        
                        globalTestAudio = new Audio('/sounds/adhan.mp3');
                        globalTestAudio.volume = 0.8;
                        globalTestAudio.play().catch(e => console.warn('Audio test failed', e));
                        toast.success('Test successful: Audio playing for 20s!');

                        // Stop audio after 20 seconds
                        setTimeout(() => {
                          if (globalTestAudio) {
                            globalTestAudio.pause();
                            globalTestAudio.currentTime = 0;
                          }
                        }, 20000);
                      } catch (err) {
                        console.error('Audio playback error', err);
                      }
                    } else {
                      toast('Audio is muted in settings', { icon: '🔇' });
                    }
                  } else {
                    toast.error('All notifications are disabled. Enable one to test.');
                  }
                }}
                className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-blue-500 bg-blue-50 px-4 py-2 font-semibold text-blue-700 hover:bg-blue-100 transition dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
              >
                <BellIcon className="h-5 w-5" /> Test Notifications & Sound
              </button>
            </div>
            
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              💡 {t('notifications.hint') || 'Enable notifications for prayer time alerts'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700 shrink-0">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-emerald-500 px-4 py-2 font-medium text-white hover:bg-emerald-600 transition"
          >
            {t('settings.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
