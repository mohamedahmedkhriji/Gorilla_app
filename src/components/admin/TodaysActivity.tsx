import React from 'react';
import { ArrowLeft, Clock } from 'lucide-react';

interface TodaysActivityProps {
  onBack: () => void;
}

export const TodaysActivity: React.FC<TodaysActivityProps> = ({ onBack }) => {
  const activities = [
    { id: '1', name: 'Alex Johnson', avatar: 'AJ', workout: 'Upper Body', time: '08:30 AM', status: 'completed' },
    { id: '2', name: 'Sarah Smith', avatar: 'SS', workout: 'Lower Body', time: '09:00 AM', status: 'completed' },
    { id: '3', name: 'Mike Brown', avatar: 'MB', workout: 'Full Body', time: '10:30 AM', status: 'in-progress' },
    { id: '4', name: 'Emma Davis', avatar: 'ED', workout: 'Cardio', time: '11:00 AM', status: 'in-progress' },
    { id: '5', name: 'John Wilson', avatar: 'JW', workout: 'Push Day', time: '02:00 PM', status: 'scheduled' },
    { id: '6', name: 'Lisa Anderson', avatar: 'LA', workout: 'Pull Day', time: '03:30 PM', status: 'scheduled' },
    { id: '7', name: 'David Lee', avatar: 'DL', workout: 'Leg Day', time: '04:00 PM', status: 'scheduled' },
    { id: '8', name: 'Maria Garcia', avatar: 'MG', workout: 'Upper Body', time: '05:00 PM', status: 'scheduled' }
  ];

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white">
      <div className="border-b border-gray-800 p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-4">
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="text-2xl font-bold">Today's Activity</h1>
        <p className="text-gray-400 text-sm">{activities.length} clients active today</p>
      </div>

      <div className="p-4 space-y-3">
        {activities.map(activity => (
          <div key={activity.id} className="bg-[#242424] rounded-lg p-4 hover:bg-[#2A2A2A] transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#BFFF00]/20 flex items-center justify-center">
                  <span className="font-bold">{activity.avatar}</span>
                </div>
                <div>
                  <p className="font-semibold">{activity.name}</p>
                  <p className="text-sm text-gray-400">{activity.workout}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                  <Clock size={14} />
                  {activity.time}
                </div>
                <span className={`text-xs px-3 py-1 rounded-full ${
                  activity.status === 'completed' 
                    ? 'bg-green-500/20 text-green-500' 
                    : activity.status === 'in-progress'
                    ? 'bg-yellow-500/20 text-yellow-500'
                    : 'bg-blue-500/20 text-blue-500'
                }`}>
                  {activity.status === 'completed' ? 'Completed' : activity.status === 'in-progress' ? 'In Progress' : 'Scheduled'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
