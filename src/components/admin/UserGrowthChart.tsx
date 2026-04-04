import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';
import {
  AdminOverviewUserRecord,
  buildUserGrowthMetrics,
  createUserGrowthChartScale,
  GrowthRange,
} from './userGrowthUtils';

interface UserGrowthChartProps {
  onBack: () => void;
  initialTimeRange?: GrowthRange;
  initialUsers?: AdminOverviewUserRecord[];
}

const formatMetric = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1).replace(/\.0$/, '');
  return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

const normalizeOverviewUsers = (payload: unknown): AdminOverviewUserRecord[] => {
  return Array.isArray(payload) ? (payload as AdminOverviewUserRecord[]) : [];
};

export const UserGrowthChart: React.FC<UserGrowthChartProps> = ({
  onBack,
  initialTimeRange = 'month',
  initialUsers,
}) => {
  const [timeRange, setTimeRange] = useState<GrowthRange>(initialTimeRange);
  const [users, setUsers] = useState<AdminOverviewUserRecord[]>(initialUsers ?? []);
  const [loading, setLoading] = useState(initialUsers === undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialUsers === undefined) return;
    setUsers(initialUsers);
    setLoading(false);
  }, [initialUsers]);

  useEffect(() => {
    if (initialUsers !== undefined) return;

    let cancelled = false;

    const loadUsers = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await api.getAdminUsersOverview();
        const nextUsers = normalizeOverviewUsers(response?.users);

        if (!cancelled) {
          setUsers(nextUsers);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load user growth');
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
  }, [initialUsers]);

  const growthMetrics = useMemo(
    () => buildUserGrowthMetrics(users, timeRange),
    [users, timeRange],
  );
  const chartScale = useMemo(
    () => createUserGrowthChartScale(growthMetrics.points),
    [growthMetrics.points],
  );

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
        <ArrowLeft size={20} />
        <span>Back to Dashboard</span>
      </button>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">User Growth</h1>
          <p className="text-sm text-gray-400 mt-1">Real signup history based on user join dates.</p>
        </div>

        <div className="flex gap-2">
          {['week', 'month', 'year'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range as GrowthRange)}
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

      <div className="bg-[#242424] rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-6">Growth Chart</h2>
        <div className="h-96">
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              Loading real growth data...
            </div>
          ) : (
            <svg className="w-full h-full" viewBox="0 0 800 400">
              {growthMetrics.points.map((point, index) => {
                const denominator = Math.max(1, growthMetrics.points.length - 1);
                const x = (index / denominator) * 760 + 20;
                const y = chartScale.getY(point.users, 360, 320);
                const nextPoint = growthMetrics.points[index + 1];
                const nextX = nextPoint ? ((index + 1) / denominator) * 760 + 20 : x;
                const nextY = nextPoint ? chartScale.getY(nextPoint.users, 360, 320) : y;

                return (
                  <g key={`${point.label}-${index}`}>
                    {index < growthMetrics.points.length - 1 && (
                      <line x1={x} y1={y} x2={nextX} y2={nextY} stroke="#10b981" strokeWidth="4" />
                    )}
                    <circle cx={x} cy={y} r="8" fill="#10b981" />
                    <text x={x} y="385" fill="#888" fontSize="16" textAnchor="middle">
                      {point.label}
                    </text>
                    <text x={x} y={y - 15} fill="#10b981" fontSize="16" textAnchor="middle" fontWeight="bold">
                      {point.users}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#242424] rounded-lg p-6">
          <TrendingUp className="text-green-500 mb-2" size={24} />
          <div className="text-3xl font-bold">
            {loading ? '--' : `+${growthMetrics.growthThisPeriod.toLocaleString()}`}
          </div>
          <div className="text-sm text-gray-400">Growth This Period</div>
        </div>

        <div className="bg-[#242424] rounded-lg p-6">
          <TrendingUp className="text-emerald-600 mb-2" size={24} />
          <div className="text-3xl font-bold">{loading ? '--' : `${formatMetric(growthMetrics.growthRate)}%`}</div>
          <div className="text-sm text-gray-400">Growth Rate</div>
        </div>

        <div className="bg-[#242424] rounded-lg p-6">
          <TrendingUp className="text-blue-500 mb-2" size={24} />
          <div className="text-3xl font-bold">{loading ? '--' : formatMetric(growthMetrics.avgDailySignups)}</div>
          <div className="text-sm text-gray-400">Avg. Daily Signups</div>
        </div>
      </div>
    </div>
  );
};
