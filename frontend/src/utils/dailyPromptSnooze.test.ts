import {
  INSTALL_PROMPT_SESSION_SNOOZE_KEY,
  NOTIFY_PROMPT_SNOOZE_KEY,
  dismissDailyPrompt,
  dismissSessionPrompt,
  isAppInstalled,
  shouldOfferPwaInstall,
  shouldShowDailyPrompt,
  shouldShowSessionPrompt,
} from './dailyPromptSnooze';

describe('daily prompt snooze', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
  });

  it('shows a prompt until it is dismissed for today', () => {
    const today = new Date('2026-09-16T10:00:00');
    expect(shouldShowDailyPrompt(NOTIFY_PROMPT_SNOOZE_KEY, today)).toBe(true);

    dismissDailyPrompt(NOTIFY_PROMPT_SNOOZE_KEY, today);
    expect(shouldShowDailyPrompt(NOTIFY_PROMPT_SNOOZE_KEY, today)).toBe(false);
    expect(localStorage.getItem(NOTIFY_PROMPT_SNOOZE_KEY)).toBe('2026-09-16');
  });

  it('shows the install prompt again after a new browser session', () => {
    dismissSessionPrompt(INSTALL_PROMPT_SESSION_SNOOZE_KEY);
    expect(shouldShowSessionPrompt(INSTALL_PROMPT_SESSION_SNOOZE_KEY)).toBe(false);
    sessionStorage.clear();
    expect(shouldOfferPwaInstall()).toBe(true);
  });

  it('does not offer PWA install only when running standalone', () => {
    expect(shouldOfferPwaInstall()).toBe(true);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
    expect(isAppInstalled()).toBe(true);
    expect(shouldOfferPwaInstall()).toBe(false);
  });
});
