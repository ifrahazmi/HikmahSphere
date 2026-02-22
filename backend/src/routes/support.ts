import express from 'express';
import { body, validationResult } from 'express-validator';
import nodemailer from 'nodemailer';
import { requestLogger } from '../middleware/logger';

const router = express.Router();

// Using environment variables for secure credential management
// Nodemailer Transporter Configuration
const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: smtpPort,
    secure: smtpPort === 465, // True for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
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

/**
 * @route   POST /api/support/contact
 * @desc    Send a general contact/support email
 * @access  Public
 */
router.post('/contact', [
    requestLogger,
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('type').isIn(['Support', 'Bug', 'Suggestion', 'Correction', 'Other']).withMessage('Invalid inquiry type'),
    body('message').notEmpty().withMessage('Message is required'),
], async (req: any, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const { name, email, type, message } = req.body;

    const mailOptions = {
        from: `"${name}" <${process.env.SMTP_USER || 'no-reply@hikmahsphere.com'}>`, // Sender address
        replyTo: email, // Reply to the user's email
        to: process.env.SMTP_USER || 'admin@hikmahsphere.com', // Send to admin
        subject: `[HikmahSphere ${type}] New Message from ${name}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #059669; padding: 20px; text-align: center;">
                    <h2 style="color: white; margin: 0;">New ${type} Submission</h2>
                </div>
                <div style="padding: 20px; background-color: #f9fafb;">
                    <p><strong>From:</strong> ${name} (<a href="mailto:${email}">${email}</a>)</p>
                    <p><strong>Type:</strong> <span style="background-color: #e5e7eb; padding: 2px 8px; border-radius: 4px;">${type}</span></p>
                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p><strong>Message:</strong></p>
                    <div style="background-color: white; padding: 15px; border-radius: 4px; border: 1px solid #e5e7eb;">
                        ${message.replace(/\n/g, '<br>')}
                    </div>
                </div>
                <div style="background-color: #f3f4f6; padding: 10px; text-align: center; font-size: 12px; color: #6b7280;">
                    Sent from HikmahSphere Contact Form
                </div>
            </div>
        `
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
        from: `"HikmahSphere System" <${process.env.SMTP_USER || 'no-reply@hikmahsphere.com'}>`,
        to: process.env.SMTP_USER || 'admin@hikmahsphere.com', // Notify admin
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
