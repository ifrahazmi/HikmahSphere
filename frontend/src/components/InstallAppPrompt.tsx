import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownTrayIcon,
  ShareIcon,
  XMarkIcon,
  DevicePhoneMobileIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

const DISMISS_KEY = 'hs_install_prompt_dismissed_at';
const INSTALLED_KEY = 'hs_app_installed';
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const getDismissedRecently = (): boolean => {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < DISMISS_COOLDOWN_MS;
};

const setDismissedNow = (): void => {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
};

const InstallAppPrompt: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosStepsOpen, setIosStepsOpen] = useState(false);
  const [androidStepsOpen, setAndroidStepsOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  const ua = navigator.userAgent || '';
  const isDev = process.env.NODE_ENV === 'development';

  const isMobileLike = useMemo(() => /Android|iPhone|iPad|iPod|Mobile/i.test(ua), [ua]);
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
  const dismissedRecently = getDismissedRecently();

  useEffect(() => {
    // During development, always allow the prompt to re-appear for QA/device-emulation checks.
    if (isStandalone || (!isDev && (installedAlready || dismissedRecently))) {
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
      setDeferredPrompt(e);
      revealPrompt();
    };

    const handleAppInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, '1');
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    // iOS never fires beforeinstallprompt, and Edge Android emulation can miss this event.
    // In development, auto-show only on mobile-like UAs, not desktop.
    if (shouldShowIosGuide || isAndroid || (isDev && isMobileLike)) {
      revealPrompt();
    }

    return () => {
      if (revealTimer) window.clearTimeout(revealTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [
    dismissedRecently,
    installedAlready,
    isAndroid,
    isDev,
    isMobileLike,
    isStandalone,
    shouldShowIosGuide,
  ]);

  const dismiss = () => {
    setVisible(false);
    setDismissedNow();
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
        setDismissedNow();
        setVisible(false);
      }
    } catch (error) {
      console.error('Install prompt failed:', error);
      setDismissedNow();
      setVisible(false);
    } finally {
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
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                iPhone Install
              </p>
              {!isSafari ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-200">Open this website in Safari, then use Add to Home Screen.</p>
                  <button
                    type="button"
                    onClick={() => setIosStepsOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-emerald-300 hover:text-emerald-200"
                  >
                    <DevicePhoneMobileIcon className="h-4 w-4" />
                    {iosStepsOpen ? 'Hide Steps' : 'Show Steps'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIosStepsOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-emerald-300 hover:text-emerald-200"
                >
                  <ShareIcon className="h-4 w-4" />
                  {iosStepsOpen ? 'Hide Steps' : 'Show iPhone Steps'}
                </button>
              )}

              {iosStepsOpen && (
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-200">
                  <li>Tap the Share icon in Safari.</li>
                  <li>Select Add to Home Screen.</li>
                  <li>Tap Add to install the app icon.</li>
                </ol>
              )}
            </div>
          )}

          {!canUseNativeInstall && !shouldShowIosGuide && isAndroid && (
            <div className="rounded-xl border border-slate-600 bg-slate-800/90 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                Android Install
              </p>
              <button
                type="button"
                onClick={() => setAndroidStepsOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 text-sm font-medium text-emerald-300 hover:text-emerald-200"
              >
                <DevicePhoneMobileIcon className="h-4 w-4" />
                {androidStepsOpen ? 'Hide Steps' : 'Show Android Steps'}
              </button>

              {androidStepsOpen && (
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-200">
                  <li>Tap the browser menu (three dots).</li>
                  <li>Select Install app or Add to Home screen.</li>
                  <li>Confirm to place the app icon on your home screen.</li>
                </ol>
              )}
            </div>
          )}

          {!canUseNativeInstall && !shouldShowIosGuide && !isAndroid && (
            <p className="text-xs text-slate-300">
              Install becomes available once your browser reports this site as installable.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstallAppPrompt;
