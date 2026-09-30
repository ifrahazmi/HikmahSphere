import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InstallAppPrompt from './InstallAppPrompt';
import { INSTALL_PROMPT_SESSION_SNOOZE_KEY, INSTALLED_APP_KEY } from '../utils/dailyPromptSnooze';

const setNavigator = (userAgent: string, platform = 'Linux armv8l', maxTouchPoints = 5) => {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  });
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: platform,
  });
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: maxTouchPoints,
  });
};

const setStandalone = (standalone: boolean) => {
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: standalone,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockImplementation(() => ({
      matches: standalone,
      media: '(display-mode: standalone)',
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

const revealPrompt = () => {
  act(() => {
    jest.advanceTimersByTime(1500);
  });
};

const renderPrompt = (path = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <InstallAppPrompt startupGateClear />
    </MemoryRouter>
  );

describe('InstallAppPrompt', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    window.deferredInstallPrompt = null;
    setStandalone(false);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('shows again on a new session after dismissal', () => {
    setNavigator(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      'iPhone'
    );

    const firstVisit = renderPrompt();
    revealPrompt();
    expect(screen.getByText('Add to iPhone Home Screen')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close install prompt'));
    expect(screen.queryByText('Install HikmahSphere')).not.toBeInTheDocument();
    expect(sessionStorage.getItem(INSTALL_PROMPT_SESSION_SNOOZE_KEY)).toBe('1');

    firstVisit.unmount();
    sessionStorage.clear();

    renderPrompt();
    revealPrompt();
    expect(screen.getByText('Add to iPhone Home Screen')).toBeInTheDocument();
  });

  it('still offers install in the browser when legacy installed flag is set', () => {
    localStorage.setItem(INSTALLED_APP_KEY, '1');
    setNavigator(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36'
    );

    renderPrompt();
    revealPrompt();
    expect(screen.getByText('Install HikmahSphere')).toBeInTheDocument();
  });

  it('uses the native Android install prompt and records acceptance', async () => {
    setNavigator(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36'
    );
    const prompt = jest.fn().mockResolvedValue(undefined);
    const installEvent = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
    Object.defineProperties(installEvent, {
      prompt: { value: prompt },
      userChoice: { value: Promise.resolve({ outcome: 'accepted', platform: 'web' }) },
      platforms: { value: ['web'] },
    });

    renderPrompt();
    act(() => {
      window.dispatchEvent(installEvent);
      jest.advanceTimersByTime(1500);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Install in one click'));
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Install HikmahSphere')).not.toBeInTheDocument();
  });

  it('never displays inside the installed standalone app', () => {
    setNavigator('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile');
    setStandalone(true);

    renderPrompt();
    revealPrompt();

    expect(screen.queryByText('Install HikmahSphere')).not.toBeInTheDocument();
  });

  it('does not show on the auth screen', () => {
    setNavigator('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile');
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <InstallAppPrompt startupGateClear />
      </MemoryRouter>
    );
    revealPrompt();
    expect(screen.queryByText('Install HikmahSphere')).not.toBeInTheDocument();
  });
});
