export const MIN_TEMPORARY_PASSWORD_LENGTH = 6;

type ResettableUser = {
  password: string;
  requiresPasswordChange: boolean;
  security?: {
    loginAttempts?: number;
    lockUntil?: Date;
  };
  markModified?: (path: string) => void;
  save: () => Promise<unknown>;
};

export const validateTemporaryPassword = (password: unknown): string | null => {
  if (typeof password !== 'string' || password.trim().length < MIN_TEMPORARY_PASSWORD_LENGTH) {
    return `Temporary password must be at least ${MIN_TEMPORARY_PASSWORD_LENGTH} characters.`;
  }
  return null;
};

export const applyTemporaryPasswordReset = async (
  user: ResettableUser,
  temporaryPassword: string
): Promise<void> => {
  user.password = temporaryPassword;
  user.requiresPasswordChange = true;
  if (user.security) {
    user.security.loginAttempts = 0;
    delete user.security.lockUntil;
    user.markModified?.('security');
  }
  await user.save();
};
