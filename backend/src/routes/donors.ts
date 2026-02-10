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
const getAdminEmail = (req: Request) => {
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
// GET /api/zakat/donors/:id - Get single donor by ID
// ============================================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if ID is a valid MongoDB ObjectId or donorId
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { donorId: id };

    const donor = await Donor.findOne(query)
      .select('-password')
      .lean();

    if (!donor) {
      return res.status(404).json({ success: false, error: 'Donor not found' });
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      email,
      phone,
      donorType,
      city,
      state,
      panNumber,
      aadharNumber,
      communicationPreferences,
    } = req.body;

    // Validate required fields
    if (!fullName || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Full name and phone are required',
      });
    }

    // Check for duplicate phone
    const existingDonor = await Donor.findOne({ phone });
    if (existingDonor) {
      return res.status(400).json({
        success: false,
        error: 'Donor with this phone number already exists',
      });
    }

    // Create new donor
    const newDonor = new Donor({
      fullName,
      email: email || undefined,
      phone,
      donorType: donorType || 'Individual',
      city: city || undefined,
      state: state || undefined,
      panNumber: panNumber || undefined,
      aadharNumber: aadharNumber || undefined,
      communicationPreferences: communicationPreferences || {
        sms: true,
        email: true,
        whatsapp: false,
      },
    });

    const savedDonor = await newDonor.save();

    // Log the action
    const { ip, userAgent } = getClientInfo(req);
    await DonorLog.createLog(
      getAdminEmail(req),
      'DONOR_CREATED',
      'Donor',
      savedDonor._id,
      {
        newData: {
          donorId: savedDonor.donorId,
          fullName: savedDonor.fullName,
          phone: savedDonor.phone,
          email: savedDonor.email,
          donorType: savedDonor.donorType,
        },
      },
      ip,
      userAgent
    );

    res.status(201).json({
      success: true,
      message: 'Donor created successfully',
      data: savedDonor,
    });
  } catch (error) {
    console.error('Error creating donor:', error);
    res.status(500).json({ success: false, error: 'Failed to create donor' });
  }
});

// ============================================================
// PUT /api/zakat/donors/:id - Update donor
// ============================================================
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating certain fields
    delete updates._id;
    delete updates.donorId;
    delete updates.totalDonations;
    delete updates.totalAmount;
    delete updates.createdAt;

    // Find donor
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { donorId: id };

    const oldDonor = await Donor.findOne(query);
    if (!oldDonor) {
      return res.status(404).json({ success: false, error: 'Donor not found' });
    }

    // Check for duplicate phone if phone is being updated
    if (updates.phone && updates.phone !== oldDonor.phone) {
      const duplicate = await Donor.findOne({ phone: updates.phone });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          error: 'Phone number already exists',
        });
      }
    }

    // Update donor
    const updatedDonor = await Donor.findOneAndUpdate(query, updates, {
      new: true,
      runValidators: true,
    });

    // Log the action
    const { ip, userAgent } = getClientInfo(req);
    await DonorLog.createLog(
      getAdminEmail(req),
      'DONOR_UPDATED',
      'Donor',
      oldDonor._id,
      {
        oldData: oldDonor.toObject(),
        newData: updatedDonor?.toObject(),
      },
      ip,
      userAgent
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
router.put('/:id/disable', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { donorId: id };

    const oldDonor = await Donor.findOne(query);
    if (!oldDonor) {
      return res.status(404).json({ success: false, error: 'Donor not found' });
    }

    // Disable donor
    const updatedDonor = await Donor.findOneAndUpdate(
      query,
      { status: 'Disabled', disabledAt: new Date() },
      { new: true }
    );

    // Log the action
    const { ip, userAgent } = getClientInfo(req);
    await DonorLog.createLog(
      getAdminEmail(req),
      'DONOR_DISABLED',
      'Donor',
      oldDonor._id,
      {
        reason: reason || 'No reason provided',
        oldStatus: oldDonor.status,
        newStatus: 'Disabled',
      },
      ip,
      userAgent
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
router.put('/:id/enable', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { donorId: id };

    const oldDonor = await Donor.findOne(query);
    if (!oldDonor) {
      return res.status(404).json({ success: false, error: 'Donor not found' });
    }

    // Enable donor
    const updatedDonor = await Donor.findOneAndUpdate(
      query,
      { status: 'Active', disabledAt: undefined },
      { new: true }
    );

    // Log the action
    const { ip, userAgent } = getClientInfo(req);
    await DonorLog.createLog(
      getAdminEmail(req),
      'DONOR_RESTORED',
      'Donor',
      oldDonor._id,
      {
        oldStatus: oldDonor.status,
        newStatus: 'Active',
      },
      ip,
      userAgent
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
router.get('/:id/donations', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const Donation = mongoose.model('Donation');

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { donorId: id };

    const donor = await Donor.findOne(query);
    if (!donor) {
      return res.status(404).json({ success: false, error: 'Donor not found' });
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

// ============================================================
// GET /api/zakat/donors/phone/:phone - Check if donor exists
// ============================================================
router.get('/phone/:phone', async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;

    const donor = await Donor.findOne({ phone, status: 'Active' })
      .select('-password')
      .lean();

    if (donor) {
      res.json({
        success: true,
        exists: true,
        data: donor,
      });
    } else {
      res.json({
        success: true,
        exists: false,
        data: null,
      });
    }
  } catch (error) {
    console.error('Error checking donor:', error);
    res.status(500).json({ success: false, error: 'Failed to check donor' });
  }
});

export default router;
