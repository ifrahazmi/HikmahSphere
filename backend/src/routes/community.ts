import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import multer from 'multer';
import { body, query, validationResult } from 'express-validator';
import { authMiddleware, adminMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { logUserActivity } from '../middleware/activityLogger';
import { sendMulticastNotification } from '../config/firebaseAdmin';
import CommunityForum from '../models/CommunityForum';
import CommunityPost from '../models/CommunityPost';
import CommunityEvent from '../models/CommunityEvent';
import CommunityMeeting from '../models/CommunityMeeting';
import MeetingNotificationSettings from '../models/MeetingNotificationSettings';
import CommunityForumMember from '../models/CommunityForumMember';
import CommunityComment from '../models/CommunityComment';
import User from '../models/User';
import UserNotification from '../models/UserNotification';
import { sendMeetingEmails } from '../services/meetingEmailService';

const router = express.Router();

type AuthenticatedRequest = Request & {
  user?: {
    userId?: string;
    username?: string;
    role?: string;
    isAdmin?: boolean;
  };
};

const EVENT_TYPES = ['prayer', 'iftar', 'lecture', 'study', 'charity', 'social'] as const;
const MEETING_PLATFORMS = ['google_meet', 'zoom', 'teams', 'jitsi', 'other'] as const;
const MEETING_RECURRENCE_TYPES = ['none', 'weekly', 'biweekly'] as const;
const MEETING_STATUSES = ['scheduled', 'completed', 'canceled'] as const;
const MAX_COMMUNITY_UPLOAD_BYTES = 10 * 1024 * 1024;
const MEETING_ATTACHMENT_MIME_ALLOWLIST = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const isProduction = process.env.NODE_ENV === 'production' || fs.existsSync('/var/www/hikmah/uploads');
const communityUploadsDir = isProduction
  ? '/var/www/hikmah/uploads/community'
  : path.resolve(process.cwd(), 'src', 'uploads', 'community');

if (!fs.existsSync(communityUploadsDir)) {
  fs.mkdirSync(communityUploadsDir, { recursive: true });
}

const communityStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, communityUploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `community-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const communityUpload = multer({
  storage: communityStorage,
  limits: { fileSize: MAX_COMMUNITY_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) && /^image\//.test(mime);
    const isPdf = ext === '.pdf' && mime === 'application/pdf';
    const isDocument = ['.doc', '.docx', '.ppt', '.pptx'].includes(ext) && MEETING_ATTACHMENT_MIME_ALLOWLIST.has(mime);
    if (isImage || isPdf || isDocument) {
      cb(null, true);
      return;
    }
    cb(new Error('Only jpg, jpeg, png, webp, pdf, doc, docx, ppt, and pptx files are allowed'));
  },
});

const DEFAULT_FORUMS = [
  {
    title: 'General Islamic Discussion',
    description: 'Discuss various aspects of Islam, faith, and spirituality.',
    category: 'General',
    tags: ['islam', 'discussion', 'faith'],
    memberCount: 250,
    postCount: 0,
    createdByName: 'System',
  },
  {
    title: 'Quran Study Circle',
    description: 'Share weekly Quran reflections, tafsir notes, and study questions.',
    category: 'Education',
    tags: ['quran', 'tafseer', 'study'],
    memberCount: 150,
    postCount: 0,
    createdByName: 'System',
  },
  {
    title: 'Prayer & Worship',
    description: 'Support each other in salah consistency, adab, and worship goals.',
    category: 'Worship',
    tags: ['salah', 'ibadah', 'habits'],
    memberCount: 180,
    postCount: 0,
    createdByName: 'System',
  },
];

let seededDefaultForums = false;

const normalizeLimit = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, 1), 50);
};

const hasValidationErrors = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return false;
  }

  const formattedErrors = errors.array().map((error: any) => ({
    field: error.path || error.param || 'unknown',
    message: error.msg || 'Invalid value',
    value: error.value,
    location: error.location,
  }));

  res.status(400).json({
    status: 'error',
    message: 'Validation failed',
    errors: formattedErrors,
  });
  return true;
};

const getSingleParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value || '';
};

const logCommunityActivity = async (
  req: AuthenticatedRequest,
  action: string,
  description: string,
  metadata?: Record<string, unknown>
): Promise<void> => {
  await logUserActivity(req as any, action, 'community', description, metadata);
};

const isSafeHttpsUrl = (value?: string): boolean => {
  if (!value) {
    return true;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const sanitizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((tag) => String(tag).trim().toLowerCase().replace(/[^a-z0-9_#-]/g, ''))
    .filter(Boolean)
    .slice(0, 20);
};

const cleanText = (value: unknown): string => {
  return String(value || '').replace(/[<>]/g, '').trim();
};

const sanitizeLinkList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanText(item))
      .filter(Boolean)
      .slice(0, 10);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => cleanText(item))
      .filter(Boolean)
      .slice(0, 10);
  }

  return [];
};

const mapUploadFileToUrl = (file?: Express.Multer.File): string | undefined => {
  if (!file) {
    return undefined;
  }
  return `/uploads/community/${file.filename}`;
};

const normalizeRole = (req: AuthenticatedRequest): string => {
  if (req.user?.role) {
    return req.user.role;
  }
  if (req.user?.isAdmin) {
    return 'superadmin';
  }
  return 'user';
};

const ensureDefaultForums = async (): Promise<void> => {
  if (seededDefaultForums) {
    return;
  }

  const existingCount = await CommunityForum.countDocuments();
  if (existingCount === 0) {
    await CommunityForum.insertMany(DEFAULT_FORUMS);
  }

  seededDefaultForums = true;
};

const isAdminOrManager = (req: AuthenticatedRequest): boolean => {
  return req.user?.isAdmin === true || req.user?.role === 'superadmin' || req.user?.role === 'manager';
};

const isForumMember = async (forumId: string, userId: string): Promise<boolean> => {
  const membership = await CommunityForumMember.findOne({ forumId, userId }).lean();
  return Boolean(membership);
};

const getGlobalMeetingNotificationSettings = async () => {
  let settings = await MeetingNotificationSettings.findOne({ key: 'global' });
  if (!settings) {
    settings = await MeetingNotificationSettings.create({ key: 'global' });
  }
  return settings;
};

const getMeetingRecipients = async (meeting: any, audience: 'all_registered' | 'rsvped_only') => {
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

const sendMeetingNotifications = async ({
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
  const recipients = await getMeetingRecipients(meeting, audience);
  const globalSettings = await getGlobalMeetingNotificationSettings();
  const summary = {
    pushSent: 0,
    emailSent: 0,
    attemptedRecipients: recipients.length,
  };

  const meetingPageUrl = `${process.env.FRONTEND_URL || 'https://hikmahsphere.site'}/community?tab=meetings&meetingId=${meeting._id.toString()}`;

  if (channels.includes('push')) {
    const tokens = recipients.flatMap((user: any) => {
      const tokenSet = new Set<string>();
      if (Array.isArray(user.fcmTokens)) {
        user.fcmTokens.forEach((token: unknown) => {
          if (typeof token === 'string' && token.trim()) tokenSet.add(token.trim());
        });
      }
      if (Array.isArray(user.notificationDevices)) {
        user.notificationDevices.forEach((device: any) => {
          if (typeof device?.token === 'string' && device.token.trim()) tokenSet.add(device.token.trim());
        });
      }
      return Array.from(tokenSet);
    });

    const uniqueTokens = Array.from(new Set(tokens));
    if (uniqueTokens.length > 0) {
      const result = await sendMulticastNotification(
        uniqueTokens,
        `Upcoming Meeting: ${meeting.title}`,
        `${meeting.topic} by ${meeting.speakerName}. ${note}`,
        {
          type: 'meeting_reminder',
          meetingId: meeting._id.toString(),
          url: meetingPageUrl,
        }
      );
      summary.pushSent = result.successCount;
    }

    const userNotificationRows = recipients.map((user: any) => ({
      userId: user._id.toString(),
      title: `Upcoming Meeting: ${meeting.title}`,
      body: `${meeting.topic} by ${meeting.speakerName}. ${note}`,
      data: { type: 'meeting_reminder', meetingId: meeting._id.toString(), url: meetingPageUrl },
      source: 'admin-broadcast',
      read: false,
    }));
    if (userNotificationRows.length > 0) {
      await UserNotification.insertMany(userNotificationRows, { ordered: false });
    }
  }

  if (channels.includes('email')) {
    const emails = recipients
      .map((user: any) => (typeof user.email === 'string' ? user.email.trim().toLowerCase() : ''))
      .filter(Boolean);

    const emailResult = await sendMeetingEmails({
      recipients: emails,
      meeting,
      settings: globalSettings,
      reminderLabel: note,
    });
    summary.emailSent = emailResult.sentCount;
  }

  meeting.notificationConfig = meeting.notificationConfig || {};
  meeting.notificationConfig.sendHistory = Array.isArray(meeting.notificationConfig.sendHistory)
    ? meeting.notificationConfig.sendHistory
    : [];

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

const normalizeMeetingResponse = (meeting: any, currentUserId?: string) => {
  const attendeeIds = Array.isArray(meeting.attendeeIds) ? meeting.attendeeIds : [];
  const attendees = attendeeIds.length;
  const isJoined = Boolean(
    currentUserId
    && attendeeIds.some((attendeeId: mongoose.Types.ObjectId | string) => attendeeId.toString() === currentUserId)
  );

  return {
    id: meeting._id.toString(),
    title: meeting.title,
    description: meeting.description,
    topic: meeting.topic,
    speakerName: meeting.speakerName,
    platform: meeting.platform,
    meetingUrl: meeting.meetingUrl || null,
    meetingId: meeting.meetingId || null,
    passcode: meeting.passcode || null,
    scheduledAt: meeting.scheduledAt,
    durationMinutes: meeting.durationMinutes,
    timezone: meeting.timezone,
    recurrence: meeting.recurrence,
    status: meeting.status,
    organizer: meeting.organizer,
    attendees,
    isJoined,
    maxCapacity: meeting.maxCapacity || null,
    tags: meeting.tags || [],
    notesLinks: meeting.notesLinks || [],
    attachment: meeting.attachment || null,
    notificationConfig: meeting.notificationConfig || {
      enabled: true,
      channels: ['push', 'email'],
      reminderMinutes: [1440, 60, 15],
      mode: 'multiple',
      audience: 'all_registered',
      allowManualSendToAll: true,
      sendHistory: [],
    },
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
  };
};

/**
 * @route   GET /api/community/forums
 * @desc    Get list of community forums
 * @access  Public
 */
router.get('/forums', [
  query('category')
    .optional()
    .isString()
    .withMessage('Category must be a string'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
], optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    if (hasValidationErrors(req, res)) {
      return;
    }

    await ensureDefaultForums();

    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const limit = normalizeLimit(req.query.limit, 20);

    const filter: Record<string, unknown> = { isActive: true };
    if (category) {
      filter.category = new RegExp(`^${category}$`, 'i');
    }

    const [forums, totalForums, categories] = await Promise.all([
      CommunityForum.find(filter)
        .sort({ lastActivityAt: -1, createdAt: -1 })
        .limit(limit)
        .lean(),
      CommunityForum.countDocuments(filter),
      CommunityForum.distinct('category', { isActive: true }),
    ]);

    const normalizedForums = forums.map((forum) => ({
      id: forum._id.toString(),
      title: forum.title,
      description: forum.description,
      category: forum.category,
      members: forum.memberCount,
      posts: forum.postCount,
      lastActivity: forum.lastActivityAt,
      coverImageUrl: forum.coverImageUrl || null,
      attachmentUrl: forum.attachmentUrl || null,
      externalLink: forum.externalLink || null,
      videoUrl: forum.videoUrl || null,
      createdByName: forum.createdByName || null,
      moderators: forum.moderators || [],
      tags: forum.tags || [],
    }));

    res.json({
      status: 'success',
      data: {
        forums: normalizedForums,
        totalForums,
        categories,
      },
    });

  } catch (error) {
    console.error('Get forums error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get forums',
    });
  }
});

/**
 * @route   GET /api/community/forums/:forumId
 * @desc    Get forum detail with membership status
 * @access  Public
 */
router.get('/forums/:forumId', optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const forumId = getSingleParam(req.params.forumId);
    if (!forumId || !mongoose.Types.ObjectId.isValid(forumId)) {
      res.status(400).json({ status: 'error', message: 'Invalid forum id' });
      return;
    }

    const forum = await CommunityForum.findOne({ _id: forumId, isActive: true }).lean();
    if (!forum) {
      res.status(404).json({ status: 'error', message: 'Forum not found' });
      return;
    }

    const userId = req.user?.userId;
    const joined = Boolean(userId && await isForumMember(forumId, userId));

    res.json({
      status: 'success',
      data: {
        forum: {
          id: forum._id.toString(),
          title: forum.title,
          description: forum.description,
          category: forum.category,
          tags: forum.tags || [],
          members: forum.memberCount,
          posts: forum.postCount,
          lastActivity: forum.lastActivityAt,
          coverImageUrl: forum.coverImageUrl || null,
          attachmentUrl: forum.attachmentUrl || null,
          externalLink: forum.externalLink || null,
          videoUrl: forum.videoUrl || null,
          createdByName: forum.createdByName || null,
        },
        joined,
      },
    });
  } catch (error) {
    console.error('Get forum detail error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get forum detail' });
  }
});

/**
 * @route   POST /api/community/forums
 * @desc    Create forum (admin/manager only)
 * @access  Private (Admin)
 */
router.post(
  '/forums',
  authMiddleware,
  adminMiddleware,
  communityUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'attachment', maxCount: 1 },
  ]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const image = files?.image?.[0];
      const attachment = files?.attachment?.[0];

      const title = cleanText(req.body.title);
      const description = cleanText(req.body.description);
      const category = cleanText(req.body.category);
      const externalLink = cleanText(req.body.externalLink);
      const videoUrl = cleanText(req.body.videoUrl);
      const tags = sanitizeTags(Array.isArray(req.body.tags) ? req.body.tags : String(req.body.tags || '').split(','));

      if (!title || title.length < 3 || title.length > 120) {
        res.status(400).json({ status: 'error', message: 'Title must be between 3 and 120 characters' });
        return;
      }
      if (!description || description.length < 10 || description.length > 600) {
        res.status(400).json({ status: 'error', message: 'Description must be between 10 and 600 characters' });
        return;
      }
      if (!category || category.length > 60) {
        res.status(400).json({ status: 'error', message: 'Category is required and must be <= 60 characters' });
        return;
      }
      if (!isSafeHttpsUrl(externalLink)) {
        res.status(400).json({ status: 'error', message: 'Invalid external link URL' });
        return;
      }
      if (!isSafeHttpsUrl(videoUrl)) {
        res.status(400).json({ status: 'error', message: 'Invalid video URL' });
        return;
      }

      const userId = req.user?.userId;
      const username = req.user?.username || 'admin';
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        res.status(401).json({ status: 'error', message: 'Invalid authentication context' });
        return;
      }

      const createdForum = await CommunityForum.create({
        title,
        description,
        category,
        tags,
        coverImageUrl: mapUploadFileToUrl(image),
        attachmentUrl: mapUploadFileToUrl(attachment),
        externalLink: externalLink || undefined,
        videoUrl: videoUrl || undefined,
        createdById: userId,
        createdByName: username,
        moderators: [userId],
        memberCount: 0,
        postCount: 0,
        isActive: true,
      });

      await logCommunityActivity(req, 'community_forum_created', `Forum created: ${title}`, {
        forumId: createdForum._id.toString(),
        role: normalizeRole(req),
      });

      res.status(201).json({
        status: 'success',
        message: 'Forum created successfully',
        data: {
          forum: {
            id: createdForum._id.toString(),
            title: createdForum.title,
            description: createdForum.description,
            category: createdForum.category,
            tags: createdForum.tags,
            coverImageUrl: createdForum.coverImageUrl || null,
            attachmentUrl: createdForum.attachmentUrl || null,
            externalLink: createdForum.externalLink || null,
            videoUrl: createdForum.videoUrl || null,
            createdByName: createdForum.createdByName || null,
            members: createdForum.memberCount,
            posts: createdForum.postCount,
            lastActivity: createdForum.lastActivityAt,
          },
        },
      });
    } catch (error: any) {
      console.error('Create forum error:', error);
      res.status(500).json({
        status: 'error',
        message: error?.message || 'Failed to create forum',
      });
    }
  }
);

/**
 * @route   PUT /api/community/forums/:forumId
 * @desc    Edit forum (admin/manager only)
 * @access  Private (Admin)
 */
router.put(
  '/forums/:forumId',
  authMiddleware,
  adminMiddleware,
  communityUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'attachment', maxCount: 1 },
  ]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const forumId = getSingleParam(req.params.forumId);
      if (!forumId || !mongoose.Types.ObjectId.isValid(forumId)) {
        res.status(400).json({ status: 'error', message: 'Invalid forum id' });
        return;
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const image = files?.image?.[0];
      const attachment = files?.attachment?.[0];

      const title = cleanText(req.body.title);
      const description = cleanText(req.body.description);
      const category = cleanText(req.body.category);
      const externalLink = cleanText(req.body.externalLink);
      const videoUrl = cleanText(req.body.videoUrl);
      const tags = sanitizeTags(Array.isArray(req.body.tags) ? req.body.tags : String(req.body.tags || '').split(','));

      if (!title || title.length < 3 || title.length > 120) {
        res.status(400).json({ status: 'error', message: 'Title must be between 3 and 120 characters' });
        return;
      }
      if (!description || description.length < 10 || description.length > 600) {
        res.status(400).json({ status: 'error', message: 'Description must be between 10 and 600 characters' });
        return;
      }
      if (!category || category.length > 60) {
        res.status(400).json({ status: 'error', message: 'Category is required and must be <= 60 characters' });
        return;
      }
      if (!isSafeHttpsUrl(externalLink)) {
        res.status(400).json({ status: 'error', message: 'Invalid external link URL' });
        return;
      }
      if (!isSafeHttpsUrl(videoUrl)) {
        res.status(400).json({ status: 'error', message: 'Invalid video URL' });
        return;
      }

      const forum = await CommunityForum.findOne({ _id: forumId, isActive: true });
      if (!forum) {
        res.status(404).json({ status: 'error', message: 'Forum not found' });
        return;
      }

      forum.title = title;
      forum.description = description;
      forum.category = category;
      forum.tags = tags;
      if (externalLink) {
        forum.externalLink = externalLink;
      } else {
        forum.set('externalLink', undefined);
      }
      if (videoUrl) {
        forum.videoUrl = videoUrl;
      } else {
        forum.set('videoUrl', undefined);
      }
      if (image) {
        const imageUrl = mapUploadFileToUrl(image);
        if (imageUrl) {
          forum.coverImageUrl = imageUrl;
        }
      }
      if (attachment) {
        const attachmentUrl = mapUploadFileToUrl(attachment);
        if (attachmentUrl) {
          forum.attachmentUrl = attachmentUrl;
        }
      }
      forum.lastActivityAt = new Date();

      await forum.save();

      await logCommunityActivity(req, 'community_forum_updated', `Forum updated: ${forum.title}`, {
        forumId,
        role: normalizeRole(req),
      });

      res.json({
        status: 'success',
        message: 'Forum updated successfully',
        data: {
          forum: {
            id: forum._id.toString(),
            title: forum.title,
            description: forum.description,
            category: forum.category,
            tags: forum.tags,
            coverImageUrl: forum.coverImageUrl || null,
            attachmentUrl: forum.attachmentUrl || null,
            externalLink: forum.externalLink || null,
            videoUrl: forum.videoUrl || null,
            members: forum.memberCount,
            posts: forum.postCount,
            lastActivity: forum.lastActivityAt,
          },
        },
      });
    } catch (error: any) {
      console.error('Update forum error:', error);
      res.status(500).json({
        status: 'error',
        message: error?.message || 'Failed to update forum',
      });
    }
  }
);

/**
 * @route   DELETE /api/community/forums/:forumId
 * @desc    Delete forum and associated posts/comments/members (admin/manager only)
 * @access  Private (Admin)
 */
router.delete('/forums/:forumId', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const forumId = getSingleParam(req.params.forumId);
    if (!forumId || !mongoose.Types.ObjectId.isValid(forumId)) {
      res.status(400).json({ status: 'error', message: 'Invalid forum id' });
      return;
    }

    const forum = await CommunityForum.findById(forumId);
    if (!forum) {
      res.status(404).json({ status: 'error', message: 'Forum not found' });
      return;
    }

    const postIds = await CommunityPost.find({ forumId }).distinct('_id');

    await Promise.all([
      CommunityComment.deleteMany({ forumId }),
      CommunityPost.deleteMany({ forumId }),
      CommunityForumMember.deleteMany({ forumId }),
      CommunityForum.deleteOne({ _id: forumId }),
    ]);

    await logCommunityActivity(req, 'community_forum_deleted', `Forum deleted: ${forum.title}`, {
      forumId,
      deletedPostCount: postIds.length,
      role: normalizeRole(req),
    });

    res.json({
      status: 'success',
      message: 'Forum deleted successfully',
      data: {
        forumId,
        deletedPostCount: postIds.length,
      },
    });
  } catch (error) {
    console.error('Delete forum error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete forum' });
  }
});

/**
 * @route   POST /api/community/forums/:forumId/join
 * @desc    Join a forum (login required)
 * @access  Private
 */
router.post('/forums/:forumId/join', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const forumId = getSingleParam(req.params.forumId);
    const userId = req.user?.userId;

    if (!forumId || !mongoose.Types.ObjectId.isValid(forumId)) {
      res.status(400).json({ status: 'error', message: 'Invalid forum id' });
      return;
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({ status: 'error', message: 'Invalid authentication context' });
      return;
    }

    const forum = await CommunityForum.findOne({ _id: forumId, isActive: true });
    if (!forum) {
      res.status(404).json({ status: 'error', message: 'Forum not found' });
      return;
    }

    const existing = await CommunityForumMember.findOne({ forumId, userId });
    if (existing) {
      res.status(400).json({ status: 'error', message: 'You already joined this forum' });
      return;
    }

    await CommunityForumMember.create({ forumId, userId, joinedAt: new Date() });
    forum.memberCount += 1;
    forum.lastActivityAt = new Date();
    await forum.save();

    await logCommunityActivity(req, `community_forum_joined`, `Joined forum: ${forum.title}`, { forumId });

    res.json({
      status: 'success',
      message: 'Successfully joined the forum',
      data: {
        forumId,
        userId,
        memberCount: forum.memberCount,
      },
    });
  } catch (error) {
    console.error('Join forum error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to join forum' });
  }
});

/**
 * @route   GET /api/community/events
 * @desc    Get upcoming community events
 * @access  Public
 */
router.get('/events', [
  query('type')
    .optional()
    .isIn(EVENT_TYPES as unknown as string[])
    .withMessage('Invalid event type'),
  query('location')
    .optional()
    .isString()
    .withMessage('Location must be a string'),
  query('online')
    .optional()
    .isBoolean()
    .withMessage('Online must be boolean'),
], optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    if (hasValidationErrors(req, res)) {
      return;
    }

    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const location = typeof req.query.location === 'string' ? req.query.location.trim() : '';
    const online = typeof req.query.online === 'string' ? req.query.online === 'true' : undefined;

    const filter: Record<string, unknown> = {};
    if (type) {
      filter.type = type;
    }
    if (typeof online === 'boolean') {
      filter.isOnline = online;
    }
    if (location) {
      filter.$or = [
        { 'location.name': { $regex: location, $options: 'i' } },
        { 'location.address': { $regex: location, $options: 'i' } },
      ];
    }

    const events = await CommunityEvent.find(filter)
      .sort({ date: 1 })
      .lean();

    const normalizedEvents = events.map((event) => ({
      id: event._id.toString(),
      title: event.title,
      description: event.description,
      type: event.type,
      date: event.date,
      location: event.location,
      organizer: event.organizer,
      attendees: event.attendeeIds?.length || 0,
      maxCapacity: event.maxCapacity || null,
      isOnline: event.isOnline,
      tags: event.tags || [],
    }));

    res.json({
      status: 'success',
      data: {
        events: normalizedEvents,
        totalEvents: normalizedEvents.length,
        eventTypes: EVENT_TYPES,
      },
    });

  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get events',
    });
  }
});

/**
 * @route   POST /api/community/posts
 * @desc    Create a new community post
 * @access  Private
 */
router.post('/posts', [
  authMiddleware,
  adminMiddleware,
  communityUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'attachment', maxCount: 1 },
  ]),
  body('title')
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be 5-200 characters'),
  body('content')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Content must be 10-5000 characters'),
  body('forumId')
    .isString()
    .withMessage('Forum ID is required'),
  body('tags')
    .optional()
    .custom((value) => Array.isArray(value) || typeof value === 'string')
    .withMessage('Tags must be a comma-separated string or an array'),
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (hasValidationErrors(req, res)) {
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const image = files?.image?.[0];
    const attachment = files?.attachment?.[0];

    const title = cleanText(req.body.title);
    const content = cleanText(req.body.content);
    const forumId = cleanText(req.body.forumId);
    const externalLink = cleanText(req.body.externalLink);
    const videoUrl = cleanText(req.body.videoUrl);
    const tags = sanitizeTags(Array.isArray(req.body.tags) ? req.body.tags : String(req.body.tags || '').split(','));

    if (!isSafeHttpsUrl(externalLink)) {
      res.status(400).json({ status: 'error', message: 'Invalid external link URL' });
      return;
    }
    if (!isSafeHttpsUrl(videoUrl)) {
      res.status(400).json({ status: 'error', message: 'Invalid video URL' });
      return;
    }

    const userId = req.user?.userId;
    const username = req.user?.username || 'community_member';

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid authentication context',
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(forumId)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid forum id',
      });
      return;
    }

    const forum = await CommunityForum.findOne({ _id: forumId, isActive: true });
    if (!forum) {
      res.status(404).json({
        status: 'error',
        message: 'Forum not found',
      });
      return;
    }

    const newPost = await CommunityPost.create({
      forumId,
      authorId: userId,
      authorName: username,
      title,
      content,
      tags,
      imageUrl: mapUploadFileToUrl(image),
      attachmentUrl: mapUploadFileToUrl(attachment),
      externalLink: externalLink || undefined,
      videoUrl: videoUrl || undefined,
      likeCount: 0,
      replyCount: 0,
      viewCount: 0,
      isPinned: false,
      isLocked: false,
    });

    await CommunityForum.updateOne(
      { _id: forumId },
      {
        $inc: { postCount: 1 },
        $set: { lastActivityAt: new Date() },
      }
    );

    await logCommunityActivity(req, 'community_post_created', `Community post created: ${title}`, {
      forumId,
      postId: newPost._id.toString(),
      role: normalizeRole(req),
    });

    res.status(201).json({
      status: 'success',
      message: 'Post created successfully',
      data: {
        post: {
          id: newPost._id.toString(),
          title: newPost.title,
          content: newPost.content,
          forumId: newPost.forumId.toString(),
          author: {
            id: newPost.authorId.toString(),
            username: newPost.authorName,
          },
          tags: newPost.tags,
          imageUrl: newPost.imageUrl || null,
          attachmentUrl: newPost.attachmentUrl || null,
          externalLink: newPost.externalLink || null,
          videoUrl: newPost.videoUrl || null,
          likes: newPost.likeCount,
          replies: newPost.replyCount,
          views: newPost.viewCount,
          isPinned: newPost.isPinned,
          isLocked: newPost.isLocked,
          createdAt: newPost.createdAt,
          updatedAt: newPost.updatedAt,
        },
      },
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

/**
 * @route   PUT /api/community/posts/:postId
 * @desc    Edit a community post (admin/manager only)
 * @access  Private (Admin)
 */
router.put('/posts/:postId', [
  authMiddleware,
  adminMiddleware,
  communityUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'attachment', maxCount: 1 },
  ]),
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const postId = getSingleParam(req.params.postId);
    if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
      res.status(400).json({ status: 'error', message: 'Invalid post id' });
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const image = files?.image?.[0];
    const attachment = files?.attachment?.[0];

    const title = cleanText(req.body.title);
    const content = cleanText(req.body.content);
    const forumId = cleanText(req.body.forumId);
    const externalLink = cleanText(req.body.externalLink);
    const videoUrl = cleanText(req.body.videoUrl);
    const tags = sanitizeTags(Array.isArray(req.body.tags) ? req.body.tags : String(req.body.tags || '').split(','));

    if (!title || title.length < 5 || title.length > 200) {
      res.status(400).json({ status: 'error', message: 'Title must be 5-200 characters' });
      return;
    }
    if (!content || content.length < 10 || content.length > 5000) {
      res.status(400).json({ status: 'error', message: 'Content must be 10-5000 characters' });
      return;
    }
    if (!forumId || !mongoose.Types.ObjectId.isValid(forumId)) {
      res.status(400).json({ status: 'error', message: 'Invalid forum id' });
      return;
    }
    if (!isSafeHttpsUrl(externalLink)) {
      res.status(400).json({ status: 'error', message: 'Invalid external link URL' });
      return;
    }
    if (!isSafeHttpsUrl(videoUrl)) {
      res.status(400).json({ status: 'error', message: 'Invalid video URL' });
      return;
    }

    const post = await CommunityPost.findById(postId);
    if (!post) {
      res.status(404).json({ status: 'error', message: 'Post not found' });
      return;
    }

    const oldForumId = post.forumId.toString();
    post.title = title;
    post.content = content;
    post.forumId = new mongoose.Types.ObjectId(forumId);
    post.tags = tags;
    if (externalLink) {
      post.externalLink = externalLink;
    } else {
      post.set('externalLink', undefined);
    }
    if (videoUrl) {
      post.videoUrl = videoUrl;
    } else {
      post.set('videoUrl', undefined);
    }
    if (image) {
      const imageUrl = mapUploadFileToUrl(image);
      if (imageUrl) {
        post.imageUrl = imageUrl;
      }
    }
    if (attachment) {
      const attachmentUrl = mapUploadFileToUrl(attachment);
      if (attachmentUrl) {
        post.attachmentUrl = attachmentUrl;
      }
    }

    await post.save();

    if (oldForumId !== forumId) {
      await Promise.all([
        CommunityForum.updateOne({ _id: oldForumId }, { $inc: { postCount: -1 }, $set: { lastActivityAt: new Date() } }),
        CommunityForum.updateOne({ _id: forumId }, { $inc: { postCount: 1 }, $set: { lastActivityAt: new Date() } }),
        CommunityComment.updateMany({ postId: post._id }, { $set: { forumId: new mongoose.Types.ObjectId(forumId) } }),
      ]);
    } else {
      await CommunityForum.updateOne({ _id: forumId }, { $set: { lastActivityAt: new Date() } });
    }

    await logCommunityActivity(req, 'community_post_updated', `Post updated: ${post.title}`, {
      postId,
      forumId,
      role: normalizeRole(req),
    });

    res.json({
      status: 'success',
      message: 'Post updated successfully',
      data: {
        post: {
          id: post._id.toString(),
          title: post.title,
          content: post.content,
          forumId: post.forumId.toString(),
          tags: post.tags || [],
          imageUrl: post.imageUrl || null,
          attachmentUrl: post.attachmentUrl || null,
          externalLink: post.externalLink || null,
          videoUrl: post.videoUrl || null,
          likes: post.likeCount,
          replies: post.replyCount,
          views: post.viewCount,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update post' });
  }
});

/**
 * @route   DELETE /api/community/posts/:postId
 * @desc    Delete community post and comments (admin/manager only)
 * @access  Private (Admin)
 */
router.delete('/posts/:postId', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const postId = getSingleParam(req.params.postId);
    if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
      res.status(400).json({ status: 'error', message: 'Invalid post id' });
      return;
    }

    const post = await CommunityPost.findById(postId);
    if (!post) {
      res.status(404).json({ status: 'error', message: 'Post not found' });
      return;
    }

    const forumId = post.forumId.toString();

    await Promise.all([
      CommunityComment.deleteMany({ postId }),
      CommunityPost.deleteOne({ _id: postId }),
      CommunityForum.updateOne(
        { _id: forumId },
        {
          $inc: { postCount: -1 },
          $set: { lastActivityAt: new Date() },
        }
      ),
    ]);

    await CommunityForum.updateOne(
      { _id: forumId, postCount: { $lt: 0 } },
      { $set: { postCount: 0 } }
    );

    await logCommunityActivity(req, 'community_post_deleted', `Post deleted: ${post.title}`, {
      postId,
      forumId,
      role: normalizeRole(req),
    });

    res.json({
      status: 'success',
      message: 'Post deleted successfully',
      data: {
        postId,
        forumId,
      },
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete post' });
  }
});

/**
 * @route   GET /api/community/posts
 * @desc    Get community posts
 * @access  Public
 */
router.get('/posts', [
  query('forumId')
    .optional()
    .isString()
    .withMessage('Forum ID must be a string'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('sortBy')
    .optional()
    .isIn(['newest', 'oldest', 'popular', 'trending'])
    .withMessage('Invalid sort option'),
  query('postId')
    .optional()
    .isString()
    .withMessage('postId must be a string'),
], optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    if (hasValidationErrors(req, res)) {
      return;
    }

    const forumId = typeof req.query.forumId === 'string' ? req.query.forumId : undefined;
    const postId = typeof req.query.postId === 'string' ? req.query.postId : undefined;
    const limit = normalizeLimit(req.query.limit, 20);
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'newest';

    if (forumId && !mongoose.Types.ObjectId.isValid(forumId)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid forum id',
      });
      return;
    }
    if (postId && !mongoose.Types.ObjectId.isValid(postId)) {
      res.status(400).json({ status: 'error', message: 'Invalid post id' });
      return;
    }

    const filter: Record<string, unknown> = { moderationStatus: 'visible' };
    if (forumId) {
      filter.forumId = forumId;
    }
    if (postId) {
      filter._id = postId;
    }

    const sortOptions: Record<string, Record<string, 1 | -1>> = {
      newest: { isPinned: -1, createdAt: -1 },
      oldest: { createdAt: 1 },
      popular: { likeCount: -1, replyCount: -1, viewCount: -1, createdAt: -1 },
      trending: { createdAt: -1, likeCount: -1, replyCount: -1 },
    };

    const selectedSort = sortOptions[sortBy] || sortOptions.newest;

    const [posts, totalPosts] = await Promise.all([
      CommunityPost.find(filter)
        .sort(selectedSort)
        .limit(limit)
        .lean(),
      CommunityPost.countDocuments(filter),
    ]);

    const normalizedPosts = posts.map((post) => ({
      id: post._id.toString(),
      title: post.title,
      content: post.content,
      forumId: post.forumId.toString(),
      author: {
        id: post.authorId.toString(),
        username: post.authorName,
      },
      tags: post.tags || [],
      imageUrl: post.imageUrl || null,
      attachmentUrl: post.attachmentUrl || null,
      externalLink: post.externalLink || null,
      videoUrl: post.videoUrl || null,
      likes: post.likeCount,
      replies: post.replyCount,
      views: post.viewCount,
      isPinned: post.isPinned,
      isLocked: post.isLocked,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    }));

    res.json({
      status: 'success',
      data: {
        posts: normalizedPosts,
        totalPosts,
        sortOptions: ['newest', 'oldest', 'popular', 'trending'],
      },
    });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get posts',
    });
  }
});

/**
 * @route   GET /api/community/posts/:postId
 * @desc    Get single post detail
 * @access  Public
 */
router.get('/posts/:postId', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const postId = getSingleParam(req.params.postId);
    if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
      res.status(400).json({ status: 'error', message: 'Invalid post id' });
      return;
    }

    const post = await CommunityPost.findOne({ _id: postId, moderationStatus: 'visible' }).lean();
    if (!post) {
      res.status(404).json({ status: 'error', message: 'Post not found' });
      return;
    }

    await CommunityPost.updateOne({ _id: postId }, { $inc: { viewCount: 1 } });

    res.json({
      status: 'success',
      data: {
        post: {
          id: post._id.toString(),
          title: post.title,
          content: post.content,
          forumId: post.forumId.toString(),
          author: {
            id: post.authorId.toString(),
            username: post.authorName,
          },
          tags: post.tags || [],
          imageUrl: post.imageUrl || null,
          attachmentUrl: post.attachmentUrl || null,
          externalLink: post.externalLink || null,
          videoUrl: post.videoUrl || null,
          likes: post.likeCount,
          replies: post.replyCount,
          views: post.viewCount + 1,
          isPinned: post.isPinned,
          isLocked: post.isLocked,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Get post detail error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get post detail' });
  }
});

/**
 * @route   GET /api/community/posts/:postId/comments
 * @desc    Get comments and replies for a post
 * @access  Public
 */
router.get('/posts/:postId/comments', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
], optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    if (hasValidationErrors(req, res)) {
      return;
    }

    const postId = getSingleParam(req.params.postId);
    if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
      res.status(400).json({ status: 'error', message: 'Invalid post id' });
      return;
    }

    const limit = normalizeLimit(req.query.limit, 50);

    const comments = await CommunityComment.find({
      postId,
      moderationStatus: 'visible',
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const byParent = new Map<string, any[]>();
    const topLevel: any[] = [];

    for (const comment of comments) {
      const item = {
        id: comment._id.toString(),
        postId: comment.postId.toString(),
        forumId: comment.forumId.toString(),
        parentCommentId: comment.parentCommentId ? comment.parentCommentId.toString() : null,
        author: {
          id: comment.authorId.toString(),
          username: comment.authorName,
        },
        content: comment.content,
        replyCount: comment.replyCount,
        createdAt: comment.createdAt,
        replies: [] as any[],
      };

      if (!item.parentCommentId) {
        topLevel.push(item);
      } else {
        const key = item.parentCommentId;
        const children = byParent.get(key) || [];
        children.push(item);
        byParent.set(key, children);
      }
    }

    const attachReplies = (items: any[]) => {
      for (const item of items) {
        const children = byParent.get(item.id) || [];
        item.replies = children;
        attachReplies(children);
      }
    };
    attachReplies(topLevel);

    res.json({
      status: 'success',
      data: {
        comments: topLevel,
        totalComments: comments.length,
      },
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get comments' });
  }
});

/**
 * @route   POST /api/community/posts/:postId/comments
 * @desc    Add comment on post (login required)
 * @access  Private
 */
router.post('/posts/:postId/comments', [
  authMiddleware,
  body('content').isLength({ min: 2, max: 1500 }),
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (hasValidationErrors(req, res)) {
      return;
    }

    const postId = getSingleParam(req.params.postId);
    const content = cleanText(req.body.content);
    const userId = req.user?.userId;
    const username = req.user?.username || 'member';

    if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
      res.status(400).json({ status: 'error', message: 'Invalid post id' });
      return;
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({ status: 'error', message: 'Invalid authentication context' });
      return;
    }

    const post = await CommunityPost.findOne({ _id: postId, moderationStatus: 'visible' });
    if (!post) {
      res.status(404).json({ status: 'error', message: 'Post not found' });
      return;
    }

    const forumId = post.forumId.toString();
    if (!isAdminOrManager(req)) {
      const joined = await isForumMember(forumId, userId);
      if (!joined) {
        res.status(403).json({ status: 'error', message: 'Join this forum first to comment' });
        return;
      }
    }

    const comment = await CommunityComment.create({
      postId: post._id,
      forumId: post.forumId,
      authorId: userId,
      authorName: username,
      content,
      moderationStatus: 'visible',
      replyCount: 0,
    });

    post.replyCount += 1;
    await post.save();

    await logCommunityActivity(req, 'community_comment_created', `Comment added on post ${post.title}`, {
      postId,
      commentId: comment._id.toString(),
    });

    res.status(201).json({
      status: 'success',
      message: 'Comment posted successfully',
      data: {
        comment: {
          id: comment._id.toString(),
          postId,
          forumId: comment.forumId.toString(),
          parentCommentId: null,
          author: {
            id: comment.authorId.toString(),
            username: comment.authorName,
          },
          content: comment.content,
          replyCount: 0,
          createdAt: comment.createdAt,
          replies: [],
        },
      },
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create comment' });
  }
});

/**
 * @route   POST /api/community/comments/:commentId/replies
 * @desc    Reply to a comment (login required)
 * @access  Private
 */
router.post('/comments/:commentId/replies', [
  authMiddleware,
  body('content').isLength({ min: 2, max: 1500 }),
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (hasValidationErrors(req, res)) {
      return;
    }

    const commentId = getSingleParam(req.params.commentId);
    const content = cleanText(req.body.content);
    const userId = req.user?.userId;
    const username = req.user?.username || 'member';

    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ status: 'error', message: 'Invalid comment id' });
      return;
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({ status: 'error', message: 'Invalid authentication context' });
      return;
    }

    const parent = await CommunityComment.findOne({ _id: commentId, moderationStatus: 'visible' });
    if (!parent) {
      res.status(404).json({ status: 'error', message: 'Parent comment not found' });
      return;
    }

    const forumId = parent.forumId.toString();
    if (!isAdminOrManager(req)) {
      const joined = await isForumMember(forumId, userId);
      if (!joined) {
        res.status(403).json({ status: 'error', message: 'Join this forum first to reply' });
        return;
      }
    }

    const reply = await CommunityComment.create({
      postId: parent.postId,
      forumId: parent.forumId,
      parentCommentId: parent._id,
      authorId: userId,
      authorName: username,
      content,
      moderationStatus: 'visible',
      replyCount: 0,
    });

    parent.replyCount += 1;
    await parent.save();

    await logCommunityActivity(req, 'community_reply_created', 'Reply added to comment', {
      parentCommentId: commentId,
      replyId: reply._id.toString(),
      postId: parent.postId.toString(),
    });

    res.status(201).json({
      status: 'success',
      message: 'Reply posted successfully',
      data: {
        reply: {
          id: reply._id.toString(),
          postId: reply.postId.toString(),
          forumId: reply.forumId.toString(),
          parentCommentId: parent._id.toString(),
          author: {
            id: reply.authorId.toString(),
            username: reply.authorName,
          },
          content: reply.content,
          replyCount: 0,
          createdAt: reply.createdAt,
          replies: [],
        },
      },
    });
  } catch (error) {
    console.error('Create reply error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create reply' });
  }
});

/**
 * @route   PATCH /api/community/posts/:postId/moderation
 * @desc    Hide/show post (admin/manager only)
 * @access  Private (Admin)
 */
router.patch('/posts/:postId/moderation', [
  authMiddleware,
  adminMiddleware,
  body('status').isIn(['visible', 'hidden']),
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (hasValidationErrors(req, res)) {
      return;
    }

    const postId = getSingleParam(req.params.postId);
    const status = req.body.status as 'visible' | 'hidden';

    if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
      res.status(400).json({ status: 'error', message: 'Invalid post id' });
      return;
    }

    const post = await CommunityPost.findByIdAndUpdate(postId, { moderationStatus: status }, { new: true });
    if (!post) {
      res.status(404).json({ status: 'error', message: 'Post not found' });
      return;
    }

    await logCommunityActivity(req, 'community_post_moderated', `Post moderation set to ${status}`, {
      postId,
      status,
      role: normalizeRole(req),
    });

    res.json({
      status: 'success',
      message: `Post marked as ${status}`,
      data: { postId, status },
    });
  } catch (error) {
    console.error('Moderate post error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to moderate post' });
  }
});

/**
 * @route   PATCH /api/community/comments/:commentId/moderation
 * @desc    Hide/show comment (admin/manager only)
 * @access  Private (Admin)
 */
router.patch('/comments/:commentId/moderation', [
  authMiddleware,
  adminMiddleware,
  body('status').isIn(['visible', 'hidden']),
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (hasValidationErrors(req, res)) {
      return;
    }

    const commentId = getSingleParam(req.params.commentId);
    const status = req.body.status as 'visible' | 'hidden';

    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ status: 'error', message: 'Invalid comment id' });
      return;
    }

    const comment = await CommunityComment.findByIdAndUpdate(commentId, { moderationStatus: status }, { new: true });
    if (!comment) {
      res.status(404).json({ status: 'error', message: 'Comment not found' });
      return;
    }

    await logCommunityActivity(req, 'community_comment_moderated', `Comment moderation set to ${status}`, {
      commentId,
      status,
      role: normalizeRole(req),
    });

    res.json({
      status: 'success',
      message: `Comment marked as ${status}`,
      data: { commentId, status },
    });
  } catch (error) {
    console.error('Moderate comment error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to moderate comment' });
  }
});

/**
 * @route   DELETE /api/community/comments/:commentId
 * @desc    Delete comment/reply (admin/manager only)
 * @access  Private (Admin)
 */
router.delete('/comments/:commentId', [
  authMiddleware,
  adminMiddleware,
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const commentId = getSingleParam(req.params.commentId);
    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ status: 'error', message: 'Invalid comment id' });
      return;
    }

    const comment = await CommunityComment.findById(commentId);
    if (!comment) {
      res.status(404).json({ status: 'error', message: 'Comment not found' });
      return;
    }

    if (comment.parentCommentId) {
      await CommunityComment.updateOne(
        { _id: comment.parentCommentId, replyCount: { $gt: 0 } },
        { $inc: { replyCount: -1 } }
      );
    } else {
      await CommunityPost.updateOne(
        { _id: comment.postId, replyCount: { $gt: 0 } },
        { $inc: { replyCount: -1 } }
      );
    }

    await CommunityComment.deleteOne({ _id: commentId });

    await logCommunityActivity(req, 'community_comment_deleted', 'Comment deleted by admin', {
      commentId,
      postId: comment.postId.toString(),
      forumId: comment.forumId.toString(),
      role: normalizeRole(req),
    });

    res.json({
      status: 'success',
      message: 'Comment deleted successfully',
      data: { commentId },
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete comment' });
  }
});

/**
 * @route   POST /api/community/events
 * @desc    Create a new community event
 * @access  Private
 */
router.post('/events', [
  authMiddleware,
  adminMiddleware,
  body('title')
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be 5-200 characters'),
  body('description')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be 10-1000 characters'),
  body('type')
    .isIn(EVENT_TYPES as unknown as string[])
    .withMessage('Invalid event type'),
  body('date')
    .isISO8601()
    .withMessage('Valid date required'),
  body('location')
    .isObject()
    .withMessage('Location object required'),
  body('location.name')
    .isString()
    .isLength({ min: 2, max: 160 })
    .withMessage('Location name must be 2-160 characters'),
  body('location.address')
    .isString()
    .isLength({ min: 5, max: 280 })
    .withMessage('Location address must be 5-280 characters'),
  body('location.coordinates.lat')
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('location.coordinates.lng')
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('maxCapacity')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 100000 })
    .withMessage('Max capacity must be between 1 and 100000'),
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (hasValidationErrors(req, res)) {
      return;
    }

    const { title, description, type, date, location, maxCapacity, isOnline = false, tags } = req.body;
    const userId = req.user?.userId;
    const username = req.user?.username || 'community_member';

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid authentication context',
      });
      return;
    }

    if (!location || typeof location.name !== 'string' || typeof location.address !== 'string') {
      res.status(400).json({
        status: 'error',
        message: 'Location name and address are required',
      });
      return;
    }

    const parsedLat = location?.coordinates?.lat !== undefined && location?.coordinates?.lat !== null
      ? Number(location.coordinates.lat)
      : undefined;
    const parsedLng = location?.coordinates?.lng !== undefined && location?.coordinates?.lng !== null
      ? Number(location.coordinates.lng)
      : undefined;

    if ((parsedLat !== undefined && Number.isNaN(parsedLat)) || (parsedLng !== undefined && Number.isNaN(parsedLng))) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid location coordinates',
      });
      return;
    }

    const normalizedLocation = {
      name: String(location.name || '').trim(),
      address: String(location.address || '').trim(),
      ...(parsedLat !== undefined && parsedLng !== undefined
        ? { coordinates: { lat: parsedLat, lng: parsedLng } }
        : {}),
    };

    const parsedMaxCapacity = maxCapacity !== undefined && maxCapacity !== null && String(maxCapacity).trim().length > 0
      ? Number(maxCapacity)
      : undefined;

    const normalizedTags = sanitizeTags(Array.isArray(tags) ? tags : String(tags || '').split(','));

    const newEvent = await CommunityEvent.create({
      title: String(title || '').trim(),
      description: String(description || '').trim(),
      type,
      date,
      location: normalizedLocation,
      organizer: {
        id: userId,
        name: username,
        verified: false,
      },
      attendeeIds: [],
      maxCapacity: parsedMaxCapacity,
      isOnline,
      tags: normalizedTags.length > 0 ? normalizedTags : [type],
    });

    res.status(201).json({
      status: 'success',
      message: 'Event created successfully',
      data: {
        event: {
          id: newEvent._id.toString(),
          title: newEvent.title,
          description: newEvent.description,
          type: newEvent.type,
          date: newEvent.date,
          location: newEvent.location,
          organizer: newEvent.organizer,
          attendees: 0,
          maxCapacity: newEvent.maxCapacity || null,
          isOnline: newEvent.isOnline,
          tags: newEvent.tags,
          createdAt: newEvent.createdAt,
        },
      },
    });

  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create event',
    });
  }
});

/**
 * @route   POST /api/community/events/:eventId/join
 * @desc    Join an event
 * @access  Private
 */
router.post('/events/:eventId/join', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.userId;

    if (typeof eventId !== 'string' || !eventId.trim()) {
      res.status(400).json({
        status: 'error',
        message: 'Event id is required',
      });
      return;
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid authentication context',
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid event id',
      });
      return;
    }

    const event = await CommunityEvent.findById(eventId);
    if (!event) {
      res.status(404).json({
        status: 'error',
        message: 'Event not found',
      });
      return;
    }

    const alreadyJoined = event.attendeeIds.some((id) => id.toString() === userId);
    if (alreadyJoined) {
      res.status(400).json({
        status: 'error',
        message: 'You already joined this event',
      });
      return;
    }

    if (event.maxCapacity && event.attendeeIds.length >= event.maxCapacity) {
      res.status(400).json({
        status: 'error',
        message: 'Event is at full capacity',
      });
      return;
    }

    event.attendeeIds.push(new mongoose.Types.ObjectId(userId));
    await event.save();

    res.json({
      status: 'success',
      message: 'Successfully joined the event',
      data: {
        eventId,
        userId,
        attendeeCount: event.attendeeIds.length,
        joinedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Join event error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to join event',
    });
  }
});

/**
 * @route   GET /api/community/meetings
 * @desc    Get community meetings for authenticated users
 * @access  Private
 */
router.get('/meetings', [
  authMiddleware,
  query('status')
    .optional()
    .isIn(MEETING_STATUSES as unknown as string[])
    .withMessage('Invalid meeting status'),
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (hasValidationErrors(req, res)) {
      return;
    }

    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const filter: Record<string, unknown> = {};
    if (status) {
      filter.status = status;
    }

    const meetings = await CommunityMeeting.find(filter)
      .sort({ scheduledAt: 1, createdAt: -1 })
      .lean();

    const normalizedMeetings = meetings.map((meeting) => normalizeMeetingResponse(meeting, req.user?.userId));

    res.json({
      status: 'success',
      data: {
        meetings: normalizedMeetings,
        totalMeetings: normalizedMeetings.length,
      },
    });
  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get meetings',
    });
  }
});

/**
 * @route   POST /api/community/meetings
 * @desc    Create a community meeting
 * @access  Private (Admin/Manager)
 */
router.post('/meetings', [
  authMiddleware,
  adminMiddleware,
  communityUpload.fields([
    { name: 'attachment', maxCount: 1 },
  ]),
  body('title')
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be 5-200 characters'),
  body('description')
    .isLength({ min: 10, max: 1200 })
    .withMessage('Description must be 10-1200 characters'),
  body('topic')
    .isLength({ min: 3, max: 160 })
    .withMessage('Topic must be 3-160 characters'),
  body('speakerName')
    .isLength({ min: 2, max: 120 })
    .withMessage('Speaker name must be 2-120 characters'),
  body('platform')
    .isIn(MEETING_PLATFORMS as unknown as string[])
    .withMessage('Invalid platform'),
  body('scheduledAt')
    .isISO8601()
    .withMessage('Valid scheduledAt is required'),
  body('durationMinutes')
    .isInt({ min: 10, max: 600 })
    .withMessage('Duration must be between 10 and 600 minutes'),
  body('timezone')
    .isString()
    .isLength({ min: 2, max: 120 })
    .withMessage('Timezone must be 2-120 characters'),
  body('recurrence')
    .optional()
    .isIn(MEETING_RECURRENCE_TYPES as unknown as string[])
    .withMessage('Invalid recurrence value'),
  body('meetingUrl')
    .optional({ nullable: true })
    .isString()
    .withMessage('meetingUrl must be a string'),
  body('maxCapacity')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 100000 })
    .withMessage('maxCapacity must be between 1 and 100000'),
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (hasValidationErrors(req, res)) {
      return;
    }

    const userId = req.user?.userId;
    const username = req.user?.username || 'community_member';
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid authentication context',
      });
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const attachment = files?.attachment?.[0];

    const title = cleanText(req.body.title);
    const description = cleanText(req.body.description);
    const topic = cleanText(req.body.topic);
    const speakerName = cleanText(req.body.speakerName);
    const platform = cleanText(req.body.platform);
    const meetingUrl = cleanText(req.body.meetingUrl);
    const meetingId = cleanText(req.body.meetingId);
    const passcode = cleanText(req.body.passcode);
    const timezone = cleanText(req.body.timezone);
    const recurrence = cleanText(req.body.recurrence) || 'none';
    const scheduledAt = new Date(String(req.body.scheduledAt));
    const durationMinutes = Number(req.body.durationMinutes);
    const maxCapacity = req.body.maxCapacity !== undefined && req.body.maxCapacity !== null && String(req.body.maxCapacity).trim().length > 0
      ? Number(req.body.maxCapacity)
      : undefined;
    const tags = sanitizeTags(Array.isArray(req.body.tags) ? req.body.tags : String(req.body.tags || '').split(','));
    const notesLinks = sanitizeLinkList(req.body.notesLinks).filter((url) => isSafeHttpsUrl(url));

    if (!isSafeHttpsUrl(meetingUrl)) {
      res.status(400).json({ status: 'error', message: 'Invalid meeting URL' });
      return;
    }
    if (!meetingUrl && !meetingId) {
      res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: [{ field: 'meetingUrl', message: 'Meeting URL or meeting ID is required', value: meetingUrl }],
      });
      return;
    }
    if (Number.isNaN(scheduledAt.getTime())) {
      res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: [{ field: 'scheduledAt', message: 'Invalid meeting date/time', value: req.body.scheduledAt }],
      });
      return;
    }

    if (attachment && !MEETING_ATTACHMENT_MIME_ALLOWLIST.has(attachment.mimetype)) {
      res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: [{ field: 'attachment', message: 'Unsupported attachment type', value: attachment.mimetype }],
      });
      return;
    }

    const globalSettings = await getGlobalMeetingNotificationSettings();

    const newMeeting = await CommunityMeeting.create({
      title,
      description,
      topic,
      speakerName,
      platform,
      meetingUrl: meetingUrl || undefined,
      meetingId: meetingId || undefined,
      passcode: passcode || undefined,
      scheduledAt,
      durationMinutes,
      timezone,
      recurrence,
      status: 'scheduled',
      organizer: {
        id: userId,
        name: username,
        verified: false,
      },
      attendeeIds: [],
      maxCapacity,
      tags,
      notesLinks,
      ...(attachment
        ? {
            attachment: {
              url: mapUploadFileToUrl(attachment),
              name: attachment.originalname,
              mimeType: attachment.mimetype,
              size: attachment.size,
            },
          }
        : {}),
      notificationConfig: {
        enabled: globalSettings.defaults.enabled,
        channels: globalSettings.defaults.channels,
        reminderMinutes: globalSettings.defaults.reminderMinutes,
        mode: globalSettings.defaults.mode,
        audience: globalSettings.defaults.audience,
        allowManualSendToAll: true,
        sendHistory: [],
      },
    });

    await logCommunityActivity(req, 'community_meeting_created', `Meeting created: ${title}`, {
      meetingId: newMeeting._id.toString(),
      role: normalizeRole(req),
    });

    res.status(201).json({
      status: 'success',
      message: 'Meeting published successfully',
      data: {
        meeting: normalizeMeetingResponse(newMeeting, userId),
      },
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create meeting',
    });
  }
});

/**
 * @route   PUT /api/community/meetings/:meetingId
 * @desc    Update a community meeting
 * @access  Private (Admin/Manager)
 */
router.put('/meetings/:meetingId', [
  authMiddleware,
  adminMiddleware,
  communityUpload.fields([
    { name: 'attachment', maxCount: 1 },
  ]),
  body('title')
    .optional()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be 5-200 characters'),
  body('description')
    .optional()
    .isLength({ min: 10, max: 1200 })
    .withMessage('Description must be 10-1200 characters'),
  body('topic')
    .optional()
    .isLength({ min: 3, max: 160 })
    .withMessage('Topic must be 3-160 characters'),
  body('speakerName')
    .optional()
    .isLength({ min: 2, max: 120 })
    .withMessage('Speaker name must be 2-120 characters'),
  body('platform')
    .optional()
    .isIn(MEETING_PLATFORMS as unknown as string[])
    .withMessage('Invalid platform'),
  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Valid scheduledAt is required'),
  body('durationMinutes')
    .optional()
    .isInt({ min: 10, max: 600 })
    .withMessage('Duration must be between 10 and 600 minutes'),
  body('timezone')
    .optional()
    .isString()
    .isLength({ min: 2, max: 120 })
    .withMessage('Timezone must be 2-120 characters'),
  body('recurrence')
    .optional()
    .isIn(MEETING_RECURRENCE_TYPES as unknown as string[])
    .withMessage('Invalid recurrence value'),
  body('status')
    .optional()
    .isIn(MEETING_STATUSES as unknown as string[])
    .withMessage('Invalid status value'),
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (hasValidationErrors(req, res)) {
      return;
    }

    const meetingId = getSingleParam(req.params.meetingId);
    if (!meetingId || !mongoose.Types.ObjectId.isValid(meetingId)) {
      res.status(400).json({ status: 'error', message: 'Invalid meeting id' });
      return;
    }

    const meeting = await CommunityMeeting.findById(meetingId);
    if (!meeting) {
      res.status(404).json({ status: 'error', message: 'Meeting not found' });
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const attachment = files?.attachment?.[0];

    const title = cleanText(req.body.title);
    const description = cleanText(req.body.description);
    const topic = cleanText(req.body.topic);
    const speakerName = cleanText(req.body.speakerName);
    const platform = cleanText(req.body.platform);
    const meetingUrl = cleanText(req.body.meetingUrl);
    const editMeetingId = cleanText(req.body.meetingId);
    const passcode = cleanText(req.body.passcode);
    const timezone = cleanText(req.body.timezone);
    const recurrence = cleanText(req.body.recurrence);
    const status = cleanText(req.body.status);

    if (meetingUrl && !isSafeHttpsUrl(meetingUrl)) {
      res.status(400).json({ status: 'error', message: 'Invalid meeting URL' });
      return;
    }

    if (title) meeting.title = title;
    if (description) meeting.description = description;
    if (topic) meeting.topic = topic;
    if (speakerName) meeting.speakerName = speakerName;

    if (platform) meeting.platform = platform as (typeof MEETING_PLATFORMS)[number];

    if (Object.prototype.hasOwnProperty.call(req.body, 'meetingUrl')) {
      if (meetingUrl) {
        meeting.meetingUrl = meetingUrl;
      } else {
        meeting.set('meetingUrl', undefined);
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'meetingId')) {
      if (editMeetingId) {
        meeting.meetingId = editMeetingId;
      } else {
        meeting.set('meetingId', undefined);
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'passcode')) {
      if (passcode) {
        meeting.passcode = passcode;
      } else {
        meeting.set('passcode', undefined);
      }
    }

    if (req.body.scheduledAt) {
      meeting.scheduledAt = new Date(String(req.body.scheduledAt));
    }

    if (req.body.durationMinutes !== undefined) {
      meeting.durationMinutes = Number(req.body.durationMinutes);
    }

    if (timezone) meeting.timezone = timezone;
    if (recurrence) meeting.recurrence = recurrence as (typeof MEETING_RECURRENCE_TYPES)[number];
    if (status) meeting.status = status as (typeof MEETING_STATUSES)[number];

    if (req.body.maxCapacity !== undefined) {
      const maxCapacity = req.body.maxCapacity !== null && String(req.body.maxCapacity).trim().length > 0
        ? Number(req.body.maxCapacity)
        : undefined;
      if (maxCapacity !== undefined) {
        meeting.maxCapacity = maxCapacity;
      } else {
        meeting.set('maxCapacity', undefined);
      }
    }

    if (req.body.tags !== undefined) {
      meeting.tags = sanitizeTags(Array.isArray(req.body.tags) ? req.body.tags : String(req.body.tags || '').split(','));
    }

    if (req.body.notesLinks !== undefined) {
      meeting.notesLinks = sanitizeLinkList(req.body.notesLinks).filter((url) => isSafeHttpsUrl(url));
    }

    if (attachment) {
      if (!MEETING_ATTACHMENT_MIME_ALLOWLIST.has(attachment.mimetype)) {
        res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: [{ field: 'attachment', message: 'Unsupported attachment type', value: attachment.mimetype }],
        });
        return;
      }
      meeting.attachment = {
        url: mapUploadFileToUrl(attachment) || '',
        name: attachment.originalname,
        mimeType: attachment.mimetype,
        size: attachment.size,
      };
    }

    if (!meeting.meetingUrl && !meeting.meetingId) {
      res.status(400).json({ status: 'error', message: 'Meeting URL or meeting ID is required' });
      return;
    }

    await meeting.save();

    await logCommunityActivity(req, 'community_meeting_updated', `Meeting updated: ${meeting.title}`, {
      meetingId,
      role: normalizeRole(req),
    });

    res.json({
      status: 'success',
      message: 'Meeting updated successfully',
      data: {
        meeting: normalizeMeetingResponse(meeting, req.user?.userId),
      },
    });
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update meeting' });
  }
});

/**
 * @route   DELETE /api/community/meetings/:meetingId
 * @desc    Cancel a community meeting
 * @access  Private (Admin/Manager)
 */
router.delete('/meetings/:meetingId', [
  authMiddleware,
  adminMiddleware,
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const meetingId = getSingleParam(req.params.meetingId);
    if (!meetingId || !mongoose.Types.ObjectId.isValid(meetingId)) {
      res.status(400).json({ status: 'error', message: 'Invalid meeting id' });
      return;
    }

    const meeting = await CommunityMeeting.findById(meetingId);
    if (!meeting) {
      res.status(404).json({ status: 'error', message: 'Meeting not found' });
      return;
    }

    meeting.status = 'canceled';
    await meeting.save();

    await logCommunityActivity(req, 'community_meeting_canceled', `Meeting canceled: ${meeting.title}`, {
      meetingId,
      role: normalizeRole(req),
    });

    res.json({
      status: 'success',
      message: 'Meeting canceled successfully',
      data: {
        meeting: normalizeMeetingResponse(meeting, req.user?.userId),
      },
    });
  } catch (error) {
    console.error('Cancel meeting error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to cancel meeting' });
  }
});

/**
 * @route   DELETE /api/community/meetings/:meetingId/permanent
 * @desc    Permanently delete a canceled meeting
 * @access  Private (Admin/Manager)
 */
router.delete('/meetings/:meetingId/permanent', [
  authMiddleware,
  adminMiddleware,
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const meetingId = getSingleParam(req.params.meetingId);
    if (!meetingId || !mongoose.Types.ObjectId.isValid(meetingId)) {
      res.status(400).json({ status: 'error', message: 'Invalid meeting id' });
      return;
    }

    const meeting = await CommunityMeeting.findById(meetingId);
    if (!meeting) {
      res.status(404).json({ status: 'error', message: 'Meeting not found' });
      return;
    }

    if (meeting.status !== 'canceled') {
      res.status(400).json({
        status: 'error',
        message: 'Only canceled meetings can be permanently deleted',
      });
      return;
    }

    await CommunityMeeting.deleteOne({ _id: meetingId });

    await logCommunityActivity(req, 'community_meeting_deleted', `Meeting deleted permanently: ${meeting.title}`, {
      meetingId,
      role: normalizeRole(req),
    });

    res.json({
      status: 'success',
      message: 'Canceled meeting deleted permanently',
      data: { meetingId },
    });
  } catch (error) {
    console.error('Permanent delete meeting error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete meeting permanently' });
  }
});

/**
 * @route   GET /api/community/meeting-notification-settings
 * @desc    Get global meeting notification settings
 * @access  Private (Admin/Manager)
 */
router.get('/meeting-notification-settings', [authMiddleware, adminMiddleware], async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = await getGlobalMeetingNotificationSettings();
    res.json({
      status: 'success',
      data: {
        settings,
      },
    });
  } catch (error) {
    console.error('Get meeting notification settings error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to load meeting notification settings' });
  }
});

/**
 * @route   PUT /api/community/meeting-notification-settings
 * @desc    Update global meeting notification settings
 * @access  Private (Admin/Manager)
 */
router.put('/meeting-notification-settings', [
  authMiddleware,
  adminMiddleware,
  body('defaults.channels').optional().isArray().withMessage('defaults.channels must be an array'),
  body('defaults.reminderMinutes').optional().isArray().withMessage('defaults.reminderMinutes must be an array'),
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (hasValidationErrors(req, res)) {
      return;
    }

    const settings = await getGlobalMeetingNotificationSettings();
    const defaults = req.body?.defaults || {};
    const emailTemplate = req.body?.emailTemplate || {};

    if (typeof defaults.enabled === 'boolean') settings.defaults.enabled = defaults.enabled;
    if (Array.isArray(defaults.channels)) {
      const channels = defaults.channels.filter((item: string) => ['push', 'email'].includes(item));
      settings.defaults.channels = channels.length > 0 ? channels : settings.defaults.channels;
    }
    if (Array.isArray(defaults.reminderMinutes)) {
      const minutes = defaults.reminderMinutes
        .map((item: unknown) => Number(item))
        .filter((item: number) => Number.isFinite(item) && item > 0)
        .sort((a: number, b: number) => b - a);
      if (minutes.length > 0) settings.defaults.reminderMinutes = minutes;
    }
    if (defaults.mode === 'once' || defaults.mode === 'multiple') settings.defaults.mode = defaults.mode;
    if (defaults.audience === 'all_registered' || defaults.audience === 'rsvped_only') settings.defaults.audience = defaults.audience;

    if (typeof emailTemplate.subjectPrefix === 'string') settings.emailTemplate.subjectPrefix = cleanText(emailTemplate.subjectPrefix);
    if (typeof emailTemplate.logoUrl === 'string') settings.emailTemplate.logoUrl = cleanText(emailTemplate.logoUrl);
    if (typeof emailTemplate.headerTitle === 'string') settings.emailTemplate.headerTitle = cleanText(emailTemplate.headerTitle);
    if (typeof emailTemplate.footerText === 'string') settings.emailTemplate.footerText = cleanText(emailTemplate.footerText);
    if (typeof emailTemplate.includeAdvertisement === 'boolean') settings.emailTemplate.includeAdvertisement = emailTemplate.includeAdvertisement;
    if (typeof emailTemplate.advertisementText === 'string') settings.emailTemplate.advertisementText = cleanText(emailTemplate.advertisementText);

    await settings.save();

    res.json({
      status: 'success',
      message: 'Meeting notification settings updated',
      data: { settings },
    });
  } catch (error) {
    console.error('Update meeting notification settings error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update meeting notification settings' });
  }
});

/**
 * @route   PUT /api/community/meetings/:meetingId/notification-config
 * @desc    Update per-meeting notification config
 * @access  Private (Admin/Manager)
 */
router.put('/meetings/:meetingId/notification-config', [authMiddleware, adminMiddleware], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const meetingId = getSingleParam(req.params.meetingId);
    if (!meetingId || !mongoose.Types.ObjectId.isValid(meetingId)) {
      res.status(400).json({ status: 'error', message: 'Invalid meeting id' });
      return;
    }

    const meeting = await CommunityMeeting.findById(meetingId);
    if (!meeting) {
      res.status(404).json({ status: 'error', message: 'Meeting not found' });
      return;
    }

    const config = req.body || {};
    const nextConfig: any = {
      enabled: typeof config.enabled === 'boolean' ? config.enabled : (meeting.notificationConfig?.enabled ?? true),
      channels: Array.isArray(config.channels)
        ? config.channels.filter((channel: string) => ['push', 'email'].includes(channel))
        : (meeting.notificationConfig?.channels || ['push', 'email']),
      reminderMinutes: Array.isArray(config.reminderMinutes)
        ? config.reminderMinutes
            .map((item: unknown) => Number(item))
            .filter((item: number) => Number.isFinite(item) && item > 0)
            .sort((a: number, b: number) => b - a)
        : (meeting.notificationConfig?.reminderMinutes || [1440, 60, 15]),
      mode: config.mode === 'once' ? 'once' : (config.mode === 'multiple' ? 'multiple' : (meeting.notificationConfig?.mode || 'multiple')),
      audience: config.audience === 'rsvped_only' ? 'rsvped_only' : (config.audience === 'all_registered' ? 'all_registered' : (meeting.notificationConfig?.audience || 'all_registered')),
      allowManualSendToAll: typeof config.allowManualSendToAll === 'boolean'
        ? config.allowManualSendToAll
        : (meeting.notificationConfig?.allowManualSendToAll ?? true),
      sendHistory: meeting.notificationConfig?.sendHistory || [],
    };

    meeting.notificationConfig = nextConfig;
    await meeting.save();

    res.json({
      status: 'success',
      message: 'Meeting notification config updated',
      data: { meeting: normalizeMeetingResponse(meeting, req.user?.userId) },
    });
  } catch (error) {
    console.error('Update per-meeting notification config error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update meeting notification config' });
  }
});

/**
 * @route   POST /api/community/meetings/:meetingId/send-notification
 * @desc    Send meeting notification now (push/email)
 * @access  Private (Admin/Manager)
 */
router.post('/meetings/:meetingId/send-notification', [authMiddleware, adminMiddleware], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const meetingId = getSingleParam(req.params.meetingId);
    if (!meetingId || !mongoose.Types.ObjectId.isValid(meetingId)) {
      res.status(400).json({ status: 'error', message: 'Invalid meeting id' });
      return;
    }

    const meeting = await CommunityMeeting.findById(meetingId);
    if (!meeting) {
      res.status(404).json({ status: 'error', message: 'Meeting not found' });
      return;
    }

    const channels = Array.isArray(req.body?.channels)
      ? req.body.channels.filter((item: string) => ['push', 'email'].includes(item))
      : (meeting.notificationConfig?.channels || ['push', 'email']);

    const audience = req.body?.audience === 'rsvped_only' ? 'rsvped_only' : (req.body?.audience === 'all_registered' ? 'all_registered' : (meeting.notificationConfig?.audience || 'all_registered'));
    const note = cleanText(req.body?.note) || 'Join from HikmahSphere';

    const summary = await sendMeetingNotifications({
      meeting,
      channels,
      audience,
      trigger: 'manual',
      note,
    });

    await logCommunityActivity(req, 'community_meeting_notification_sent', `Meeting notification sent: ${meeting.title}`, {
      meetingId,
      channels,
      audience,
      role: normalizeRole(req),
      summary,
    });

    res.json({
      status: 'success',
      message: 'Meeting notifications sent',
      data: { summary, meeting: normalizeMeetingResponse(meeting, req.user?.userId) },
    });
  } catch (error) {
    console.error('Send meeting notification error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to send meeting notifications' });
  }
});

/**
 * @route   POST /api/community/meetings/:meetingId/rsvp
 * @desc    RSVP to a meeting
 * @access  Private
 */
router.post('/meetings/:meetingId/rsvp', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const meetingId = getSingleParam(req.params.meetingId);
    const userId = req.user?.userId;

    if (!meetingId || !mongoose.Types.ObjectId.isValid(meetingId)) {
      res.status(400).json({ status: 'error', message: 'Invalid meeting id' });
      return;
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({ status: 'error', message: 'Invalid authentication context' });
      return;
    }

    const meeting = await CommunityMeeting.findById(meetingId);
    if (!meeting) {
      res.status(404).json({ status: 'error', message: 'Meeting not found' });
      return;
    }

    if (meeting.status !== 'scheduled') {
      res.status(400).json({ status: 'error', message: 'Only scheduled meetings accept RSVP' });
      return;
    }

    const alreadyJoined = meeting.attendeeIds.some((id) => id.toString() === userId);
    if (alreadyJoined) {
      res.status(400).json({ status: 'error', message: 'You already RSVPed this meeting' });
      return;
    }

    if (meeting.maxCapacity && meeting.attendeeIds.length >= meeting.maxCapacity) {
      res.status(400).json({ status: 'error', message: 'Meeting is at full capacity' });
      return;
    }

    meeting.attendeeIds.push(new mongoose.Types.ObjectId(userId));
    await meeting.save();

    await logCommunityActivity(req, 'community_meeting_rsvp_joined', `RSVP joined meeting: ${meeting.title}`, {
      meetingId,
      role: normalizeRole(req),
    });

    res.json({
      status: 'success',
      message: 'RSVP confirmed',
      data: {
        meeting: normalizeMeetingResponse(meeting, userId),
      },
    });
  } catch (error) {
    console.error('RSVP meeting error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to RSVP meeting' });
  }
});

/**
 * @route   POST /api/community/meetings/:meetingId/leave
 * @desc    Leave RSVP from a meeting
 * @access  Private
 */
router.post('/meetings/:meetingId/leave', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const meetingId = getSingleParam(req.params.meetingId);
    const userId = req.user?.userId;

    if (!meetingId || !mongoose.Types.ObjectId.isValid(meetingId)) {
      res.status(400).json({ status: 'error', message: 'Invalid meeting id' });
      return;
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(401).json({ status: 'error', message: 'Invalid authentication context' });
      return;
    }

    const meeting = await CommunityMeeting.findById(meetingId);
    if (!meeting) {
      res.status(404).json({ status: 'error', message: 'Meeting not found' });
      return;
    }

    meeting.attendeeIds = meeting.attendeeIds.filter((id) => id.toString() !== userId);
    await meeting.save();

    await logCommunityActivity(req, 'community_meeting_rsvp_left', `RSVP left meeting: ${meeting.title}`, {
      meetingId,
      role: normalizeRole(req),
    });

    res.json({
      status: 'success',
      message: 'RSVP removed',
      data: {
        meeting: normalizeMeetingResponse(meeting, userId),
      },
    });
  } catch (error) {
    console.error('Leave meeting RSVP error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to leave RSVP' });
  }
});

/**
 * @route   GET /api/community/nearby
 * @desc    Get nearby mosques and Islamic centers
 * @access  Public
 */
router.get('/nearby', [
  query('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid latitude required'),
  query('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid longitude required'),
  query('radius')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Radius must be between 1 and 50 km'),
], async (req: Request, res: Response) => {
  try {
    if (hasValidationErrors(req, res)) {
      return;
    }

    const { latitude, longitude, radius = 10 } = req.query;

    // Mock nearby places
    const nearbyPlaces = [
      {
        id: '1',
        name: 'Masjid Al-Noor',
        type: 'mosque',
        address: '123 Islamic Center St, City, State',
        coordinates: { lat: 40.7128, lng: -74.0060 },
        distance: 2.5, // km
        prayerTimes: {
          fajr: '05:30',
          dhuhr: '12:15',
          asr: '15:45',
          maghrib: '18:30',
          isha: '20:00',
        },
        services: ['daily_prayers', 'friday_khutbah', 'quran_classes', 'community_events'],
        contact: {
          phone: '+1-555-0123',
          email: 'info@masjidalnoor.org',
          website: 'https://masjidalnoor.org',
        },
        rating: 4.8,
        reviews: 156,
      },
    ];

    res.json({
      status: 'success',
      data: {
        places: nearbyPlaces,
        searchRadius: parseInt(radius as string),
        location: {
          latitude: parseFloat(latitude as string),
          longitude: parseFloat(longitude as string),
        },
      },
    });

  } catch (error) {
    console.error('Get nearby places error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get nearby places',
    });
  }
});

export default router;
