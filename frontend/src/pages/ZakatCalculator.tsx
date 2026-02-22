import React, { useState, useEffect } from 'react';
import {
  CurrencyRupeeIcon,
  CalculatorIcon,
  InformationCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  HeartIcon,
  ShieldCheckIcon,
  BanknotesIcon,
  CreditCardIcon,
  AcademicCapIcon,
  BuildingLibraryIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import ZakatManagement from '../components/Zakat/ZakatManagement';

interface NisabData {
  gold: number;
  silver: number;
  currency: string;
  lastUpdated: string;
  goldUnitPrice: number; // Price per gram
  silverUnitPrice: number; // Price per gram
  weightUnit: string;
}

interface ZakatForm {
  // Nisab Configuration
  metalStandard: 'gold' | 'silver';
  calculationStandard: 'classical' | 'common';
  currency: string;

  // Assets
  cash: string;
  // Gold - either value or weight
  goldValue: string;
  goldWeight: string;
  goldWeightUnit: 'g' | 'oz';
  // Silver - either value or weight
  silverValue: string;
  silverWeight: string;
  silverWeightUnit: 'g' | 'oz';
  // Other assets
  investments: string;
  businessAssets: string;
  cryptocurrency: string;
  managedZakat: string;

  // Deductions
  personalDebts: string;
  businessDebts: string;

  // Hawl
  hawlConfirmed: boolean;
}

interface ZakatResult {
  totalAssets: number;
  totalDeductions: number;
  netWealth: number;
  nisabThreshold: number;
  isEligible: boolean;
  hawlMet: boolean;
  zakatDue: number;
}

const ZakatCalculator: React.FC = () => {
  const { hasRole } = useAuth();
  const [nisabData, setNisabData] = useState<NisabData | null>(null);
  const [activeTab, setActiveTab] = useState<'calculator' | 'management'>('calculator');

  // Check if user is admin or manager
  const isAdmin = hasRole(['superadmin', 'manager']);

  // Currency display names
  const currencyNames: Record<string, string> = {
    inr: 'INR (₹)',
    usd: 'USD ($)',
    gbp: 'GBP (£)',
    eur: 'EUR (€)',
    sar: 'SAR (﷼)',
    aed: 'AED (د.إ)',
  };

  const [form, setForm] = useState<ZakatForm>({
    metalStandard: 'gold',
    calculationStandard: 'common',
    currency: 'inr',
    cash: '',
    goldValue: '',
    goldWeight: '',
    goldWeightUnit: 'g',
    silverValue: '',
    silverWeight: '',
    silverWeightUnit: 'g',
    investments: '',
    businessAssets: '',
    cryptocurrency: '',
    managedZakat: '',
    personalDebts: '',
    businessDebts: '',
    hawlConfirmed: false,
  });

  const [result, setResult] = useState<ZakatResult | null>(null);

  // Fetch Nisab data on mount
  const fetchNisabData = async () => {
    try {
      const apiKey = 'icgUaIHMO8GWEVLh7XhFcFoTHjQlsfhSBpJtYfrtTUJXY1eI';
      const standard = form.calculationStandard === 'classical' ? 'classical' : 'common';
      const response = await fetch(
        `https://islamicapi.com/api/v1/zakat-nisab/?standard=${standard}&currency=${form.currency}&unit=g&api_key=${apiKey}`
      );
      const data = await response.json();

      if (data.status === 'success') {
        setNisabData({
          gold: data.data.nisab_thresholds.gold.nisab_amount,
          silver: data.data.nisab_thresholds.silver.nisab_amount,
          currency: data.data.currency,
          lastUpdated: new Date().toLocaleString(),
          goldUnitPrice: data.data.nisab_thresholds.gold.unit_price,
          silverUnitPrice: data.data.nisab_thresholds.silver.unit_price,
          weightUnit: data.weight_unit || 'gram',
        });
      } else {
        toast.error('Unable to fetch live nisab values. Using manual calculation.');
      }
    } catch (error) {
      console.error('Nisab API error:', error);
      toast.error('Unable to fetch live nisab values.');
    }
  };

  useEffect(() => {
    fetchNisabData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.metalStandard, form.calculationStandard, form.currency]);

  const handleInputChange = (field: keyof ZakatForm, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const calculateZakat = () => {
    // Parse all values
    const cash = parseFloat(form.cash) || 0;
    
    // Calculate gold value from weight or use direct value
    let finalGoldValue = parseFloat(form.goldValue) || 0;
    const goldWeight = parseFloat(form.goldWeight) || 0;
    if (goldWeight > 0 && nisabData?.goldUnitPrice) {
      // Convert weight to grams if in ounce
      const weightInGrams = form.goldWeightUnit === 'oz' ? goldWeight * 31.1035 : goldWeight;
      finalGoldValue = weightInGrams * nisabData.goldUnitPrice;
    }
    
    // Calculate silver value from weight or use direct value
    let finalSilverValue = parseFloat(form.silverValue) || 0;
    const silverWeight = parseFloat(form.silverWeight) || 0;
    if (silverWeight > 0 && nisabData?.silverUnitPrice) {
      // Convert weight to grams if in ounce
      const weightInGrams = form.silverWeightUnit === 'oz' ? silverWeight * 31.1035 : silverWeight;
      finalSilverValue = weightInGrams * nisabData.silverUnitPrice;
    }
    
    const investments = parseFloat(form.investments) || 0;
    const businessAssets = parseFloat(form.businessAssets) || 0;
    const cryptocurrency = parseFloat(form.cryptocurrency) || 0;
    const managedZakat = parseFloat(form.managedZakat) || 0;

    const personalDebts = parseFloat(form.personalDebts) || 0;
    const businessDebts = parseFloat(form.businessDebts) || 0;

    // Calculate totals
    const totalAssets = cash + finalGoldValue + finalSilverValue + investments +
                       businessAssets + cryptocurrency + managedZakat;

    const totalDeductions = personalDebts + businessDebts;

    const netWealth = totalAssets - totalDeductions;

    // Get nisab threshold based on selected metal
    const nisabThreshold = form.metalStandard === 'gold' ? nisabData?.gold : nisabData?.silver;

    // Check eligibility
    const isEligible = netWealth >= (nisabThreshold || 0);
    const hawlMet = form.hawlConfirmed;

    // Calculate zakat (only if eligible and hawl confirmed)
    const zakatDue = (isEligible && hawlMet) ? netWealth * 0.025 : 0;

    setResult({
      totalAssets,
      totalDeductions,
      netWealth,
      nisabThreshold: nisabThreshold || 0,
      isEligible,
      hawlMet,
      zakatDue,
    });
  };

  const resetForm = () => {
    setForm({
      metalStandard: 'gold',
      calculationStandard: 'classical',
      currency: 'inr',
      cash: '',
      goldValue: '',
      goldWeight: '',
      goldWeightUnit: 'g',
      silverValue: '',
      silverWeight: '',
      silverWeightUnit: 'g',
      investments: '',
      businessAssets: '',
      cryptocurrency: '',
      managedZakat: '',
      personalDebts: '',
      businessDebts: '',
      hawlConfirmed: false,
    });
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-16 relative overflow-hidden">
      {/* Islamic Pattern Background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, #10b981 1px, transparent 0)`,
          backgroundSize: '48px 48px'
        }}></div>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header with Tabs for Admin */}
        {isAdmin && (
          <div className="mb-8">
            <div className="bg-white rounded-xl shadow-md p-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('calculator')}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                    activeTab === 'calculator'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <CalculatorIcon className="h-5 w-5" />
                  Zakat Calculator
                </button>
                <button
                  onClick={() => setActiveTab('management')}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                    activeTab === 'management'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <BuildingLibraryIcon className="h-5 w-5" />
                  Zakat Center
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Show Zakat Management for Admin */}
        {isAdmin && activeTab === 'management' ? (
          <ZakatManagement 
            showStats={false}
            showExport={false}
            showDelete={false}
            showDonorSummary={false}
            showRecordButtons={true}
            showFilters={true}
          />
        ) : (
          <>
        
        {/* Hero Section */}
        <div className="text-center mb-12">
          {/* Icon Badge */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-3xl shadow-2xl mb-6">
            <BanknotesIcon className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Zakat Calculator
          </h1>
          
          <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-6">
            Calculate your Zakat obligation according to classical Islamic jurisprudence
          </p>

          {/* Feature Badges */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md">
              <ShieldCheckIcon className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-semibold text-gray-700">Sharī-Compliant</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md">
              <SparklesIcon className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-semibold text-gray-700">Live Nisab Rates</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md">
              <HeartIcon className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-semibold text-gray-700">2.5% Zakat Rate</span>
            </div>
          </div>

          {/* Quran Verse */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 max-w-3xl mx-auto border-2 border-emerald-200">
            <p className="text-2xl font-arabic text-emerald-800 mb-3 leading-loose" dir="rtl">
              وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ
            </p>
            <p className="text-gray-700 italic">
              "And establish prayer and give Zakat" — Quran 2:43
            </p>
          </div>
        </div>

        {/* Nisab Configuration */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
              <CurrencyRupeeIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Nisab Configuration</h2>
              <p className="text-sm text-gray-500">Select your calculation preferences</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Metal Standard */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Metal Standard
              </label>
              <select
                value={form.metalStandard}
                onChange={(e) => handleInputChange('metalStandard', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="gold">🥇 Gold Standard</option>
                <option value="silver">🥈 Silver Standard</option>
              </select>
            </div>

            {/* Calculation Standard */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Calculation Standard
              </label>
              <select
                value={form.calculationStandard}
                onChange={(e) => handleInputChange('calculationStandard', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="classical">Classical (87.48g Gold / 612.36g Silver)</option>
                <option value="common">Common (85g Gold / 595g Silver)</option>
              </select>
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Currency
              </label>
              <select
                value={form.currency}
                onChange={(e) => handleInputChange('currency', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="inr">🇮🇳 INR (Indian Rupee)</option>
                <option value="usd">🇺🇸 USD (US Dollar)</option>
                <option value="gbp">🇬🇧 GBP (British Pound)</option>
                <option value="eur">🇪🇺 EUR (Euro)</option>
                <option value="sar">🇸🇦 SAR (Saudi Riyal)</option>
                <option value="aed">🇦🇪 AED (UAE Dirham)</option>
              </select>
            </div>
          </div>

          {/* Nisab Display */}
          {nisabData && nisabData.currency && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border-2 border-emerald-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Gold Nisab</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {nisabData.gold.toLocaleString('en-IN', { style: 'currency', currency: nisabData.currency.toUpperCase() })}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Silver Nisab</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {nisabData.silver.toLocaleString('en-IN', { style: 'currency', currency: nisabData.currency.toUpperCase() })}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Selected Standard</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {form.metalStandard === 'gold' ? '🥇 Gold' : '🥈 Silver'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500 text-center mt-3">
                Last updated: {nisabData.lastUpdated}
              </p>
            </div>
          )}
        </div>

        {/* Assets Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <CurrencyRupeeIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Zakatable Assets</h2>
              <p className="text-sm text-gray-500">Enter current market values or weight</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cash */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                💰 Cash & Bank Savings
              </label>
              <input
                type="number"
                value={form.cash}
                onChange={(e) => handleInputChange('cash', e.target.value)}
                placeholder="Enter cash amount"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Gold - Value Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🥇 Gold (Market Value)
              </label>
              <input
                type="number"
                value={form.goldValue}
                onChange={(e) => handleInputChange('goldValue', e.target.value)}
                placeholder={`Enter gold value in ${currencyNames[form.currency] || form.currency.toUpperCase()}`}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="text-xs text-gray-500 mt-1">Enter direct value if you know the market price</p>
            </div>

            {/* Gold - Weight Input */}
            <div className="md:col-span-2 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-4 border-2 border-amber-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg font-bold text-amber-800">🥇 Gold Weight Calculator</span>
                <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">Optional - Auto-calculates value</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-amber-900 mb-2">
                    Gold Weight
                  </label>
                  <input
                    type="number"
                    value={form.goldWeight}
                    onChange={(e) => handleInputChange('goldWeight', e.target.value)}
                    placeholder="Enter gold weight"
                    className="w-full px-4 py-3 border-2 border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-amber-900 mb-2">
                    Weight Unit
                  </label>
                  <select
                    value={form.goldWeightUnit}
                    onChange={(e) => handleInputChange('goldWeightUnit', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="g">Grams (g)</option>
                    <option value="oz">Ounce (oz)</option>
                  </select>
                </div>
              </div>
              {form.goldWeight && nisabData?.goldUnitPrice && nisabData?.currency && (
                <div className="mt-3 bg-amber-100 rounded-lg p-3 border border-amber-300">
                  <p className="text-sm text-amber-900">
                    <span className="font-semibold">Calculated Value:</span>{' '}
                    <span className="font-bold text-lg">
                      {nisabData.currency.toUpperCase()} {(parseFloat(form.goldWeight) * (form.goldWeightUnit === 'oz' ? 31.1035 : 1) * nisabData.goldUnitPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                    {' '}<span className="text-xs">({form.goldWeight} {form.goldWeightUnit === 'g' ? 'g' : 'oz'} × {nisabData.goldUnitPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })} per gram)</span>
                  </p>
                </div>
              )}
              <p className="text-xs text-amber-700 mt-2">
                💡 Value will be calculated automatically using live market prices from the API
              </p>
            </div>

            {/* Silver - Value Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🥈 Silver (Market Value)
              </label>
              <input
                type="number"
                value={form.silverValue}
                onChange={(e) => handleInputChange('silverValue', e.target.value)}
                placeholder={`Enter silver value in ${currencyNames[form.currency] || form.currency.toUpperCase()}`}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="text-xs text-gray-500 mt-1">Enter direct value if you know the market price</p>
            </div>

            {/* Silver - Weight Input */}
            <div className="md:col-span-2 bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-4 border-2 border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg font-bold text-slate-800">🥈 Silver Weight Calculator</span>
                <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-full">Optional - Auto-calculates value</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Silver Weight
                  </label>
                  <input
                    type="number"
                    value={form.silverWeight}
                    onChange={(e) => handleInputChange('silverWeight', e.target.value)}
                    placeholder="Enter silver weight"
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Weight Unit
                  </label>
                  <select
                    value={form.silverWeightUnit}
                    onChange={(e) => handleInputChange('silverWeightUnit', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  >
                    <option value="g">Grams (g)</option>
                    <option value="oz">Ounce (oz)</option>
                  </select>
                </div>
              </div>
              {form.silverWeight && nisabData?.silverUnitPrice && nisabData?.currency && (
                <div className="mt-3 bg-slate-100 rounded-lg p-3 border border-slate-300">
                  <p className="text-sm text-slate-900">
                    <span className="font-semibold">Calculated Value:</span>{' '}
                    <span className="font-bold text-lg">
                      {nisabData.currency.toUpperCase()} {(parseFloat(form.silverWeight) * (form.silverWeightUnit === 'oz' ? 31.1035 : 1) * nisabData.silverUnitPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                    {' '}<span className="text-xs">({form.silverWeight} {form.silverWeightUnit === 'g' ? 'g' : 'oz'} × {nisabData.silverUnitPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })} per gram)</span>
                  </p>
                </div>
              )}
              <p className="text-xs text-slate-700 mt-2">
                💡 Value will be calculated automatically using live market prices from the API
              </p>
            </div>

            {/* Other Assets */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📈 Investments & Stocks
              </label>
              <input
                type="number"
                value={form.investments}
                onChange={(e) => handleInputChange('investments', e.target.value)}
                placeholder="Enter investment value"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🏪 Business Inventory
              </label>
              <input
                type="number"
                value={form.businessAssets}
                onChange={(e) => handleInputChange('businessAssets', e.target.value)}
                placeholder="Enter business assets value"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ₿ Cryptocurrency
              </label>
              <input
                type="number"
                value={form.cryptocurrency}
                onChange={(e) => handleInputChange('cryptocurrency', e.target.value)}
                placeholder="Enter crypto value"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🤲 Managed Zakat (Not Yet Distributed)
              </label>
              <input
                type="number"
                value={form.managedZakat}
                onChange={(e) => handleInputChange('managedZakat', e.target.value)}
                placeholder="Enter managed zakat amount"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Fiqh Note */}
          <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
            <div className="flex items-start gap-3">
              <InformationCircleIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-1">Important Fiqh Notes</p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Gold jewelry with gemstones: Only count gold weight value</li>
                  <li>• Business inventory: Use current resale/depreciated value</li>
                  <li>• Trading stocks: Full market value included</li>
                  <li>• Cryptocurrency: Treated as cash equivalent</li>
                  <li>• Weight inputs: Value auto-calculated using live API prices</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Deductions Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
              <CreditCardIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Allowable Deductions</h2>
              <p className="text-sm text-gray-500">Only immediate debts due this lunar year</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                💳 Personal Debts Due (This Year)
              </label>
              <input
                type="number"
                value={form.personalDebts}
                onChange={(e) => handleInputChange('personalDebts', e.target.value)}
                placeholder="Enter immediate personal debts"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🏢 Business Debts Due (This Year)
              </label>
              <input
                type="number"
                value={form.businessDebts}
                onChange={(e) => handleInputChange('businessDebts', e.target.value)}
                placeholder="Enter immediate business debts"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Fiqh Note */}
          <div className="mt-4 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
            <div className="flex items-start gap-3">
              <ExclamationCircleIcon className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900 mb-1">Sharī-Compliant Deductions Only</p>
                <ul className="text-xs text-amber-700 space-y-1">
                  <li>✓ Immediate debts due within current lunar year</li>
                  <li>✓ Credit card balances</li>
                  <li>✓ Short-term loans</li>
                  <li>✓ Current due installments</li>
                  <li className="text-red-600">✗ Full 20-year mortgage (NOT deductible)</li>
                  <li className="text-red-600">✗ Long-term deferred debt (NOT deductible)</li>
                  <li className="text-red-600">✗ Future installments beyond this cycle (NOT deductible)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Hawl Confirmation */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <AcademicCapIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Ḥawl (Lunar Year) Confirmation</h2>
              <p className="text-sm text-gray-500">Zakat is only due after one lunar year</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
            <label className="flex items-start gap-4 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hawlConfirmed}
                onChange={(e) => handleInputChange('hawlConfirmed', e.target.checked)}
                className="w-6 h-6 mt-1 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <p className="text-base font-semibold text-gray-900 mb-2">
                  Has your wealth remained above nisab for one complete lunar year (354 days)?
                </p>
                <p className="text-sm text-gray-600">
                  Zakat is only obligatory on wealth that has been held for a full lunar year. 
                  If your wealth dipped below nisab during the year (temporarily), according to the majority 
                  opinion (Ḥanafī), this does not reset the ḥawl.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <button
            onClick={calculateZakat}
            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-teal-600 transition-all transform hover:scale-105 shadow-lg"
          >
            Calculate Zakat
          </button>
          <button
            onClick={resetForm}
            className="px-8 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
          >
            Reset
          </button>
        </div>

        {/* Results Section */}
        {result && (
          <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-3xl shadow-2xl p-8 text-white mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <CalculatorIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">Zakat Calculation Result</h2>
                <p className="text-emerald-100">Transparent breakdown of your calculation</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <p className="text-emerald-100 text-sm mb-2">Total Assets</p>
                <p className="text-3xl font-bold">₹{result.totalAssets.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <p className="text-emerald-100 text-sm mb-2">Total Deductions</p>
                <p className="text-3xl font-bold">₹{result.totalDeductions.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <p className="text-emerald-100 text-sm mb-2">Net Zakatable Wealth</p>
                <p className="text-3xl font-bold">₹{result.netWealth.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <p className="text-emerald-100 text-sm mb-2">Nisab Threshold ({form.metalStandard})</p>
                <p className="text-3xl font-bold">₹{result.nisabThreshold.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Eligibility Status */}
            <div className={`rounded-2xl p-6 mb-6 ${
              result.isEligible && result.hawlMet ? 'bg-green-500' : 'bg-red-500'
            }`}>
              <div className="flex items-center gap-4">
                {result.isEligible && result.hawlMet ? (
                  <CheckCircleSolidIcon className="w-12 h-12 text-white" />
                ) : (
                  <ExclamationCircleIcon className="w-12 h-12 text-white" />
                )}
                <div className="flex-1">
                  <p className="text-2xl font-bold mb-1">
                    {result.isEligible && result.hawlMet 
                      ? 'Zakat is Obligatory' 
                      : 'Zakat is NOT Obligatory'}
                  </p>
                  <p className="text-white/90">
                    {!result.isEligible && 'Your wealth is below the nisab threshold.'}
                    {!result.hawlMet && 'You have not confirmed the lunar year (ḥawl) requirement.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Zakat Due */}
            {result.isEligible && result.hawlMet && (
              <div className="bg-white rounded-2xl p-8 text-center">
                <p className="text-gray-600 text-sm mb-2">Total Zakat Due (2.5%)</p>
                <p className="text-5xl font-bold text-emerald-600 mb-4">
                  ₹{result.zakatDue.toLocaleString('en-IN')}
                </p>
                <p className="text-gray-500 text-sm">
                  Must be paid within 30 days
                </p>
              </div>
            )}

            {/* Spiritual Reminder */}
            <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
              <HeartIcon className="w-8 h-8 text-white mx-auto mb-3" />
              <p className="text-lg font-semibold mb-2">
                "Zakāh purifies wealth. Ensure intention (niyyah) is made before payment."
              </p>
              <p className="text-emerald-100 text-sm">
                May Allah accept your Zakat and bless your wealth.
              </p>
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div className="text-center text-sm text-gray-500">
          <p>This calculator follows classical Islamic jurisprudence principles.</p>
          <p>For complex situations, please consult a qualified Islamic scholar.</p>
        </div>
        </>
        )}
      </div>
    </div>
  );
};

export default ZakatCalculator;
