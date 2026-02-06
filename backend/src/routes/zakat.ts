import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authMiddleware, optionalAuthMiddleware, adminMiddleware } from '../middleware/auth';
import ZakatPayment from '../models/ZakatPayment';
import User from '../models/User';

const router = express.Router();

// ... existing code ...

/**
 * @route   POST /api/zakat/transaction
 * @desc    Record a Zakat transaction (Collection or Distribution)
 * @access  Private (Admin/Manager)
 */
router.post('/transaction', [
    authMiddleware,
    adminMiddleware, // Use the correct middleware that allows Managers
    body('type').isIn(['Credit', 'Debit']).withMessage('Invalid transaction type'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
    body('paymentDate').isISO8601().toDate(),
    body('paymentMethod').notEmpty(),
    // Conditional validation logic is complex in express-validator, handled in controller
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
            paymentDate,
            paymentMethod,
            paymentId,
            upiId,
            notes
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

// ... rest of the file ...
// I will rewrite the whole file to ensure imports are correct as I saw potential issues previously.

// ... Zakat Calculation logic remains same ...
const ZAKAT_RATES = {
  NISAB_GOLD: 85, // grams
  NISAB_SILVER: 595, // grams
  ZAKAT_RATE: 0.025, // 2.5%
  LUNAR_YEAR_DAYS: 354,
};

const CURRENT_PRICES = {
  gold: 65.50, // USD per gram
  silver: 0.85, // USD per gram
  lastUpdated: new Date().toISOString(),
};

interface ZakatCalculation {
  totalWealth: number;
  nisabValue: number;
  zakatDue: number;
  isEligible: boolean;
  breakdown: {
    cash: number;
    gold: number;
    silver: number;
    investments: number;
    businessAssets: number;
    receivables: number;
    cryptocurrency: number;
    other: number;
    managedZakat: number;
  };
  deductions: {
    personalDebts: number;
    businessDebts: number;
    immediateExpenses: number;
  };
}

const calculateNisab = (metalType: 'gold' | 'silver' = 'gold'): number => {
  if (metalType === 'gold') {
    return NISAB_GOLD * CURRENT_PRICES.gold;
  }
  return NISAB_SILVER * CURRENT_PRICES.silver;
};

const calculateZakat = (wealth: any): ZakatCalculation => {
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
  } = wealth;

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

  return {
    totalWealth,
    nisabValue,
    zakatDue,
    isEligible,
    breakdown,
    deductions,
  };
};

router.post('/calculate', [
  body('cash').optional().isFloat({ min: 0 }),
], optionalAuthMiddleware, async (req, res) => {
  try {
    const calculation = calculateZakat(req.body);
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
 * @route   GET /api/zakat/stats
 * @desc    Get Zakat statistics (Total Collected, Spent, Balance)
 * @access  Private (Admin/Manager)
 */
router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const payments = await ZakatPayment.find({});
        
        let totalCollected = 0;
        let totalSpent = 0;

        payments.forEach(p => {
            if (p.type === 'Credit') {
                totalCollected += p.amount;
            } else if (p.type === 'Debit') {
                totalSpent += p.amount;
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
 * @access  Private (Admin/Manager)
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
 * @access  Private (Admin/Manager)
 */
router.put('/payment/:id', authMiddleware, adminMiddleware, async (req: any, res: any) => {
    try {
        const paymentId = req.params.id;
        const updates = req.body;

        const payment = await ZakatPayment.findById(paymentId);

        if (!payment) {
            return res.status(404).json({ status: 'error', message: 'Payment not found' });
        }

        // Update fields
        if (updates.type) payment.type = updates.type;
        if (updates.donorName) payment.donorName = updates.donorName;
        if (updates.donorType) payment.donorType = updates.donorType;
        if (updates.recipientName) payment.recipientName = updates.recipientName;
        if (updates.recipientType) payment.recipientType = updates.recipientType;
        if (updates.amount) payment.amount = updates.amount;
        if (updates.paymentDate) payment.paymentDate = updates.paymentDate;
        if (updates.paymentMethod) payment.paymentMethod = updates.paymentMethod;
        if (updates.paymentId) payment.paymentId = updates.paymentId;
        if (updates.upiId !== undefined) payment.upiId = updates.upiId;
        if (updates.notes !== undefined) payment.notes = updates.notes;

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
