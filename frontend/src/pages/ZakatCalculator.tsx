import React, { useState, useEffect, useMemo } from 'react';
import {
  CurrencyRupeeIcon,
  CalculatorIcon,
  InformationCircleIcon,
  PlusIcon,
  ArrowDownIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

interface ZakatTransaction {
  _id: string;
  type: 'Credit' | 'Debit';
  donorName?: string;
  donorType?: string;
  recipientName?: string;
  recipientType?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  paymentId: string;
  upiId?: string;
  notes?: string;
  createdAt: string;
}

const ZakatCalculator: React.FC = () => {
  const { user } = useAuth();
  // Role Check: Super Admin OR Manager OR Legacy Admin
  const hasAccess = user && (user.role === 'superadmin' || user.role === 'manager' || user.isAdmin);

  const [activeTab, setActiveTab] = useState<'calculator' | 'management' | 'donors'>(hasAccess ? 'management' : 'calculator');
  
  // Calculator State
  const [assets, setAssets] = useState({
    cash: '',
    gold: '',
    silver: '',
    investments: '',
    business: '',
    cryptocurrency: '',
    managedZakat: ''
  });
  
  const [debts, setDebts] = useState({
    personalDebts: '',
    businessDebts: ''
  });

  const [result, setResult] = useState<{
    totalWealth: number;
    zakatDue: number;
    isEligible: boolean;
  } | null>(null);

  // Management State
  const [transactions, setTransactions] = useState<ZakatTransaction[]>([]);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'Credit' | 'Debit'>('Credit');
  const [selectedPayment, setSelectedPayment] = useState<ZakatTransaction | null>(null);
  
  // Transaction Form State
  const [formData, setFormData] = useState({
      donorName: '',
      donorType: 'Individual',
      recipientName: '',
      recipientType: 'Individual',
      amount: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'Bank Transfer',
      paymentId: '',
      upiId: '',
      notes: ''
  });
  
  const [donorSuggestions, setDonorSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Calculate Donor Stats (Client-side Aggregation)
  const donorStats = useMemo(() => {
      const statsMap = new Map<string, { total: number, count: number, type: string }>();
      
      transactions
        .filter(t => t.type === 'Credit' && t.donorName)
        .forEach(t => {
            const name = t.donorName!;
            const current = statsMap.get(name) || { total: 0, count: 0, type: t.donorType || 'Individual' };
            current.total += t.amount;
            current.count += 1;
            statsMap.set(name, current);
        });

      return Array.from(statsMap.entries()).map(([name, data]) => ({
          name,
          ...data
      })).sort((a, b) => b.total - a.total);
  }, [transactions]);
  
  // Extract unique donor names for suggestions
  const allDonorNames = useMemo(() => {
      return Array.from(new Set(transactions
          .filter(t => t.type === 'Credit' && t.donorName)
          .map(t => t.donorName!)
      ));
  }, [transactions]);

  useEffect(() => {
    if (hasAccess) {
        setActiveTab('management');
    } else {
        setActiveTab('calculator');
    }
  }, [hasAccess]);

  // Fetch Data for Admin/Manager
  const fetchZakatData = async () => {
      try {
          const token = localStorage.getItem('token');
          const [, transRes] = await Promise.all([
              fetch(`${API_URL}/zakat/stats`, { headers: { 'Authorization': `Bearer ${token}` } }),
              fetch(`${API_URL}/zakat/payments`, { headers: { 'Authorization': `Bearer ${token}` } })
          ]);

          const transData = await transRes.json();

          if (transData.status === 'success') setTransactions(transData.data.payments);

      } catch (error) {
          console.error(error);
          toast.error('Failed to load Zakat data');
      }
  };

  useEffect(() => {
    if (hasAccess) {
      fetchZakatData();
    }
  }, [user, hasAccess]);

  // Calculator Logic
  const handleInputChange = (category: 'assets' | 'debts', field: string, value: string) => {
    if (category === 'assets') {
      setAssets(prev => ({ ...prev, [field]: value }));
    } else {
      setDebts(prev => ({ ...prev, [field]: value }));
    }
  };

  const calculateZakat = () => {
    const totalAssets = Object.values(assets).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
    const totalDebts = Object.values(debts).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
    const netWealth = totalAssets - totalDebts;
    
    const nisabThreshold = 40000;
    const zakatRate = 0.025; // 2.5%
    
    const isEligible = netWealth >= nisabThreshold;
    const zakatDue = isEligible ? netWealth * zakatRate : 0;
    
    setResult({
      totalWealth: netWealth,
      zakatDue,
      isEligible
    });
  };
  
  // Donor Name Input Handler with Suggestions
  const handleDonorNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setFormData({ ...formData, donorName: value });
      
      if (value.length > 0) {
          const filtered = allDonorNames.filter(name => 
              name.toLowerCase().includes(value.toLowerCase()) && name !== value
          );
          setDonorSuggestions(filtered);
          setShowSuggestions(true);
      } else {
          setShowSuggestions(false);
      }
  };
  
  const selectDonorSuggestion = (name: string) => {
      setFormData({ ...formData, donorName: name });
      setShowSuggestions(false);
  };

  // Management Logic
  const handleTransactionSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const token = localStorage.getItem('token');
          
          // Validation for Payment ID depending on method
          if (formData.paymentMethod !== 'Cash' && !formData.paymentId) {
             const idLabel = formData.paymentMethod === 'Cheque' ? 'Cheque Number' : 'Transaction ID';
             toast.error(`Please enter ${idLabel}`);
             return;
          }

          const payload = {
              type: transactionType,
              amount: parseFloat(formData.amount),
              paymentDate: formData.paymentDate,
              paymentMethod: formData.paymentMethod,
              paymentId: formData.paymentMethod === 'Cash' ? `CASH-${Date.now()}` : formData.paymentId,
              upiId: formData.upiId,
              notes: formData.notes,
              // Conditional fields
              ...(transactionType === 'Credit' ? {
                  donorName: formData.donorName,
                  donorType: formData.donorType
              } : {
                  recipientName: formData.recipientName,
                  recipientType: formData.recipientType
              })
          };

          const url = selectedPayment 
            ? `${API_URL}/zakat/payment/${selectedPayment._id}`
            : `${API_URL}/zakat/transaction`;
            
          const method = selectedPayment ? 'PUT' : 'POST';

          const response = await fetch(url, {
              method,
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}` 
              },
              body: JSON.stringify(payload)
          });

          const data = await response.json();
          if (data.status === 'success') {
              toast.success(selectedPayment ? 'Transaction updated' : 'Transaction recorded successfully');
              setShowTransactionModal(false);
              setSelectedPayment(null);
              fetchZakatData();
              resetForm();
          } else {
              toast.error(data.message || 'Operation failed');
          }
      } catch (error) {
          toast.error('Error submitting transaction');
      }
  };

  const resetForm = () => {
      setFormData({
          donorName: '',
          donorType: 'Individual',
          recipientName: '',
          recipientType: 'Individual',
          amount: '',
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMethod: 'Bank Transfer',
          paymentId: '',
          upiId: '',
          notes: ''
      });
      setShowSuggestions(false);
  };

  const openEditModal = (transaction: ZakatTransaction) => {
      setTransactionType(transaction.type);
      setFormData({
          donorName: transaction.donorName || '',
          donorType: transaction.donorType || 'Individual',
          recipientName: transaction.recipientName || '',
          recipientType: transaction.recipientType || 'Individual',
          amount: transaction.amount.toString(),
          paymentDate: new Date(transaction.paymentDate).toISOString().split('T')[0],
          paymentMethod: transaction.paymentMethod,
          paymentId: transaction.paymentMethod.startsWith('CASH-') ? '' : transaction.paymentId,
          upiId: transaction.upiId || '',
          notes: transaction.notes || ''
      });
      setSelectedPayment(transaction);
      setShowTransactionModal(true);
  };

  const assetFields = [
    { key: 'cash', label: 'Cash & Savings', placeholder: 'Enter cash amount' },
    { key: 'gold', label: 'Gold Value', placeholder: 'Enter gold value' },
    { key: 'silver', label: 'Silver Value', placeholder: 'Enter silver value' },
    { key: 'investments', label: 'Investments', placeholder: 'Stocks, bonds, etc.' },
    { key: 'business', label: 'Business Assets', placeholder: 'Business inventory value' },
    { key: 'cryptocurrency', label: 'Cryptocurrency', placeholder: 'Bitcoin, Ethereum, etc.' },
    { key: 'managedZakat', label: 'Managed Zakat Collection', placeholder: 'Zakat collected from others' }
  ];

  const debtFields = [
    { key: 'personalDebts', label: 'Personal Debts', placeholder: 'Credit cards, loans, etc.' },
    { key: 'businessDebts', label: 'Business Debts', placeholder: 'Business loans, etc.' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {hasAccess ? 'Zakat Center' : 'Zakat Calculator'}
          </h1>
          <p className="text-gray-600">
              {hasAccess 
                ? 'Manage Zakat collections and distributions.' 
                : 'Calculate your Zakat obligation with precision'}
          </p>
        </div>

        {/* Tabs */}
        {!hasAccess ? (
            <div className="flex justify-center mb-8">
                <div className="bg-white rounded-lg shadow-sm p-1 inline-flex">
                    <button
                        onClick={() => setActiveTab('calculator')}
                        className={`px-6 py-2 rounded-md text-sm font-medium transition-colors bg-emerald-600 text-white shadow-sm`}
                    >
                        Calculator
                    </button>
                </div>
            </div>
        ) : (
            <div className="flex justify-center mb-8">
                <div className="bg-white rounded-lg shadow-sm p-1 inline-flex">
                    <button
                        onClick={() => setActiveTab('management')}
                        className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'management' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:text-emerald-600'}`}
                    >
                        Transactions
                    </button>
                    <button
                        onClick={() => setActiveTab('donors')}
                        className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'donors' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:text-emerald-600'}`}
                    >
                        Donor Summary
                    </button>
                    <button
                        onClick={() => setActiveTab('calculator')}
                        className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'calculator' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:text-emerald-600'}`}
                    >
                        Calculator
                    </button>
                </div>
            </div>
        )}

        {/* Calculator View */}
        {activeTab === 'calculator' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                    <CurrencyRupeeIcon className="h-6 w-6 mr-2 text-emerald-600" />
                    Assets
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {assetFields.map((field) => (
                    <div key={field.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.label}
                        </label>
                        <input
                        type="number"
                        placeholder={field.placeholder}
                        value={assets[field.key as keyof typeof assets]}
                        onChange={(e) => handleInputChange('assets', field.key, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                        />
                    </div>
                    ))}
                </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Deductions
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {debtFields.map((field) => (
                    <div key={field.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.label}
                        </label>
                        <input
                        type="number"
                        placeholder={field.placeholder}
                        value={debts[field.key as keyof typeof debts]}
                        onChange={(e) => handleInputChange('debts', field.key, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                        />
                    </div>
                    ))}
                </div>
                </div>

                <button
                onClick={calculateZakat}
                className="w-full bg-emerald-600 text-white py-3 px-4 rounded-md hover:bg-emerald-700 transition-colors flex items-center justify-center space-x-2"
                >
                <CalculatorIcon className="h-5 w-5" />
                <span>Calculate Zakat</span>
                </button>
            </div>

            <div className="lg:col-span-1">
                {result && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Calculation Result</h3>
                    
                    <div className="space-y-4">
                    <div>
                        <p className="text-sm font-medium text-gray-600">Net Wealth</p>
                        <p className="text-2xl font-bold text-gray-900">₹{result.totalWealth.toLocaleString('en-IN')}</p>
                    </div>
                    
                    <div>
                        <p className="text-sm font-medium text-gray-600">Zakat Status</p>
                        <p className={`text-lg font-semibold ${result.isEligible ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {result.isEligible ? 'Zakat Required' : 'Below Nisab Threshold'}
                        </p>
                    </div>
                    
                    {result.isEligible && (
                        <div>
                        <p className="text-sm font-medium text-gray-600">Zakat Due (2.5%)</p>
                        <p className="text-3xl font-bold text-emerald-600">₹{result.zakatDue.toLocaleString('en-IN')}</p>
                        </div>
                    )}
                    </div>
                </div>
                )}

                <div className="bg-blue-50 rounded-lg p-6">
                <div className="flex items-start">
                    <InformationCircleIcon className="h-6 w-6 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                    <h4 className="text-sm font-medium text-blue-900 mb-2">About Zakat</h4>
                    <p className="text-sm text-blue-800 mb-3">
                        Zakat is one of the Five Pillars of Islam. It's a form of alms-giving and religious tax.
                    </p>
                    <ul className="text-xs text-blue-700 space-y-1">
                        <li>• Rate: 2.5% of eligible wealth</li>
                        <li>• Nisab: Minimum threshold (~₹40,000)</li>
                        <li>• Lunar year: 354 days ownership</li>
                        <li>• Recipients: 8 categories in Quran</li>
                    </ul>
                    </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-blue-200">
                    <p className="text-xs font-arabic text-blue-800 text-center">
                    "وَآتُوا الزَّكَاةَ"
                    </p>
                    <p className="text-xs text-blue-700 text-center italic mt-1">
                    "And give Zakat" - Quran
                    </p>
                </div>
                </div>
            </div>
            </div>
        )}

        {/* Management View (Transactions) */}
        {hasAccess && activeTab === 'management' && (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-900">Transaction History</h2>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => { setTransactionType('Credit'); resetForm(); setShowTransactionModal(true); }}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 flex items-center gap-2"
                        >
                            <PlusIcon className="h-5 w-5" />
                            Record Collection
                        </button>
                        <button
                            onClick={() => { setTransactionType('Debit'); resetForm(); setShowTransactionModal(true); }}
                            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center gap-2"
                        >
                            <ArrowDownIcon className="h-5 w-5" />
                            Record Spending
                        </button>
                    </div>
                </div>

                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Party</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Info</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                                            No transactions found.
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((t) => (
                                        <tr key={t._id || Math.random()} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(t.paymentDate).toLocaleDateString()}
                                                <div className="text-xs text-gray-400">Rec: {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                    t.type === 'Credit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {t.type === 'Credit' ? 'Collection' : 'Spending'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {t.type === 'Credit' ? t.donorName : t.recipientName}
                                                <div className="text-xs text-gray-500">
                                                    {t.type === 'Credit' ? t.donorType : t.recipientType}
                                                </div>
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${
                                                t.type === 'Credit' ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                                {t.type === 'Credit' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="flex flex-col">
                                                    <span>{t.paymentMethod}</span>
                                                    {t.paymentMethod === 'UPI Transfer' && t.upiId && (
                                                        <span className="text-xs text-gray-400">UPI: {t.upiId}</span>
                                                    )}
                                                    {t.paymentMethod !== 'Cash' && t.paymentId && !t.paymentId.startsWith('CASH-') && (
                                                        <span className="text-xs text-gray-400">
                                                            {t.paymentMethod === 'Cheque' ? 'Chq: ' : 'ID: '} 
                                                            {t.paymentId}
                                                        </span>
                                                    )}
                                                    {t.notes && <span className="text-xs italic text-gray-400 truncate max-w-xs">{t.notes}</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => openEditModal(t)}
                                                    className="text-emerald-600 hover:text-emerald-900"
                                                >
                                                    <PencilIcon className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* Admin View: Donor Summary */}
        {hasAccess && activeTab === 'donors' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900">Donor Summary</h2>
                </div>
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Donor Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Donations</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Contributed</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {donorStats.map((donor, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{idx + 1}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{donor.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{donor.type}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{donor.count}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-emerald-600">
                                            ₹{donor.total.toLocaleString('en-IN')}
                                        </td>
                                    </tr>
                                ))}
                                {donorStats.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">No donors found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* Add/Edit Payment Modal */}
        {showTransactionModal && (
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                        {selectedPayment ? 'Edit Transaction' : (transactionType === 'Credit' ? 'Record Zakat Collection' : 'Record Zakat Spending')}
                    </h3>
                    <form onSubmit={handleTransactionSubmit} className="space-y-4">
                        {transactionType === 'Credit' ? (
                            <>
                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700">Donor Name *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        className="mt-1 block w-full border rounded-md p-2"
                                        value={formData.donorName} 
                                        onChange={handleDonorNameChange}
                                        autoComplete="off"
                                    />
                                    {showSuggestions && donorSuggestions.length > 0 && (
                                        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-b-md shadow-lg max-h-40 overflow-auto mt-0.5">
                                            {donorSuggestions.map((name, i) => (
                                                <li 
                                                    key={i} 
                                                    onClick={() => selectDonorSuggestion(name)}
                                                    className="px-4 py-2 hover:bg-emerald-50 cursor-pointer text-sm text-gray-700"
                                                >
                                                    {name}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Donor Type</label>
                                    <select className="mt-1 block w-full border rounded-md p-2"
                                        value={formData.donorType} onChange={e => setFormData({...formData, donorType: e.target.value})}>
                                        <option>Individual</option>
                                        <option>Organization</option>
                                        <option>Charity</option>
                                    </select>
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Recipient Name *</label>
                                    <input type="text" required className="mt-1 block w-full border rounded-md p-2"
                                        value={formData.recipientName} onChange={e => setFormData({...formData, recipientName: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Recipient Type</label>
                                    <select className="mt-1 block w-full border rounded-md p-2"
                                        value={formData.recipientType} onChange={e => setFormData({...formData, recipientType: e.target.value})}>
                                        <option>Individual</option>
                                        <option>Family</option>
                                        <option>Mosque</option>
                                        <option>Madrasa</option>
                                        <option>NGO</option>
                                    </select>
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Amount (₹) *</label>
                            <input type="number" required min="0" className="mt-1 block w-full border rounded-md p-2"
                                value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Payment Date *</label>
                            <input type="date" required className="mt-1 block w-full border rounded-md p-2"
                                value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Payment Method *</label>
                            <select className="mt-1 block w-full border rounded-md p-2"
                                value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                                <option>Bank Transfer</option>
                                <option>UPI Transfer</option>
                                <option>Cash</option>
                                <option>Cheque</option>
                                <option>QR Scanner</option>
                            </select>
                        </div>

                        {formData.paymentMethod === 'UPI Transfer' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">UPI ID</label>
                                <input type="text" className="mt-1 block w-full border rounded-md p-2"
                                    value={formData.upiId} onChange={e => setFormData({...formData, upiId: e.target.value})} />
                            </div>
                        )}

                        {formData.paymentMethod !== 'Cash' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    {formData.paymentMethod === 'Cheque' ? 'Cheque Number' : 'Transaction/Ref ID'} *
                                </label>
                                <input 
                                    type="text" 
                                    required 
                                    className="mt-1 block w-full border rounded-md p-2"
                                    value={formData.paymentId} 
                                    onChange={e => setFormData({...formData, paymentId: e.target.value})} 
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Notes / Purpose</label>
                            <textarea rows={3} className="mt-1 block w-full border rounded-md p-2"
                                value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowTransactionModal(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className={`px-4 py-2 text-white rounded-md ${transactionType === 'Credit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                                {selectedPayment ? 'Update' : 'Record'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ZakatCalculator;
