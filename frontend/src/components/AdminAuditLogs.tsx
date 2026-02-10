import React, { useState, useEffect } from 'react';
import {
  AdjustmentsHorizontalIcon,
  CalendarIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

interface AuditLog {
  _id: string;
  logId: string;
  adminEmail: string;
  action: string;
  targetType: 'Donor' | 'Donation' | 'Installment';
  targetId: any;
  details: Record<string, any>;
  ipAddress: string;
  createdAt: string;
}

interface FilterOptions {
  action?: string;
  targetType?: string;
  adminEmail?: string;
  startDate?: string;
  endDate?: string;
}

const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<FilterOptions>({});
  const [showFilters, setShowFilters] = useState(false);

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Fetch from the audit logs endpoint
      const response = await fetch(`${API_URL}/zakat/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (data.status === 'success') {
        setLogs(data.data || []);
        setFilteredLogs(data.data || []);
        if (data.data?.length === 0) {
          toast.loading('No audit logs found yet', { duration: 2000 });
        }
      } else {
        setLogs([]);
        setFilteredLogs([]);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error fetching audit logs');
      setLogs([]);
      setFilteredLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = logs;

    if (filters.action) {
      filtered = filtered.filter((log) => log.action === filters.action);
    }

    if (filters.targetType) {
      filtered = filtered.filter(
        (log) => log.targetType === filters.targetType
      );
    }

    if (filters.adminEmail) {
      filtered = filtered.filter((log) =>
        log.adminEmail
          .toLowerCase()
          .includes(filters.adminEmail!.toLowerCase())
      );
    }

    if (filters.startDate) {
      filtered = filtered.filter(
        (log) => new Date(log.createdAt) >= new Date(filters.startDate!)
      );
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        (log) => new Date(log.createdAt) <= endDate
      );
    }

    setFilteredLogs(filtered);
  }, [logs, filters]);

  // Get action color
  const getActionColor = (action: string) => {
    if (action.includes('CREATED')) return 'bg-green-100 text-green-800';
    if (action.includes('UPDATED')) return 'bg-blue-100 text-blue-800';
    if (action.includes('DISABLED') || action.includes('DELETED'))
      return 'bg-red-100 text-red-800';
    if (action.includes('RESTORED') || action.includes('ENABLED'))
      return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Export logs as CSV
  const exportLogsAsCSV = () => {
    const headers = [
      'Log ID',
      'Admin Email',
      'Action',
      'Target Type',
      'IP Address',
      'Timestamp',
    ];
    const rows = filteredLogs.map((log) => [
      log.logId,
      log.adminEmail,
      log.action,
      log.targetType,
      log.ipAddress,
      new Date(log.createdAt).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const element = document.createElement('a');
    element.setAttribute(
      'href',
      'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent)
    );
    element.setAttribute('download', `audit-logs-${Date.now()}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    toast.success('Logs exported successfully');
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            📋 Audit Logs
          </h1>
          <p className="text-gray-600">
            Track all administrative actions and maintain compliance records
          </p>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Total Logs: {filteredLogs.length}
              </h2>
              {Object.keys(filters).length > 0 && (
                <p className="text-sm text-gray-600">
                  Filtered results showing
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <AdjustmentsHorizontalIcon className="w-5 h-5" />
                {showFilters ? 'Hide' : 'Show'} Filters
              </button>

              <button
                onClick={exportLogsAsCSV}
                disabled={filteredLogs.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                Export CSV
              </button>

              {Object.keys(filters).length > 0 && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action Type
                </label>
                <select
                  value={filters.action || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      action: e.target.value || undefined,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Actions</option>
                  <option value="DONOR_CREATED">Donor Created</option>
                  <option value="DONOR_UPDATED">Donor Updated</option>
                  <option value="DONOR_DISABLED">Donor Disabled</option>
                  <option value="DONOR_RESTORED">Donor Restored</option>
                  <option value="DONATION_CREATED">Donation Created</option>
                  <option value="DONATION_COMPLETED">Donation Completed</option>
                  <option value="DONATION_CANCELLED">Donation Cancelled</option>
                  <option value="INSTALLMENT_CREATED">Installment Created</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Type
                </label>
                <select
                  value={filters.targetType || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      targetType: (e.target.value || undefined) as any,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Types</option>
                  <option value="Donor">Donor</option>
                  <option value="Donation">Donation</option>
                  <option value="Installment">Installment</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Email
                </label>
                <input
                  type="email"
                  value={filters.adminEmail || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      adminEmail: e.target.value || undefined,
                    }))
                  }
                  placeholder="Filter by admin..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      startDate: e.target.value || undefined,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      endDate: e.target.value || undefined,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Log ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Admin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      Loading logs...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      {logs.length === 0
                        ? 'No audit logs yet'
                        : 'No logs matching filters'}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-mono text-gray-900">
                        {log.logId}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getActionColor(
                            log.action
                          )}`}
                        >
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {log.targetType}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {log.adminEmail}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-600">
                        {log.ipAddress}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => {
                            setSelectedLog(log);
                            setShowDetailModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Modal */}
        {showDetailModal && selectedLog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-96 overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Log Details
              </h2>

              <div className="space-y-4 text-sm">
                <div className="border-b pb-3">
                  <p className="text-gray-600 font-medium">Log ID</p>
                  <p className="font-mono text-gray-900">{selectedLog.logId}</p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-gray-600 font-medium">Action</p>
                  <p className="text-gray-900">{selectedLog.action}</p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-gray-600 font-medium">Admin Email</p>
                  <p className="text-gray-900">{selectedLog.adminEmail}</p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-gray-600 font-medium">Target</p>
                  <p className="text-gray-900">
                    {selectedLog.targetType} ({selectedLog.targetId})
                  </p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-gray-600 font-medium">IP Address</p>
                  <p className="font-mono text-gray-900">{selectedLog.ipAddress}</p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-gray-600 font-medium">Timestamp</p>
                  <p className="text-gray-900">
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </p>
                </div>

                {Object.keys(selectedLog.details).length > 0 && (
                  <div>
                    <p className="text-gray-600 font-medium mb-2">Details</p>
                    <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto text-gray-900">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowDetailModal(false)}
                className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAuditLogs;
