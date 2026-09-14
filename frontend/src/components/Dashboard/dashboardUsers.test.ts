import { deriveDashboardStats, filterDashboardUsers } from './dashboardUsers';
import { DashboardUser } from './types';

const users: DashboardUser[] = [
  {
    _id: '1',
    username: 'aisha',
    email: 'aisha@example.com',
    role: 'user',
    isBlocked: false,
    hasValidNotificationDevice: true,
    isNotificationLive: true,
  },
  {
    _id: '2',
    username: 'manager.one',
    email: 'ops@example.com',
    role: 'manager',
    isBlocked: false,
    hasValidNotificationDevice: false,
  },
  {
    _id: '3',
    username: 'blocked.user',
    email: 'blocked@example.com',
    role: 'user',
    isBlocked: true,
    hasValidNotificationDevice: false,
  },
];

describe('filterDashboardUsers', () => {
  it('filters by search across username and email', () => {
    expect(filterDashboardUsers(users, {
      search: 'aisha',
      role: 'all',
      status: 'all',
      push: 'all',
    }).map((user) => user._id)).toEqual(['1']);

    expect(filterDashboardUsers(users, {
      search: 'ops@',
      role: 'all',
      status: 'all',
      push: 'all',
    }).map((user) => user._id)).toEqual(['2']);
  });

  it('filters by role, blocked status, and push readiness', () => {
    expect(filterDashboardUsers(users, {
      search: '',
      role: 'manager',
      status: 'all',
      push: 'all',
    }).map((user) => user._id)).toEqual(['2']);

    expect(filterDashboardUsers(users, {
      search: '',
      role: 'all',
      status: 'blocked',
      push: 'all',
    }).map((user) => user._id)).toEqual(['3']);

    expect(filterDashboardUsers(users, {
      search: '',
      role: 'all',
      status: 'active',
      push: 'ready',
    }).map((user) => user._id)).toEqual(['1']);
  });
});

describe('deriveDashboardStats', () => {
  it('counts blocked, push-ready, active, and manager users', () => {
    expect(deriveDashboardStats(users)).toEqual({
      totalUsers: 3,
      blocked: 1,
      pushReady: 1,
      activeNow: 1,
      managers: 1,
    });
  });
});
