import { toast } from 'react-hot-toast';

export const ACCOUNT_BLOCKED_CODE = 'ACCOUNT_BLOCKED';
export const ACCOUNT_BLOCKED_MESSAGE = 'Your account has been blocked.';

type ErrorPayload = {
  code?: unknown;
};

const payloadFromUnknown = (value: unknown): ErrorPayload | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  return value as ErrorPayload;
};

export const isAccountBlockedPayload = (payload: unknown): boolean =>
  payloadFromUnknown(payload)?.code === ACCOUNT_BLOCKED_CODE;

export const isAccountBlockedHttpError = (status?: number, payload?: unknown): boolean =>
  status === 403 && isAccountBlockedPayload(payload);

export const isAxiosAccountBlocked = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const axiosError = error as { response?: { status?: number; data?: unknown } };
  return isAccountBlockedHttpError(axiosError.response?.status, axiosError.response?.data);
};

export const notifyAccountBlocked = (): void => {
  toast.error(ACCOUNT_BLOCKED_MESSAGE, { id: 'account-blocked' });
  if (process.env.NODE_ENV === 'test' || window.location.pathname.startsWith('/auth')) {
    return;
  }
  try {
    window.location.assign('/auth');
  } catch {
    // Some browsers reject programmatic navigation.
  }
};

export const handleAxiosAccountBlocked = (error: unknown, onBlocked: () => void): boolean => {
  if (!isAxiosAccountBlocked(error)) {
    return false;
  }

  notifyAccountBlocked();
  onBlocked();
  return true;
};
