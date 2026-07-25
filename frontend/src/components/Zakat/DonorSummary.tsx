import React, { useState, useEffect, useCallback } from 'react';
import {
  TrophyIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  CurrencyRupeeIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { API_URL } from '../../config';
import toast from 'react-hot-toast';

interface DonorSummaryItem {
  rank: number;
  donorId: string | null;
  donorName: string;
  donorType: string;
  totalContributed: number;
  donationsCount: number;
}

interface DonorSummaryProps {
  limit?: number;
}

const DonorSummary: React.FC<DonorSummaryProps> = ({ limit = 10 }) => {
  const [donors, setDonors] = useState<DonorSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDonorSummary = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/zakat/donor/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (data.status === 'success') {
        setDonors(data.data.summary.slice(0, limit));
      }
    } catch (error) {
      console.error('Donor summary error:', error);
      toast.error('Failed to load donor summary');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchDonorSummary();
  }, [fetchDonorSummary]);

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-400 text-yellow-900';
      case 2:
        return 'bg-gray-300 text-gray-800';
      case 3:
        return 'bg-amber-600 text-amber-50';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-center gap-3 text-gray-500">
          <ArrowPathIcon className="w-6 h-6 animate-spin" />
          <span>Loading donor rankings...</span>
        </div>
      </div>
    );
  }

  if (donors.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center text-gray-500">
          <TrophyIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No donations recorded yet</p>
          <p className="text-sm mt-1">Be the first to contribute!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrophyIcon className="w-6 h-6 text-emerald-600" />
            <h3 className="text-lg font-bold text-gray-900">Top Donors Leaderboard</h3>
          </div>
          <button
            onClick={fetchDonorSummary}
            className="text-gray-500 hover:text-emerald-600 transition-colors"
            title="Refresh"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Donor Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Donations
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Contributed
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {donors.map((donor) => (
              <tr
                key={donor.donorId || donor.donorName}
                className="hover:bg-emerald-50 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${getRankBadgeColor(
                      donor.rank
                    )}`}
                  >
                    {donor.rank === 1 ? (
                      <TrophyIcon className="w-5 h-5" />
                    ) : (
                      `#${donor.rank}`
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold">
                      {donor.donorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{donor.donorName}</p>
                      {donor.donorId && (
                        <p className="text-xs text-gray-500">ID: {donor.donorId.slice(-6)}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                      donor.donorType === 'Individual'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {donor.donorType === 'Individual' ? (
                      <UserGroupIcon className="w-3 h-3" />
                    ) : (
                      <BuildingOfficeIcon className="w-3 h-3" />
                    )}
                    {donor.donorType}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{donor.donationsCount}</span>
                    <span className="text-gray-400">
                      {donor.donationsCount === 1 ? 'time' : 'times'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-1">
                    <CurrencyRupeeIcon className="w-4 h-4 text-emerald-600" />
                    <span className="text-lg font-bold text-emerald-700">
                      {donor.totalContributed.toLocaleString('en-IN')}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {donors.length >= limit && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-center text-sm text-gray-500">
          Showing top {limit} donors • Total {donors.length}+ contributors
        </div>
      )}
    </div>
  );
};

export default DonorSummary;
