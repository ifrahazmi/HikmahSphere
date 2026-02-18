import express from 'express';
import { body, query, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import { authMiddleware, optionalAuthMiddleware, adminMiddleware } from '../middleware/auth';
import ZakatPayment from '../models/ZakatPayment';
import User from '../models/User';

const router = express.Router();

// Multer Storage for Zakat Proofs
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'src/uploads/zakat/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
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

// ... Zakat Calculation logic ...
const ZAKAT_RATES = {
  NISAB_GOLD: 85, // grams
  NISAB_SILVER: 595, // grams
  ZAKAT_RATE: 0.025, // 2.5%
};

const CURRENT_PRICES = {
  gold: 65.50, // USD per gram
  silver: 0.85, // USD per gram
};

const calculateNisab = (metalType: 'gold' | 'silver' = 'gold'): number => {
  if (metalType === 'gold') {
    return ZAKAT_RATES.NISAB_GOLD * CURRENT_PRICES.gold;
  }
  return ZAKAT_RATES.NISAB_SILVER * CURRENT_PRICES.silver;
};

router.post('/calculate', [
    body('cash').optional().isFloat({ min: 0 }),
  ], optionalAuthMiddleware, async (req: any, res: any) => {
    try {
        const {
            cash = 0,
            gold = 0,
            silver = 0,
            investments = 0,
            businessAssets = 0,
            receivables = 0,
            cryptocurrency = 0,
            other = 0,
            managedZakat = 0,
            personalDebts = 0,
            businessDebts = 0,
            immediateExpenses = 0,
        } = req.body;
    
        const breakdown = {
            cash: parseFloat(cash),
            gold: parseFloat(gold),
            silver: parseFloat(silver),
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
    
        const totalAssets = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
        const totalDeductions = Object.values(deductions).reduce((sum, value) => sum + value, 0);
        const totalWealth = totalAssets - totalDeductions;
    
        const nisabValue = calculateNisab('gold');
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
                goldNisab: { grams: ZAKAT_RATES.NISAB_GOLD, value: calculateNisab('gold') },
            },
            },
        });
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Failed to calculate Zakat' });
    }
});


/**
 * @route   POST /api/zakat/transaction
 * @desc    Record a Zakat transaction (Collection or Distribution)
 * @access  Private (Admin/Manager)
 */
router.post('/transaction', [
    authMiddleware,
    adminMiddleware, 
    upload.single('proofOfPayment'), // Handle file upload
    // Express Validator middleware needs to be after multer to access body
    body('type').isIn(['Credit', 'Debit']).withMessage('Invalid transaction type'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
    // paymentDate validation might need to be manual if sent as form-data
    body('paymentMethod').notEmpty(),
], async (req: any, res: any) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
             return res.status(400).json({ status: 'error', errors: errors.array() });
        }

        const { 
            type, donorName, donorType, 
            recipientName, recipientType,
            amount, paymentDate, paymentMethod, 
            paymentId, upiId, notes 
        } = req.body;

        // Custom Validation
        if (type === 'Credit' && !donorName) {
            return res.status(400).json({ status: 'error', message: 'Donor Name is required for collections' });
        }
        if (type === 'Debit' && !recipientName) {
            return res.status(400).json({ status: 'error', message: 'Recipient Name is required for distributions' });
        }

        const proofOfPayment = req.file ? req.file.path.replace(/\\/g, "/") : undefined;

        const newTransaction = new ZakatPayment({
            userId: req.user.userId,
            type,
            // Credit Fields
            donorName: type === 'Credit' ? donorName : undefined,
            donorType: type === 'Credit' ? donorType : undefined,
            // Debit Fields
            recipientName: type === 'Debit' ? recipientName : undefined,
            recipientType: type === 'Debit' ? recipientType : undefined,
            // Common
            amount,
            paymentDate: new Date(paymentDate),
            paymentMethod,
            paymentId,
            upiId,
            notes,
            proofOfPayment
        });

        await newTransaction.save();

        res.status(201).json({
            status: 'success',
            message: 'Transaction recorded successfully',
            data: { transaction: newTransaction }
        });

    } catch (error) {
        console.error('Transaction error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to record transaction' });
    }
});

/**
 * @route   GET /api/zakat/stats
 * @desc    Get Zakat statistics
 */
router.get('/stats', authMiddleware, adminMiddleware, async (req: any, res: any) => {
    try {
        const payments = await ZakatPayment.find({});
        
        let totalCollected = 0;
        let totalSpent = 0;

        payments.forEach(p => {
            if (p.type === 'Credit') {
                totalCollected += (p.amount || 0);
            } else if (p.type === 'Debit') {
                totalSpent += (p.amount || 0);
            }
        });

        const currentBalance = totalCollected - totalSpent;

        res.json({
            status: 'success',
            data: {
                totalCollected,
                totalSpent,
                currentBalance
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to get stats' });
    }
});

/**
 * @route   GET /api/zakat/payments
 * @desc    Get all Zakat transactions
 */
router.get('/payments', authMiddleware, adminMiddleware, async (req: any, res: any) => {
    try {
        const payments = await ZakatPayment.find().sort({ paymentDate: -1, createdAt: -1 });
        res.json({
            status: 'success',
            data: { payments },
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to fetch transactions' });
    }
});

/**
 * @route   PUT /api/zakat/payment/:id
 * @desc    Update a Zakat payment
 */
router.put('/payment/:id', authMiddleware, adminMiddleware, upload.single('proofOfPayment'), async (req: any, res: any) => {
    try {
        const paymentId = req.params.id;
        const updates = req.body;

        const payment = await ZakatPayment.findById(paymentId);
        if (!payment) {
            return res.status(404).json({ status: 'error', message: 'Payment not found' });
        }

        // Update fields if provided
        if (updates.type) payment.type = updates.type;
        if (updates.donorName) payment.donorName = updates.donorName;
        if (updates.donorType) payment.donorType = updates.donorType;
        if (updates.recipientName) payment.recipientName = updates.recipientName;
        if (updates.recipientType) payment.recipientType = updates.recipientType;
        if (updates.amount) payment.amount = updates.amount;
        if (updates.paymentDate) payment.paymentDate = new Date(updates.paymentDate);
        if (updates.paymentMethod) payment.paymentMethod = updates.paymentMethod;
        if (updates.paymentId) payment.paymentId = updates.paymentId;
        if (updates.upiId !== undefined) payment.upiId = updates.upiId;
        if (updates.notes !== undefined) payment.notes = updates.notes;
        
        // Handle file update
        if (req.file) {
            payment.proofOfPayment = req.file.path.replace(/\\/g, "/");
        }

        const updatedPayment = await payment.save();
        res.json({ status: 'success', data: updatedPayment });

    } catch (error: any) {
        if (error.kind === 'ObjectId') {
             return res.status(404).json({ status: 'error', message: 'Invalid payment ID' });
        }
        res.status(500).json({ status: 'error', message: 'Server Error' });
    }
});

/**
 * @route   GET /api/zakat/donor/:donorName/history
 * @desc    Get donation history for a specific donor
 */
router.get('/donor/:donorName/history', authMiddleware, adminMiddleware, async (req: any, res: any) => {
    try {
        const { donorName } = req.params;
        const payments = await ZakatPayment.find({ 
            donorName: { $regex: new RegExp(`^${donorName}$`, 'i') },
            type: 'Credit' 
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
        res.status(500).json({ status: 'error', message: 'Failed to get history' });
    }
});

export default router;
