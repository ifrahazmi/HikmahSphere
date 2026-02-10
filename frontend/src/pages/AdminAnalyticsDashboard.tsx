import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  UserGroupIcon,
  CurrencyRupeeIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

interface DonationStats {
  totalDonations: number;
  totalAmount: number;
  completedAmount: number;
  pendingAmount: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}

interface InstallmentStats {
  total: number;
  byStatus: Record<string, number>;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
}

interface DonorStats {
  total: number;
  active: number;
  totalContribution: number;
  averageContribution: number;
}

const AdminAnalyticsDashboard: React.FC = () => {
  const [donationStats, setDonationStats] = useState<DonationStats | null>(null);
  const [installmentStats, setInstallmentStats] = useState<InstallmentStats | null>(null);
  const [donorStats, setDonorStats] = useState<DonorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [selectedType, setSelectedType] = useState<string>('all');

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6', '#ec4899'];

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Fetch donation stats
      const donRes = await fetch(
        `${API_URL}/zakat/donations/stats/overview?startDate=${dateRange.start}&endDate=${dateRange.end}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const donData = await donRes.json();
      if (donData.success) setDonationStats(donData.data);

      // Fetch installment stats
      const instRes = await fetch(
        `${API_URL}/zakat/installments/stats/overview`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const instData = await instRes.json();
      if (instData.success) setInstallmentStats(instData.data);

      // Fetch donor stats
      const donorRes = await fetch(
        `${API_URL}/zakat/donors?status=Active&limit=1000`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const donorData = await donorRes.json();
      if (donorData.success) {
        const totalAmount = donorData.data.reduce(
          (sum: number, d: any) => sum + (d.totalAmount || 0),
          0
        );
        setDonorStats({
          total: donorData.pagination.total,
          active: donorData.data.length,
          totalContribution: totalAmount,
          averageContribution: donorData.data.length > 0 ? totalAmount / donorData.data.length : 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const prepareChartData = () => {
    if (!donationStats) return [];
    
    return Object.entries(donationStats.byType).map(([type, count]) => ({
      name: type.replace(/_/g, ' '),
      value: count,
    }));
  };

  const prepareStatusData = () => {
    if (!donationStats) return [];
    
    return Object.entries(donationStats.byStatus).map(([status, count]) => ({
      name: status,
      value: count,
    }));
  };

  const prepareInstallmentStatusData = () => {
    if (!installmentStats) return [];
    
    return Object.entries(installmentStats.byStatus)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        name: status,
        value: count,
      }));
  };

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: number;
    color: string;
  }> = ({ title, value, icon, trend, color }) => (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 hover:shadow-lg transition-shadow"
         style={{ borderLeftColor: color }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-800 mt-2">{value}</p>
          {trend !== undefined && (
            <p className={`text-sm mt-2 flex items-center ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? <ArrowUpIcon className="w-4 h-4 mr-1" /> : <ArrowDownIcon className="w-4 h-4 mr-1" />}
              {Math.abs(trend)}% from last period
            </p>
          )}
        </div>
        <div className="text-3xl" style={{ color }}>
          {icon}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-2">Real-time insights on donations, donors, and installments</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Donation Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="zakat_maal">Zakat Maal</option>
                <option value="zakat_fitr">Zakat Fitr</option>
                <option value="sadaqah">Sadaqah</option>
                <option value="fidya">Fidya</option>
                <option value="kaffarah">Kaffarah</option>
              </select>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Donations"
            value={donationStats?.totalDonations || 0}
            icon={<CurrencyRupeeIcon className="w-8 h-8" />}
            trend={12}
            color="#10b981"
          />
          <MetricCard
            title="Total Amount"
            value={`₹${(donationStats?.totalAmount || 0).toLocaleString('en-IN')}`}
            icon={<CheckCircleIcon className="w-8 h-8" />}
            trend={8}
            color="#f59e0b"
          />
          <MetricCard
            title="Total Donors"
            value={donorStats?.total || 0}
            icon={<UserGroupIcon className="w-8 h-8" />}
            trend={15}
            color="#6366f1"
          />
          <MetricCard
            title="Pending Amount"
            value={`₹${(donationStats?.pendingAmount || 0).toLocaleString('en-IN')}`}
            icon={<ClockIcon className="w-8 h-8" />}
            trend={-5}
            color="#ef4444"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Donation Status Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Donation Status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={prepareStatusData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Donation Type Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Donation Types</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={prepareChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Installments & Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Installment Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Installment Status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={prepareInstallmentStatusData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Summary Statistics</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-gray-600">Completed Amount</span>
                <span className="text-lg font-bold text-emerald-600">
                  ₹{(donationStats?.completedAmount || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-gray-600">Pending Amount</span>
                <span className="text-lg font-bold text-amber-600">
                  ₹{(donationStats?.pendingAmount || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-gray-600">Avg Donor Contribution</span>
                <span className="text-lg font-bold text-blue-600">
                  ₹{(donorStats?.averageContribution || 0).toLocaleString('en-IN', {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-gray-600">Paid Installments</span>
                <span className="text-lg font-bold text-green-600">
                  {installmentStats?.byStatus['Paid'] || 0} / {installmentStats?.total || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Collection Rate</span>
                <span className="text-lg font-bold text-indigo-600">
                  {donationStats?.totalAmount
                    ? Math.round(
                        ((donationStats.completedAmount || 0) / donationStats.totalAmount) * 100
                      )
                    : 0}
                  %
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsDashboard;
