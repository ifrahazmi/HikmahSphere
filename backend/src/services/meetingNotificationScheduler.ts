import CommunityMeeting from '../models/CommunityMeeting';
import User from '../models/User';
import MeetingNotificationSettings from '../models/MeetingNotificationSettings';
import UserNotification from '../models/UserNotification';
import { sendMulticastNotification } from '../config/firebaseAdmin';
import { sendMeetingEmails } from './meetingEmailService';

const INTERVAL_MS = 60 * 1000;
let schedulerHandle: NodeJS.Timeout | null = null;
let isRunning = false;

const createMeetingNotificationId = () => `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const findUniqueTokens = (user: any): string[] => {
  const tokens = new Set<string>();
  if (Array.isArray(user?.fcmTokens)) {
    user.fcmTokens.forEach((token: unknown) => {
      if (typeof token === 'string' && token.trim()) tokens.add(token.trim());
    });
  }
  if (Array.isArray(user?.notificationDevices)) {
    user.notificationDevices.forEach((device: any) => {
      if (typeof device?.token === 'string' && device.token.trim()) tokens.add(device.token.trim());
    });
  }
  return Array.from(tokens);
};

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
    const horizon = new Date(now + (24 * 60 * 60 * 1000));

    const meetings = await CommunityMeeting.find({
      status: 'scheduled',
      scheduledAt: { $gte: new Date(now), $lte: horizon },
    });

    for (const meeting of meetings) {
      const config = meeting.notificationConfig || {
        enabled: settings?.defaults.enabled ?? true,
        channels: settings?.defaults.channels ?? ['push', 'email'],
        reminderMinutes: settings?.defaults.reminderMinutes ?? [1440, 60, 15],
        mode: settings?.defaults.mode ?? 'multiple',
        audience: settings?.defaults.audience ?? 'all_registered',
        allowManualSendToAll: true,
        sendHistory: [],
      };

      if (!config.enabled) continue;

      const diffMinutes = Math.floor((new Date(meeting.scheduledAt).getTime() - now) / (60 * 1000));
      const sortedReminders = [...(config.reminderMinutes || [1440, 60, 15])].sort((a, b) => b - a);
      const dueReminder = sortedReminders.find((minutes) => diffMinutes <= minutes && diffMinutes > (minutes - 1));
      if (typeof dueReminder !== 'number') continue;
      if (config.mode === 'once' && Array.isArray(config.sendHistory) && config.sendHistory.some((entry: any) => entry.trigger === 'scheduled')) continue;
      if (shouldSkipReminder(meeting, dueReminder)) continue;

      const users = config.audience === 'rsvped_only'
        ? await User.find({ _id: { $in: meeting.attendeeIds }, isBlocked: { $ne: true } }).select('_id email fcmTokens notificationDevices preferences.notifications').lean()
        : await User.find({ isBlocked: { $ne: true } }).select('_id email fcmTokens notificationDevices preferences.notifications').lean();

      const channels = Array.isArray(config.channels) ? config.channels : ['push', 'email'];
      const note = `Reminder T-${dueReminder}m`;
      const notificationId = createMeetingNotificationId();

      if (channels.includes('push')) {
        const tokens = Array.from(new Set(users.flatMap((user: any) => findUniqueTokens(user))));
        if (tokens.length > 0) {
          await sendMulticastNotification(
            tokens,
            `Upcoming Meeting: ${meeting.title}`,
            `${meeting.topic} starts in ${dueReminder} minutes`,
            {
              type: 'meeting_reminder',
              meetingId: meeting._id.toString(),
              url: `/community?tab=meetings&meetingId=${meeting._id.toString()}`,
              notificationId,
            }
          );
        }

        if (users.length > 0) {
          await UserNotification.insertMany(users.map((user: any) => ({
            userId: user._id.toString(),
            title: `Upcoming Meeting: ${meeting.title}`,
            body: `${meeting.topic} starts in ${dueReminder} minutes`,
            data: {
              type: 'meeting_reminder',
              meetingId: meeting._id.toString(),
              url: `/community?tab=meetings&meetingId=${meeting._id.toString()}`,
              notificationId,
            },
            source: 'admin-broadcast',
            read: false,
          })), { ordered: false });
        }

        meeting.notificationConfig.sendHistory.push({
          sentAt: new Date(),
          channel: 'push',
          audience: config.audience,
          recipientCount: users.length,
          trigger: 'scheduled',
          note,
        });
      }

      if (channels.includes('email') && settings) {
        const emailRecipients = users
          .map((user: any) => (typeof user.email === 'string' ? user.email.trim().toLowerCase() : ''))
          .filter(Boolean);
        const emailResult = await sendMeetingEmails({
          recipients: emailRecipients,
          meeting,
          settings,
          reminderLabel: `${meeting.topic} starts in ${dueReminder} minutes`,
        });

        meeting.notificationConfig.sendHistory.push({
          sentAt: new Date(),
          channel: 'email',
          audience: config.audience,
          recipientCount: emailResult.sentCount,
          trigger: 'scheduled',
          note,
        });
      }

      if (meeting.notificationConfig.sendHistory.length > 100) {
        meeting.notificationConfig.sendHistory = meeting.notificationConfig.sendHistory.slice(-100);
      }

      await meeting.save();
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
