import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BanknotesIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ScaleIcon,
  ArrowPathIcon,
  HeartIcon,
  AcademicCapIcon,
  BuildingLibraryIcon,
  DocumentArrowDownIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import { API_URL } from '../../config';
import toast from 'react-hot-toast';
import ZakatManagement from '../Zakat/ZakatManagement';
import MaktabManagement from '../Maktab/MaktabManagement';

interface CategoryTotals {
  collected: number;
  spent: number;
  currentBalance: number;
}

interface FundsTotals {
  zakat: CategoryTotals;
  sadaqah: CategoryTotals;
  maktab: CategoryTotals;
}

const EMPTY: CategoryTotals = { collected: 0, spent: 0, currentBalance: 0 };

type ThemeKey = 'emerald' | 'cyan' | 'indigo' | 'slate';

const THEME: Record<ThemeKey, {
  ring: string;
  bar: string;
  iconWrap: string;
  iconText: string;
  balanceText: string;
  chip: string;
}> = {
  emerald: {
    ring: 'border-emerald-200',
    bar: 'bg-emerald-500',
    iconWrap: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    balanceText: 'text-emerald-700',
    chip: 'bg-emerald-50 text-emerald-700',
  },
  cyan: {
    ring: 'border-cyan-200',
    bar: 'bg-cyan-500',
    iconWrap: 'bg-cyan-100',
    iconText: 'text-cyan-600',
    balanceText: 'text-cyan-700',
    chip: 'bg-cyan-50 text-cyan-700',
  },
  indigo: {
    ring: 'border-indigo-200',
    bar: 'bg-indigo-500',
    iconWrap: 'bg-indigo-100',
    iconText: 'text-indigo-600',
    balanceText: 'text-indigo-700',
    chip: 'bg-indigo-50 text-indigo-700',
  },
  slate: {
    ring: 'border-slate-200',
    bar: 'bg-slate-700',
    iconWrap: 'bg-slate-100',
    iconText: 'text-slate-700',
    balanceText: 'text-slate-900',
    chip: 'bg-slate-100 text-slate-700',
  },
};

const formatINR = (value: number) => `₹${value.toLocaleString('en-IN')}`;

interface CategoryCardProps {
  title: string;
  subtitle: string;
  theme: ThemeKey;
  icon: React.ReactNode;
  totals: CategoryTotals;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ title, subtitle, theme, icon, totals }) => {
  const t = THEME[theme];
  const spentPct = totals.collected > 0
    ? Math.min(100, Math.round((totals.spent / totals.collected) * 100))
    : 0;

  return (
    <div className={`bg-white rounded-2xl shadow-md border ${t.ring} p-5 hover:shadow-lg transition-shadow`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-11 h-11 ${t.iconWrap} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <span className={t.iconText}>{icon}</span>
        </div>
        <div className="min-w-0">
          <h4 className="text-base font-bold text-gray-900 truncate">{title}</h4>
          <p className="text-xs text-gray-500 truncate">{subtitle}</p>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-0.5">Current Balance</p>
        <p className={`text-2xl font-extrabold ${totals.currentBalance >= 0 ? t.balanceText : 'text-red-600'}`}>
          {formatINR(totals.currentBalance)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-xl bg-green-50 px-3 py-2">
          <p className="text-[11px] font-medium text-green-700 flex items-center gap-1">
            <ArrowUpIcon className="w-3 h-3" /> Collected
          </p>
          <p className="text-sm font-bold text-green-800">{formatINR(totals.collected)}</p>
        </div>
        <div className="rounded-xl bg-red-50 px-3 py-2">
          <p className="text-[11px] font-medium text-red-700 flex items-center gap-1">
            <ArrowDownIcon className="w-3 h-3" /> Spent
          </p>
          <p className="text-sm font-bold text-red-800">{formatINR(totals.spent)}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
          <span>Utilisation</span>
          <span className="font-semibold">{spentPct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div className={`h-full ${t.bar} rounded-full transition-all`} style={{ width: `${spentPct}%` }} />
        </div>
      </div>
    </div>
  );
};

const FundsManagement: React.FC = () => {
  const [totals, setTotals] = useState<FundsTotals>({ zakat: EMPTY, sadaqah: EMPTY, maktab: EMPTY });
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<'zakat' | 'maktab'>('zakat');
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [importing, setImporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const exportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTotals = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [zakatRes, maktabRes] = await Promise.all([
        fetch(`${API_URL}/zakat/stats/split`, { headers }),
        fetch(`${API_URL}/maktab/stats`, { headers }),
      ]);

      const zakatData = await zakatRes.json();
      const maktabData = await maktabRes.json();

      const next: FundsTotals = { zakat: EMPTY, sadaqah: EMPTY, maktab: EMPTY };

      if (zakatData.status === 'success' && zakatData.data) {
        next.zakat = {
          collected: zakatData.data.zakat?.collected || 0,
          spent: zakatData.data.zakat?.spent || 0,
          currentBalance: zakatData.data.zakat?.currentBalance || 0,
        };
        next.sadaqah = {
          collected: zakatData.data.sadaqah?.collected || 0,
          spent: zakatData.data.sadaqah?.spent || 0,
          currentBalance: zakatData.data.sadaqah?.currentBalance || 0,
        };
      }

      if (maktabData.status === 'success' && maktabData.data) {
        next.maktab = {
          collected: maktabData.data.totalCollected || 0,
          spent: maktabData.data.totalSpent || 0,
          currentBalance: maktabData.data.currentBalance || 0,
        };
      }

      setTotals(next);
    } catch (error) {
      console.error('Funds totals error:', error);
      toast.error('Failed to load funds overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTotals();
  }, [fetchTotals]);

  const grand: CategoryTotals = {
    collected: totals.zakat.collected + totals.sadaqah.collected + totals.maktab.collected,
    spent: totals.zakat.spent + totals.sadaqah.spent + totals.maktab.spent,
    currentBalance: totals.zakat.currentBalance + totals.sadaqah.currentBalance + totals.maktab.currentBalance,
  };

  // Close export dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportOptions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Export dispatches a window event handled by the mounted section components
  const handleExport = (target: 'zakat' | 'maktab', format: 'csv' | 'json') => {
    window.dispatchEvent(new CustomEvent(`export-${target}-${format}`));
    setShowExportOptions(false);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      const endpoint = section === 'zakat' ? 'zakat' : 'maktab';
      const response = await fetch(`${API_URL}/${endpoint}/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        const { inserted, skipped } = data.data;
        toast.success(`Imported ${inserted} record${inserted === 1 ? '' : 's'}${skipped ? `, skipped ${skipped}` : ''}`);
        setRefreshKey((k) => k + 1);
        fetchTotals();
      } else {
        toast.error(data.message || 'Import failed');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed. Please check the file format.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Unified Header */}
      <div className="relative rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 p-6 sm:p-8 text-white shadow-lg">
        <div className="absolute inset-0 rounded-2xl overflow-hidden opacity-10 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, #ffffff 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <BanknotesIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold">Funds Management</h2>
              <p className="text-white/80 text-sm mt-1">Manage all Zakat, Sadaqah &amp; Maktab funds</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Export */}
            <div className="relative" ref={exportRef}>
              <button
                onClick={() => setShowExportOptions((v) => !v)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 transition-colors font-medium text-sm"
              >
                <DocumentArrowDownIcon className="w-5 h-5" />
                Export
              </button>
              {showExportOptions && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg z-30 ring-1 ring-black ring-opacity-5 overflow-hidden">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                    Zakat &amp; Sadaqah
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExport('zakat', 'csv')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                  >
                    CSV (Excel)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('zakat', 'json')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                  >
                    JSON Data
                  </button>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-t border-gray-100">
                    Maktab
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExport('maktab', 'csv')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                  >
                    CSV (Excel)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('maktab', 'json')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                  >
                    JSON Data
                  </button>
                </div>
              )}
            </div>

            {/* Import */}
            <button
              onClick={handleImportClick}
              disabled={importing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 transition-colors font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              title="Import CSV, Excel or JSON"
            >
              <ArrowUpTrayIcon className="w-5 h-5" />
              {importing ? 'Importing...' : 'Import'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              onChange={handleImportFile}
              className="hidden"
            />

            {/* Refresh */}
            <button
              onClick={fetchTotals}
              className="p-2.5 rounded-xl bg-white/15 hover:bg-white/25 transition-colors"
              title="Refresh overview"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Segregated Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <CategoryCard
          title="Zakat"
          subtitle="Obligatory charity"
          theme="emerald"
          icon={<BuildingLibraryIcon className="w-6 h-6" />}
          totals={totals.zakat}
        />
        <CategoryCard
          title="Sadaqah"
          subtitle="Voluntary charity"
          theme="cyan"
          icon={<HeartIcon className="w-6 h-6" />}
          totals={totals.sadaqah}
        />
        <CategoryCard
          title="Maktab"
          subtitle="Education fund"
          theme="indigo"
          icon={<AcademicCapIcon className="w-6 h-6" />}
          totals={totals.maktab}
        />

        {/* Grand Total */}
        <div className="bg-slate-900 rounded-2xl shadow-md p-5 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <ScaleIcon className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h4 className="text-base font-bold truncate">Grand Total</h4>
              <p className="text-xs text-white/60 truncate">All funds combined</p>
            </div>
          </div>
          <div className="mb-3">
            <p className="text-xs uppercase tracking-wide text-white/50 mb-0.5">Net Balance</p>
            <p className={`text-2xl font-extrabold ${grand.currentBalance >= 0 ? 'text-white' : 'text-red-300'}`}>
              {formatINR(grand.currentBalance)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <p className="text-[11px] font-medium text-emerald-300 flex items-center gap-1">
                <ArrowUpIcon className="w-3 h-3" /> Collected
              </p>
              <p className="text-sm font-bold">{formatINR(grand.collected)}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <p className="text-[11px] font-medium text-red-300 flex items-center gap-1">
                <ArrowDownIcon className="w-3 h-3" /> Spent
              </p>
              <p className="text-sm font-bold">{formatINR(grand.spent)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section Toggle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setSection('zakat')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
              section === 'zakat'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BuildingLibraryIcon className="h-5 w-5" />
            Zakat &amp; Sadaqah
          </button>
          <button
            onClick={() => setSection('maktab')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
              section === 'maktab'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <AcademicCapIcon className="h-5 w-5" />
            Maktab
          </button>
        </div>
      </div>

      {/* Keep both sections mounted (hidden when inactive) so export listeners always work */}
      <div className={section === 'zakat' ? 'block' : 'hidden'}>
        <ZakatManagement
          key={`zakat-${refreshKey}`}
          showHeader={false}
          showStats={false}
          showExport={false}
          showDelete={true}
          showDonorSummary={true}
          showRecordButtons={false}
          showFilters={true}
        />
      </div>
      <div className={section === 'maktab' ? 'block' : 'hidden'}>
        <MaktabManagement
          key={`maktab-${refreshKey}`}
          showHeader={false}
          showStats={false}
          showExport={false}
          showDelete={true}
          showContributorSummary={true}
          showRecordButtons={false}
          showFilters={true}
        />
      </div>
    </div>
  );
};

export default FundsManagement;
