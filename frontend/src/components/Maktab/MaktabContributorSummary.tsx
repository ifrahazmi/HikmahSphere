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

interface ContributorSummaryItem {
  rank: number;
  contributorId: string | null;
  contributorName: string;
  contributorType: string;
  totalContributed: number;
  contributionsCount: number;
}

interface MaktabContributorSummaryProps {
  limit?: number;
}

const MaktabContributorSummary: React.FC<MaktabContributorSummaryProps> = ({ limit = 10 }) => {
  const [contributors, setContributors] = useState<ContributorSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContributorSummary = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/maktab/contributor/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (data.status === 'success') {
        setContributors(data.data.summary.slice(0, limit));
      }
    } catch (error) {
      console.error('Contributor summary error:', error);
      toast.error('Failed to load contributor summary');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchContributorSummary();
  }, [fetchContributorSummary]);

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
          <span>Loading contributor rankings...</span>
        </div>
      </div>
    );
  }

  if (contributors.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center text-gray-500">
          <TrophyIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No contributions recorded yet</p>
          <p className="text-sm mt-1">Be the first to support the maktab!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-violet-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrophyIcon className="w-6 h-6 text-indigo-600" />
            <h3 className="text-lg font-bold text-gray-900">Top Maktab Contributors</h3>
          </div>
          <button
            onClick={fetchContributorSummary}
            className="text-gray-500 hover:text-indigo-600 transition-colors"
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
                Contributor Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contributions
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Contributed
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {contributors.map((contributor) => (
              <tr
                key={contributor.contributorId || contributor.contributorName}
                className="hover:bg-indigo-50 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${getRankBadgeColor(
                      contributor.rank
                    )}`}
                  >
                    {contributor.rank === 1 ? (
                      <TrophyIcon className="w-5 h-5" />
                    ) : (
                      `#${contributor.rank}`
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold">
                      {contributor.contributorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{contributor.contributorName}</p>
                      {contributor.contributorId && (
                        <p className="text-xs text-gray-500">ID: {contributor.contributorId.slice(-6)}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                      contributor.contributorType === 'Individual'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {contributor.contributorType === 'Individual' ? (
                      <UserGroupIcon className="w-3 h-3" />
                    ) : (
                      <BuildingOfficeIcon className="w-3 h-3" />
                    )}
                    {contributor.contributorType}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{contributor.contributionsCount}</span>
                    <span className="text-gray-400">
                      {contributor.contributionsCount === 1 ? 'time' : 'times'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-1">
                    <CurrencyRupeeIcon className="w-4 h-4 text-indigo-600" />
                    <span className="text-lg font-bold text-indigo-700">
                      {contributor.totalContributed.toLocaleString('en-IN')}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {contributors.length >= limit && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-center text-sm text-gray-500">
          Showing top {limit} contributors • Total {contributors.length}+ supporters
        </div>
      )}
    </div>
  );
};

export default MaktabContributorSummary;
