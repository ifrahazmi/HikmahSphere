import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './useAuth';

jest.mock('../firebase', () => ({
  getPushDeviceId: () => 'test-device',
  getStoredPushToken: () => null,
  storePushToken: () => undefined,
}));

const b64 = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString('base64').replace(/=+$/, '');
const TOKEN = `${b64({ alg: 'HS256' })}.${b64({
  userId: 'user1',
  exp: Math.floor(Date.now() / 1000) + 3600,
})}.signature`;

const LOGIN_USER = {
  _id: 'user1',
  id: 'user1',
  email: 'user@example.com',
  firstName: 'Aisha',
  lastName: 'Rahman',
  phoneNumber: '9998887776',
  preferences: { madhab: 'hanafi' },
  profile: { avatar: 'https://example.com/avatar.png', bio: 'Login bio' },
};

const PROFILE_USER = { ...LOGIN_USER, profile: { ...LOGIN_USER.profile, bio: 'Profile bio' } };

const Harness: React.FC = () => {
  const { user, loading, login } = useAuth();
  const [loadingDuringLogin, setLoadingDuringLogin] = React.useState<string>('unknown');
  const seenLoading = React.useRef(false);

  React.useEffect(() => {
    if (loading) seenLoading.current = true;
  }, [loading]);

  return (
    <div>
      <div data-testid="name">{user?.name ?? '-'}</div>
      <div data-testid="bio">{user?.bio ?? '-'}</div>
      <div data-testid="avatar">{user?.avatar ?? '-'}</div>
      <div data-testid="phone">{user?.phoneNumber ?? '-'}</div>
      <div data-testid="loading-during-login">{loadingDuringLogin}</div>
      <button
        onClick={async () => {
          seenLoading.current = false;
          await login('user@example.com', 'password');
          setLoadingDuringLogin(String(seenLoading.current));
        }}
      >
        log in
      </button>
    </div>
  );
};

const mockApi = (loginPayload: object) => {
  (global as any).fetch = jest.fn((input: any) => {
    const url = String(input);
    if (url.includes('/auth/login')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(loginPayload) });
    }
    if (url.includes('/auth/profile')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'success', data: { user: PROFILE_USER } }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'success' }) });
  });
};

const renderHarness = async () => {
  render(
    <AuthProvider>
      <Harness />
    </AuthProvider>
  );
  await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('-'));
};

describe('useAuth login hydration', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('renders profile details from the login response without a refresh', async () => {
    mockApi({ status: 'success', token: TOKEN, user: LOGIN_USER });
    await renderHarness();

    screen.getByText('log in').click();

    await waitFor(() =>
      expect(screen.getByTestId('loading-during-login').textContent).not.toBe('unknown')
    );

    expect(screen.getByTestId('name').textContent).toBe('Aisha Rahman');
    expect(screen.getByTestId('avatar').textContent).toContain('avatar.png');
    expect(screen.getByTestId('phone').textContent).toBe('9998887776');
  });

  it('never flips the global auth loading flag during login', async () => {
    // AppContent swaps the whole router for a spinner while `loading` is true, so a
    // login-triggered toggle blanks the app until every request settles.
    mockApi({ status: 'success', token: TOKEN, user: LOGIN_USER });
    await renderHarness();

    screen.getByText('log in').click();

    await waitFor(() =>
      expect(screen.getByTestId('loading-during-login').textContent).toBe('false')
    );
  });

  it('falls back to /auth/profile when the login response omits the user', async () => {
    mockApi({ status: 'success', token: TOKEN });
    await renderHarness();

    screen.getByText('log in').click();

    await waitFor(() => expect(screen.getByTestId('bio').textContent).toBe('Profile bio'));
    expect(screen.getByTestId('phone').textContent).toBe('9998887776');
  });

  it('keeps the session when the profile cache exceeds the storage quota', async () => {
    mockApi({ status: 'success', token: TOKEN, user: LOGIN_USER });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string) => {
      if (key === 'user') {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      }
    });
    await renderHarness();

    screen.getByText('log in').click();

    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('Aisha Rahman'));
  });
});
