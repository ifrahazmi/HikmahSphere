import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  XMarkIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  BuildingLibraryIcon,
  DocumentTextIcon,
  ArrowUpOnSquareIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import { API_URL } from '../../config';
import toast from 'react-hot-toast';

interface DonorSuggestion {
  id: string;
  name: string;
  type: 'Individual' | 'Organization' | 'Charity';
  contact?: {
    phone?: string;
    email?: string;
    address?: string;
  };
  totalDonated: number;
  donationCount: number;
  lastDonationDate?: string;
}

interface RecordCollectionProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

const RecordCollection: React.FC<RecordCollectionProps> = ({ onSuccess, onClose }) => {
  const [formData, setFormData] = useState({
    donorName: '',
    donorType: 'Individual' as 'Individual' | 'Organization' | 'Charity',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Bank Transfer' as 'Bank Transfer' | 'UPI Transfer' | 'Cash' | 'Cheque' | 'QR Scanner',
    transactionRefId: '',
    bankName: '',
    senderUpiId: '',
    chequeNumber: '',
    notes: '',
  });

  const [selectedDonor, setSelectedDonor] = useState<DonorSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<DonorSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchDonors = useCallback(async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(
          `${API_URL}/zakat/donors?search=${encodeURIComponent(searchTerm)}&limit=5`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );
        const data = await response.json();
        
        if (data.status === 'success') {
          setSuggestions(data.data.donors);
          setShowSuggestions(data.data.donors.length > 0);
          setHighlightedIndex(-1);
        }
      } catch (error) {
        console.error('Donor search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleDonorNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, donorName: value }));
    setSelectedDonor(null);
    searchDonors(value);
  };

  const handleSelectDonor = (donor: DonorSuggestion) => {
    setFormData(prev => ({
      ...prev,
      donorName: donor.name,
      donorType: donor.type,
    }));
    setSelectedDonor(donor);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectDonor(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        break;
    }
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
    if (!formData.donorName.trim()) {
      toast.error('Donor Name is required');
      return false;
    }

    const amount = parseFloat(formData.amount);
    if (!formData.amount || amount <= 0) {
      toast.error('Amount must be greater than 0');
      return false;
    }

    if (!formData.paymentDate) {
      toast.error('Payment Date is required');
      return false;
    }

    const payDate = new Date(formData.paymentDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (payDate > today) {
      toast.error('Payment date cannot be in the future');
      return false;
    }

    if (!formData.paymentMethod) {
      toast.error('Payment Method is required');
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

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();

      formDataToSend.append('type', 'collection');
      formDataToSend.append('donorName', formData.donorName.trim());
      formDataToSend.append('donorType', formData.donorType);
      formDataToSend.append('amount', formData.amount);
      formDataToSend.append('paymentDate', formData.paymentDate);
      formDataToSend.append('paymentMethod', formData.paymentMethod);
      
      if (formData.paymentMethod === 'Bank Transfer') {
        formDataToSend.append('bankName', formData.bankName);
      }
      if (formData.paymentMethod === 'UPI Transfer') {
        formDataToSend.append('senderUpiId', formData.senderUpiId);
      }
      if (formData.paymentMethod === 'Cheque') {
        formDataToSend.append('chequeNumber', formData.chequeNumber);
      }
      if (formData.paymentMethod === 'QR Scanner' || formData.paymentMethod === 'Bank Transfer') {
        formDataToSend.append('transactionRefId', formData.transactionRefId);
      }
      
      if (formData.notes.trim()) {
        formDataToSend.append('notes', formData.notes.trim());
      }

      if (selectedDonor) {
        formDataToSend.append('donorId', selectedDonor.id);
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
        toast.success('Zakat collection recorded successfully!');
        
        setFormData({
          donorName: '',
          donorType: 'Individual',
          amount: '',
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMethod: 'Bank Transfer',
          transactionRefId: '',
          bankName: '',
          senderUpiId: '',
          chequeNumber: '',
          notes: '',
        });
        setSelectedDonor(null);
        setProofFile(null);
        setProofPreview(null);

        if (onSuccess) onSuccess();
        if (onClose) onClose();
      } else {
        if (data.code === 'DUPLICATE_REF_ID') {
          toast.error('This Transaction Ref ID already exists for the selected payment method');
        } else {
          toast.error(data.message || 'Failed to record collection');
        }
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Failed to record collection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const highlightMatch = (name: string, searchTerm: string) => {
    if (!searchTerm) return name;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = name.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? (
        <span key={i} className="bg-yellow-200 font-semibold">{part}</span>
      ) : (
        part
      )
    );
  };

  const isCashPayment = formData.paymentMethod === 'Cash';
  const isBankTransfer = formData.paymentMethod === 'Bank Transfer';
  const isUpiTransfer = formData.paymentMethod === 'UPI Transfer';
  const isCheque = formData.paymentMethod === 'Cheque';
  const isQRScanner = formData.paymentMethod === 'QR Scanner';

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full my-8 shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
              <ArrowUpOnSquareIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Record Zakat Collection</h2>
              <p className="text-sm text-gray-500">Add new zakat payment received</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <XMarkIcon className="w-6 h-6" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Donor Name with Autocomplete */}
          <div className="relative" ref={suggestionsRef}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Donor Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={formData.donorName}
                onChange={handleDonorNameChange}
                onKeyDown={handleKeyDown}
                placeholder="Start typing donor name..."
                className="w-full px-4 py-3 pr-10 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                autoComplete="off"
                required
              />
              {isSearching && (
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 animate-pulse" />
              )}
            </div>

            {showSuggestions && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                {suggestions.map((donor, index) => (
                  <button
                    key={donor.id}
                    type="button"
                    onClick={() => handleSelectDonor(donor)}
                    className={`w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors ${
                      index === highlightedIndex ? 'bg-emerald-50' : ''
                    } ${index > 0 ? 'border-t border-gray-100' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {highlightMatch(donor.name, formData.donorName)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            donor.type === 'Individual'
                              ? 'bg-blue-100 text-blue-700'
                              : donor.type === 'Charity'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {donor.type === 'Individual' ? (
                              <span className="flex items-center gap-1">
                                <UserGroupIcon className="w-3 h-3" /> Individual
                              </span>
                            ) : donor.type === 'Charity' ? (
                              <span className="flex items-center gap-1">
                                <BuildingLibraryIcon className="w-3 h-3" /> Charity
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <BuildingOfficeIcon className="w-3 h-3" /> Organization
                              </span>
                            )}
                          </span>
                          {donor.totalDonated > 0 && (
                            <span className="text-xs text-emerald-600 font-medium">
                              Total Donated: ₹{donor.totalDonated.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
                      {selectedDonor?.id === donor.id && (
                        <CheckCircleSolidIcon className="w-5 h-5 text-emerald-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedDonor && (
              <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-emerald-800">
                  <CheckCircleIcon className="w-4 h-4" />
                  <span className="font-medium">Existing donor selected</span>
                  <span className="text-emerald-600">
                    ({selectedDonor.donationCount} donations, ₹{selectedDonor.totalDonated.toLocaleString('en-IN')} total)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Donor Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Donor Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleInputChange('donorType', 'Individual')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                  formData.donorType === 'Individual'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <UserGroupIcon className="w-5 h-5" />
                Individual
              </button>
              <button
                type="button"
                onClick={() => handleInputChange('donorType', 'Organization')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                  formData.donorType === 'Organization'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <BuildingOfficeIcon className="w-5 h-5" />
                Organization
              </button>
              <button
                type="button"
                onClick={() => handleInputChange('donorType', 'Charity')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                  formData.donorType === 'Charity'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <BuildingLibraryIcon className="w-5 h-5" />
                Charity
              </button>
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.paymentDate}
                onChange={(e) => handleInputChange('paymentDate', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              required
            >
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="UPI Transfer">UPI Transfer</option>
              <option value="Cash">Cash</option>
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Transaction Ref ID (Last 6 Digits)
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono tracking-wider"
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono tracking-wider"
                  required
                />
              </div>
            </>
          )}

          {isCheque && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Cheque Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.chequeNumber}
                onChange={(e) => handleInputChange('chequeNumber', e.target.value)}
                placeholder="Enter cheque number"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono tracking-wider"
                required
              />
            </div>
          )}

          {/* Proof of Payment Upload (Optional) */}
          {!isCashPayment && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Proof of Payment (Optional)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-emerald-500 transition-colors">
                <input
                  type="file"
                  id="proof-upload"
                  onChange={handleFileChange}
                  accept=".png,.jpg,.jpeg,.pdf"
                  className="hidden"
                />
                <label htmlFor="proof-upload" className="cursor-pointer">
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
                      <p className="text-sm text-emerald-600 font-medium">Click to change</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <ArrowUpOnSquareIcon className="w-10 h-10 text-gray-400 mx-auto" />
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold text-emerald-600">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG, PDF (Max 5MB)</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          )}

          {isCashPayment && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-3">
                <ExclamationCircleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Cash Payment</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Proof of payment is optional for cash transactions. Transaction Ref ID is not required.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Notes / Purpose</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Optional notes about this collection..."
              rows={3}
              maxLength={1000}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
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
              className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-5 h-5" />
                  Record Collection
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordCollection;
