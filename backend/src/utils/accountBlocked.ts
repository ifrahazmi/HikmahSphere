export const ACCOUNT_BLOCKED_CODE = 'ACCOUNT_BLOCKED';
export const ACCOUNT_BLOCKED_MESSAGE = 'Your account has been blocked.';

export const accountBlockedBody = {
  status: 'error' as const,
  code: ACCOUNT_BLOCKED_CODE,
  message: ACCOUNT_BLOCKED_MESSAGE,
};

export const sendAccountBlocked = (res: {
  status: (code: number) => { json: (body: typeof accountBlockedBody) => unknown };
}) => res.status(403).json(accountBlockedBody);
