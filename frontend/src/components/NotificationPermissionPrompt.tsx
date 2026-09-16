import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  BellAlertIcon,
  DevicePhoneMobileIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { getPushSupportInfo, requestNotificationPermissionFromUserGesture } from '../firebase';
import {
  INSTALL_PROMPT_CLOSED_EVENT,
  NOTIFY_PROMPT_SNOOZE_KEY,
  PUSH_REGISTER_EVENT,
  dismissDailyPrompt,
  shouldOfferPwaInstall,
  shouldShowDailyPrompt,
} from '../utils/dailyPromptSnooze';

const NotificationPermissionPrompt: React.FC = () => {
  const { user, loading, sessionStatus, passwordChangeRequired } = useAuth();
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [installBlocking, setInstallBlocking] = useState(shouldOfferPwaInstall);
  const [isIOSBrowser, setIsIOSBrowser] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
  const alreadyGranted = permission === 'granted';
  const browserBlocked = permission === 'denied';

  const canShowForRoute = location.pathname !== '/auth';
  const signedIn = Boolean(user?.id) && !loading && sessionStatus === 'ready' && !passwordChangeRequired;

  const shouldConsider = useMemo(
    () => signedIn && canShowForRoute && !alreadyGranted && typeof Notification !== 'undefined',
    [alreadyGranted, canShowForRoute, signedIn]
  );

  useEffect(() => {
    if (!shouldOfferPwaInstall()) {
      setInstallBlocking(false);
      return;
    }

    const onClosed = () => setInstallBlocking(false);
    window.addEventListener(INSTALL_PROMPT_CLOSED_EVENT, onClosed);
    return () => window.removeEventListener(INSTALL_PROMPT_CLOSED_EVENT, onClosed);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(getPushSupportInfo()).then((info) => {
      if (!cancelled) {
        setIsIOSBrowser(Boolean(info?.isIOS));
        setIsStandalone(Boolean(info?.isStandalone));
      }
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!shouldConsider || installBlocking || !shouldShowDailyPrompt(NOTIFY_PROMPT_SNOOZE_KEY)) {
      setVisible(false);
      return;
    }

    const timer = window.setTimeout(() => setVisible(true), 1600);
    return () => window.clearTimeout(timer);
  }, [installBlocking, shouldConsider]);

  const closeForToday = () => {
    dismissDailyPrompt(NOTIFY_PROMPT_SNOOZE_KEY);
    setVisible(false);
  };

  const enableNotifications = () => {
    if (typeof Notification === 'undefined' || Notification.permission === 'denied') {
      closeForToday();
      return;
    }

    // Start the OS/browser dialog in this same tap/click, then drop the in-app
    // overlay so Windows, Android, and iOS can show their permission popup.
    const permissionRequest = requestNotificationPermissionFromUserGesture();
    setVisible(false);

    void permissionRequest
      .then((result) => {
        if (result === 'granted') {
          window.dispatchEvent(new Event(PUSH_REGISTER_EVENT));
          return;
        }
        dismissDailyPrompt(NOTIFY_PROMPT_SNOOZE_KEY);
      })
      .catch(() => {
        dismissDailyPrompt(NOTIFY_PROMPT_SNOOZE_KEY);
      });
  };

  if (!visible) {
    return null;
  }

  const needsHomeScreen = isIOSBrowser && !isStandalone;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center px-4 sm:px-6">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" aria-hidden="true" />
      <div
        role="dialog"
        aria-labelledby="notification-permission-title"
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-2xl bg-white/15 p-2">
                <BellAlertIcon className="h-7 w-7" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Stay consistent</p>
                <h2 id="notification-permission-title" className="mt-1 text-2xl font-bold leading-tight">
                  Never miss Salah, Muhasabah, or Dhikr
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={closeForToday}
              className="rounded-lg p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Remind me tomorrow"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm leading-6 text-gray-700">
            Notifications are how HikmahSphere reaches you at the right moment — Fajr before sunrise,
            Maghrib at breaking time, your daily Muhasabah check-in, and Dhikr reminders you chose.
            Without permission, those alerts cannot leave this tab.
          </p>

          <ul className="space-y-2.5 text-sm text-gray-700">
            <li className="flex gap-2.5">
              <span className="mt-0.5 h-2 w-2 flex-none rounded-full bg-emerald-500" />
              Prayer-time Adhan so you are not late for Salah.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 h-2 w-2 flex-none rounded-full bg-emerald-500" />
              Daily Muhasabah reminder to log prayers, Quran, fasting, and dhikr.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 h-2 w-2 flex-none rounded-full bg-emerald-500" />
              Dhikr and important community updates, even when the site is in the background.
            </li>
          </ul>

          {needsHomeScreen && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              <p className="flex items-center gap-2 font-semibold">
                <DevicePhoneMobileIcon className="h-5 w-5" />
                iPhone / iPad
              </p>
              <p className="mt-1 leading-5">
                Safari only allows notifications after you add HikmahSphere to the Home Screen and open it from there.
                Install the app first, then allow notifications.
              </p>
            </div>
          )}

          {browserBlocked && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-900">
              Notifications are blocked for this site. Open your browser site settings, set Notifications to Allow,
              then return to HikmahSphere.
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeForToday}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={enableNotifications}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-emerald-600 hover:to-teal-600"
            >
              {browserBlocked
                ? 'I will enable it in settings'
                : 'Enable notifications'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPermissionPrompt;
