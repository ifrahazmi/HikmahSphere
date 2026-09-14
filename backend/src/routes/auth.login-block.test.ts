import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import User from '../models/User';
import { accountBlockedBody } from '../utils/accountBlocked';
import router from './auth';

jest.mock('../models/User', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    updateOne: jest.fn(),
  },
}));

jest.mock('../middleware/activityLogger', () => ({
  logAnonymousActivity: jest.fn(),
  logUserActivity: jest.fn(),
}));

jest.mock('express-validator', () => {
  const chain: any = jest.fn((_req: unknown, _res: unknown, next: () => void) => next());
  const proxy: any = new Proxy(chain, {
    get: (target, prop) => {
      if (prop in target) {
        return target[prop];
      }
      return () => proxy;
    },
  });
  return {
    body: () => proxy,
    validationResult: () => ({ isEmpty: () => true, array: () => [] }),
  };
});

const mockedUser = User as unknown as {
  findOne: jest.Mock;
  updateOne: jest.Mock;
};

const getLoginHandler = () => {
  const layer = (router as any).stack.find(
    (entry: any) => entry.route?.path === '/login' && entry.route.methods.post
  );
  if (!layer) {
    throw new Error('POST /login route not found');
  }
  const handlers = layer.route.stack;
  return handlers[handlers.length - 1].handle as (req: Request, res: Response) => Promise<void>;
};

describe('login blocked accounts', () => {
  beforeEach(() => {
    mockedUser.findOne.mockReset();
    mockedUser.updateOne.mockReset();
  });

  it('returns ACCOUNT_BLOCKED and does not issue a token', async () => {
    const user = {
      _id: { toString: () => 'blocked-id' },
      email: 'blocked@example.com',
      firstName: 'Blocked',
      lastName: 'User',
      username: 'blocked',
      role: 'user',
      isAdmin: false,
      isBlocked: true,
      comparePassword: jest.fn(async () => true),
      isAccountLocked: jest.fn(() => false),
      incrementLoginAttempts: jest.fn(),
    };
    mockedUser.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    const signSpy = jest.spyOn(jwt, 'sign');
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const req = {
      body: { email: 'blocked@example.com', password: 'correct-password' },
    } as unknown as Request;
    const res = { status, json } as unknown as Response;

    await getLoginHandler()(req, res);

    expect(user.comparePassword).toHaveBeenCalledWith('correct-password');
    expect(user.incrementLoginAttempts).not.toHaveBeenCalled();
    expect(mockedUser.updateOne).not.toHaveBeenCalled();
    expect(signSpy).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(accountBlockedBody);
    expect(json.mock.calls[0]?.[0]).not.toHaveProperty('token');

    signSpy.mockRestore();
  });

  it('returns passwordChangeRequired and a token without a full session user', async () => {
    const user = {
      _id: { toString: () => 'reset-id' },
      email: 'reset@example.com',
      firstName: 'Reset',
      lastName: 'User',
      username: 'reset',
      role: 'user',
      isAdmin: false,
      isBlocked: false,
      requiresPasswordChange: true,
      comparePassword: jest.fn(async () => true),
      isAccountLocked: jest.fn(() => false),
      incrementLoginAttempts: jest.fn(),
    };
    mockedUser.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });
    mockedUser.updateOne.mockResolvedValue({});

    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const req = {
      body: { email: 'reset@example.com', password: 'TempPass1' },
    } as unknown as Request;
    const res = { status, json } as unknown as Response;

    await getLoginHandler()(req, res);

    expect(status).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledTimes(1);
    const payload = json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.passwordChangeRequired).toBe(true);
    expect(payload.token).toEqual(expect.any(String));
    expect(payload.user).toEqual({ id: user._id, email: 'reset@example.com' });
    expect(payload.user).not.toHaveProperty('firstName');
  });

  it('returns a full user session when the password-change flag is off', async () => {
    const user = {
      _id: { toString: () => 'open-id' },
      email: 'open@example.com',
      firstName: 'Open',
      lastName: 'User',
      username: 'open',
      role: 'user',
      isAdmin: false,
      isBlocked: false,
      requiresPasswordChange: false,
      createdAt: new Date('2026-01-01'),
      gender: 'female',
      phoneNumber: '9998887776',
      address: {},
      preferences: { madhab: 'hanafi' },
      profile: { avatar: '', bio: '' },
      comparePassword: jest.fn(async () => true),
      isAccountLocked: jest.fn(() => false),
      incrementLoginAttempts: jest.fn(),
    };
    mockedUser.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });
    mockedUser.updateOne.mockResolvedValue({});

    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const req = {
      body: { email: 'open@example.com', password: 'correct-password' },
    } as unknown as Request;
    const res = { status, json } as unknown as Response;

    await getLoginHandler()(req, res);

    expect(status).not.toHaveBeenCalled();
    const payload = json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.passwordChangeRequired).toBeUndefined();
    expect(payload.token).toEqual(expect.any(String));
    expect(payload.user).toMatchObject({
      email: 'open@example.com',
      firstName: 'Open',
      lastName: 'User',
    });
  });
});
