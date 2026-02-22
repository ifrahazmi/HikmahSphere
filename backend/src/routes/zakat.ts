import express, { Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, optionalAuthMiddleware, adminMiddleware } from '../middleware/auth';
import ZakatPayment, { IZakatPayment } from '../models/ZakatPayment';
import Donor, { IDonor } from '../models/Donor';
import User from '../models/User';
import { logUserActivity } from '../middleware/activityLogger';

// Type assertions for static methods
const ZakatPaymentModel = ZakatPayment as typeof ZakatPayment & {
  hasDuplicateRefId: (refId: string, paymentMethod: string, excludeId?: string) => Promise<boolean>;
  getTotals: () => Promise<{ totalCollected: number; totalSpent: number; currentBalance: number }>;
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

// Ensure upload directory exists - Use absolute path for production
const uploadDir = path.resolve(process.cwd(), 'src', 'uploads', 'zakat');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage for Zakat Proofs
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'zakat-proof-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpeg, jpg, png) and PDFs are allowed'));
  }
});

// ==================== ZAKAT CALCULATION ====================
const ZAKAT_RATES = {
  NISAB_GOLD_GRAMS: 85,
  NISAB_SILVER_GRAMS: 595,
  NISAB_GOLD_GRAMS_CLASSICAL: 87.48,
  NISAB_SILVER_GRAMS_CLASSICAL: 612.36,
  ZAKAT_RATE: 0.025,
};

const ISLAMIC_API_KEY = process.env.ISLAMIC_API_KEY || 'icgUaIHMO8GWEVLh7XhFcFoTHjQlsfhSBpJtYfrtTUJXY1eI';

interface NisabApiResponse {
  status: string;
  data: {
    nisab_thresholds: {
      gold: { weight: number; unit_price: number; nisab_amount: number };
      silver: { weight: number; unit_price: number; nisab_amount: number };
    };
    currency: string;
    weight_unit: string;
    updated_at: string;
  };
  message?: string;
}

const fetchNisabData = async (standard: 'classical' | 'common' = 'common', currency: string = 'inr') => {
  try {
    const url = `https://islamicapi.com/api/v1/zakat-nisab/?standard=${standard}&currency=${currency}&unit=g&api_key=${ISLAMIC_API_KEY}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
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
          currency: data.data.currency,
          weightUnit: data.data.weight_unit,
          updatedAt: data.data.updated_at,
        }
      };
    }
    return { success: false, error: data.message || 'Failed to fetch nisab data' };
  } catch (error) {
    console.error('Nisab API Error:', error);
    return { success: false, error: 'Unable to fetch live nisab values' };
  }
};

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

    const nisabResult = await fetchNisabData(calculationStandard, currency);

    let goldUnitPrice = 0;
    let silverUnitPrice = 0;
    let weightUnit = 'gram';
    let nisabGoldAmount = 0;
    let nisabSilverAmount = 0;

    if (nisabResult.success && nisabResult.data) {
      goldUnitPrice = nisabResult.data.gold.unitPrice;
      silverUnitPrice = nisabResult.data.silver.unitPrice;
      weightUnit = nisabResult.data.weightUnit;
      nisabGoldAmount = nisabResult.data.gold.nisabAmount;
      nisabSilverAmount = nisabResult.data.silver.nisabAmount;
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
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('paymentMethod').isIn(['Bank Transfer', 'UPI Transfer', 'Cash', 'Cheque', 'QR Scanner'])
    .withMessage('Invalid payment method'),
  body('donorType').optional().isIn(['Individual', 'Organization', 'Charity']),
  body('recipientType').optional().isIn(['Individual', 'Family', 'Mosque', 'Madrasa', 'NGO', 'Other']),
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const {
      type,
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

    if (paymentMethod === 'Cheque' && (!chequeNumber || chequeNumber.trim() === '')) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Cheque Number is required for Cheque payment' 
      });
    }

    // Validate transaction ref ID (6 digits) for non-Cash, non-Cheque payments
    if (paymentMethod !== 'Cash' && paymentMethod !== 'Cheque' && paymentMethod !== 'Bank Transfer') {
      if (!transactionRefId || !/^\d{6}$/.test(transactionRefId)) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Transaction Ref ID must be exactly 6 digits' 
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

    // Validate proof of payment
    if (paymentMethod !== 'Cash' && !req.file) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Proof of payment is required for non-Cash transactions' 
      });
    }

    // Check balance for spending transactions
    if (type === 'spending') {
      const totals = await ZakatPaymentModel.getTotals();
      const availableBalance = totals.currentBalance;
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
      proofFilePath: req.file ? `uploads/zakat/${req.file.filename}` : undefined,
      notes: notes?.trim(),
      recordedBy: req.user.userId,
    });

    await newTransaction.save();

    const updatedTotals = await ZakatPaymentModel.getTotals();

    // Log activity
    await logUserActivity(
      req,
      newTransaction.type === 'collection' ? 'zakat_collection_add' : 'zakat_spending_add',
      'zakat',
      `${newTransaction.type === 'collection' ? 'Collection' : 'Spending'} recorded: ₹${newTransaction.amount} by ${req.user.email}`,
      {
        transactionId: newTransaction._id,
        type: newTransaction.type,
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
    
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('File cleanup error:', e);
      }
    }

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
 * @route   GET /api/zakat/payments
 * @desc    Get all Zakat transactions with optional filtering
 * @access  Private (Admin/Manager)
 */
router.get('/payments', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const { type, limit = 100, page = 1 } = req.query;
    
    const query: any = {};
    if (type && ['collection', 'spending'].includes(type)) {
      query.type = type;
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

    if (updates.senderUpiId) {
      payment.senderUpiId = updates.senderUpiId;
    }

    if (updates.chequeNumber) {
      payment.chequeNumber = updates.chequeNumber;
    }

    // Validate transaction ref ID
    if (updates.transactionRefId || payment.paymentMethod !== 'Cash') {
      const newRefId = updates.transactionRefId || payment.transactionRefId;
      const newMethod = updates.paymentMethod || payment.paymentMethod;
      
      if (newMethod !== 'Cash' && newMethod !== 'Cheque') {
        if (!newRefId || !/^\d{6}$/.test(newRefId)) {
          return res.status(400).json({ status: 'error', message: 'Transaction Ref ID must be exactly 6 digits' });
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
    }

    // Update other fields
    if (updates.type) payment.type = updates.type;
    if (updates.donorName) payment.donorName = updates.donorName;
    if (updates.donorType) payment.donorType = updates.donorType;
    if (updates.recipientName) payment.recipientName = updates.recipientName;
    if (updates.recipientType) payment.recipientType = updates.recipientType;
    if (updates.notes !== undefined) payment.notes = updates.notes;

    // Handle file update
    if (req.file) {
      if (payment.proofFilePath) {
        try {
          fs.unlinkSync(payment.proofFilePath);
        } catch (e) {
          console.error('Old file deletion error:', e);
        }
      }
      payment.proofFilePath = req.file.path.replace(/\\/g, '/');
    }

    const updatedPayment = await payment.save();
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
    
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('File cleanup error:', e);
      }
    }

    console.error('Update payment error:', error);
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

    if (payment.proofFilePath) {
      try {
        fs.unlinkSync(payment.proofFilePath);
      } catch (e) {
        console.error('File deletion error:', e);
      }
    }

    if (payment.type === 'collection' && payment.donorId) {
      const donor = await Donor.findById(payment.donorId);
      if (donor) {
        donor.totalDonated = Math.max(0, donor.totalDonated - payment.amount);
        donor.donationCount = Math.max(0, donor.donationCount - 1);
        
        if (donor.donationCount === 0) {
          await Donor.findByIdAndUpdate(donor._id, { $unset: { lastDonationDate: 1 } });
        } else {
          await donor.save();
        }
      }
    }

    await payment.deleteOne();

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
