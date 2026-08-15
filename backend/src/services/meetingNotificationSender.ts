import mongoose from 'mongoose';
import admin from 'firebase-admin';
import User from '../models/User';
import UserNotification from '../models/UserNotification';
import MeetingNotificationSettings from '../models/MeetingNotificationSettings';
import { sendMulticastNotification } from '../config/firebaseAdmin';
import { sendMeetingEmails } from './meetingEmailService';

const FCM_CHUNK_SIZE = 500;

const createMeetingNotificationId = () => `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const truncate = (value: string, max: number): string => {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
};

const userWantsMeetingChannel = (user: any, channel: 'push' | 'email'): boolean => {
  const prefs = user?.preferences?.notifications?.meetings;
  if (prefs && prefs.enabled === false) return false;
  if (Array.isArray(prefs?.channels) && prefs.channels.length > 0) {
    return prefs.channels.includes(channel);
  }
  return true;
};

const collectTokens = (user: any): string[] => {
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

export const getGlobalMeetingNotificationSettings = async () => {
  let settings = await MeetingNotificationSettings.findOne({ key: 'global' });
  if (!settings) {
    settings = await MeetingNotificationSettings.create({ key: 'global' });
  }
  return settings;
};

export const getMeetingRecipients = async (meeting: any, audience: 'all_registered' | 'rsvped_only') => {
  if (audience === 'rsvped_only') {
    const rsvpUserIds = (meeting.attendeeIds || []).map((id: mongoose.Types.ObjectId | string) => id.toString());
    if (rsvpUserIds.length === 0) {
      return [];
    }
    return User.find({
      _id: { $in: rsvpUserIds },
      isBlocked: { $ne: true },
    }).select('_id email username fcmTokens notificationDevices preferences.notifications').lean();
  }

  return User.find({ isBlocked: { $ne: true } })
    .select('_id email username fcmTokens notificationDevices preferences.notifications')
    .lean();
};

export const sendMeetingNotifications = async ({
  meeting,
  channels,
  audience,
  trigger,
  note,
}: {
  meeting: any;
  channels: Array<'push' | 'email'>;
  audience: 'all_registered' | 'rsvped_only';
  trigger: 'manual' | 'scheduled';
  note: string;
}) => {
  const allRecipients = await getMeetingRecipients(meeting, audience);
  const globalSettings = await getGlobalMeetingNotificationSettings();
  const errors: string[] = [];
  const summary = {
    pushSent: 0,
    emailSent: 0,
    inAppSaved: 0,
    attemptedRecipients: allRecipients.length,
    reason: '' as string,
    errors,
  };

  if (!meeting.notificationConfig) {
    meeting.notificationConfig = {
      enabled: globalSettings.defaults.enabled,
      channels: globalSettings.defaults.channels,
      reminderMinutes: globalSettings.defaults.reminderMinutes,
      mode: globalSettings.defaults.mode,
      audience: globalSettings.defaults.audience,
      allowManualSendToAll: true,
      sendHistory: [],
    };
  }
  if (!Array.isArray(meeting.notificationConfig.sendHistory)) {
    meeting.notificationConfig.sendHistory = [];
  }

  const origin = (process.env.FRONTEND_URL || 'https://hikmahsphere.site').replace(/\/$/, '');
  const meetingPageUrl = `${origin}/community?tab=meetings&meetingId=${meeting._id.toString()}`;
  const notificationId = createMeetingNotificationId();
  const title = truncate(`Upcoming Meeting: ${meeting.title}`, 120);
  const body = truncate(`${meeting.topic} by ${meeting.speakerName}. ${note}`, 1000);

  if (channels.includes('push')) {
    const pushRecipients = allRecipients.filter((user: any) => userWantsMeetingChannel(user, 'push'));
    const uniqueTokens = Array.from(new Set(pushRecipients.flatMap((user: any) => collectTokens(user))));

    if (!admin.apps.length) {
      errors.push('firebase_uninitialized');
    } else if (uniqueTokens.length === 0) {
      errors.push('no_fcm_tokens');
    } else {
      try {
        let successCount = 0;
        for (let i = 0; i < uniqueTokens.length; i += FCM_CHUNK_SIZE) {
          const chunk = uniqueTokens.slice(i, i + FCM_CHUNK_SIZE);
          const result = await sendMulticastNotification(
            chunk,
            title,
            body,
            {
              type: 'meeting_reminder',
              meetingId: meeting._id.toString(),
              url: meetingPageUrl,
              notificationId,
            }
          );
          successCount += result.successCount || 0;
        }
        summary.pushSent = successCount;
      } catch (error: any) {
        errors.push(`push_failed: ${error?.message || 'unknown'}`);
        console.error('Meeting push notification failed:', error);
      }
    }

    try {
      const rows = pushRecipients.map((user: any) => ({
        userId: user._id.toString(),
        title,
        body,
        data: { type: 'meeting_reminder', meetingId: meeting._id.toString(), url: meetingPageUrl, notificationId },
        source: 'admin-broadcast' as const,
        read: false,
      }));
      if (rows.length > 0) {
        await UserNotification.insertMany(rows, { ordered: false });
        summary.inAppSaved = rows.length;
      }
    } catch (error: any) {
      errors.push(`in_app_failed: ${error?.message || 'unknown'}`);
      console.error('Meeting in-app notification insert failed:', error);
    }
  }

  if (channels.includes('email')) {
    const emails = allRecipients
      .filter((user: any) => userWantsMeetingChannel(user, 'email'))
      .map((user: any) => (typeof user.email === 'string' ? user.email.trim().toLowerCase() : ''))
      .filter(Boolean);

    if (emails.length === 0) {
      errors.push('no_email_recipients');
    } else {
      try {
        const emailResult = await sendMeetingEmails({
          recipients: emails,
          meeting,
          settings: globalSettings,
          reminderLabel: note,
        });
        summary.emailSent = emailResult.sentCount;
        if (emailResult.failed.length > 0) {
          errors.push(`smtp_failed: ${emailResult.failed.length}`);
        }
      } catch (error: any) {
        errors.push(`email_failed: ${error?.message || 'unknown'}`);
        console.error('Meeting email send failed:', error);
      }
    }
  }

  if (summary.attemptedRecipients === 0) {
    summary.reason = 'no_recipients';
  } else if (summary.pushSent === 0 && summary.emailSent === 0) {
    summary.reason = errors[0] || 'nothing_sent';
  }

  channels.forEach((channel) => {
    meeting.notificationConfig.sendHistory.push({
      sentAt: new Date(),
      channel,
      audience,
      recipientCount: summary.attemptedRecipients,
      trigger,
      note,
    });
  });

  if (meeting.notificationConfig.sendHistory.length > 100) {
    meeting.notificationConfig.sendHistory = meeting.notificationConfig.sendHistory.slice(-100);
  }

  await meeting.save();
  return summary;
};
