import React, { useState } from 'react';
import { ArrowLeft, DollarSign } from 'lucide-react';

interface RevenueBreakdownProps {
  onBack: () => void;
}

export const RevenueBreakdown: React.FC<RevenueBreakdownProps> = ({ onBack }) => {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  const breakdown = [
    { category: 'Subscriptions', amount: 32450, percentage: 71, color: '#10b981' },
    { category: 'In-App Purchases', amount: 8920, percentage: 20, color: '#22c55e' },
    { category: 'Gym Partnerships', amount: 4310, percentage: 9, color: '#3b82f6' }
  ];

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
        <ArrowLeft size={20} />
        <span>Back to Dashboard</span>
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Revenue Breakdown</h1>
        <div className="flex gap-2">
          {['week', 'month', 'year'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range as any)}
              className={`px-4 py-2 rounded-lg capitalize ${
                timeRange === range ? 'bg-[#10b981] text-black' : 'bg-[#242424]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[#242424] rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-6">Revenue by Category</h2>
          <div className="space-y-6">
            {breakdown.map((item) => (
              <div key={item.category}>
                <div className="flex justify-between text-sm mb-2">
                  <span>{item.category}</span>
                  <span className="font-semibold">${item.amount.toLocaleString()}</span>
                </div>
                <div className="h-3 bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1">{item.percentage}% of total</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#242424] rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-6">Pie Chart</h2>
          <div className="flex items-center justify-center h-64">
            <svg width="250" height="250" viewBox="0 0 250 250">
              <circle cx="125" cy="125" r="100" fill="#10b981" />
              <path d="M 125 125 L 125 25 A 100 100 0 0 1 196.65 196.65 Z" fill="#22c55e" />
              <path d="M 125 125 L 196.65 196.65 A 100 100 0 0 1 125 225 Z" fill="#3b82f6" />
            </svg>
          </div>
          <div className="space-y-2 mt-4">
            {breakdown.map((item) => (
              <div key={item.category} className="flex items-center gap-2 text-sm">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }} />
                <span>{item.category}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="bg-[#242424] rounded-lg p-6">
          <DollarSign className="text-emerald-600 mb-2" size={24} />
          <div className="text-3xl font-bold">$32,450</div>
          <div className="text-sm text-gray-400">Subscriptions</div>
        </div>
        <div className="bg-[#242424] rounded-lg p-6">
          <DollarSign className="text-green-500 mb-2" size={24} />
          <div className="text-3xl font-bold">$8,920</div>
          <div className="text-sm text-gray-400">In-App Purchases</div>
        </div>
        <div className="bg-[#242424] rounded-lg p-6">
          <DollarSign className="text-blue-500 mb-2" size={24} />
          <div className="text-3xl font-bold">$4,310</div>
          <div className="text-sm text-gray-400">Gym Partnerships</div>
        </div>
      </div>
    </div>
  );
};

