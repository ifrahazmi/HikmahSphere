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
const getAdminEmail = (req: Request) => {
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
// GET /api/zakat/donations/:id - Get single donation
// ============================================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { donationId: id };

    const donation = await Donation.findOne(query)
      .populate('donorId', '-password')
      .lean();

    if (!donation) {
      return res.status(404).json({
        success: false,
        error: 'Donation not found',
      });
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      donorId,
      donationType,
      totalAmount,
      paymentMode,
      numberOfInstallments,
      allocationCategory,
      isRecurring,
      recurringFrequency,
      paymentMethod,
      upiId,
      bankTransferType,
      accountNumber,
      ifscCode,
      chequeNumber,
      notes,
    } = req.body;

    // Validate required fields
    if (!donorId || !donationType || !totalAmount) {
      return res.status(400).json({
        success: false,
        error: 'Donor ID, donation type, and amount are required',
      });
    }

    // Verify donor exists and is active
    const donor = await Donor.findById(donorId);
    if (!donor) {
      return res.status(404).json({ success: false, error: 'Donor not found' });
    }

    if (donor.status !== 'Active') {
      return res.status(400).json({
        success: false,
        error: 'Cannot create donation for inactive donor',
      });
    }

    // Create new donation
    const newDonation = new Donation({
      donorId,
      donationType,
      totalAmount,
      currency: 'INR',
      paymentMode: paymentMode || 'Full',
      numberOfInstallments:
        paymentMode === 'Installment' ? numberOfInstallments : 1,
      allocationCategory: allocationCategory || 'General',
      isRecurring: isRecurring || false,
      recurringFrequency: isRecurring ? recurringFrequency : undefined,
      paymentMethod: paymentMethod || 'Bank',
      upiId: paymentMethod === 'UPI' ? upiId : undefined,
      bankTransferType:
        paymentMethod === 'Bank' ? bankTransferType : undefined,
      accountNumber:
        paymentMethod === 'Bank' ? accountNumber : undefined,
      ifscCode: paymentMethod === 'Bank' ? ifscCode : undefined,
      chequeNumber: paymentMethod === 'Cheque' ? chequeNumber : undefined,
      notes,
      amountPaid: 0,
      status: 'Pledged',
    });

    const savedDonation = await newDonation.save();

    // Update donor totals
    donor.totalDonations = (donor.totalDonations || 0) + 1;
    donor.totalAmount = (donor.totalAmount || 0) + totalAmount;
    await donor.save();

    // Log the action
    const { ip, userAgent } = getClientInfo(req);
    await DonorLog.createLog(
      getAdminEmail(req),
      'DONATION_CREATED',
      'Donation',
      savedDonation._id,
      {
        donationId: savedDonation.donationId,
        donationType: savedDonation.donationType,
        totalAmount: savedDonation.totalAmount,
        paymentMode: savedDonation.paymentMode,
      },
      ip,
      userAgent
    );

    res.status(201).json({
      success: true,
      message: 'Donation created successfully',
      data: savedDonation,
    });
  } catch (error) {
    console.error('Error creating donation:', error);
    res.status(500).json({ success: false, error: 'Failed to create donation' });
  }
});

// ============================================================
// PUT /api/zakat/donations/:id - Update donation
// ============================================================
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating certain fields
    delete updates._id;
    delete updates.donationId;
    delete updates.createdAt;
    delete updates.donorId;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { donationId: id };

    const oldDonation = await Donation.findOne(query);
    if (!oldDonation) {
      return res.status(404).json({
        success: false,
        error: 'Donation not found',
      });
    }

    const updatedDonation = await Donation.findOneAndUpdate(query, updates, {
      new: true,
      runValidators: true,
    });

    // Log the action
    const { ip, userAgent } = getClientInfo(req);
    await DonorLog.createLog(
      getAdminEmail(req),
      'DONATION_UPDATED',
      'Donation',
      oldDonation._id,
      {
        oldData: oldDonation.toObject(),
        newData: updatedDonation?.toObject(),
      },
      ip,
      userAgent
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
router.put('/:id/payment', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amountPaid, paymentMethod, transactionId, receiptId } = req.body;

    if (!amountPaid || amountPaid < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount is required',
      });
    }

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { donationId: id };

    const donation = await Donation.findOne(query);
    if (!donation) {
      return res.status(404).json({
        success: false,
        error: 'Donation not found',
      });
    }

    // Calculate new totals
    const newAmountPaid = (donation.amountPaid || 0) + amountPaid;
    const newPendingAmount = donation.totalAmount - newAmountPaid;

    // Determine status
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
        paymentMethod: paymentMethod || donation.paymentMethod,
        lastPaymentDate: new Date(),
        ...(transactionId && { transactionId }),
        ...(receiptId && { receiptId }),
      },
      { new: true }
    );

    // Log the action
    const { ip, userAgent } = getClientInfo(req);
    await DonorLog.createLog(
      getAdminEmail(req),
      newStatus === 'Completed' ? 'DONATION_COMPLETED' : 'DONATION_UPDATED',
      'Donation',
      donation._id,
      {
        amountPaid,
        totalAmountPaid: newAmountPaid,
        pendingAmount: newPendingAmount,
        status: newStatus,
        paymentMethod,
        transactionId,
      },
      ip,
      userAgent
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
router.put('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { donationId: id };

    const oldDonation = await Donation.findOne(query);
    if (!oldDonation) {
      return res.status(404).json({
        success: false,
        error: 'Donation not found',
      });
    }

    if (oldDonation.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Donation is already cancelled',
      });
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
      const donor = await Donor.findById(oldDonation.donorId);
      if (donor) {
        donor.totalDonations = Math.max((donor.totalDonations || 1) - 1, 0);
        donor.totalAmount = Math.max(
          (donor.totalAmount || 0) - oldDonation.totalAmount,
          0
        );
        await donor.save();
      }
    }

    // Log the action
    const { ip, userAgent } = getClientInfo(req);
    await DonorLog.createLog(
      getAdminEmail(req),
      'DONATION_CANCELLED',
      'Donation',
      oldDonation._id,
      {
        reason: reason || 'No reason provided',
        oldStatus: oldDonation.status,
        totalAmount: oldDonation.totalAmount,
      },
      ip,
      userAgent
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

// ============================================================
// GET /api/zakat/donations/stats - Get donation statistics
// ============================================================
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const query: Record<string, any> = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    }

    const donations = await Donation.find(query).lean();

    const stats = {
      totalDonations: donations.length,
      totalAmount: donations.reduce((sum, d) => sum + (d.totalAmount || 0), 0),
      completedAmount: donations.reduce(
        (sum, d) => sum + (d.amountPaid || 0),
        0
      ),
      pendingAmount: donations.reduce((sum, d) => sum + (d.pendingAmount || 0), 0),
      byStatus: {
        pledged: donations.filter((d) => d.status === 'Pledged').length,
        partial: donations.filter((d) => d.status === 'Partial').length,
        completed: donations.filter((d) => d.status === 'Completed').length,
        cancelled: donations.filter((d) => d.status === 'Cancelled').length,
      },
      byType: {
        zakat_maal: donations.filter(
          (d) => d.donationType === 'Zakat_Maal'
        ).length,
        zakat_fitr: donations.filter(
          (d) => d.donationType === 'Zakat_Fitr'
        ).length,
        sadaqah: donations.filter((d) => d.donationType === 'Sadaqah').length,
        fidya: donations.filter((d) => d.donationType === 'Fidya').length,
        kaffarah: donations.filter((d) => d.donationType === 'Kaffarah').length,
        sadaqah_jariyah: donations.filter(
          (d) => d.donationType === 'Sadaqah_Jariyah'
        ).length,
      },
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching donation stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

export default router;
