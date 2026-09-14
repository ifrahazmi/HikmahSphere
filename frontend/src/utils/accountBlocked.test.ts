import { toast } from 'react-hot-toast';
import {
  ACCOUNT_BLOCKED_MESSAGE,
  handleAxiosAccountBlocked,
  isAxiosAccountBlocked,
  notifyAccountBlocked,
} from './accountBlocked';

jest.mock('react-hot-toast', () => ({
  toast: { error: jest.fn() },
}));

describe('accountBlocked helpers', () => {
  beforeEach(() => {
    (toast.error as jest.Mock).mockClear();
  });

  it('detects ACCOUNT_BLOCKED axios errors', () => {
    expect(isAxiosAccountBlocked({
      response: {
        status: 403,
        data: { status: 'error', code: 'ACCOUNT_BLOCKED', message: ACCOUNT_BLOCKED_MESSAGE },
      },
    })).toBe(true);
  });

  it('ignores generic 403s, 401s, and timeouts', () => {
    expect(isAxiosAccountBlocked({
      response: { status: 403, data: { status: 'error', message: 'Access denied' } },
    })).toBe(false);
    expect(isAxiosAccountBlocked({
      response: { status: 401, data: { code: 'ACCOUNT_BLOCKED' } },
    })).toBe(false);
    expect(isAxiosAccountBlocked(new Error('timeout'))).toBe(false);
  });

  it('logs out only on ACCOUNT_BLOCKED heartbeat failures', () => {
    const onBlocked = jest.fn();
    const generic403 = { response: { status: 403, data: { message: 'Access denied' } } };
    const blocked = {
      response: {
        status: 403,
        data: { status: 'error', code: 'ACCOUNT_BLOCKED', message: ACCOUNT_BLOCKED_MESSAGE },
      },
    };

    expect(handleAxiosAccountBlocked(generic403, onBlocked)).toBe(false);
    expect(onBlocked).not.toHaveBeenCalled();

    expect(handleAxiosAccountBlocked(blocked, onBlocked)).toBe(true);
    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(ACCOUNT_BLOCKED_MESSAGE, { id: 'account-blocked' });
  });

  it('shows the blocked-account toast', () => {
    notifyAccountBlocked();
    expect(toast.error).toHaveBeenCalledWith(ACCOUNT_BLOCKED_MESSAGE, { id: 'account-blocked' });
  });
});
