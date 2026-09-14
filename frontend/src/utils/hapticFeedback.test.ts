import {
  HAPTIC_PATTERNS,
  HAPTIC_STORAGE_KEY,
  canVibrate,
  getHapticPattern,
  isHapticEnabled,
  resolveForegroundPushHaptic,
  resolveOsNotificationVibrate,
  resolveSystemNotificationHaptic,
  resetHapticStateForTests,
  setHapticEnabled,
  triggerHaptic,
} from './hapticFeedback';

describe('haptic feedback', () => {
  const originalVibrate = navigator.vibrate;

  beforeEach(() => {
    resetHapticStateForTests();
    localStorage.removeItem(HAPTIC_STORAGE_KEY);
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: jest.fn(() => true),
    });
  });

  afterEach(() => {
    resetHapticStateForTests();
    localStorage.removeItem(HAPTIC_STORAGE_KEY);
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: originalVibrate,
    });
  });

  it('exposes distinct patterns for alerts and tasbeeh', () => {
    expect(getHapticPattern('bead')).toBe(36);
    expect(getHapticPattern('checkpoint')).toEqual([24, 36, 52]);
    expect(getHapticPattern('success')).toBe(45);
    expect(getHapticPattern('error')).toEqual([30, 40, 50]);
    expect(getHapticPattern('notify')).toEqual([80, 40, 80]);
    expect(getHapticPattern('prayer')).toEqual([160, 80, 220]);
    expect(getHapticPattern('align')).toBe(60);
    expect(HAPTIC_PATTERNS.prayer).not.toEqual(HAPTIC_PATTERNS.notify);
  });

  it('is enabled by default and persists the mute flag', () => {
    expect(isHapticEnabled()).toBe(true);
    setHapticEnabled(false);
    expect(isHapticEnabled()).toBe(false);
    expect(localStorage.getItem(HAPTIC_STORAGE_KEY)).toBe('false');
  });

  it('does not vibrate when muted or unsupported', () => {
    const vibrate = navigator.vibrate as jest.Mock;
    setHapticEnabled(false);
    expect(triggerHaptic('notify')).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();

    setHapticEnabled(true);
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: undefined,
    });
    expect(canVibrate()).toBe(false);
    expect(triggerHaptic('success')).toBe(false);
  });

  it('sends the named pattern when enabled', () => {
    const vibrate = navigator.vibrate as jest.Mock;
    expect(triggerHaptic('prayer')).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith([160, 80, 220]);
  });

  it('avoids a second buzz for seen, background, or in-app Adhan pushes', () => {
    expect(resolveForegroundPushHaptic(true, false, true)).toBeNull();
    expect(resolveForegroundPushHaptic(false, true, true)).toBeNull();
    expect(resolveForegroundPushHaptic(false, false, false)).toBeNull();
    expect(resolveForegroundPushHaptic(false, false, true)).toBe('notify');
  });

  it('uses prayer haptic only for visible Adhan system alerts', () => {
    expect(resolveSystemNotificationHaptic('adhan', true)).toBe('prayer');
    expect(resolveSystemNotificationHaptic('adhan', false)).toBeNull();
    expect(resolveSystemNotificationHaptic('adhan-test', true)).toBeNull();
    expect(resolveSystemNotificationHaptic('admin', true)).toBe('notify');
    expect(resolveOsNotificationVibrate(true)).toEqual([160, 80, 220]);
    expect(resolveOsNotificationVibrate(false)).toEqual([80, 40, 80]);
  });
});
