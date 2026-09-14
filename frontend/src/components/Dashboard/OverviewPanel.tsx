import React from 'react';
import { motion } from 'framer-motion';
import {
  BellAlertIcon,
  ClockIcon,
  IdentificationIcon,
  ShieldExclamationIcon,
  SignalIcon,
  UserGroupIcon,
  UserPlusIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { ActivityLog, ActivityStats, DashboardTab, DashboardUser } from './types';
import { deriveDashboardStats, formatRelativeTime } from './dashboardUsers';

interface OverviewPanelProps {
  users: DashboardUser[];
  activityLogs: ActivityLog[];
  activityStats: ActivityStats | null;
  loadingActivities: boolean;
  onTabChange: (tab: DashboardTab) => void;
  onCreateUser: () => void;
}

const StatTile: React.FC<{
  label: string;
  value: number | string;
  hint: string;
  icon: React.ReactNode;
  tone: string;
}> = ({ label, value, hint, icon, tone }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="mt-1 text-xs text-gray-400">{hint}</p>
      </div>
      <div className={`rounded-xl p-2.5 ${tone}`}>{icon}</div>
    </div>
  </div>
);

const OverviewPanel: React.FC<OverviewPanelProps> = ({
  users,
  activityLogs,
  activityStats,
  loadingActivities,
  onTabChange,
  onCreateUser,
}) => {
  const stats = deriveDashboardStats(users);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <StatTile
          label="Total users"
          value={stats.totalUsers}
          hint="Everyone in the directory"
          icon={<UsersIcon className="h-6 w-6" />}
          tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        />
        <StatTile
          label="Activities (7 days)"
          value={activityStats?.totalActivities ?? '—'}
          hint="Logins, zakat, and more"
          icon={<ClockIcon className="h-6 w-6" />}
          tone="bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
        />
        <StatTile
          label="Active users (7 days)"
          value={activityStats?.uniqueUsers ?? '—'}
          hint="People who used the app"
          icon={<SignalIcon className="h-6 w-6" />}
          tone="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
        />
        <StatTile
          label="Blocked"
          value={stats.blocked}
          hint="Cannot sign in until unblocked"
          icon={<ShieldExclamationIcon className="h-6 w-6" />}
          tone="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
        />
        <StatTile
          label="Push ready"
          value={stats.pushReady}
          hint="Can receive notifications"
          icon={<BellAlertIcon className="h-6 w-6" />}
          tone="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        />
        <StatTile
          label="Active now"
          value={stats.activeNow}
          hint="Seen on a live device"
          icon={<UserGroupIcon className="h-6 w-6" />}
          tone="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
        />
        <StatTile
          label="Managers"
          value={stats.managers}
          hint="Fund managers on the team"
          icon={<IdentificationIcon className="h-6 w-6" />}
          tone="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        />
      </motion.div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onCreateUser}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          <UserPlusIcon className="h-5 w-5" />
          Create user
        </button>
        <button
          type="button"
          onClick={() => onTabChange('users')}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-gray-900 dark:text-emerald-300"
        >
          Open users
        </button>
        <button
          type="button"
          onClick={() => onTabChange('notifications')}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          Send a notification
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent activity</h3>
            <p className="text-sm text-gray-500">Last 15 events across the platform</p>
          </div>
        </div>
        {loadingActivities ? (
          <div className="p-8 text-center text-gray-500">Loading activities...</div>
        ) : activityLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No activity logs found</div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {activityLogs.map((log, index) => (
              <li key={`${log.createdAt}-${index}`} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white">{log.userName || 'Unknown user'}</p>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      log.action.includes('login') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' :
                      log.action.includes('register') ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' :
                      log.action.includes('zakat') ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    {log.category && (
                      <span className="text-xs uppercase tracking-wide text-gray-400">{log.category}</span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-gray-500">{log.description}</p>
                  <p className="text-xs text-gray-400">{log.userEmail}</p>
                </div>
                <p className="shrink-0 text-sm text-gray-500">{formatRelativeTime(log.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default OverviewPanel;
