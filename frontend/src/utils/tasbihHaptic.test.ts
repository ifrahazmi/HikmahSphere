import { HAPTIC_STORAGE_KEY, resetHapticStateForTests, setHapticEnabled } from './hapticFeedback';
import { canVibrate, getTasbihHapticPattern, vibrateTasbihClick } from './tasbihHaptic';

describe('tasbih haptic', () => {
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

  it('uses a short pulse for beads and a double pulse at checkpoints', () => {
    expect(getTasbihHapticPattern('bead')).toBe(36);
    expect(getTasbihHapticPattern('checkpoint')).toEqual([24, 36, 52]);
  });

  it('returns false when the Vibration API is missing', () => {
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: undefined,
    });

    expect(canVibrate()).toBe(false);
    expect(vibrateTasbihClick('bead')).toBe(false);
  });

  it('sends the pattern when vibrate is available', () => {
    const vibrate = navigator.vibrate as jest.Mock;

    expect(canVibrate()).toBe(true);
    expect(vibrateTasbihClick('checkpoint')).toBe(true);
    expect(vibrate).toHaveBeenCalledWith([24, 36, 52]);
  });

  it('stays silent when the global haptic setting is off', () => {
    const vibrate = navigator.vibrate as jest.Mock;
    setHapticEnabled(false);
    expect(vibrateTasbihClick('bead')).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });
});
