import { describe, expect, it, jest } from '@jest/globals';
import User from '../models/User';
import {
  ACCOUNT_RECOVERY_SUCCESS_MESSAGE,
  buildAccountRecoveryEmail,
  findMatchingAccountForRecovery,
  normalizeAccountRecoveryInput,
} from './accountRecovery';

jest.mock('../models/User', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));

jest.mock('../services/zohoMail', () => ({
  sendMail: jest.fn(),
}));

const mockedUser = User as unknown as { findOne: jest.Mock };

describe('account recovery', () => {
  it('builds an admin email with name, email, and phone', () => {
    const html = buildAccountRecoveryEmail({
      name: 'Aisha Rahman',
      email: 'aisha@example.com',
      phone: '9998887776',
      message: 'I forgot my password',
    });

    expect(html).toContain('Aisha Rahman');
    expect(html).toContain('aisha@example.com');
    expect(html).toContain('9998887776');
    expect(html).toContain('I forgot my password');
    expect(html).toContain('No existing user found for this email');
  });

  it('includes matched user details only in the admin email', () => {
    const html = buildAccountRecoveryEmail({
      name: 'Aisha Rahman',
      email: 'aisha@example.com',
      phone: '9998887776',
    }, {
      id: 'user-1',
      username: 'aisha_r',
      email: 'aisha@example.com',
    });

    expect(html).toContain('user-1');
    expect(html).toContain('aisha_r');
    expect(ACCOUNT_RECOVERY_SUCCESS_MESSAGE).not.toContain('user-1');
    expect(ACCOUNT_RECOVERY_SUCCESS_MESSAGE).not.toContain('aisha_r');
  });

  it('looks up an existing account by email without failing when none exists', async () => {
    mockedUser.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    await expect(findMatchingAccountForRecovery('missing@example.com')).resolves.toBeNull();

    mockedUser.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: { toString: () => 'abc123' },
        username: 'aisha_r',
        email: 'aisha@example.com',
      }),
    });
    await expect(findMatchingAccountForRecovery('aisha@example.com')).resolves.toEqual({
      id: 'abc123',
      username: 'aisha_r',
      email: 'aisha@example.com',
    });
  });

  it('normalizes recovery input', () => {
    expect(normalizeAccountRecoveryInput({
      name: '  Aisha  ',
      email: '  Aisha@Example.com ',
      phone: ' 999-888 ',
      message: '  help  ',
    })).toEqual({
      name: 'Aisha',
      email: 'aisha@example.com',
      phone: '999-888',
      message: 'help',
    });
  });
});
