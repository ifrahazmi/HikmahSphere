import {
  INSTALL_PROMPT_SNOOZE_KEY,
  INSTALLED_APP_KEY,
  NOTIFY_PROMPT_SNOOZE_KEY,
  dismissDailyPrompt,
  isAppInstalled,
  shouldOfferPwaInstall,
  shouldShowDailyPrompt,
} from './dailyPromptSnooze';

describe('daily prompt snooze', () => {
  beforeEach(() => {
    localStorage.clear();
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

  it('shows the prompt again on the next calendar day', () => {
    dismissDailyPrompt(INSTALL_PROMPT_SNOOZE_KEY, new Date('2026-09-16T23:00:00'));
    expect(shouldShowDailyPrompt(INSTALL_PROMPT_SNOOZE_KEY, new Date('2026-09-17T00:30:00'))).toBe(true);
  });

  it('does not offer PWA install after the app is marked installed', () => {
    expect(shouldOfferPwaInstall(new Date('2026-09-16'))).toBe(true);
    localStorage.setItem(INSTALLED_APP_KEY, '1');
    expect(isAppInstalled()).toBe(true);
    expect(shouldOfferPwaInstall(new Date('2026-09-16'))).toBe(false);
  });
});
