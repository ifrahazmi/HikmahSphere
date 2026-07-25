import React, { useState, useEffect, useRef } from 'react';
import {
  PencilIcon,
  XMarkIcon,
  DocumentArrowDownIcon,
  CurrencyRupeeIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowUpOnSquareIcon,
  ArrowDownOnSquareIcon,
  TrashIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { API_URL } from '../../config';
import toast from 'react-hot-toast';
import { MAX_UPLOAD_SIZE_BYTES, optimizeImageForUpload, readFileAsDataUrl } from '../../utils/imageUpload';
import RecordMaktabCollection from './RecordMaktabCollection';
import RecordMaktabSpending from './RecordMaktabSpending';
import MaktabContributorSummary from './MaktabContributorSummary';

type SpendingCategory = 'Teacher Salary' | 'Books/Stationery' | 'Uniform' | 'Rent' | 'Utilities' | 'Other';

interface MaktabTransaction {
  _id: string;
  type: 'collection' | 'spending';
  contributorId?: {
    _id: string;
    name: string;
    type: string;
    totalContributed: number;
  };
  contributorName?: string;
  contributorType?: string;
  contributionFrequency?: 'One-time' | 'Monthly';
  recipientName?: string;
  recipientType?: string;
  category?: SpendingCategory;
  studentCount?: number;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  transactionRefId?: string;
  bankName?: string;
  senderUpiId?: string;
  chequeNumber?: string;
  proofFilePath?: string;
  notes?: string;
  createdAt: string;
}

interface MaktabStats {
  totalCollected: number;
  totalSpent: number;
  currentBalance: number;
}

interface MaktabManagementProps {
  onClose?: () => void;
  showStats?: boolean;
  showExport?: boolean;
  showDelete?: boolean;
  showContributorSummary?: boolean;
  showRecordButtons?: boolean;
  showFilters?: boolean;
  showHeader?: boolean;
}

const SPENDING_CATEGORIES: SpendingCategory[] = [
  'Teacher Salary',
  'Books/Stationery',
  'Uniform',
  'Rent',
  'Utilities',
  'Other',
];

const MaktabManagement: React.FC<MaktabManagementProps> = ({
  onClose,
  showStats = true,
  showExport = true,
  showDelete = true,
  showContributorSummary = true,
  showRecordButtons = true,
  showFilters = true,
  showHeader = true
}) => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(['superadmin', 'manager']);

  const [maktabStats, setMaktabStats] = useState<MaktabStats>({
    totalCollected: 0,
    totalSpent: 0,
    currentBalance: 0,
  });
  const [maktabTransactions, setMaktabTransactions] = useState<MaktabTransaction[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<MaktabTransaction | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingTransaction, setViewingTransaction] = useState<MaktabTransaction | null>(null);
  const [showProofPreview, setShowProofPreview] = useState(false);
  const [previewProofPath, setPreviewProofPath] = useState('');
  const [clickedProofPath, setClickedProofPath] = useState<string | null>(null);

  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [showSpendingModal, setShowSpendingModal] = useState(false);
  const [editProofFile, setEditProofFile] = useState<File | null>(null);
  const [editProofPreview, setEditProofPreview] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<'all' | 'collection' | 'spending'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | SpendingCategory>('all');
  const [filterFrequency, setFilterFrequency] = useState<'all' | 'One-time' | 'Monthly'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [showExportOptions, setShowExportOptions] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportOptions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchMaktabData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [statsRes, transRes] = await Promise.all([
        fetch(`${API_URL}/maktab/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/maktab/payments?limit=1000`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const statsData = await statsRes.json();
      const transData = await transRes.json();

      if (statsData.status === 'success') {
        setMaktabStats(statsData.data);
      }
      if (transData.status === 'success') {
        setMaktabTransactions(transData.data.payments);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load Maktab data');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/maktab/payment/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.status === 'success') {
        toast.success('Transaction deleted successfully');
        fetchMaktabData();
      } else {
        toast.error(data.message || 'Delete failed');
      }
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();

      formData.append('type', editingTransaction.type);
      formData.append('amount', editingTransaction.amount.toString());
      formData.append('paymentDate', new Date(editingTransaction.paymentDate).toISOString().split('T')[0]);
      formData.append('paymentMethod', editingTransaction.paymentMethod);

      if (editingTransaction.type === 'collection') {
        formData.append('contributorName', editingTransaction.contributorName || '');
        formData.append('contributorType', editingTransaction.contributorType || 'Individual');
        formData.append('contributionFrequency', editingTransaction.contributionFrequency || 'One-time');
      } else {
        formData.append('recipientName', editingTransaction.recipientName || '');
        formData.append('recipientType', editingTransaction.recipientType || 'Teacher');
        formData.append('category', editingTransaction.category || 'Other');
        if (editingTransaction.studentCount !== undefined && editingTransaction.studentCount !== null) {
          formData.append('studentCount', editingTransaction.studentCount.toString());
        }
      }

      if (editingTransaction.bankName) formData.append('bankName', editingTransaction.bankName);
      if (editingTransaction.senderUpiId) formData.append('senderUpiId', editingTransaction.senderUpiId);
      if (editingTransaction.chequeNumber) formData.append('chequeNumber', editingTransaction.chequeNumber);
      if (editingTransaction.transactionRefId) formData.append('transactionRefId', editingTransaction.transactionRefId);
      if (editingTransaction.notes) formData.append('notes', editingTransaction.notes);
      if (editProofFile) formData.append('proofOfPayment', editProofFile);
      if (!editingTransaction.proofFilePath && !editProofFile) {
        formData.append('removeProof', 'true');
      }

      const response = await fetch(`${API_URL}/maktab/payment/${editingTransaction._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await response.json();
      if (data.status === 'success') {
        toast.success('Transaction updated successfully');
        setShowEditModal(false);
        setEditProofFile(null);
        setEditProofPreview(null);
        fetchMaktabData();
      } else {
        toast.error(data.message || 'Update failed');
      }
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const csvEscape = (value: unknown): string => {
    const text = value == null ? '' : String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const buildMaktabExportRows = () =>
    maktabTransactions.map((t) => {
      const isCollection = t.type === 'collection';
      const proofStatus = t.proofFilePath ? 'Image is present' : 'No';
      return {
        paymentDate: t.paymentDate
          ? new Date(t.paymentDate).toLocaleDateString('en-IN')
          : '',
        recordedAt: t.createdAt
          ? new Date(t.createdAt).toLocaleString('en-IN')
          : '',
        type: isCollection ? 'Contribution' : 'Spending',
        partyName: isCollection ? (t.contributorName || '') : (t.recipientName || ''),
        partyType: isCollection ? (t.contributorType || '') : (t.recipientType || ''),
        frequency: isCollection ? (t.contributionFrequency || 'One-time') : '',
        category: !isCollection ? (t.category || 'Other') : '',
        studentsSupported: !isCollection && t.studentCount != null ? t.studentCount : '',
        amount: t.amount,
        paymentMethod: t.paymentMethod || '',
        bankName: t.bankName || '',
        senderUpiId: t.senderUpiId || '',
        chequeNumber: t.chequeNumber || '',
        transactionRefId: t.transactionRefId || '',
        notes: t.notes || '',
        proofOfPayment: proofStatus,
      };
    });

  const exportToCSV = () => {
    const rows = buildMaktabExportRows();
    const headers = [
      'Payment Date',
      'Recorded At',
      'Type',
      'Party Name',
      'Party Type',
      'Frequency',
      'Category',
      'Students Supported',
      'Amount',
      'Payment Method',
      'Bank Name',
      'Sender UPI ID',
      'Cheque Number',
      'Reference ID',
      'Notes',
      'Proof of Payment',
    ];
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        [
          row.paymentDate,
          row.recordedAt,
          row.type,
          row.partyName,
          row.partyType,
          row.frequency,
          row.category,
          row.studentsSupported,
          row.amount,
          row.paymentMethod,
          row.bankName,
          row.senderUpiId,
          row.chequeNumber,
          row.transactionRefId,
          row.notes,
          row.proofOfPayment,
        ].map(csvEscape).join(','),
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `maktab_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    setShowExportOptions(false);
    toast.success('CSV exported successfully');
  };

  const exportToJSON = () => {
    const exportData = buildMaktabExportRows();
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `maktab_transactions_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    setShowExportOptions(false);
    toast.success('JSON exported successfully');
  };

  // Listen for export events from the Funds Management header
  useEffect(() => {
    const handleExportCSV = () => exportToCSV();
    const handleExportJSON = () => exportToJSON();

    window.addEventListener('export-maktab-csv', handleExportCSV);
    window.addEventListener('export-maktab-json', handleExportJSON);

    return () => {
      window.removeEventListener('export-maktab-csv', handleExportCSV);
      window.removeEventListener('export-maktab-json', handleExportJSON);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maktabTransactions]);

  const matchesSearchFilter = (transaction: MaktabTransaction) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    const name = transaction.type === 'collection' ? transaction.contributorName : transaction.recipientName;
    const tag = transaction.type === 'collection'
      ? (transaction.contributionFrequency || '')
      : (transaction.category || '');

    return name?.toLowerCase().includes(searchLower) ||
      tag.toLowerCase().includes(searchLower) ||
      transaction.transactionRefId?.includes(searchTerm) ||
      transaction.chequeNumber?.includes(searchTerm) ||
      transaction.notes?.toLowerCase().includes(searchLower);
  };

  const typeAndSearchFiltered = maktabTransactions.filter((transaction) => {
    if (filterType !== 'all' && transaction.type !== filterType) return false;
    if (filterFrequency !== 'all') {
      if (transaction.type !== 'collection') return false;
      if ((transaction.contributionFrequency || 'One-time') !== filterFrequency) return false;
    }
    return matchesSearchFilter(transaction);
  });

  const filteredTransactions = typeAndSearchFiltered.filter((transaction) => {
    if (filterCategory === 'all') return true;
    if (transaction.type !== 'spending') return false;
    return (transaction.category || 'Other') === filterCategory;
  });

  useEffect(() => {
    fetchMaktabData();
  }, []);

  const canDelete = isAdmin && showDelete;
  const canExport = isAdmin && showExport;
  const canViewStats = isAdmin && showStats;

  const getPaymentDetails = (t: MaktabTransaction) => {
    const details: string[] = [];
    if (t.bankName) details.push(t.bankName);
    if (t.senderUpiId) details.push(`UPI: ${t.senderUpiId}`);
    if (t.chequeNumber) details.push(`Cheque: ${t.chequeNumber}`);
    if (t.transactionRefId) details.push(`Ref: ${t.transactionRefId}`);
    return details.join(' • ') || t.paymentMethod;
  };

  const handleProofClick = (e: React.MouseEvent, proofPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setPreviewProofPath(proofPath);
    setClickedProofPath(proofPath);
    setShowProofPreview(true);
  };

  const handleProofClose = () => {
    setShowProofPreview(false);
    setClickedProofPath(null);
  };

  const handleDownloadProof = async (proofPath: string) => {
    try {
      const cleanPath = proofPath.replace(/^\/+/, '');
      const response = await fetch(`/${cleanPath}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = proofPath.split('/').pop() || 'proof-document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    }
  };

  useEffect(() => {
    const handleClickOutside = () => {
      if (showProofPreview && clickedProofPath) {
        handleProofClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProofPreview, clickedProofPath]);

  return (
    <div className="space-y-6">
      {/* Header */}
      {showHeader && (
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Maktab Collection Management</h2>
            <p className="text-sm text-gray-500 mt-1">Manage maktab contributions and expenses (teacher salary, books, etc.)</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          )}
        </div>
      )}

      {/* Stats Cards - Admin Only */}
      {canViewStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-green-500 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <ArrowUpIcon className="h-4 w-4 text-green-600" />
                  Total Collected
                </p>
                <p className="text-3xl font-bold text-green-700 mt-2">
                  ₹{maktabStats.totalCollected.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                <ArrowUpOnSquareIcon className="h-7 w-7 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-red-500 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <ArrowDownIcon className="h-4 w-4 text-red-600" />
                  Total Spent
                </p>
                <p className="text-3xl font-bold text-red-700 mt-2">
                  ₹{maktabStats.totalSpent.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
                <ArrowDownOnSquareIcon className="h-7 w-7 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-indigo-500 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <CurrencyRupeeIcon className="h-4 w-4 text-indigo-600" />
                  Current Balance
                </p>
                <p className={`text-3xl font-bold mt-2 ${
                  maktabStats.currentBalance >= 0 ? 'text-indigo-700' : 'text-red-700'
                }`}>
                  ₹{maktabStats.currentBalance.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center">
                <CurrencyRupeeIcon className="h-7 w-7 text-indigo-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contributor Summary Section */}
      {isAdmin && showContributorSummary && <MaktabContributorSummary limit={5} />}

      {/* Action Buttons + Controls */}
      {((isAdmin && showRecordButtons) || showFilters || canExport) && (
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          {isAdmin && showRecordButtons && (
            <>
              <button
                onClick={() => setShowCollectionModal(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg hover:from-indigo-700 hover:to-violet-700 transition-all font-semibold shadow-sm hover:shadow-md active:scale-95"
              >
                <ArrowUpOnSquareIcon className="h-4 w-4" />
                <span>Record Contribution</span>
              </button>

              <button
                onClick={() => setShowSpendingModal(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg hover:from-red-700 hover:to-orange-700 transition-all font-semibold shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={maktabStats.currentBalance <= 0}
              >
                <ArrowDownOnSquareIcon className="h-4 w-4" />
                <span>Record Spending</span>
              </button>
            </>
          )}

          <div className="flex-1" />

          {/* Filters */}
          {showFilters && (
            <div className="flex flex-row flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-1 overflow-x-auto">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    filterType === 'all' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  All Types
                </button>
                <button
                  onClick={() => setFilterType('collection')}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    filterType === 'collection' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Contributions
                </button>
                <button
                  onClick={() => setFilterType('spending')}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    filterType === 'spending' ? 'bg-red-100 text-red-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Spending
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={filterFrequency}
                  onChange={(e) => setFilterFrequency(e.target.value as 'all' | 'One-time' | 'Monthly')}
                  className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">All Frequencies</option>
                  <option value="One-time">One-time</option>
                  <option value="Monthly">Monthly</option>
                </select>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value as 'all' | SpendingCategory)}
                  className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">All Categories</option>
                  {SPENDING_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Search */}
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-56 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />

          {/* Export Dropdown - Admin Only */}
          {canExport && (
            <div className="relative" ref={exportDropdownRef}>
              <button
                onClick={() => setShowExportOptions(!showExportOptions)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <DocumentArrowDownIcon className="h-5 w-5" />
                Export
              </button>

              {showExportOptions && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg z-20 ring-1 ring-black ring-opacity-5 overflow-hidden">
                  <div className="py-1">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                      Export As
                    </div>
                    <button
                      onClick={exportToCSV}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                    >
                      CSV (Excel)
                    </button>
                    <button
                      onClick={exportToJSON}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                    >
                      JSON Data
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white shadow-md rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">
            Transactions Database
          </h3>
          <span className="text-sm text-gray-500">
            Showing {filteredTransactions.length} of {maktabTransactions.length} records
          </span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <CurrencyRupeeIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No transactions found</p>
            <p className="text-gray-400 text-sm mt-1">
              {searchTerm ? 'Try adjusting your search or filters' : isAdmin ? 'Start by recording a contribution or spending' : 'No transactions available'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category / Frequency</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Party</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Details</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTransactions.map((t) => (
                    <tr key={t._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(t.paymentDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-xs text-gray-400">
                          Rec: {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          t.type === 'collection'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {t.type === 'collection' ? 'Contribution' : 'Spending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          t.type === 'collection' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {t.type === 'collection' ? (t.contributionFrequency || 'One-time') : (t.category || 'Other')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {t.type === 'collection' ? t.contributorName : t.recipientName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {t.type === 'collection' ? t.contributorType : t.recipientType}
                          {t.type === 'spending' && t.studentCount ? ` • ${t.studentCount} students` : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{t.paymentMethod}</span>
                          {getPaymentDetails(t) !== t.paymentMethod && (
                            <span className="text-xs text-gray-500">{getPaymentDetails(t)}</span>
                          )}
                          {t.proofFilePath && isAdmin && (
                            <span
                              onClick={(e) => handleProofClick(e, t.proofFilePath!)}
                              className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer inline-flex items-center gap-1 font-medium px-2.5 py-1.5 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                            >
                              View Proof
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${
                        t.type === 'collection' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {t.type === 'collection' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => { setViewingTransaction(t); setShowViewModal(true); }}
                            className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors"
                            title="View Details"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => { setEditingTransaction(t); setEditProofFile(null); setEditProofPreview(null); setShowEditModal(true); }}
                                className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded transition-colors"
                                title="Edit"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>
                              {canDelete && (
                                <button
                                  onClick={() => handleDeleteTransaction(t._id)}
                                  className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors"
                                  title="Delete"
                                >
                                  <TrashIcon className="h-5 w-5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {filteredTransactions.map((t) => (
                <div
                  key={t._id}
                  className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${
                        t.type === 'collection'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {t.type === 'collection' ? 'Contribution' : 'Spending'}
                      </span>
                      <span className={`ml-2 px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${
                        t.type === 'collection' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {t.type === 'collection' ? (t.contributionFrequency || 'One-time') : (t.category || 'Other')}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(t.paymentDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    <p className={`text-lg font-bold ${
                      t.type === 'collection' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {t.type === 'collection' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="mb-3 pb-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">
                      {t.type === 'collection' ? t.contributorName : t.recipientName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t.type === 'collection' ? t.contributorType : t.recipientType}
                      {t.type === 'spending' && t.studentCount ? ` • ${t.studentCount} students` : ''}
                    </p>
                  </div>

                  <div className="mb-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <span className="font-medium">{t.paymentMethod}</span>
                    </div>
                    {getPaymentDetails(t) !== t.paymentMethod && (
                      <p className="text-xs text-gray-500">{getPaymentDetails(t)}</p>
                    )}
                    {t.proofFilePath && isAdmin && (
                      <button
                        onClick={(e) => handleProofClick(e, t.proofFilePath!)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-1 inline-flex items-center gap-1"
                      >
                        View Proof
                      </button>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => { setViewingTransaction(t); setShowViewModal(true); }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <EyeIcon className="h-4 w-4" />
                      View
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => { setEditingTransaction(t); setEditProofFile(null); setEditProofPreview(null); setShowEditModal(true); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          <PencilIcon className="h-4 w-4" />
                          Edit
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteTransaction(t._id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <TrashIcon className="h-4 w-4" />
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Record Collection Modal */}
      {showCollectionModal && (
        <RecordMaktabCollection
          onSuccess={fetchMaktabData}
          onClose={() => setShowCollectionModal(false)}
        />
      )}

      {/* Record Spending Modal */}
      {showSpendingModal && (
        <RecordMaktabSpending
          currentBalance={maktabStats.currentBalance}
          onSuccess={fetchMaktabData}
          onClose={() => setShowSpendingModal(false)}
        />
      )}

      {/* View Transaction Modal */}
      {showViewModal && viewingTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/50 p-3 sm:items-center sm:p-4"
          onClick={() => setShowViewModal(false)}
        >
          <div
            className="my-3 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[92dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/95 p-4 backdrop-blur sm:p-6">
              <h3 className="text-xl font-bold text-gray-900">Transaction Details</h3>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close transaction details"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="max-h-[calc(92dvh-10rem)] overflow-y-auto p-4 space-y-4 sm:max-h-[calc(92dvh-11rem)] sm:p-6">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  viewingTransaction.type === 'collection'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {viewingTransaction.type === 'collection' ? 'Contribution' : 'Spending'}
                </span>
                <span className="text-2xl font-bold text-gray-900">
                  {viewingTransaction.type === 'collection' ? '+' : '-'}₹{viewingTransaction.amount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">
                    {new Date(viewingTransaction.paymentDate).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="font-medium">{viewingTransaction.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">
                    {viewingTransaction.type === 'collection' ? 'Contributor' : 'Recipient'}
                  </p>
                  <p className="font-medium">
                    {viewingTransaction.type === 'collection'
                      ? viewingTransaction.contributorName
                      : viewingTransaction.recipientName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="font-medium">
                    {viewingTransaction.type === 'collection'
                      ? viewingTransaction.contributorType
                      : viewingTransaction.recipientType}
                  </p>
                </div>
                {viewingTransaction.type === 'collection' && (
                  <div>
                    <p className="text-sm text-gray-500">Frequency</p>
                    <p className="font-medium">{viewingTransaction.contributionFrequency || 'One-time'}</p>
                  </div>
                )}
                {viewingTransaction.type === 'spending' && (
                  <div>
                    <p className="text-sm text-gray-500">Category</p>
                    <p className="font-medium">{viewingTransaction.category || 'Other'}</p>
                  </div>
                )}
                {viewingTransaction.type === 'spending' && viewingTransaction.studentCount ? (
                  <div>
                    <p className="text-sm text-gray-500">Students Supported</p>
                    <p className="font-medium">{viewingTransaction.studentCount}</p>
                  </div>
                ) : null}
                {viewingTransaction.bankName && (
                  <div>
                    <p className="text-sm text-gray-500">Bank Name</p>
                    <p className="font-medium">{viewingTransaction.bankName}</p>
                  </div>
                )}
                {viewingTransaction.senderUpiId && (
                  <div className="min-w-0">
                    <p className="text-sm text-gray-500">Sender UPI ID</p>
                    <p className="font-medium break-all">{viewingTransaction.senderUpiId}</p>
                  </div>
                )}
                {viewingTransaction.chequeNumber && (
                  <div>
                    <p className="text-sm text-gray-500">Cheque Number</p>
                    <p className="font-medium">{viewingTransaction.chequeNumber}</p>
                  </div>
                )}
                {viewingTransaction.transactionRefId && (
                  <div className="min-w-0">
                    <p className="text-sm text-gray-500">Reference ID</p>
                    <p className="font-mono font-medium break-all text-sm sm:text-base">{viewingTransaction.transactionRefId}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Recorded</p>
                  <p className="font-medium">
                    {viewingTransaction.createdAt
                      ? new Date(viewingTransaction.createdAt).toLocaleDateString('en-IN')
                      : '-'}
                  </p>
                </div>
              </div>

              {viewingTransaction.notes && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{viewingTransaction.notes}</p>
                </div>
              )}

              {viewingTransaction.proofFilePath && isAdmin && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Proof of Payment</p>
                  <button
                    onClick={() => handleDownloadProof(viewingTransaction.proofFilePath!)}
                    className="text-indigo-600 hover:text-indigo-700 underline inline-flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <DocumentArrowDownIcon className="w-4 h-4" />
                    Download Document
                  </button>
                </div>
              )}
            </div>
            <div className="sticky bottom-0 border-t bg-gray-50 p-4 sm:rounded-b-2xl sm:p-6">
              <button
                onClick={() => setShowViewModal(false)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showEditModal && editingTransaction && isAdmin && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-900">Edit Transaction</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUpdateTransaction} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingTransaction.type === 'collection' ? 'Contributor Name' : 'Recipient Name'}
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={editingTransaction.type === 'collection'
                    ? (editingTransaction.contributorName || '')
                    : (editingTransaction.recipientName || '')}
                  onChange={e => setEditingTransaction({
                    ...editingTransaction,
                    [editingTransaction.type === 'collection' ? 'contributorName' : 'recipientName']: e.target.value
                  })}
                />
              </div>

              {editingTransaction.type === 'collection' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={editingTransaction.contributionFrequency || 'One-time'}
                    onChange={e => setEditingTransaction({ ...editingTransaction, contributionFrequency: e.target.value as 'One-time' | 'Monthly' })}
                  >
                    <option value="One-time">One-time</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                </div>
              )}

              {editingTransaction.type === 'spending' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Type</label>
                    <select
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editingTransaction.recipientType || 'Teacher'}
                      onChange={e => setEditingTransaction({ ...editingTransaction, recipientType: e.target.value })}
                    >
                      <option value="Teacher">Teacher</option>
                      <option value="Student">Student</option>
                      <option value="Supplier">Supplier</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editingTransaction.category || 'Other'}
                      onChange={e => setEditingTransaction({ ...editingTransaction, category: e.target.value as SpendingCategory })}
                    >
                      {SPENDING_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Number of Students (Optional)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={editingTransaction.studentCount ?? ''}
                      onChange={e => setEditingTransaction({ ...editingTransaction, studentCount: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={editingTransaction.amount}
                  onChange={e => setEditingTransaction({...editingTransaction, amount: parseFloat(e.target.value) || 0})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={new Date(editingTransaction.paymentDate).toISOString().split('T')[0]}
                  onChange={e => setEditingTransaction({...editingTransaction, paymentDate: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={editingTransaction.paymentMethod}
                  onChange={e => setEditingTransaction({...editingTransaction, paymentMethod: e.target.value})}
                >
                  <option>Bank Transfer</option>
                  <option>UPI Transfer</option>
                  <option>Cash</option>
                  <option>Cheque</option>
                  <option>QR Scanner</option>
                </select>
              </div>

              {editingTransaction.paymentMethod === 'Bank Transfer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={editingTransaction.bankName || ''}
                    onChange={e => setEditingTransaction({...editingTransaction, bankName: e.target.value})}
                  />
                </div>
              )}

              {editingTransaction.paymentMethod === 'UPI Transfer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sender UPI ID</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={editingTransaction.senderUpiId || ''}
                    onChange={e => setEditingTransaction({...editingTransaction, senderUpiId: e.target.value})}
                  />
                </div>
              )}

              {editingTransaction.paymentMethod === 'Cheque' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Number</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={editingTransaction.chequeNumber || ''}
                    onChange={e => setEditingTransaction({...editingTransaction, chequeNumber: e.target.value})}
                  />
                </div>
              )}

              {(editingTransaction.paymentMethod === 'UPI Transfer' || editingTransaction.paymentMethod === 'QR Scanner') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Ref ID (Min 6 Digits)</label>
                  <input
                    type="text"
                    pattern="\d{6,}"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                    value={editingTransaction.transactionRefId || ''}
                    onChange={e => setEditingTransaction({
                      ...editingTransaction,
                      transactionRefId: e.target.value.replace(/\D/g, '')
                    })}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  value={editingTransaction.notes || ''}
                  onChange={e => setEditingTransaction({...editingTransaction, notes: e.target.value})}
                />
              </div>

              {/* Proof of Payment Upload / Replace */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Proof of Payment</label>

                {editingTransaction.proofFilePath && !editProofPreview && (
                  <div className="mb-2 p-3 bg-gray-50 rounded-xl border border-gray-200 relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DocumentArrowDownIcon className="w-5 h-5 text-indigo-600" />
                        <span className="text-sm text-gray-700 font-medium">Existing proof uploaded</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewProofPath(editingTransaction.proofFilePath!);
                          setShowProofPreview(true);
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
                      >
                        View
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTransaction({ ...editingTransaction, proofFilePath: undefined });
                        toast.success('Proof marked for removal. Click Save to confirm.');
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow"
                      title="Remove proof"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {editProofPreview && (
                  <div className="mb-2 relative">
                    {editProofPreview.startsWith('data:image') ? (
                      <img src={editProofPreview} alt="New proof" className="max-h-32 mx-auto rounded-lg border" />
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                        <DocumentArrowDownIcon className="w-5 h-5 text-indigo-600" />
                        <span className="text-sm text-indigo-700 font-medium">{editProofFile?.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { setEditProofFile(null); setEditProofPreview(null); }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <input
                  type="file"
                  id="edit-maktab-proof-upload"
                  accept="image/jpeg,image/jpg,image/png,application/pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
                        toast.error('File must be 2MB or smaller');
                        e.target.value = '';
                        return;
                      }

                      try {
                        const finalFile = file.type.startsWith('image/') ? await optimizeImageForUpload(file) : file;
                        setEditProofFile(finalFile);
                        const previewData = await readFileAsDataUrl(finalFile);
                        setEditProofPreview(previewData);
                      } catch (error) {
                        console.error('Proof optimization failed:', error);
                        toast.error('Failed to process file. Please try again.');
                        e.target.value = '';
                      }
                    }
                  }}
                />
                <label
                  htmlFor="edit-maktab-proof-upload"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-sm text-gray-600 hover:text-indigo-700"
                >
                  <ArrowUpOnSquareIcon className="w-4 h-4" />
                  {editingTransaction.proofFilePath ? 'Replace Proof' : 'Upload Proof'}
                </label>
                <p className="text-xs text-gray-500 mt-1">JPEG, PNG, or PDF. Max 2MB.</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Proof Preview Popup */}
      {showProofPreview && previewProofPath && (
        <div className="fixed inset-0 z-[99] bg-black bg-opacity-50 flex items-center justify-center" onClick={handleProofClose}>
          <div
            className="bg-white rounded-3xl shadow-2xl border-2 border-indigo-200 overflow-hidden relative max-w-4xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-indigo-500 to-violet-500 px-8 py-5 flex justify-between items-center">
              <p className="text-white text-lg font-bold">Proof of Payment</p>
              <button
                onClick={handleProofClose}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <XMarkIcon className="w-7 h-7" />
              </button>
            </div>

            <div className="p-8 bg-white">
              {previewProofPath.toLowerCase().includes('.pdf') ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <DocumentArrowDownIcon className="w-32 h-32 text-indigo-500 mb-6" />
                  <p className="text-2xl text-gray-700 font-bold text-center">PDF Document</p>
                  <p className="text-base text-gray-500 text-center mt-3">Click below to download the proof document</p>
                  <button
                    onClick={() => handleDownloadProof(previewProofPath)}
                    className="mt-8 px-8 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-colors text-lg font-semibold inline-flex items-center gap-3 shadow-xl hover:shadow-2xl hover:scale-105"
                  >
                    <DocumentArrowDownIcon className="w-6 h-6" />
                    Download PDF
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <img
                    src={`/${previewProofPath.replace(/^\/+/, '')}`}
                    alt="Proof of Payment"
                    className="w-full h-auto rounded-2xl shadow-xl"
                    style={{ maxHeight: '600px', objectFit: 'contain' }}
                  />
                </div>
              )}
            </div>

            <div className="px-8 py-5 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200 flex justify-between items-center">
              <p className="text-base text-gray-600 font-medium">Click outside or close to dismiss</p>
              <button
                onClick={() => handleDownloadProof(previewProofPath)}
                className="text-base text-indigo-600 hover:text-indigo-700 hover:underline font-semibold inline-flex items-center gap-2 bg-indigo-50 px-6 py-3 rounded-xl hover:bg-indigo-100 transition-all hover:scale-105"
              >
                <DocumentArrowDownIcon className="w-5 h-5" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaktabManagement;
