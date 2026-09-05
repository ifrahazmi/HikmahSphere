import {
  FRIDAY_PRAYER_BODY,
  FRIDAY_PRAYER_TITLE,
  getPrayerNotificationCopy,
  isFridayLocal,
} from './fridayPrayerNotification';

describe('friday prayer notification copy', () => {
  it('replaces Dhuhr with Jumu\'ah and Surah Al-Kahf on Friday only', () => {
    const friday = getPrayerNotificationCopy('Dhuhr', true);
    expect(friday.title).toBe(FRIDAY_PRAYER_TITLE);
    expect(friday.body).toContain('Surah Al-Kahf');
    expect(friday.body).toContain("Jumu'ah");
    expect(friday.toastLabel).toBe("Jumu'ah");
  });

  it('keeps the regular Dhuhr wording on other days', () => {
    const weekday = getPrayerNotificationCopy('Dhuhr', false);
    expect(weekday.title).toBe('Adhan: Dhuhr');
    expect(weekday.body).toContain('Dhuhr');
    expect(weekday.body).not.toContain('Al-Kahf');
  });

  it('does not change Asr or other prayers on Friday', () => {
    expect(getPrayerNotificationCopy('Asr', true).title).toBe('Adhan: Asr');
    expect(getPrayerNotificationCopy('Fajr', true).body).toContain('Fajr');
  });

  it('treats Sunday as a non-Friday local day', () => {
    expect(isFridayLocal(new Date('2026-09-06T12:00:00'))).toBe(false);
    expect(isFridayLocal(new Date('2026-09-04T12:00:00'))).toBe(true);
  });
});
