import React from 'react';
import { ArrowLeft, Bell, MessageSquare, Calendar, TrendingUp } from 'lucide-react';

interface NotificationsProps {
  onBack: () => void;
}

export const Notifications: React.FC<NotificationsProps> = ({ onBack }) => {
  const notifications = [
    { id: '1', type: 'message', from: 'Alex Johnson', text: 'Thanks for the tips!', time: '5 min ago', unread: true },
    { id: '2', type: 'message', from: 'Mike Brown', text: 'Form check please', time: '15 min ago', unread: true },
    { id: '3', type: 'session', from: 'Emma Davis', text: 'Requested session reschedule', time: '1 hour ago', unread: false },
    { id: '4', type: 'achievement', from: 'John Wilson', text: 'Completed 30-day streak!', time: '2 hours ago', unread: false },
    { id: '5', type: 'message', from: 'Sarah Smith', text: 'Can we adjust my plan?', time: '3 hours ago', unread: false }
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageSquare size={20} className="text-blue-500" />;
      case 'session': return <Calendar size={20} className="text-purple-500" />;
      case 'achievement': return <TrendingUp size={20} className="text-green-500" />;
      default: return <Bell size={20} className="text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white">
      <div className="border-b border-gray-800 p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 mb-4">
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-gray-400 text-sm">{notifications.filter(n => n.unread).length} unread notifications</p>
      </div>

      <div className="p-4 space-y-2">
        {notifications.map(notification => (
          <div 
            key={notification.id} 
            className={`bg-[#242424] rounded-lg p-4 hover:bg-[#2A2A2A] transition-colors cursor-pointer ${
              notification.unread ? 'border-l-4 border-[#BFFF00]' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">{getIcon(notification.type)}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold">{notification.from}</p>
                  <span className="text-xs text-gray-400">{notification.time}</span>
                </div>
                <p className="text-sm text-gray-400">{notification.text}</p>
              </div>
              {notification.unread && (
                <div className="w-2 h-2 bg-[#BFFF00] rounded-full mt-2" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
