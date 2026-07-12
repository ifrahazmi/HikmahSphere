import express from 'express';
import { body, validationResult } from 'express-validator';
import nodemailer from 'nodemailer';
import { requestLogger } from '../middleware/logger';

const router = express.Router();

// Using environment variables for secure credential management
// Nodemailer Transporter Configuration
const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const smtpSecure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE.toLowerCase() === 'true'
    : smtpPort === 465;
const smtpFrom = process.env.SMTP_FROM || `"HikmahSphere" <${process.env.SMTP_USER || 'no-reply@hikmahsphere.com'}>`;
const smtpTo = process.env.SMTP_TO || process.env.SMTP_USER || 'admin@hikmahsphere.com';
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
        rejectUnauthorized: false // Keep this for compatibility
    }
});


// Verify transporter connection
transporter.verify(function (error, success) {
    if (error) {
        console.error('SMTP Connection Warning: Could not connect to mail server.', error.message);
        console.log('⚠️  Email features might not work unless configured correctly in .env');
    } else {
        console.log('✅ SMTP Server is ready to take our messages');
    }
});

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
            <span style="font-size: ${emphasize ? '18px' : '15px'}; color: ${emphasize ? '#312e81' : '#0f172a'}; font-weight: ${emphasize ? '700' : '500'}; line-height: 1.4;">${value}</span>
        </td>
    </tr>
`;

const buildMaktabSponsorEmail = (payload: {
    name: string;
    email: string;
    phone?: string;
    program?: string;
    amount?: string;
    message?: string;
}) => {
    const name = escapeHtml(payload.name);
    const email = escapeHtml(payload.email);
    const phone = payload.phone ? escapeHtml(payload.phone) : '';
    const program = escapeHtml(payload.program || 'General Maktab support');
    const amount = payload.amount
        ? `₹${escapeHtml(String(payload.amount).replace(/[^\d.]/g, '') || payload.amount)}`
        : 'Not specified';
    const note = payload.message?.trim()
        ? escapeHtml(payload.message.trim()).replace(/\n/g, '<br>')
        : '<span style="color:#94a3b8;">No additional note</span>';
    const hasRealEmail = payload.email && !payload.email.includes('maktab-sponsor@');
    const contactEmailDisplay = hasRealEmail
        ? `<a href="mailto:${email}" style="color:#4f46e5; text-decoration:none;">${email}</a>`
        : '<span style="color:#94a3b8;">Not provided (phone enquiry)</span>';
    const phoneDisplay = phone
        ? `<a href="tel:${phone.replace(/\s/g, '')}" style="color:#4f46e5; text-decoration:none;">${phone}</a>`
        : '<span style="color:#94a3b8;">Not provided</span>';

    return `
        <div style="margin:0; padding:24px; background:#f1f5f9; font-family: Georgia, 'Times New Roman', serif;">
            <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08);">
                <div style="background: linear-gradient(135deg, #312e81 0%, #0f766e 100%); padding:28px 24px; text-align:center;">
                    <p style="margin:0 0 8px; font-family: Arial, sans-serif; font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:#c7d2fe;">HikmahSphere Maktab</p>
                    <h1 style="margin:0; font-size:26px; line-height:1.25; color:#ffffff; font-weight:700;">New Sponsorship Enquiry</h1>
                    <p style="margin:10px 0 0; font-family: Arial, sans-serif; font-size:14px; color:#e0e7ff;">A supporter wants to help fund free Islamic education</p>
                </div>

                <div style="padding:24px;">
                    <div style="background:linear-gradient(135deg,#eef2ff,#ecfdf5); border:1px solid #c7d2fe; border-radius:12px; padding:18px 20px; margin-bottom:20px;">
                        <p style="margin:0 0 6px; font-family: Arial, sans-serif; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#6366f1; font-weight:700;">Sponsor name</p>
                        <p style="margin:0; font-size:28px; line-height:1.2; color:#1e1b4b; font-weight:700;">${name}</p>
                    </div>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; border-collapse:collapse; font-family: Arial, Helvetica, sans-serif;">
                        ${detailRow('Full name', name, true)}
                        ${detailRow('Email', contactEmailDisplay)}
                        ${detailRow('Phone', phoneDisplay)}
                        ${detailRow('Preferred program', program)}
                        ${detailRow('Suggested amount', amount)}
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
                        Reply directly to this email to follow up with <strong style="color:#0f172a;">${name}</strong>
                        ${hasRealEmail ? ` at ${contactEmailDisplay}` : phone ? ` on ${phoneDisplay}` : ''}.
                    </p>
                </div>

                <div style="background:#0f172a; padding:14px 20px; text-align:center; font-family: Arial, sans-serif; font-size:12px; color:#94a3b8;">
                    Sent from HikmahSphere Maktab sponsorship form · hikmahsphere.site/maktab
                </div>
            </div>
        </div>
    `;
};

const TYPE_META: Record<string, { title: string; blurb: string; badge: string }> = {
    Support: {
        title: 'Support Request',
        blurb: 'Someone needs help using HikmahSphere',
        badge: '#059669',
    },
    Bug: {
        title: 'Bug Report',
        blurb: 'A user reported something that is not working',
        badge: '#dc2626',
    },
    Suggestion: {
        title: 'Feature Suggestion',
        blurb: 'A user shared an idea to improve the platform',
        badge: '#d97706',
    },
    Correction: {
        title: 'Content Correction',
        blurb: 'A user flagged a possible error in Islamic content',
        badge: '#2563eb',
    },
    Other: {
        title: 'General Enquiry',
        blurb: 'A new message from the contact form',
        badge: '#475569',
    },
};

const buildGenericContactEmail = (name: string, email: string, type: string, message: string) => {
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeType = escapeHtml(type);
    const meta = TYPE_META[type] || TYPE_META.Other;
    const emailLink = `<a href="mailto:${safeEmail}" style="color:#059669; text-decoration:none; font-weight:600;">${safeEmail}</a>`;
    const messageHtml = message?.trim()
        ? escapeHtml(message.trim()).replace(/\n/g, '<br>')
        : '<span style="color:#94a3b8;">No message provided</span>';
    const typeBadge = `
        <span style="display:inline-block; background:${meta.badge}; color:#ffffff; font-family:Arial,sans-serif; font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; padding:6px 12px; border-radius:999px;">
            ${safeType}
        </span>
    `;

    return `
        <div style="margin:0; padding:24px; background:#f1f5f9; font-family: Georgia, 'Times New Roman', serif;">
            <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08);">
                <div style="background: linear-gradient(135deg, #065f46 0%, #0f766e 55%, #115e59 100%); padding:28px 24px; text-align:center;">
                    <p style="margin:0 0 8px; font-family: Arial, sans-serif; font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:#a7f3d0;">HikmahSphere Contact</p>
                    <h1 style="margin:0; font-size:26px; line-height:1.25; color:#ffffff; font-weight:700;">${escapeHtml(meta.title)}</h1>
                    <p style="margin:10px 0 0; font-family: Arial, sans-serif; font-size:14px; color:#d1fae5;">${escapeHtml(meta.blurb)}</p>
                </div>

                <div style="padding:24px;">
                    <div style="background:linear-gradient(135deg,#ecfdf5,#f0fdfa); border:1px solid #a7f3d0; border-radius:12px; padding:18px 20px; margin-bottom:20px;">
                        <p style="margin:0 0 6px; font-family: Arial, sans-serif; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#059669; font-weight:700;">Sender name</p>
                        <p style="margin:0; font-size:28px; line-height:1.2; color:#064e3b; font-weight:700;">${safeName}</p>
                    </div>

                    <div style="margin-bottom:16px;">${typeBadge}</div>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; border-collapse:collapse; font-family: Arial, Helvetica, sans-serif;">
                        ${detailRow('Full name', safeName, true)}
                        ${detailRow('Email', emailLink)}
                        ${detailRow('Enquiry type', safeType)}
                        ${detailRow('Submitted via', 'hikmahsphere.site/contact')}
                    </table>

                    <div style="margin-top:20px; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                        <div style="background:#f8fafc; padding:12px 16px; border-bottom:1px solid #e2e8f0; font-family: Arial, sans-serif;">
                            <span style="font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#64748b; font-weight:700;">Message</span>
                        </div>
                        <div style="padding:16px; font-family: Arial, Helvetica, sans-serif; font-size:15px; color:#334155; line-height:1.6;">
                            ${messageHtml}
                        </div>
                    </div>

                    <p style="margin:20px 0 0; font-family: Arial, sans-serif; font-size:13px; color:#64748b; line-height:1.5;">
                        Reply directly to this email to respond to <strong style="color:#0f172a;">${safeName}</strong> at ${emailLink}.
                    </p>
                </div>

                <div style="background:#0f172a; padding:14px 20px; text-align:center; font-family: Arial, sans-serif; font-size:12px; color:#94a3b8;">
                    Sent from HikmahSphere Contact &amp; Support form · hikmahsphere.site/contact
                </div>
            </div>
        </div>
    `;
};

/**
 * @route   POST /api/support/contact
 * @desc    Send a general contact/support email (or Maktab sponsorship enquiry)
 * @access  Public
 */
router.post('/contact', [
    requestLogger,
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('type').isIn(['Support', 'Bug', 'Suggestion', 'Correction', 'Other', 'Maktab']).withMessage('Invalid inquiry type'),
    body('message').optional({ checkFalsy: true }).isString(),
    body('phone').optional({ checkFalsy: true }).isString(),
    body('program').optional({ checkFalsy: true }).isString(),
    body('amount').optional({ checkFalsy: true }),
], async (req: any, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const { name, email, type, message = '', phone, program, amount } = req.body;
    const isMaktab = type === 'Maktab';

    if (!isMaktab && !String(message || '').trim()) {
        return res.status(400).json({ status: 'error', message: 'Message is required' });
    }

    const subject = isMaktab
        ? `[HikmahSphere Maktab] Sponsorship enquiry from ${name}`
        : `[HikmahSphere ${type}] ${name} — new contact message`;

    const html = isMaktab
        ? buildMaktabSponsorEmail({ name, email, phone, program, amount: amount != null ? String(amount) : undefined, message })
        : buildGenericContactEmail(name, email, type, message);

    const replyToEmail = isMaktab && email.includes('maktab-sponsor@')
        ? undefined
        : `"${name}" <${email}>`;

    const mailOptions = {
        from: smtpFrom,
        ...(replyToEmail ? { replyTo: replyToEmail } : {}),
        to: smtpTo,
        subject,
        html,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ status: 'success', message: 'Message sent successfully' });
    } catch (error: any) {
        console.error('Email sending error:', error.message);
        
        // Development/Test Mode Fallback:
        // If we are in dev or the error is ECONNREFUSED (no mail server), pretend it worked
        // This is crucial for user testing without a real SMTP server
        if (process.env.NODE_ENV === 'development' || error.code === 'ECONNREFUSED' || error.code === 'ESOCKET') {
            console.log('⚠️  MOCK EMAIL SENT (SMTP Failed):');
            console.log('---------------------------------------------------');
            console.log(`To: ${mailOptions.to}`);
            console.log(`Subject: ${mailOptions.subject}`);
            console.log(`Name: ${name}`);
            console.log(`Email: ${email}`);
            if (phone) console.log(`Phone: ${phone}`);
            if (program) console.log(`Program: ${program}`);
            if (amount) console.log(`Amount: ${amount}`);
            console.log(`Message: ${message}`);
            console.log('---------------------------------------------------');
            
            // Return success to the frontend so the UI doesn't break
            return res.status(200).json({ 
                status: 'success', 
                message: 'Message received (Dev Mode: Email logged to server console)' 
            });
        }

        res.status(500).json({ status: 'error', message: 'Failed to send message via email server' });
    }
});

/**
 * @route   POST /api/support/subscribe
 * @desc    Handle newsletter subscription
 * @access  Public
 */
router.post('/subscribe', [
    requestLogger,
    body('email').isEmail().withMessage('Valid email is required'),
], async (req: any, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const { email } = req.body;

    const mailOptions = {
        from: smtpFrom,
        to: smtpTo,
        subject: `[HikmahSphere Newsletter] New Subscriber`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #059669;">New Newsletter Subscriber! 🎉</h2>
                <p>A new user has subscribed to the HikmahSphere newsletter.</p>
                <p><strong>Subscriber Email:</strong> <a href="mailto:${email}">${email}</a></p>
                <p><em>Please add them to the mailing list.</em></p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ status: 'success', message: 'Subscribed successfully' });
    } catch (error: any) {
        console.error('Subscription email error:', error.message);
        
        // Mock fallback for subscription too
        if (process.env.NODE_ENV === 'development' || error.code === 'ECONNREFUSED' || error.code === 'ESOCKET') {
             console.log(`⚠️  MOCK SUBSCRIPTION: ${email}`);
             return res.status(200).json({ 
                status: 'success', 
                message: 'Subscribed successfully (Dev Mode)' 
            });
        }

        res.status(500).json({ status: 'error', message: 'Failed to subscribe' });
    }
});

export default router;
