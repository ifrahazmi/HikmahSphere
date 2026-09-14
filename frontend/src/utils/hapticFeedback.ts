export const HAPTIC_STORAGE_KEY = 'hikmahsphere:haptics-enabled';

export type HapticKind =
  | 'bead'
  | 'checkpoint'
  | 'success'
  | 'error'
  | 'notify'
  | 'prayer'
  | 'align';

export const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  bead: 36,
  checkpoint: [24, 36, 52],
  success: 45,
  error: [30, 40, 50],
  notify: [80, 40, 80],
  prayer: [160, 80, 220],
  align: 60,
};

/** Vibration API only. iPhone Safari never implements navigator.vibrate; iOS
 *  Taptic Engine still fires for OS/web-push notifications independently. */
export const canVibrate = (): boolean => {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
};

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

export const getHapticPattern = (kind: HapticKind): number | number[] => {
  return HAPTIC_PATTERNS[kind];
};

export const triggerHaptic = (kind: HapticKind): boolean => {
  if (!isHapticEnabled() || !canVibrate()) {
    return false;
  }

  try {
    return Boolean(navigator.vibrate(getHapticPattern(kind)));
  } catch {
    return false;
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

export const resolveOsNotificationVibrate = (isAdhan: boolean): number | number[] => {
  return isAdhan ? HAPTIC_PATTERNS.prayer : HAPTIC_PATTERNS.notify;
};
