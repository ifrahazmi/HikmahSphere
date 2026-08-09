import CommunityMeeting from '../models/CommunityMeeting';
import MeetingNotificationSettings from '../models/MeetingNotificationSettings';
import { sendMeetingNotifications } from './meetingNotificationSender';

const INTERVAL_MS = 60 * 1000;
let schedulerHandle: NodeJS.Timeout | null = null;
let isRunning = false;

const shouldSkipReminder = (meeting: any, minutes: number): boolean => {
  const history = Array.isArray(meeting?.notificationConfig?.sendHistory) ? meeting.notificationConfig.sendHistory : [];
  return history.some((entry: any) => {
    if (entry?.trigger !== 'scheduled') return false;
    if (typeof entry?.note !== 'string') return false;
    return entry.note.includes(`T-${minutes}m`);
  });
};

const runTick = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    const settings = await MeetingNotificationSettings.findOne({ key: 'global' });
    const now = Date.now();
    const reminderMinutes = settings?.defaults.reminderMinutes?.length
      ? settings.defaults.reminderMinutes
      : [1440, 60, 15];
    const maxReminder = Math.max(...reminderMinutes, 1440);
    const horizon = new Date(now + (maxReminder + 5) * 60 * 1000);

    const meetings = await CommunityMeeting.find({
      status: 'scheduled',
      scheduledAt: { $gte: new Date(now), $lte: horizon },
    });

    for (const meeting of meetings) {
      try {
        if (!meeting.notificationConfig) {
          meeting.notificationConfig = {
            enabled: settings?.defaults.enabled ?? true,
            channels: settings?.defaults.channels ?? ['push', 'email'],
            reminderMinutes: settings?.defaults.reminderMinutes ?? [1440, 60, 15],
            mode: settings?.defaults.mode ?? 'multiple',
            audience: settings?.defaults.audience ?? 'all_registered',
            allowManualSendToAll: true,
            sendHistory: [],
          } as any;
        }
        if (!Array.isArray(meeting.notificationConfig.sendHistory)) {
          meeting.notificationConfig.sendHistory = [];
        }

        const config = meeting.notificationConfig;
        if (!config.enabled) continue;

        const diffMinutes = Math.floor((new Date(meeting.scheduledAt).getTime() - now) / (60 * 1000));
        const sortedReminders = [...(config.reminderMinutes || reminderMinutes)].sort((a, b) => b - a);
        const dueReminder = sortedReminders.find((minutes) => diffMinutes <= minutes && diffMinutes > minutes - 2);
        if (typeof dueReminder !== 'number') continue;
        if (config.mode === 'once' && config.sendHistory.some((entry: any) => entry.trigger === 'scheduled')) continue;
        if (shouldSkipReminder(meeting, dueReminder)) continue;

        const channels = (Array.isArray(config.channels) ? config.channels : ['push', 'email']) as Array<'push' | 'email'>;
        await sendMeetingNotifications({
          meeting,
          channels,
          audience: config.audience === 'rsvped_only' ? 'rsvped_only' : 'all_registered',
          trigger: 'scheduled',
          note: `Reminder T-${dueReminder}m`,
        });
      } catch (meetingError) {
        console.error(`Meeting notification scheduler failed for ${meeting._id}:`, meetingError);
      }
    }
  } catch (error) {
    console.error('Meeting notification scheduler tick failed:', error);
  } finally {
    isRunning = false;
  }
};

export const startMeetingNotificationScheduler = () => {
  if (schedulerHandle) {
    return;
  }
  schedulerHandle = setInterval(() => {
    void runTick();
  }, INTERVAL_MS);
  void runTick();
  console.log('Meeting notification scheduler started');
};

export const stopMeetingNotificationScheduler = () => {
  if (!schedulerHandle) {
    return;
  }
  clearInterval(schedulerHandle);
  schedulerHandle = null;
};
