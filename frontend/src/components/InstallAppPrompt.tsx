import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowDownTrayIcon,
  ShareIcon,
  XMarkIcon,
  DevicePhoneMobileIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import {
  INSTALL_PROMPT_SESSION_SNOOZE_KEY,
  detectStandalonePwa,
  dismissSessionPrompt,
  emitInstallPromptClosed,
  markAppInstalled,
  shouldOfferPwaInstall,
} from '../utils/dailyPromptSnooze';

type InstallAppPromptProps = {
  startupGateClear: boolean;
};

const InstallAppPrompt: React.FC<InstallAppPromptProps> = ({ startupGateClear }) => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => (typeof window !== 'undefined' ? window.deferredInstallPrompt ?? null : null)
  );
  const [installing, setInstalling] = useState(false);
  const [isStandalone, setIsStandalone] = useState(detectStandalonePwa);

  const ua = navigator.userAgent || '';

  const isAndroid = useMemo(() => /Android/i.test(ua), [ua]);
  const isIOS = useMemo(
    () =>
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    [ua]
  );
  const isSafari = useMemo(
    () => /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|SamsungBrowser/i.test(ua),
    [ua]
  );

  const canUseNativeInstall = !!deferredPrompt && !isIOS;
  const shouldShowIosGuide = isIOS && !isStandalone;
  const canShowForRoute = location.pathname !== '/auth';

  useEffect(() => {
    if (isStandalone || !canShowForRoute || !startupGateClear || !shouldOfferPwaInstall()) {
      setVisible(false);
      emitInstallPromptClosed();
      return;
    }

    let revealTimer: number | undefined;
    const revealPrompt = (delayMs = 1200) => {
      if (!shouldOfferPwaInstall() || !canShowForRoute || !startupGateClear) {
        emitInstallPromptClosed();
        return;
      }
      if (revealTimer) window.clearTimeout(revealTimer);
      revealTimer = window.setTimeout(() => setVisible(true), delayMs);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      const e = event as BeforeInstallPromptEvent;
      e.preventDefault();
      window.deferredInstallPrompt = e;
      setDeferredPrompt(e);
      revealPrompt(800);
    };

    const handleInstallAvailable = () => {
      if (window.deferredInstallPrompt) {
        setDeferredPrompt(window.deferredInstallPrompt);
      }
      revealPrompt();
    };

    const handleAppInstalled = () => {
      markAppInstalled();
      window.deferredInstallPrompt = null;
      setVisible(false);
      setDeferredPrompt(null);
      setIsStandalone(detectStandalonePwa());
      emitInstallPromptClosed();
    };

    const refreshDisplayMode = () => {
      const standalone = detectStandalonePwa();
      setIsStandalone(standalone);
      if (standalone) {
        markAppInstalled();
        setVisible(false);
        emitInstallPromptClosed();
      }
    };

    const displayModeQuery = window.matchMedia('(display-mode: standalone)');
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('hs-install-available', handleInstallAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pageshow', refreshDisplayMode);
    document.addEventListener('visibilitychange', refreshDisplayMode);
    displayModeQuery.addEventListener?.('change', refreshDisplayMode);

    if (window.deferredInstallPrompt) {
      setDeferredPrompt(window.deferredInstallPrompt);
    }

    revealPrompt();

    return () => {
      if (revealTimer) window.clearTimeout(revealTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('hs-install-available', handleInstallAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pageshow', refreshDisplayMode);
      document.removeEventListener('visibilitychange', refreshDisplayMode);
      displayModeQuery.removeEventListener?.('change', refreshDisplayMode);
    };
  }, [canShowForRoute, isStandalone, startupGateClear]);

  const dismissForSession = () => {
    dismissSessionPrompt(INSTALL_PROMPT_SESSION_SNOOZE_KEY);
    setVisible(false);
    emitInstallPromptClosed();
  };

  const confirmManualInstall = () => {
    dismissForSession();
  };

  const install = async () => {
    if (!deferredPrompt) return;
    try {
      setInstalling(true);
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        markAppInstalled();
        setVisible(false);
        emitInstallPromptClosed();
      } else {
        dismissForSession();
      }
    } catch (error) {
      console.error('Install prompt failed:', error);
      dismissForSession();
    } finally {
      window.deferredInstallPrompt = null;
      setDeferredPrompt(null);
      setInstalling(false);
    }
  };

  if (!visible || isStandalone || !canShowForRoute) return null;

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center px-4 sm:px-6">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" aria-hidden="true" />
      <div
        role="dialog"
        aria-labelledby="install-app-title"
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
      >
        <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-emerald-900 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-2xl bg-white/15 p-2">
                <SparklesIcon className="h-7 w-7 text-emerald-300" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  Install the app
                </p>
                <h2 id="install-app-title" className="mt-1 text-2xl font-bold leading-tight">
                  Install HikmahSphere
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissForSession}
              className="rounded-lg p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Close install prompt"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm leading-6 text-gray-700 dark:text-slate-200">
            Add HikmahSphere to your Home Screen or desktop so prayer alerts, Muhasabah reminders,
            and Dhikr notifications reach you even when this browser tab is closed. On iPhone,
            installing from Safari is required for notifications.
          </p>

          {canUseNativeInstall && (
            <button
              type="button"
              onClick={install}
              disabled={installing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              {installing ? 'Preparing…' : 'Install in one click'}
            </button>
          )}

          {!canUseNativeInstall && shouldShowIosGuide && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="mb-2 flex items-center gap-1.5 font-semibold">
                <DevicePhoneMobileIcon className="h-5 w-5" />
                Add to iPhone Home Screen
              </p>

              {!isSafari && (
                <p className="mb-3 rounded-lg bg-amber-100/80 px-3 py-2 dark:bg-amber-900/50">
                  Open this site in <span className="font-semibold">Safari</span> first — iPhone can only add apps from Safari.
                </p>
              )}

              <ol className="space-y-2.5">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">1</span>
                  <span className="flex flex-wrap items-center gap-1">
                    Tap the
                    <ShareIcon className="h-4 w-4 text-emerald-600" />
                    <span className="font-semibold">Share</span> button in Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">2</span>
                  <span>Tap <span className="font-semibold">Add to Home Screen</span>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">3</span>
                  <span>Tap <span className="font-semibold">Add</span> to finish.</span>
                </li>
              </ol>
            </div>
          )}

          {!canUseNativeInstall && !shouldShowIosGuide && isAndroid && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100">
              <p className="mb-2 flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                <DevicePhoneMobileIcon className="h-5 w-5" />
                Add to Android Home Screen
              </p>
              <ol className="space-y-2.5">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">1</span>
                  <span>Tap the browser menu (three dots).</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">2</span>
                  <span>Tap <span className="font-semibold">Install app</span> or <span className="font-semibold">Add to Home screen</span>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">3</span>
                  <span>Confirm with <span className="font-semibold">Install</span>.</span>
                </li>
              </ol>
            </div>
          )}

          {!canUseNativeInstall && !shouldShowIosGuide && !isAndroid && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100">
              <p className="mb-2 flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                <ArrowDownTrayIcon className="h-5 w-5" />
                Install on desktop
              </p>
              <ol className="space-y-2.5">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">1</span>
                  <span>Click the install icon in the address bar.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">2</span>
                  <span>Or use the browser menu → <span className="font-semibold">Install HikmahSphere</span>.</span>
                </li>
              </ol>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={dismissForSession}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Continue in browser
            </button>
            {!canUseNativeInstall && (
              <button
                type="button"
                onClick={confirmManualInstall}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-emerald-600 hover:to-teal-600"
              >
                I installed the app
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstallAppPrompt;
