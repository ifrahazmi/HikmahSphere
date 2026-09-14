import React from 'react';
import { motion } from 'framer-motion';
import {
  BanknotesIcon,
  BellAlertIcon,
  ChartBarIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { DashboardTab } from './types';

interface DashboardShellProps {
  isSuperAdmin: boolean;
  adminName?: string;
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  userCount: number;
  blockedCount: number;
  pushReadyCount: number;
  children: React.ReactNode;
}

const DashboardShell: React.FC<DashboardShellProps> = ({
  isSuperAdmin,
  adminName,
  activeTab,
  onTabChange,
  userCount,
  blockedCount,
  pushReadyCount,
  children,
}) => {
  const tabs: Array<{ id: DashboardTab; label: string; icon: React.ReactNode; badge?: number; show: boolean }> = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <ChartBarIcon className="h-4 w-4" />,
      show: isSuperAdmin,
    },
    {
      id: 'users',
      label: 'Users',
      icon: <UsersIcon className="h-4 w-4" />,
      badge: userCount,
      show: isSuperAdmin,
    },
    {
      id: 'zakat',
      label: 'Funds',
      icon: <BanknotesIcon className="h-4 w-4" />,
      show: true,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <BellAlertIcon className="h-4 w-4" />,
      show: isSuperAdmin,
    },
  ];

  const visibleTabs = tabs.filter((tab) => tab.show);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-16 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 p-4 sm:rounded-3xl sm:p-8 text-white shadow-xl mb-4 sm:mb-6"
        >
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-teal-300/20" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-white p-1.5 shadow-lg sm:h-16 sm:w-16 sm:p-2">
                <img src="/logo.png" alt="HikmahSphere Logo" className="h-full w-full object-cover rounded-xl" />
              </div>
              <div className="min-w-0">
                <p className="text-emerald-100 text-xs font-medium sm:text-sm">HikmahSphere</p>
                <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
                  {isSuperAdmin ? 'Control Center' : 'Fund Management'}
                </h1>
                <p className="mt-1 hidden text-emerald-50/90 sm:block">
                  {isSuperAdmin
                    ? `Welcome back${adminName ? `, ${adminName}` : ''}. Manage people, funds, and alerts from one place.`
                    : 'Review collections, spending, and balances.'}
                </p>
              </div>
            </div>
            {isSuperAdmin && (
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-xl bg-white/10 px-2 py-2 text-center backdrop-blur-sm sm:rounded-2xl sm:px-4 sm:py-3 sm:text-left">
                  <p className="text-[10px] text-emerald-100 sm:text-xs">Users</p>
                  <p className="text-lg font-bold sm:text-2xl">{userCount}</p>
                </div>
                <div className="rounded-xl bg-white/10 px-2 py-2 text-center backdrop-blur-sm sm:rounded-2xl sm:px-4 sm:py-3 sm:text-left">
                  <p className="text-[10px] text-emerald-100 sm:text-xs">Blocked</p>
                  <p className="text-lg font-bold sm:text-2xl">{blockedCount}</p>
                </div>
                <div className="rounded-xl bg-white/10 px-2 py-2 text-center backdrop-blur-sm sm:rounded-2xl sm:px-4 sm:py-3 sm:text-left">
                  <p className="text-[10px] text-emerald-100 sm:text-xs">Push ready</p>
                  <p className="text-lg font-bold sm:text-2xl">{pushReadyCount}</p>
                </div>
              </div>
            )}
          </div>
        </motion.section>

        <div className="sticky top-16 z-20 mb-6 rounded-2xl border border-emerald-100/80 bg-white/90 p-2 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
          <nav className="hidden md:flex gap-1">
            {visibleTabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {typeof tab.badge === 'number' && (
                    <span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white/20' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="grid grid-cols-2 gap-2 md:hidden">
            {visibleTabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold ${
                    active
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {children}
      </div>
    </div>
  );
};

export default DashboardShell;
