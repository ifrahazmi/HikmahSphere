jest.mock('../config/redis', () => ({
  __esModule: true,
  default: {
    on: jest.fn(),
    isOpen: false,
    connect: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
  },
}));

jest.mock('../models/PrayerTimeTuning', () => ({
  __esModule: true,
  DEFAULT_PRAYER_TIME_OFFSETS: {},
  default: {},
}));

import { getCurrentDateKeyInTimezone, getCurrentHHMMInTimezone } from '../services/prayerTimesProvider';
import {
  DEFAULT_MUHASABA_REMINDER_TIME,
  normalizeMuhasabaReminderTime,
  shouldSendMuhasabaReminder,
} from './muhasabaReminder';

describe('normalizeMuhasabaReminderTime', () => {
  it('keeps a valid HH:MM value', () => {
    expect(normalizeMuhasabaReminderTime('21:00')).toBe('21:00');
  });

  it('strips seconds from a time-picker value', () => {
    expect(normalizeMuhasabaReminderTime('21:00:00')).toBe('21:00');
  });

  it('falls back for invalid input', () => {
    expect(normalizeMuhasabaReminderTime('9pm')).toBe(DEFAULT_MUHASABA_REMINDER_TIME);
    expect(normalizeMuhasabaReminderTime('')).toBe(DEFAULT_MUHASABA_REMINDER_TIME);
  });
});

describe('shouldSendMuhasabaReminder', () => {
  it('sends when local HH:MM matches and lastSentDate is not today', () => {
    expect(
      shouldSendMuhasabaReminder({
        enabled: true,
        time: '21:00',
        lastSentDate: null,
        nowHHMM: '21:00',
        localDateKey: '2026-09-14',
      })
    ).toBe(true);
  });

  it('does not send at a different local time', () => {
    expect(
      shouldSendMuhasabaReminder({
        enabled: true,
        time: '21:00',
        lastSentDate: null,
        nowHHMM: '20:59',
        localDateKey: '2026-09-14',
      })
    ).toBe(false);
  });

  it('does not send twice the same local day', () => {
    expect(
      shouldSendMuhasabaReminder({
        enabled: true,
        time: '21:00',
        lastSentDate: '2026-09-14',
        nowHHMM: '21:00',
        localDateKey: '2026-09-14',
      })
    ).toBe(false);
  });

  it('sends again on the next local day', () => {
    expect(
      shouldSendMuhasabaReminder({
        enabled: true,
        time: '21:00',
        lastSentDate: '2026-09-14',
        nowHHMM: '21:00',
        localDateKey: '2026-09-15',
      })
    ).toBe(true);
  });

  it('does not send when reminders are disabled', () => {
    expect(
      shouldSendMuhasabaReminder({
        enabled: false,
        time: '21:00',
        lastSentDate: null,
        nowHHMM: '21:00',
        localDateKey: '2026-09-14',
      })
    ).toBe(false);
  });
});

describe('timezone date-key and HH:MM for Muhasabah reminders', () => {
  it('maps Asia/Kolkata 15:30 UTC to 21:00 on 2026-09-14', () => {
    const now = new Date('2026-09-14T15:30:00.000Z');
    expect(getCurrentHHMMInTimezone('Asia/Kolkata', now)).toBe('21:00');
    expect(getCurrentDateKeyInTimezone('Asia/Kolkata', now)).toBe('2026-09-14');
  });

  it('rolls the local date after midnight IST so the next day can send', () => {
    const now = new Date('2026-09-14T18:40:00.000Z');
    expect(getCurrentHHMMInTimezone('Asia/Kolkata', now)).toBe('00:10');
    expect(getCurrentDateKeyInTimezone('Asia/Kolkata', now)).toBe('2026-09-15');
    expect(
      shouldSendMuhasabaReminder({
        enabled: true,
        time: '00:10',
        lastSentDate: '2026-09-14',
        nowHHMM: getCurrentHHMMInTimezone('Asia/Kolkata', now),
        localDateKey: getCurrentDateKeyInTimezone('Asia/Kolkata', now),
      })
    ).toBe(true);
  });
});
