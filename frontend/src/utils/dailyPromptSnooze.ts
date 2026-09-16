import { getLocalDateKey } from './adhanStorage';

export const INSTALLED_APP_KEY = 'hs_app_installed';
export const INSTALL_PROMPT_SNOOZE_KEY = 'hs_install_prompt_dismissed_on';
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

export const isAppInstalled = (): boolean => {
  if (detectStandalonePwa()) {
    return true;
  }

  try {
    return localStorage.getItem(INSTALLED_APP_KEY) === '1';
  } catch {
    return false;
  }
};

export const markAppInstalled = (): void => {
  try {
    localStorage.setItem(INSTALLED_APP_KEY, '1');
  } catch {
    // Standalone detection still hides the prompt when storage is unavailable.
  }
};

export const shouldOfferPwaInstall = (now: Date = new Date()): boolean => {
  return !isAppInstalled() && shouldShowDailyPrompt(INSTALL_PROMPT_SNOOZE_KEY, now);
};

export const emitInstallPromptClosed = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(INSTALL_PROMPT_CLOSED_EVENT));
};
