export const FRIDAY_PRAYER_TITLE = "Adhan: Jumu'ah";
export const FRIDAY_PRAYER_BODY =
  "It is time for the Friday Jumu'ah prayer. Recite Surah Al-Kahf today — the Prophet ﷺ said it brings a light from one Friday to the next.";

export const isFridayLocal = (date: Date = new Date()): boolean => date.getDay() === 5;

export const isFridayInTimezone = (timeZone: string, date: Date = new Date()): boolean => {
  try {
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
    }).format(date);
    return weekday === 'Fri';
  } catch {
    return isFridayLocal(date);
  }
};

export const getPrayerNotificationCopy = (
  prayer: string,
  friday = isFridayLocal()
): { title: string; body: string; toastLabel: string } => {
  if (friday && prayer === 'Dhuhr') {
    return {
      title: FRIDAY_PRAYER_TITLE,
      body: FRIDAY_PRAYER_BODY,
      toastLabel: "Jumu'ah",
    };
  }

  return {
    title: `Adhan: ${prayer}`,
    body: `It's time for ${prayer} prayer. Tap to play the Adhan.`,
    toastLabel: prayer,
  };
};
