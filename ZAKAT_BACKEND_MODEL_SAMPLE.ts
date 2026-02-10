/**
 * SAMPLE BACKEND MODEL - ZakatPayment.ts
 * This shows how the backend model should be updated to support the new donor form fields
 * Location: backend/src/models/ZakatPayment.ts
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IZakatPayment extends Document {
  // Transaction Type
  type: 'Credit' | 'Debit';
  
  // Basic Information
  donorName?: string;
  donorType?: 'Individual' | 'Organization' | 'Anonymous';
  contactNumber?: string;
  email?: string;
  address?: string;
  recipientName?: string;
  recipientType?: string;
  
  // Zakat Details
  zakatType?: 'Zakat-al-Maal' | 'Zakat-al-Fitr' | 'Fidya' | 'Kaffarah' | 'Sadaqah';
  amount: number;
  currency?: 'INR' | 'USD' | 'EUR' | 'GBP';
  paymentDate: Date;
  hijriYear?: string;
  
  // Payment Information
  paymentMethod: string;
  paymentId: string;
  paymentStatus?: 'Completed' | 'Pending' | 'Failed';
  
  // UPI Transfer Fields
  upiId?: string;
  upiTransactionId?: string;
  upiScreenshot?: string;
  
  // Bank Transfer Fields
  bankName?: string;
  accountNumberLast4?: string;
  ifscCode?: string;
  transferDateTime?: Date;
  
  // Cash Collection Fields
  collectedBy?: string;
  collectionLocation?: string;
  receiptNumber?: string;
  
  // Cheque Fields
  chequeNumber?: string;
  chequeDate?: Date;
  clearanceStatus?: string;
  
  // Card/Gateway Fields
  gatewayName?: string;
  gatewayTransactionId?: string;
  cardLast4?: string;
  
  // Additional Fields
  notes?: string;
  recurringDonation?: boolean;
  recurringFrequency?: 'Monthly' | 'Yearly';
  nisabVerified?: boolean;
  anonymousDonation?: boolean;
  taxReceiptRequired?: boolean;
  allocationCategory?: 'General' | 'Education' | 'Food' | 'Medical' | 'Emergency';
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  recordedByUserId?: string;
}

const zakatPaymentSchema = new Schema<IZakatPayment>(
  {
    // Transaction Type
    type: {
      type: String,
      enum: ['Credit', 'Debit'],
      required: true,
    },
    
    // Basic Information
    donorName: {
      type: String,
      sparse: true,
    },
    donorType: {
      type: String,
      enum: ['Individual', 'Organization', 'Anonymous'],
      default: 'Individual',
    },
    contactNumber: {
      type: String,
      sparse: true,
      validate: {
        validator: function(v) {
          // Allow empty or valid phone number
          return !v || /^\+?[\d\s\-()]{10,}$/.test(v);
        },
        message: 'Invalid contact number',
      },
    },
    email: {
      type: String,
      sparse: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          // Allow empty or valid email
          return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Invalid email address',
      },
    },
    address: String,
    recipientName: String,
    recipientType: {
      type: String,
      enum: ['Individual', 'Family', 'Mosque', 'Madrasa', 'NGO', 'Other'],
    },
    
    // Zakat Details
    zakatType: {
      type: String,
      enum: ['Zakat-al-Maal', 'Zakat-al-Fitr', 'Fidya', 'Kaffarah', 'Sadaqah'],
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ['INR', 'USD', 'EUR', 'GBP'],
      default: 'INR',
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    hijriYear: {
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^14\d{2}$/.test(v);
        },
        message: 'Invalid Hijri year format',
      },
    },
    
    // Payment Information
    paymentMethod: {
      type: String,
      enum: ['Bank Transfer', 'UPI Transfer', 'Cash', 'Cheque', 'Card/Online Gateway', 'QR Scanner'],
      required: true,
    },
    paymentId: {
      type: String,
      required: true,
      unique: true,
    },
    paymentStatus: {
      type: String,
      enum: ['Completed', 'Pending', 'Failed'],
      default: 'Pending',
    },
    
    // UPI Transfer Fields
    upiId: String,
    upiTransactionId: String,
    upiScreenshot: String,
    
    // Bank Transfer Fields
    bankName: String,
    accountNumberLast4: String,
    ifscCode: String,
    transferDateTime: Date,
    
    // Cash Collection Fields
    collectedBy: String,
    collectionLocation: String,
    receiptNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    
    // Cheque Fields
    chequeNumber: String,
    chequeDate: Date,
    clearanceStatus: {
      type: String,
      enum: ['Pending', 'Cleared', 'Bounced'],
    },
    
    // Card/Gateway Fields
    gatewayName: {
      type: String,
      enum: ['Razorpay', 'Stripe', 'PayPal', 'Square'],
    },
    gatewayTransactionId: String,
    cardLast4: String,
    
    // Additional Fields
    notes: String,
    recurringDonation: {
      type: Boolean,
      default: false,
    },
    recurringFrequency: {
      type: String,
      enum: ['Monthly', 'Yearly'],
    },
    nisabVerified: {
      type: Boolean,
      default: false,
    },
    anonymousDonation: {
      type: Boolean,
      default: false,
    },
    taxReceiptRequired: {
      type: Boolean,
      default: false,
    },
    allocationCategory: {
      type: String,
      enum: ['General', 'Education', 'Food', 'Medical', 'Emergency'],
      default: 'General',
    },
    
    // Metadata
    recordedByUserId: String,
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
zakatPaymentSchema.index({ type: 1, paymentDate: -1 });
zakatPaymentSchema.index({ donorName: 1, type: 1 });
zakatPaymentSchema.index({ paymentMethod: 1 });
zakatPaymentSchema.index({ allocationCategory: 1 });
zakatPaymentSchema.index({ createdAt: -1 });
zakatPaymentSchema.index({ hijriYear: 1 });

/**
 * SAMPLE API ENDPOINTS - routes/zakat.ts
 * 
 * Key considerations for implementation:
 * 
 * 1. CREATE Transaction (POST /zakat/transaction)
 *    - Validate that if donorType !== 'Anonymous', either contactNumber OR email is provided
 *    - Validate conditional fields based on paymentMethod
 *    - Auto-generate receiptNumber for Cash payments if not provided
 *    - Sanitize anonymousDonation - if true, clear donorName
 * 
 * 2. UPDATE Transaction (PUT /zakat/payment/:id)
 *    - Same validations as create
 *    - Check user authorization
 *    - Prevent modifying createdAt timestamp
 *    - Handle payment status transitions (Pending → Completed/Failed)
 * 
 * 3. GET Transactions (GET /zakat/payments?filters)
 *    - Support filtering by: type, paymentMethod, allocationCategory, zakatType, hijriYear
 *    - Support sorting by: amount, paymentDate, createdAt
 *    - Return paginated results
 *    - Mask sensitive card data (show only last 4 digits)
 * 
 * 4. GET Stats (GET /zakat/stats)
 *    - Total Collected (sum of Credit transactions)
 *    - Total Spent (sum of Debit transactions)
 *    - Current Balance
 *    - Breakdown by: allocationCategory, paymentMethod, zakatType, hijriYear
 * 
 * 5. GET Donor Summary (GET /zakat/donors)
 *    - List unique donors
 *    - Total contribution per donor
 *    - Donation count per donor
 *    - Exclude anonymous donors from personal attribution
 * 
 * VALIDATION EXAMPLE:
 * 
 * if (type === 'Credit') {
 *   if (donorType !== 'Anonymous') {
 *     if (!contactNumber && !email) {
 *       throw new Error('Contact Number or Email required for non-anonymous donors');
 *     }
 *   }
 *   
 *   // Validate conditional payment fields
 *   switch (paymentMethod) {
 *     case 'UPI Transfer':
 *       if (!upiId || !upiTransactionId) {
 *         throw new Error('UPI ID and Transaction ID required');
 *       }
 *       break;
 *     case 'Bank Transfer':
 *       if (!bankName || !accountNumberLast4 || !ifscCode) {
 *         throw new Error('Bank details required');
 *       }
 *       break;
 *     // ... other cases
 *   }
 * }
 * 
 * TAX RECEIPT GENERATION (if taxReceiptRequired = true):
 * - Store donation with section 80G compliance
 * - Generate PDF receipt with QR code
 * - Include donor PAN/Aadhaar verification
 * - Send receipt via email
 */

export default mongoose.model<IZakatPayment>('ZakatPayment', zakatPaymentSchema);
