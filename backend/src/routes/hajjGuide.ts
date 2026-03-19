import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

const HAJJ_GUIDE_DIRECTORY = path.resolve(__dirname, '..', 'assets', 'hajj-guide');
const GUIDE_IMAGE_PATTERN = /\.(jpg|jpeg|png|webp)$/i;

const getGuideImageFiles = (): string[] => {
  if (!fs.existsSync(HAJJ_GUIDE_DIRECTORY)) {
    return [];
  }

  return fs
    .readdirSync(HAJJ_GUIDE_DIRECTORY)
    .filter((fileName) => GUIDE_IMAGE_PATTERN.test(fileName))
    .sort((firstFile, secondFile) =>
      firstFile.localeCompare(secondFile, undefined, { numeric: true, sensitivity: 'base' })
    );
};

router.get('/pages', (_req: Request, res: Response) => {
  const imageFiles = getGuideImageFiles();

  if (imageFiles.length === 0) {
    return res.status(500).json({
      status: 'error',
      message: 'Hajj guide images are not available right now.',
    });
  }

  return res.json({
    status: 'success',
    data: {
      totalPages: imageFiles.length,
      pages: imageFiles.map((fileName, index) => ({
        pageNumber: index + 1,
        fileName,
        url: `/api/hajj-guide/images/${encodeURIComponent(fileName)}`,
      })),
    },
  });
});

router.use(
  '/images',
  express.static(HAJJ_GUIDE_DIRECTORY, {
    fallthrough: false,
    immutable: true,
    index: false,
    maxAge: '30d',
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    },
  })
);

router.use('/images', (_req: Request, res: Response) => {
  return res.status(404).json({
    status: 'error',
    message: 'Hajj guide image not found.',
  });
});

export default router;
