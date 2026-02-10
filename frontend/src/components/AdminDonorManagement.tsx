import React, { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  EyeIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

interface Donor {
  _id: string;
  donorId: string;
  fullName: string;
  phone: string;
  email?: string;
  donorType: 'Individual' | 'Organization' | 'NRI' | 'Corporate';
  city?: string;
  state?: string;
  panNumber?: string;
  aadharNumber?: string;
  totalDonations: number;
  totalAmount: number;
  status: 'Active' | 'Disabled' | 'Deleted';
  registeredDate: string;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const AdminDonorManagement: React.FC = () => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Active' | 'Disabled' | 'All'>('Active');
  const [selectedDonor, setSelectedDonor] = useState<Donor | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Edit form state
  const [editFormData, setEditFormData] = useState<any>({
    fullName: '',
    email: '',
    city: '',
    state: '',
    donorType: 'Individual',
  });

  // Fetch donors
  const fetchDonors = async (page = 1, search = '', status = 'Active') => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
      });

      if (search) params.append('search', search);
      if (status !== 'All') params.append('status', status);

      const response = await fetch(`${API_URL}/zakat/donors?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (data.success) {
        setDonors(data.data);
        setPagination(data.pagination);
      } else {
        toast.error('Failed to fetch donors');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error fetching donors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonors(1, searchTerm, statusFilter);
  }, []);

  // Search functionality
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    fetchDonors(1, e.target.value, statusFilter);
  };

  // Filter by status
  const handleStatusFilter = (status: 'Active' | 'Disabled' | 'All') => {
    setStatusFilter(status);
    fetchDonors(1, searchTerm, status);
  };

  // Open edit modal
  const openEditModal = (donor: Donor) => {
    setSelectedDonor(donor);
    setEditFormData({
      fullName: donor.fullName,
      email: donor.email || '',
      city: donor.city || '',
      state: donor.state || '',
      donorType: donor.donorType,
    });
    setShowEditModal(true);
  };

  // Open details modal
  const openDetailsModal = (donor: Donor) => {
    setSelectedDonor(donor);
    setShowDetailsModal(true);
  };

  // Update donor
  const updateDonor = async () => {
    if (!selectedDonor) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/zakat/donors/${selectedDonor._id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(editFormData),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success('Donor updated successfully');
        setShowEditModal(false);
        setSelectedDonor(null);
        fetchDonors(pagination.page, searchTerm, statusFilter);
      } else {
        toast.error(data.error || 'Failed to update donor');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error updating donor');
    }
  };

  // Disable donor
  const disableDonor = async (donorId: string) => {
    if (!window.confirm('Are you sure? This will prevent future donations from this donor.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/zakat/donors/${donorId}/disable`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reason: 'Admin action - disabled via donor management',
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success('Donor disabled successfully');
        fetchDonors(pagination.page, searchTerm, statusFilter);
      } else {
        toast.error(data.error || 'Failed to disable donor');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error disabling donor');
    }
  };

  // Enable donor
  const enableDonor = async (donorId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/zakat/donors/${donorId}/enable`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success('Donor enabled successfully');
        fetchDonors(pagination.page, searchTerm, statusFilter);
      } else {
        toast.error(data.error || 'Failed to enable donor');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error enabling donor');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Disabled':
        return 'bg-red-100 text-red-800';
      case 'Deleted':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            👥 Donor Management
          </h1>
          <p className="text-gray-600">
            Manage all donors, view their contribution history, and control access
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Donor
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="Search by name, phone, or ID..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <div className="flex gap-2">
                {['Active', 'Disabled', 'All'].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusFilter(status as any)}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      statusFilter === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Donor Count */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {donors.length} of {pagination.total} donors
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Donor ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Total Donations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                      Loading donors...
                    </td>
                  </tr>
                ) : donors.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                      No donors found
                    </td>
                  </tr>
                ) : (
                  donors.map((donor) => (
                    <tr key={donor._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-mono text-gray-900">
                        {donor.donorId}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {donor.fullName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>{donor.phone}</div>
                        {donor.email && <div className="text-xs">{donor.email}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {donor.donorType}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {donor.totalDonations}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-green-600">
                        ₹{donor.totalAmount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
                            donor.status
                          )}`}
                        >
                          {donor.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm flex gap-2">
                        <button
                          onClick={() => openDetailsModal(donor)}
                          title="View Details"
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(donor)}
                          title="Edit"
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        {donor.status === 'Active' ? (
                          <button
                            onClick={() => disableDonor(donor._id)}
                            title="Disable"
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => enableDonor(donor._id)}
                            title="Enable"
                            className="p-2 text-green-600 hover:bg-green-100 rounded-lg"
                          >
                            <CheckIcon className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.pages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    pagination.page > 1 &&
                    fetchDonors(pagination.page - 1, searchTerm, statusFilter)
                  }
                  disabled={pagination.page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    pagination.page < pagination.pages &&
                    fetchDonors(pagination.page + 1, searchTerm, statusFilter)
                  }
                  disabled={pagination.page === pagination.pages}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {showEditModal && selectedDonor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Edit Donor
              </h2>

              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.fullName}
                    onChange={(e) =>
                      setEditFormData((prev: any) => ({
                        ...prev,
                        fullName: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) =>
                      setEditFormData((prev: any) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={editFormData.city}
                      onChange={(e) =>
                        setEditFormData((prev: any) => ({
                          ...prev,
                          city: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={editFormData.state}
                      onChange={(e) =>
                        setEditFormData((prev: any) => ({
                          ...prev,
                          state: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Donor Type
                  </label>
                  <select
                    value={editFormData.donorType}
                    onChange={(e) =>
                      setEditFormData((prev: any) => ({
                        ...prev,
                        donorType: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Individual">Individual</option>
                    <option value="Organization">Organization</option>
                    <option value="NRI">NRI</option>
                    <option value="Corporate">Corporate</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={updateDonor}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedDonor(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {showDetailsModal && selectedDonor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Donor Details
              </h2>

              <div className="space-y-3 text-sm">
                <div className="border-b pb-3">
                  <p className="text-gray-600">Donor ID</p>
                  <p className="font-mono font-bold text-gray-900">
                    {selectedDonor.donorId}
                  </p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-gray-600">Full Name</p>
                  <p className="font-bold text-gray-900">
                    {selectedDonor.fullName}
                  </p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-gray-600">Phone</p>
                  <p className="font-bold text-gray-900">{selectedDonor.phone}</p>
                </div>

                {selectedDonor.email && (
                  <div className="border-b pb-3">
                    <p className="text-gray-600">Email</p>
                    <p className="font-bold text-gray-900">{selectedDonor.email}</p>
                  </div>
                )}

                <div className="border-b pb-3">
                  <p className="text-gray-600">Donor Type</p>
                  <p className="font-bold text-gray-900">{selectedDonor.donorType}</p>
                </div>

                {selectedDonor.city && (
                  <div className="border-b pb-3">
                    <p className="text-gray-600">Location</p>
                    <p className="font-bold text-gray-900">
                      {selectedDonor.city}
                      {selectedDonor.state && `, ${selectedDonor.state}`}
                    </p>
                  </div>
                )}

                <div className="border-b pb-3">
                  <p className="text-gray-600">Total Donations</p>
                  <p className="font-bold text-gray-900">
                    {selectedDonor.totalDonations} donations
                  </p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-gray-600">Total Amount Donated</p>
                  <p className="font-bold text-green-600 text-lg">
                    ₹{selectedDonor.totalAmount.toLocaleString()}
                  </p>
                </div>

                <div className="border-b pb-3">
                  <p className="text-gray-600">Status</p>
                  <p
                    className={`inline-block px-2 py-1 rounded text-xs font-bold ${getStatusBadgeColor(
                      selectedDonor.status
                    )}`}
                  >
                    {selectedDonor.status}
                  </p>
                </div>

                <div>
                  <p className="text-gray-600">Registered</p>
                  <p className="font-bold text-gray-900">
                    {new Date(selectedDonor.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedDonor(null);
                }}
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

export default AdminDonorManagement;
