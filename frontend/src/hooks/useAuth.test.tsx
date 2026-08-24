import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  const { user, loading, login, logout, sessionStatus } = useAuth();
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
      <div data-testid="auth-loading">{String(loading)}</div>
      <div data-testid="session-status">{sessionStatus}</div>
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
      <button onClick={logout}>log out</button>
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
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
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

  it('renders a cached valid session immediately while profile refresh is pending', async () => {
    localStorage.setItem('token', TOKEN);
    localStorage.setItem('user', JSON.stringify(LOGIN_USER));
    let resolveProfile!: (value: any) => void;
    (global as any).fetch = jest.fn(() => new Promise((resolve) => {
      resolveProfile = resolve;
    }));

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('Aisha Rahman'));
    expect(screen.getByTestId('auth-loading').textContent).toBe('false');
    expect(screen.getByTestId('session-status').textContent).toBe('reconnecting');

    resolveProfile({
      ok: true,
      json: () => Promise.resolve({ status: 'success', data: { user: PROFILE_USER } }),
    });
    await waitFor(() => expect(screen.getByTestId('session-status').textContent).toBe('ready'));
  });

  it('releases legacy startup loading after the thirty-second readiness budget', async () => {
    jest.useFakeTimers();
    localStorage.setItem('token', TOKEN);
    (global as any).fetch = jest.fn(() => new Promise(() => undefined));

    const view = render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );
    expect(screen.getByTestId('auth-loading').textContent).toBe('true');

    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(screen.getByTestId('auth-loading').textContent).toBe('false');
    expect(screen.getByTestId('session-status').textContent).toBe('reconnecting');
    view.unmount();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('retains a valid cached session after a server failure', async () => {
    localStorage.setItem('token', TOKEN);
    localStorage.setItem('user', JSON.stringify(LOGIN_USER));
    (global as any).fetch = jest.fn(() => Promise.resolve({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Server unavailable' }),
    }));

    const { unmount } = render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByTestId('name').textContent).toBe('Aisha Rahman');
    expect(localStorage.getItem('token')).toBe(TOKEN);
    expect(screen.getByTestId('session-status').textContent).toBe('reconnecting');
    unmount();
  });

  it('retains a valid cached session after a timeout-like network failure', async () => {
    localStorage.setItem('token', TOKEN);
    localStorage.setItem('user', JSON.stringify(LOGIN_USER));
    (global as any).fetch = jest.fn(() =>
      Promise.reject(new Error('Request timed out. Please try again.'))
    );

    const { unmount } = render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(localStorage.getItem('token')).toBe(TOKEN);
    expect(screen.getByTestId('name').textContent).toBe('Aisha Rahman');
    unmount();
  });

  it('recovers a cached offline session when the browser comes online', async () => {
    localStorage.setItem('token', TOKEN);
    localStorage.setItem('user', JSON.stringify(LOGIN_USER));
    let online = false;
    jest.spyOn(window.navigator, 'onLine', 'get').mockImplementation(() => online);
    (global as any).fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ status: 'success', data: { user: PROFILE_USER } }),
    }));

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('Aisha Rahman'));
    expect(screen.getByTestId('session-status').textContent).toBe('reconnecting');
    expect(global.fetch).not.toHaveBeenCalled();

    online = true;
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(screen.getByTestId('session-status').textContent).toBe('ready'));
    expect(screen.getByTestId('bio').textContent).toBe('Profile bio');
  });

  it('clears the session after a definitive 401 profile response', async () => {
    localStorage.setItem('token', TOKEN);
    localStorage.setItem('user', JSON.stringify(LOGIN_USER));
    (global as any).fetch = jest.fn(() => Promise.resolve({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Invalid token' }),
    }));

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('-'));
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('clears an already expired JWT without calling the backend', async () => {
    const expiredToken = `${b64({ alg: 'HS256' })}.${b64({
      userId: 'user1',
      exp: Math.floor(Date.now() / 1000) - 60,
    })}.signature`;
    localStorage.setItem('token', expiredToken);
    localStorage.setItem('user', JSON.stringify(LOGIN_USER));
    (global as any).fetch = jest.fn();

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('auth-loading').textContent).toBe('false'));
    expect(localStorage.getItem('token')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('removes the session on explicit logout', async () => {
    mockApi({ status: 'success', token: TOKEN, user: LOGIN_USER });
    await renderHarness();
    screen.getByText('log in').click();
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('Aisha Rahman'));

    fireEvent.click(screen.getByText('log out'));

    expect(localStorage.getItem('token')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('-'));
  });
});
