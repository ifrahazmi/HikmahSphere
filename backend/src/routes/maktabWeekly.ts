import express, { NextFunction, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { getMaktabTeacherName, isMaktabTeacherSlug, MAKTAB_TEACHER_SLUGS } from '../constants/maktabTeachers';
import MaktabWeeklyReport, { IMaktabWeeklyPhoto, IMaktabWeeklyReport } from '../models/MaktabWeeklyReport';
import { getIsoWeekBounds } from '../utils/isoWeek';

const router = express.Router();

const MAX_WEEKLY_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_WEEKLY_PHOTOS = 8;

const isProduction = process.env.NODE_ENV === 'production' || fs.existsSync('/var/www/hikmah/uploads');
const weeklyUploadDir = isProduction
  ? '/var/www/hikmah/uploads/maktab/weekly'
  : path.resolve(process.cwd(), 'src', 'uploads', 'maktab', 'weekly');

if (!fs.existsSync(weeklyUploadDir)) {
  fs.mkdirSync(weeklyUploadDir, { recursive: true });
}

const getFilesystemPath = (urlPath: string): string => {
  const clean = urlPath.replace(/^\//, '');
  return isProduction
    ? `/var/www/hikmah/${clean}`
    : path.resolve(process.cwd(), 'src', clean);
};

const weeklyStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, weeklyUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `maktab-week-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const weeklyUpload = multer({
  storage: weeklyStorage,
  limits: { fileSize: MAX_WEEKLY_UPLOAD_BYTES, files: MAX_WEEKLY_PHOTOS },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp'];
    const isImage = allowedExt.includes(ext) && /^image\/(jpeg|jpg|png|webp)$/.test(mime);
    if (isImage) {
      cb(null, true);
      return;
    }
    cb(new Error('Only jpg, jpeg, png, and webp images are allowed'));
  },
});

const wrapWeeklyUpload = (
  middleware: (req: Request, res: Response, cb: (err?: unknown) => void) => void
) => (req: Request, res: Response, next: NextFunction) => {
  middleware(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    const multerErr = err as { code?: string; message?: string };
    const message =
      multerErr.code === 'LIMIT_FILE_SIZE'
        ? 'Each photo must be 10 MB or smaller.'
        : multerErr.code === 'LIMIT_FILE_COUNT'
          ? `You can upload at most ${MAX_WEEKLY_PHOTOS} photos.`
          : multerErr.message || 'Invalid photo upload';
    res.status(400).json({
      status: 'error',
      message,
      errors: [{ field: 'photos', message }],
    });
  });
};

const uploadedFiles = (req: Request): Express.Multer.File[] => {
  if (Array.isArray(req.files)) {
    return req.files;
  }
  return [];
};

const unlinkQuietly = (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn('Failed to remove weekly report file:', (error as Error).message);
  }
};

const cleanupUploadedFiles = (req: Request) => {
  uploadedFiles(req).forEach((file) => unlinkQuietly(file.path));
};

const unlinkPhoto = (photo: IMaktabWeeklyPhoto) => {
  unlinkQuietly(getFilesystemPath(photo.url));
};

const mapFileToPhoto = (file: Express.Multer.File): IMaktabWeeklyPhoto => ({
  url: `/uploads/maktab/weekly/${file.filename}`,
  name: file.originalname.slice(0, 240),
  mimeType: file.mimetype,
  size: file.size,
});

const serializeReport = (report: IMaktabWeeklyReport) => ({
  id: String(report._id),
  teacher: report.teacher,
  teacherName: getMaktabTeacherName(report.teacher),
  isoWeek: report.isoWeek,
  year: report.year,
  week: report.week,
  weekStart: report.weekStart,
  weekEnd: report.weekEnd,
  photos: report.photos.map((photo, index) => ({
    index,
    name: photo.name,
    mimeType: photo.mimeType,
    size: photo.size,
  })),
  note: report.note || '',
  updatedAt: report.updatedAt,
});

const getSingleParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? String(value[0] || '') : String(value || '');

const parseRemoveIndexes = (raw: unknown): number[] | null => {
  if (raw === undefined || raw === null || raw === '') {
    return [];
  }
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return null;
    const indexes = parsed.map((value) => Number(value));
    if (indexes.some((value) => !Number.isInteger(value) || value < 0)) {
      return null;
    }
    return Array.from(new Set(indexes));
  } catch {
    return null;
  }
};

/**
 * @route   GET /api/maktab/weekly-reports
 * @desc    Public weekly register for one teacher + ISO week
 * @access  Public
 */
router.get(
  '/weekly-reports',
  [
    query('teacher').isIn(MAKTAB_TEACHER_SLUGS).withMessage('Unknown teacher'),
    query('isoWeek').matches(/^\d{4}-W\d{2}$/).withMessage('isoWeek must look like 2026-W32'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: errors.array()[0]?.msg || 'Invalid query',
        errors: errors.array(),
      });
    }

    const teacher = String(req.query.teacher);
    const isoWeek = String(req.query.isoWeek);
    const bounds = getIsoWeekBounds(isoWeek);
    if (!bounds) {
      return res.status(400).json({ status: 'error', message: 'Invalid ISO week' });
    }

    try {
      const report = await MaktabWeeklyReport.findOne({ teacher, isoWeek });
      return res.json({
        status: 'success',
        data: {
          report: report ? serializeReport(report) : null,
        },
      });
    } catch (error) {
      console.error('Get maktab weekly report error:', error);
      return res.status(500).json({ status: 'error', message: 'Failed to load weekly report' });
    }
  }
);

/**
 * @route   GET /api/maktab/weekly-reports/:id/photos/:index
 * @desc    Stream a register photo inline (public)
 * @access  Public
 */
router.get('/weekly-reports/:id/photos/:index', async (req: Request, res: Response) => {
  try {
    const id = getSingleParam(req.params.id);
    const indexParam = getSingleParam(req.params.index);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid report id' });
    }

    const index = Number(indexParam);
    if (!Number.isInteger(index) || index < 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid photo index' });
    }

    const report = await MaktabWeeklyReport.findById(id).lean();
    const photo = report?.photos?.[index];
    if (!photo) {
      return res.status(404).json({ status: 'error', message: 'Photo not found' });
    }

    const diskPath = getFilesystemPath(photo.url);
    if (!fs.existsSync(diskPath)) {
      return res.status(404).json({ status: 'error', message: 'Photo file is missing' });
    }

    const downloadName = (photo.name || path.basename(diskPath)).replace(/"/g, '');
    res.setHeader('Content-Type', photo.mimeType || 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${downloadName}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(path.resolve(diskPath));
  } catch (error) {
    console.error('Stream maktab weekly photo error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to load photo' });
  }
});

/**
 * @route   POST /api/maktab/weekly-reports
 * @desc    Publish a weekly register (create)
 * @access  Private (Admin / Manager)
 */
router.post(
  '/weekly-reports',
  authMiddleware,
  adminMiddleware,
  wrapWeeklyUpload(weeklyUpload.array('photos', MAX_WEEKLY_PHOTOS)),
  body('teacher').isIn(MAKTAB_TEACHER_SLUGS).withMessage('Unknown teacher'),
  body('isoWeek').matches(/^\d{4}-W\d{2}$/).withMessage('isoWeek must look like 2026-W32'),
  body('note').optional({ checkFalsy: true }).isLength({ max: 800 }).withMessage('Note cannot exceed 800 characters'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      cleanupUploadedFiles(req);
      return res.status(400).json({
        status: 'error',
        message: errors.array()[0]?.msg || 'Invalid weekly report',
        errors: errors.array(),
      });
    }

    const teacher = String(req.body.teacher);
    const isoWeek = String(req.body.isoWeek);
    if (!isMaktabTeacherSlug(teacher)) {
      cleanupUploadedFiles(req);
      return res.status(400).json({ status: 'error', message: 'Unknown teacher' });
    }

    const bounds = getIsoWeekBounds(isoWeek);
    if (!bounds) {
      cleanupUploadedFiles(req);
      return res.status(400).json({ status: 'error', message: 'Invalid ISO week' });
    }

    const files = uploadedFiles(req);
    if (files.length < 1) {
      return res.status(400).json({ status: 'error', message: 'Upload at least one register photo' });
    }

    const userId = (req as Request & { user?: { userId?: string } }).user?.userId;
    if (!userId) {
      cleanupUploadedFiles(req);
      return res.status(401).json({ status: 'error', message: 'User not authenticated' });
    }

    try {
      const existing = await MaktabWeeklyReport.findOne({ teacher, isoWeek });
      if (existing) {
        cleanupUploadedFiles(req);
        return res.status(409).json({
          status: 'error',
          message: 'A report for this teacher and week already exists. Update it instead.',
        });
      }

      const report = await MaktabWeeklyReport.create({
        teacher,
        isoWeek: bounds.isoWeek,
        year: bounds.year,
        week: bounds.week,
        weekStart: bounds.weekStart,
        weekEnd: bounds.weekEnd,
        photos: files.map(mapFileToPhoto),
        note: typeof req.body.note === 'string' ? req.body.note.trim() : '',
        uploadedBy: userId,
      });

      return res.status(201).json({
        status: 'success',
        message: 'Weekly report published',
        data: { report: serializeReport(report) },
      });
    } catch (error: any) {
      cleanupUploadedFiles(req);
      if (error?.code === 11000) {
        return res.status(409).json({
          status: 'error',
          message: 'A report for this teacher and week already exists. Update it instead.',
        });
      }
      console.error('Create maktab weekly report error:', error);
      return res.status(500).json({ status: 'error', message: 'Failed to publish weekly report' });
    }
  }
);

/**
 * @route   PUT /api/maktab/weekly-reports/:id
 * @desc    Update note and photos for a weekly register
 * @access  Private (Admin / Manager)
 */
router.put(
  '/weekly-reports/:id',
  authMiddleware,
  adminMiddleware,
  wrapWeeklyUpload(weeklyUpload.array('photos', MAX_WEEKLY_PHOTOS)),
  body('note').optional({ checkFalsy: true }).isLength({ max: 800 }).withMessage('Note cannot exceed 800 characters'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      cleanupUploadedFiles(req);
      return res.status(400).json({
        status: 'error',
        message: errors.array()[0]?.msg || 'Invalid weekly report',
        errors: errors.array(),
      });
    }

    const id = getSingleParam(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      cleanupUploadedFiles(req);
      return res.status(400).json({ status: 'error', message: 'Invalid report id' });
    }

    const removeIndexes = parseRemoveIndexes(req.body.removeIndexes);
    if (removeIndexes === null) {
      cleanupUploadedFiles(req);
      return res.status(400).json({ status: 'error', message: 'removeIndexes must be a JSON array of indexes' });
    }

    try {
      const report = await MaktabWeeklyReport.findById(id);
      if (!report) {
        cleanupUploadedFiles(req);
        return res.status(404).json({ status: 'error', message: 'Weekly report not found' });
      }

      const removed = report.photos.filter((_, index) => removeIndexes.includes(index));
      const kept = report.photos.filter((_, index) => !removeIndexes.includes(index));
      const added = uploadedFiles(req).map(mapFileToPhoto);
      const nextPhotos = [...kept, ...added];

      if (nextPhotos.length < 1) {
        cleanupUploadedFiles(req);
        return res.status(400).json({ status: 'error', message: 'A weekly report must keep at least one photo' });
      }
      if (nextPhotos.length > MAX_WEEKLY_PHOTOS) {
        cleanupUploadedFiles(req);
        return res.status(400).json({
          status: 'error',
          message: `A weekly report can include at most ${MAX_WEEKLY_PHOTOS} photos`,
        });
      }

      removed.forEach(unlinkPhoto);
      report.photos = nextPhotos;
      if (req.body.note !== undefined) {
        report.note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
      }
      await report.save();

      return res.json({
        status: 'success',
        message: 'Weekly report updated',
        data: { report: serializeReport(report) },
      });
    } catch (error) {
      cleanupUploadedFiles(req);
      console.error('Update maktab weekly report error:', error);
      return res.status(500).json({ status: 'error', message: 'Failed to update weekly report' });
    }
  }
);

/**
 * @route   DELETE /api/maktab/weekly-reports/:id
 * @desc    Delete a weekly register and its photos
 * @access  Private (Admin / Manager)
 */
router.delete(
  '/weekly-reports/:id',
  authMiddleware,
  adminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const id = getSingleParam(req.params.id);
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ status: 'error', message: 'Invalid report id' });
      }

      const report = await MaktabWeeklyReport.findById(id);
      if (!report) {
        return res.status(404).json({ status: 'error', message: 'Weekly report not found' });
      }

      report.photos.forEach(unlinkPhoto);
      await report.deleteOne();

      return res.json({
        status: 'success',
        message: 'Weekly report deleted',
      });
    } catch (error) {
      console.error('Delete maktab weekly report error:', error);
      return res.status(500).json({ status: 'error', message: 'Failed to delete weekly report' });
    }
  }
);

export default router;
