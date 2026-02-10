# Zakat Donor Form Implementation Guide

## Overview
The Zakat Calculator has been enhanced with a comprehensive donor management system that captures detailed information about each donation including the donor profile, zakat details, payment information, and conditional fields based on payment method.

## Frontend Changes (ZakatCalculator.tsx)

### 1. **Extended Interface - ZakatTransaction**
The transaction interface now includes the following fields:

#### Basic Information
- `donorName` (string) - Full legal name of the donor
- `donorType` (enum) - Individual / Organization / Anonymous
- `contactNumber` (string, optional) - Required if not Anonymous
- `email` (string, optional) - Required if not Anonymous
- `address` (string, optional) - For receipt/acknowledgment
- `recipientName` (string) - Name of receiving entity
- `recipientType` (string) - Individual / Family / Mosque / Madrasa / NGO / Other

#### Zakat Details
- `zakatType` (enum) - Zakat-al-Maal / Zakat-al-Fitr / Fidya / Kaffarah / Sadaqah
- `amount` (number) - Amount donated
- `currency` (enum) - INR / USD / EUR / GBP (default: INR)
- `paymentDate` (date) - Date of donation
- `hijriYear` (string) - Islamic calendar year (1445, 1446, 1447)

#### Payment Information
- `paymentMethod` (enum) - Bank Transfer / UPI Transfer / Cash / Cheque / Card/Online Gateway / QR Scanner
- `paymentId` (string) - Unique transaction reference ID
- `paymentStatus` (enum) - Completed / Pending / Failed

#### Conditional Fields by Payment Method

**UPI Transfer:**
- `upiId` (string) - UPI ID in format: name@bank
- `upiTransactionId` (string) - 12-digit UTR
- `upiScreenshot` (string) - Optional screenshot path

**Bank Transfer:**
- `bankName` (string) - Bank name
- `accountNumberLast4` (string) - Last 4 digits of account
- `ifscCode` (string) - IFSC code
- `transferDateTime` (datetime) - Date and time of transfer

**Cash:**
- `collectedBy` (string) - Name of collector
- `collectionLocation` (string) - Location where cash was collected
- `receiptNumber` (string) - Auto-generated receipt number

**Cheque:**
- `chequeNumber` (string) - Cheque number
- `bankName` (string) - Bank name from cheque
- `chequeDate` (date) - Cheque date
- `clearanceStatus` (enum) - Pending / Cleared / Bounced

**Card/Online Gateway:**
- `gatewayName` (enum) - Razorpay / Stripe / PayPal / Square
- `gatewayTransactionId` (string) - Gateway transaction ID
- `cardLast4` (string) - Last 4 digits of card

#### Additional Fields
- `notes` (string, textarea) - Donor's intent or purpose
- `recurringDonation` (boolean) - Whether donation is recurring
- `recurringFrequency` (enum) - Monthly / Yearly
- `nisabVerified` (boolean) - Donor confirms Nisab threshold met
- `anonymousDonation` (boolean) - Hide name in reports
- `taxReceiptRequired` (boolean) - Generate 80G receipt
- `allocationCategory` (enum) - General / Education / Food / Medical / Emergency

### 2. **Form State Management**
The component maintains comprehensive form state with initial values:
```typescript
const [formData, setFormData] = useState({
  // Basic Information
  donorName: '',
  donorType: 'Individual',
  contactNumber: '',
  email: '',
  address: '',
  // ... (all fields with default values)
});
```

### 3. **Validation Logic**
- **Conditional Required Fields**: Contact number or email is required unless donor type is "Anonymous"
- **Dynamic Field Visibility**: Payment method fields are conditionally rendered
- **Required Fields Vary by Transaction Type**: Collection has different requirements than spending

### 4. **Form Organization**
The modal form is organized into 6 main sections:

1. **Basic Information** - Donor/Recipient identification
2. **Zakat Details** - Type, amount, currency, hijri year (Credit only)
3. **Payment Information** - Method, status, transaction ID
4. **Conditional Payment Details** - Fields specific to selected payment method
5. **Additional Information** - Notes, allocation, and toggles
6. **Form Actions** - Cancel and Submit buttons

### 5. **Enhanced API Payload**
The `handleTransactionSubmit` function now sends comprehensive data:
```typescript
{
  type: 'Credit' | 'Debit',
  // Basic info
  donorName: string,
  donorType: 'Individual' | 'Organization' | 'Anonymous',
  contactNumber: string,
  email: string,
  address: string,
  // Zakat details
  zakatType: string,
  amount: number,
  currency: 'INR' | 'USD' | 'EUR' | 'GBP',
  paymentDate: string,
  hijriYear: string,
  // Payment info
  paymentMethod: string,
  paymentId: string,
  paymentStatus: 'Completed' | 'Pending' | 'Failed',
  // Conditional fields (based on method)
  upiId?: string,
  bankName?: string,
  collectedBy?: string,
  // ... other conditional fields
  // Additional
  notes: string,
  recurringDonation: boolean,
  nisabVerified: boolean,
  anonymousDonation: boolean,
  taxReceiptRequired: boolean,
  allocationCategory: string
}
```

## Backend Changes Required

### MongoDB Schema Update (models/ZakatPayment.ts)
The backend needs to update the ZakatPayment schema to include:

```typescript
interface ZakatPaymentSchema {
  // Basic Information
  donorName?: string;
  donorType?: 'Individual' | 'Organization' | 'Anonymous';
  contactNumber?: string;
  email?: string;
  address?: string;
  recipientName?: string;
  recipientType?: string;
  
  // Zakat Details
  zakatType?: string;
  amount: number;
  currency?: 'INR' | 'USD' | 'EUR' | 'GBP';
  paymentDate: Date;
  hijriYear?: string;
  
  // Payment Information
  type: 'Credit' | 'Debit';
  paymentMethod: string;
  paymentId: string;
  paymentStatus?: 'Completed' | 'Pending' | 'Failed';
  
  // Conditional Fields
  upiId?: string;
  upiTransactionId?: string;
  upiScreenshot?: string;
  bankName?: string;
  accountNumberLast4?: string;
  ifscCode?: string;
  transferDateTime?: Date;
  collectedBy?: string;
  collectionLocation?: string;
  receiptNumber?: string;
  chequeNumber?: string;
  chequeDate?: Date;
  clearanceStatus?: string;
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
  allocationCategory?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

### API Endpoints
The following endpoints should support the new fields:

1. **POST /zakat/transaction** - Create new transaction
   - Accepts all fields in the payload
   - Validates conditional required fields
   - Returns created transaction

2. **PUT /zakat/payment/:id** - Update existing transaction
   - Updates all fields that are provided
   - Maintains created timestamps
   - Returns updated transaction

3. **GET /zakat/payments** - List transactions
   - Should return all new fields for each transaction
   - May need pagination for large datasets

4. **GET /zakat/stats** - Get aggregate statistics
   - Should track by currency, allocation category
   - May need to support filtering by hijri year

### Data Validation Rules

```
1. Donor Information:
   - If donorType !== 'Anonymous', contactNumber OR email must be provided
   - Email must be valid if provided
   - Phone number format validation

2. Zakat Type (for Credit transactions):
   - Required field
   - Must be one of: Zakat-al-Maal, Zakat-al-Fitr, Fidya, Kaffarah, Sadaqah

3. Payment Method Conditional Fields:
   - UPI: upiId and upiTransactionId required if method is 'UPI Transfer'
   - Bank: bankName, accountNumberLast4, ifscCode required if method is 'Bank Transfer'
   - Cash: collectedBy, collectionLocation, receiptNumber required if method is 'Cash'
   - Cheque: chequeNumber, bankName, chequeDate required if method is 'Cheque'
   - Gateway: gatewayName, gatewayTransactionId required if method is 'Card/Online Gateway'

4. Additional Validations:
   - Amount must be positive number
   - Currency conversion handling for non-INR amounts
   - Payment status should follow the transaction flow (Pending → Completed or Failed)
   - Hijri year format validation
```

## User Interface Features

### 1. **Smart Form Behavior**
- Form sections expand/collapse based on transaction type
- Payment method changes trigger conditional field display
- Anonymous toggle disables donor name field
- Recurring donation toggle shows frequency selector

### 2. **Visual Organization**
- Color-coded payment method sections (UPI: blue, Bank: purple, Cash: amber, etc.)
- Clear section headers with icons
- Required field indicators (red asterisk)
- Help text for complex fields

### 3. **Data Persistence**
- Pre-filled form when editing transactions
- Retained state across tab changes
- Modal scroll position maintained

## Testing Checklist

### Form Submission
- [ ] Submit Credit transaction with all fields
- [ ] Submit Debit transaction
- [ ] Test Anonymous donation toggle
- [ ] Verify conditional field visibility

### Validation
- [ ] Contact/Email required validation for non-anonymous donors
- [ ] Payment method conditional fields validation
- [ ] Amount validation (positive numbers)
- [ ] Try submitting with invalid data

### Data Display
- [ ] Verify transaction appears in history
- [ ] Check donor summary aggregation
- [ ] Verify all fields saved correctly
- [ ] Edit existing transaction and confirm changes

### Edge Cases
- [ ] Create transaction with all optional fields
- [ ] Create minimal transaction with only required fields
- [ ] Test currency conversion display
- [ ] Test recurring donation frequency selection

## Future Enhancements

1. **Receipt Generation**: Generate automatic receipts with all transaction details
2. **Tax Reporting**: Generate 80G receipts for Indian tax compliance
3. **Bulk Import**: CSV import for multiple transactions
4. **Analytics Dashboard**: Charts by allocation category, payment method, donor type
5. **Recurring Donation Automation**: Auto-create transactions based on frequency
6. **SMS/Email Notifications**: Automated acknowledgment messages
7. **QR Code Generation**: Generate QR codes for donations
8. **Money Conversion**: Real-time currency conversion
