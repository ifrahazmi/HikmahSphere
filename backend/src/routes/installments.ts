import express, { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Installment from '../models/Installment';
import Donation from '../models/Donation';
import DonorLog from '../models/DonorLog';

const router = Router();

// Middleware to extract IP and user agent
const getClientInfo = (req: Request) => ({
  ip: req.ip || req.connection.remoteAddress || 'unknown',
  userAgent: req.get('user-agent') || 'unknown',
});

// Middleware to get admin email (from auth context)
const getAdminEmail = (req: Request): string => {
  return (req as any).user?.email || 'system@hikmahsphere.com';
};

// ============================================================
// GET /api/zakat/installments - Get all installments with filters
// ============================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      donationId,
      donorId,
      status,
      sortBy = 'dueDate',
      sortOrder = 'asc',
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: Record<string, any> = {};
    
    if (donationId) {
      query.donationId = donationId;
    }
    
    if (donorId) {
      query.donorId = donorId;
    }
    
    if (status) {
      query.status = status;
    }

    // Build sort
    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const installments = await Installment.find(query)
      .populate('donorId', 'fullName phone email')
      .populate('donationId', 'donationType totalAmount')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Installment.countDocuments(query);

    res.json({
      success: true,
      data: installments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching installments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch installments',
    });
  }
});

// ============================================================
// GET /api/zakat/installments/stats/overview - Get installment statistics
// ============================================================
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const installments = await Installment.find().lean();

    const stats = {
      total: installments.length,
      byStatus: {
        pending: installments.filter((i) => i.status === 'Pending').length,
        paid: installments.filter((i) => i.status === 'Paid').length,
        overdue: installments.filter((i) => i.status === 'Overdue').length,
        cancelled: installments.filter((i) => i.status === 'Cancelled').length,
        defaulted: installments.filter((i) => i.status === 'Defaulted').length,
      },
      totalAmount: installments.reduce((sum, i) => sum + (i.amount || 0), 0),
      paidAmount: installments
        .filter((i) => i.status === 'Paid')
        .reduce((sum, i) => sum + (i.amount || 0), 0),
      pendingAmount: installments
        .filter((i) => i.status === 'Pending')
        .reduce((sum, i) => sum + (i.amount || 0), 0),
      overdueAmount: installments
        .filter((i) => i.status === 'Overdue')
        .reduce((sum, i) => sum + (i.amount || 0), 0),
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching installment stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
    });
  }
});

// ============================================================
// GET /api/zakat/installments/donation/:donationId - Get all installments for a donation
// ============================================================
router.get('/donation/:donationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { donationId } = req.params;

    if (!donationId) {
      res.status(400).json({ success: false, error: 'Donation ID is required' });
      return;
    }

    const objectId = mongoose.Types.ObjectId.isValid(donationId!)
      ? donationId
      : (
          (await Donation.findOne({ donationId }).select('_id')) as any
        )?._id?.toString();

    if (!objectId) {
      res.status(404).json({
        success: false,
        error: 'Donation not found',
      });
      return;
    }

    const installments = await Installment.find({
      donationId: new mongoose.Types.ObjectId(objectId),
    })
      .populate('donorId', 'fullName phone email')
      .sort({ installmentNumber: 1 })
      .lean();

    res.json({
      success: true,
      data: installments,
      total: installments.length,
    });
  } catch (error) {
    console.error('Error fetching donation installments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch installments',
    });
  }
});

// ============================================================
// GET /api/zakat/installments/:id - Get single installment
// ============================================================
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ success: false, error: 'ID is required' });
      return;
    }

    const query = mongoose.Types.ObjectId.isValid(id!)
      ? { _id: id }
      : { installmentId: id };

    const installment = await Installment.findOne(query)
      .populate('donorId', 'fullName phone email')
      .populate('donationId')
      .lean();

    if (!installment) {
      res.status(404).json({
        success: false,
        error: 'Installment not found',
      });
      return;
    }

    res.json({ success: true, data: installment });
  } catch (error) {
    console.error('Error fetching installment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch installment',
    });
  }
});

// ============================================================
// POST /api/zakat/installments - Create installments for a donation
// ============================================================
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      donationId,
      donorId,
      totalInstallments,
      frequency = 'Monthly',
      startDate,
    } = req.body;

    if (!donationId || !totalInstallments || totalInstallments < 2) {
      res.status(400).json({
        success: false,
        error: 'Donation ID and valid number of installments (2-12) are required',
      });
      return;
    }

    // Verify donation exists
    const donation = await Donation.findById(donationId);
    if (!donation) {
      res.status(404).json({
        success: false,
        error: 'Donation not found',
      });
      return;
    }

    if (donation.paymentMode !== 'Installment') {
      res.status(400).json({
        success: false,
        error: 'Donation must have payment mode set to Installment',
      });
      return;
    }

    // Delete existing installments if any
    await Installment.deleteMany({ donationId });

    // Calculate per-installment amount
    const amountPerInstallment =
      donation.totalAmount / totalInstallments;
    const baseDate = startDate ? new Date(startDate) : new Date();

    // Create installments
    const installments = [];
    for (let i = 1; i <= totalInstallments; i++) {
      const dueDate = new Date(baseDate);

      // Calculate due date based on frequency
      if (frequency === 'Weekly') {
        dueDate.setDate(dueDate.getDate() + (i - 1) * 7);
      } else if (frequency === 'Monthly') {
        dueDate.setMonth(dueDate.getMonth() + (i - 1));
      }

      const installment = new Installment({
        donationId,
        donorId: donorId || donation.donorId,
        installmentNumber: i,
        totalInstallments,
        amount: amountPerInstallment,
        currency: 'INR',
        dueDate,
        frequency,
        status: 'Pending',
      });

      installments.push(installment);
    }

    const savedInstallments = await Installment.insertMany(installments);

    // Log the action
    const clientInfo4 = getClientInfo(req);
    await (DonorLog as any).createLog(
      getAdminEmail(req),
      'INSTALLMENT_CREATED',
      'Donation',
      donation._id,
      {
        donationId: donation.donationId,
        totalInstallments,
        frequency,
        amountPerInstallment,
        startDate: baseDate,
      },
      clientInfo4.ip,
      clientInfo4.userAgent
    );

    res.status(201).json({
      success: true,
      message: `${totalInstallments} installments created successfully`,
      data: savedInstallments,
    });
  } catch (error) {
    console.error('Error creating installments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create installments',
    });
  }
});

// ============================================================
// PUT /api/zakat/installments/:id/mark-paid - Mark installment as paid
// ============================================================
router.put('/:id/mark-paid', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ success: false, error: 'ID is required' });
      return;
    }

    const { paymentDate, transactionId, receiptId } = req.body;

    const query = mongoose.Types.ObjectId.isValid(id!)
      ? { _id: id }
      : { installmentId: id };

    const oldInstallment = await Installment.findOne(query);
    if (!oldInstallment) {
      res.status(404).json({
        success: false,
        error: 'Installment not found',
      });
      return;
    }

    if (oldInstallment.status === 'Paid') {
      res.status(400).json({
        success: false,
        error: 'Installment is already marked as paid',
      });
      return;
    }

    // Mark as paid
    const updatedInstallment = await Installment.findOneAndUpdate(
      query,
      {
        status: 'Paid',
        paidDate: paymentDate ? new Date(paymentDate) : new Date(),
        transactionId: transactionId || undefined,
        receiptId: receiptId || undefined,
      },
      { new: true }
    );

    // Update donation amounts
    const donation = await Donation.findById(oldInstallment.donationId);
    if (!donation) {
      res.status(404).json({
        success: false,
        error: 'Associated donation not found',
      });
      return;
    }

    const newAmountPaid = (donation.amountPaid || 0) + oldInstallment.amount;
    const newPendingAmount = donation.totalAmount - newAmountPaid;
    let newStatus = donation.status;

    if (newAmountPaid > 0 && newAmountPaid < donation.totalAmount) {
      newStatus = 'Partial';
    } else if (newAmountPaid >= donation.totalAmount) {
      newStatus = 'Completed';
    }

    // Validate payment doesn't exceed total
    if (newAmountPaid > donation.totalAmount) {
      res.status(400).json({
        success: false,
        error: `Payment would exceed donation total. Maximum allowed: ${donation.totalAmount - (donation.amountPaid || 0)}`,
      });
      return;
    }

    await Donation.findByIdAndUpdate(donation._id, {
      amountPaid: newAmountPaid,
      pendingAmount: newPendingAmount,
      status: newStatus,
      lastPaymentDate: new Date(),
    });

    // Log the action
    const clientInfo = getClientInfo(req);
    await (DonorLog as any).createLog(
      getAdminEmail(req),
      'INSTALLMENT_MARKED_PAID',
      'Installment',
      oldInstallment._id,
      {
        installmentId: oldInstallment.installmentId,
        amount: oldInstallment.amount,
        paidDate: paymentDate || new Date(),
        transactionId,
      },
      clientInfo.ip,
      clientInfo.userAgent
    );

    res.json({
      success: true,
      message: 'Installment marked as paid successfully',
      data: updatedInstallment,
    });
  } catch (error) {
    console.error('Error marking installment as paid:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark installment as paid',
    });
  }
});

// ============================================================
// PUT /api/zakat/installments/:id/cancel - Cancel installment
// ============================================================
router.put('/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ success: false, error: 'ID is required' });
      return;
    }

    const { reason } = req.body;

    const query = mongoose.Types.ObjectId.isValid(id!)
      ? { _id: id }
      : { installmentId: id };

    const oldInstallment = await Installment.findOne(query);
    if (!oldInstallment) {
      res.status(404).json({
        success: false,
        error: 'Installment not found',
      });
      return;
    }

    // Cancel installment
    const updatedInstallment = await Installment.findOneAndUpdate(
      query,
      {
        status: 'Cancelled',
        cancelledAt: new Date(),
      },
      { new: true }
    );

    // Log the action
    const clientInfo2 = getClientInfo(req);
    await (DonorLog as any).createLog(
      getAdminEmail(req),
      'INSTALLMENT_CANCELLED',
      'Installment',
      oldInstallment._id,
      {
        reason: reason || 'No reason provided',
        installmentNumber: oldInstallment.installmentNumber,
        amount: oldInstallment.amount,
      },
      clientInfo2.ip,
      clientInfo2.userAgent
    );

    res.json({
      success: true,
      message: 'Installment cancelled successfully',
      data: updatedInstallment,
    });
  } catch (error) {
    console.error('Error cancelling installment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel installment',
    });
  }
});

// ============================================================
// PUT /api/zakat/installments/:id - Update installment
// ============================================================
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ success: false, error: 'ID is required' });
      return;
    }

    const updates = req.body;

    // Don't allow updating certain fields
    delete updates._id;
    delete updates.installmentId;
    delete updates.createdAt;
    delete updates.donationId;
    delete updates.donorId;

    const query = mongoose.Types.ObjectId.isValid(id!)
      ? { _id: id }
      : { installmentId: id };

    const oldInstallment = await Installment.findOne(query);
    if (!oldInstallment) {
      res.status(404).json({
        success: false,
        error: 'Installment not found',
      });
      return;
    }

    const updatedInstallment = await Installment.findOneAndUpdate(
      query,
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    // Log the action
    const clientInfo3 = getClientInfo(req);
    await (DonorLog as any).createLog(
      getAdminEmail(req),
      'INSTALLMENT_UPDATED',
      'Installment',
      oldInstallment._id,
      {
        oldData: oldInstallment.toObject(),
        newData: updatedInstallment?.toObject(),
      },
      clientInfo3.ip,
      clientInfo3.userAgent
    );

    res.json({
      success: true,
      message: 'Installment updated successfully',
      data: updatedInstallment,
    });
  } catch (error) {
    console.error('Error updating installment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update installment',
    });
  }
});

export default router;
