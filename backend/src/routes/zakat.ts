import express from 'express';
import { body, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import { authMiddleware, optionalAuthMiddleware, adminMiddleware } from '../middleware/auth';
import ZakatPayment from '../models/ZakatPayment';
import Donor, { IDonor } from '../models/Donor';
import User from '../models/User';
import { logUserActivity } from '../middleware/activityLogger';
import {
  isoToLocalDate,
  MAX_IMPORT_ROWS,
  normalizeZakatFileRow,
  normalizeZakatImportInput,
  parseImportRows,
  summarizePreviewRows,
  type ZakatPreviewRow,
} from '../utils/fundsImport';
import {
  createObjectKey,
  deleteStoredObject,
  getPrivateObjectUrl,
  parseStoredObjectRef,
  uploadObject,
} from '../services/objectStorage';

// Type assertions for static methods
const ZakatPaymentModel = ZakatPayment as typeof ZakatPayment & {
  hasDuplicateRefId: (refId: string, paymentMethod: string, excludeId?: string) => Promise<boolean>;
  getTotals: () => Promise<{ totalCollected: number; totalSpent: number; currentBalance: number }>;
  getTotalsByPurpose: () => Promise<{
    zakat: { collected: number; spent: number; currentBalance: number };
    sadaqah: { collected: number; spent: number; currentBalance: number };
  }>;
  getDonorSummary: () => Promise<Array<{
    rank: number;
    donorId: string | null;
    donorName: string;
    donorType: string;
    totalContributed: number;
    donationsCount: number;
  }>>;
};

const DonorModel = Donor as typeof Donor & {
  findOrCreateDonor: (
    name: string,
    type: 'Individual' | 'Organization' | 'Charity',
    contact?: { phone?: string; email?: string; address?: string }
  ) => Promise<IDonor>;
  searchDonors: (searchTerm: string, limit?: number) => Promise<IDonor[]>;
};

const router = express.Router();

// Multer Storage for Zakat Proofs
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpeg, jpg, png) and PDFs are allowed'));
  }
});

const uploadProof = (file: Express.Multer.File): Promise<string> =>
  uploadObject({
    visibility: 'private',
    key: createObjectKey('zakat/proofs', file.originalname),
    body: file.buffer,
    contentType: file.mimetype,
    originalName: file.originalname,
  });

const deleteProofQuietly = async (storedValue?: string | null): Promise<void> => {
  try {
    await deleteStoredObject(storedValue);
  } catch (error) {
    console.warn('Failed to delete Zakat proof:', (error as Error).message);
  }
};

// In-memory upload used for bulk import files (CSV / Excel / JSON)
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// ==================== ZAKAT CALCULATION ====================
const ZAKAT_RATES = {
  NISAB_GOLD_GRAMS: 85,
  NISAB_SILVER_GRAMS: 595,
  NISAB_GOLD_GRAMS_CLASSICAL: 87.48,
  NISAB_SILVER_GRAMS_CLASSICAL: 612.36,
  ZAKAT_RATE: 0.025,
};

const ISLAMIC_API_KEY = process.env.ISLAMIC_API_KEY || '';

// Actual islamicapi.com response shape:
// { code, status, calculation_standard, currency, weight_unit, updated_at, data: { nisab_thresholds: { gold, silver } } }
interface NisabApiResponse {
  code: number;
  status: string;
  calculation_standard?: string;
  currency: string;       // top-level
  weight_unit: string;    // top-level
  updated_at: string;     // top-level
  data: {
    nisab_thresholds: {
      gold: { weight: number; unit_price: number; nisab_amount: number };
      silver: { weight: number; unit_price: number; nisab_amount: number };
    };
  };
  message?: string;
}

interface FxApiResponse {
  result?: string;
  rates?: Record<string, number>;
}

const fetchFallbackNisabData = async (standard: 'classical' | 'common' = 'common', currency: string = 'inr') => {
  try {
    const [goldRes, silverRes, fxRes] = await Promise.all([
      fetch('https://api.gold-api.com/price/XAU'),
      fetch('https://api.gold-api.com/price/XAG'),
      fetch('https://open.er-api.com/v6/latest/USD'),
    ]);

    const [goldData, silverData, fxData] = await Promise.all([
      goldRes.json() as Promise<{ price?: number; updatedAt?: string }>,
      silverRes.json() as Promise<{ price?: number; updatedAt?: string }>,
      fxRes.json() as Promise<FxApiResponse>,
    ]);

    const goldPerOunceUsd = Number(goldData?.price);
    const silverPerOunceUsd = Number(silverData?.price);
    const targetCurrency = currency.toUpperCase();
    const fxRate = targetCurrency === 'USD' ? 1 : Number(fxData?.rates?.[targetCurrency]);

    if (
      !Number.isFinite(goldPerOunceUsd) ||
      !Number.isFinite(silverPerOunceUsd) ||
      !Number.isFinite(fxRate) ||
      fxRate <= 0
    ) {
      return { success: false, error: 'Fallback provider returned invalid market rates' };
    }

    // 1 troy ounce = 31.1034768 grams
    const goldUnitPrice = (goldPerOunceUsd / 31.1034768) * fxRate;
    const silverUnitPrice = (silverPerOunceUsd / 31.1034768) * fxRate;

    const goldWeight = standard === 'classical' ? ZAKAT_RATES.NISAB_GOLD_GRAMS_CLASSICAL : ZAKAT_RATES.NISAB_GOLD_GRAMS;
    const silverWeight = standard === 'classical' ? ZAKAT_RATES.NISAB_SILVER_GRAMS_CLASSICAL : ZAKAT_RATES.NISAB_SILVER_GRAMS;

    return {
      success: true,
      data: {
        gold: {
          weight: goldWeight,
          unitPrice: goldUnitPrice,
          nisabAmount: goldWeight * goldUnitPrice,
        },
        silver: {
          weight: silverWeight,
          unitPrice: silverUnitPrice,
          nisabAmount: silverWeight * silverUnitPrice,
        },
        currency: currency.toLowerCase(),
        weightUnit: 'gram',
        updatedAt: goldData?.updatedAt || new Date().toISOString(),
        source: 'Fallback live market feed',
      },
    };
  } catch (error) {
    console.error('Fallback Nisab API Error:', error);
    return { success: false, error: 'Unable to fetch fallback live nisab values' };
  }
};

const fetchNisabData = async (standard: 'classical' | 'common' = 'common', currency: string = 'inr') => {
  try {
    const url = `https://islamicapi.com/api/v1/zakat-nisab/?standard=${standard}&currency=${currency}&unit=g&api_key=${ISLAMIC_API_KEY}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`⚠️ IslamicAPI nisab returned HTTP ${response.status} — falling back to market feed`);
      return { success: false, error: `IslamicAPI returned ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.warn(`⚠️ IslamicAPI nisab returned non-JSON content-type (${contentType}) — falling back`);
      return { success: false, error: 'IslamicAPI returned non-JSON response' };
    }

    const data = await response.json() as NisabApiResponse;

    if (data.status === 'success') {
      return {
        success: true,
        data: {
          gold: {
            weight: data.data.nisab_thresholds.gold.weight,
            unitPrice: data.data.nisab_thresholds.gold.unit_price,
            nisabAmount: data.data.nisab_thresholds.gold.nisab_amount,
          },
          silver: {
            weight: data.data.nisab_thresholds.silver.weight,
            unitPrice: data.data.nisab_thresholds.silver.unit_price,
            nisabAmount: data.data.nisab_thresholds.silver.nisab_amount,
          },
          // currency, weight_unit, updated_at are at the TOP level of the response
          currency: data.currency,
          weightUnit: data.weight_unit,
          updatedAt: data.updated_at,
          source: 'islamicapi.com',
        }
      };
    }
    return { success: false, error: data.message || 'Failed to fetch nisab data' };
  } catch (error) {
    console.error('Nisab API Error:', error);
    return { success: false, error: 'Unable to fetch live nisab values' };
  }
};

router.get('/nisab-live', [
  query('standard').optional().isIn(['classical', 'common']),
  query('currency').optional().isString().trim().isLength({ min: 3, max: 3 }),
], optionalAuthMiddleware, async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const standard = (req.query.standard as 'classical' | 'common') || 'common';
    const currency = ((req.query.currency as string) || 'inr').toLowerCase();

    // PRIMARY: islamicapi.com/api/v1/zakat-nisab
    console.log('🕌 Fetching Nisab from islamicapi.com (primary)...');
    const primary = await fetchNisabData(standard, currency);
    if (primary.success && primary.data) {
      console.log('✅ islamicapi.com Nisab data received');
      return res.json({ status: 'success', data: primary.data });
    }

    // FALLBACK 1: market feed (gold-api.com + open.er-api.com)
    console.warn(`⚠️ islamicapi.com Nisab failed (${primary.error}) — using market feed fallback`);
    const fallback = await fetchFallbackNisabData(standard, currency);
    if (fallback.success && fallback.data) {
      console.log('✅ Market feed fallback Nisab data received');
      return res.json({ status: 'success', data: fallback.data });
    }

    // FALLBACK 2: static hardcoded rates (last resort — always shows the section)
    console.warn(`⚠️ Market feed also failed (${fallback.error}) — using static rates`);
    const goldWeight = standard === 'classical' ? ZAKAT_RATES.NISAB_GOLD_GRAMS_CLASSICAL : ZAKAT_RATES.NISAB_GOLD_GRAMS;
    const silverWeight = standard === 'classical' ? ZAKAT_RATES.NISAB_SILVER_GRAMS_CLASSICAL : ZAKAT_RATES.NISAB_SILVER_GRAMS;
    // Approximate rates per gram (USD base, shown as-is for INR display)
    const STATIC_GOLD_PER_GRAM_USD = 90;   // ~$90/g (approximate 2025/26)
    const STATIC_SILVER_PER_GRAM_USD = 1;  // ~$1/g
    const FX: Record<string, number> = { inr: 84, usd: 1, gbp: 0.79, eur: 0.92, sar: 3.75, aed: 3.67 };
    const fx = FX[currency.toLowerCase()] ?? 84;
    const goldUnitPrice = STATIC_GOLD_PER_GRAM_USD * fx;
    const silverUnitPrice = STATIC_SILVER_PER_GRAM_USD * fx;
    return res.json({
      status: 'success',
      data: {
        gold: {
          weight: goldWeight,
          unitPrice: goldUnitPrice,
          nisabAmount: goldWeight * goldUnitPrice,
        },
        silver: {
          weight: silverWeight,
          unitPrice: silverUnitPrice,
          nisabAmount: silverWeight * silverUnitPrice,
        },
        currency: currency.toLowerCase(),
        weightUnit: 'gram',
        updatedAt: new Date().toISOString(),
        source: 'Static rates (live feed unavailable)',
      },
    });
  } catch (error: any) {
    console.error('Live Nisab route error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch live nisab values' });
  }
});

const convertWeightToValue = (weight: number, unitPrice: number, weightUnit: string, inputUnit: string): number => {
  let weightInGrams = weight;
  if (inputUnit === 'oz') {
    weightInGrams = weight * 31.1035;
  }
  if (weightUnit === 'gram') {
    return weightInGrams * unitPrice;
  }
  return weightInGrams * unitPrice;
};

router.post('/calculate', [
  body('cash').optional().isFloat({ min: 0 }),
], optionalAuthMiddleware, async (req: any, res: any) => {
  try {
    const {
      cash = 0,
      goldValue = 0,
      goldWeight = 0,
      goldWeightUnit = 'g',
      silverValue = 0,
      silverWeight = 0,
      silverWeightUnit = 'g',
      investments = 0,
      businessAssets = 0,
      receivables = 0,
      cryptocurrency = 0,
      other = 0,
      managedZakat = 0,
      personalDebts = 0,
      businessDebts = 0,
      immediateExpenses = 0,
      calculationStandard = 'common',
      currency = 'inr',
    } = req.body;

    // PRIMARY: islamicapi.com | FALLBACK 1: market feed | FALLBACK 2: static rates
    console.log('🕌 Fetching Nisab for Zakat calculation from islamicapi.com (primary)...');
    let nisabResult = await fetchNisabData(calculationStandard, currency);
    if (!nisabResult.success) {
      console.warn(`⚠️ islamicapi.com Nisab failed (${nisabResult.error}) — falling back to market feed`);
      nisabResult = await fetchFallbackNisabData(calculationStandard, currency);
    } else {
      console.log('✅ islamicapi.com Nisab data used for calculation');
    }

    let goldUnitPrice = 0;
    let silverUnitPrice = 0;
    let weightUnit = 'gram';
    let nisabGoldAmount = 0;
    let nisabSilverAmount = 0;

    if (nisabResult.success && nisabResult.data) {
      goldUnitPrice = nisabResult.data.gold.unitPrice;
      silverUnitPrice = nisabResult.data.silver.unitPrice;
      weightUnit = nisabResult.data.weightUnit || 'gram';
      nisabGoldAmount = nisabResult.data.gold.nisabAmount;
      nisabSilverAmount = nisabResult.data.silver.nisabAmount;
    } else {
      // Static fallback so calculation always works
      console.warn('⚠️ All Nisab feeds failed — using static rates for calculation');
      const FX: Record<string, number> = { inr: 84, usd: 1, gbp: 0.79, eur: 0.92, sar: 3.75, aed: 3.67 };
      const fx = FX[(currency || 'inr').toLowerCase()] ?? 84;
      goldUnitPrice = 90 * fx;
      silverUnitPrice = 1 * fx;
      weightUnit = 'gram';
      const gw = calculationStandard === 'classical' ? ZAKAT_RATES.NISAB_GOLD_GRAMS_CLASSICAL : ZAKAT_RATES.NISAB_GOLD_GRAMS;
      const sw = calculationStandard === 'classical' ? ZAKAT_RATES.NISAB_SILVER_GRAMS_CLASSICAL : ZAKAT_RATES.NISAB_SILVER_GRAMS;
      nisabGoldAmount = gw * goldUnitPrice;
      nisabSilverAmount = sw * silverUnitPrice;
    }

    let finalGoldValue = parseFloat(goldValue);
    if (goldWeight > 0 && goldUnitPrice > 0) {
      finalGoldValue = convertWeightToValue(parseFloat(goldWeight), goldUnitPrice, weightUnit, goldWeightUnit);
    }

    let finalSilverValue = parseFloat(silverValue);
    if (silverWeight > 0 && silverUnitPrice > 0) {
      finalSilverValue = convertWeightToValue(parseFloat(silverWeight), silverUnitPrice, weightUnit, silverWeightUnit);
    }

    const breakdown = {
      cash: parseFloat(cash),
      gold: finalGoldValue,
      goldWeight: goldWeight > 0 ? { weight: parseFloat(goldWeight), unit: goldWeightUnit } : null,
      silver: finalSilverValue,
      silverWeight: silverWeight > 0 ? { weight: parseFloat(silverWeight), unit: silverWeightUnit } : null,
      investments: parseFloat(investments),
      businessAssets: parseFloat(businessAssets),
      receivables: parseFloat(receivables),
      cryptocurrency: parseFloat(cryptocurrency),
      other: parseFloat(other),
      managedZakat: parseFloat(managedZakat),
    };

    const deductions = {
      personalDebts: parseFloat(personalDebts),
      businessDebts: parseFloat(businessDebts),
      immediateExpenses: parseFloat(immediateExpenses),
    };

    const totalAssets = cash + finalGoldValue + finalSilverValue + investments +
      businessAssets + receivables + cryptocurrency + other + managedZakat;

    const totalDeductions = Object.values(deductions).reduce((sum, value) => sum + value, 0);
    const totalWealth = totalAssets - totalDeductions;

    const nisabValue = nisabGoldAmount;
    const isEligible = totalWealth >= nisabValue;
    const zakatDue = isEligible ? totalWealth * ZAKAT_RATES.ZAKAT_RATE : 0;

    const calculation = {
      totalWealth,
      nisabValue,
      zakatDue,
      isEligible,
      breakdown,
      deductions,
    };

    res.json({
      status: 'success',
      data: {
        calculation,
        nisabInfo: {
          gold: {
            grams: nisabResult.data?.gold.weight || ZAKAT_RATES.NISAB_GOLD_GRAMS,
            unitPrice: goldUnitPrice,
            value: nisabGoldAmount,
          },
          silver: {
            grams: nisabResult.data?.silver.weight || ZAKAT_RATES.NISAB_SILVER_GRAMS,
            unitPrice: silverUnitPrice,
            value: nisabSilverAmount,
          },
          currency,
          calculationStandard,
          weightUnit,
          updatedAt: nisabResult.data?.updatedAt,
        },
        livePricesUsed: nisabResult.success,
      },
    });
  } catch (error) {
    console.error('Zakat calculation error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to calculate Zakat' });
  }
});

// ==================== DONOR SEARCH API ====================
/**
 * @route   GET /api/zakat/donors
 * @desc    Search donors with fuzzy matching for autocomplete
 * @access  Private (Admin/Manager)
 */
router.get('/donors', [
  authMiddleware,
  adminMiddleware,
  query('search').optional().isString().trim().notEmpty(),
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const searchTerm = req.query.search || '';
    const limit = parseInt(req.query.limit || '10', 10);

    if (!searchTerm || searchTerm.length < 1) {
      return res.json({
        status: 'success',
        data: { donors: [] }
      });
    }

    const donors = await DonorModel.searchDonors(searchTerm, limit);

    res.json({
      status: 'success',
      data: {
        donors: donors.map((d: IDonor) => ({
          id: d._id,
          name: d.name,
          type: d.type,
          contact: d.contact,
          totalDonated: d.totalDonated,
          donationCount: d.donationCount,
          lastDonationDate: d.lastDonationDate,
        }))
      }
    });
  } catch (error) {
    console.error('Donor search error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to search donors' });
  }
});

/**
 * @route   GET /api/zakat/donor/summary
 * @desc    Get donor summary with rankings
 * @access  Private (Admin/Manager)
 */
router.get('/donor/summary', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const summary = await ZakatPaymentModel.getDonorSummary();
    res.json({
      status: 'success',
      data: { summary }
    });
  } catch (error) {
    console.error('Donor summary error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get donor summary' });
  }
});

/**
 * @route   GET /api/zakat/donor/:id
 * @desc    Get single donor details with history
 * @access  Private (Admin/Manager)
 */
router.get('/donor/:id', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const donor = await Donor.findById(req.params.id);
    
    if (!donor) {
      return res.status(404).json({ status: 'error', message: 'Donor not found' });
    }

    const donations = await ZakatPayment.find({ donorId: donor._id, type: 'collection' })
      .sort({ paymentDate: -1 })
      .limit(10);

    res.json({
      status: 'success',
      data: {
        donor: {
          id: donor._id,
          name: donor.name,
          type: donor.type,
          contact: donor.contact,
          totalDonated: donor.totalDonated,
          donationCount: donor.donationCount,
          lastDonationDate: donor.lastDonationDate,
        },
        recentDonations: donations
      }
    });
  } catch (error: any) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ status: 'error', message: 'Invalid donor ID' });
    }
    res.status(500).json({ status: 'error', message: 'Failed to get donor details' });
  }
});

// ==================== ZAKAT TRANSACTION ROUTES ====================
/**
 * @route   POST /api/zakat/transaction
 * @desc    Record a Zakat transaction (Collection or Spending)
 * @access  Private (Admin/Manager)
 */
router.post('/transaction', [
  authMiddleware,
  adminMiddleware,
  upload.single('proofOfPayment'),
  body('type').isIn(['collection', 'spending']).withMessage('Invalid transaction type'),
  body('purpose').optional().isIn(['Zakat', 'Sadaqah']).withMessage('Invalid purpose'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('paymentMethod').isIn(['Bank Transfer', 'UPI Transfer', 'Cash', 'Cheque', 'QR Scanner'])
    .withMessage('Invalid payment method'),
  body('donorType').optional().isIn(['Individual', 'Organization', 'Charity']),
  body('recipientType').optional().isIn(['Individual', 'Family', 'Mosque', 'Madrasa', 'NGO', 'Other']),
], async (req: any, res: any) => {
  let uploadedProof: string | undefined;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const {
      type,
      purpose = 'Zakat',
      donorId,
      donorName,
      donorType,
      recipientName,
      recipientType,
      amount,
      paymentDate,
      paymentMethod,
      transactionRefId,
      bankName,
      senderUpiId,
      chequeNumber,
      notes,
    } = req.body;

    // Custom validation based on transaction type
    if (type === 'collection') {
      if (!donorName || donorName.trim() === '') {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Donor Name is required for collections' 
        });
      }
    } else if (type === 'spending') {
      if (!recipientName || recipientName.trim() === '') {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Recipient Name is required for distributions' 
        });
      }
      if (!recipientType) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Recipient Type is required for distributions' 
        });
      }
    }

    // Validate payment date is not in the future
    const payDate = new Date(paymentDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (payDate > today) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Payment date cannot be in the future' 
      });
    }

    // Payment method specific validation
    if (paymentMethod === 'Bank Transfer' && (!bankName || bankName.trim() === '')) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Bank Name is required for Bank Transfer' 
      });
    }

    if (paymentMethod === 'UPI Transfer' && (!senderUpiId || senderUpiId.trim() === '')) {
      return res.status(400).json({
        status: 'error',
        message: 'Sender UPI ID is required for UPI Transfer'
      });
    }

    // Validate UPI ID format (number@any)
    if (paymentMethod === 'UPI Transfer' && senderUpiId) {
      if (!/^\d+@[a-zA-Z]+$/.test(senderUpiId)) {
        return res.status(400).json({
          status: 'error',
          message: 'UPI ID must be in format: number@bank (e.g., 9876543210@oksbi)'
        });
      }
    }

    if (paymentMethod === 'Cheque' && (!chequeNumber || chequeNumber.trim() === '')) {
      return res.status(400).json({
        status: 'error',
        message: 'Cheque Number is required for Cheque payment'
      });
    }

    // Validate transaction ref ID (required, minimum 6 digits) for UPI Transfer and QR Scanner
    if (paymentMethod === 'UPI Transfer' || paymentMethod === 'QR Scanner') {
      if (!transactionRefId || !/^\d{6,}$/.test(transactionRefId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Transaction Ref ID is required (minimum 6 digits)'
        });
      }

      // Check for duplicate ref ID
      const isDuplicate = await ZakatPaymentModel.hasDuplicateRefId(transactionRefId, paymentMethod);
      if (isDuplicate) {
        return res.status(409).json({
          status: 'error',
          message: 'Duplicate Transaction Ref ID found for this payment method',
          code: 'DUPLICATE_REF_ID'
        });
      }
    }

    // Check balance for spending transactions
    if (type === 'spending') {
      const splitTotals = await ZakatPaymentModel.getTotalsByPurpose();
      const availableBalance = purpose === 'Sadaqah'
        ? splitTotals.sadaqah.currentBalance
        : splitTotals.zakat.currentBalance;
      const spendAmount = parseFloat(amount);

      if (spendAmount > availableBalance) {
        return res.status(400).json({ 
          status: 'error', 
          message: `Insufficient balance. Available: ₹${availableBalance.toLocaleString('en-IN')}, Requested: ₹${spendAmount.toLocaleString('en-IN')}`,
          code: 'INSUFFICIENT_BALANCE',
          data: { availableBalance, requestedAmount: spendAmount }
        });
      }
    }

    uploadedProof = req.file ? await uploadProof(req.file) : undefined;

    // Handle donor for collection transactions
    let finalDonorId = undefined;
    if (type === 'collection') {
      if (donorId) {
        const donor = await Donor.findById(donorId);
        if (donor) {
          donor.totalDonated += parseFloat(amount);
          donor.donationCount += 1;
          donor.lastDonationDate = payDate;
          await donor.save();
          finalDonorId = donor._id;
        }
      } else {
        const donor = await DonorModel.findOrCreateDonor(
          donorName.trim(),
          donorType || 'Individual'
        );
        donor.totalDonated += parseFloat(amount);
        donor.donationCount += 1;
        donor.lastDonationDate = payDate;
        await donor.save();
        finalDonorId = donor._id;
      }
    }

    // Create transaction
    const newTransaction = new ZakatPayment({
      userId: req.user.userId,
      type,
      purpose,
      donorId: finalDonorId,
      donorName: type === 'collection' ? donorName?.trim() : undefined,
      donorType: type === 'collection' ? donorType : undefined,
      recipientName: type === 'spending' ? recipientName?.trim() : undefined,
      recipientType: type === 'spending' ? recipientType : undefined,
      amount: parseFloat(amount),
      paymentDate: payDate,
      paymentMethod,
      transactionRefId: (paymentMethod !== 'Cash' && paymentMethod !== 'Cheque') ? transactionRefId : undefined,
      bankName: paymentMethod === 'Bank Transfer' ? bankName?.trim() : undefined,
      senderUpiId: paymentMethod === 'UPI Transfer' ? senderUpiId?.trim() : undefined,
      chequeNumber: paymentMethod === 'Cheque' ? chequeNumber?.trim() : undefined,
      proofFilePath: uploadedProof,
      notes: notes?.trim(),
      recordedBy: req.user.userId,
    });

    await newTransaction.save();
    uploadedProof = undefined;

    const updatedTotals = await ZakatPaymentModel.getTotals();

    // Log activity
    await logUserActivity(
      req,
      newTransaction.type === 'collection' ? 'zakat_collection_add' : 'zakat_spending_add',
      'zakat',
      `${newTransaction.purpose} ${newTransaction.type === 'collection' ? 'collection' : 'spending'} recorded: ₹${newTransaction.amount} by ${req.user.email}`,
      {
        transactionId: newTransaction._id,
        type: newTransaction.type,
        purpose: newTransaction.purpose,
        amount: newTransaction.amount,
        paymentMethod: newTransaction.paymentMethod,
      }
    );

    res.status(201).json({
      status: 'success',
      message: 'Transaction recorded successfully',
      data: { 
        transaction: newTransaction,
        totals: updatedTotals
      }
    });

  } catch (error: any) {
    console.error('Transaction error:', error);
    await deleteProofQuietly(uploadedProof);

    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        status: 'error', 
        message: error.message 
      });
    }

    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to record transaction' 
    });
  }
});

/**
 * @route   GET /api/zakat/stats
 * @desc    Get Zakat statistics (totals and balance)
 * @access  Private (Admin/Manager)
 */
router.get('/stats', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const totals = await ZakatPaymentModel.getTotals();

    res.json({
      status: 'success',
      data: totals
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get stats' });
  }
});

/**
 * @route   GET /api/zakat/stats/split
 * @desc    Get Zakat statistics split by purpose (Zakat vs Sadaqah)
 * @access  Private (Admin/Manager)
 */
router.get('/stats/split', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const splitTotals = await ZakatPaymentModel.getTotalsByPurpose();

    res.json({
      status: 'success',
      data: splitTotals,
    });
  } catch (error) {
    console.error('Get split stats error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get split stats' });
  }
});

const insertZakatPreviewRow = async (row: ZakatPreviewRow, userId: string) => {
  const paymentDate = isoToLocalDate(row.paymentDate);
  const amount = typeof row.amount === 'number' ? row.amount : 0;
  const doc: any = {
    userId,
    type: row.type,
    purpose: row.purpose || 'Zakat',
    amount,
    currency: 'INR',
    paymentDate,
    paymentMethod: row.paymentMethod,
    notes: row.notes || undefined,
    recordedBy: userId,
  };

  if (row.paymentMethod === 'Bank Transfer') {
    doc.bankName = row.bankName || 'Imported';
    if (row.transactionRefId) doc.transactionRefId = row.transactionRefId;
    if (row.senderUpiId) doc.senderUpiId = row.senderUpiId;
  } else if (row.paymentMethod === 'Cheque') {
    doc.chequeNumber = row.chequeNumber || row.transactionRefId || 'IMPORTED';
  } else if (row.paymentMethod === 'UPI Transfer' || row.paymentMethod === 'QR Scanner') {
    if (row.transactionRefId) doc.transactionRefId = row.transactionRefId;
    if (row.senderUpiId) doc.senderUpiId = row.senderUpiId;
  }

  if (row.type === 'collection') {
    const donorType = row.partyType || 'Individual';
    doc.donorName = row.partyName;
    doc.donorType = donorType;
    const donor = await DonorModel.findOrCreateDonor(row.partyName, donorType as any);
    donor.totalDonated += amount;
    donor.donationCount += 1;
    donor.lastDonationDate = paymentDate;
    await donor.save();
    doc.donorId = donor._id;
  } else {
    doc.recipientName = row.partyName;
    doc.recipientType = row.partyType || 'Other';
  }

  await new ZakatPayment(doc).save();
};

/**
 * @route   POST /api/zakat/import/preview
 * @desc    Parse a Zakat/Sadaqah import file without writing to the database
 * @access  Private (Admin/Manager)
 */
router.post('/import/preview', authMiddleware, adminMiddleware, importUpload.single('file'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    }

    let rawRows: any[];
    try {
      rawRows = parseImportRows(req.file);
    } catch (parseErr: any) {
      return res.status(400).json({ status: 'error', message: `Could not read file: ${parseErr.message}` });
    }

    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No rows found in the file' });
    }
    if (rawRows.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({
        status: 'error',
        message: `File has ${rawRows.length} rows. Import at most ${MAX_IMPORT_ROWS} at a time.`,
      });
    }

    const rows = rawRows.map((row, index) => normalizeZakatFileRow(row, index + 2));
    return res.json({
      status: 'success',
      data: {
        fileName: req.file.originalname,
        ...summarizePreviewRows(rows),
        rows,
      },
    });
  } catch (error: any) {
    console.error('Zakat import preview error:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Could not preview file' });
  }
});

/**
 * @route   POST /api/zakat/import/confirm
 * @desc    Insert previously previewed/edited Zakat/Sadaqah rows
 * @access  Private (Admin/Manager)
 */
router.post('/import/confirm', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const incoming = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (incoming.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No transactions to import' });
    }
    if (incoming.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot import more than ${MAX_IMPORT_ROWS} transactions at once`,
      });
    }

    const rows = incoming.map((row: any, index: number) =>
      normalizeZakatImportInput(row, Number(row?.rowNumber) || index + 1)
    );
    const invalid = rows.filter((row: ZakatPreviewRow) => row.errors.length > 0);
    if (invalid.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Fix or remove ${invalid.length} row${invalid.length === 1 ? '' : 's'} with errors before importing`,
        data: { rows: invalid.slice(0, 50) },
      });
    }

    for (const row of rows) {
      await insertZakatPreviewRow(row, req.user.userId);
    }

    await logUserActivity(
      req,
      'other',
      'zakat',
      `Imported ${rows.length} Zakat/Sadaqah transactions by ${req.user.email}`,
      { inserted: rows.length, total: rows.length }
    );

    return res.json({
      status: 'success',
      data: { inserted: rows.length, skipped: 0, total: rows.length },
    });
  } catch (error: any) {
    console.error('Zakat import confirm error:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Import failed' });
  }
});

/**
 * @route   GET /api/zakat/payments
 * @desc    Get all Zakat transactions with optional filtering
 * @access  Private (Admin/Manager)
 */
router.get('/payments', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const { type, purpose, limit = 100, page = 1 } = req.query;
    
    const query: any = {};
    if (type && ['collection', 'spending'].includes(type)) {
      query.type = type;
    }

    if (purpose && ['Zakat', 'Sadaqah'].includes(purpose)) {
      query.purpose = purpose;
    }

    const payments = await ZakatPayment.find(query)
      .populate('donorId', 'name type totalDonated')
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(parseInt(limit, 10))
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10));

    const total = await ZakatPayment.countDocuments(query);

    res.json({
      status: 'success',
      data: { 
        payments,
        pagination: {
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(total / parseInt(limit, 10))
        }
      },
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch transactions' });
  }
});

/**
 * @route   GET /api/zakat/payment/:id
 * @desc    Get single Zakat transaction
 * @access  Private (Admin/Manager)
 */
router.get('/payment/:id', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const payment = await ZakatPayment.findById(req.params.id)
      .populate('donorId', 'name type totalDonated donationCount contact');

    if (!payment) {
      return res.status(404).json({ status: 'error', message: 'Transaction not found' });
    }

    res.json({
      status: 'success',
      data: { payment }
    });
  } catch (error: any) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ status: 'error', message: 'Invalid transaction ID' });
    }
    res.status(500).json({ status: 'error', message: 'Server Error' });
  }
});

router.get('/payment/:id/proof-url', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const payment = await ZakatPayment.findById(req.params.id).select('proofFilePath');
    if (!payment?.proofFilePath) {
      return res.status(404).json({ status: 'error', message: 'Proof not found' });
    }

    const storedRef = parseStoredObjectRef(payment.proofFilePath);
    const url = storedRef
      ? await getPrivateObjectUrl(payment.proofFilePath, {
          fileName: path.basename(storedRef.key),
          expiresIn: 300,
        })
      : payment.proofFilePath.startsWith('/uploads/') || payment.proofFilePath.startsWith('/src/uploads/')
        ? payment.proofFilePath
        : null;

    if (!url) {
      return res.status(404).json({ status: 'error', message: 'Proof not found' });
    }
    return res.json({ status: 'success', data: { url } });
  } catch (error: any) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ status: 'error', message: 'Invalid transaction ID' });
    }
    console.error('Get Zakat proof URL error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to load proof' });
  }
});

/**
 * @route   PUT /api/zakat/payment/:id
 * @desc    Update a Zakat transaction
 * @access  Private (Admin/Manager)
 */
router.put('/payment/:id', [
  authMiddleware,
  adminMiddleware,
  upload.single('proofOfPayment'),
], async (req: any, res: any) => {
  let uploadedProof: string | undefined;
  try {
    const paymentId = req.params.id;
    const updates = req.body;

    const payment = await ZakatPayment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ status: 'error', message: 'Transaction not found' });
    }

    // Validate amount
    if (updates.amount) {
      const amount = parseFloat(updates.amount);
      if (amount <= 0) {
        return res.status(400).json({ status: 'error', message: 'Amount must be greater than 0' });
      }
      payment.amount = amount;
    }

    // Validate payment date
    if (updates.paymentDate) {
      const payDate = new Date(updates.paymentDate);
      if (payDate > new Date()) {
        return res.status(400).json({ status: 'error', message: 'Payment date cannot be in the future' });
      }
      payment.paymentDate = payDate;
    }

    // Update payment method specific fields
    if (updates.paymentMethod) {
      payment.paymentMethod = updates.paymentMethod;
    }

    if (updates.bankName) {
      payment.bankName = updates.bankName;
    }

    // Validate UPI ID format
    if (updates.senderUpiId) {
      if (!/^\d+@[a-zA-Z]+$/.test(updates.senderUpiId)) {
        return res.status(400).json({ status: 'error', message: 'UPI ID must be in format: number@bank (e.g., 9876543210@oksbi)' });
      }
      payment.senderUpiId = updates.senderUpiId;
    }

    if (updates.chequeNumber) {
      payment.chequeNumber = updates.chequeNumber;
    }

    // Validate transaction ref ID (required, minimum 6 digits) for UPI Transfer and QR Scanner
    const newMethod = updates.paymentMethod || payment.paymentMethod;
    if (newMethod === 'UPI Transfer' || newMethod === 'QR Scanner') {
      const newRefId = updates.transactionRefId || payment.transactionRefId;
      
      if (!newRefId || !/^\d{6,}$/.test(newRefId)) {
        return res.status(400).json({ status: 'error', message: 'Transaction Ref ID is required (minimum 6 digits)' });
      }

      const isDuplicate = await ZakatPaymentModel.hasDuplicateRefId(newRefId, newMethod, paymentId);
      if (isDuplicate) {
        return res.status(409).json({
          status: 'error',
          message: 'Duplicate Transaction Ref ID found for this payment method',
          code: 'DUPLICATE_REF_ID'
        });
      }
      payment.transactionRefId = newRefId;
    }

    // Update other fields
    if (updates.type) payment.type = updates.type;
    if (updates.purpose && ['Zakat', 'Sadaqah'].includes(updates.purpose)) payment.purpose = updates.purpose;
    if (updates.donorName) payment.donorName = updates.donorName;
    if (updates.donorType) payment.donorType = updates.donorType;
    if (updates.recipientName) payment.recipientName = updates.recipientName;
    if (updates.recipientType) payment.recipientType = updates.recipientType;
    if (updates.notes !== undefined) payment.notes = updates.notes;

    const previousProof = payment.proofFilePath;
    if (req.file) {
      uploadedProof = await uploadProof(req.file);
      payment.proofFilePath = uploadedProof;
    } else if (updates.removeProof === 'true') {
      payment.proofFilePath = undefined as any;
    }

    const updatedPayment = await payment.save();
    uploadedProof = undefined;
    if (previousProof && previousProof !== payment.proofFilePath) {
      await deleteProofQuietly(previousProof);
    }
    const updatedTotals = await ZakatPaymentModel.getTotals();

    res.json({ 
      status: 'success', 
      data: { 
        payment: updatedPayment,
        totals: updatedTotals
      } 
    });

  } catch (error: any) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ status: 'error', message: 'Invalid transaction ID' });
    }
    
    await deleteProofQuietly(uploadedProof);

    console.error('Update payment error:', error);
    res.status(500).json({ status: 'error', message: 'Server Error' });
  }
});

const parseBulkDeleteIds = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const id = value.trim();
    if (mongoose.Types.ObjectId.isValid(id)) unique.add(id);
  }
  return Array.from(unique);
};

/**
 * @route   POST /api/zakat/payments/bulk-delete
 * @desc    Delete multiple Zakat transactions at once
 * @access  Private (Super Admin only)
 */
router.post('/payments/bulk-delete', authMiddleware, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || (user.role !== 'superadmin' && !user.isAdmin)) {
      return res.status(403).json({ status: 'error', message: 'Access denied. Admin only.' });
    }

    const ids = parseBulkDeleteIds(req.body?.ids);
    if (ids.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Select at least one valid transaction' });
    }
    if (ids.length > 500) {
      return res.status(400).json({ status: 'error', message: 'Cannot delete more than 500 transactions at once' });
    }

    const payments = await ZakatPayment.find({ _id: { $in: ids } });
    if (payments.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No matching transactions found' });
    }

    const donorDeltas = new Map<string, { amount: number; count: number }>();
    const proofs: string[] = [];

    for (const payment of payments) {
      if (payment.proofFilePath) proofs.push(payment.proofFilePath);
      if (payment.type === 'collection' && payment.donorId) {
        const key = payment.donorId.toString();
        const prev = donorDeltas.get(key) || { amount: 0, count: 0 };
        donorDeltas.set(key, { amount: prev.amount + payment.amount, count: prev.count + 1 });
      }
    }

    await ZakatPayment.deleteMany({ _id: { $in: payments.map((p) => p._id) } });

    for (const [donorId, delta] of donorDeltas) {
      const donor = await Donor.findById(donorId);
      if (!donor) continue;
      const remainingDonations = Math.max(0, donor.donationCount - delta.count);
      if (remainingDonations === 0) {
        await Donor.findByIdAndDelete(donor._id);
      } else {
        donor.totalDonated = Math.max(0, donor.totalDonated - delta.amount);
        donor.donationCount = remainingDonations;
        await donor.save();
      }
    }

    await Promise.all(proofs.map((proof) => deleteProofQuietly(proof)));

    const updatedTotals = await ZakatPaymentModel.getTotals();

    res.json({
      status: 'success',
      message: `${payments.length} transaction${payments.length === 1 ? '' : 's'} deleted successfully`,
      data: { deletedCount: payments.length, totals: updatedTotals },
    });
  } catch (error) {
    console.error('Bulk delete zakat payments error:', error);
    res.status(500).json({ status: 'error', message: 'Server Error' });
  }
});

/**
 * @route   DELETE /api/zakat/payment/:id
 * @desc    Delete a Zakat transaction
 * @access  Private (Super Admin only)
 */
router.delete('/payment/:id', authMiddleware, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || (user.role !== 'superadmin' && !user.isAdmin)) {
      return res.status(403).json({ status: 'error', message: 'Access denied. Admin only.' });
    }

    const payment = await ZakatPayment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ status: 'error', message: 'Transaction not found' });
    }

    const proofToDelete = payment.proofFilePath;

    if (payment.type === 'collection' && payment.donorId) {
      const donor = await Donor.findById(payment.donorId);
      if (donor) {
        const remainingDonations = Math.max(0, donor.donationCount - 1);

        if (remainingDonations === 0) {
          // No donations left — delete the donor entirely so they
          // no longer appear in autocomplete suggestions
          await Donor.findByIdAndDelete(donor._id);
        } else {
          donor.totalDonated = Math.max(0, donor.totalDonated - payment.amount);
          donor.donationCount = remainingDonations;
          await donor.save();
        }
      }
    }

    await payment.deleteOne();
    await deleteProofQuietly(proofToDelete);

    const updatedTotals = await ZakatPaymentModel.getTotals();

    res.json({ 
      status: 'success', 
      message: 'Transaction deleted successfully',
      data: { totals: updatedTotals }
    });

  } catch (error: any) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ status: 'error', message: 'Invalid transaction ID' });
    }
    console.error('Delete payment error:', error);
    res.status(500).json({ status: 'error', message: 'Server Error' });
  }
});

/**
 * @route   GET /api/zakat/donor/:donorName/history
 * @desc    Get donation history for a specific donor
 * @access  Private (Admin/Manager)
 */
router.get('/donor/:donorName/history', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const { donorName } = req.params;
    const payments = await ZakatPayment.find({
      donorName: { $regex: new RegExp(`^${donorName}$`, 'i') },
      type: 'collection'
    }).sort({ paymentDate: -1 });

    const totalContribution = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    res.json({
      status: 'success',
      data: {
        donorName,
        totalContribution,
        history: payments
      },
    });
  } catch (error) {
    console.error('Get donor history error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get history' });
  }
});

export default router;
