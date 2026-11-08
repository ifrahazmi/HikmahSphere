import express, { Request, Response } from 'express';
import { param, validationResult } from 'express-validator';
import { checkHalalApiKeyStatus, getProductByBarcode } from '../services/halalVerifier';

const router = express.Router();

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await checkHalalApiKeyStatus();
    return res.json({ status: 'success', data: status });
  } catch {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve HalalCheck RapidAPI status',
    });
  }
});

router.get(
  '/product/:barcode',
  param('barcode')
    .trim()
    .matches(/^\d{8,14}$/)
    .withMessage('Barcode must contain 8 to 14 digits'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: errors.array()[0]?.msg || 'Invalid barcode' });
    }

    try {
      const barcode = typeof req.params.barcode === 'string' ? req.params.barcode : '';
      const product = await getProductByBarcode(barcode);
      if (!product) {
        return res.status(404).json({
          status: 'error',
          message: 'This barcode was not found in OpenFoodFacts.',
        });
      }

      return res.json({ status: 'success', data: product });
    } catch (error) {
      console.error('Halal product lookup failed:', error);
      return res.status(502).json({
        status: 'error',
        message: 'The product database is temporarily unavailable. Please try again.',
      });
    }
  }
);

export default router;
