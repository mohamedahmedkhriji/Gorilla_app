import React, { useState, useEffect } from 'react';
import { Users, DollarSign, TrendingUp, Building2, LogOut, UserCheck } from 'lucide-react';
import { TotalUsers } from '../../components/admin/TotalUsers';
import { TotalRevenue } from '../../components/admin/TotalRevenue';
import { PartnerGyms } from '../../components/admin/PartnerGyms';
import { UserGrowthChart } from '../../components/admin/UserGrowthChart';
import { RevenueBreakdown } from '../../components/admin/RevenueBreakdown';
import { AllCoaches } from '../../components/admin/AllCoaches';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { WorkspaceGrid } from '../../components/workspace/WorkspaceGrid';
import { WorkspacePlaceholderScreen } from '../../components/workspace/WorkspacePlaceholderScreen';
import { getWorkspacePage, getWorkspacePages } from '../../config/workspacePages';
import { useScrollToTopOnChange } from '../../shared/scroll';

type Gym = {
  id: string;
  name: string;
  members: number;
  revenue: number;
  status: 'active' | 'inactive';
  plan: 'Premium' | 'Basic';
};

type GrowthPoint = {
  month: string;
  users: number;
};

interface SuperAdminDashboardProps {
  onLogout?: () => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onLogout }) => {
  const timeRanges: Array<'week' | 'month' | 'year'> = ['week', 'month', 'year'];
  const [view, setView] = useState<
    'dashboard'
    | 'users'
    | 'revenue'
    | 'gyms'
    | 'growth'
    | 'breakdown'
    | 'coaches'
    | 'exercisesmanagement'
    | 'missionsmanagement'
    | 'ranksystem'
    | 'subscriptionmanagement'
  >('dashboard');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const adminWorkspacePages = getWorkspacePages('admin');
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalGyms: 0,
    activeGyms: 0
  });

  const [gyms, setGyms] = useState<Gym[]>([]);
  const [userGrowth, setUserGrowth] = useState<GrowthPoint[]>([]);

  useScrollToTopOnChange([view]);

  useEffect(() => {
    setStats({
      totalUsers: 1247,
      activeUsers: 892,
      totalRevenue: 45680,
      monthlyRevenue: 12340,
      totalGyms: 23,
      activeGyms: 21
    });

    setGyms([
      { id: '1', name: 'Iron Paradise', members: 156, revenue: 4680, status: 'active', plan: 'Premium' },
      { id: '2', name: 'Fitness Hub', members: 203, revenue: 6090, status: 'active', plan: 'Premium' },
      { id: '3', name: 'Elite Gym', members: 89, revenue: 2670, status: 'active', plan: 'Basic' },
      { id: '4', name: 'Power House', members: 134, revenue: 4020, status: 'active', plan: 'Premium' },
      { id: '5', name: 'Flex Zone', members: 67, revenue: 2010, status: 'inactive', plan: 'Basic' }
    ]);

    setUserGrowth([
      { month: 'Jan', users: 850 },
      { month: 'Feb', users: 920 },
      { month: 'Mar', users: 1050 },
      { month: 'Apr', users: 1150 },
      { month: 'May', users: 1247 }
    ]);
  }, []);

  const maxUsers = Math.max(...userGrowth.map(d => d.users));

  const openAdminWorkspacePage = (pageId: string) => {
    switch (pageId) {
      case 'admin-dashboard':
        setView('dashboard');
        return;
      case 'users-management':
        setView('users');
        return;
      case 'coaches-management':
        setView('coaches');
        return;
      case 'exercises-management':
        setView('exercisesmanagement');
        return;
      case 'missions-management':
        setView('missionsmanagement');
        return;
      case 'rank-system':
        setView('ranksystem');
        return;
      case 'subscription-management':
        setView('subscriptionmanagement');
        return;
      default:
        setView('dashboard');
    }
  };

  if (view === 'users') return <TotalUsers onBack={() => setView('dashboard')} />;
  if (view === 'revenue') return <TotalRevenue onBack={() => setView('dashboard')} />;
  if (view === 'gyms') return <PartnerGyms onBack={() => setView('dashboard')} />;
  if (view === 'growth') return <UserGrowthChart onBack={() => setView('dashboard')} />;
  if (view === 'breakdown') return <RevenueBreakdown onBack={() => setView('dashboard')} />;
  if (view === 'coaches') return <AllCoaches onBack={() => setView('dashboard')} />;
  if (view === 'exercisesmanagement') {
    const page = getWorkspacePage('admin', 'exercises-management');
    return (
      <WorkspacePlaceholderScreen
        title={page?.title || 'Exercises Management'}
        description={page?.description || 'Exercise catalog administration will live here.'}
        onBack={() => setView('dashboard')}
        status={page?.status}
        implementation={page?.implementation}
        notes={[
          'The backend already includes exercise catalog import and upgrade scripts.',
          'A dedicated admin CRUD screen for exercise metadata is not exposed in the web panel yet.',
        ]}
        actions={[
          {
            label: 'Return to Dashboard',
            onClick: () => setView('dashboard'),
          },
        ]}
      />
    );
  }
  if (view === 'missionsmanagement') {
    const page = getWorkspacePage('admin', 'missions-management');
    return (
      <WorkspacePlaceholderScreen
        title={page?.title || 'Missions Management'}
        description={page?.description || 'Mission administration will live here.'}
        onBack={() => setView('dashboard')}
        status={page?.status}
        implementation={page?.implementation}
        notes={[
          'User-facing missions and rank rewards already exist on the mobile side.',
          'Admin tooling for configuring mission rules and campaigns is not exposed yet.',
        ]}
        actions={[
          {
            label: 'Return to Dashboard',
            onClick: () => setView('dashboard'),
          },
        ]}
      />
    );
  }
  if (view === 'ranksystem') {
    const page = getWorkspacePage('admin', 'rank-system');
    return (
      <WorkspacePlaceholderScreen
        title={page?.title || 'Rank System'}
        description={page?.description || 'Rank configuration will live here.'}
        onBack={() => setView('dashboard')}
        status={page?.status}
        implementation={page?.implementation}
        notes={[
          'Rank values are already surfaced in the user and coach experiences.',
          'Threshold controls and tuning tools are not yet exposed as an admin workflow.',
        ]}
        actions={[
          {
            label: 'Return to Dashboard',
            onClick: () => setView('dashboard'),
          },
        ]}
      />
    );
  }
  if (view === 'subscriptionmanagement') {
    const page = getWorkspacePage('admin', 'subscription-management');
    return (
      <WorkspacePlaceholderScreen
        title={page?.title || 'Subscription Management'}
        description={page?.description || 'Subscription oversight will live here.'}
        onBack={() => setView('dashboard')}
        status={page?.status}
        implementation={page?.implementation}
        notes={[
          'Revenue and subscription signals currently live in the revenue overview cards.',
          'A dedicated plan and billing management screen is not wired into the admin panel yet.',
        ]}
        actions={[
          {
            label: 'Open Revenue Overview',
            onClick: () => setView('revenue'),
          },
          {
            label: 'Open Revenue Breakdown',
            onClick: () => setView('breakdown'),
            variant: 'secondary',
          },
        ]}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white p-3 md:p-6">
      <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 md:w-12 md:h-12">
            <BrandLogo imageClassName="object-contain" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Super Admin Dashboard</h1>
            <p className="text-gray-400 text-sm">Platform overview and analytics</p>
          </div>
        </div>
        <button
          onClick={() => {
            if (onLogout) {
              onLogout();
              return;
            }
            localStorage.removeItem('adminUser');
            localStorage.removeItem('adminUserId');
            localStorage.removeItem('coach');
            localStorage.removeItem('coachId');
            window.location.href = '/admin.html';
          }}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 px-3 md:px-4 py-2 rounded-lg transition-colors text-sm w-fit"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>

      <div className="flex gap-2 mb-4 md:mb-6 overflow-x-auto pb-2">
        {timeRanges.map(range => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-3 md:px-4 py-2 rounded-lg capitalize text-sm whitespace-nowrap ${
              timeRange === range ? 'bg-[#BFFF00] text-black' : 'bg-[#242424]'
            }`}
          >
            {range}
          </button>                                                                                                                 
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        <div className="bg-[#242424] rounded-lg p-4 md:p-6 cursor-pointer hover:bg-[#2A2A2A] transition-colors" onClick={() => setView('users')}>
          <div className="flex items-center justify-between mb-4">
            <Users size={20} className="text-[#BFFF00]" />
            <TrendingUp size={16} className="text-green-500" />
          </div>
          <div className="text-2xl md:text-3xl font-bold">{stats.totalUsers.toLocaleString()}</div>
          <div className="text-xs md:text-sm text-gray-400">Total Users</div>
          <div className="text-xs text-green-500 mt-2">+{stats.activeUsers} active</div>
        </div>

        <div className="bg-[#242424] rounded-lg p-4 md:p-6 cursor-pointer hover:bg-[#2A2A2A] transition-colors" onClick={() => setView('revenue')}>
          <div className="flex items-center justify-between mb-4">
            <DollarSign size={20} className="text-green-500" />
            <TrendingUp size={16} className="text-green-500" />
          </div>
          <div className="text-2xl md:text-3xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
          <div className="text-xs md:text-sm text-gray-400">Total Revenue</div>
          <div className="text-xs text-green-500 mt-2">${stats.monthlyRevenue.toLocaleString()} this month</div>
        </div>

        <div className="bg-[#242424] rounded-lg p-4 md:p-6 cursor-pointer hover:bg-[#2A2A2A] transition-colors" onClick={() => setView('gyms')}>
          <div className="flex items-center justify-between mb-4">
            <Building2 size={20} className="text-blue-500" />
            <TrendingUp size={16} className="text-green-500" />
          </div>
          <div className="text-2xl md:text-3xl font-bold">{stats.totalGyms}</div>
          <div className="text-xs md:text-sm text-gray-400">Partner Gyms</div>
          <div className="text-xs text-green-500 mt-2">{stats.activeGyms} active</div>
        </div>

        <div className="bg-[#242424] rounded-lg p-4 md:p-6 cursor-pointer hover:bg-[#2A2A2A] transition-colors" onClick={() => setView('coaches')}>
          <div className="flex items-center justify-between mb-4">
            <UserCheck size={20} className="text-purple-500" />
            <TrendingUp size={16} className="text-green-500" />
          </div>
          <div className="text-2xl md:text-3xl font-bold">45</div>
          <div className="text-xs md:text-sm text-gray-400">Total Coaches</div>
          <div className="text-xs text-green-500 mt-2">38 active</div>
        </div>
      </div>

      <div className="mb-4 md:mb-6">
        <WorkspaceGrid
          title="Admin Workspace"
          subtitle="This maps the requested admin panel pages to the current implementation."
          pages={adminWorkspacePages}
          onSelect={(page) => openAdminWorkspacePage(page.id)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
        <div className="bg-[#242424] rounded-lg p-4 md:p-6 cursor-pointer hover:bg-[#2A2A2A] transition-colors" onClick={() => setView('growth')}>
          <h2 className="text-lg md:text-xl font-semibold mb-4">User Growth</h2>
          <div className="h-48 md:h-64">
            <svg className="w-full h-full" viewBox="0 0 500 250">
              {userGrowth.map((d, i) => {
                const x = (i / (userGrowth.length - 1)) * 480 + 10;
                const y = 230 - (d.users / maxUsers) * 200;
                const nextPoint = userGrowth[i + 1];
                const nextX = nextPoint ? ((i + 1) / (userGrowth.length - 1)) * 480 + 10 : x;
                const nextY = nextPoint ? 230 - (nextPoint.users / maxUsers) * 200 : y;
                
                return (
                  <g key={i}>
                    {i < userGrowth.length - 1 && (
                      <line x1={x} y1={y} x2={nextX} y2={nextY} stroke="#BFFF00" strokeWidth="3" />
                    )}
                    <circle cx={x} cy={y} r="5" fill="#BFFF00" />
                    <text x={x} y="245" fill="#888" fontSize="12" textAnchor="middle">{d.month}</text>
                    <text x={x} y={y - 10} fill="#BFFF00" fontSize="12" textAnchor="middle">{d.users}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="bg-[#242424] rounded-lg p-4 md:p-6 cursor-pointer hover:bg-[#2A2A2A] transition-colors" onClick={() => setView('breakdown')}>
          <h2 className="text-lg md:text-xl font-semibold mb-4">Revenue Breakdown</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Subscriptions</span>
                <span className="font-semibold">$32,450</span>
              </div>
              <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div className="h-full bg-[#BFFF00]" style={{ width: '71%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>In-App Purchases</span>
                <span className="font-semibold">$8,920</span>
              </div>
              <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: '20%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Gym Partnerships</span>
                <span className="font-semibold">$4,310</span>
              </div>
              <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: '9%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#242424] rounded-lg p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-semibold mb-4">Partner Gyms</h2>
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-4">Gym Name</th>
                <th className="text-left py-3 px-4">Members</th>
                <th className="text-left py-3 px-4">Revenue</th>
                <th className="text-left py-3 px-4">Plan</th>
                <th className="text-left py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {gyms.map(gym => (
                <tr key={gym.id} className="border-b border-gray-800 hover:bg-[#1A1A1A]">
                  <td className="py-3 px-4 font-semibold">{gym.name}</td>
                  <td className="py-3 px-4">{gym.members}</td>
                  <td className="py-3 px-4">${gym.revenue.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      gym.plan === 'Premium' ? 'bg-[#BFFF00]/20 text-[#BFFF00]' : 'bg-gray-700 text-gray-300'
                    }`}>
                      {gym.plan}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      gym.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                    }`}>
                      {gym.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
