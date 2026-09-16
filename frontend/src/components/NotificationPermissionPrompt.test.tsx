import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationPermissionPrompt from './NotificationPermissionPrompt';
import { NOTIFY_PROMPT_SNOOZE_KEY } from '../utils/dailyPromptSnooze';

const mockUseAuth = jest.fn();

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../firebase', () => ({
  getPushSupportInfo: () => Promise.resolve({
    supported: true,
    isIOS: false,
    isStandalone: true,
    limitations: [],
  }),
  requestNotificationPermissionFromUserGesture: () =>
    globalThis.Notification.requestPermission(),
}));

const signedIn = {
  user: { id: 'user-1', name: 'Aisha', email: 'aisha@example.com' },
  loading: false,
  sessionStatus: 'ready',
  passwordChangeRequired: false,
};

const renderPrompt = (path = '/profile') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <NotificationPermissionPrompt />
    </MemoryRouter>
  );

describe('NotificationPermissionPrompt', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    mockUseAuth.mockReturnValue(signedIn);
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default', requestPermission: jest.fn().mockResolvedValue('granted') },
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('explains why notifications help, then requests permission after Enable', async () => {
    renderPrompt();
    act(() => {
      jest.advanceTimersByTime(1700);
    });

    expect(screen.getByText('Never miss Salah, Muhasabah, or Dhikr')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enable notifications' }));

    await waitFor(() => {
      expect(window.Notification.requestPermission).toHaveBeenCalled();
    });
    expect(screen.queryByText('Never miss Salah, Muhasabah, or Dhikr')).not.toBeInTheDocument();
  });

  it('does not show again the same day after Not now', () => {
    const first = renderPrompt();
    act(() => {
      jest.advanceTimersByTime(1700);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(localStorage.getItem(NOTIFY_PROMPT_SNOOZE_KEY)).toBeTruthy();
    first.unmount();

    renderPrompt();
    act(() => {
      jest.advanceTimersByTime(1700);
    });
    expect(screen.queryByText('Never miss Salah, Muhasabah, or Dhikr')).not.toBeInTheDocument();
  });

  it('does not show on the auth screen', () => {
    renderPrompt('/auth');
    act(() => {
      jest.advanceTimersByTime(1700);
    });
    expect(screen.queryByText('Never miss Salah, Muhasabah, or Dhikr')).not.toBeInTheDocument();
  });
});
