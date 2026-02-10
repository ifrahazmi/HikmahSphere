import React, { useState, useEffect } from 'react';
import {
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { API_URL } from '../config';
import { useNavigate } from 'react-router-dom';

interface Donor {
  _id: string;
  donorId: string;
  fullName: string;
  phone: string;
  email?: string;
  donorType: 'Individual' | 'Organization' | 'NRI' | 'Corporate';
  city?: string;
  state?: string;
  totalDonations: number;
  totalAmount: number;
  status: 'Active' | 'Disabled' | 'Deleted';
}

interface DonationFormData {
  donorId?: string;
  donationType: 'Zakat_Maal' | 'Zakat_Fitr' | 'Sadaqah' | 'Fidya' | 'Kaffarah' | 'Sadaqah_Jariyah';
  totalAmount: string;
  paymentMode: 'Full' | 'Installment';
  numberOfInstallments?: number;
  allocationCategory: 'General' | 'Education' | 'Food' | 'Medical' | 'Emergency' | 'Orphans' | 'Water' | 'Mosque';
  isRecurring: boolean;
  recurringFrequency?: 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
  paymentMethod: 'UPI' | 'Bank' | 'Cash' | 'Cheque' | 'Card';
  // Payment Details
  upiId?: string;
  bankTransferType?: 'NEFT' | 'Manual';
  accountNumber?: string;
  ifscCode?: string;
  chequeNumber?: string;
  cardLast4?: string;
  notes?: string;
  taxReceiptRequired: boolean;
}

interface DonorFormData {
  fullName: string;
  phone: string;
  email: string;
  donorType: 'Individual' | 'Organization' | 'NRI' | 'Corporate';
  city?: string;
  state?: string;
}

const EnhancedDonationForm: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Phone lookup state
  const [searchPhone, setSearchPhone] = useState('');
  const [searchingDonor, setSearchingDonor] = useState(false);
  const [foundDonor, setFoundDonor] = useState<Donor | null>(null);
  const [showNewDonorForm, setShowNewDonorForm] = useState(false);

  // Donor form state
  const [donorFormData, setDonorFormData] = useState<DonorFormData>({
    fullName: '',
    phone: '',
    email: '',
    donorType: 'Individual',
    city: '',
    state: '',
  });

  // Donation form state
  const [donationForm, setDonationForm] = useState<DonationFormData>({
    donationType: 'Zakat_Maal',
    totalAmount: '',
    paymentMode: 'Full',
    allocationCategory: 'General',
    isRecurring: false,
    paymentMethod: 'Bank',
    taxReceiptRequired: false,
  });

  const [submitting, setSubmitting] = useState(false);

  // Search for existing donor by phone
  const searchDonor = async () => {
    if (!searchPhone.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    setSearchingDonor(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/zakat/donors/phone/${encodeURIComponent(searchPhone)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();

      if (data.success && data.exists) {
        setFoundDonor(data.data);
        setDonationForm((prev) => ({
          ...prev,
          donorId: data.data._id,
        }));
        toast.success(`Found existing donor: ${data.data.fullName}`);
      } else {
        setFoundDonor(null);
        setShowNewDonorForm(true);
        setDonorFormData((prev) => ({
          ...prev,
          phone: searchPhone,
        }));
        toast.loading('No donor found. Creating new profile...', { duration: 2000 });
      }
    } catch (error) {
      console.error(error);
      toast.error('Error searching for donor');
    } finally {
      setSearchingDonor(false);
    }
  };

  // Create new donor
  const createNewDonor = async () => {
    if (!donorFormData.fullName || !donorFormData.phone) {
      toast.error('Name and phone number are required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/zakat/donors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(donorFormData),
      });

      const data = await response.json();

      if (data.success) {
        setFoundDonor(data.data);
        setDonationForm((prev) => ({
          ...prev,
          donorId: data.data._id,
        }));
        setShowNewDonorForm(false);
        toast.success(`Donor created: ${data.data.fullName}`);
      } else {
        toast.error(data.error || 'Failed to create donor');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error creating donor');
    }
  };

  // Submit donation
  const submitDonation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!foundDonor?.donorId || !donationForm.donorId) {
      toast.error('Please select or create a donor first');
      return;
    }

    if (!donationForm.totalAmount) {
      toast.error('Please enter donation amount');
      return;
    }

    if (
      donationForm.paymentMode === 'Installment' &&
      (!donationForm.numberOfInstallments ||
        donationForm.numberOfInstallments < 2 ||
        donationForm.numberOfInstallments > 12)
    ) {
      toast.error('Please enter valid number of installments (2-12)');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');

      // Create donation
      const donationPayload = {
        donorId: donationForm.donorId,
        donationType: donationForm.donationType,
        totalAmount: parseFloat(donationForm.totalAmount),
        paymentMode: donationForm.paymentMode,
        numberOfInstallments:
          donationForm.paymentMode === 'Installment'
            ? donationForm.numberOfInstallments
            : 1,
        allocationCategory: donationForm.allocationCategory,
        isRecurring: donationForm.isRecurring,
        recurringFrequency: donationForm.isRecurring
          ? donationForm.recurringFrequency
          : undefined,
        paymentMethod: donationForm.paymentMethod,
        upiId:
          donationForm.paymentMethod === 'UPI'
            ? donationForm.upiId
            : undefined,
        bankTransferType:
          donationForm.paymentMethod === 'Bank'
            ? donationForm.bankTransferType
            : undefined,
        accountNumber:
          donationForm.paymentMethod === 'Bank'
            ? donationForm.accountNumber
            : undefined,
        ifscCode:
          donationForm.paymentMethod === 'Bank'
            ? donationForm.ifscCode
            : undefined,
        chequeNumber:
          donationForm.paymentMethod === 'Cheque'
            ? donationForm.chequeNumber
            : undefined,
        notes: donationForm.notes,
        taxReceiptRequired: donationForm.taxReceiptRequired,
      };

      const donationResponse = await fetch(`${API_URL}/zakat/donations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(donationPayload),
      });

      const donationData = await donationResponse.json();

      if (!donationData.success) {
        toast.error(donationData.error || 'Failed to create donation');
        return;
      }

      // Create installments if needed
      if (donationForm.paymentMode === 'Installment') {
        const installmentResponse = await fetch(
          `${API_URL}/zakat/installments`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              donationId: donationData.data._id,
              donorId: donationForm.donorId,
              totalInstallments: donationForm.numberOfInstallments,
              frequency: donationForm.recurringFrequency || 'Monthly',
            }),
          }
        );

        const installmentData = await installmentResponse.json();
        if (!installmentData.success) {
          console.error('Failed to create installments:', installmentData);
        }
      }

      toast.success('Donation recorded successfully!');
      resetForm();
      setFoundDonor(null);
      setShowNewDonorForm(false);

      // Redirect to success page or dashboard
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error) {
      console.error(error);
      toast.error('Error submitting donation');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setDonationForm({
      donationType: 'Zakat_Maal',
      totalAmount: '',
      paymentMode: 'Full',
      allocationCategory: 'General',
      isRecurring: false,
      paymentMethod: 'Bank',
      taxReceiptRequired: false,
    });
    setDonorFormData({
      fullName: '',
      phone: '',
      email: '',
      donorType: 'Individual',
      city: '',
      state: '',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🕌 Record Zakat Donation
          </h1>
          <p className="text-gray-600">
            Register donors and track their contributions
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Step 1: Donor Lookup */}
          {!foundDonor && !showNewDonorForm && (
            <div className="p-8 border-b-2 border-blue-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Step 1: Find Donor
              </h2>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Donor Phone Number
                  </label>
                  <input
                    type="tel"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    placeholder="Enter 10-digit phone number"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="pt-7">
                  <button
                    type="button"
                    onClick={searchDonor}
                    disabled={searchingDonor}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                  >
                    <MagnifyingGlassIcon className="w-5 h-5" />
                    {searchingDonor ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-500 mt-3">
                Enter a phone number to find an existing donor or create a new
                profile
              </p>
            </div>
          )}

          {/* New Donor Form */}
          {showNewDonorForm && !foundDonor && (
            <div className="p-8 border-b-2 border-blue-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <UserPlusIcon className="w-6 h-6 text-blue-600" />
                New Donor Profile
              </h2>

              <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={donorFormData.fullName}
                      onChange={(e) =>
                        setDonorFormData((prev) => ({
                          ...prev,
                          fullName: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={donorFormData.phone}
                      onChange={(e) =>
                        setDonorFormData((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={donorFormData.email}
                      onChange={(e) =>
                        setDonorFormData((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Donor Type
                    </label>
                    <select
                      value={donorFormData.donorType}
                      onChange={(e) =>
                        setDonorFormData((prev) => ({
                          ...prev,
                          donorType: e.target.value as any,
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Individual">Individual</option>
                      <option value="Organization">Organization</option>
                      <option value="NRI">NRI</option>
                      <option value="Corporate">Corporate</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={donorFormData.city || ''}
                      onChange={(e) =>
                        setDonorFormData((prev) => ({
                          ...prev,
                          city: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={donorFormData.state || ''}
                      onChange={(e) =>
                        setDonorFormData((prev) => ({
                          ...prev,
                          state: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={createNewDonor}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create Donor Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewDonorForm(false);
                      setSearchPhone('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Donor Summary */}
          {foundDonor && (
            <div className="p-8 bg-blue-50 border-b-2 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {foundDonor.fullName}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {foundDonor.donorId} • {foundDonor.phone}
                  </p>
                  <p className="text-sm text-gray-600">
                    Total Donations: {foundDonor.totalDonations} (₹
                    {foundDonor.totalAmount.toLocaleString()})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFoundDonor(null);
                    setSearchPhone('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Change Donor
                </button>
              </div>
            </div>
          )}

          {/* Donation Form */}
          {foundDonor && (
            <form onSubmit={submitDonation} className="p-8 space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Step 2: Donation Details
              </h2>

              {/* Donation Type & Amount */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Donation Type *
                  </label>
                  <select
                    value={donationForm.donationType}
                    onChange={(e) =>
                      setDonationForm((prev) => ({
                        ...prev,
                        donationType: e.target.value as any,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="Zakat_Maal">Zakat-al-Maal</option>
                    <option value="Zakat_Fitr">Zakat-al-Fitr</option>
                    <option value="Sadaqah">Sadaqah</option>
                    <option value="Fidya">Fidya</option>
                    <option value="Kaffarah">Kaffarah</option>
                    <option value="Sadaqah_Jariyah">Sadaqah Jariyah</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    value={donationForm.totalAmount}
                    onChange={(e) =>
                      setDonationForm((prev) => ({
                        ...prev,
                        totalAmount: e.target.value,
                      }))
                    }
                    placeholder="Enter amount in INR"
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Payment Mode & Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Mode *
                  </label>
                  <select
                    value={donationForm.paymentMode}
                    onChange={(e) =>
                      setDonationForm((prev) => ({
                        ...prev,
                        paymentMode: e.target.value as any,
                        numberOfInstallments:
                          e.target.value === 'Full'
                            ? undefined
                            : prev.numberOfInstallments,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="Full">Full Payment</option>
                    <option value="Installment">Installment Plan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Allocation Category
                  </label>
                  <select
                    value={donationForm.allocationCategory}
                    onChange={(e) =>
                      setDonationForm((prev) => ({
                        ...prev,
                        allocationCategory: e.target.value as any,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="General">General Zakat Pool</option>
                    <option value="Education">Education</option>
                    <option value="Food">Food & Nutrition</option>
                    <option value="Medical">Medical & Health</option>
                    <option value="Emergency">Emergency Relief</option>
                    <option value="Orphans">Orphan Care</option>
                    <option value="Water">Water & Sanitation</option>
                    <option value="Mosque">Mosque & Community</option>
                  </select>
                </div>
              </div>

              {/* Installments */}
              {donationForm.paymentMode === 'Installment' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Installments *
                    </label>
                    <select
                      value={donationForm.numberOfInstallments || ''}
                      onChange={(e) =>
                        setDonationForm((prev) => ({
                          ...prev,
                          numberOfInstallments: parseInt(e.target.value),
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select...</option>
                      {[2, 3, 4, 5, 6, 8, 10, 12].map((num) => (
                        <option key={num} value={num}>
                          {num} Installments (₹
                          {(
                            parseFloat(donationForm.totalAmount || '0') / num
                          ).toFixed(2)}{' '}
                          each)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Frequency
                    </label>
                    <select
                      value={donationForm.recurringFrequency || 'Monthly'}
                      onChange={(e) =>
                        setDonationForm((prev) => ({
                          ...prev,
                          recurringFrequency: e.target.value as any,
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { value: 'UPI', label: '📱 UPI', color: 'blue' },
                    { value: 'Bank', label: '🏦 Bank', color: 'purple' },
                    { value: 'Cash', label: '💵 Cash', color: 'amber' },
                    { value: 'Cheque', label: '📄 Cheque', color: 'indigo' },
                    { value: 'Card', label: '💳 Card', color: 'pink' },
                  ].map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() =>
                        setDonationForm((prev) => ({
                          ...prev,
                          paymentMethod: method.value as any,
                        }))
                      }
                      className={`p-3 rounded-lg border-2 text-center font-medium transition ${
                        donationForm.paymentMethod === method.value
                          ? `border-${method.color}-600 bg-${method.color}-50 text-${method.color}-700`
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional Payment Details */}
              {donationForm.paymentMethod === 'UPI' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    UPI ID
                  </label>
                  <input
                    type="text"
                    value={donationForm.upiId || ''}
                    onChange={(e) =>
                      setDonationForm((prev) => ({
                        ...prev,
                        upiId: e.target.value,
                      }))
                    }
                    placeholder="e.g., 9876543210@upi"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {donationForm.paymentMethod === 'Bank' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Transfer Type
                      </label>
                      <select
                        value={donationForm.bankTransferType || 'NEFT'}
                        onChange={(e) =>
                          setDonationForm((prev) => ({
                            ...prev,
                            bankTransferType: e.target.value as any,
                          }))
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="NEFT">NEFT</option>
                        <option value="Manual">Manual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account Number
                      </label>
                      <input
                        type="text"
                        value={donationForm.accountNumber || ''}
                        onChange={(e) =>
                          setDonationForm((prev) => ({
                            ...prev,
                            accountNumber: e.target.value,
                          }))
                        }
                        placeholder="Last 4 digits"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      value={donationForm.ifscCode || ''}
                      onChange={(e) =>
                        setDonationForm((prev) => ({
                          ...prev,
                          ifscCode: e.target.value,
                        }))
                      }
                      placeholder="e.g., SBIN0001234"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {donationForm.paymentMethod === 'Cheque' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cheque Number
                  </label>
                  <input
                    type="text"
                    value={donationForm.chequeNumber || ''}
                    onChange={(e) =>
                      setDonationForm((prev) => ({
                        ...prev,
                        chequeNumber: e.target.value,
                      }))
                    }
                    placeholder="Enter cheque number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Additional Options */}
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={donationForm.taxReceiptRequired}
                    onChange={(e) =>
                      setDonationForm((prev) => ({
                        ...prev,
                        taxReceiptRequired: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">
                    Tax receipt required (80-G eligible)
                  </span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={donationForm.isRecurring}
                    onChange={(e) =>
                      setDonationForm((prev) => ({
                        ...prev,
                        isRecurring: e.target.checked,
                        recurringFrequency: e.target.checked
                          ? 'Monthly'
                          : undefined,
                      }))
                    }
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">
                    This is a recurring donation
                  </span>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={donationForm.notes || ''}
                  onChange={(e) =>
                    setDonationForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Any additional notes or special instructions..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="w-5 h-5" />
                      Record Donation
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedDonationForm;
