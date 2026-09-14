import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import User from '../models/User';
import { accountBlockedBody } from '../utils/accountBlocked';
import { passwordChangeRequiredBody } from '../utils/passwordChangeRequired';
import { authMiddleware } from './auth';

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

const signToken = (userId: string) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || 'your_jwt_secret');

describe('authMiddleware blocked accounts', () => {
  beforeEach(() => {
    mockedUser.findById.mockReset();
  });

  it('rejects a valid JWT when the user is blocked', async () => {
    const select = jest.fn().mockResolvedValue({
      email: 'blocked@example.com',
      firstName: 'Blocked',
      lastName: 'User',
      username: 'blocked',
      role: 'user',
      isAdmin: false,
      isBlocked: true,
    });
    mockedUser.findById.mockReturnValue({ select });

    const { json, status, res } = createResponse();
    const next = jest.fn() as NextFunction;
    const req = {
      header: () => `Bearer ${signToken('user-blocked')}`,
    } as unknown as Request;

    await authMiddleware(req, res, next);

    expect(mockedUser.findById).toHaveBeenCalledWith('user-blocked');
    expect(select).toHaveBeenCalledWith('email firstName lastName username role isAdmin isBlocked requiresPasswordChange');
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(accountBlockedBody);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows the same JWT shape when the user is not blocked', async () => {
    const select = jest.fn().mockResolvedValue({
      email: 'open@example.com',
      firstName: 'Open',
      lastName: 'User',
      username: 'open',
      role: 'user',
      isAdmin: false,
      isBlocked: false,
      requiresPasswordChange: false,
    });
    mockedUser.findById.mockReturnValue({ select });

    const { status, res } = createResponse();
    const next = jest.fn() as NextFunction;
    const req = {
      header: () => `Bearer ${signToken('user-open')}`,
    } as unknown as Request;

    await authMiddleware(req, res, next);

    expect(status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect((req as Request & { user?: { userId?: string } }).user?.userId).toBe('user-open');
  });

  it('rejects other APIs when a password change is required', async () => {
    const select = jest.fn().mockResolvedValue({
      email: 'reset@example.com',
      firstName: 'Reset',
      lastName: 'User',
      username: 'reset',
      role: 'user',
      isAdmin: false,
      isBlocked: false,
      requiresPasswordChange: true,
    });
    mockedUser.findById.mockReturnValue({ select });

    const { json, status, res } = createResponse();
    const next = jest.fn() as NextFunction;
    const req = {
      method: 'GET',
      originalUrl: '/api/auth/profile',
      header: () => `Bearer ${signToken('user-reset')}`,
    } as unknown as Request;

    await authMiddleware(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(passwordChangeRequiredBody);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows change-password while the flag is set', async () => {
    const select = jest.fn().mockResolvedValue({
      email: 'reset@example.com',
      firstName: 'Reset',
      lastName: 'User',
      username: 'reset',
      role: 'user',
      isAdmin: false,
      isBlocked: false,
      requiresPasswordChange: true,
    });
    mockedUser.findById.mockReturnValue({ select });

    const { status, res } = createResponse();
    const next = jest.fn() as NextFunction;
    const req = {
      method: 'POST',
      originalUrl: '/api/auth/change-password',
      header: () => `Bearer ${signToken('user-reset')}`,
    } as unknown as Request;

    await authMiddleware(req, res, next);

    expect(status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
