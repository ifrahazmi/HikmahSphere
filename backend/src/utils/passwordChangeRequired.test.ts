import { describe, expect, it } from '@jest/globals';
import {
  isPasswordChangeRequest,
  passwordChangeRequiredBody,
} from './passwordChangeRequired';

describe('password change required helpers', () => {
  it('allows only the change-password route', () => {
    expect(isPasswordChangeRequest({
      method: 'POST',
      originalUrl: '/api/auth/change-password',
    })).toBe(true);
    expect(isPasswordChangeRequest({
      method: 'GET',
      originalUrl: '/api/auth/profile',
    })).toBe(false);
    expect(isPasswordChangeRequest({
      method: 'POST',
      originalUrl: '/api/notifications/heartbeat',
    })).toBe(false);
  });

  it('uses a dedicated error body', () => {
    expect(passwordChangeRequiredBody).toEqual({
      status: 'error',
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'Please set a new password to continue.',
    });
  });
});
