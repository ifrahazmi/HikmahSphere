import User from '../models/User';
import { sendMail } from '../services/zohoMail';

export const ACCOUNT_RECOVERY_SUCCESS_MESSAGE =
  'We received your request. An admin will contact you shortly.';

export type AccountRecoveryInput = {
  name: string;
  email: string;
  phone: string;
  message?: string;
};

export type MatchingAccount = {
  id: string;
  username: string;
  email: string;
};

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const detailRow = (label: string, value: string, emphasize = false) => `
    <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #eef2ff; width: 38%; vertical-align: top;">
            <span style="display: block; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: #64748b; font-weight: 600;">${label}</span>
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #eef2ff; vertical-align: top;">
            <span style="font-size: ${emphasize ? '18px' : '15px'}; color: ${emphasize ? '#064e3b' : '#0f172a'}; font-weight: ${emphasize ? '700' : '500'}; line-height: 1.4;">${value}</span>
        </td>
    </tr>
`;

export const normalizeAccountRecoveryInput = (body: {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  message?: unknown;
}): AccountRecoveryInput => ({
  name: String(body.name || '').trim(),
  email: String(body.email || '').trim().toLowerCase(),
  phone: String(body.phone || '').trim(),
  ...(String(body.message || '').trim() ? { message: String(body.message).trim() } : {}),
});

export const findMatchingAccountForRecovery = async (email: string): Promise<MatchingAccount | null> => {
  const user = await User.findOne({ email }).select('_id username email');
  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
  };
};

export const buildAccountRecoveryEmail = (
  payload: AccountRecoveryInput,
  matchingAccount?: MatchingAccount | null
): string => {
  const name = escapeHtml(payload.name);
  const email = escapeHtml(payload.email);
  const phone = escapeHtml(payload.phone);
  const note = payload.message
    ? escapeHtml(payload.message).replace(/\n/g, '<br>')
    : '<span style="color:#94a3b8;">No additional note</span>';
  const emailLink = `<a href="mailto:${email}" style="color:#059669; text-decoration:none; font-weight:600;">${email}</a>`;
  const phoneLink = `<a href="tel:${phone.replace(/\s/g, '')}" style="color:#059669; text-decoration:none; font-weight:600;">${phone}</a>`;
  const matchRows = matchingAccount
    ? `${detailRow('Matched user ID', escapeHtml(matchingAccount.id), true)}${detailRow('Matched username', escapeHtml(matchingAccount.username))}`
    : detailRow('Matched account', 'No existing user found for this email');

  return `
        <div style="margin:0; padding:24px; background:#f1f5f9; font-family: Georgia, 'Times New Roman', serif;">
            <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08);">
                <div style="background: linear-gradient(135deg, #065f46 0%, #0f766e 55%, #115e59 100%); padding:28px 24px; text-align:center;">
                    <p style="margin:0 0 8px; font-family: Arial, sans-serif; font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:#a7f3d0;">HikmahSphere Account</p>
                    <h1 style="margin:0; font-size:26px; line-height:1.25; color:#ffffff; font-weight:700;">Password / email recovery</h1>
                    <p style="margin:10px 0 0; font-family: Arial, sans-serif; font-size:14px; color:#d1fae5;">A member asked an admin to reset their access</p>
                </div>
                <div style="padding:24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; border-collapse:collapse; font-family: Arial, Helvetica, sans-serif;">
                        ${detailRow('Full name', name, true)}
                        ${detailRow('Email', emailLink)}
                        ${detailRow('Contact number', phoneLink)}
                        ${matchRows}
                    </table>
                    <div style="margin-top:20px; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                        <div style="background:#f8fafc; padding:12px 16px; border-bottom:1px solid #e2e8f0; font-family: Arial, sans-serif;">
                            <span style="font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#64748b; font-weight:700;">Message / note</span>
                        </div>
                        <div style="padding:16px; font-family: Arial, Helvetica, sans-serif; font-size:15px; color:#334155; line-height:1.6;">
                            ${note}
                        </div>
                    </div>
                    <p style="margin:20px 0 0; font-family: Arial, sans-serif; font-size:13px; color:#64748b; line-height:1.5;">
                        Reset the password from the admin dashboard using a temporary password, then reply to ${emailLink}.
                    </p>
                </div>
                <div style="background:#0f172a; padding:14px 20px; text-align:center; font-family: Arial, sans-serif; font-size:12px; color:#94a3b8;">
                    Sent from HikmahSphere login recovery form · hikmahsphere.site/auth
                </div>
            </div>
        </div>
    `;
};

export const sendAccountRecoveryEmail = async (payload: AccountRecoveryInput): Promise<void> => {
  const matchingAccount = await findMatchingAccountForRecovery(payload.email);
  const mailTo = process.env.SMTP_TO || process.env.ZOHO_FROM || 'info@hikmahsphere.site';

  await sendMail({
    to: mailTo,
    subject: `[HikmahSphere Account] Recovery request from ${payload.name}`,
    html: buildAccountRecoveryEmail(payload, matchingAccount),
    replyTo: `"${payload.name}" <${payload.email}>`,
  });
};
