/**
 * Pending Adhan playback queue — used when the user taps a prayer notification
 * or lands on /prayers?playAdhan=1. Mobile browsers require a visible Play button
 * (user gesture); desktop may auto-play when the prompt opens.
 */

export const PENDING_ADHAN_STORAGE_KEY = 'hs-pending-adhan';
export const ADHAN_PENDING_EVENT = 'hs-adhan-pending';

export type PendingAdhanSource = 'notification' | 'url' | 'service-worker' | 'foreground';

export interface PendingAdhan {
  prayer?: string;
  requestedAt: string;
  source: PendingAdhanSource;
}

const readRaw = (): PendingAdhan | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(PENDING_ADHAN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingAdhan;
    if (!parsed?.requestedAt) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const peekPendingAdhan = (): PendingAdhan | null => readRaw();

export const clearPendingAdhan = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_ADHAN_STORAGE_KEY);
  } catch {
    // ignore
  }
};

export const queueAdhanPlayback = (
  prayer?: string,
  source: PendingAdhanSource = 'notification'
): PendingAdhan => {
  const pending: PendingAdhan = {
    prayer: prayer?.trim() || undefined,
    requestedAt: new Date().toISOString(),
    source,
  };

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(PENDING_ADHAN_STORAGE_KEY, JSON.stringify(pending));
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent(ADHAN_PENDING_EVENT, { detail: pending }));
  }

  return pending;
};

export const consumePendingAdhan = (): PendingAdhan | null => {
  const pending = readRaw();
  clearPendingAdhan();
  return pending;
};

export const parseAdhanQueryParams = (
  search: string
): { shouldPlay: boolean; prayer?: string } => {
  try {
    const params = new URLSearchParams(search);
    const shouldPlay = params.get('playAdhan') === '1';
    const prayer = params.get('prayer')?.trim() || undefined;
    return { shouldPlay, prayer };
  } catch {
    return { shouldPlay: false };
  }
};

export const stripAdhanQueryParams = (search: string): string => {
  try {
    const params = new URLSearchParams(search);
    params.delete('playAdhan');
    params.delete('prayer');
    const next = params.toString();
    return next ? `?${next}` : '';
  } catch {
    return '';
  }
};

export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent || '';
  const iOSByUa = /iPad|iPhone|iPod/.test(ua);
  const iPadOS13Plus = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const android = /Android/i.test(ua);
  return iOSByUa || iPadOS13Plus || android;
};

export const formatPrayerLabel = (prayer?: string): string => {
  if (!prayer) return 'Prayer';
  return prayer.charAt(0).toUpperCase() + prayer.slice(1).toLowerCase();
};
