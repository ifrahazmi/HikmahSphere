export const MUHASABA_REMINDER_TITLE = 'Muhasabah Tracker';
export const MUHASABA_REMINDER_BODY =
  "Take a moment for today's muhasabah. Log your Salah, Quran, fasting, and dhikr.";
export const MUHASABA_REMINDER_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const DEFAULT_MUHASABA_REMINDER_TIME = '21:00';

export const normalizeMuhasabaReminderTime = (value: unknown, fallback = DEFAULT_MUHASABA_REMINDER_TIME): string => {
  const raw = typeof value === 'string' ? value.trim() : '';
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)/);
  return match ? `${match[1]}:${match[2]}` : fallback;
};

export const shouldSendMuhasabaReminder = (input: {
  enabled: boolean;
  time: string;
  lastSentDate?: string | null;
  nowHHMM: string | null;
  localDateKey: string;
}): boolean => {
  if (!input.enabled) return false;
  if (!input.nowHHMM) return false;
  if (!MUHASABA_REMINDER_TIME_PATTERN.test(input.time)) return false;
  if (input.nowHHMM !== input.time) return false;
  if (input.lastSentDate === input.localDateKey) return false;
  return true;
};
