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
import RecordCollection from './RecordCollection';
import RecordSpending from './RecordSpending';
import DonorSummary from './DonorSummary';

interface ZakatTransaction {
  _id: string;
  type: 'collection' | 'spending';
  donorId?: {
    _id: string;
    name: string;
    type: string;
    totalDonated: number;
  };
  donorName?: string;
  donorType?: string;
  recipientName?: string;
  recipientType?: string;
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

interface ZakatStats {
  totalCollected: number;
  totalSpent: number;
  currentBalance: number;
}

interface ZakatManagementProps {
  onClose?: () => void;
  showStats?: boolean; // Control stats visibility
  showExport?: boolean; // Control export visibility
  showDelete?: boolean; // Control delete visibility
  showDonorSummary?: boolean; // Control donor summary visibility
  showRecordButtons?: boolean; // Control record collection/spending buttons visibility
  showFilters?: boolean; // Control filter tabs visibility
}

const ZakatManagement: React.FC<ZakatManagementProps> = ({ 
  onClose, 
  showStats = true, 
  showExport = true,
  showDelete = true,
  showDonorSummary = true,
  showRecordButtons = true,
  showFilters = true
}) => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(['superadmin', 'manager']);
  
  const [zakatStats, setZakatStats] = useState<ZakatStats>({ totalCollected: 0, totalSpent: 0, currentBalance: 0 });
  const [zakatTransactions, setZakatTransactions] = useState<ZakatTransaction[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<ZakatTransaction | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingTransaction, setViewingTransaction] = useState<ZakatTransaction | null>(null);
  const [showProofPreview, setShowProofPreview] = useState(false);
  const [previewProofPath, setPreviewProofPath] = useState('');
  const [clickedProofPath, setClickedProofPath] = useState<string | null>(null);
  
  // New form modals
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [showSpendingModal, setShowSpendingModal] = useState(false);

  // Filter state
  const [filterType, setFilterType] = useState<'all' | 'collection' | 'spending'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Export State
  const [showExportOptions, setShowExportOptions] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportOptions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchZakatData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [statsRes, transRes] = await Promise.all([
        fetch(`${API_URL}/zakat/stats`, { 
          headers: { 'Authorization': `Bearer ${token}` } 
        }),
        fetch(`${API_URL}/zakat/payments?limit=100`, { 
          headers: { 'Authorization': `Bearer ${token}` } 
        })
      ]);

      const statsData = await statsRes.json();
      const transData = await transRes.json();

      if (statsData.status === 'success') {
        setZakatStats(statsData.data);
      }
      if (transData.status === 'success') {
        setZakatTransactions(transData.data.payments);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load Zakat data');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/zakat/payment/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.status === 'success') {
        toast.success('Transaction deleted successfully');
        fetchZakatData();
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
        formData.append('donorName', editingTransaction.donorName || '');
        formData.append('donorType', editingTransaction.donorType || 'Individual');
      } else {
        formData.append('recipientName', editingTransaction.recipientName || '');
        formData.append('recipientType', editingTransaction.recipientType || 'Individual');
      }
      
      if (editingTransaction.bankName) formData.append('bankName', editingTransaction.bankName);
      if (editingTransaction.senderUpiId) formData.append('senderUpiId', editingTransaction.senderUpiId);
      if (editingTransaction.chequeNumber) formData.append('chequeNumber', editingTransaction.chequeNumber);
      if (editingTransaction.transactionRefId) formData.append('transactionRefId', editingTransaction.transactionRefId);
      if (editingTransaction.notes) formData.append('notes', editingTransaction.notes);

      const response = await fetch(`${API_URL}/zakat/payment/${editingTransaction._id}`, {
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
        fetchZakatData();
      } else {
        toast.error(data.message || 'Update failed');
      }
    } catch (error) {
      toast.error('Update failed');
    }
  };

  // Export Functions
  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Party Name', 'Party Type', 'Amount', 'Method', 'Reference ID', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...zakatTransactions.map(t => {
        const partyName = t.type === 'collection' ? t.donorName : t.recipientName;
        const partyType = t.type === 'collection' ? t.donorType : t.recipientType;
        return [
          new Date(t.paymentDate).toLocaleDateString(),
          t.type,
          `"${partyName || ''}"`,
          partyType,
          t.amount,
          t.paymentMethod,
          t.transactionRefId || t.chequeNumber || '',
          `"${t.notes || ''}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `zakat_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    setShowExportOptions(false);
    toast.success('CSV exported successfully');
  };

  const exportToJSON = () => {
    const dataStr = JSON.stringify(zakatTransactions, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `zakat_transactions_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    setShowExportOptions(false);
    toast.success('JSON exported successfully');
  };

  // Filter transactions
  const filteredTransactions = zakatTransactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const name = t.type === 'collection' ? t.donorName : t.recipientName;
      return name?.toLowerCase().includes(searchLower) || 
             t.transactionRefId?.includes(searchTerm) ||
             t.chequeNumber?.includes(searchTerm) ||
             t.notes?.toLowerCase().includes(searchLower);
    }
    return true;
  });

  useEffect(() => {
    fetchZakatData();
  }, []);

  const canDelete = isAdmin && showDelete;
  const canExport = isAdmin && showExport;
  const canViewStats = isAdmin && showStats;

  // Get payment details display
  const getPaymentDetails = (t: ZakatTransaction) => {
    const details: string[] = [];
    if (t.bankName) details.push(t.bankName);
    if (t.senderUpiId) details.push(`UPI: ${t.senderUpiId}`);
    if (t.chequeNumber) details.push(`Cheque: ${t.chequeNumber}`);
    if (t.transactionRefId) details.push(`Ref: ${t.transactionRefId}`);
    return details.join(' • ') || t.paymentMethod;
  };

  // Handle proof preview click
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

  // Download proof file
  const handleDownloadProof = async (proofPath: string) => {
    try {
      // Remove leading slash if present and use /uploads/ path
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

  // Close preview when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Zakat Center</h2>
          <p className="text-sm text-gray-500 mt-1">Manage collections and distributions</p>
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

      {/* Stats Cards - Admin Only */}
      {canViewStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-green-500 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <ArrowUpIcon className="h-4 w-4 text-green-600" />
                  Total Collected
                </p>
                <p className="text-3xl font-bold text-green-700 mt-2">
                  ₹{zakatStats.totalCollected.toLocaleString('en-IN')}
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
                  ₹{zakatStats.totalSpent.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
                <ArrowDownOnSquareIcon className="h-7 w-7 text-red-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <CurrencyRupeeIcon className="h-4 w-4 text-blue-600" />
                  Current Balance
                </p>
                <p className={`text-3xl font-bold mt-2 ${
                  zakatStats.currentBalance >= 0 ? 'text-blue-700' : 'text-red-700'
                }`}>
                  ₹{zakatStats.currentBalance.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                <CurrencyRupeeIcon className="h-7 w-7 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Donor Summary Section */}
      {isAdmin && showDonorSummary && <DonorSummary limit={5} />}

      {/* Action Buttons */}
      {isAdmin && showRecordButtons && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowCollectionModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all font-semibold shadow-md hover:shadow-lg"
          >
            <ArrowUpOnSquareIcon className="h-5 w-5" />
            Record Collection
          </button>
          
          <button
            onClick={() => setShowSpendingModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl hover:from-red-700 hover:to-orange-700 transition-all font-semibold shadow-md hover:shadow-lg"
            disabled={zakatStats.currentBalance <= 0}
          >
            <ArrowDownOnSquareIcon className="h-5 w-5" />
            Record Spending
          </button>

          <div className="flex-1" />

          {/* Filter */}
          {showFilters && (
          <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-1">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'all' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('collection')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'collection' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Collections
            </button>
            <button
              onClick={() => setFilterType('spending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'spending' ? 'bg-red-100 text-red-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Spending
            </button>
          </div>
          )}

          {/* Search */}
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                    >
                      📊 CSV (Excel)
                    </button>
                    <button
                      onClick={exportToJSON}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                    >
                      📄 JSON Data
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
            Showing {filteredTransactions.length} of {zakatTransactions.length} records
          </span>
        </div>
        
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <CurrencyRupeeIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No transactions found</p>
            <p className="text-gray-400 text-sm mt-1">
              {searchTerm ? 'Try adjusting your search or filters' : isAdmin ? 'Start by recording a collection or spending' : 'No transactions available'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
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
                        {t.type === 'collection' ? 'Collection' : 'Spending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {t.type === 'collection' ? t.donorName : t.recipientName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {t.type === 'collection' ? t.donorType : t.recipientType}
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
                            className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer inline-flex items-center gap-1 font-medium px-2.5 py-1.5 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                          >
                            📎 View Proof
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
                              onClick={() => { setEditingTransaction(t); setShowEditModal(true); }}
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
        )}
      </div>

      {/* Record Collection Modal */}
      {showCollectionModal && (
        <RecordCollection 
          onSuccess={fetchZakatData}
          onClose={() => setShowCollectionModal(false)}
        />
      )}

      {/* Record Spending Modal */}
      {showSpendingModal && (
        <RecordSpending 
          currentBalance={zakatStats.currentBalance}
          onSuccess={fetchZakatData}
          onClose={() => setShowSpendingModal(false)}
        />
      )}

      {/* View Transaction Modal */}
      {showViewModal && viewingTransaction && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-bold text-gray-900">Transaction Details</h3>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  viewingTransaction.type === 'collection' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {viewingTransaction.type === 'collection' ? 'Collection' : 'Spending'}
                </span>
                <span className="text-2xl font-bold text-gray-900">
                  {viewingTransaction.type === 'collection' ? '+' : '-'}₹{viewingTransaction.amount.toLocaleString('en-IN')}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
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
                    {viewingTransaction.type === 'collection' ? 'Donor' : 'Recipient'}
                  </p>
                  <p className="font-medium">
                    {viewingTransaction.type === 'collection' 
                      ? viewingTransaction.donorName 
                      : viewingTransaction.recipientName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="font-medium">
                    {viewingTransaction.type === 'collection' 
                      ? viewingTransaction.donorType 
                      : viewingTransaction.recipientType}
                  </p>
                </div>
                {viewingTransaction.bankName && (
                  <div>
                    <p className="text-sm text-gray-500">Bank Name</p>
                    <p className="font-medium">{viewingTransaction.bankName}</p>
                  </div>
                )}
                {viewingTransaction.senderUpiId && (
                  <div>
                    <p className="text-sm text-gray-500">Sender UPI ID</p>
                    <p className="font-medium">{viewingTransaction.senderUpiId}</p>
                  </div>
                )}
                {viewingTransaction.chequeNumber && (
                  <div>
                    <p className="text-sm text-gray-500">Cheque Number</p>
                    <p className="font-medium">{viewingTransaction.chequeNumber}</p>
                  </div>
                )}
                {viewingTransaction.transactionRefId && (
                  <div>
                    <p className="text-sm text-gray-500">Reference ID</p>
                    <p className="font-mono font-medium">{viewingTransaction.transactionRefId}</p>
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
                    className="text-emerald-600 hover:text-emerald-700 underline inline-flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <DocumentArrowDownIcon className="w-4 h-4" />
                    Download Document
                  </button>
                </div>
              )}
            </div>
            <div className="p-6 border-t bg-gray-50 rounded-b-2xl">
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
                  {editingTransaction.type === 'collection' ? 'Donor Name' : 'Recipient Name'}
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={editingTransaction.type === 'collection' 
                    ? (editingTransaction.donorName || '') 
                    : (editingTransaction.recipientName || '')}
                  onChange={e => setEditingTransaction({
                    ...editingTransaction,
                    [editingTransaction.type === 'collection' ? 'donorName' : 'recipientName']: e.target.value
                  })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={editingTransaction.amount}
                  onChange={e => setEditingTransaction({...editingTransaction, amount: parseFloat(e.target.value) || 0})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={new Date(editingTransaction.paymentDate).toISOString().split('T')[0]}
                  onChange={e => setEditingTransaction({...editingTransaction, paymentDate: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    value={editingTransaction.chequeNumber || ''}
                    onChange={e => setEditingTransaction({...editingTransaction, chequeNumber: e.target.value})}
                  />
                </div>
              )}

              {(editingTransaction.paymentMethod === 'UPI Transfer' || editingTransaction.paymentMethod === 'QR Scanner') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Ref ID</label>
                  <input
                    type="text"
                    maxLength={6}
                    pattern="\d{6}"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                    value={editingTransaction.transactionRefId || ''}
                    onChange={e => setEditingTransaction({
                      ...editingTransaction, 
                      transactionRefId: e.target.value.replace(/\D/g, '').slice(0, 6)
                    })}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  value={editingTransaction.notes || ''}
                  onChange={e => setEditingTransaction({...editingTransaction, notes: e.target.value})}
                />
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
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium"
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
            className="bg-white rounded-3xl shadow-2xl border-2 border-emerald-200 overflow-hidden relative max-w-4xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Close Button */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-5 flex justify-between items-center">
              <p className="text-white text-lg font-bold">Proof of Payment</p>
              <button
                onClick={handleProofClose}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <XMarkIcon className="w-7 h-7" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-8 bg-white">
              {previewProofPath.toLowerCase().includes('.pdf') ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <DocumentArrowDownIcon className="w-32 h-32 text-emerald-500 mb-6" />
                  <p className="text-2xl text-gray-700 font-bold text-center">PDF Document</p>
                  <p className="text-base text-gray-500 text-center mt-3">Click below to download the proof document</p>
                  <button
                    onClick={() => handleDownloadProof(previewProofPath)}
                    className="mt-8 px-8 py-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-colors text-lg font-semibold inline-flex items-center gap-3 shadow-xl hover:shadow-2xl hover:scale-105"
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
            
            {/* Footer */}
            <div className="px-8 py-5 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200 flex justify-between items-center">
              <p className="text-base text-gray-600 font-medium">Click outside or ✕ to close</p>
              <button
                onClick={() => handleDownloadProof(previewProofPath)}
                className="text-base text-emerald-600 hover:text-emerald-700 hover:underline font-semibold inline-flex items-center gap-2 bg-emerald-50 px-6 py-3 rounded-xl hover:bg-emerald-100 transition-all hover:scale-105"
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

export default ZakatManagement;
