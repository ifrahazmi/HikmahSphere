import express from 'express';
import { query, validationResult } from 'express-validator';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import User from '../models/User';
import { rewriteAyahAudioPayload } from '../utils/quranAudioUrl';

const router = express.Router();

// Al-Quran Cloud API Configuration
const QURAN_API_BASE = 'https://api.alquran.cloud/v1';
const EDITIONS_CACHE_TTL_MS = 1000 * 60 * 10;

type EditionsCacheEntry = {
  expiresAt: number;
  data: any;
};

const editionsCache = new Map<string, EditionsCacheEntry>();
const editionsInFlight = new Map<string, Promise<any>>();

type BookmarkColor =
  | 'emerald'
  | 'red'
  | 'teal'
  | 'indigo'
  | 'blue'
  | 'purple'
  | 'amber'
  | 'rose';

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

const isBookmarkColor = (value: unknown): value is BookmarkColor => {
  return typeof value === 'string'
    && ['emerald', 'red', 'teal', 'indigo', 'blue', 'purple', 'amber', 'rose'].includes(value);
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
    const edition = req.query.edition || 'quran-uthmani'; // Default Arabic

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

    const normalizedEditions = editions
      .split(',')
      .map((edition) => edition.trim())
      .filter((edition) => /^[a-z0-9._-]+$/i.test(edition));

    if (!normalizedEditions.length) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid editions parameter',
      });
    }

    const editionsPath = normalizedEditions.map((edition) => encodeURIComponent(edition)).join(',');
    const upstreamUrl = `${QURAN_API_BASE}/surah/${surahNum}/editions/${editionsPath}`;

    const cacheKey = `${surahNum}|${normalizedEditions.join(',')}`;
    const now = Date.now();
    const cached = editionsCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return res.json({
        status: 'success',
        data: rewriteAyahAudioPayload(cached.data, normalizedEditions[0]),
      });
    }

    let requestPromise = editionsInFlight.get(cacheKey);
    if (!requestPromise) {
      requestPromise = (async () => {
        try {
          const response = await fetch(upstreamUrl);
          const rawBody = await response.text();
          const data = (() => {
            try {
              return JSON.parse(rawBody);
            } catch {
              return null;
            }
          })();

          if (!response.ok) {
            throw new Error(`Upstream HTTP ${response.status}`);
          }

          if (data?.code !== 200 || !data?.data) {
            const upstreamMessage = data?.status || data?.message || 'Failed to fetch surah editions';
            throw new Error(upstreamMessage);
          }

          editionsCache.set(cacheKey, {
            data: rewriteAyahAudioPayload(data.data, normalizedEditions[0]),
            expiresAt: Date.now() + EDITIONS_CACHE_TTL_MS,
          });

          return rewriteAyahAudioPayload(data.data, normalizedEditions[0]);
        } finally {
          editionsInFlight.delete(cacheKey);
        }
      })();

      editionsInFlight.set(cacheKey, requestPromise);
    }

    const resolvedData = await requestPromise;

    if (resolvedData) {
      res.json({
        status: 'success',
        data: rewriteAyahAudioPayload(resolvedData, normalizedEditions[0])
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
    const editions = req.query.editions || 'quran-uthmani';

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
        data: rewriteAyahAudioPayload(data.data, String(editions).split(',')[0])
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

// ============================================================
// Tafsir API Proxy + Tafheem Fixture Support
// ============================================================
const TAFSIR_PROXY_API_BASE = process.env.TAFSIR_API_URL || process.env.REACT_APP_TAFSIR_API_URL || 'http://localhost:8080/api';
const TAFHEEM_EDITION = 'tafheem-ul-quran-syed-abu-ala-maududi';

const getRequestedEdition = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
};

const tryLoadTafheemFixture = (): Record<string, any> | null => {
  try {
    const fsModule = require('fs') as typeof import('fs');
    const pathModule = require('path') as typeof import('path');
    const fixturePath = process.env.TAFHEEM_FIXTURE_PATH || pathModule.resolve(process.cwd(), 'tmp/Test.json');

    if (!fsModule.existsSync(fixturePath)) {
      return null;
    }

    const raw = fsModule.readFileSync(fixturePath, 'utf8');
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, any>;
  } catch (error) {
    console.warn('Tafheem fixture load failed:', error);
    return null;
  }
};

const proxyTafsirRequest = async (
  path: string,
  edition: string | null
): Promise<{ ok: boolean; status: number; payload: any }> => {
  const query = edition ? `?edition=${encodeURIComponent(edition)}` : '';
  const response = await fetch(`${TAFSIR_PROXY_API_BASE}${path}${query}`);
  const payload: any = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
};

/**
 * @route   GET /api/quran/tafsir/surah/:number
 * @desc    Get tafsir for a full surah. Supports keyed Tafheem fixture response.
 * @access  Public
 */
router.get('/tafsir/surah/:number', optionalAuthMiddleware, async (req: any, res: any) => {
  try {
    const surahNumber = Number(req.params.number);
    if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid surah number. Must be between 1 and 114.',
      });
    }

    const edition = getRequestedEdition(req.query.edition);

    if (edition === TAFHEEM_EDITION) {
      const fixture = tryLoadTafheemFixture();
      if (fixture) {
        const filtered = Object.fromEntries(
          Object.entries(fixture).filter(([key]) => key.startsWith(`${surahNumber}:`))
        );

        if (Object.keys(filtered).length > 0) {
          return res.json({
            status: 'success',
            data: filtered,
            source: 'tafheem-fixture',
          });
        }
      }
    }

    const proxied = await proxyTafsirRequest(`/surah/${surahNumber}`, edition);
    if (!proxied.ok) {
      return res.status(proxied.status).json({
        status: 'error',
        message: proxied.payload?.message || 'Failed to load tafsir surah data',
      });
    }

    return res.json(
      proxied.payload?.status
        ? proxied.payload
        : {
            status: 'success',
            data: proxied.payload?.data ?? proxied.payload,
            source: 'tafsir-proxy',
          }
    );
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch tafsir surah data',
      details: error?.message || String(error),
    });
  }
});

/**
 * @route   GET /api/quran/tafsir/surah/:number/ayah/:ayahNumber
 * @desc    Get tafsir for a single ayah. Supports keyed Tafheem fixture response.
 * @access  Public
 */
router.get('/tafsir/surah/:number/ayah/:ayahNumber', optionalAuthMiddleware, async (req: any, res: any) => {
  try {
    const surahNumber = Number(req.params.number);
    const ayahNumber = Number(req.params.ayahNumber);

    if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid surah number. Must be between 1 and 114.',
      });
    }

    if (!Number.isInteger(ayahNumber) || ayahNumber < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid ayah number. Must be a positive integer.',
      });
    }

    const edition = getRequestedEdition(req.query.edition);

    if (edition === TAFHEEM_EDITION) {
      const fixture = tryLoadTafheemFixture();
      if (fixture) {
        const key = `${surahNumber}:${ayahNumber}`;
        const entry = fixture[key];

        if (entry) {
          return res.json({
            status: 'success',
            data: {
              [key]: entry,
            },
            source: 'tafheem-fixture',
          });
        }
      }
    }

    const proxied = await proxyTafsirRequest(`/surah/${surahNumber}/ayah/${ayahNumber}`, edition);
    if (!proxied.ok) {
      return res.status(proxied.status).json({
        status: 'error',
        message: proxied.payload?.message || 'Failed to load tafsir ayah data',
      });
    }

    return res.json(
      proxied.payload?.status
        ? proxied.payload
        : {
            status: 'success',
            data: proxied.payload?.data ?? proxied.payload,
            source: 'tafsir-proxy',
          }
    );
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch tafsir ayah data',
      details: error?.message || String(error),
    });
  }
});

// ============================================================
// IndoPak Nastaleeq V3 API - Word by Word Quran Data
// ============================================================
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';

let indopakV3Db: sqlite3.Database | null = null;

const resolveIndopakV3DbPath = (): string => {
  const envPath = process.env.INDOPAK_V3_DB_PATH;
  const candidatePaths = [
    envPath,
    path.resolve(__dirname, '../data/indopak-nastaleeq-v3.db'),
    path.resolve(__dirname, '../../src/data/indopak-nastaleeq-v3.db'),
    path.resolve(process.cwd(), 'dist/data/indopak-nastaleeq-v3.db'),
    path.resolve(process.cwd(), 'src/data/indopak-nastaleeq-v3.db'),
    path.resolve(process.cwd(), 'backend/dist/data/indopak-nastaleeq-v3.db'),
    path.resolve(process.cwd(), 'backend/src/data/indopak-nastaleeq-v3.db'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const dbPath = candidatePaths.find((candidate) => fs.existsSync(candidate));

  if (!dbPath) {
    throw new Error(`IndoPak v3 database not found. Checked: ${candidatePaths.join(', ')}`);
  }

  return dbPath;
};

const getIndopakV3Db = (): sqlite3.Database => {
  if (!indopakV3Db) {
    const dbPath = resolveIndopakV3DbPath();
    indopakV3Db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
  }
  return indopakV3Db;
};

/**
 * GET /api/quran/indopak-v3/surah/:surahNumber
 * Get complete Surah with word-by-word IndoPak V3 script
 */
router.get('/indopak-v3/surah/:surahNumber', [
  // surahNumber comes from route params, not query
], async (req: Request, res: Response) => {
  try {
    const surahNumber = parseInt(req.params.surahNumber as string);
    
    // Validate surah number
    if (Number.isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid surah number. Must be between 1 and 114.'
      });
    }
    
    const db = getIndopakV3Db();

    // Get all words for this Surah - sorted by ayah first, then by word position
    const words = await new Promise<any[]>((resolve, reject) => {
      db.all(
        'SELECT * FROM words WHERE surah = ? ORDER BY ayah ASC, word ASC',
        [surahNumber],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    if (words.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: `Surah ${surahNumber} not found in IndoPak V3 database`
      });
    }

    // Group words by Ayah
    const ayahsMap = new Map<number, any[]>();
    words.forEach(word => {
      if (!ayahsMap.has(word.ayah)) {
        ayahsMap.set(word.ayah, []);
      }
      ayahsMap.get(word.ayah)!.push({
        position: word.word,
        text: word.text,
        location: word.location
      });
    });

    // Build ayahs array with full text
    const ayahs = Array.from(ayahsMap.entries()).sort((a, b) => a[0] - b[0]).map(([ayahNum, words]) => ({
      ayah: ayahNum,
      words,
      text: words.map((w: any) => w.text).join(' ')
    }));

    res.json({
      status: 'success',
      data: {
        surah: surahNumber,
        ayahs,
        script_type: 'text_indopak_nastaleeq',
        font_family: 'indopak-nastaleeq-v3'
      }
    });
    return;
  } catch (error: any) {
    console.error('IndoPak V3 Surah API error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch IndoPak V3 Surah',
      details: error.message
    });
    return;
  }
});

/**
 * GET /api/quran/indopak-v3/ayah/:surahNumber/:ayahNumber
 * Get specific Ayah with word-by-word IndoPak V3 script
 */
router.get('/indopak-v3/ayah/:surahNumber/:ayahNumber', [
  // Parameters come from route params, not query
], async (req: Request, res: Response) => {
  try {
    const surahNumber = parseInt(req.params.surahNumber as string);
    const ayahNumber = parseInt(req.params.ayahNumber as string);
    
    // Validate parameters
    if (Number.isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid surah number. Must be between 1 and 114.'
      });
    }
    if (Number.isNaN(ayahNumber) || ayahNumber < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid ayah number. Must be a positive integer.'
      });
    }
    
    const db = getIndopakV3Db();

    // Get all words for this Ayah
    const words = await new Promise<any[]>((resolve, reject) => {
      db.all(
        'SELECT * FROM words WHERE surah = ? AND ayah = ? ORDER BY word',
        [surahNumber, ayahNumber],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    if (words.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: `Ayah ${surahNumber}:${ayahNumber} not found in IndoPak V3 database`
      });
    }

    const formattedWords = words.map(word => ({
      position: word.word,
      text: word.text,
      location: word.location
    }));

    res.json({
      status: 'success',
      data: {
        surah: surahNumber,
        ayah: ayahNumber,
        words: formattedWords,
        text: formattedWords.map((w: any) => w.text).join(' '),
        script_type: 'text_indopak_nastaleeq',
        font_family: 'indopak-nastaleeq-v3'
      }
    });
    return;
  } catch (error: any) {
    console.error('IndoPak V3 Ayah API error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch IndoPak V3 Ayah',
      details: error.message
    });
    return;
  }
});

export default router;
