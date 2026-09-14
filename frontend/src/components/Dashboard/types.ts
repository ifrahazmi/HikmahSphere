export interface ProfileFieldChange {
  field: string;
  before?: string;
  after?: string;
}

export interface ProfileAuditEntry {
  editedAt: string;
  actorName?: string;
  changedFields: ProfileFieldChange[];
}

export interface DashboardUser {
  _id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'superadmin' | 'manager' | 'user';
  isAdmin?: boolean;
  isBlocked: boolean;
  createdAt?: string;
  profileEdited?: boolean;
  profileEditedAt?: string | null;
  profileEditCount?: number;
  notificationPermission?: 'granted' | 'denied' | 'default' | 'unknown';
  hasValidNotificationDevice?: boolean;
  isNotificationLive?: boolean;
  isNotificationActive?: boolean;
  isNotificationRecentlySeen?: boolean;
  notificationDeviceCount?: number;
  notificationLastSeenAt?: string | null;
  notificationLastActiveAt?: string | null;
  notificationPreference?: {
    prayers: boolean;
    events: boolean;
    community: boolean;
  };
  profileAudit?: {
    history?: ProfileAuditEntry[];
  };
}

export interface ActivityLog {
  userName?: string;
  userEmail?: string;
  action: string;
  category?: string;
  description?: string;
  createdAt: string;
}

export interface ActivityStats {
  totalActivities?: number;
  uniqueUsers?: number;
}

export type DashboardTab = 'overview' | 'users' | 'zakat' | 'notifications';

export type UserRoleFilter = 'all' | 'superadmin' | 'manager' | 'user';
export type UserStatusFilter = 'all' | 'active' | 'blocked';
export type UserPushFilter = 'all' | 'ready' | 'not-ready';

export interface UserFilters {
  search: string;
  role: UserRoleFilter;
  status: UserStatusFilter;
  push: UserPushFilter;
}
