import React, { useState } from 'react';
import { ArrowLeft, DollarSign, TrendingUp } from 'lucide-react';

interface TotalRevenueProps {
  onBack: () => void;
}

export const TotalRevenue: React.FC<TotalRevenueProps> = ({ onBack }) => {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  const transactions = [
    { id: '1', user: 'Alex Johnson', type: 'Subscription', amount: 49.99, date: '2024-01-15' },
    { id: '2', user: 'Sarah Smith', type: 'In-App Purchase', amount: 19.99, date: '2024-01-14' },
    { id: '3', user: 'Mike Brown', type: 'Subscription', amount: 49.99, date: '2024-01-13' },
    { id: '4', user: 'Emma Davis', type: 'Gym Partnership', amount: 299.99, date: '2024-01-12' },
    { id: '5', user: 'John Wilson', type: 'Subscription', amount: 49.99, date: '2024-01-11' }
  ];

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-6">
        <ArrowLeft size={20} />
        <span>Back to Dashboard</span>
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Total Revenue</h1>
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

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#242424] rounded-lg p-6">
          <DollarSign className="text-green-500 mb-2" size={24} />
          <div className="text-3xl font-bold">$45,680</div>
          <div className="text-sm text-gray-400">Total Revenue</div>
        </div>
        <div className="bg-[#242424] rounded-lg p-6">
          <TrendingUp className="text-[#BFFF00] mb-2" size={24} />
          <div className="text-3xl font-bold">$12,340</div>
          <div className="text-sm text-gray-400">This Month</div>
        </div>
        <div className="bg-[#242424] rounded-lg p-6">
          <DollarSign className="text-blue-500 mb-2" size={24} />
          <div className="text-3xl font-bold">$2,890</div>
          <div className="text-sm text-gray-400">This Week</div>
        </div>
      </div>

      <div className="bg-[#242424] rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-3 px-4">User</th>
              <th className="text-left py-3 px-4">Type</th>
              <th className="text-left py-3 px-4">Amount</th>
              <th className="text-left py-3 px-4">Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(transaction => (
              <tr key={transaction.id} className="border-b border-gray-800 hover:bg-[#1A1A1A]">
                <td className="py-3 px-4 font-semibold">{transaction.user}</td>
                <td className="py-3 px-4 text-gray-400">{transaction.type}</td>
                <td className="py-3 px-4 text-green-500 font-semibold">${transaction.amount}</td>
                <td className="py-3 px-4 text-gray-400">{transaction.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
