import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_URL } from '../config';
import PageSEO from '../components/PageSEO';
import AdminNotificationPanel from '../components/Notifications/AdminNotificationPanel';
import FundsManagement from '../components/Funds/FundsManagement';
import DashboardShell from '../components/Dashboard/DashboardShell';
import OverviewPanel from '../components/Dashboard/OverviewPanel';
import UserManagementPanel from '../components/Dashboard/UserManagementPanel';
import { deriveDashboardStats } from '../components/Dashboard/dashboardUsers';
import { ActivityLog, ActivityStats, DashboardTab, DashboardUser } from '../components/Dashboard/types';

const Dashboard: React.FC = () => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const hasLoadedDashboardDataRef = useRef(false);

  const isSuperAdmin = hasRole(['superadmin']);
  const canManageFunds = hasRole(['superadmin', 'manager']);
  const canAccessDashboard = isSuperAdmin || canManageFunds;
  const stats = deriveDashboardStats(users);

  const fetchUsers = async (silent = false) => {
    try {
      if (!silent) {
        setLoadingUsers(true);
      }
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.status === 'success') {
        setUsers(data.data.users);
        return;
      }

      const toolResponse = await fetch(`${API_URL}/tools/users`);
      const toolData = await toolResponse.json();
      if (Array.isArray(toolData)) {
        setUsers(toolData);
      }
    } catch (error) {
      console.error('Failed to fetch users', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchActivityLogs = async (silent = false) => {
    try {
      if (!silent) {
        setLoadingActivities(true);
      }
      const token = localStorage.getItem('token');
      const [logsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/activity/recent?limit=15`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/activity/stats?days=7`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
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

  useEffect(() => {
    if (!isSuperAdmin) {
      return;
    }

    const silent = hasLoadedDashboardDataRef.current;
    void (async () => {
      await Promise.all([fetchUsers(silent), fetchActivityLogs(silent)]);
      hasLoadedDashboardDataRef.current = true;
    })();
  }, [user?.id, isSuperAdmin]);

  useEffect(() => {
    if (canAccessDashboard && !isSuperAdmin && activeTab !== 'zakat') {
      setActiveTab('zakat');
    }
  }, [canAccessDashboard, isSuperAdmin, activeTab]);

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
  };

  const handleCreateUserShortcut = () => {
    setActiveTab('users');
    setCreateUserOpen(true);
  };

  if (!canAccessDashboard) {
    return (
      <>
        <PageSEO
          title="Super Admin Control Center"
          description="HikmahSphere admin control center for managing users, funds, and notifications."
          path="/dashboard"
          noIndex
          noFollow
        />
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-24 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800">
          <h2 className="mb-2 text-2xl font-bold text-red-600">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-300">You do not have permission to view this dashboard.</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-4 font-medium text-emerald-600 hover:text-emerald-700"
          >
            Go Home
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageSEO
        title={isSuperAdmin ? 'Super Admin Control Center' : 'Fund Management'}
        description="HikmahSphere admin control center for managing users, funds, and notifications."
        path="/dashboard"
        noIndex
        noFollow
      />
      <DashboardShell
        isSuperAdmin={isSuperAdmin}
        adminName={user?.name}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        userCount={stats.totalUsers}
        blockedCount={stats.blocked}
        pushReadyCount={stats.pushReady}
      >
        {isSuperAdmin && activeTab === 'overview' && (
          <OverviewPanel
            users={users}
            activityLogs={activityLogs}
            activityStats={activityStats}
            loadingActivities={loadingActivities}
            onTabChange={handleTabChange}
            onCreateUser={handleCreateUserShortcut}
          />
        )}

        {isSuperAdmin && activeTab === 'users' && (
          <UserManagementPanel
            users={users}
            currentUserId={user?.id}
            loading={loadingUsers}
            onRefresh={fetchUsers}
            createUserOpen={createUserOpen}
            onCreateUserOpenChange={setCreateUserOpen}
          />
        )}

        {canManageFunds && activeTab === 'zakat' && (
          <div className="rounded-2xl">
            <FundsManagement />
          </div>
        )}

        {isSuperAdmin && activeTab === 'notifications' && (
          <div className="mx-auto max-w-4xl">
            <div className="overflow-hidden rounded-2xl shadow-sm">
              <AdminNotificationPanel />
            </div>
          </div>
        )}
      </DashboardShell>
    </>
  );
};

export default Dashboard;
