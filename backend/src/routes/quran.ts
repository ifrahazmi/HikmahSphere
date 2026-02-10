import express from 'express';
import { query, validationResult } from 'express-validator';
import { optionalAuthMiddleware } from '../middleware/auth';

const router = express.Router();

// Al-Quran Cloud API Configuration
const QURAN_API_BASE = 'https://api.alquran.cloud/v1';

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
router.get('/ayah/:reference', [
  query('edition').optional().isString(),
], optionalAuthMiddleware, async (req: any, res: any) => {
  try {
    const { reference } = req.params;
    const edition = req.query.edition || 'ar.alafasy';

    const response = await fetch(`${QURAN_API_BASE}/ayah/${reference}/${edition}`);
    const data: any = await response.json();
    
    if (data.code === 200 && data.data) {
      res.json({
        status: 'success',
        data: data.data
      });
    } else {
      throw new Error('Failed to fetch ayah');
    }
  } catch (error: any) {
    console.error('Quran Ayah API error:', error.message);
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
