import React, { useState } from 'react';
import { ArrowLeft, TrendingUp } from 'lucide-react';

interface UserGrowthChartProps {
  onBack: () => void;
}

export const UserGrowthChart: React.FC<UserGrowthChartProps> = ({ onBack }) => {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  const userGrowth = [
    { month: 'Jan', users: 850 },
    { month: 'Feb', users: 920 },
    { month: 'Mar', users: 1050 },
    { month: 'Apr', users: 1150 },
    { month: 'May', users: 1247 }
  ];

  const maxUsers = Math.max(...userGrowth.map(d => d.users));

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
        <ArrowLeft size={20} />
        <span>Back to Dashboard</span>
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">User Growth</h1>
        <div className="flex gap-2">
          {['week', 'month', 'year'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range as any)}
              className={`px-4 py-2 rounded-lg capitalize ${
                timeRange === range ? 'bg-[#BFFF00] text-black' : 'bg-[#242424]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#242424] rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-6">Growth Chart</h2>
        <div className="h-96">
          <svg className="w-full h-full" viewBox="0 0 800 400">
            {userGrowth.map((d, i) => {
              const x = (i / (userGrowth.length - 1)) * 760 + 20;
              const y = 360 - (d.users / maxUsers) * 320;
              const nextPoint = userGrowth[i + 1];
              const nextX = nextPoint ? ((i + 1) / (userGrowth.length - 1)) * 760 + 20 : x;
              const nextY = nextPoint ? 360 - (nextPoint.users / maxUsers) * 320 : y;
              
              return (
                <g key={i}>
                  {i < userGrowth.length - 1 && (
                    <line x1={x} y1={y} x2={nextX} y2={nextY} stroke="#BFFF00" strokeWidth="4" />
                  )}
                  <circle cx={x} cy={y} r="8" fill="#BFFF00" />
                  <text x={x} y="385" fill="#888" fontSize="16" textAnchor="middle">{d.month}</text>
                  <text x={x} y={y - 15} fill="#BFFF00" fontSize="16" textAnchor="middle" fontWeight="bold">{d.users}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#242424] rounded-lg p-6">
          <TrendingUp className="text-green-500 mb-2" size={24} />
          <div className="text-3xl font-bold">+397</div>
          <div className="text-sm text-gray-400">Growth This Period</div>
        </div>
        <div className="bg-[#242424] rounded-lg p-6">
          <TrendingUp className="text-[#BFFF00] mb-2" size={24} />
          <div className="text-3xl font-bold">46.7%</div>
          <div className="text-sm text-gray-400">Growth Rate</div>
        </div>
        <div className="bg-[#242424] rounded-lg p-6">
          <TrendingUp className="text-blue-500 mb-2" size={24} />
          <div className="text-3xl font-bold">79</div>
          <div className="text-sm text-gray-400">Avg. Daily Signups</div>
        </div>
      </div>
    </div>
  );
};
