import React, { FormEvent, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  BellAlertIcon,
  CheckCircleIcon,
  ClockIcon,
  DevicePhoneMobileIcon,
  ExclamationTriangleIcon,
  SignalIcon,
  EyeIcon,
  KeyIcon,
  LockClosedIcon,
  LockOpenIcon,
  TrashIcon,
  UserPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { API_URL } from '../../config';
import { DashboardUser, ProfileAuditEntry, UserFilters, UserPushFilter, UserRoleFilter, UserStatusFilter } from './types';
import {
  filterDashboardUsers,
  formatDateTime,
  formatPermissionLabel,
  formatPresenceLabel,
  formatProfileChangeSummary,
  getDashboardUserRole,
} from './dashboardUsers';

interface UserManagementPanelProps {
  users: DashboardUser[];
  currentUserId?: string;
  loading: boolean;
  onRefresh: () => Promise<void>;
  createUserOpen: boolean;
  onCreateUserOpenChange: (open: boolean) => void;
}

const NotificationReadinessCard: React.FC<{ user: DashboardUser }> = ({ user }) => {
  const permission = user.notificationPermission || 'unknown';
  const isLive = Boolean(user.isNotificationActive || user.isNotificationLive);
  const isRecent = Boolean(user.isNotificationRecentlySeen);
  const canReceive = permission === 'granted' && Boolean(user.hasValidNotificationDevice);

  const permissionTile =
    permission === 'granted'
      ? { wrap: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200', icon: <CheckCircleIcon className="h-5 w-5" />, hint: 'Browser allowed alerts' }
      : permission === 'denied'
        ? { wrap: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-200', icon: <XMarkIcon className="h-5 w-5" />, hint: 'User blocked alerts' }
        : { wrap: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200', icon: <ExclamationTriangleIcon className="h-5 w-5" />, hint: 'Permission not confirmed' };

  const deviceTile = user.hasValidNotificationDevice
    ? { wrap: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-200', icon: <DevicePhoneMobileIcon className="h-5 w-5" />, label: 'Device registered', hint: 'Push token is valid' }
    : { wrap: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-200', icon: <DevicePhoneMobileIcon className="h-5 w-5" />, label: 'No valid device', hint: 'Cannot deliver push' };

  const presenceTile = isLive
    ? { wrap: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200', icon: <SignalIcon className="h-5 w-5" />, hint: 'Seen on a live device' }
    : isRecent
      ? { wrap: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200', icon: <ClockIcon className="h-5 w-5" />, hint: 'Active in the last period' }
      : { wrap: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: <ClockIcon className="h-5 w-5" />, hint: 'No recent presence' };

  const summary = canReceive && isLive
    ? { wrap: 'bg-emerald-600 text-white', label: 'Ready and active', hint: 'This user can receive notifications now' }
    : canReceive
      ? { wrap: 'bg-teal-500 text-white', label: 'Push ready', hint: 'Permission and device are good, but they are not active now' }
      : permission === 'denied'
        ? { wrap: 'bg-rose-600 text-white', label: 'Blocked notifications', hint: 'Permission is denied, so alerts will not show' }
        : { wrap: 'bg-amber-500 text-white', label: 'Not push ready', hint: 'Fix permission or device before sending' };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800">
      <div className={`flex items-start gap-3 px-4 py-3 ${summary.wrap}`}>
        <BellAlertIcon className="mt-0.5 h-6 w-6 shrink-0" />
        <div>
          <h4 className="font-semibold">Notification readiness</h4>
          <p className="text-sm font-medium">{summary.label}</p>
          <p className="text-xs text-white/90">{summary.hint}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        <div className={`rounded-xl border p-3 ${permissionTile.wrap}`}>
          <div className="mb-2 flex items-center gap-2 font-semibold">
            {permissionTile.icon}
            {formatPermissionLabel(permission)}
          </div>
          <p className="text-xs opacity-80">{permissionTile.hint}</p>
        </div>
        <div className={`rounded-xl border p-3 ${deviceTile.wrap}`}>
          <div className="mb-2 flex items-center gap-2 font-semibold">
            {deviceTile.icon}
            {deviceTile.label}
          </div>
          <p className="text-xs opacity-80">{deviceTile.hint}</p>
        </div>
        <div className={`rounded-xl border p-3 ${presenceTile.wrap}`}>
          <div className="mb-2 flex items-center gap-2 font-semibold">
            {presenceTile.icon}
            {formatPresenceLabel(user)}
          </div>
          <p className="text-xs opacity-80">{presenceTile.hint}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-gray-800 sm:grid-cols-2">
        <p>Last seen: {formatDateTime(user.notificationLastSeenAt)}</p>
        <p>Last active: {formatDateTime(user.notificationLastActiveAt)}</p>
      </div>
    </div>
  );
};

const emptyFilters: UserFilters = {
  search: '',
  role: 'all',
  status: 'all',
  push: 'all',
};

const UserManagementPanel: React.FC<UserManagementPanelProps> = ({
  users,
  currentUserId,
  loading,
  onRefresh,
  createUserOpen,
  onCreateUserOpenChange,
}) => {
  const [filters, setFilters] = useState<UserFilters>(emptyFilters);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'user' as 'user' | 'manager',
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [resetUser, setResetUser] = useState<DashboardUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DashboardUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'block' | 'unblock' | 'delete'; user: DashboardUser } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const filteredUsers = useMemo(() => filterDashboardUsers(users, filters), [users, filters]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const isSelf = (user: DashboardUser) => user._id === currentUserId;

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!newUser.username.trim() || !newUser.email.trim() || !newUser.password || !newUser.firstName.trim() || !newUser.lastName.trim()) {
      toast.error('First name, last name, username, email, and password are required');
      return;
    }
    if (newUser.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setCreatingUser(true);
      await axios.post(
        `${API_URL}/admin/users`,
        {
          username: newUser.username.trim(),
          email: newUser.email.trim().toLowerCase(),
          password: newUser.password,
          firstName: newUser.firstName.trim(),
          lastName: newUser.lastName.trim(),
          role: newUser.role,
        },
        { headers: getAuthHeaders() }
      );
      toast.success('User created successfully');
      setNewUser({ username: '', email: '', password: '', firstName: '', lastName: '', role: 'user' });
      onCreateUserOpenChange(false);
      await onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!resetUser) return;
    if (isSelf(resetUser)) {
      toast.error('You cannot reset your own password this way.');
      return;
    }
    if (resetPassword.length < 6) {
      toast.error('Temporary password must be at least 6 characters');
      return;
    }
    if (resetPassword !== resetPasswordConfirm) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setResettingPassword(true);
      await axios.patch(
        `${API_URL}/admin/users/${resetUser._id}/reset-password`,
        { temporaryPassword: resetPassword },
        { headers: getAuthHeaders() }
      );
      toast.success(`Temporary password set for ${resetUser.username}`);
      setResetUser(null);
      setResetPassword('');
      setResetPasswordConfirm('');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleToggleBlock = async (user: DashboardUser) => {
    if (isSelf(user)) {
      toast.error('You cannot block yourself.');
      return;
    }
    try {
      setConfirmBusy(true);
      await axios.patch(
        `${API_URL}/admin/users/${user._id}/block`,
        { isBlocked: !user.isBlocked },
        { headers: getAuthHeaders() }
      );
      toast.success(`${user.username} ${user.isBlocked ? 'unblocked' : 'blocked'}`);
      if (selectedUser?._id === user._id) {
        setSelectedUser({ ...selectedUser, isBlocked: !user.isBlocked });
      }
      setConfirmAction(null);
      await onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update user status');
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleDeleteUser = async (user: DashboardUser) => {
    if (isSelf(user)) {
      toast.error('You cannot delete yourself.');
      return;
    }
    try {
      setConfirmBusy(true);
      await axios.delete(`${API_URL}/admin/users/${user._id}`, { headers: getAuthHeaders() });
      toast.success(`${user.username} deleted`);
      if (selectedUser?._id === user._id) {
        setSelectedUser(null);
      }
      setConfirmAction(null);
      await onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    } finally {
      setConfirmBusy(false);
    }
  };

  const openUserProfile = async (user: DashboardUser) => {
    setSelectedUser(user);
    setProfileLoading(true);
    try {
      const response = await axios.get(`${API_URL}/admin/users/${user._id}/profile`, {
        headers: getAuthHeaders(),
      });
      setSelectedUser(response.data?.data?.user || user);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load user profile details');
    } finally {
      setProfileLoading(false);
    }
  };

  const history: ProfileAuditEntry[] = selectedUser?.profileAudit?.history || [];

  const roleClass = (role: DashboardUser['role']) =>
    role === 'superadmin'
      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200'
      : role === 'manager'
        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

  const renderActions = (user: DashboardUser, stacked = false) => (
    <div className={stacked ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap justify-end gap-2'}>
      <button
        type="button"
        onClick={() => openUserProfile(user)}
        className={`inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 ${stacked ? 'justify-center' : ''}`}
      >
        <EyeIcon className="h-4 w-4" />
        View
      </button>
      <button
        type="button"
        disabled={isSelf(user)}
        onClick={() => setConfirmAction({ type: user.isBlocked ? 'unblock' : 'block', user })}
        className={`inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-amber-900 dark:text-amber-200 ${stacked ? 'justify-center' : ''}`}
      >
        {user.isBlocked ? <LockOpenIcon className="h-4 w-4" /> : <LockClosedIcon className="h-4 w-4" />}
        {user.isBlocked ? 'Unblock' : 'Block'}
      </button>
      <button
        type="button"
        disabled={isSelf(user)}
        onClick={() => {
          setResetUser(user);
          setResetPassword('');
          setResetPasswordConfirm('');
        }}
        className={`inline-flex items-center gap-1 rounded-lg border border-sky-200 px-2.5 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-sky-900 dark:text-sky-200 ${stacked ? 'justify-center' : ''}`}
      >
        <KeyIcon className="h-4 w-4" />
        Reset password
      </button>
      <button
        type="button"
        disabled={isSelf(user)}
        onClick={() => setConfirmAction({ type: 'delete', user })}
        className={`inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-900 dark:text-rose-200 ${stacked ? 'justify-center' : ''}`}
      >
        <TrashIcon className="h-4 w-4" />
        Delete
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="block sm:col-span-2 xl:col-span-1">
              <span className="mb-1 block text-xs font-medium text-gray-500">Search</span>
              <input
                type="search"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Name, email, or username"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Role</span>
              <select
                value={filters.role}
                onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value as UserRoleFilter }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="all">All roles</option>
                <option value="user">User</option>
                <option value="manager">Manager</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Status</span>
              <select
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as UserStatusFilter }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>
            <label className="block sm:col-span-2 xl:col-span-1">
              <span className="mb-1 block text-xs font-medium text-gray-500">Push</span>
              <select
                value={filters.push}
                onChange={(event) => setFilters((current) => ({ ...current, push: event.target.value as UserPushFilter }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="all">All devices</option>
                <option value="ready">Push ready</option>
                <option value="not-ready">Not ready</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={() => onCreateUserOpenChange(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 lg:w-auto"
          >
            <UserPlusIcon className="h-5 w-5" />
            Create user
          </button>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Showing {filteredUsers.length} of {users.length} users
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No users match these filters</div>
        ) : (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {filteredUsers.map((user) => {
                const role = getDashboardUserRole(user);
                return (
                  <article key={user._id} className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900 dark:text-white">{user.username}</p>
                        <p className="truncate text-sm text-gray-500">{user.email}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        user.isBlocked
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                      }`}>
                        {user.isBlocked ? 'Blocked' : 'Active'}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleClass(role)}`}>{role}</span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {user.hasValidNotificationDevice ? 'Push ready' : 'Not ready'}
                      </span>
                    </div>
                    <div className="mt-3">{renderActions(user, true)}</div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Push</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredUsers.map((user) => {
                    const role = getDashboardUserRole(user);
                    return (
                      <tr key={user._id} className="hover:bg-emerald-50/40 dark:hover:bg-gray-800/60">
                        <td className="px-4 py-4">
                          <p className="font-medium text-gray-900 dark:text-white">{user.username}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${roleClass(role)}`}>
                            {role}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            user.isBlocked
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                          }`}>
                            {user.isBlocked ? 'Blocked' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {user.hasValidNotificationDevice ? 'Ready' : 'Not ready'}
                        </td>
                        <td className="px-4 py-4">{renderActions(user)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {createUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleCreateUser}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900 sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create user</h3>
              <button type="button" onClick={() => onCreateUserOpenChange(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={newUser.firstName}
                onChange={(event) => setNewUser((current) => ({ ...current, firstName: event.target.value }))}
                placeholder="First name"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <input
                value={newUser.lastName}
                onChange={(event) => setNewUser((current) => ({ ...current, lastName: event.target.value }))}
                placeholder="Last name"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <input
                value={newUser.username}
                onChange={(event) => setNewUser((current) => ({ ...current, username: event.target.value }))}
                placeholder="Username"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <input
                type="email"
                value={newUser.email}
                onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
                placeholder="Email"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <input
                type="password"
                value={newUser.password}
                onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
                placeholder="Password (min 6 characters)"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <select
                value={newUser.role}
                onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value as typeof newUser.role }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="user">User</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => onCreateUserOpenChange(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300">
                Cancel
              </button>
              <button type="submit" disabled={creatingUser} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {creatingUser ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleResetPassword}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900 sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Reset password</h3>
              <button
                type="button"
                onClick={() => {
                  setResetUser(null);
                  setResetPassword('');
                  setResetPasswordConfirm('');
                }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-500">
              Set a temporary password for <span className="font-medium text-gray-900 dark:text-white">{resetUser.username}</span>. They will be asked to change it on next login.
            </p>
            <div className="space-y-3">
              <input
                type="password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                placeholder="Temporary password"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <input
                type="password"
                value={resetPasswordConfirm}
                onChange={(event) => setResetPasswordConfirm(event.target.value)}
                placeholder="Confirm password"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setResetUser(null);
                  setResetPassword('');
                  setResetPasswordConfirm('');
                }}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300"
              >
                Cancel
              </button>
              <button type="submit" disabled={resettingPassword} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
                {resettingPassword ? 'Saving...' : 'Set password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {confirmAction.type === 'delete'
                ? `Delete ${confirmAction.user.username}?`
                : confirmAction.type === 'block'
                  ? `Block ${confirmAction.user.username}?`
                  : `Unblock ${confirmAction.user.username}?`}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {confirmAction.type === 'delete'
                ? 'This cannot be undone. Their account and related admin records will be removed.'
                : confirmAction.type === 'block'
                  ? 'They will be signed out and cannot log in until you unblock them.'
                  : 'They will be able to sign in again immediately.'}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => (
                  confirmAction.type === 'delete'
                    ? handleDeleteUser(confirmAction.user)
                    : handleToggleBlock(confirmAction.user)
                )}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  confirmAction.type === 'delete' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {confirmBusy ? 'Working...' : confirmAction.type === 'delete' ? 'Delete' : confirmAction.type === 'block' ? 'Block' : 'Unblock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedUser.username}</h3>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-6">
              {profileLoading && <p className="text-sm text-gray-500">Refreshing profile details...</p>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
                  <p className="text-xs text-gray-500">Role</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{getDashboardUserRole(selectedUser)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
                  <p className="text-xs text-gray-500">Status</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedUser.isBlocked ? 'Blocked' : 'Active'}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
                  <p className="text-xs text-gray-500">Joined</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{formatDateTime(selectedUser.createdAt)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
                  <p className="text-xs text-gray-500">Profile edits</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedUser.profileEditCount || 0}</p>
                </div>
              </div>
              <NotificationReadinessCard user={selectedUser} />
              <div className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
                <h4 className="mb-3 font-semibold text-gray-900 dark:text-white">Audit history</h4>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-500">No profile edits recorded.</p>
                ) : (
                  <ul className="space-y-3">
                    {history.slice().reverse().map((entry, index) => (
                      <li key={`${entry.editedAt}-${index}`} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800">
                        <p className="font-medium text-gray-900 dark:text-white">{formatDateTime(entry.editedAt)}</p>
                        <p className="text-xs text-gray-500">By {entry.actorName || 'Unknown'}</p>
                        <ul className="mt-2 space-y-1 text-gray-600 dark:text-gray-300">
                          {entry.changedFields.map((change, changeIndex) => (
                            <li key={`${change.field}-${changeIndex}`}>
                              {change.field}: {formatProfileChangeSummary(change)}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPanel;
