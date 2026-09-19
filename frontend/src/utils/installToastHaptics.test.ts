import toast from 'react-hot-toast';
import { HAPTIC_STORAGE_KEY, resetHapticStateForTests, setHapticEnabled } from './hapticFeedback';
import { installToastHaptics } from './installToastHaptics';

describe('toast haptic wrapper', () => {
  const originalVibrate = navigator.vibrate;

  beforeEach(() => {
    resetHapticStateForTests();
    localStorage.removeItem(HAPTIC_STORAGE_KEY);
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: jest.fn(() => true),
    });
    installToastHaptics();
  });

  afterEach(() => {
    resetHapticStateForTests();
    localStorage.removeItem(HAPTIC_STORAGE_KEY);
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: originalVibrate,
    });
  });

  it('vibrates for success and error toasts but not Coming Soon', () => {
    const vibrate = navigator.vibrate as jest.Mock;
    toast.success('Saved');
    toast.error('Failed');
    toast.success('Coming Soon!');
    expect(vibrate).toHaveBeenNthCalledWith(1, 0);
    expect(vibrate).toHaveBeenNthCalledWith(2, [90]);
    expect(vibrate).toHaveBeenNthCalledWith(3, 0);
    expect(vibrate).toHaveBeenNthCalledWith(4, [60, 50, 100]);
  });

  it('does not vibrate toasts when haptics are muted', () => {
    const vibrate = navigator.vibrate as jest.Mock;
    setHapticEnabled(false);
    toast.success('Saved');
    toast.error('Failed');
    expect(vibrate).not.toHaveBeenCalled();
  });
});
