import React, { useState, useEffect } from 'react';
import {
  TrashIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  UserPlusIcon,
  XMarkIcon,
  BuildingLibraryIcon,
  ClockIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { API_URL } from '../config';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import AdminNotificationPanel from '../components/Notifications/AdminNotificationPanel';
import ZakatManagement from '../components/Zakat/ZakatManagement';

const Dashboard: React.FC = () => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState<any[]>([]);

  // Overview Stats
  const [totalUsers, setTotalUsers] = useState(0);
  
  // Activity Logs
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activityStats, setActivityStats] = useState<any>(null);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // User Creation State
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
      username: '',
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      role: 'user'
  });

  // Admin: Fetch all users
  const fetchUsers = async () => {
      try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_URL}/admin/users`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (data.status === 'success') {
              setUsers(data.data.users);
              setTotalUsers(data.data.users.length);
          } else {
              // Fallback
              const toolResponse = await fetch(`${API_URL}/tools/users`);
              const toolData = await toolResponse.json();
              if (Array.isArray(toolData)) {
                  setUsers(toolData);
                  setTotalUsers(toolData.length);
              }
          }
      } catch (error) {
          console.error('Failed to fetch users', error);
      }
  };

  // Fetch activity logs
  const fetchActivityLogs = async () => {
    try {
      setLoadingActivities(true);
      const token = localStorage.getItem('token');
      const [logsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/activity/recent?limit=15`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/activity/stats?days=7`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      const logsData = await logsRes.json();
      const statsData = await statsRes.json();
      
      if (logsData.status === 'success') {
        setActivityLogs(logsData.data.activities);
      }
      if (statsData.status === 'success') {
        setActivityStats(statsData.data);
      }
    } catch (error) {
      console.error('Failed to fetch activities', error);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_URL}/admin/users`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(newUser)
          });
          const data = await response.json();
          if (data.status === 'success') {
              toast.success('User created successfully');
              setShowCreateUserModal(false);
              fetchUsers();
              setNewUser({ username: '', email: '', password: '', firstName: '', lastName: '', role: 'user' });
          } else {
              toast.error(data.message || 'Failed to create user');
          }
      } catch (error) {
          toast.error('Error creating user');
      }
  };

  const handleBlockUser = async (userId: string, currentStatus: boolean) => {
      if (user?.id === userId) {
          toast.error('You cannot block yourself.');
          return;
      }

      try {
          const token = localStorage.getItem('token');
          setUsers(users.map(u => u._id === userId ? { ...u, isBlocked: !currentStatus } : u));
          
          await fetch(`${API_URL}/admin/users/${userId}/block`, {
              method: 'PATCH',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}` 
              },
              body: JSON.stringify({ isBlocked: !currentStatus })
          });
          toast.success(currentStatus ? 'User unblocked' : 'User blocked');
      } catch (error) {
          toast.error('Action failed');
          fetchUsers(); // Revert
      }
  };

  const handleDeleteUser = async (userId: string) => {
      if (user?.id === userId) {
          toast.error('You cannot delete yourself.');
          return;
      }

      if (!window.confirm('Are you sure you want to delete this user?')) return;
      try {
          const token = localStorage.getItem('token');
          setUsers(users.filter(u => u._id !== userId));

          await fetch(`${API_URL}/admin/users/${userId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          toast.success('User deleted');
      } catch (error) {
          toast.error('Delete failed');
          fetchUsers();
      }
  };

  // Only Super Admin can access Dashboard
  const canAccessDashboard = hasRole(['superadmin']);
  const isSuperAdmin = hasRole(['superadmin']);

  useEffect(() => {
      if (isSuperAdmin) {
          fetchUsers();
          fetchActivityLogs();
      }
  }, [user, isSuperAdmin]);

  if (!canAccessDashboard) {
      return (
          <div className="min-h-screen pt-24 flex justify-center items-center flex-col">
              <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
              <p className="text-gray-600">You do not have permission to view this dashboard.</p>
              <button
                  onClick={() => navigate('/')}
                  className="mt-4 text-emerald-600 hover:text-emerald-700 font-medium"
              >
                  Go Home
              </button>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center mb-8">
          <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded-full bg-white shadow-md mr-4">
            <img src="/logo.png" alt="HikmahSphere Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
        </div>
        
        <div className="bg-white rounded-lg shadow mb-8">
            <nav className="flex border-b border-gray-200 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${activeTab === 'overview' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Overview
                </button>
                {/* User Management only for Super Admin */}
                {isSuperAdmin && (
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${activeTab === 'users' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        User Management
                    </button>
                )}
                {/* Zakat Management for Super Admin Only */}
                {isSuperAdmin && (
                    <button
                        onClick={() => setActiveTab('zakat')}
                        className={`px-6 py-4 text-sm font-medium whitespace-nowrap flex items-center gap-2 ${activeTab === 'zakat' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <BuildingLibraryIcon className="w-5 h-5" />
                        Zakat Management
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('notifications')}
                    className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${activeTab === 'notifications' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Notifications
                </button>
            </nav>
        </div>

        {activeTab === 'overview' && (
            <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
                        <h3 className="text-gray-500 text-sm font-medium">Total Users</h3>
                        <p className="text-3xl font-bold text-gray-900 mt-2">{totalUsers}</p>
                    </div>
                    {activityStats && (
                        <>
                            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-emerald-500">
                                <h3 className="text-gray-500 text-sm font-medium">Total Activities (7 days)</h3>
                                <p className="text-3xl font-bold text-emerald-700 mt-2">{activityStats.totalActivities}</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
                                <h3 className="text-gray-500 text-sm font-medium">Active Users (7 days)</h3>
                                <p className="text-3xl font-bold text-purple-700 mt-2">{activityStats.uniqueUsers}</p>
                            </div>
                        </>
                    )}
                </div>

                {/* Activity Logs Section */}
                <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900">Recent User Activity</h3>
                        <span className="text-sm text-gray-500">Last 15 activities</span>
                    </div>
                    <div className="overflow-x-auto">
                        {loadingActivities ? (
                            <div className="p-8 text-center text-gray-500">Loading activities...</div>
                        ) : activityLogs.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">No activity logs found</div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {activityLogs.map((log, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <UserCircleIcon className="w-8 h-8 text-gray-400 mr-3" />
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{log.userName}</div>
                                                        <div className="text-xs text-gray-500">{log.userEmail}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                    log.action.includes('login') ? 'bg-green-100 text-green-800' :
                                                    log.action.includes('register') ? 'bg-blue-100 text-blue-800' :
                                                    log.action.includes('zakat') ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {log.action.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-gray-600 capitalize">{log.category}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 max-w-md truncate">
                                                {log.description}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="flex items-center gap-1">
                                                    <ClockIcon className="w-4 h-4" />
                                                    {new Date(log.createdAt).toLocaleString('en-IN', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Zakat Management Tab - Admin/Manager Only */}
        {activeTab === 'zakat' && (
            <div className="space-y-6">
                <ZakatManagement 
                    showStats={true}
                    showExport={true}
                    showDelete={isSuperAdmin}
                    showDonorSummary={true}
                    showRecordButtons={false}
                    showFilters={true}
                />
            </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
            <div className="space-y-8">
                <div className="max-w-4xl mx-auto">
                    <AdminNotificationPanel />
                </div>
            </div>
        )}

        {activeTab === 'users' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">All Users</h3>
                    <button 
                        onClick={() => setShowCreateUserModal(true)}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 flex items-center gap-2"
                    >
                        <UserPlusIcon className="h-5 w-5" />
                        Create User
                    </button>
                </div>

                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {users.map((u) => (
                                    <tr key={u._id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{u.username}</div>
                                                    <div className="text-sm text-gray-500">{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                ${u.role === 'superadmin' ? 'bg-purple-100 text-purple-800' : 
                                                  u.role === 'manager' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                                {u.role || (u.isAdmin ? 'superadmin' : 'user')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.isBlocked ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                                {u.isBlocked ? 'Blocked' : 'Active'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {/* Hide delete/block for self OR if target is superadmin (optional policy) */}
                                            {u._id !== user?.id && (
                                                <>
                                                    <button 
                                                        onClick={() => handleBlockUser(u._id, u.isBlocked)}
                                                        className={`text-${u.isBlocked ? 'green' : 'red'}-600 hover:text-${u.isBlocked ? 'green' : 'red'}-900 mr-4`}
                                                        title={u.isBlocked ? "Unblock User" : "Block User"}
                                                    >
                                                        {u.isBlocked ? <CheckCircleIcon className="h-5 w-5" /> : <NoSymbolIcon className="h-5 w-5" />}
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteUser(u._id)}
                                                        className="text-gray-600 hover:text-gray-900"
                                                        title="Delete User"
                                                    >
                                                        <TrashIcon className="h-5 w-5" />
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* Create User Modal */}
        {showCreateUserModal && (
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-md w-full p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-gray-900">Create New User</h3>
                        <button onClick={() => setShowCreateUserModal(false)} className="text-gray-400 hover:text-gray-500">
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>
                    
                    <form onSubmit={handleCreateUser} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">First Name</label>
                            <input type="text" required className="mt-1 block w-full border rounded-md p-2"
                                value={newUser.firstName} onChange={e => setNewUser({...newUser, firstName: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Last Name</label>
                            <input type="text" required className="mt-1 block w-full border rounded-md p-2"
                                value={newUser.lastName} onChange={e => setNewUser({...newUser, lastName: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Username</label>
                            <input type="text" required className="mt-1 block w-full border rounded-md p-2"
                                value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <input type="email" required className="mt-1 block w-full border rounded-md p-2"
                                value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Password</label>
                            <input type="password" required className="mt-1 block w-full border rounded-md p-2"
                                value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Role</label>
                            <select 
                                className="mt-1 block w-full border rounded-md p-2"
                                value={newUser.role}
                                onChange={e => setNewUser({...newUser, role: e.target.value})}
                            >
                                <option value="user">User</option>
                                <option value="manager">Manager</option>
                            </select>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => setShowCreateUserModal(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
                            <button type="submit"
                                className="px-4 py-2 text-white bg-emerald-600 rounded-md hover:bg-emerald-700">
                                Create User
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

export default Dashboard;
