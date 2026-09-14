import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import SalahTracker from '../models/SalahTracker';
import User from '../models/User';
import {
  DEFAULT_MUHASABA_REMINDER_TIME,
  MUHASABA_REMINDER_TIME_PATTERN,
  normalizeMuhasabaReminderTime,
} from '../utils/muhasabaReminder';

const router = express.Router();

const MAX_RECORDS = 4000;
const MAX_ACTIVITY_ITEMS = 365;
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_QURAN_STATUS = new Set(['none', 'read', 'translation', 'tafseer']);
const ALLOWED_PRAYER_EXEMPTION_REASONS = new Set(['none', 'menstruation']);
const ALLOWED_FASTING_STATUS = new Set(['none', 'sunnah', 'fard', 'missed']);

interface TrackerActivityInput {
  dateKey: string;
  prayed: number;
  qada: number;
  missed: number;
  pending: number;
  prayerScore: number;
  quranScore: number;
  quranStatus: 'none' | 'read' | 'translation' | 'tafseer';
  fastingStatus: 'none' | 'sunnah' | 'fard' | 'missed';
  dhikrStatus: boolean;
  isPrayerExempt: boolean;
  prayerExemptionReason: 'none' | 'menstruation';
  note: string;
  hasAnyActivity: boolean;
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeRecords = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const normalized: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>);

  for (const [dateKey, dayRecord] of entries) {
    if (!DATE_KEY_REGEX.test(dateKey)) continue;
    normalized[dateKey] = dayRecord;
    if (Object.keys(normalized).length >= MAX_RECORDS) break;
  }

  return normalized;
};

const normalizeStats = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Record<string, unknown>) };
};

const normalizeActivity = (value: unknown): TrackerActivityInput[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: TrackerActivityInput[] = [];

  for (const item of value.slice(0, MAX_ACTIVITY_ITEMS)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

    const raw = item as Record<string, unknown>;
    const dateKey = String(raw.dateKey || '');
    if (!DATE_KEY_REGEX.test(dateKey)) continue;

    const quranStatusRaw = String(raw.quranStatus || 'none');
    const quranStatus = ALLOWED_QURAN_STATUS.has(quranStatusRaw)
      ? (quranStatusRaw as TrackerActivityInput['quranStatus'])
      : 'none';
    const prayerExemptionReasonRaw = String(raw.prayerExemptionReason || 'none');
    const prayerExemptionReason = ALLOWED_PRAYER_EXEMPTION_REASONS.has(prayerExemptionReasonRaw)
      ? (prayerExemptionReasonRaw as TrackerActivityInput['prayerExemptionReason'])
      : 'none';
    const fastingStatusRaw = String(raw.fastingStatus || 'none');
    const fastingStatus = ALLOWED_FASTING_STATUS.has(fastingStatusRaw)
      ? (fastingStatusRaw as TrackerActivityInput['fastingStatus'])
      : 'none';

    normalized.push({
      dateKey,
      prayed: clamp(Math.round(toFiniteNumber(raw.prayed, 0)), 0, 5),
      qada: clamp(Math.round(toFiniteNumber(raw.qada, 0)), 0, 5),
      missed: clamp(Math.round(toFiniteNumber(raw.missed, 0)), 0, 5),
      pending: clamp(Math.round(toFiniteNumber(raw.pending, 0)), 0, 5),
      prayerScore: clamp(Math.round(toFiniteNumber(raw.prayerScore, 0)), 0, 100),
      quranScore: clamp(Math.round(toFiniteNumber(raw.quranScore, 0)), 0, 100),
      quranStatus,
      fastingStatus,
      dhikrStatus: Boolean(raw.dhikrStatus),
      isPrayerExempt: Boolean(raw.isPrayerExempt),
      prayerExemptionReason,
      note: typeof raw.note === 'string' ? raw.note.slice(0, 3000) : '',
      hasAnyActivity: Boolean(raw.hasAnyActivity),
    });
  }

  return normalized;
};

/**
 * @route   GET /api/salah-tracker
 * @desc    Get current user's Salah Tracker payload
 * @access  Private
 */
router.get('/', authMiddleware, async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    const tracker = await SalahTracker.findOne({ userId }).lean();

    if (!tracker) {
      return res.json({
        status: 'success',
        data: {
          version: 3,
          records: {},
          stats: {},
          activity: [],
          lastSyncedAt: null,
        },
      });
    }

    return res.json({
      status: 'success',
      data: {
        version: tracker.version ?? 3,
        records: tracker.records ?? {},
        stats: tracker.stats ?? {},
        activity: tracker.activity ?? [],
        lastSyncedAt: tracker.lastSyncedAt ?? tracker.updatedAt ?? null,
      },
    });
  } catch (error: any) {
    console.error('Get Salah Tracker error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch Salah Tracker data',
    });
  }
});

/**
 * @route   PUT /api/salah-tracker
 * @desc    Save current user's Salah Tracker payload
 * @access  Private
 */
router.put(
  '/',
  authMiddleware,
  [
    body('records').isObject().withMessage('records must be an object'),
    body('version').optional().isInt({ min: 1, max: 50 }),
    body('stats').optional().isObject().withMessage('stats must be an object'),
    body('activity').optional().isArray({ max: MAX_ACTIVITY_ITEMS }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const userId = (req as any).user?.userId;
      const parsedVersion = Number(req.body.version);
      const version = Number.isInteger(parsedVersion) && parsedVersion >= 1 && parsedVersion <= 50 ? parsedVersion : 3;

      const records = normalizeRecords(req.body.records);
      const stats = normalizeStats(req.body.stats);
      const activity = normalizeActivity(req.body.activity);

      const tracker = await SalahTracker.findOneAndUpdate(
        { userId },
        {
          $set: {
            version,
            records,
            stats,
            activity,
            lastSyncedAt: new Date(),
          },
          $setOnInsert: { userId },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );

      return res.json({
        status: 'success',
        message: 'Salah Tracker synced successfully',
        data: {
          version: tracker.version,
          lastSyncedAt: tracker.lastSyncedAt ?? tracker.updatedAt,
        },
      });
    } catch (error: any) {
      console.error('Save Salah Tracker error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to save Salah Tracker data',
      });
    }
  }
);

const mapReminder = (user: any) => ({
  enabled: Boolean(user?.religious?.muhasabaReminder?.enabled),
  time: normalizeMuhasabaReminderTime(user?.religious?.muhasabaReminder?.time),
  timezone:
    typeof user?.religious?.muhasabaReminder?.timezone === 'string' && user.religious.muhasabaReminder.timezone.trim()
      ? user.religious.muhasabaReminder.timezone.trim()
      : typeof user?.prayerPush?.timezone === 'string' && user.prayerPush.timezone.trim()
        ? user.prayerPush.timezone.trim()
        : null,
});

const isValidTimezone = (value: string): boolean => {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

/**
 * @route   GET /api/salah-tracker/reminder
 * @desc    Get daily Muhasabah reminder settings
 * @access  Private
 */
router.get('/reminder', authMiddleware, async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    const user = await User.findById(userId).select('religious.muhasabaReminder prayerPush.timezone');
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    return res.json({
      status: 'success',
      data: mapReminder(user),
    });
  } catch (error: any) {
    console.error('Get Muhasabah reminder error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch reminder settings',
    });
  }
});

/**
 * @route   PATCH /api/salah-tracker/reminder
 * @desc    Update daily Muhasabah reminder time and enablement
 * @access  Private
 */
router.patch(
  '/reminder',
  authMiddleware,
  [
    body('enabled').optional().isBoolean().withMessage('enabled must be a boolean'),
    body('time').optional().matches(MUHASABA_REMINDER_TIME_PATTERN).withMessage('time must be HH:MM (24-hour)'),
    body('timezone').optional().isString().trim().isLength({ min: 1, max: 80 }),
  ],
  async (req: any, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const userId = req.user?.userId;
      const user = await User.findById(userId).select('religious.muhasabaReminder prayerPush.timezone');
      if (!user) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
      }

      const current = mapReminder(user);
      const nextEnabled = typeof req.body.enabled === 'boolean' ? req.body.enabled : current.enabled;
      const nextTime = typeof req.body.time === 'string'
        ? normalizeMuhasabaReminderTime(req.body.time)
        : current.time;
      const requestedTimezone = typeof req.body.timezone === 'string' ? req.body.timezone.trim() : '';
      const nextTimezone = requestedTimezone || current.timezone || '';

      if (requestedTimezone && !isValidTimezone(requestedTimezone)) {
        return res.status(400).json({ status: 'error', message: 'timezone is invalid' });
      }

      if (nextEnabled && !nextTimezone) {
        return res.status(400).json({
          status: 'error',
          message: 'timezone is required to enable reminders',
        });
      }

      if (nextEnabled && !isValidTimezone(nextTimezone)) {
        return res.status(400).json({ status: 'error', message: 'timezone is invalid' });
      }

      await User.updateOne(
        { _id: userId },
        {
          $set: {
            'religious.muhasabaReminder.enabled': nextEnabled,
            'religious.muhasabaReminder.time': nextTime || DEFAULT_MUHASABA_REMINDER_TIME,
            ...(nextTimezone ? { 'religious.muhasabaReminder.timezone': nextTimezone } : {}),
          },
        }
      );

      const updated = await User.findById(userId).select('religious.muhasabaReminder prayerPush.timezone');
      return res.json({
        status: 'success',
        message: 'Reminder settings saved',
        data: mapReminder(updated),
      });
    } catch (error: any) {
      console.error('Save Muhasabah reminder error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to save reminder settings',
      });
    }
  }
);

export default router;
