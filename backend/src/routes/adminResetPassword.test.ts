import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Request, Response } from 'express';
import User from '../models/User';
import { resetUserPasswordHandler } from './adminResetPassword';

jest.mock('../models/User', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

const mockedUser = User as unknown as { findById: jest.Mock };

const createResponse = () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  return { json, status, res: { status, json } as unknown as Response };
};

describe('admin reset password', () => {
  beforeEach(() => {
    mockedUser.findById.mockReset();
  });

  it('rejects self-reset', async () => {
    const { json, status, res } = createResponse();
    await resetUserPasswordHandler({
      params: { id: 'admin-1' },
      user: { userId: 'admin-1' },
      body: { temporaryPassword: 'TempPass1' },
    } as unknown as Request, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      status: 'error',
      message: 'You cannot reset your own password this way.',
    });
    expect(mockedUser.findById).not.toHaveBeenCalled();
  });

  it('hashes via save, sets the flag, and does not return the temp password', async () => {
    const save = jest.fn(async () => undefined);
    const user = {
      email: 'member@example.com',
      password: 'old-hash',
      requiresPasswordChange: false,
      firstName: 'Aisha',
      save,
    };
    mockedUser.findById.mockResolvedValue(user);

    const { json, status, res } = createResponse();
    await resetUserPasswordHandler({
      params: { id: 'user-1' },
      user: { userId: 'admin-1' },
      body: { temporaryPassword: 'TempPass1' },
    } as unknown as Request, res);

    expect(user.password).toBe('TempPass1');
    expect(user.requiresPasswordChange).toBe(true);
    expect(user.email).toBe('member@example.com');
    expect(save).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({
      status: 'success',
      message: 'Temporary password set. The user must log in and choose a new password.',
    });
    expect(JSON.stringify(json.mock.calls[0]?.[0])).not.toContain('TempPass1');
  });
});
