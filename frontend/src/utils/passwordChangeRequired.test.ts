import {
  handleAxiosPasswordChangeRequired,
  isAxiosPasswordChangeRequired,
  PASSWORD_CHANGE_REQUIRED_MESSAGE,
} from './passwordChangeRequired';

describe('passwordChangeRequired helpers', () => {
  it('detects PASSWORD_CHANGE_REQUIRED axios errors', () => {
    expect(isAxiosPasswordChangeRequired({
      response: {
        status: 403,
        data: { status: 'error', code: 'PASSWORD_CHANGE_REQUIRED', message: PASSWORD_CHANGE_REQUIRED_MESSAGE },
      },
    })).toBe(true);
  });

  it('ignores blocked accounts, generic 403s, and timeouts', () => {
    expect(isAxiosPasswordChangeRequired({
      response: { status: 403, data: { code: 'ACCOUNT_BLOCKED' } },
    })).toBe(false);
    expect(isAxiosPasswordChangeRequired({
      response: { status: 403, data: { message: 'Access denied' } },
    })).toBe(false);
    expect(isAxiosPasswordChangeRequired(new Error('timeout'))).toBe(false);
  });

  it('invokes the callback only for password-change required errors', () => {
    const onRequired = jest.fn();
    expect(handleAxiosPasswordChangeRequired({
      response: { status: 403, data: { message: 'Access denied' } },
    }, onRequired)).toBe(false);
    expect(onRequired).not.toHaveBeenCalled();

    expect(handleAxiosPasswordChangeRequired({
      response: {
        status: 403,
        data: { status: 'error', code: 'PASSWORD_CHANGE_REQUIRED', message: PASSWORD_CHANGE_REQUIRED_MESSAGE },
      },
    }, onRequired)).toBe(true);
    expect(onRequired).toHaveBeenCalledTimes(1);
  });
});
