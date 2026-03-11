import express from 'express';
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { query, validationResult } from 'express-validator';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import User from '../models/User';

const router = express.Router();

// Al-Quran Cloud API Configuration
const QURAN_API_BASE = 'https://api.alquran.cloud/v1';
const INDOPAK_V2_DB_PATH = path.resolve(__dirname, '..', 'data', 'indopak-nastaleeq_v2.db');

type BookmarkColor = 'emerald' | 'blue' | 'purple' | 'amber' | 'rose';

interface UserStateBookmark {
  id: string;
  surah: number;
  ayah: number;
  surahName: string;
  timestamp: Date;
  note?: string;
  color?: BookmarkColor;
}

interface UserStateLastRead {
  surah: number;
  ayah: number;
  surahName?: string;
  timestamp: Date;
}

interface IndoPakV2VerseRow {
  id: number;
  verse_key: string;
  surah: number;
  ayah: number;
  text: string;
}

type IndoPakV2Db = Database<sqlite3.Database, sqlite3.Statement>;
let indopakV2DbPromise: Promise<IndoPakV2Db> | null = null;

const getIndoPakV2Db = async (): Promise<IndoPakV2Db> => {
  if (indopakV2DbPromise) return indopakV2DbPromise;

  if (!fs.existsSync(INDOPAK_V2_DB_PATH)) {
    throw new Error(`IndoPak Nastaleeq v2 database not found at ${INDOPAK_V2_DB_PATH}`);
  }

  indopakV2DbPromise = open({
    filename: INDOPAK_V2_DB_PATH,
    driver: sqlite3.Database,
    mode: sqlite3.OPEN_READONLY,
  });

  return indopakV2DbPromise;
};

const getIndoPakV2SurahRows = async (surahNumber: number): Promise<IndoPakV2VerseRow[]> => {
  const db = await getIndoPakV2Db();
  const rows = await db.all<IndoPakV2VerseRow[]>(`
    SELECT id, verse_key, surah, ayah, text
    FROM verses
    WHERE surah = ?
    ORDER BY ayah ASC
  `, surahNumber);

  return rows;
};

const isBookmarkColor = (value: unknown): value is BookmarkColor => {
  return typeof value === 'string' && ['emerald', 'blue', 'purple', 'amber', 'rose'].includes(value);
};

const sanitizeBookmarks = (value: unknown): UserStateBookmark[] | null => {
  if (!Array.isArray(value)) return null;

  const sanitized: UserStateBookmark[] = [];

  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (!item || typeof item !== 'object') continue;

    const raw = item as Record<string, unknown>;
    const surah = Number(raw.surahNumber);
    const ayah = Number(raw.ayahNumber);
    const surahName = typeof raw.surahName === 'string' ? raw.surahName.trim() : '';

    if (!Number.isInteger(surah) || surah < 1 || surah > 114) continue;
    if (!Number.isInteger(ayah) || ayah < 1) continue;
    if (!surahName) continue;

    const parsedTimestamp =
      typeof raw.timestamp === 'string' || raw.timestamp instanceof Date
        ? new Date(raw.timestamp)
        : new Date();
    const timestamp = Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp;

    const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, 500) : undefined;
    const color = isBookmarkColor(raw.color) ? raw.color : undefined;
    const id =
      typeof raw.id === 'string' && raw.id.trim().length > 0
        ? raw.id
        : `${surah}:${ayah}:${Date.now()}-${i}`;

    const bookmark: UserStateBookmark = {
      id,
      surah,
      ayah,
      surahName,
      timestamp,
    };
    if (note) bookmark.note = note;
    if (color) bookmark.color = color;

    sanitized.push(bookmark);
  }

  return sanitized;
};

const sanitizeLastRead = (value: unknown): UserStateLastRead | null | 'invalid' => {
  if (value === null) return null;
  if (!value || typeof value !== 'object') return 'invalid';

  const raw = value as Record<string, unknown>;
  const surah = Number(raw.surahNumber);
  const ayah = Number(raw.ayahNumber);

  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return 'invalid';
  if (!Number.isInteger(ayah) || ayah < 1) return 'invalid';

  const surahName = typeof raw.surahName === 'string' ? raw.surahName.trim() : undefined;
  const parsedTimestamp =
    typeof raw.timestamp === 'string' || raw.timestamp instanceof Date
      ? new Date(raw.timestamp)
      : new Date();

  const timestamp = Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp;

  const result: UserStateLastRead = {
    surah,
    ayah,
    timestamp,
  };
  if (surahName) {
    result.surahName = surahName;
  }

  return result;
};

/**
 * @route   GET /api/quran/user-state
 * @desc    Get logged-in user's Quran reader state (settings, bookmarks, last read)
 * @access  Private
 */
router.get('/user-state', authMiddleware, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.user.userId).select('religious.quranProgress');
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const progress = user.religious?.quranProgress;
    const bookmarks = Array.isArray(progress?.bookmarks) ? progress.bookmarks : [];

    const payload = {
      settings: progress?.settings || null,
      bookmarks: bookmarks.map((b: UserStateBookmark) => ({
        id: b.id,
        surahNumber: b.surah,
        ayahNumber: b.ayah,
        surahName: b.surahName,
        timestamp: b.timestamp,
        note: b.note,
        color: b.color,
      })),
      lastRead: progress?.lastRead?.surah && progress?.lastRead?.ayah
        ? {
            surahNumber: progress.lastRead.surah,
            ayahNumber: progress.lastRead.ayah,
            surahName: progress.lastRead.surahName,
            timestamp: progress.lastRead.timestamp,
          }
        : null,
    };

    return res.json({ status: 'success', data: payload });
  } catch (error: any) {
    console.error('Quran user-state fetch error:', error.message);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch Quran user state' });
  }
});

/**
 * @route   PUT /api/quran/user-state
 * @desc    Save logged-in user's Quran reader state (settings, bookmarks, last read)
 * @access  Private
 */
router.put('/user-state', authMiddleware, async (req: any, res: any) => {
  try {
    const { settings, bookmarks, lastRead } = req.body as {
      settings?: Record<string, unknown>;
      bookmarks?: unknown;
      lastRead?: unknown;
    };

    const setData: Record<string, unknown> = {};
    const unsetData: Record<string, unknown> = {};

    if (typeof settings !== 'undefined') {
      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ status: 'error', message: 'settings must be an object' });
      }
      setData['religious.quranProgress.settings'] = settings;
    }

    if (typeof bookmarks !== 'undefined') {
      const sanitizedBookmarks = sanitizeBookmarks(bookmarks);
      if (!sanitizedBookmarks) {
        return res.status(400).json({ status: 'error', message: 'bookmarks must be an array' });
      }
      setData['religious.quranProgress.bookmarks'] = sanitizedBookmarks;
    }

    if (typeof lastRead !== 'undefined') {
      const sanitizedLastRead = sanitizeLastRead(lastRead);
      if (sanitizedLastRead === 'invalid') {
        return res.status(400).json({ status: 'error', message: 'lastRead is invalid' });
      }

      if (sanitizedLastRead === null) {
        unsetData['religious.quranProgress.lastRead'] = 1;
      } else {
        setData['religious.quranProgress.lastRead'] = sanitizedLastRead;
      }
    }

    if (!Object.keys(setData).length && !Object.keys(unsetData).length) {
      return res.status(400).json({
        status: 'error',
        message: 'No valid fields to update. Provide settings, bookmarks, or lastRead.',
      });
    }

    const updateQuery: Record<string, unknown> = {};
    if (Object.keys(setData).length) updateQuery.$set = setData;
    if (Object.keys(unsetData).length) updateQuery.$unset = unsetData;

    const user = await User.findByIdAndUpdate(req.user.userId, updateQuery, {
      new: true,
      runValidators: true,
    }).select('religious.quranProgress');

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const progress = user.religious?.quranProgress;
    const responseBookmarks = Array.isArray(progress?.bookmarks) ? progress.bookmarks : [];

    return res.json({
      status: 'success',
      message: 'Quran user state updated successfully',
      data: {
        settings: progress?.settings || null,
        bookmarks: responseBookmarks.map((b: UserStateBookmark) => ({
          id: b.id,
          surahNumber: b.surah,
          ayahNumber: b.ayah,
          surahName: b.surahName,
          timestamp: b.timestamp,
          note: b.note,
          color: b.color,
        })),
        lastRead: progress?.lastRead?.surah && progress?.lastRead?.ayah
          ? {
              surahNumber: progress.lastRead.surah,
              ayahNumber: progress.lastRead.ayah,
              surahName: progress.lastRead.surahName,
              timestamp: progress.lastRead.timestamp,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('Quran user-state update error:', error.message);
    return res.status(500).json({ status: 'error', message: 'Failed to update Quran user state' });
  }
});

/**
 * @route   GET /api/quran/surahs
 * @desc    Get list of all 114 surahs
 * @access  Public
 */
router.get('/surahs', optionalAuthMiddleware, async (req: any, res: any) => {
  try {
    const response = await fetch(`${QURAN_API_BASE}/surah`);
    const data: any = await response.json();
    
    if (data.code === 200 && data.data) {
      res.json({
        status: 'success',
        data: data.data
      });
    } else {
      throw new Error('Failed to fetch surahs');
    }
  } catch (error: any) {
    console.error('Quran API error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch Quran surahs',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/quran/surah/:number
 * @desc    Get specific surah with ayahs
 * @access  Public
 */
router.get('/surah/:number', [
  query('edition').optional().isString().withMessage('Edition must be a string'),
], optionalAuthMiddleware, async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { number } = req.params;
    const edition = req.query.edition || 'ar.alafasy'; // Default Arabic

    // Validate surah number
    const surahNum = parseInt(number);
    if (isNaN(surahNum) || surahNum < 1 || surahNum > 114) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid surah number. Must be between 1 and 114'
      });
    }

    const response = await fetch(`${QURAN_API_BASE}/surah/${surahNum}/${edition}`);
    const data: any = await response.json();
    
    if (data.code === 200 && data.data) {
      res.json({
        status: 'success',
        data: data.data
      });
    } else {
      throw new Error('Failed to fetch surah');
    }
  } catch (error: any) {
    console.error('Quran Surah API error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch surah',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/quran/surah/:number/indopak-v2
 * @desc    Get specific surah from local IndoPak Nastaleeq v2 SQLite database
 * @access  Public
 */
router.get('/surah/:number/indopak-v2', optionalAuthMiddleware, async (req: any, res: any) => {
  try {
    const { number } = req.params;

    const surahNum = parseInt(number, 10);
    if (isNaN(surahNum) || surahNum < 1 || surahNum > 114) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid surah number. Must be between 1 and 114',
      });
    }

    const rows = await getIndoPakV2SurahRows(surahNum);

    if (!rows.length) {
      return res.status(404).json({
        status: 'error',
        message: `No ayahs found for Surah ${surahNum} in IndoPak Nastaleeq v2 database`,
      });
    }

    return res.json({
      status: 'success',
      data: {
        fontName: 'IndoPak Nastaleeq v2',
        source: 'indopak-nastaleeq_v2.db',
        surah: surahNum,
        rows,
      },
    });
  } catch (error: any) {
    console.error('IndoPak Nastaleeq v2 API error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch IndoPak Nastaleeq v2 surah data',
      details: error.message,
    });
  }
});

/**
 * @route   GET /api/quran/surah/:number/editions
 * @desc    Get specific surah with multiple translations/editions
 * @access  Public
 */
router.get('/surah/:number/editions', [
  query('editions').isString().withMessage('Editions must be comma-separated string'),
], optionalAuthMiddleware, async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { number } = req.params;
    const editions = req.query.editions as string;
    
    // Validate surah number
    const surahNum = parseInt(number);
    if (isNaN(surahNum) || surahNum < 1 || surahNum > 114) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid surah number. Must be between 1 and 114'
      });
    }

    const response = await fetch(`${QURAN_API_BASE}/surah/${surahNum}/editions/${editions}`);
    const data: any = await response.json();
    
    if (data.code === 200 && data.data) {
      res.json({
        status: 'success',
        data: data.data
      });
    } else {
      throw new Error('Failed to fetch surah editions');
    }
  } catch (error: any) {
    console.error('Quran Editions API error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch surah with editions',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/quran/ayah/:reference
 * @desc    Get specific ayah (e.g., 2:255 for Ayat al-Kursi)
 * @access  Public
 */
router.get('/ayah/:reference', optionalAuthMiddleware, async (req: any, res: any) => {
  try {
    const { reference } = req.params;
    const editions = req.query.editions || 'ar.alafasy';

    console.log(`🎵 [Quran API] Fetching ayah ${reference} with edition ${editions}`);

    // Validate reference format (should be like "2:255")
    const parts = reference.split(':');
    if (parts.length !== 2) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid reference format. Use format like "2:255"'
      });
    }

    const surahNum = parseInt(parts[0]);
    const ayahNum = parseInt(parts[1]);
    
    if (isNaN(surahNum) || isNaN(ayahNum) || surahNum < 1 || surahNum > 114) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid reference. Surah number must be between 1 and 114'
      });
    }

    const apiUrl = `${QURAN_API_BASE}/ayah/${reference}/editions/${editions}`;
    console.log(`🎵 [Quran API] External API URL: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    const data: any = await response.json();

    console.log(`🎵 [Quran API] External API response status:`, data.code);

    if (data.code === 200 && data.data) {
      res.json({
        status: 'success',
        data: data.data
      });
    } else {
      throw new Error('Failed to fetch ayah');
    }
  } catch (error: any) {
    console.error('❌ [Quran API] Ayah API error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch ayah',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/quran/search
 * @desc    Search Quran by keyword
 * @access  Public
 */
router.get('/search', [
  query('q').notEmpty().withMessage('Search query is required'),
  query('surah').optional().isInt({ min: 1, max: 114 }),
], optionalAuthMiddleware, async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { q, surah } = req.query;
    let searchUrl = `${QURAN_API_BASE}/search/${q}/all/en`;
    
    if (surah) {
      searchUrl = `${QURAN_API_BASE}/search/${q}/${surah}/en`;
    }

    const response = await fetch(searchUrl);
    const data: any = await response.json();
    
    if (data.code === 200 && data.data) {
      res.json({
        status: 'success',
        data: data.data
      });
    } else {
      throw new Error('Search failed');
    }
  } catch (error: any) {
    console.error('Quran Search API error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to search Quran',
      details: error.message
    });
  }
});

export default router;
