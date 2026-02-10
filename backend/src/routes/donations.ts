import express, { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Donation from '../models/Donation';
import Donor from '../models/Donor';
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
// GET /api/zakat/donations - Get all donations with filters
// ============================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      donorId,
      status,
      donationType,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: Record<string, any> = {};
    
    if (donorId) {
      query.donorId = donorId;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (donationType) {
      query.donationType = donationType;
    }

    // Build sort
    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const donations = await Donation.find(query)
      .populate('donorId', '-password')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Donation.countDocuments(query);

    res.json({
      success: true,
      data: donations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch donations' });
  }
});

// ============================================================
// GET /api/zakat/donations/stats/overview - Get donation statistics
// ============================================================
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter: Record<string, any> = {};
    if (startDate) dateFilter.$gte = new Date(startDate as string);
    if (endDate) dateFilter.$lte = new Date(endDate as string);

    const query = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const donations = await Donation.find(query).lean();

    const stats = {
      totalDonations: donations.length,
      totalAmount: donations.reduce((sum, d) => sum + (d.totalAmount || 0), 0),
      byStatus: {
        pledged: donations.filter((d) => d.status === 'Pledged').length,
        completed: donations.filter((d) => d.status === 'Completed').length,
        cancelled: donations.filter((d) => d.status === 'Cancelled').length,
        partial: donations.filter((d) => d.status === 'Partial').length,
      },
      byType: {
        zakat_maal: donations.filter((d) => d.donationType === 'Zakat_Maal').length,
        zakat_fitr: donations.filter((d) => d.donationType === 'Zakat_Fitr').length,
        sadaqah: donations.filter((d) => d.donationType === 'Sadaqah').length,
        fidya: donations.filter((d) => d.donationType === 'Fidya').length,
        kaffarah: donations.filter((d) => d.donationType === 'Kaffarah').length,
        sadaqah_jariyah: donations.filter((d) => d.donationType === 'Sadaqah_Jariyah').length,
      },
      byPaymentMode: {
        full: donations.filter((d) => d.paymentMode === 'Full').length,
        installment: donations.filter((d) => d.paymentMode === 'Installment').length,
      },
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching donation stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// ============================================================
// GET /api/zakat/donations/:id - Get single donation
// ============================================================
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ success: false, error: 'ID is required' });
      return;
    }

    const query = mongoose.Types.ObjectId.isValid(id as string)
      ? { _id: id }
      : { donationId: id };

    const donation = await Donation.findOne(query)
      .populate('donorId', '-password')
      .lean();

    if (!donation) {
      res.status(404).json({ success: false, error: 'Donation not found' });
      return;
    }

    res.json({ success: true, data: donation });
  } catch (error) {
    console.error('Error fetching donation:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch donation' });
  }
});

// ============================================================
// POST /api/zakat/donations - Create new donation
// ============================================================
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      donorId,
      donationType,
      totalAmount,
      paymentMode,
      installments,
      startDate,
      purpose,
      notes,
    } = req.body;

    // Validation
    if (!donorId || !donationType || !totalAmount || !paymentMode) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: donorId, donationType, totalAmount, paymentMode',
      });
      return;
    }

    if (paymentMode === 'Installment' && (!installments || installments < 2)) {
      res.status(400).json({
        success: false,
        error: 'Installment donations require at least 2 installments',
      });
      return;
    }

    // Verify donor exists
    const donor = await Donor.findById(donorId);
    if (!donor) {
      res.status(404).json({ success: false, error: 'Donor not found' });
      return;
    }

    if (donor.status !== 'Active') {
      res.status(400).json({
        success: false,
        error: 'Cannot create donation for inactive donor',
      });
      return;
    }

    // Create donation
    const donation = new Donation({
      donorId,
      donationType,
      totalAmount,
      paymentMode,
      installments: paymentMode === 'Installment' ? installments : undefined,
      startDate: startDate ? new Date(startDate) : new Date(),
      purpose,
      notes,
      status: 'Pledged',
      amountPaid: 0,
      pendingAmount: totalAmount,
    });

    await donation.save();

    // Update donor totals
    donor.totalDonations = (donor.totalDonations || 0) + 1;
    donor.totalAmount = (donor.totalAmount || 0) + totalAmount;
    await donor.save();

    // Log the action
    const clientInfo = getClientInfo(req);
    await (DonorLog as any).createLog(
      getAdminEmail(req),
      'DONATION_CREATED',
      'Donation',
      donation._id,
      {
        donationId: donation.donationId,
        donorId,
        donationType,
        totalAmount,
        paymentMode,
      },
      clientInfo.ip,
      clientInfo.userAgent
    );

    res.status(201).json({
      success: true,
      message: 'Donation created successfully',
      data: donation,
    });
  } catch (error) {
    console.error('Error creating donation:', error);
    res.status(500).json({ success: false, error: 'Failed to create donation' });
  }
});

// ============================================================
// PUT /api/zakat/donations/:id - Update donation
// ============================================================
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      res.status(400).json({ success: false, error: 'ID is required' });
      return;
    }

    // Don't allow updating certain fields
    delete updates._id;
    delete updates.donationId;
    delete updates.createdAt;
    delete updates.donorId;

    const query = mongoose.Types.ObjectId.isValid(id as string)
      ? { _id: id }
      : { donationId: id };

    const oldDonation = await Donation.findOne(query);
    if (!oldDonation) {
      res.status(404).json({ success: false, error: 'Donation not found' });
      return;
    }

    const updatedDonation = await Donation.findOneAndUpdate(
      query,
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    // Log the action
    const clientInfo2 = getClientInfo(req);
    await (DonorLog as any).createLog(
      getAdminEmail(req),
      'DONATION_UPDATED',
      'Donation',
      oldDonation._id,
      {
        oldData: oldDonation.toObject(),
        newData: updatedDonation?.toObject(),
      },
      clientInfo2.ip,
      clientInfo2.userAgent
    );

    res.json({
      success: true,
      message: 'Donation updated successfully',
      data: updatedDonation,
    });
  } catch (error) {
    console.error('Error updating donation:', error);
    res.status(500).json({ success: false, error: 'Failed to update donation' });
  }
});

// ============================================================
// PUT /api/zakat/donations/:id/payment - Record payment
// ============================================================
router.put('/:id/payment', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ success: false, error: 'ID is required' });
      return;
    }

    const { amount, paymentDate, paymentMethod, transactionId, receiptId } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, error: 'Valid payment amount required' });
      return;
    }

    const query = mongoose.Types.ObjectId.isValid(id as string)
      ? { _id: id }
      : { donationId: id };

    const donation = await Donation.findOne(query);
    if (!donation) {
      res.status(404).json({ success: false, error: 'Donation not found' });
      return;
    }

    if (donation.status === 'Cancelled') {
      res.status(400).json({
        success: false,
        error: 'Cannot record payment for cancelled donation',
      });
      return;
    }

    // Calculate new amounts
    const newAmountPaid = (donation.amountPaid || 0) + amount;
    const newPendingAmount = donation.totalAmount - newAmountPaid;

    if (newAmountPaid > donation.totalAmount) {
      res.status(400).json({
        success: false,
        error: `Payment exceeds donation total. Maximum allowed: ${donation.totalAmount - (donation.amountPaid || 0)}`,
      });
      return;
    }

    // Determine new status
    let newStatus = donation.status;
    if (newAmountPaid > 0 && newAmountPaid < donation.totalAmount) {
      newStatus = 'Partial';
    } else if (newAmountPaid >= donation.totalAmount) {
      newStatus = 'Completed';
    }

    // Update donation
    const updatedDonation = await Donation.findOneAndUpdate(
      query,
      {
        amountPaid: newAmountPaid,
        pendingAmount: newPendingAmount,
        status: newStatus,
        lastPaymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        $push: {
          paymentHistory: {
            amount,
            date: paymentDate ? new Date(paymentDate) : new Date(),
            method: paymentMethod,
            transactionId,
            receiptId,
          },
        },
      },
      { new: true }
    );

    // Log the action
    const clientInfo3 = getClientInfo(req);
    await (DonorLog as any).createLog(
      getAdminEmail(req),
      'DONATION_PAYMENT_RECORDED',
      'Donation',
      donation._id,
      {
        amount,
        paymentMethod,
        transactionId,
        newStatus,
      },
      clientInfo3.ip,
      clientInfo3.userAgent
    );

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: updatedDonation,
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ success: false, error: 'Failed to record payment' });
  }
});

// ============================================================
// PUT /api/zakat/donations/:id/cancel - Cancel donation
// ============================================================
router.put('/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!id) {
      res.status(400).json({ success: false, error: 'ID is required' });
      return;
    }

    const query = mongoose.Types.ObjectId.isValid(id as string)
      ? { _id: id }
      : { donationId: id };

    const oldDonation = await Donation.findOne(query);
    if (!oldDonation) {
      res.status(404).json({
        success: false,
        error: 'Donation not found',
      });
      return;
    }

    if (oldDonation.status === 'Cancelled') {
      res.status(400).json({
        success: false,
        error: 'Donation is already cancelled',
      });
      return;
    }

    // Cancel donation
    const updatedDonation = await Donation.findOneAndUpdate(
      query,
      {
        status: 'Cancelled',
        cancelledAt: new Date(),
      },
      { new: true }
    );

    // Revert donor totals
    if (oldDonation.donorId) {
      const donorToUpdate = await Donor.findById(oldDonation.donorId);
      if (donorToUpdate) {
        donorToUpdate.totalDonations = Math.max((donorToUpdate.totalDonations || 1) - 1, 0);
        donorToUpdate.totalAmount = Math.max(
          (donorToUpdate.totalAmount || 0) - oldDonation.totalAmount,
          0
        );
        await donorToUpdate.save();
      }
    }

    // Log the action
    const clientInfo4 = getClientInfo(req);
    await (DonorLog as any).createLog(
      getAdminEmail(req),
      'DONATION_CANCELLED',
      'Donation',
      oldDonation._id,
      {
        reason: reason || 'No reason provided',
        oldStatus: oldDonation.status,
        totalAmount: oldDonation.totalAmount,
      },
      clientInfo4.ip,
      clientInfo4.userAgent
    );

    res.json({
      success: true,
      message: 'Donation cancelled successfully',
      data: updatedDonation,
    });
  } catch (error) {
    console.error('Error cancelling donation:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel donation' });
  }
});

export default router;
