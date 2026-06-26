import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownTrayIcon,
  ShareIcon,
  XMarkIcon,
  DevicePhoneMobileIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

const INSTALLED_KEY = 'hs_app_installed';

const InstallAppPrompt: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => (typeof window !== 'undefined' ? window.deferredInstallPrompt ?? null : null)
  );
  const [installing, setInstalling] = useState(false);

  const ua = navigator.userAgent || '';
  const isDev = process.env.NODE_ENV === 'development';

  const isAndroid = useMemo(() => /Android/i.test(ua), [ua]);
  const isIOS = useMemo(() => /iPad|iPhone|iPod/.test(ua), [ua]);
  const isSafari = useMemo(
    () => /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|SamsungBrowser/i.test(ua),
    [ua]
  );
  const isStandalone = useMemo(
    () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true,
    []
  );

  const canUseNativeInstall = !!deferredPrompt && !isIOS;
  const shouldShowIosGuide = isIOS && !isStandalone;
  const installedAlready = localStorage.getItem(INSTALLED_KEY) === '1';

  useEffect(() => {
    // Only stay hidden for users already running the installed app.
    // We intentionally do NOT suppress based on previous dismissals, so the
    // prompt keeps appearing on every visit until the app is installed.
    if (isStandalone || (!isDev && installedAlready)) {
      return;
    }

    let revealTimer: number | undefined;
    const revealPrompt = (delayMs = 1400) => {
      if (revealTimer) window.clearTimeout(revealTimer);
      revealTimer = window.setTimeout(() => setVisible(true), delayMs);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      const e = event as BeforeInstallPromptEvent;
      e.preventDefault();
      window.deferredInstallPrompt = e;
      setDeferredPrompt(e);
      revealPrompt();
    };

    // Fired by the early capture in index.tsx if the event already fired before mount.
    const handleInstallAvailable = () => {
      if (window.deferredInstallPrompt) {
        setDeferredPrompt(window.deferredInstallPrompt);
      }
      revealPrompt();
    };

    const handleAppInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, '1');
      window.deferredInstallPrompt = null;
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('hs-install-available', handleInstallAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);

    // If the prompt was already captured before this component mounted, use it now.
    if (window.deferredInstallPrompt) {
      setDeferredPrompt(window.deferredInstallPrompt);
    }

    // Always reveal when not installed. Desktop (Windows), Android and iOS all
    // get the prompt: a native one-click button when the browser supports it,
    // otherwise platform-specific manual steps.
    revealPrompt();

    return () => {
      if (revealTimer) window.clearTimeout(revealTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('hs-install-available', handleInstallAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [installedAlready, isDev, isStandalone]);

  const dismiss = () => {
    // Hide for the current view only; it reappears on the next visit/reload
    // until the app is actually installed.
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    try {
      setInstalling(true);
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        localStorage.setItem(INSTALLED_KEY, '1');
        setVisible(false);
      } else {
        setVisible(false);
      }
    } catch (error) {
      console.error('Install prompt failed:', error);
      setVisible(false);
    } finally {
      window.deferredInstallPrompt = null;
      setDeferredPrompt(null);
      setInstalling(false);
    }
  };

  if (!visible || isStandalone || (!isDev && installedAlready)) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[80] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:max-w-md">
      <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/95 shadow-[0_22px_55px_rgba(0,0,0,0.55)] ring-1 ring-black/50 backdrop-blur-xl">
        <div className="flex items-start justify-between border-b border-slate-700 bg-slate-900/85 px-4 py-3">
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-emerald-400" />
            <p className="text-sm font-semibold text-slate-100">Install HikmahSphere App</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close install prompt"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3">
          <p className="text-sm text-slate-200">
            Add this app to your home screen for faster launch, full-screen experience, and better offline reliability.
          </p>

          {canUseNativeInstall && (
            <button
              type="button"
              onClick={install}
              disabled={installing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              {installing ? 'Preparing…' : 'Install in One Click'}
            </button>
          )}

          {!canUseNativeInstall && shouldShowIosGuide && (
            <div className="rounded-xl border border-slate-600 bg-slate-800/90 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                <DevicePhoneMobileIcon className="h-4 w-4" />
                Add to iPhone Home Screen
              </p>

              {!isSafari && (
                <p className="mb-3 rounded-lg bg-slate-700/70 px-3 py-2 text-sm text-slate-100">
                  Open this site in <span className="font-semibold">Safari</span> first — iPhone can only add apps from Safari.
                </p>
              )}

              <ol className="space-y-2.5 text-sm text-slate-200">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">1</span>
                  <span className="flex flex-wrap items-center gap-1">
                    Tap the
                    <ShareIcon className="h-4 w-4 text-emerald-300" />
                    <span className="font-semibold">Share</span> button in the Safari toolbar.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">2</span>
                  <span>Scroll down and tap <span className="font-semibold">Add to Home Screen</span>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">3</span>
                  <span>Tap <span className="font-semibold">Add</span> in the top corner — that's it!</span>
                </li>
              </ol>
            </div>
          )}

          {!canUseNativeInstall && !shouldShowIosGuide && isAndroid && (
            <div className="rounded-xl border border-slate-600 bg-slate-800/90 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                <DevicePhoneMobileIcon className="h-4 w-4" />
                Add to Android Home Screen
              </p>
              <ol className="space-y-2.5 text-sm text-slate-200">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">1</span>
                  <span>Tap the browser menu (three dots) in the top corner.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">2</span>
                  <span>Tap <span className="font-semibold">Install app</span> or <span className="font-semibold">Add to Home screen</span>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">3</span>
                  <span>Tap <span className="font-semibold">Install</span> to confirm.</span>
                </li>
              </ol>
            </div>
          )}

          {!canUseNativeInstall && !shouldShowIosGuide && !isAndroid && (
            <div className="rounded-xl border border-slate-600 bg-slate-800/90 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                <ArrowDownTrayIcon className="h-4 w-4" />
                Install on Windows / Desktop
              </p>
              <ol className="space-y-2.5 text-sm text-slate-200">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">1</span>
                  <span>Click the install icon on the right side of the address bar.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">2</span>
                  <span>Or open the browser menu (three dots) → <span className="font-semibold">Install HikmahSphere</span>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">3</span>
                  <span>Click <span className="font-semibold">Install</span> to add it as a desktop app.</span>
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstallAppPrompt;
