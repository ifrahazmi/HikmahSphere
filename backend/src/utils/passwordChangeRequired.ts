export const PASSWORD_CHANGE_REQUIRED_CODE = 'PASSWORD_CHANGE_REQUIRED';
export const PASSWORD_CHANGE_REQUIRED_MESSAGE = 'Please set a new password to continue.';

export const passwordChangeRequiredBody = {
  status: 'error' as const,
  code: PASSWORD_CHANGE_REQUIRED_CODE,
  message: PASSWORD_CHANGE_REQUIRED_MESSAGE,
};

export const sendPasswordChangeRequired = (res: {
  status: (code: number) => { json: (body: typeof passwordChangeRequiredBody) => unknown };
}) => res.status(403).json(passwordChangeRequiredBody);

export const isPasswordChangeRequest = (req: {
  method?: string;
  originalUrl?: string;
  path?: string;
}): boolean => {
  const url = (req.originalUrl || req.path || '').split('?')[0] ?? '';
  return req.method === 'POST' && url.endsWith('/auth/change-password');
};
