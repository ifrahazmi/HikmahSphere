import { getPrayerNotificationCopy, isFridayInTimezone } from './fridayPrayerNotification';

describe('friday prayer notification copy', () => {
  it('uses Jumu\'ah and Surah Al-Kahf at Dhuhr on Friday', () => {
    const copy = getPrayerNotificationCopy('Dhuhr', true);
    expect(copy.title).toBe("Adhan: Jumu'ah");
    expect(copy.body).toContain('Surah Al-Kahf');
  });

  it('keeps Dhuhr wording when it is not Friday', () => {
    const copy = getPrayerNotificationCopy('Dhuhr', false);
    expect(copy.title).toBe('Adhan: Dhuhr');
    expect(copy.body).not.toContain('Al-Kahf');
  });

  it('detects Friday in a known timezone', () => {
    const fridayUtc = new Date('2026-09-04T12:00:00.000Z');
    expect(isFridayInTimezone('Asia/Kolkata', fridayUtc)).toBe(true);
    expect(isFridayInTimezone('Asia/Kolkata', new Date('2026-09-05T12:00:00.000Z'))).toBe(false);
  });
});
