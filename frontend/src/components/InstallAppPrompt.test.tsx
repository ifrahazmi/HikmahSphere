import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import InstallAppPrompt from './InstallAppPrompt';

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

describe('InstallAppPrompt', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    window.deferredInstallPrompt = null;
    setStandalone(false);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('shows iOS instructions again on the next visit after dismissal', () => {
    setNavigator(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      'iPhone'
    );

    const firstVisit = render(<InstallAppPrompt />);
    revealPrompt();
    expect(screen.getByText('Add to iPhone Home Screen')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close install prompt'));
    expect(screen.queryByText('Install HikmahSphere App')).not.toBeInTheDocument();
    expect(localStorage.getItem('hs_app_installed')).toBeNull();

    firstVisit.unmount();
    render(<InstallAppPrompt />);
    revealPrompt();
    expect(screen.getByText('Add to iPhone Home Screen')).toBeInTheDocument();
  });

  it('stops prompting after an iOS user confirms manual installation', () => {
    setNavigator(
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      'iPad'
    );

    const firstVisit = render(<InstallAppPrompt />);
    revealPrompt();
    fireEvent.click(screen.getByText('I have installed the app'));
    expect(localStorage.getItem('hs_app_installed')).toBe('1');

    firstVisit.unmount();
    render(<InstallAppPrompt />);
    revealPrompt();
    expect(screen.queryByText('Install HikmahSphere App')).not.toBeInTheDocument();
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

    render(<InstallAppPrompt />);
    act(() => {
      window.dispatchEvent(installEvent);
      jest.advanceTimersByTime(1500);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Install in One Click'));
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('hs_app_installed')).toBe('1');
    expect(screen.queryByText('Install HikmahSphere App')).not.toBeInTheDocument();
  });

  it('never displays inside the installed standalone app', () => {
    setNavigator('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile');
    setStandalone(true);

    render(<InstallAppPrompt />);
    revealPrompt();

    expect(screen.queryByText('Install HikmahSphere App')).not.toBeInTheDocument();
    expect(localStorage.getItem('hs_app_installed')).toBeNull();
  });
});
