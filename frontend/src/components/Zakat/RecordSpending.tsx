import React, { useState } from 'react';
import {
  XMarkIcon,
  UserGroupIcon,
  HomeIcon,
  BuildingOfficeIcon,
  AcademicCapIcon,
  BuildingLibraryIcon,
  DocumentTextIcon,
  ArrowDownOnSquareIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { API_URL } from '../../config';
import toast from 'react-hot-toast';

interface RecipientTypeOption {
  value: 'Individual' | 'Family' | 'Mosque' | 'Madrasa' | 'NGO' | 'Other';
  label: string;
  icon: React.ReactNode;
}

const RECIPIENT_TYPES: RecipientTypeOption[] = [
  { value: 'Individual', label: 'Individual', icon: <UserGroupIcon className="w-5 h-5" /> },
  { value: 'Family', label: 'Family', icon: <HomeIcon className="w-5 h-5" /> },
  { value: 'Mosque', label: 'Mosque', icon: <BuildingLibraryIcon className="w-5 h-5" /> },
  { value: 'Madrasa', label: 'Madrasa', icon: <AcademicCapIcon className="w-5 h-5" /> },
  { value: 'NGO', label: 'NGO', icon: <BuildingOfficeIcon className="w-5 h-5" /> },
  { value: 'Other', label: 'Other', icon: <UserGroupIcon className="w-5 h-5" /> },
];

interface RecordSpendingProps {
  currentBalance: number;
  onSuccess?: () => void;
  onClose?: () => void;
}

const RecordSpending: React.FC<RecordSpendingProps> = ({ currentBalance, onSuccess, onClose }) => {
  const [formData, setFormData] = useState({
    recipientName: '',
    recipientType: 'Individual' as 'Individual' | 'Family' | 'Mosque' | 'Madrasa' | 'NGO' | 'Other',
    amount: '',
    spendingDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash' as 'Bank Transfer' | 'UPI Transfer' | 'Cash' | 'Cheque' | 'QR Scanner',
    bankName: '',
    senderUpiId: '',
    chequeNumber: '',
    transactionRefId: '',
    category: '',
    notes: '',
  });

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PNG, JPG, and PDF files are allowed');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      e.target.value = '';
      return;
    }

    setProofFile(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setProofPreview(null);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.recipientName.trim()) {
      toast.error('Recipient Name is required');
      return false;
    }

    if (!formData.recipientType) {
      toast.error('Recipient Type is required');
      return false;
    }

    const amount = parseFloat(formData.amount);
    if (!formData.amount || amount <= 0) {
      toast.error('Amount must be greater than 0');
      return false;
    }

    if (!formData.spendingDate) {
      toast.error('Spending Date is required');
      return false;
    }

    const spendDate = new Date(formData.spendingDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (spendDate > today) {
      toast.error('Spending date cannot be in the future');
      return false;
    }

    // Payment method specific validation
    if (formData.paymentMethod === 'Bank Transfer') {
      if (!formData.bankName || !formData.bankName.trim()) {
        toast.error('Bank Name is required for Bank Transfer');
        return false;
      }
      if (!formData.transactionRefId || !/^\d{6}$/.test(formData.transactionRefId)) {
        toast.error('Transaction Ref ID must be exactly 6 digits');
        return false;
      }
    }

    if (formData.paymentMethod === 'UPI Transfer') {
      if (!formData.senderUpiId || !formData.senderUpiId.trim()) {
        toast.error('Sender UPI ID is required for UPI Transfer');
        return false;
      }
      if (!formData.transactionRefId || !/^\d{6}$/.test(formData.transactionRefId)) {
        toast.error('Transaction Ref ID must be exactly 6 digits');
        return false;
      }
    }

    if (formData.paymentMethod === 'Cheque') {
      if (!formData.chequeNumber || !formData.chequeNumber.trim()) {
        toast.error('Cheque Number is required');
        return false;
      }
      if (!formData.transactionRefId || !/^\d{6}$/.test(formData.transactionRefId)) {
        toast.error('Transaction Ref ID must be exactly 6 digits');
        return false;
      }
    }

    if (formData.paymentMethod === 'QR Scanner') {
      if (!formData.transactionRefId || !/^\d{6}$/.test(formData.transactionRefId)) {
        toast.error('Transaction Ref ID must be exactly 6 digits');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Check if amount exceeds current balance
    const amount = parseFloat(formData.amount);
    if (amount > currentBalance) {
      toast.error(`Insufficient balance. Available: ₹${currentBalance.toLocaleString('en-IN')}, Requested: ₹${amount.toLocaleString('en-IN')}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();

      formDataToSend.append('type', 'spending');
      formDataToSend.append('recipientName', formData.recipientName.trim());
      formDataToSend.append('recipientType', formData.recipientType);
      formDataToSend.append('amount', formData.amount);
      formDataToSend.append('paymentDate', formData.spendingDate);
      formDataToSend.append('paymentMethod', formData.paymentMethod);

      if (formData.paymentMethod === 'Bank Transfer') {
        formDataToSend.append('bankName', formData.bankName);
      }
      if (formData.paymentMethod === 'UPI Transfer') {
        formDataToSend.append('senderUpiId', formData.senderUpiId);
        formDataToSend.append('transactionRefId', formData.transactionRefId);
      }
      if (formData.paymentMethod === 'Cheque') {
        formDataToSend.append('chequeNumber', formData.chequeNumber);
      }
      if (formData.paymentMethod === 'QR Scanner') {
        formDataToSend.append('transactionRefId', formData.transactionRefId);
      }

      if (formData.category) {
        formDataToSend.append('notes', `Category: ${formData.category}\n${formData.notes}`);
      } else if (formData.notes.trim()) {
        formDataToSend.append('notes', formData.notes.trim());
      }

      if (proofFile) {
        formDataToSend.append('proofOfPayment', proofFile);
      }

      const response = await fetch(`${API_URL}/zakat/transaction`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formDataToSend,
      });

      const data = await response.json();

      if (data.status === 'success') {
        toast.success('Zakat spending recorded successfully!');
        
        setFormData({
          recipientName: '',
          recipientType: 'Individual',
          amount: '',
          spendingDate: new Date().toISOString().split('T')[0],
          paymentMethod: 'Cash',
          bankName: '',
          senderUpiId: '',
          chequeNumber: '',
          transactionRefId: '',
          category: '',
          notes: '',
        });
        setProofFile(null);
        setProofPreview(null);

        if (onSuccess) onSuccess();
        if (onClose) onClose();
      } else {
        if (data.code === 'INSUFFICIENT_BALANCE') {
          toast.error(`Insufficient balance. Available: ₹${data.data?.availableBalance.toLocaleString('en-IN')}`);
        } else {
          toast.error(data.message || 'Failed to record spending');
        }
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Failed to record spending. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBankTransfer = formData.paymentMethod === 'Bank Transfer';
  const isUpiTransfer = formData.paymentMethod === 'UPI Transfer';
  const isCheque = formData.paymentMethod === 'Cheque';
  const isQRScanner = formData.paymentMethod === 'QR Scanner';

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full my-8 shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
              <ArrowDownOnSquareIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Record Zakat Spending</h2>
              <p className="text-sm text-gray-500">Distribute zakat to recipients</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <XMarkIcon className="w-6 h-6" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Recipient Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Recipient Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.recipientName}
              onChange={(e) => handleInputChange('recipientName', e.target.value)}
              placeholder="Enter recipient name"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
              required
            />
          </div>

          {/* Recipient Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Recipient Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {RECIPIENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleInputChange('recipientType', type.value)}
                  className={`flex flex-col items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                    formData.recipientType === type.value
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {type.icon}
                  <span className="text-sm font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount and Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder="Enter amount"
                min="0.01"
                step="0.01"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Spending Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.spendingDate}
                onChange={(e) => handleInputChange('spendingDate', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                required
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
              required
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="UPI Transfer">UPI Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="QR Scanner">QR Scanner</option>
            </select>
          </div>

          {/* Payment Method Specific Fields */}
          {isBankTransfer && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Bank Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => handleInputChange('bankName', e.target.value)}
                  placeholder="e.g., State Bank of India, HDFC Bank"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Transaction Ref ID (Last 6 Digits) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.transactionRefId}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    handleInputChange('transactionRefId', value);
                  }}
                  placeholder="Enter 6-digit reference"
                  maxLength={6}
                  pattern="\d{6}"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono tracking-wider"
                  required
                />
              </div>
            </>
          )}

          {isUpiTransfer && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sender UPI ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.senderUpiId}
                  onChange={(e) => handleInputChange('senderUpiId', e.target.value)}
                  placeholder="e.g., username@oksbi"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Transaction Ref ID (Last 6 Digits) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.transactionRefId}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    handleInputChange('transactionRefId', value);
                  }}
                  placeholder="Enter 6-digit reference"
                  maxLength={6}
                  pattern="\d{6}"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono tracking-wider"
                  required
                />
              </div>
            </>
          )}

          {isCheque && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cheque Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.chequeNumber}
                  onChange={(e) => handleInputChange('chequeNumber', e.target.value)}
                  placeholder="Enter cheque number"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Transaction Ref ID (Last 6 Digits) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.transactionRefId}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    handleInputChange('transactionRefId', value);
                  }}
                  placeholder="Enter 6-digit reference"
                  maxLength={6}
                  pattern="\d{6}"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono tracking-wider"
                  required
                />
              </div>
            </>
          )}

          {isQRScanner && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Transaction Ref ID (Last 6 Digits) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.transactionRefId}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  handleInputChange('transactionRefId', value);
                }}
                placeholder="Enter 6-digit reference"
                maxLength={6}
                pattern="\d{6}"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono tracking-wider"
                required
              />
            </div>
          )}

          {/* Category (Optional) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Category (Optional)</label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              placeholder="e.g., Food, Education, Medical, Emergency Relief"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          {/* Supporting Document Upload (Optional) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Supporting Document (Optional)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-red-500 transition-colors">
              <input
                type="file"
                id="spending-proof-upload"
                onChange={handleFileChange}
                accept=".png,.jpg,.jpeg,.pdf"
                className="hidden"
              />
              <label htmlFor="spending-proof-upload" className="cursor-pointer">
                {proofPreview ? (
                  <div className="space-y-2">
                    {proofPreview.startsWith('data:image') ? (
                      <img src={proofPreview} alt="Preview" className="max-h-40 mx-auto rounded-lg" />
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-gray-600">
                        <DocumentTextIcon className="w-8 h-8" />
                        <span className="text-sm">{proofFile?.name}</span>
                      </div>
                    )}
                    <p className="text-sm text-red-600 font-medium">Click to change</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ArrowDownOnSquareIcon className="w-10 h-10 text-gray-400 mx-auto" />
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold text-red-600">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, PDF (Max 5MB) - Optional</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Optional notes about this distribution..."
              rows={3}
              maxLength={1000}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
            />
            <p className="text-xs text-gray-500 text-right mt-1">
              {formData.notes.length}/1000 characters
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl hover:from-red-700 hover:to-orange-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-5 h-5" />
                  Record Spending
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordSpending;
