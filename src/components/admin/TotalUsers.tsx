import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trash2, TrendingUp, Users } from 'lucide-react';
import { api } from '../../services/api';

interface TotalUsersProps {
  onBack: () => void;
}

type TimeRange = 'week' | 'month' | 'year';
type UserStatus = 'active' | 'inactive';

type AdminOverviewUserResponse = {
  id?: number | string;
  name?: string | null;
  email?: string | null;
  joined_at?: string | null;
  status?: string | null;
  total_workouts?: number | string | null;
};

type AdminOverviewUser = {
  id: string;
  name: string;
  email: string;
  joinedAt: string | null;
  status: UserStatus;
  workouts: number;
};

const getRangeStart = (range: TimeRange) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (range === 'week') {
    now.setDate(now.getDate() - 6);
    return now;
  }

  if (range === 'month') {
    now.setMonth(now.getMonth() - 1);
    return now;
  }

  now.setFullYear(now.getFullYear() - 1);
  return now;
};

const isUserWithinRange = (user: AdminOverviewUser, range: TimeRange) => {
  if (!user.joinedAt) return true;

  const joinedDate = new Date(user.joinedAt);
  if (Number.isNaN(joinedDate.getTime())) return true;

  return joinedDate >= getRangeStart(range);
};

const formatJoinedDate = (value: string | null) => {
  if (!value) return 'Unknown';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return date.toISOString().slice(0, 10);
};

const getTimeRangeLabel = (range: TimeRange) => {
  if (range === 'week') return 'last 7 days';
  if (range === 'month') return 'last 30 days';
  return 'last 12 months';
};

const normalizeAdminOverviewUser = (user: AdminOverviewUserResponse): AdminOverviewUser => {
  const normalizedId = String(user.id ?? '').trim() || '0';
  const fallbackName = `User ${normalizedId}`;
  const workouts = Number(user.total_workouts || 0);

  return {
    id: normalizedId,
    name: String(user.name || '').trim() || fallbackName,
    email: String(user.email || '').trim() || 'No email',
    joinedAt: typeof user.joined_at === 'string' ? user.joined_at : null,
    status: user.status === 'inactive' ? 'inactive' : 'active',
    workouts: Number.isFinite(workouts) ? workouts : 0,
  };
};

export const TotalUsers: React.FC<TotalUsersProps> = ({ onBack }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [users, setUsers] = useState<AdminOverviewUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await api.getAdminUsersOverview();
        const nextUsers = Array.isArray(response?.users)
          ? (response.users as AdminOverviewUserResponse[]).map(normalizeAdminOverviewUser)
          : [];

        if (!cancelled) {
          setUsers(nextUsers);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load users');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleUsers = users.filter((user) => isUserWithinRange(user, timeRange));
  const totalUsers = visibleUsers.length;
  const activeUsers = visibleUsers.filter((user) => user.status === 'active').length;
  const inactiveUsers = totalUsers - activeUsers;

  const handleDelete = async (userId: string, userName: string) => {
    const confirmed = window.confirm(
      `Delete ${userName}? This removes the account and related user data.`,
    );
    if (!confirmed) return;

    try {
      setDeletingUserId(userId);
      setError('');
      await api.deleteUser(userId);
      setUsers((currentUsers) => currentUsers.filter((user) => user.id !== userId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
        <ArrowLeft size={20} />
        <span>Back to Dashboard</span>
      </button>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Total Users</h1>
          <p className="text-sm text-gray-400 mt-1">
            Showing users created in the {getTimeRangeLabel(timeRange)}.
          </p>
        </div>

        <div className="flex gap-2">
          {['week', 'month', 'year'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range as TimeRange)}
              className={`px-4 py-2 rounded-lg capitalize ${
                timeRange === range ? 'bg-[#10b981] text-black' : 'bg-[#242424]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#242424] rounded-lg p-6">
          <Users className="text-emerald-600 mb-2" size={24} />
          <div className="text-3xl font-bold">{loading ? '--' : totalUsers.toLocaleString()}</div>
          <div className="text-sm text-gray-400">Total Users</div>
        </div>

        <div className="bg-[#242424] rounded-lg p-6">
          <TrendingUp className="text-green-500 mb-2" size={24} />
          <div className="text-3xl font-bold">{loading ? '--' : activeUsers.toLocaleString()}</div>
          <div className="text-sm text-gray-400">Active Users</div>
        </div>

        <div className="bg-[#242424] rounded-lg p-6">
          <Users className="text-red-500 mb-2" size={24} />
          <div className="text-3xl font-bold">{loading ? '--' : inactiveUsers.toLocaleString()}</div>
          <div className="text-sm text-gray-400">Inactive Users</div>
        </div>
      </div>

      <div className="bg-[#242424] rounded-lg p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold">User List</h2>
          <div className="text-sm text-gray-400">
            {loading ? 'Loading...' : `${visibleUsers.length} user${visibleUsers.length === 1 ? '' : 's'}`}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-4">Name</th>
                <th className="text-left py-3 px-4">Email</th>
                <th className="text-left py-3 px-4">Joined</th>
                <th className="text-left py-3 px-4">Workouts</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {!loading && visibleUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 px-4 text-center text-gray-400">
                    No users found for the selected time range.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={6} className="py-10 px-4 text-center text-gray-400">
                    Loading real user data...
                  </td>
                </tr>
              )}

              {!loading && visibleUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-800 hover:bg-[#1A1A1A]">
                  <td className="py-3 px-4 font-semibold">{user.name}</td>
                  <td className="py-3 px-4 text-gray-400">{user.email}</td>
                  <td className="py-3 px-4 text-gray-400">{formatJoinedDate(user.joinedAt)}</td>
                  <td className="py-3 px-4">{user.workouts}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        user.status === 'active'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-red-500/20 text-red-500'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleDelete(user.id, user.name)}
                      disabled={deletingUserId === user.id}
                      className="p-2 bg-red-500/20 text-red-500 rounded hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Delete ${user.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
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
