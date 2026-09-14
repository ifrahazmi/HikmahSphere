import { describe, expect, it, jest } from '@jest/globals';
import { applyTemporaryPasswordReset, validateTemporaryPassword } from './temporaryPassword';

describe('temporary password reset', () => {
  it('rejects short passwords', () => {
    expect(validateTemporaryPassword('12345')).toBe('Temporary password must be at least 6 characters.');
    expect(validateTemporaryPassword('  123  ')).toBe('Temporary password must be at least 6 characters.');
    expect(validateTemporaryPassword('secret1')).toBeNull();
  });

  it('sets the flag, stores the new password, and clears lockout before save', async () => {
    const user = {
      email: 'keep@example.com',
      firstName: 'Keep',
      password: 'old-hash',
      requiresPasswordChange: false,
      security: {
        loginAttempts: 5,
        lockUntil: new Date('2030-01-01'),
      },
      markModified: jest.fn(),
      save: jest.fn(async () => undefined),
    };

    await applyTemporaryPasswordReset(user, 'TempPass1');

    expect(user.password).toBe('TempPass1');
    expect(user.requiresPasswordChange).toBe(true);
    expect(user.email).toBe('keep@example.com');
    expect(user.firstName).toBe('Keep');
    expect(user.security.loginAttempts).toBe(0);
    expect(user.security.lockUntil).toBeUndefined();
    expect(user.markModified).toHaveBeenCalledWith('security');
    expect(user.save).toHaveBeenCalledTimes(1);
  });
});
