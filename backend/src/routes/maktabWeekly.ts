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
import { resolveUploadFilesystemPath } from '../utils/uploads';
import {
  createObjectKey,
  deleteStoredObject,
  getPrivateObjectUrl,
  parseStoredObjectRef,
  uploadObject,
} from '../services/objectStorage';

const router = express.Router();

const MAX_WEEKLY_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_WEEKLY_PHOTOS = 8;

const getFilesystemPath = (urlPath: string): string => resolveUploadFilesystemPath(urlPath);

const weeklyUpload = multer({
  storage: multer.memoryStorage(),
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

const deletePhotoQuietly = async (storedValue?: string | null): Promise<void> => {
  try {
    await deleteStoredObject(storedValue);
  } catch (error) {
    console.warn('Failed to remove weekly report photo:', (error as Error).message);
  }
};

const cleanupPhotos = async (photos: Array<Pick<IMaktabWeeklyPhoto, 'url'>>): Promise<void> => {
  await Promise.all(photos.map((photo) => deletePhotoQuietly(photo.url)));
};

const uploadFileAsPhoto = async (file: Express.Multer.File): Promise<IMaktabWeeklyPhoto> => ({
  url: await uploadObject({
    visibility: 'private',
    key: createObjectKey('maktab/weekly', file.originalname),
    body: file.buffer,
    contentType: file.mimetype,
    originalName: file.originalname,
  }),
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
 * @desc    Return a short-lived private register photo URL
 * @access  Private (Admin / Manager)
 */
router.get(
  '/weekly-reports/:id/photos/:index',
  authMiddleware,
  adminMiddleware,
  async (req: Request, res: Response) => {
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

    const storedRef = parseStoredObjectRef(photo.url);
    if (storedRef) {
      const signedUrl = await getPrivateObjectUrl(photo.url, {
        fileName: photo.name,
        contentType: photo.mimeType || 'image/jpeg',
        expiresIn: 300,
      });
      if (!signedUrl) {
        return res.status(404).json({ status: 'error', message: 'Photo file is missing' });
      }
      return res.json({ status: 'success', data: { url: signedUrl } });
    }

    const diskPath = getFilesystemPath(photo.url);
    if (!fs.existsSync(diskPath)) {
      return res.status(404).json({ status: 'error', message: 'Photo file is missing' });
    }

    return res.json({ status: 'success', data: { url: photo.url } });
  } catch (error) {
    console.error('Stream maktab weekly photo error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to load photo' });
  }
  }
);

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
    let uploadedPhotos: IMaktabWeeklyPhoto[] = [];
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: errors.array()[0]?.msg || 'Invalid weekly report',
        errors: errors.array(),
      });
    }

    const teacher = String(req.body.teacher);
    const isoWeek = String(req.body.isoWeek);
    if (!isMaktabTeacherSlug(teacher)) {
      return res.status(400).json({ status: 'error', message: 'Unknown teacher' });
    }

    const bounds = getIsoWeekBounds(isoWeek);
    if (!bounds) {
      return res.status(400).json({ status: 'error', message: 'Invalid ISO week' });
    }

    const files = uploadedFiles(req);
    if (files.length < 1) {
      return res.status(400).json({ status: 'error', message: 'Upload at least one register photo' });
    }

    const userId = (req as Request & { user?: { userId?: string } }).user?.userId;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'User not authenticated' });
    }

    try {
      const existing = await MaktabWeeklyReport.findOne({ teacher, isoWeek });
      if (existing) {
        return res.status(409).json({
          status: 'error',
          message: 'A report for this teacher and week already exists. Update it instead.',
        });
      }

      for (const file of files) {
        uploadedPhotos.push(await uploadFileAsPhoto(file));
      }
      const report = await MaktabWeeklyReport.create({
        teacher,
        isoWeek: bounds.isoWeek,
        year: bounds.year,
        week: bounds.week,
        weekStart: bounds.weekStart,
        weekEnd: bounds.weekEnd,
        photos: uploadedPhotos,
        note: typeof req.body.note === 'string' ? req.body.note.trim() : '',
        uploadedBy: userId,
      });
      uploadedPhotos = [];

      return res.status(201).json({
        status: 'success',
        message: 'Weekly report published',
        data: { report: serializeReport(report) },
      });
    } catch (error: any) {
      await cleanupPhotos(uploadedPhotos);
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
    let uploadedPhotos: IMaktabWeeklyPhoto[] = [];
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: errors.array()[0]?.msg || 'Invalid weekly report',
        errors: errors.array(),
      });
    }

    const id = getSingleParam(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid report id' });
    }

    const removeIndexes = parseRemoveIndexes(req.body.removeIndexes);
    if (removeIndexes === null) {
      return res.status(400).json({ status: 'error', message: 'removeIndexes must be a JSON array of indexes' });
    }

    try {
      const report = await MaktabWeeklyReport.findById(id);
      if (!report) {
        return res.status(404).json({ status: 'error', message: 'Weekly report not found' });
      }

      const removed = report.photos.filter((_, index) => removeIndexes.includes(index));
      const kept = report.photos.filter((_, index) => !removeIndexes.includes(index));
      const files = uploadedFiles(req);
      const nextPhotoCount = kept.length + files.length;

      if (nextPhotoCount < 1) {
        return res.status(400).json({ status: 'error', message: 'A weekly report must keep at least one photo' });
      }
      if (nextPhotoCount > MAX_WEEKLY_PHOTOS) {
        return res.status(400).json({
          status: 'error',
          message: `A weekly report can include at most ${MAX_WEEKLY_PHOTOS} photos`,
        });
      }

      for (const file of files) {
        uploadedPhotos.push(await uploadFileAsPhoto(file));
      }
      report.photos = [...kept, ...uploadedPhotos];
      if (req.body.note !== undefined) {
        report.note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
      }
      await report.save();
      uploadedPhotos = [];
      await cleanupPhotos(removed);

      return res.json({
        status: 'success',
        message: 'Weekly report updated',
        data: { report: serializeReport(report) },
      });
    } catch (error) {
      await cleanupPhotos(uploadedPhotos);
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

      const photosToDelete = [...report.photos];
      await report.deleteOne();
      await cleanupPhotos(photosToDelete);

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
