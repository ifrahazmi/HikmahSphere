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
import { MAX_UPLOAD_SIZE_BYTES, optimizeImageForUpload, readFileAsDataUrl } from '../../utils/imageUpload';

interface ContributorSuggestion {
  id: string;
  name: string;
  type: 'Individual' | 'Organization' | 'Charity';
  contact?: {
    phone?: string;
    email?: string;
    address?: string;
  };
  totalContributed: number;
  contributionCount: number;
  lastContributionDate?: string;
}

interface RecordMaktabCollectionProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

const RecordMaktabCollection: React.FC<RecordMaktabCollectionProps> = ({ onSuccess, onClose }) => {
  const [formData, setFormData] = useState({
    contributorName: '',
    contributorType: 'Individual' as 'Individual' | 'Organization' | 'Charity',
    contributionFrequency: 'One-time' as 'One-time' | 'Monthly',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Bank Transfer' as 'Bank Transfer' | 'UPI Transfer' | 'Cash' | 'Cheque' | 'QR Scanner',
    transactionRefId: '',
    bankName: '',
    senderUpiId: '',
    chequeNumber: '',
    notes: '',
  });

  const [selectedContributor, setSelectedContributor] = useState<ContributorSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<ContributorSuggestion[]>([]);
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

  const searchContributors = useCallback(async (searchTerm: string) => {
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
          `${API_URL}/maktab/contributors?search=${encodeURIComponent(searchTerm)}&limit=5`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );
        const data = await response.json();

        if (data.status === 'success') {
          setSuggestions(data.data.contributors);
          setShowSuggestions(data.data.contributors.length > 0);
          setHighlightedIndex(-1);
        }
      } catch (error) {
        console.error('Contributor search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleContributorNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, contributorName: value }));
    setSelectedContributor(null);
    searchContributors(value);
  };

  const handleSelectContributor = (contributor: ContributorSuggestion) => {
    setFormData(prev => ({
      ...prev,
      contributorName: contributor.name,
      contributorType: contributor.type,
    }));
    setSelectedContributor(contributor);
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
          handleSelectContributor(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PNG, JPG, and PDF files are allowed');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.error('File size must be 2MB or smaller');
      e.target.value = '';
      return;
    }

    try {
      const finalFile = file.type.startsWith('image/') ? await optimizeImageForUpload(file) : file;
      setProofFile(finalFile);

      if (finalFile.type.startsWith('image/')) {
        const previewUrl = await readFileAsDataUrl(finalFile);
        setProofPreview(previewUrl);
      } else {
        setProofPreview(null);
      }
    } catch (error) {
      console.error('Proof optimization failed:', error);
      toast.error('Failed to process file. Please try again.');
      e.target.value = '';
    }
  };

  const validateForm = (): boolean => {
    if (!formData.contributorName.trim()) {
      toast.error('Contributor Name is required');
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

    if (formData.paymentMethod === 'Bank Transfer') {
      if (!formData.bankName || !formData.bankName.trim()) {
        toast.error('Bank Name is required for Bank Transfer');
        return false;
      }
    }

    if (formData.paymentMethod === 'UPI Transfer') {
      if (!formData.senderUpiId || !formData.senderUpiId.trim()) {
        toast.error('Sender UPI ID is required for UPI Transfer');
        return false;
      }
      if (!/^\d+@[a-zA-Z]+$/.test(formData.senderUpiId)) {
        toast.error('UPI ID must be in format: number@bank (e.g., 9876543210@oksbi)');
        return false;
      }
      if (!formData.transactionRefId || !/^\d{6,}$/.test(formData.transactionRefId)) {
        toast.error('Transaction Ref ID is required (minimum 6 digits)');
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
      if (!formData.transactionRefId || !/^\d{6,}$/.test(formData.transactionRefId)) {
        toast.error('Transaction Ref ID is required (minimum 6 digits)');
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
      formDataToSend.append('contributorName', formData.contributorName.trim());
      formDataToSend.append('contributorType', formData.contributorType);
      formDataToSend.append('contributionFrequency', formData.contributionFrequency);
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
      if (formData.paymentMethod === 'QR Scanner' || formData.paymentMethod === 'Bank Transfer' || formData.paymentMethod === 'UPI Transfer') {
        formDataToSend.append('transactionRefId', formData.transactionRefId);
      }

      if (formData.notes.trim()) {
        formDataToSend.append('notes', formData.notes.trim());
      }

      if (selectedContributor) {
        formDataToSend.append('contributorId', selectedContributor.id);
      }

      if (proofFile) {
        formDataToSend.append('proofOfPayment', proofFile);
      }

      const response = await fetch(`${API_URL}/maktab/transaction`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formDataToSend,
      });

      const data = await response.json();

      if (data.status === 'success') {
        toast.success('Maktab contribution recorded successfully!');

        setFormData({
          contributorName: '',
          contributorType: 'Individual',
          contributionFrequency: 'One-time',
          amount: '',
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMethod: 'Bank Transfer',
          transactionRefId: '',
          bankName: '',
          senderUpiId: '',
          chequeNumber: '',
          notes: '',
        });
        setSelectedContributor(null);
        setProofFile(null);
        setProofPreview(null);

        if (onSuccess) onSuccess();
        if (onClose) onClose();
      } else {
        if (data.code === 'DUPLICATE_REF_ID') {
          toast.error('This Transaction Ref ID already exists for the selected payment method');
        } else {
          toast.error(data.message || 'Failed to record contribution');
        }
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Failed to record contribution. Please try again.');
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
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl sm:my-8 shadow-2xl lg:max-w-xl max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <ArrowUpOnSquareIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">Record Maktab Contribution</h2>
              <p className="text-xs text-gray-500 truncate">Add new maktab contribution</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg flex-shrink-0">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* Contributor Name with Autocomplete */}
          <div className="relative" ref={suggestionsRef}>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
              Contributor Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={formData.contributorName}
                onChange={handleContributorNameChange}
                onKeyDown={handleKeyDown}
                placeholder="Start typing contributor name..."
                className="w-full px-3 sm:px-4 py-2.5 pr-10 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm sm:text-base"
                autoComplete="off"
                required
              />
              {isSearching && (
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 animate-pulse" />
              )}
            </div>

            {showSuggestions && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                {suggestions.map((contributor, index) => (
                  <button
                    key={contributor.id}
                    type="button"
                    onClick={() => handleSelectContributor(contributor)}
                    className={`w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors ${
                      index === highlightedIndex ? 'bg-indigo-50' : ''
                    } ${index > 0 ? 'border-t border-gray-100' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {highlightMatch(contributor.name, formData.contributorName)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            contributor.type === 'Individual'
                              ? 'bg-blue-100 text-blue-700'
                              : contributor.type === 'Charity'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {contributor.type === 'Individual' ? (
                              <span className="flex items-center gap-1">
                                <UserGroupIcon className="w-3 h-3" /> Individual
                              </span>
                            ) : contributor.type === 'Charity' ? (
                              <span className="flex items-center gap-1">
                                <BuildingLibraryIcon className="w-3 h-3" /> Charity
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <BuildingOfficeIcon className="w-3 h-3" /> Organization
                              </span>
                            )}
                          </span>
                          {contributor.totalContributed > 0 && (
                            <span className="text-xs text-indigo-600 font-medium">
                              Total Contributed: ₹{contributor.totalContributed.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
                      {selectedContributor?.id === contributor.id && (
                        <CheckCircleSolidIcon className="w-5 h-5 text-indigo-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedContributor && (
              <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-indigo-800">
                  <CheckCircleIcon className="w-4 h-4" />
                  <span className="font-medium">Existing contributor selected</span>
                  <span className="text-indigo-600">
                    ({selectedContributor.contributionCount} contributions, ₹{selectedContributor.totalContributed.toLocaleString('en-IN')} total)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Contributor Type */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">Contributor Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleInputChange('contributorType', 'Individual')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2.5 rounded-xl border-2 transition-all text-xs sm:text-sm ${
                  formData.contributorType === 'Individual'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <UserGroupIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Individual</span>
                <span className="sm:hidden">Ind</span>
              </button>
              <button
                type="button"
                onClick={() => handleInputChange('contributorType', 'Organization')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2.5 rounded-xl border-2 transition-all text-xs sm:text-sm ${
                  formData.contributorType === 'Organization'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <BuildingOfficeIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Organization</span>
                <span className="sm:hidden">Org</span>
              </button>
              <button
                type="button"
                onClick={() => handleInputChange('contributorType', 'Charity')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2.5 rounded-xl border-2 transition-all text-xs sm:text-sm ${
                  formData.contributorType === 'Charity'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <BuildingLibraryIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Charity</span>
                <span className="sm:hidden">Char</span>
              </button>
            </div>
          </div>

          {/* Contribution Frequency */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
              Contribution Frequency <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleInputChange('contributionFrequency', 'One-time')}
                className={`px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  formData.contributionFrequency === 'One-time'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                One-time
              </button>
              <button
                type="button"
                onClick={() => handleInputChange('contributionFrequency', 'Monthly')}
                className={`px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  formData.contributionFrequency === 'Monthly'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>

          {/* Amount and Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder="Enter amount"
                min="0.01"
                step="0.01"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Transaction Ref ID (Minimum 6 Digits)
                </label>
                <input
                  type="text"
                  value={formData.transactionRefId}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    handleInputChange('transactionRefId', value);
                  }}
                  placeholder="Enter reference ID (min 6 digits)"
                  pattern="\d{6,}"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono tracking-wider"
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
                  placeholder="e.g., 9876543210@oksbi"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Transaction Ref ID (Minimum 6 Digits) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.transactionRefId}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    handleInputChange('transactionRefId', value);
                  }}
                  placeholder="Enter reference ID (min 6 digits)"
                  pattern="\d{6,}"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono tracking-wider"
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
          )}

          {isQRScanner && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Transaction Ref ID (Minimum 6 Digits) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.transactionRefId}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  handleInputChange('transactionRefId', value);
                }}
                placeholder="Enter reference ID (min 6 digits)"
                pattern="\d{6,}"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono tracking-wider"
                required
              />
            </div>
          )}

          {/* Proof of Payment Upload (Optional) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Proof of Payment (Optional)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-indigo-500 transition-colors">
                <input
                  type="file"
                  id="maktab-proof-upload"
                  onChange={handleFileChange}
                  accept=".png,.jpg,.jpeg,.pdf"
                  className="hidden"
                />
                <label htmlFor="maktab-proof-upload" className="cursor-pointer">
                  {proofPreview ? (
                    <div className="space-y-2 relative">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setProofFile(null);
                          setProofPreview(null);
                        }}
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 z-10"
                        title="Remove proof"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      {proofPreview.startsWith('data:image') ? (
                        <img src={proofPreview} alt="Preview" className="max-h-40 mx-auto rounded-lg" />
                      ) : (
                        <div className="flex items-center justify-center gap-2 text-gray-600">
                          <DocumentTextIcon className="w-8 h-8" />
                          <span className="text-sm">{proofFile?.name}</span>
                        </div>
                      )}
                      <p className="text-sm text-indigo-600 font-medium">Click to change</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <ArrowUpOnSquareIcon className="w-10 h-10 text-gray-400 mx-auto" />
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG, PDF (Max 2MB)</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

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
              placeholder="Optional notes about this contribution..."
              rows={3}
              maxLength={1000}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
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
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl hover:from-indigo-700 hover:to-violet-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-5 h-5" />
                  Record Contribution
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordMaktabCollection;
