const ISO_WEEK_PATTERN = /^(\d{4})-W(\d{2})$/;

export const formatIsoWeek = (year: number, week: number): string =>
  `${year}-W${String(week).padStart(2, '0')}`;

export const parseIsoWeek = (isoWeek: string): { year: number; week: number } | null => {
  const match = ISO_WEEK_PATTERN.exec(isoWeek.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) {
    return null;
  }
  return { year, week };
};

/** ISO week for a civil calendar date (Y-M-D), timezone-independent. */
export const getIsoWeekFromCivilDate = (
  year: number,
  monthIndex: number,
  day: number
): { year: number; week: number; isoWeek: string } => {
  const date = new Date(Date.UTC(year, monthIndex, day));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: isoYear, week, isoWeek: formatIsoWeek(isoYear, week) };
};

export const getIsoWeekFromDate = (date: Date): { year: number; week: number; isoWeek: string } =>
  getIsoWeekFromCivilDate(date.getFullYear(), date.getMonth(), date.getDate());

export const getIsoWeekBounds = (
  isoWeek: string
): { year: number; week: number; isoWeek: string; weekStart: Date; weekEnd: Date } | null => {
  const parsed = parseIsoWeek(isoWeek);
  if (!parsed) return null;

  const jan4 = new Date(Date.UTC(parsed.year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const weekStart = new Date(jan4);
  weekStart.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (parsed.week - 1) * 7);
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  const check = getIsoWeekFromCivilDate(
    weekStart.getUTCFullYear(),
    weekStart.getUTCMonth(),
    weekStart.getUTCDate()
  );
  if (check.isoWeek !== formatIsoWeek(parsed.year, parsed.week)) {
    return null;
  }

  return {
    year: parsed.year,
    week: parsed.week,
    isoWeek: formatIsoWeek(parsed.year, parsed.week),
    weekStart,
    weekEnd,
  };
};

export const addIsoWeeks = (isoWeek: string, delta: number): string | null => {
  const bounds = getIsoWeekBounds(isoWeek);
  if (!bounds) return null;
  const shifted = new Date(bounds.weekStart);
  shifted.setUTCDate(shifted.getUTCDate() + delta * 7);
  return getIsoWeekFromCivilDate(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  ).isoWeek;
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatIsoWeekLabel = (isoWeek: string): string => {
  const bounds = getIsoWeekBounds(isoWeek);
  if (!bounds) return isoWeek;

  const startDay = bounds.weekStart.getUTCDate();
  const endDay = bounds.weekEnd.getUTCDate();
  const startMonth = MONTHS_SHORT[bounds.weekStart.getUTCMonth()];
  const endMonth = MONTHS_SHORT[bounds.weekEnd.getUTCMonth()];
  const startYear = bounds.weekStart.getUTCFullYear();
  const endYear = bounds.weekEnd.getUTCFullYear();

  if (startMonth === endMonth && startYear === endYear) {
    return `Week of ${startDay}–${endDay} ${startMonth} ${startYear}`;
  }
  if (startYear === endYear) {
    return `Week of ${startDay} ${startMonth} – ${endDay} ${endMonth} ${endYear}`;
  }
  return `Week of ${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
};
