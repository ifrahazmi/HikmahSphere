import express, { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
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
// GET /api/zakat/donors - Get all donors with search/filter
// ============================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      search,
      donorType,
      status = 'Active',
      sortBy = 'registeredDate',
      sortOrder = 'desc',
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: Record<string, any> = { status };
    
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: new RegExp(search as string, 'i') },
        { donorId: new RegExp(search as string, 'i') },
      ];
    }
    
    if (donorType) {
      query.donorType = donorType;
    }

    // Build sort
    const sortObj: Record<string, 1 | -1> = {};
    const sortField = sortBy === 'amount' ? 'totalAmount' : 'registeredDate';
    sortObj[sortField] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const donors = await Donor.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .select('-password')
      .lean();

    const total = await Donor.countDocuments(query);

    res.json({
      success: true,
      data: donors,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching donors:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch donors' });
  }
});

// ============================================================
// GET /api/zakat/donors/phone/:phone - Check if donor exists
// ============================================================
router.get('/phone/:phone', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.params;

    if (!phone) {
      res.status(400).json({ success: false, error: 'Phone number is required' });
      return;
    }

    const donor = await Donor.findOne({ phone }).lean();

    if (!donor) {
      res.status(404).json({ success: false, error: 'Donor not found' });
      return;
    }

    res.json({ success: true, data: donor });
  } catch (error) {
    console.error('Error checking donor:', error);
    res.status(500).json({ success: false, error: 'Failed to check donor' });
  }
});

// ============================================================
// GET /api/zakat/donors/:id - Get single donor
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
      : { donorId: id };

    const donor = await Donor.findOne(query)
      .select('-password')
      .lean();

    if (!donor) {
      res.status(404).json({ success: false, error: 'Donor not found' });
      return;
    }

    res.json({ success: true, data: donor });
  } catch (error) {
    console.error('Error fetching donor:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch donor' });
  }
});

// ============================================================
// POST /api/zakat/donors - Create new donor
// ============================================================
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      fullName,
      email,
      phone,
      donorType,
      address,
      city,
      state,
      country,
      pincode,
      idType,
      idNumber,
      notes,
    } = req.body;

    // Validation
    if (!fullName || !phone) {
      res.status(400).json({
        success: false,
        error: 'Full name and phone are required',
      });
      return;
    }

    // Check if donor with same phone exists
    const existingDonor = await Donor.findOne({ phone });
    if (existingDonor) {
      res.status(400).json({
        success: false,
        error: 'Donor with this phone number already exists',
      });
      return;
    }

    // Check if email exists (if provided)
    if (email) {
      const existingEmail = await Donor.findOne({ email });
      if (existingEmail) {
        res.status(400).json({
          success: false,
          error: 'Donor with this email already exists',
        });
        return;
      }
    }

    // Create donor
    const donor = new Donor({
      fullName,
      email,
      phone,
      donorType: donorType || 'Individual',
      address,
      city,
      state,
      country,
      pincode,
      idType,
      idNumber,
      notes,
      status: 'Active',
      totalDonations: 0,
      totalAmount: 0,
    });

    await donor.save();

    // Log the action
    const clientInfo = getClientInfo(req);
    await (DonorLog as any).createLog(
      getAdminEmail(req),
      'DONOR_CREATED',
      'Donor',
      donor._id,
      {
        donorId: donor.donorId,
        fullName,
        phone,
        donorType: donor.donorType,
      },
      clientInfo.ip,
      clientInfo.userAgent
    );

    res.status(201).json({
      success: true,
      message: 'Donor created successfully',
      data: donor,
    });
  } catch (error) {
    console.error('Error creating donor:', error);
    res.status(500).json({ success: false, error: 'Failed to create donor' });
  }
});

// ============================================================
// PUT /api/zakat/donors/:id - Update donor
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
    delete updates.donorId;
    delete updates.createdAt;
    delete updates.totalDonations;
    delete updates.totalAmount;

    const query = mongoose.Types.ObjectId.isValid(id as string)
      ? { _id: id }
      : { donorId: id };

    const oldDonor = await Donor.findOne(query);
    if (!oldDonor) {
      res.status(404).json({ success: false, error: 'Donor not found' });
      return;
    }

    // Check if phone is being updated and if it already exists
    if (updates.phone && updates.phone !== oldDonor.phone) {
      const existingPhone = await Donor.findOne({ phone: updates.phone });
      if (existingPhone) {
        res.status(400).json({
          success: false,
          error: 'Another donor with this phone number already exists',
        });
        return;
      }
    }

    // Check if email is being updated and if it already exists
    if (updates.email && updates.email !== oldDonor.email) {
      const existingEmail = await Donor.findOne({ email: updates.email });
      if (existingEmail) {
        res.status(400).json({
          success: false,
          error: 'Another donor with this email already exists',
        });
        return;
      }
    }

    const updatedDonor = await Donor.findOneAndUpdate(
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
      'DONOR_UPDATED',
      'Donor',
      oldDonor._id,
      {
        oldData: oldDonor.toObject(),
        newData: updatedDonor?.toObject(),
      },
      clientInfo2.ip,
      clientInfo2.userAgent
    );

    res.json({
      success: true,
      message: 'Donor updated successfully',
      data: updatedDonor,
    });
  } catch (error) {
    console.error('Error updating donor:', error);
    res.status(500).json({ success: false, error: 'Failed to update donor' });
  }
});

// ============================================================
// PUT /api/zakat/donors/:id/disable - Disable donor
// ============================================================
router.put('/:id/disable', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!id) {
      res.status(400).json({ success: false, error: 'ID is required' });
      return;
    }

    const query = mongoose.Types.ObjectId.isValid(id as string)
      ? { _id: id }
      : { donorId: id };

    const oldDonor = await Donor.findOne(query);
    if (!oldDonor) {
      res.status(404).json({ success: false, error: 'Donor not found' });
      return;
    }

    if (oldDonor.status === 'Disabled') {
      res.status(400).json({
        success: false,
        error: 'Donor is already disabled',
      });
      return;
    }

    // Disable donor
    const updatedDonor = await Donor.findOneAndUpdate(
      query,
      { status: 'Disabled', disabledAt: new Date() },
      { new: true }
    );

    // Log the action
    const clientInfo3 = getClientInfo(req);
    await (DonorLog as any).createLog(
      getAdminEmail(req),
      'DONOR_DISABLED',
      'Donor',
      oldDonor._id,
      {
        reason: reason || 'No reason provided',
        oldStatus: oldDonor.status,
      },
      clientInfo3.ip,
      clientInfo3.userAgent
    );

    res.json({
      success: true,
      message: 'Donor disabled successfully',
      data: updatedDonor,
    });
  } catch (error) {
    console.error('Error disabling donor:', error);
    res.status(500).json({ success: false, error: 'Failed to disable donor' });
  }
});

// ============================================================
// PUT /api/zakat/donors/:id/enable - Re-enable donor
// ============================================================
router.put('/:id/enable', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ success: false, error: 'ID is required' });
      return;
    }

    const query = mongoose.Types.ObjectId.isValid(id as string)
      ? { _id: id }
      : { donorId: id };

    const oldDonor = await Donor.findOne(query);
    if (!oldDonor) {
      res.status(404).json({ success: false, error: 'Donor not found' });
      return;
    }

    // Enable donor
    const updatedDonor = await Donor.findOneAndUpdate(
      query,
      { status: 'Active', disabledAt: undefined },
      { new: true }
    );

    // Log the action
    const clientInfo4 = getClientInfo(req);
    await (DonorLog as any).createLog(
      getAdminEmail(req),
      'DONOR_RESTORED',
      'Donor',
      oldDonor._id,
      {
        oldStatus: oldDonor.status,
        newStatus: 'Active',
      },
      clientInfo4.ip,
      clientInfo4.userAgent
    );

    res.json({
      success: true,
      message: 'Donor enabled successfully',
      data: updatedDonor,
    });
  } catch (error) {
    console.error('Error enabling donor:', error);
    res.status(500).json({ success: false, error: 'Failed to enable donor' });
  }
});

// ============================================================
// GET /api/zakat/donors/:id/donations - Get donor's donations
// ============================================================
router.get('/:id/donations', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const Donation = mongoose.model('Donation');

    if (!id) {
      res.status(400).json({ success: false, error: 'ID is required' });
      return;
    }

    const query = mongoose.Types.ObjectId.isValid(id as string)
      ? { _id: id }
      : { donorId: id };

    const donor = await Donor.findOne(query);
    if (!donor) {
      res.status(404).json({ success: false, error: 'Donor not found' });
      return;
    }

    const donations = await Donation.find({ donorId: donor._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: donations,
      total: donations.length,
    });
  } catch (error) {
    console.error('Error fetching donor donations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch donations' });
  }
});

export default router;
