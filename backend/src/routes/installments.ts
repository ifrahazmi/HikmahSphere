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
const getAdminEmail = (req: Request) => {
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
// GET /api/zakat/installments/:id - Get single installment
// ============================================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { installmentId: id };

    const installment = await Installment.findOne(query)
      .populate('donorId', 'fullName phone email')
      .populate('donationId')
      .lean();

    if (!installment) {
      return res.status(404).json({
        success: false,
        error: 'Installment not found',
      });
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
// GET /api/zakat/installments/donation/:donationId - Get all installments for a donation
// ============================================================
router.get('/donation/:donationId', async (req: Request, res: Response) => {
  try {
    const { donationId } = req.params;

    const objectId = mongoose.Types.ObjectId.isValid(donationId)
      ? donationId
      : (
          await Donation.findOne({ donationId }).select('_id')
        )?._id.toHexString();

    if (!objectId) {
      return res.status(404).json({
        success: false,
        error: 'Donation not found',
      });
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
// POST /api/zakat/installments - Create installments for a donation
// ============================================================
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      donationId,
      donorId,
      totalInstallments,
      frequency = 'Monthly',
      startDate,
    } = req.body;

    if (!donationId || !totalInstallments || totalInstallments < 2) {
      return res.status(400).json({
        success: false,
        error: 'Donation ID and valid number of installments (2-12) are required',
      });
    }

    // Verify donation exists
    const donation = await Donation.findById(donationId);
    if (!donation) {
      return res.status(404).json({
        success: false,
        error: 'Donation not found',
      });
    }

    if (donation.paymentMode !== 'Installment') {
      return res.status(400).json({
        success: false,
        error: 'Donation must have payment mode set to Installment',
      });
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
    const { ip, userAgent } = getClientInfo(req);
    await DonorLog.createLog(
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
      ip,
      userAgent
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
// PUT /api/zakat/installments/:id/paid - Mark installment as paid
// ============================================================
router.put('/:id/mark-paid', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentDate, transactionId, receiptId } = req.body;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { installmentId: id };

    const oldInstallment = await Installment.findOne(query);
    if (!oldInstallment) {
      return res.status(404).json({
        success: false,
        error: 'Installment not found',
      });
    }

    if (oldInstallment.status === 'Paid') {
      return res.status(400).json({
        success: false,
        error: 'Installment is already marked as paid',
      });
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
    if (donation) {
      const newAmountPaid = (donation.amountPaid || 0) + oldInstallment.amount;
      const newPendingAmount = donation.totalAmount - newAmountPaid;
      let newStatus = donation.status;

      if (newAmountPaid > 0 && newAmountPaid < donation.totalAmount) {
        newStatus = 'Partial';
      } else if (newAmountPaid >= donation.totalAmount) {
        newStatus = 'Completed';
      }

      await Donation.findByIdAndUpdate(donation._id, {
        amountPaid: newAmountPaid,
        pendingAmount: newPendingAmount,
        status: newStatus,
        lastPaymentDate: new Date(),
      });
    }

    // Log the action
    const { ip, userAgent } = getClientInfo(req);
    await DonorLog.createLog(
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
      ip,
      userAgent
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
router.put('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { installmentId: id };

    const oldInstallment = await Installment.findOne(query);
    if (!oldInstallment) {
      return res.status(404).json({
        success: false,
        error: 'Installment not found',
      });
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
    const { ip, userAgent } = getClientInfo(req);
    await DonorLog.createLog(
      getAdminEmail(req),
      'INSTALLMENT_CANCELLED',
      'Installment',
      oldInstallment._id,
      {
        reason: reason || 'No reason provided',
        installmentNumber: oldInstallment.installmentNumber,
        amount: oldInstallment.amount,
      },
      ip,
      userAgent
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
// GET /api/zakat/installments/stats - Get installment statistics
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
// PUT /api/zakat/installments/:id - Update installment
// ============================================================
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating certain fields
    delete updates._id;
    delete updates.installmentId;
    delete updates.createdAt;
    delete updates.donationId;
    delete updates.donorId;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { installmentId: id };

    const oldInstallment = await Installment.findOne(query);
    if (!oldInstallment) {
      return res.status(404).json({
        success: false,
        error: 'Installment not found',
      });
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
    const { ip, userAgent } = getClientInfo(req);
    await DonorLog.createLog(
      getAdminEmail(req),
      'INSTALLMENT_UPDATED',
      'Installment',
      oldInstallment._id,
      {
        oldData: oldInstallment.toObject(),
        newData: updatedInstallment?.toObject(),
      },
      ip,
      userAgent
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
