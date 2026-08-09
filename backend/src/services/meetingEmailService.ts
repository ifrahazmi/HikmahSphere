import nodemailer from 'nodemailer';
import type { ICommunityMeeting } from '../models/CommunityMeeting';
import type { IMeetingNotificationSettings } from '../models/MeetingNotificationSettings';

const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpSecure = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE.toLowerCase() === 'true'
  : smtpPort === 465;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: smtpPort,
  secure: smtpSecure,
  auth: process.env.SMTP_USER && process.env.SMTP_PASS
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
  tls: {
    rejectUnauthorized: false,
  },
});

const smtpFrom = process.env.SMTP_FROM || `"HikmahSphere" <${process.env.SMTP_USER || 'no-reply@hikmahsphere.com'}>`;
const baseUrl = (process.env.FRONTEND_URL || 'https://hikmahsphere.site').replace(/\/$/, '');

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const resolveLogoUrl = (logoUrl?: string): string => {
  const fallback = `${baseUrl}/logo.png`;
  if (!logoUrl) return fallback;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  return `${baseUrl}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`;
};

const buildMeetingTemplate = (
  meeting: ICommunityMeeting,
  settings: IMeetingNotificationSettings,
  ctaUrl: string,
  reminderLabel: string
): string => {
  const when = new Date(meeting.scheduledAt).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: meeting.timezone || 'UTC',
  });

  const adBlock = settings.emailTemplate.includeAdvertisement && settings.emailTemplate.advertisementText
    ? `<div style="margin-top:16px;padding:12px;border-radius:8px;background:#ecfdf5;color:#065f46;font-size:13px;">${escapeHtml(settings.emailTemplate.advertisementText)}</div>`
    : '';

  return `
  <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:20px;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="background:#0f766e;color:#ffffff;padding:20px;text-align:center;">
        <img src="${escapeHtml(resolveLogoUrl(settings.emailTemplate.logoUrl))}" alt="HikmahSphere" style="width:72px;height:72px;object-fit:cover;border-radius:50%;background:#ffffff;padding:4px;" />
        <h2 style="margin:10px 0 0 0;font-size:22px;">${escapeHtml(settings.emailTemplate.headerTitle)}</h2>
        <p style="margin:8px 0 0 0;font-size:14px;opacity:0.92;">${escapeHtml(reminderLabel)}</p>
      </div>
      <div style="padding:20px;color:#111827;">
        <h3 style="margin:0 0 10px 0;font-size:20px;">${escapeHtml(meeting.title)}</h3>
        <p style="margin:0 0 12px 0;color:#374151;">${escapeHtml(meeting.description)}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Topic</td><td style="padding:6px 0;color:#111827;">${escapeHtml(meeting.topic)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Speaker</td><td style="padding:6px 0;color:#111827;">${escapeHtml(meeting.speakerName)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">When</td><td style="padding:6px 0;color:#111827;">${escapeHtml(when)} (${escapeHtml(meeting.timezone)})</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Duration</td><td style="padding:6px 0;color:#111827;">${escapeHtml(meeting.durationMinutes)} minutes</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Platform</td><td style="padding:6px 0;color:#111827;">${escapeHtml(meeting.platform)}</td></tr>
        </table>
        <div style="margin-top:18px;text-align:center;">
          <a href="${ctaUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">Open Meeting on HikmahSphere</a>
        </div>
        ${adBlock}
      </div>
      <div style="padding:14px 20px;background:#f3f4f6;color:#6b7280;font-size:12px;">
        ${settings.emailTemplate.footerText}
      </div>
    </div>
  </div>`;
};

export const sendMeetingEmails = async ({
  recipients,
  meeting,
  settings,
  reminderLabel,
}: {
  recipients: string[];
  meeting: ICommunityMeeting;
  settings: IMeetingNotificationSettings;
  reminderLabel: string;
}): Promise<{ sentCount: number; failed: string[] }> => {
  const uniqueRecipients = Array.from(new Set(recipients.filter(Boolean)));
  if (uniqueRecipients.length === 0) {
    return { sentCount: 0, failed: [] };
  }

  const ctaUrl = `${baseUrl}/community?tab=meetings&meetingId=${meeting._id.toString()}`;
  const html = buildMeetingTemplate(meeting, settings, ctaUrl, reminderLabel);
  const subject = `${settings.emailTemplate.subjectPrefix}: ${meeting.title}`;

  const failed: string[] = [];
  let sentCount = 0;

  for (const email of uniqueRecipients) {
    try {
      await transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject,
        html,
      });
      sentCount += 1;
    } catch (error) {
      console.error(`Meeting email failed for ${email}:`, error);
      failed.push(email);
    }
  }

  return { sentCount, failed };
};
