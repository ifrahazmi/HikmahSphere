import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import User from '../models/User';

const router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: {
    userId?: string;
  };
}

interface DhikrTasbihState {
  presetId: string;
  count: number;
}

interface DhikrDailyTrackerState {
  date: string;
  counts: Record<string, number>;
}

interface DhikrReminderState {
  enabled: boolean;
  morning: boolean;
  evening: boolean;
  friday: boolean;
}

interface DhikrSettingsState {
  darkMode: boolean;
  translationLanguage: 'english' | 'urdu';
}

const DEFAULT_REMINDERS: DhikrReminderState = {
  enabled: false,
  morning: true,
  evening: true,
  friday: true,
};

const DEFAULT_SETTINGS: DhikrSettingsState = {
  darkMode: false,
  translationLanguage: 'english',
};

const sanitizeBookmarks = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') continue;
    const normalized = item.trim();
    if (!normalized || normalized.length > 120) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    sanitized.push(normalized);
    if (sanitized.length >= 1000) break;
  }

  return sanitized;
};

const sanitizeLastViewedDuaId = (value: unknown): string | null | 'invalid' => {
  if (value === null) return null;
  if (typeof value !== 'string') return 'invalid';
  const normalized = value.trim();
  if (!normalized || normalized.length > 120) return 'invalid';
  return normalized;
};

const sanitizeTasbih = (value: unknown): DhikrTasbihState | null => {
  if (!value || typeof value !== 'object') return null;

  const raw = value as Record<string, unknown>;
  const presetId = typeof raw.presetId === 'string' ? raw.presetId.trim() : '';
  const count = Number(raw.count);

  if (!presetId || presetId.length > 80) return null;
  if (!Number.isInteger(count) || count < 0 || count > 1000000) return null;

  return { presetId, count };
};

const sanitizeDailyTracker = (value: unknown): DhikrDailyTrackerState | null => {
  if (!value || typeof value !== 'object') return null;

  const raw = value as Record<string, unknown>;
  const date = typeof raw.date === 'string' ? raw.date.trim() : '';
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return null;

  const countsRaw = raw.counts;
  if (!countsRaw || typeof countsRaw !== 'object' || Array.isArray(countsRaw)) return null;

  const counts: Record<string, number> = {};
  for (const [key, entry] of Object.entries(countsRaw as Record<string, unknown>)) {
    const normalizedKey = key.trim();
    const numericValue = Number(entry);
    if (!normalizedKey || normalizedKey.length > 80) continue;
    if (!Number.isInteger(numericValue) || numericValue < 0 || numericValue > 1000000) continue;
    counts[normalizedKey] = numericValue;
  }

  return { date, counts };
};

const sanitizeReminderPatch = (value: unknown): Partial<DhikrReminderState> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  const patch: Partial<DhikrReminderState> = {};
  const allowedKeys: Array<keyof DhikrReminderState> = ['enabled', 'morning', 'evening', 'friday'];

  for (const key of allowedKeys) {
    const entry = raw[key];
    if (typeof entry === 'undefined') continue;
    if (typeof entry !== 'boolean') return null;
    patch[key] = entry;
  }

  return patch;
};

const sanitizeSettingsPatch = (value: unknown): Partial<DhikrSettingsState> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  const patch: Partial<DhikrSettingsState> = {};

  if (typeof raw.darkMode !== 'undefined') {
    if (typeof raw.darkMode !== 'boolean') return null;
    patch.darkMode = raw.darkMode;
  }

  if (typeof raw.translationLanguage !== 'undefined') {
    if (raw.translationLanguage !== 'english' && raw.translationLanguage !== 'urdu') return null;
    patch.translationLanguage = raw.translationLanguage;
  }

  return patch;
};

const mapDhikrState = (progress: any) => {
  const bookmarks = Array.isArray(progress?.bookmarks)
    ? progress.bookmarks.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  const lastViewedDuaId =
    typeof progress?.lastViewedDuaId === 'string' && progress.lastViewedDuaId.trim()
      ? progress.lastViewedDuaId
      : null;

  const tasbih =
    progress?.tasbih && typeof progress.tasbih === 'object'
      ? {
          presetId:
            typeof progress.tasbih.presetId === 'string' && progress.tasbih.presetId.trim()
              ? progress.tasbih.presetId
              : '',
          count:
            Number.isInteger(progress.tasbih.count) && progress.tasbih.count >= 0
              ? progress.tasbih.count
              : 0,
        }
      : null;

  const dailyTracker =
    progress?.dailyTracker &&
    typeof progress.dailyTracker === 'object' &&
    typeof progress.dailyTracker.date === 'string'
      ? {
          date: progress.dailyTracker.date,
          counts:
            progress.dailyTracker.counts &&
            typeof progress.dailyTracker.counts === 'object' &&
            !Array.isArray(progress.dailyTracker.counts)
              ? progress.dailyTracker.counts
              : {},
        }
      : null;

  const reminders = {
    ...DEFAULT_REMINDERS,
    ...(progress?.reminders && typeof progress.reminders === 'object' ? progress.reminders : {}),
  } as DhikrReminderState;

  const settings = {
    ...DEFAULT_SETTINGS,
    ...(progress?.settings && typeof progress.settings === 'object' ? progress.settings : {}),
  } as DhikrSettingsState;

  return {
    bookmarks,
    lastViewedDuaId,
    tasbih,
    dailyTracker,
    reminders,
    settings,
    updatedAt: progress?.updatedAt || null,
  };
};

/**
 * @route   GET /api/dhikr/user-state
 * @desc    Get logged-in user's Dhikr & Dua state
 * @access  Private
 */
router.get('/user-state', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const user = await User.findById(userId).select('religious.dhikrDuaProgress');
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const payload = mapDhikrState(user.religious?.dhikrDuaProgress);
    return res.json({ status: 'success', data: payload });
  } catch (error: any) {
    console.error('Dhikr user-state fetch error:', error.message);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch Dhikr user state' });
  }
});

/**
 * @route   PUT /api/dhikr/user-state
 * @desc    Save logged-in user's Dhikr & Dua state (partial updates allowed)
 * @access  Private
 */
router.put('/user-state', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const {
      bookmarks,
      lastViewedDuaId,
      tasbih,
      dailyTracker,
      reminders,
      settings,
    } = req.body as {
      bookmarks?: unknown;
      lastViewedDuaId?: unknown;
      tasbih?: unknown;
      dailyTracker?: unknown;
      reminders?: unknown;
      settings?: unknown;
    };

    const existingUser = await User.findById(userId).select('religious.dhikrDuaProgress');
    if (!existingUser) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const currentState = mapDhikrState(existingUser.religious?.dhikrDuaProgress);
    const setData: Record<string, unknown> = {};
    const unsetData: Record<string, unknown> = {};

    if (typeof bookmarks !== 'undefined') {
      const sanitizedBookmarks = sanitizeBookmarks(bookmarks);
      if (!sanitizedBookmarks) {
        return res.status(400).json({ status: 'error', message: 'bookmarks must be an array of strings' });
      }
      setData['religious.dhikrDuaProgress.bookmarks'] = sanitizedBookmarks;
    }

    if (typeof lastViewedDuaId !== 'undefined') {
      const sanitizedLastViewed = sanitizeLastViewedDuaId(lastViewedDuaId);
      if (sanitizedLastViewed === 'invalid') {
        return res.status(400).json({ status: 'error', message: 'lastViewedDuaId is invalid' });
      }
      if (sanitizedLastViewed === null) {
        unsetData['religious.dhikrDuaProgress.lastViewedDuaId'] = 1;
      } else {
        setData['religious.dhikrDuaProgress.lastViewedDuaId'] = sanitizedLastViewed;
      }
    }

    if (typeof tasbih !== 'undefined') {
      const sanitizedTasbih = sanitizeTasbih(tasbih);
      if (!sanitizedTasbih) {
        return res.status(400).json({ status: 'error', message: 'tasbih is invalid' });
      }
      setData['religious.dhikrDuaProgress.tasbih'] = sanitizedTasbih;
    }

    if (typeof dailyTracker !== 'undefined') {
      const sanitizedDailyTracker = sanitizeDailyTracker(dailyTracker);
      if (!sanitizedDailyTracker) {
        return res.status(400).json({ status: 'error', message: 'dailyTracker is invalid' });
      }
      setData['religious.dhikrDuaProgress.dailyTracker'] = sanitizedDailyTracker;
    }

    if (typeof reminders !== 'undefined') {
      const reminderPatch = sanitizeReminderPatch(reminders);
      if (!reminderPatch) {
        return res.status(400).json({ status: 'error', message: 'reminders is invalid' });
      }
      setData['religious.dhikrDuaProgress.reminders'] = {
        ...currentState.reminders,
        ...reminderPatch,
      };
    }

    if (typeof settings !== 'undefined') {
      const settingsPatch = sanitizeSettingsPatch(settings);
      if (!settingsPatch) {
        return res.status(400).json({ status: 'error', message: 'settings is invalid' });
      }
      setData['religious.dhikrDuaProgress.settings'] = {
        ...currentState.settings,
        ...settingsPatch,
      };
    }

    if (!Object.keys(setData).length && !Object.keys(unsetData).length) {
      return res.status(400).json({
        status: 'error',
        message: 'No valid fields to update.',
      });
    }

    setData['religious.dhikrDuaProgress.updatedAt'] = new Date();

    const updateQuery: Record<string, unknown> = {};
    if (Object.keys(setData).length) updateQuery.$set = setData;
    if (Object.keys(unsetData).length) updateQuery.$unset = unsetData;

    const updatedUser = await User.findByIdAndUpdate(userId, updateQuery, {
      new: true,
      runValidators: true,
    }).select('religious.dhikrDuaProgress');

    if (!updatedUser) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const payload = mapDhikrState(updatedUser.religious?.dhikrDuaProgress);
    return res.json({
      status: 'success',
      message: 'Dhikr user state updated successfully',
      data: payload,
    });
  } catch (error: any) {
    console.error('Dhikr user-state update error:', error.message);
    return res.status(500).json({ status: 'error', message: 'Failed to update Dhikr user state' });
  }
});

export default router;
