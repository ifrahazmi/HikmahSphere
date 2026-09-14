import {
  DashboardUser,
  ProfileFieldChange,
  UserFilters,
} from './types';

export const getDashboardUserRole = (user: DashboardUser): DashboardUser['role'] =>
  user.role || (user.isAdmin ? 'superadmin' : 'user');

export const formatPermissionLabel = (permission?: string): string => {
  if (permission === 'granted') return 'Permission granted';
  if (permission === 'denied') return 'Permission denied';
  if (permission === 'default') return 'Permission default';
  return 'Permission unknown';
};

export const formatPresenceLabel = (user: DashboardUser): string => {
  if (user.isNotificationActive || user.isNotificationLive) return 'Active now';
  if (user.isNotificationRecentlySeen) return 'Recently seen';
  return 'Not recently seen';
};

export const formatDateTime = (value?: string | null): string => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatRelativeTime = (value?: string | null): string => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';

  const deltaMs = Date.now() - parsed.getTime();
  const minutes = Math.round(deltaMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateTime(value);
};

export const formatProfileChangeSummary = (changed: ProfileFieldChange): string => {
  if (changed.field === 'profile.avatar') {
    return 'Profile picture updated';
  }

  const beforeValue = changed.before?.trim() ? changed.before : 'Empty';
  const afterValue = changed.after?.trim() ? changed.after : 'Empty';
  return `"${beforeValue}" -> "${afterValue}"`;
};

export const deriveDashboardStats = (users: DashboardUser[]) => ({
  totalUsers: users.length,
  blocked: users.filter((user) => user.isBlocked).length,
  pushReady: users.filter((user) => user.hasValidNotificationDevice).length,
  activeNow: users.filter((user) => user.isNotificationActive || user.isNotificationLive).length,
  managers: users.filter((user) => getDashboardUserRole(user) === 'manager').length,
});

export const filterDashboardUsers = (
  users: DashboardUser[],
  filters: UserFilters
): DashboardUser[] => {
  const search = filters.search.trim().toLowerCase();

  return users.filter((user) => {
    const role = getDashboardUserRole(user);
    if (filters.role !== 'all' && role !== filters.role) {
      return false;
    }
    if (filters.status === 'blocked' && !user.isBlocked) {
      return false;
    }
    if (filters.status === 'active' && user.isBlocked) {
      return false;
    }
    if (filters.push === 'ready' && !user.hasValidNotificationDevice) {
      return false;
    }
    if (filters.push === 'not-ready' && user.hasValidNotificationDevice) {
      return false;
    }
    if (!search) {
      return true;
    }

    return [user.username, user.email, user.firstName, user.lastName, role]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });
};
