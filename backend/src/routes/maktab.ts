import express from 'express';
import { body, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import MaktabPayment from '../models/MaktabPayment';
import MaktabContributor, { IMaktabContributor } from '../models/MaktabContributor';
import User from '../models/User';
import { logUserActivity } from '../middleware/activityLogger';
import {
  isoToLocalDate,
  MAX_IMPORT_ROWS,
  MAKTAB_SPENDING_CATEGORIES,
  normalizeMaktabFileRow,
  normalizeMaktabImportInput,
  parseImportRows,
  summarizePreviewRows,
  type MaktabPreviewRow,
} from '../utils/fundsImport';
import { attachResolvedBankName, bankFromNarration, resolveStoredBankName } from '../utils/bankFromNarration';
import maktabWeeklyRoutes from './maktabWeekly';
import {
  createObjectKey,
  deleteStoredObject,
  getPrivateObjectUrl,
  parseStoredObjectRef,
  uploadObject,
} from '../services/objectStorage';

// Type assertions for static methods
const MaktabPaymentModel = MaktabPayment as typeof MaktabPayment & {
  hasDuplicateRefId: (refId: string, paymentMethod: string, excludeId?: string) => Promise<boolean>;
  getTotals: () => Promise<{ totalCollected: number; totalSpent: number; currentBalance: number }>;
  getContributorSummary: () => Promise<Array<{
    rank: number;
    contributorId: string | null;
    contributorName: string;
    contributorType: string;
    totalContributed: number;
    contributionsCount: number;
  }>>;
};

const MaktabContributorModel = MaktabContributor as typeof MaktabContributor & {
  findOrCreateContributor: (
    name: string,
    type: 'Individual' | 'Organization' | 'Charity',
    contact?: { phone?: string; email?: string; address?: string }
  ) => Promise<IMaktabContributor>;
  searchContributors: (searchTerm: string, limit?: number) => Promise<IMaktabContributor[]>;
};

const router = express.Router();

router.use(maktabWeeklyRoutes);

/**
 * @route   GET /api/maktab/public/recent-gifts
 * @desc    Latest Maktab collections for public display (date, amount, bank, method only)
 * @access  Public
 */
router.get('/public/recent-gifts', async (_req: any, res: any) => {
  try {
    const rows = await MaktabPayment.find({ type: 'collection' })
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(10)
      .select({ paymentDate: 1, amount: 1, bankName: 1, paymentMethod: 1, notes: 1, _id: 0 })
      .lean();

    const gifts = rows.map((row) => {
      const stored = resolveStoredBankName(row.bankName, row.notes);
      const method = typeof row.paymentMethod === 'string' ? row.paymentMethod : '';
      const bankName =
        stored ||
        (method === 'UPI Transfer' || method === 'QR Scanner' || method === 'Bank Transfer' ? 'Bank' : '');
      return {
        paymentDate: row.paymentDate,
        amount: row.amount,
        bankName,
        paymentMethod: method,
      };
    });

    return res.json({
      status: 'success',
      data: { gifts },
    });
  } catch (error) {
    console.error('Get public maktab gifts error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to load recent gifts' });
  }
});


// Multer Storage for Maktab Proofs
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
    key: createObjectKey('maktab/proofs', file.originalname),
    body: file.buffer,
    contentType: file.mimetype,
    originalName: file.originalname,
  });

const deleteProofQuietly = async (storedValue?: string | null): Promise<void> => {
  try {
    await deleteStoredObject(storedValue);
  } catch (error) {
    console.warn('Failed to delete Maktab proof:', (error as Error).message);
  }
};

// In-memory upload used for bulk import files (CSV / Excel / JSON)
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const SPENDING_CATEGORIES = [...MAKTAB_SPENDING_CATEGORIES];

// ==================== CONTRIBUTOR SEARCH API ====================
/**
 * @route   GET /api/maktab/contributors
 * @desc    Search contributors with fuzzy matching for autocomplete
 * @access  Private (Admin/Manager)
 */
router.get('/contributors', [
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
        data: { contributors: [] }
      });
    }

    const contributors = await MaktabContributorModel.searchContributors(searchTerm, limit);

    res.json({
      status: 'success',
      data: {
        contributors: contributors.map((c: IMaktabContributor) => ({
          id: c._id,
          name: c.name,
          type: c.type,
          contact: c.contact,
          totalContributed: c.totalContributed,
          contributionCount: c.contributionCount,
          lastContributionDate: c.lastContributionDate,
        }))
      }
    });
  } catch (error) {
    console.error('Contributor search error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to search contributors' });
  }
});

/**
 * @route   GET /api/maktab/contributor/summary
 * @desc    Get contributor summary with rankings
 * @access  Private (Admin/Manager)
 */
router.get('/contributor/summary', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const summary = await MaktabPaymentModel.getContributorSummary();
    res.json({
      status: 'success',
      data: { summary }
    });
  } catch (error) {
    console.error('Contributor summary error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get contributor summary' });
  }
});

/**
 * @route   GET /api/maktab/contributor/:id
 * @desc    Get single contributor details with history
 * @access  Private (Admin/Manager)
 */
router.get('/contributor/:id', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const contributor = await MaktabContributor.findById(req.params.id);

    if (!contributor) {
      return res.status(404).json({ status: 'error', message: 'Contributor not found' });
    }

    const contributions = await MaktabPayment.find({ contributorId: contributor._id, type: 'collection' })
      .sort({ paymentDate: -1 })
      .limit(10);

    res.json({
      status: 'success',
      data: {
        contributor: {
          id: contributor._id,
          name: contributor.name,
          type: contributor.type,
          contact: contributor.contact,
          totalContributed: contributor.totalContributed,
          contributionCount: contributor.contributionCount,
          lastContributionDate: contributor.lastContributionDate,
        },
        recentContributions: contributions
      }
    });
  } catch (error: any) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ status: 'error', message: 'Invalid contributor ID' });
    }
    res.status(500).json({ status: 'error', message: 'Failed to get contributor details' });
  }
});

// ==================== MAKTAB TRANSACTION ROUTES ====================
/**
 * @route   POST /api/maktab/transaction
 * @desc    Record a Maktab transaction (Collection or Spending)
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
  body('contributorType').optional().isIn(['Individual', 'Organization', 'Charity']),
  body('contributionFrequency').optional().isIn(['One-time', 'Monthly']),
  body('recipientType').optional().isIn(['Teacher', 'Student', 'Supplier', 'Other']),
  body('category').optional().isIn(SPENDING_CATEGORIES),
], async (req: any, res: any) => {
  let uploadedProof: string | undefined;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', errors: errors.array() });
    }

    const {
      type,
      contributorId,
      contributorName,
      contributorType,
      contributionFrequency = 'One-time',
      recipientName,
      recipientType,
      category,
      studentCount,
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
      if (!contributorName || contributorName.trim() === '') {
        return res.status(400).json({
          status: 'error',
          message: 'Contributor Name is required for collections'
        });
      }
    } else if (type === 'spending') {
      if (!recipientName || recipientName.trim() === '') {
        return res.status(400).json({
          status: 'error',
          message: 'Recipient Name is required for spending'
        });
      }
      if (!recipientType) {
        return res.status(400).json({
          status: 'error',
          message: 'Recipient Type is required for spending'
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
      const isDuplicate = await MaktabPaymentModel.hasDuplicateRefId(transactionRefId, paymentMethod);
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
      const totals = await MaktabPaymentModel.getTotals();
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

    uploadedProof = req.file ? await uploadProof(req.file) : undefined;

    // Handle contributor for collection transactions
    let finalContributorId = undefined;
    if (type === 'collection') {
      if (contributorId) {
        const contributor = await MaktabContributor.findById(contributorId);
        if (contributor) {
          contributor.totalContributed += parseFloat(amount);
          contributor.contributionCount += 1;
          contributor.lastContributionDate = payDate;
          await contributor.save();
          finalContributorId = contributor._id;
        }
      } else {
        const contributor = await MaktabContributorModel.findOrCreateContributor(
          contributorName.trim(),
          contributorType || 'Individual'
        );
        contributor.totalContributed += parseFloat(amount);
        contributor.contributionCount += 1;
        contributor.lastContributionDate = payDate;
        await contributor.save();
        finalContributorId = contributor._id;
      }
    }

    // Create transaction
    const newTransaction = new MaktabPayment({
      userId: req.user.userId,
      type,
      contributorId: finalContributorId,
      contributorName: type === 'collection' ? contributorName?.trim() : undefined,
      contributorType: type === 'collection' ? contributorType : undefined,
      contributionFrequency: type === 'collection' ? contributionFrequency : undefined,
      recipientName: type === 'spending' ? recipientName?.trim() : undefined,
      recipientType: type === 'spending' ? recipientType : undefined,
      category: type === 'spending' ? category : undefined,
      studentCount: type === 'spending' && studentCount ? parseInt(studentCount, 10) : undefined,
      amount: parseFloat(amount),
      paymentDate: payDate,
      paymentMethod,
      transactionRefId: (paymentMethod !== 'Cash' && paymentMethod !== 'Cheque') ? transactionRefId : undefined,
      bankName: (paymentMethod === 'Bank Transfer' || paymentMethod === 'UPI Transfer' || paymentMethod === 'QR Scanner')
        ? (bankName?.trim() || undefined)
        : undefined,
      senderUpiId: paymentMethod === 'UPI Transfer' ? senderUpiId?.trim() : undefined,
      chequeNumber: paymentMethod === 'Cheque' ? chequeNumber?.trim() : undefined,
      proofFilePath: uploadedProof,
      notes: notes?.trim(),
      recordedBy: req.user.userId,
    });

    await newTransaction.save();
    uploadedProof = undefined;

    const updatedTotals = await MaktabPaymentModel.getTotals();

    // Log activity
    await logUserActivity(
      req,
      newTransaction.type === 'collection' ? 'maktab_collection_add' : 'maktab_spending_add',
      'system',
      `Maktab ${newTransaction.type === 'collection' ? 'collection' : 'spending'} recorded: ₹${newTransaction.amount} by ${req.user.email}`,
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
    console.error('Maktab transaction error:', error);

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
 * @route   GET /api/maktab/stats
 * @desc    Get Maktab statistics (totals and balance)
 * @access  Private (Admin/Manager)
 */
router.get('/stats', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const totals = await MaktabPaymentModel.getTotals();

    res.json({
      status: 'success',
      data: totals
    });
  } catch (error) {
    console.error('Get maktab stats error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get stats' });
  }
});

const insertMaktabPreviewRow = async (row: MaktabPreviewRow, userId: string) => {
  const paymentDate = isoToLocalDate(row.paymentDate);
  const amount = typeof row.amount === 'number' ? row.amount : 0;
  const doc: any = {
    userId,
    type: row.type,
    amount,
    currency: 'INR',
    paymentDate,
    paymentMethod: row.paymentMethod,
    notes: row.notes || undefined,
    recordedBy: userId,
  };

  if (row.paymentMethod === 'Bank Transfer') {
    doc.bankName = row.bankName || bankFromNarration(row.notes) || 'Imported';
    if (row.transactionRefId) doc.transactionRefId = row.transactionRefId;
    if (row.senderUpiId) doc.senderUpiId = row.senderUpiId;
  } else if (row.paymentMethod === 'Cheque') {
    doc.chequeNumber = row.chequeNumber || row.transactionRefId || 'IMPORTED';
  } else if (row.paymentMethod === 'UPI Transfer' || row.paymentMethod === 'QR Scanner') {
    const bankName = row.bankName || bankFromNarration(row.notes);
    if (bankName) doc.bankName = bankName;
    if (row.transactionRefId) doc.transactionRefId = row.transactionRefId;
    if (row.senderUpiId) doc.senderUpiId = row.senderUpiId;
  }

  if (row.type === 'collection') {
    const contributorType = row.partyType || 'Individual';
    doc.contributorName = row.partyName;
    doc.contributorType = contributorType;
    doc.contributionFrequency = row.contributionFrequency || 'One-time';
    const contributor = await MaktabContributorModel.findOrCreateContributor(row.partyName, contributorType as any);
    contributor.totalContributed += amount;
    contributor.contributionCount += 1;
    contributor.lastContributionDate = paymentDate;
    await contributor.save();
    doc.contributorId = contributor._id;
  } else {
    doc.recipientName = row.partyName;
    doc.recipientType = row.partyType || 'Other';
    doc.category = row.category || 'Other';
    if (typeof row.studentCount === 'number') {
      doc.studentCount = row.studentCount;
    }
  }

  await new MaktabPayment(doc).save();
};

/**
 * @route   POST /api/maktab/import/preview
 * @desc    Parse a Maktab import file without writing to the database
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

    const rows = rawRows.map((row, index) => normalizeMaktabFileRow(row, index + 2));
    return res.json({
      status: 'success',
      data: {
        fileName: req.file.originalname,
        ...summarizePreviewRows(rows),
        rows,
      },
    });
  } catch (error: any) {
    console.error('Maktab import preview error:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Could not preview file' });
  }
});

/**
 * @route   POST /api/maktab/import/confirm
 * @desc    Insert previously previewed/edited Maktab rows
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
      normalizeMaktabImportInput(row, Number(row?.rowNumber) || index + 1)
    );
    const invalid = rows.filter((row: MaktabPreviewRow) => row.errors.length > 0);
    if (invalid.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Fix or remove ${invalid.length} row${invalid.length === 1 ? '' : 's'} with errors before importing`,
        data: { rows: invalid.slice(0, 50) },
      });
    }

    for (const row of rows) {
      await insertMaktabPreviewRow(row, req.user.userId);
    }

    await logUserActivity(
      req,
      'other',
      'system',
      `Imported ${rows.length} Maktab transactions by ${req.user.email}`,
      { inserted: rows.length, total: rows.length }
    );

    return res.json({
      status: 'success',
      data: { inserted: rows.length, skipped: 0, total: rows.length },
    });
  } catch (error: any) {
    console.error('Maktab import confirm error:', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Import failed' });
  }
});

/**
 * @route   GET /api/maktab/payments
 * @desc    Get all Maktab transactions with optional filtering
 * @access  Private (Admin/Manager)
 */
router.get('/payments', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const { type, category, limit = 100, page = 1 } = req.query;

    const queryObj: any = {};
    if (type && ['collection', 'spending'].includes(type)) {
      queryObj.type = type;
    }

    if (category && SPENDING_CATEGORIES.includes(category)) {
      queryObj.category = category;
    }

    const payments = await MaktabPayment.find(queryObj)
      .populate('contributorId', 'name type totalContributed')
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(parseInt(limit, 10))
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10));

    const total = await MaktabPayment.countDocuments(queryObj);

    res.json({
      status: 'success',
      data: {
        payments: payments.map(attachResolvedBankName),
        pagination: {
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(total / parseInt(limit, 10))
        }
      },
    });
  } catch (error) {
    console.error('Get maktab payments error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch transactions' });
  }
});

/**
 * @route   GET /api/maktab/payment/:id
 * @desc    Get single Maktab transaction
 * @access  Private (Admin/Manager)
 */
router.get('/payment/:id', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    const payment = await MaktabPayment.findById(req.params.id)
      .populate('contributorId', 'name type totalContributed contributionCount contact');

    if (!payment) {
      return res.status(404).json({ status: 'error', message: 'Transaction not found' });
    }

    res.json({
      status: 'success',
      data: { payment: attachResolvedBankName(payment) }
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
    const payment = await MaktabPayment.findById(req.params.id).select('proofFilePath');
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
    console.error('Get Maktab proof URL error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to load proof' });
  }
});

/**
 * @route   PUT /api/maktab/payment/:id
 * @desc    Update a Maktab transaction
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

    const payment = await MaktabPayment.findById(paymentId);
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

      const isDuplicate = await MaktabPaymentModel.hasDuplicateRefId(newRefId, newMethod, paymentId);
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
    if (updates.contributorName) payment.contributorName = updates.contributorName;
    if (updates.contributorType) payment.contributorType = updates.contributorType;
    if (updates.contributionFrequency && ['One-time', 'Monthly'].includes(updates.contributionFrequency)) {
      payment.contributionFrequency = updates.contributionFrequency;
    }
    if (updates.recipientName) payment.recipientName = updates.recipientName;
    if (updates.recipientType) payment.recipientType = updates.recipientType;
    if (updates.category && SPENDING_CATEGORIES.includes(updates.category)) payment.category = updates.category;
    if (updates.studentCount !== undefined && updates.studentCount !== '') {
      payment.studentCount = parseInt(updates.studentCount, 10);
    }
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
    const updatedTotals = await MaktabPaymentModel.getTotals();

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

    console.error('Update maktab payment error:', error);
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
 * @route   POST /api/maktab/payments/bulk-delete
 * @desc    Delete multiple Maktab transactions at once
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

    const payments = await MaktabPayment.find({ _id: { $in: ids } });
    if (payments.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No matching transactions found' });
    }

    const contributorDeltas = new Map<string, { amount: number; count: number }>();
    const proofs: string[] = [];

    for (const payment of payments) {
      if (payment.proofFilePath) proofs.push(payment.proofFilePath);
      if (payment.type === 'collection' && payment.contributorId) {
        const key = payment.contributorId.toString();
        const prev = contributorDeltas.get(key) || { amount: 0, count: 0 };
        contributorDeltas.set(key, { amount: prev.amount + payment.amount, count: prev.count + 1 });
      }
    }

    await MaktabPayment.deleteMany({ _id: { $in: payments.map((p) => p._id) } });

    for (const [contributorId, delta] of contributorDeltas) {
      const contributor = await MaktabContributor.findById(contributorId);
      if (!contributor) continue;
      const remainingContributions = Math.max(0, contributor.contributionCount - delta.count);
      if (remainingContributions === 0) {
        await MaktabContributor.findByIdAndDelete(contributor._id);
      } else {
        contributor.totalContributed = Math.max(0, contributor.totalContributed - delta.amount);
        contributor.contributionCount = remainingContributions;
        await contributor.save();
      }
    }

    await Promise.all(proofs.map((proof) => deleteProofQuietly(proof)));

    const updatedTotals = await MaktabPaymentModel.getTotals();

    res.json({
      status: 'success',
      message: `${payments.length} transaction${payments.length === 1 ? '' : 's'} deleted successfully`,
      data: { deletedCount: payments.length, totals: updatedTotals },
    });
  } catch (error) {
    console.error('Bulk delete maktab payments error:', error);
    res.status(500).json({ status: 'error', message: 'Server Error' });
  }
});

/**
 * @route   DELETE /api/maktab/payment/:id
 * @desc    Delete a Maktab transaction
 * @access  Private (Super Admin only)
 */
router.delete('/payment/:id', authMiddleware, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || (user.role !== 'superadmin' && !user.isAdmin)) {
      return res.status(403).json({ status: 'error', message: 'Access denied. Admin only.' });
    }

    const payment = await MaktabPayment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ status: 'error', message: 'Transaction not found' });
    }

    const proofToDelete = payment.proofFilePath;

    if (payment.type === 'collection' && payment.contributorId) {
      const contributor = await MaktabContributor.findById(payment.contributorId);
      if (contributor) {
        const remainingContributions = Math.max(0, contributor.contributionCount - 1);

        if (remainingContributions === 0) {
          await MaktabContributor.findByIdAndDelete(contributor._id);
        } else {
          contributor.totalContributed = Math.max(0, contributor.totalContributed - payment.amount);
          contributor.contributionCount = remainingContributions;
          await contributor.save();
        }
      }
    }

    await payment.deleteOne();
    await deleteProofQuietly(proofToDelete);

    const updatedTotals = await MaktabPaymentModel.getTotals();

    res.json({
      status: 'success',
      message: 'Transaction deleted successfully',
      data: { totals: updatedTotals }
    });

  } catch (error: any) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ status: 'error', message: 'Invalid transaction ID' });
    }
    console.error('Delete maktab payment error:', error);
    res.status(500).json({ status: 'error', message: 'Server Error' });
  }
});

export default router;
