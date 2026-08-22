import {
  clearPendingAdhan,
  formatPrayerLabel,
  parseAdhanQueryParams,
  peekPendingAdhan,
  queueAdhanPlayback,
  stripAdhanQueryParams,
  PENDING_ADHAN_STORAGE_KEY,
} from './adhanPlayback';

describe('adhanPlayback', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('queues and peeks pending adhan playback', () => {
    const pending = queueAdhanPlayback('Fajr', 'notification');
    expect(pending.prayer).toBe('Fajr');
    expect(peekPendingAdhan()?.requestedAt).toBe(pending.requestedAt);
    expect(sessionStorage.getItem(PENDING_ADHAN_STORAGE_KEY)).toBeTruthy();
  });

  it('clears pending adhan playback', () => {
    queueAdhanPlayback('Dhuhr', 'url');
    clearPendingAdhan();
    expect(peekPendingAdhan()).toBeNull();
  });

  it('parses playAdhan query params', () => {
    expect(parseAdhanQueryParams('?playAdhan=1&prayer=Fajr')).toEqual({
      shouldPlay: true,
      prayer: 'Fajr',
    });
    expect(parseAdhanQueryParams('?tab=mosques')).toEqual({ shouldPlay: false });
  });

  it('strips adhan query params', () => {
    expect(stripAdhanQueryParams('?playAdhan=1&prayer=Asr&tab=mosques')).toBe('?tab=mosques');
    expect(stripAdhanQueryParams('?playAdhan=1')).toBe('');
  });

  it('formats prayer labels', () => {
    expect(formatPrayerLabel('fajr')).toBe('Fajr');
    expect(formatPrayerLabel()).toBe('Prayer');
  });
});
