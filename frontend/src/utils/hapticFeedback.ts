export const HAPTIC_STORAGE_KEY = 'hikmahsphere:haptics-enabled';

export type HapticKind =
  | 'bead'
  | 'checkpoint'
  | 'success'
  | 'error'
  | 'notify'
  | 'prayer'
  | 'align';

/**
 * Android vibrator motors (Samsung, Pixel, Xiaomi) routinely ignore pulses
 * under ~70ms even when navigator.vibrate returns true. Keep every ON segment
 * at or above that floor. Always store arrays — some Android WebViews reject
 * a bare number.
 */
export const HAPTIC_PATTERNS: Record<HapticKind, number[]> = {
  bead: [80],
  checkpoint: [70, 45, 120],
  success: [90],
  error: [60, 50, 100],
  notify: [100, 50, 120],
  prayer: [180, 80, 240],
  align: [100],
};

type VibrateFn = (pattern: number | number[]) => boolean;

const getVibrateFn = (): VibrateFn | null => {
  if (typeof navigator === 'undefined') {
    return null;
  }

  const nav = navigator as Navigator & {
    webkitVibrate?: VibrateFn;
    mozVibrate?: VibrateFn;
  };
  const fn = nav.vibrate || nav.webkitVibrate || nav.mozVibrate;
  if (typeof fn !== 'function') {
    return null;
  }
  return (pattern) => fn.call(nav, pattern);
};

/** Vibration API only. iPhone Safari never implements navigator.vibrate; iOS
 *  Taptic Engine still fires for OS/web-push notifications independently. */
/** Vibration API only. iPhone Safari never implements navigator.vibrate; iOS
 *  Taptic Engine still fires for OS/web-push notifications independently. */
export const canVibrate = (): boolean => Boolean(getVibrateFn());

const readStoredEnabled = (): boolean => {
  if (typeof localStorage === 'undefined') {
    return true;
  }

  try {
    const stored = localStorage.getItem(HAPTIC_STORAGE_KEY);
    if (stored === null) {
      return true;
    }
    return stored !== 'false';
  } catch {
    return true;
  }
};

let enabledOverride: boolean | null = null;

export const isHapticEnabled = (): boolean => {
  if (enabledOverride !== null) {
    return enabledOverride;
  }
  return readStoredEnabled();
};

export const setHapticEnabled = (enabled: boolean): void => {
  enabledOverride = enabled;
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(HAPTIC_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore quota / private-mode failures.
  }
};

export const getHapticPattern = (kind: HapticKind): number[] => {
  return HAPTIC_PATTERNS[kind];
};

export const triggerHaptic = (kind: HapticKind): boolean => {
  if (!isHapticEnabled()) {
    return false;
  }

  const vibrate = getVibrateFn();
  if (!vibrate) {
    return false;
  }

  const pattern = getHapticPattern(kind);

  try {
    // Replace any in-flight pulse so rapid tasbih taps still fire on Android.
    vibrate(0);
    return Boolean(vibrate(pattern));
  } catch {
    try {
      return Boolean(vibrate(pattern));
    } catch {
      return false;
    }
  }
};

export const resetHapticStateForTests = (): void => {
  enabledOverride = null;
};

export const resolveForegroundPushHaptic = (
  alreadySeen: boolean,
  isAdhan: boolean,
  isVisible: boolean
): HapticKind | null => {
  if (alreadySeen || isAdhan || !isVisible) {
    return null;
  }
  return 'notify';
};

export const resolveSystemNotificationHaptic = (
  type: unknown,
  isVisible: boolean
): HapticKind | null => {
  if (!isVisible) {
    return null;
  }
  if (type === 'adhan') {
    return 'prayer';
  }
  if (type === 'adhan-test') {
    return null;
  }
  return 'notify';
};

export const resolveOsNotificationVibrate = (isAdhan: boolean): number[] => {
  return isAdhan ? HAPTIC_PATTERNS.prayer : HAPTIC_PATTERNS.notify;
};
