# Zakat Management System - Implementation Plan

## Overview
Implementing a comprehensive Zakat management system with Donor profiles, Donation tracking, Installment management, and Super Admin controls.

---

## Phase-wise Implementation Strategy

### **PHASE 1: Backend Models & Database (Priority: CRITICAL)**

#### Step 1.1: Create Donor Model
**File:** `backend/src/models/Donor.ts`
- Auto-generate Donor ID (HKS-D-XXXXX)
- Store donor information
- Track donation statistics
- Manage status (Active/Disabled/Deleted)
- Support soft deletes for audit trail

#### Step 1.2: Create Donation Model
**File:** `backend/src/models/Donation.ts`
- Link to Donor via foreign key
- Support donation types: Zakat al-Maal, Zakat al-Fitr, Sadaqah, Fidya, Kaffarah
- Track payment mode: Full or Installment
- Status tracking: Pledged, Partial, Completed, Cancelled

#### Step 1.3: Create Installment Model
**File:** `backend/src/models/Installment.ts`
- Link to Donation via foreign key
- Track individual installment payments
- Calculate due dates
- Track payment status and dates
- Support reminders and scheduling

#### Step 1.4: Create DonorLog Model
**File:** `backend/src/models/DonorLog.ts`
- Log all admin actions
- Track IP address, admin email, timestamp
- Audit trail for compliance

#### Step 1.5: Create API Routes
**File:** `backend/src/routes/donors.ts`
**File:** `backend/src/routes/donations.ts`
**File:** `backend/src/routes/installments.ts`

---

### **PHASE 2: Frontend - Zakat Management Section**

#### Step 2.1: Update Donor Registration Flow
**File:** `frontend/src/pages/ZakatCalculator.tsx`
- Auto-detect if new or returning donor
- Quick lookup by phone/name/ID
- Auto-fill returning donor information
- Simplified entry form for repeat donors

#### Step 2.2: Add Donation Type & Category Selection
- Support multiple donation types with subcategories
- Conditional validation based on type
- Nisab check for Zakat al-Maal

#### Step 2.3: Implement Installment Feature
- Toggle for Full vs Installment mode
- Installment count selector (2-12)
- Auto-calculate installment amounts
- Schedule frequency (Weekly/Monthly/Custom)

#### Step 2.4: Create Installment Tracking View
- Display all installments for a donation
- Track payment status
- Show next due date
- Allow payment recording

---

### **PHASE 3: Frontend - Super Admin Dashboard**

#### Step 3.1: Create Donor Management Section
**New Component:** `frontend/src/pages/AdminDonors.tsx`
- List all donors with search/filter
- View donor details and history
- Edit donor information
- Manage donor status

#### Step 3.2: Implement Donor Status Management
- Active → Disabled transition
- Disabled → Active restoration
- Delete with permanent archival
- Confirmation dialogs for destructive actions

#### Step 3.3: Create Audit Logs Viewer
**New Component:** `frontend/src/pages/AdminAuditLogs.tsx`
- View all admin actions
- Filter by action type, donor, date range
- Export audit logs
- IP tracking display

#### Step 3.4: Build Analytics Dashboard
**New Component:** `frontend/src/pages/AdminZakatAnalytics.tsx`
- Donor statistics
- Donation trends
- Installment health metrics
- Category-wise breakdown

---

### **PHASE 4: Integration & Testing**

#### Step 4.1: API Integration
- Connect frontend to backend endpoints
- Handle authentication/authorization
- Error handling and validation

#### Step 4.2: Testing
- Unit tests for models
- Integration tests for APIs
- E2E tests for workflows

---

## Implementation Sequence

```
1. Backend Models (1.1-1.4) ← Must be done first
2. Backend API Routes (1.5)
3. Frontend Zakat Management Updates (2.1-2.4)
4. Frontend Admin Dashboard (3.1-3.4)
5. Integration & Testing (4.1-4.2)
```

---

## Current Status: Ready for Implementation
- ✅ Plan documented
- ⏳ Awaiting Phase 1 execution (Backend Models)

---

## Key Design Decisions
- ✅ Auto-increment donor IDs for tracking
- ✅ Foreign key relationships for data integrity
- ✅ Soft deletes for audit trail preservation
- ✅ Separate installment table for flexible tracking
- ✅ Comprehensive audit logging for compliance
- ✅ Role-based access control (Super Admin only)

---

## Success Metrics
- [ ] 100% of donations linked to donors
- [ ] 100% of installments tracking through completion
- [ ] 100% of admin actions logged
- [ ] <100ms lookup speed for donor search
- [ ] Zero duplicate donor profiles
- [ ] Audit logs preserved for 7+ years
