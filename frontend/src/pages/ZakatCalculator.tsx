import React, { useState, useEffect, useMemo } from 'react';
import { 
  CurrencyRupeeIcon, 
  CalculatorIcon, 
  InformationCircleIcon, 
  PlusIcon, 
  ArrowDownIcon,
  PencilIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

interface ZakatTransaction {
  _id: string;
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
  currency?: 'INR';
  paymentDate: string;
  hijriYear?: string;
  // Payment Information
  paymentMethod: string;
  paymentId: string;
  paymentStatus?: 'Completed' | 'Pending' | 'Failed';
  // Conditional Fields
  upiId?: string;
  upiTransactionId?: string;
  upiScreenshot?: string;
  bankName?: string;
  bankTransferType?: 'NEFT' | 'Manual';
  accountNumberLast4?: string;
  ifscCode?: string;
  transferDateTime?: string;
  collectedBy?: string;
  collectionLocation?: string;
  receiptNumber?: string;
  chequeNumber?: string;
  chequeDate?: string;
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
  allocationCategory?: 'General' | 'Education' | 'Food' | 'Medical' | 'Emergency';
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
      // Basic Information
      donorName: '',
      donorType: 'Individual' as 'Individual' | 'Organization' | 'Anonymous',
      contactNumber: '',
      email: '',
      address: '',
      recipientName: '',
      recipientType: 'Individual',
      // Zakat Details
      zakatType: 'Zakat-al-Maal',
      amount: '',
      currency: 'INR' as 'INR',
      paymentDate: new Date().toISOString().split('T')[0],
      hijriYear: '1446',
      // Payment Information
      paymentMethod: 'Bank Transfer',
      paymentId: '',
      paymentStatus: 'Completed' as 'Completed' | 'Pending' | 'Failed',
      // Bank Transfer Type
      bankTransferType: 'NEFT' as 'NEFT' | 'Manual',
      // Conditional Fields
      upiId: '',
      upiTransactionId: '',
      upiScreenshot: '',
      bankName: '',
      accountNumberLast4: '',
      ifscCode: '',
      transferDateTime: '',
      collectedBy: '',
      collectionLocation: '',
      receiptNumber: '',
      chequeNumber: '',
      chequeDate: '',
      clearanceStatus: 'Pending',
      gatewayName: 'Razorpay',
      gatewayTransactionId: '',
      cardLast4: '',
      // Additional Fields
      notes: '',
      recurringDonation: false,
      recurringFrequency: 'Monthly' as 'Monthly' | 'Yearly',
      nisabVerified: false,
      anonymousDonation: false,
      taxReceiptRequired: false,
      allocationCategory: 'General' as 'General' | 'Education' | 'Food' | 'Medical' | 'Emergency'
  });

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
          const [statsRes, transRes] = await Promise.all([
              fetch(`${API_URL}/zakat/stats`, { headers: { 'Authorization': `Bearer ${token}` } }),
              fetch(`${API_URL}/zakat/payments`, { headers: { 'Authorization': `Bearer ${token}` } })
          ]);

          await statsRes.json();
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

  // Management Logic
  const handleTransactionSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          // Validation for conditional fields
          if (transactionType === 'Credit' && formData.donorType !== 'Anonymous') {
              if (!formData.contactNumber && !formData.email) {
                  toast.error('Contact Number or Email required (unless Anonymous)');
                  return;
              }
          }

          const token = localStorage.getItem('token');
          const payload: any = {
              type: transactionType,
              // Basic Information
              ...(transactionType === 'Credit' ? {
                  donorName: formData.anonymousDonation ? 'Anonymous' : formData.donorName,
                  donorType: formData.donorType,
                  contactNumber: formData.contactNumber,
                  email: formData.email,
                  address: formData.address
              } : {
                  recipientName: formData.recipientName,
                  recipientType: formData.recipientType
              }),
              // Zakat Details
              zakatType: formData.zakatType,
              amount: parseFloat(formData.amount),
              currency: formData.currency,
              paymentDate: formData.paymentDate,
              hijriYear: formData.hijriYear,
              // Payment Info
              paymentMethod: formData.paymentMethod,
              paymentId: formData.paymentId,
              paymentStatus: formData.paymentStatus,
              // Conditional fields based on payment method
              ...(formData.paymentMethod === 'UPI Transfer' && {
                  upiId: formData.upiId,
                  upiTransactionId: formData.upiTransactionId,
                  upiScreenshot: formData.upiScreenshot
              }),
              ...(formData.paymentMethod === 'Bank Transfer' && {
                  bankName: formData.bankName,
                  accountNumberLast4: formData.accountNumberLast4,
                  ifscCode: formData.ifscCode,
                  transferDateTime: formData.transferDateTime
              }),
              ...(formData.paymentMethod === 'Cash' && {
                  collectedBy: formData.collectedBy,
                  collectionLocation: formData.collectionLocation,
                  receiptNumber: formData.receiptNumber
              }),
              ...(formData.paymentMethod === 'Cheque' && {
                  chequeNumber: formData.chequeNumber,
                  bankName: formData.bankName,
                  chequeDate: formData.chequeDate,
                  clearanceStatus: formData.clearanceStatus
              }),
              ...(formData.paymentMethod === 'Card/Online Gateway' && {
                  gatewayName: formData.gatewayName,
                  gatewayTransactionId: formData.gatewayTransactionId,
                  cardLast4: formData.cardLast4
              }),
              // Additional Fields
              notes: formData.notes,
              recurringDonation: formData.recurringDonation,
              recurringFrequency: formData.recurringFrequency,
              nisabVerified: formData.nisabVerified,
              anonymousDonation: formData.anonymousDonation,
              taxReceiptRequired: formData.taxReceiptRequired,
              allocationCategory: formData.allocationCategory
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
          console.error(error);
          toast.error('Error submitting transaction');
      }
  };

  const resetForm = () => {
      setFormData({
          // Basic Information
          donorName: '',
          donorType: 'Individual',
          contactNumber: '',
          email: '',
          address: '',
          recipientName: '',
          recipientType: 'Individual',
          // Zakat Details
          zakatType: 'Zakat-al-Maal',
          amount: '',
          currency: 'INR',
          paymentDate: new Date().toISOString().split('T')[0],
          hijriYear: '1446',
          // Payment Information
          paymentMethod: 'Bank Transfer',
          paymentId: '',
          paymentStatus: 'Completed',
          // Bank Transfer Type
          bankTransferType: 'NEFT',
          // Conditional Fields
          upiId: '',
          upiTransactionId: '',
          upiScreenshot: '',
          bankName: '',
          accountNumberLast4: '',
          ifscCode: '',
          transferDateTime: '',
          collectedBy: '',
          collectionLocation: '',
          receiptNumber: '',
          chequeNumber: '',
          chequeDate: '',
          clearanceStatus: 'Pending',
          gatewayName: 'Razorpay',
          gatewayTransactionId: '',
          cardLast4: '',
          // Additional Fields
          notes: '',
          recurringDonation: false,
          recurringFrequency: 'Monthly',
          nisabVerified: false,
          anonymousDonation: false,
          taxReceiptRequired: false,
          allocationCategory: 'General'
      });
  };

  const openEditModal = (transaction: ZakatTransaction) => {
      setTransactionType(transaction.type);
      setFormData({
          // Basic Information
          donorName: transaction.donorName || '',
          donorType: transaction.donorType || 'Individual',
          contactNumber: transaction.contactNumber || '',
          email: transaction.email || '',
          address: transaction.address || '',
          recipientName: transaction.recipientName || '',
          recipientType: transaction.recipientType || 'Individual',
          // Zakat Details
          zakatType: transaction.zakatType || 'Zakat-al-Maal',
          amount: transaction.amount.toString(),
          currency: transaction.currency || 'INR',
          paymentDate: new Date(transaction.paymentDate).toISOString().split('T')[0],
          hijriYear: transaction.hijriYear || '1446',
          // Payment Information
          paymentMethod: transaction.paymentMethod,
          paymentId: transaction.paymentId,
          paymentStatus: transaction.paymentStatus || 'Completed',
          // Bank Transfer Type
          bankTransferType: (transaction as any).bankTransferType || 'NEFT',
          // Conditional Fields
          upiId: transaction.upiId || '',
          upiTransactionId: transaction.upiTransactionId || '',
          upiScreenshot: transaction.upiScreenshot || '',
          bankName: transaction.bankName || '',
          accountNumberLast4: transaction.accountNumberLast4 || '',
          ifscCode: transaction.ifscCode || '',
          transferDateTime: transaction.transferDateTime || '',
          collectedBy: transaction.collectedBy || '',
          collectionLocation: transaction.collectionLocation || '',
          receiptNumber: transaction.receiptNumber || '',
          chequeNumber: transaction.chequeNumber || '',
          chequeDate: transaction.chequeDate || '',
          clearanceStatus: transaction.clearanceStatus || 'Pending',
          gatewayName: transaction.gatewayName || 'Razorpay',
          gatewayTransactionId: transaction.gatewayTransactionId || '',
          cardLast4: transaction.cardLast4 || '',
          // Additional Fields
          notes: transaction.notes || '',
          recurringDonation: transaction.recurringDonation || false,
          recurringFrequency: transaction.recurringFrequency || 'Monthly',
          nisabVerified: transaction.nisabVerified || false,
          anonymousDonation: transaction.anonymousDonation || false,
          taxReceiptRequired: transaction.taxReceiptRequired || false,
          allocationCategory: transaction.allocationCategory || 'General'
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
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900">Transaction History</h2>
                    <div className="flex gap-2">
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
                                                    <span className="text-xs text-gray-400">ID: {t.paymentId}</span>
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
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
                <div className="bg-white rounded-lg w-full max-w-3xl my-8 max-h-[90vh] overflow-y-auto">
                    <div className="sticky top-0 bg-white border-b p-6">
                        <h3 className="text-lg font-bold text-gray-900">
                            {selectedPayment ? 'Edit Donor Record' : (transactionType === 'Credit' ? 'Record Zakat Collection' : 'Record Zakat Spending')}
                        </h3>
                    </div>

                    <form onSubmit={handleTransactionSubmit} className="p-6 space-y-6">
                        
                        {/* BASIC INFORMATION SECTION */}
                        <div className="border-b pb-6">
                            <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                                <UserGroupIcon className="h-5 w-5 mr-2 text-emerald-600" />
                                Basic Information
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {transactionType === 'Credit' ? (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Donor Name <span className="text-red-500">*</span></label>
                                            <input type="text" required disabled={formData.anonymousDonation}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100"
                                                value={formData.donorName} onChange={e => setFormData({...formData, donorName: e.target.value})} />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Donor Type <span className="text-red-500">*</span></label>
                                            <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                                value={formData.donorType} onChange={e => setFormData({...formData, donorType: e.target.value as any})}>
                                                <option value="Individual">Individual</option>
                                                <option value="Organization">Organization</option>
                                                <option value="Anonymous">Anonymous</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number {formData.donorType !== 'Anonymous' && <span className="text-red-500">*</span>}</label>
                                            <input type="tel" 
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                                value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                            <input type="email" placeholder="(Optional)"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                            <textarea rows={2}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                                value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                                            <p className="text-xs text-gray-500 mt-1">For receipt/acknowledgment</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name <span className="text-red-500">*</span></label>
                                            <input type="text" required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                                value={formData.recipientName} onChange={e => setFormData({...formData, recipientName: e.target.value})} />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Type</label>
                                            <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                                value={formData.recipientType} onChange={e => setFormData({...formData, recipientType: e.target.value})}>
                                                <option>Individual</option>
                                                <option>Family</option>
                                                <option>Mosque</option>
                                                <option>Madrasa</option>
                                                <option>NGO</option>
                                                <option>Other</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* ZAKAT DETAILS SECTION */}
                        {transactionType === 'Credit' && (
                            <div className="border-b pb-6">
                                <h4 className="text-md font-semibold text-gray-900 mb-4">Zakat Details</h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Zakat Type <span className="text-red-500">*</span></label>
                                        <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                            value={formData.zakatType} onChange={e => setFormData({...formData, zakatType: e.target.value as any})}>
                                            <option value="Zakat-al-Maal">Zakat al-Maal</option>
                                            <option value="Zakat-al-Fitr">Zakat al-Fitr</option>
                                            <option value="Fidya">Fidya</option>
                                            <option value="Kaffarah">Kaffarah</option>
                                            <option value="Sadaqah">Sadaqah</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount <span className="text-red-500">*</span></label>
                                        <input type="number" required min="0" step="0.01"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                            value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Currency <span className="text-red-500">*</span></label>
                                        <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 flex items-center">
                                            <span className="text-gray-700 font-medium">₹ INR (Indian Rupee)</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">All donations in Indian Rupees</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Zakat Year (Hijri) <span className="text-red-500">*</span></label>
                                        <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                            value={formData.hijriYear} onChange={e => setFormData({...formData, hijriYear: e.target.value})}>
                                            <option value="1445">2023-2024 (1445 ہـ)</option>
                                            <option value="1446">2024-2025 (1446 ہـ)</option>
                                            <option value="1447">2025-2026 (1447 ہـ)</option>
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">English year | Islamic Hijri year</p>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date <span className="text-red-500">*</span></label>
                                        <div className="relative group">
                                            <input type="date" required
                                                className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 cursor-pointer hover:border-emerald-400 bg-white text-gray-700 font-medium"
                                                value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} />
                                            <svg className="absolute right-4 top-3.5 h-5 w-5 text-emerald-600 pointer-events-none group-hover:text-emerald-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <div className="absolute -bottom-10 left-0 right-0 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-lg p-2 text-xs text-emerald-700 font-medium opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                                Click to open calendar
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">📅 Select the date of donation</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PAYMENT INFORMATION SECTION */}
                        <div className="border-b pb-6">
                            <h4 className="text-md font-semibold text-gray-900 mb-4">Payment Information</h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method <span className="text-red-500">*</span></label>
                                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                        value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                                        <option>Bank Transfer</option>
                                        <option>UPI Transfer</option>
                                        <option>Cash</option>
                                        <option>Cheque</option>
                                        <option>Card/Online Gateway</option>
                                        <option>QR Scanner</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status <span className="text-red-500">*</span></label>
                                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                        value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value as any})}>
                                        {formData.paymentMethod === 'Cash' ? (
                                            <>
                                                <option value="Completed">Taken</option>
                                                <option value="Pending">Pending</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="Completed">Completed</option>
                                                <option value="Pending">Pending</option>
                                                <option value="Failed">Failed</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* CONDITIONAL FIELDS - UPI TRANSFER */}
                        {formData.paymentMethod === 'UPI Transfer' && (
                            <div className="border-b pb-6 bg-blue-50 p-4 rounded-lg">
                                <h4 className="text-md font-semibold text-gray-900 mb-4">UPI Transfer Details</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID <span className="text-red-500">*</span></label>
                                        <input type="text" placeholder="name@bank" required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            value={formData.upiId} onChange={e => setFormData({...formData, upiId: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">UPI Transaction ID (UTR) <span className="text-red-500">*</span></label>
                                        <input type="text" placeholder="12-digit UTR" required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            value={formData.upiTransactionId} onChange={e => setFormData({...formData, upiTransactionId: e.target.value})} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Screenshot (Optional)</label>
                                        <input type="file" accept="image/*"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                            onChange={e => setFormData({...formData, upiScreenshot: e.target.files?.[0]?.name || ''})} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* CONDITIONAL FIELDS - BANK TRANSFER */}
                        {formData.paymentMethod === 'Bank Transfer' && (
                            <div className="border-b pb-6 bg-purple-50 p-4 rounded-lg">
                                <h4 className="text-md font-semibold text-gray-900 mb-4">Bank Transfer Details</h4>
                                
                                <div className="mb-4 p-3 bg-white border border-purple-200 rounded-lg">
                                    <label className="block text-sm font-medium text-gray-700 mb-3">Transfer Type <span className="text-red-500">*</span></label>
                                    <div className="flex gap-4">
                                        <div className="flex items-center">
                                            <input type="radio" id="neft" name="transferType" value="NEFT"
                                                checked={formData.bankTransferType === 'NEFT'}
                                                onChange={e => setFormData({...formData, bankTransferType: 'NEFT'})}
                                                className="h-4 w-4 text-emerald-600" />
                                            <label htmlFor="neft" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                                                <span className="font-medium">NEFT</span>
                                                <p className="text-xs text-gray-500">Online bank transfer with transaction ID</p>
                                            </label>
                                        </div>
                                        <div className="flex items-center">
                                            <input type="radio" id="manual" name="transferType" value="Manual"
                                                checked={formData.bankTransferType === 'Manual'}
                                                onChange={e => setFormData({...formData, bankTransferType: 'Manual'})}
                                                className="h-4 w-4 text-emerald-600" />
                                            <label htmlFor="manual" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                                                <span className="font-medium">Manual Deposit</span>
                                                <p className="text-xs text-gray-500">Donor deposited cash at bank counter</p>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name <span className="text-red-500">*</span></label>
                                        <input type="text" required placeholder="e.g., HDFC, SBI"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                            value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Number (Last 4) <span className="text-red-500">*</span></label>
                                        <input type="text" required placeholder="e.g., 1234"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                            value={formData.accountNumberLast4} onChange={e => setFormData({...formData, accountNumberLast4: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code <span className="text-red-500">*</span></label>
                                        <input type="text" required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                            value={formData.ifscCode} onChange={e => setFormData({...formData, ifscCode: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Transfer Date/Time <span className="text-red-500">*</span></label>
                                        <input type="datetime-local" required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                            value={formData.transferDateTime} onChange={e => setFormData({...formData, transferDateTime: e.target.value})} />
                                    </div>
                                    {formData.bankTransferType === 'NEFT' && (
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID <span className="text-red-500">*</span></label>
                                            <input type="text" required placeholder="NEFT reference number"
                                                className="w-full px-3 py-2 border border-purple-300 rounded-md focus:ring-purple-500 focus:border-purple-500 bg-purple-50"
                                                value={formData.paymentId} onChange={e => setFormData({...formData, paymentId: e.target.value})} />
                                            <p className="text-xs text-gray-500 mt-1">Provided by the transferring bank</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* CONDITIONAL FIELDS - CASH */}
                        {formData.paymentMethod === 'Cash' && (
                            <div className="border-b pb-6 bg-amber-50 p-4 rounded-lg">
                                <h4 className="text-md font-semibold text-gray-900 mb-4">Cash Collection Details</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Collected By <span className="text-red-500">*</span></label>
                                        <input type="text" required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                                            value={formData.collectedBy} onChange={e => setFormData({...formData, collectedBy: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Collection Location <span className="text-red-500">*</span></label>
                                        <input type="text" required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                                            value={formData.collectionLocation} onChange={e => setFormData({...formData, collectionLocation: e.target.value})} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Number <span className="text-red-500">*</span></label>
                                        <input type="text" required placeholder="Auto-generated"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                                            value={formData.receiptNumber} onChange={e => setFormData({...formData, receiptNumber: e.target.value})} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* CONDITIONAL FIELDS - CHEQUE */}
                        {formData.paymentMethod === 'Cheque' && (
                            <div className="border-b pb-6 bg-indigo-50 p-4 rounded-lg">
                                <h4 className="text-md font-semibold text-gray-900 mb-4">Cheque Details</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Number <span className="text-red-500">*</span></label>
                                        <input type="text" required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                            value={formData.chequeNumber} onChange={e => setFormData({...formData, chequeNumber: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name <span className="text-red-500">*</span></label>
                                        <input type="text" required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                            value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Date <span className="text-red-500">*</span></label>
                                        <input type="date" required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                            value={formData.chequeDate} onChange={e => setFormData({...formData, chequeDate: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Clearance Status <span className="text-red-500">*</span></label>
                                        <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                            value={formData.clearanceStatus} onChange={e => setFormData({...formData, clearanceStatus: e.target.value})}>
                                            <option>Pending</option>
                                            <option>Cleared</option>
                                            <option>Bounced</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* CONDITIONAL FIELDS - CARD/ONLINE GATEWAY */}
                        {formData.paymentMethod === 'Card/Online Gateway' && (
                            <div className="border-b pb-6 bg-pink-50 p-4 rounded-lg">
                                <h4 className="text-md font-semibold text-gray-900 mb-4">Online Payment Gateway Details</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Gateway Name <span className="text-red-500">*</span></label>
                                        <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
                                            value={formData.gatewayName} onChange={e => setFormData({...formData, gatewayName: e.target.value})}>
                                            <option value="Razorpay">Razorpay</option>
                                            <option value="Stripe">Stripe</option>
                                            <option value="PayPal">PayPal</option>
                                            <option value="Square">Square</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Gateway Transaction ID <span className="text-red-500">*</span></label>
                                        <input type="text" required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
                                            value={formData.gatewayTransactionId} onChange={e => setFormData({...formData, gatewayTransactionId: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Card Last 4 Digits</label>
                                        <input type="text" placeholder="e.g., 1234"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
                                            value={formData.cardLast4} onChange={e => setFormData({...formData, cardLast4: e.target.value})} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ADDITIONAL FIELDS */}
                        <div className="border-b pb-6">
                            <h4 className="text-md font-semibold text-gray-900 mb-4">Additional Information</h4>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Purpose</label>
                                    <textarea rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                        placeholder="Donor's intent (e.g., 'For orphans in Yemen')"
                                        value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                                </div>

                                {transactionType === 'Credit' && (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Allocation Category <span className="text-red-500">*</span></label>
                                                <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                                    value={formData.allocationCategory} onChange={e => setFormData({...formData, allocationCategory: e.target.value as any})}>
                                                    <option value="General">General</option>
                                                    <option value="Education">Education</option>
                                                    <option value="Food">Food</option>
                                                    <option value="Medical">Medical</option>
                                                    <option value="Emergency">Emergency</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-3 border-t pt-4">
                                            <div className="flex items-center">
                                                <input type="checkbox" id="nisabVerified"
                                                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                                                    checked={formData.nisabVerified} onChange={e => setFormData({...formData, nisabVerified: e.target.checked})} />
                                                <label htmlFor="nisabVerified" className="ml-2 block text-sm text-gray-700">
                                                    Nisab Verified — Donor confirms they met Nisab threshold
                                                </label>
                                            </div>

                                            <div className="flex items-center">
                                                <input type="checkbox" id="recurring"
                                                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                                                    checked={formData.recurringDonation} onChange={e => setFormData({...formData, recurringDonation: e.target.checked})} />
                                                <label htmlFor="recurring" className="ml-2 block text-sm text-gray-700">
                                                    Recurring Donation
                                                </label>
                                            </div>

                                            {formData.recurringDonation && (
                                                <div className="ml-6 flex items-center gap-2">
                                                    <select className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                                                        value={formData.recurringFrequency} onChange={e => setFormData({...formData, recurringFrequency: e.target.value as any})}>
                                                        <option value="Monthly">Monthly</option>
                                                        <option value="Yearly">Yearly</option>
                                                    </select>
                                                </div>
                                            )}

                                            <div className="flex items-center">
                                                <input type="checkbox" id="anonymous"
                                                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                                                    checked={formData.anonymousDonation} onChange={e => setFormData({...formData, anonymousDonation: e.target.checked})} />
                                                <label htmlFor="anonymous" className="ml-2 block text-sm text-gray-700">
                                                    Anonymous Donation — Hide name in reports
                                                </label>
                                            </div>

                                            <div className="flex items-center">
                                                <input type="checkbox" id="taxReceipt"
                                                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                                                    checked={formData.taxReceiptRequired} onChange={e => setFormData({...formData, taxReceiptRequired: e.target.checked})} />
                                                <label htmlFor="taxReceipt" className="ml-2 block text-sm text-gray-700">
                                                    Tax Receipt Required — Generate 80G receipt (India)
                                                </label>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* FORM ACTIONS */}
                        <div className="flex justify-end gap-3 pt-6">
                            <button
                                type="button"
                                onClick={() => { setShowTransactionModal(false); setSelectedPayment(null); }}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className={`px-4 py-2 text-white rounded-md font-medium flex items-center gap-2 ${
                                    transactionType === 'Credit' 
                                        ? 'bg-emerald-600 hover:bg-emerald-700' 
                                        : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                {selectedPayment ? 'Update Record' : 'Save Record'}
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
