import toast from 'react-hot-toast';
import { triggerHaptic } from './hapticFeedback';

let installed = false;

const shouldSkipMessage = (message: unknown): boolean => {
  return typeof message === 'string' && /coming soon/i.test(message);
};

export const installToastHaptics = (): void => {
  if (installed) {
    return;
  }

  const originalSuccess = toast.success.bind(toast);
  const originalError = toast.error.bind(toast);

  toast.success = ((message: Parameters<typeof toast.success>[0], options?: Parameters<typeof toast.success>[1]) => {
    if (!shouldSkipMessage(message)) {
      triggerHaptic('success');
    }
    return originalSuccess(message, options);
  }) as typeof toast.success;

  toast.error = ((message: Parameters<typeof toast.error>[0], options?: Parameters<typeof toast.error>[1]) => {
    triggerHaptic('error');
    return originalError(message, options);
  }) as typeof toast.error;

  installed = true;
};

export const resetToastHapticsForTests = (): void => {
  installed = false;
};
