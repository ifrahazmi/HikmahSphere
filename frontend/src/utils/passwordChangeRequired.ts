export const PASSWORD_CHANGE_REQUIRED_CODE = 'PASSWORD_CHANGE_REQUIRED';
export const PASSWORD_CHANGE_REQUIRED_MESSAGE = 'Please set a new password to continue.';

type ErrorPayload = {
  code?: unknown;
};

const payloadFromUnknown = (value: unknown): ErrorPayload | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  return value as ErrorPayload;
};

export const isPasswordChangeRequiredPayload = (payload: unknown): boolean =>
  payloadFromUnknown(payload)?.code === PASSWORD_CHANGE_REQUIRED_CODE;

export const isPasswordChangeRequiredHttpError = (status?: number, payload?: unknown): boolean =>
  status === 403 && isPasswordChangeRequiredPayload(payload);

export const isAxiosPasswordChangeRequired = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const axiosError = error as { response?: { status?: number; data?: unknown } };
  return isPasswordChangeRequiredHttpError(axiosError.response?.status, axiosError.response?.data);
};

export const handleAxiosPasswordChangeRequired = (error: unknown, onRequired: () => void): boolean => {
  if (!isAxiosPasswordChangeRequired(error)) {
    return false;
  }

  onRequired();
  return true;
};
