import { getLocalDateKey } from './adhanStorage';

export const INSTALLED_APP_KEY = 'hs_app_installed';
/** @deprecated Install prompt uses session snooze; kept for legacy reads only. */
export const INSTALL_PROMPT_SNOOZE_KEY = 'hs_install_prompt_dismissed_on';
export const INSTALL_PROMPT_SESSION_SNOOZE_KEY = 'hs_install_prompt_dismissed_session';
export const NOTIFY_PROMPT_SNOOZE_KEY = 'hs_notify_prompt_dismissed_on';
export const INSTALL_PROMPT_CLOSED_EVENT = 'hs-install-prompt-closed';
export const PUSH_REGISTER_EVENT = 'hs-push-register';

export const shouldShowDailyPrompt = (storageKey: string, now: Date = new Date()): boolean => {
  try {
    return localStorage.getItem(storageKey) !== getLocalDateKey(now);
  } catch {
    return true;
  }
};

export const dismissDailyPrompt = (storageKey: string, now: Date = new Date()): void => {
  try {
    localStorage.setItem(storageKey, getLocalDateKey(now));
  } catch {
    // Private mode / quota: the prompt may reappear, which is safer than failing.
  }
};

export const detectStandalonePwa = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
};

export const shouldShowSessionPrompt = (storageKey: string): boolean => {
  try {
    return sessionStorage.getItem(storageKey) !== '1';
  } catch {
    return true;
  }
};

export const dismissSessionPrompt = (storageKey: string): void => {
  try {
    sessionStorage.setItem(storageKey, '1');
  } catch {
    // If session storage is unavailable, the prompt may reappear on navigation.
  }
};

/** True only when the app is running as an installed PWA (not a browser tab). */
export const isAppInstalled = (): boolean => detectStandalonePwa();

export const markAppInstalled = (): void => {
  try {
    localStorage.setItem(INSTALLED_APP_KEY, '1');
  } catch {
    // Standalone detection still hides the prompt when storage is unavailable.
  }
};

/**
 * Offer install in the browser on each new visit/session until the user opens
 * the standalone PWA. Dismissing the prompt only snoozes for the current session.
 */
export const shouldOfferPwaInstall = (): boolean =>
  !detectStandalonePwa()
  && shouldShowSessionPrompt(INSTALL_PROMPT_SESSION_SNOOZE_KEY);

export const emitInstallPromptClosed = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(INSTALL_PROMPT_CLOSED_EVENT));
};
