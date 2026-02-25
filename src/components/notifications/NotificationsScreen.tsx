import React from 'react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { Dumbbell, Battery, TrendingUp, Trophy, Gift } from 'lucide-react';
interface NotificationsScreenProps {
  onBack: () => void;
}
export function NotificationsScreen({ onBack }: NotificationsScreenProps) {
  const notifications = [
  {
    icon: Dumbbell,
    color: 'text-accent',
    bg: 'bg-accent/10',
    title: 'Workout Reminder',
    msg: 'Time to crush Upper Power!',
    time: '2h ago'
  },
  {
    icon: Battery,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    title: 'Rest Day',
    msg: 'Take it easy today. Recovery is key.',
    time: 'Yesterday'
  },
  {
    icon: TrendingUp,
    color: 'text-accent',
    bg: 'bg-accent/10',
    title: 'Overload Achieved',
    msg: 'You increased your Bench Press volume!',
    time: 'Yesterday'
  },
  {
    icon: Trophy,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    title: 'Rank Up',
    msg: 'You reached Gold Tier!',
    time: '2 days ago'
  },
  {
    icon: Gift,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    title: 'Reward Unlocked',
    msg: 'You earned a 10% discount code.',
    time: '3 days ago'
  }];

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-6 pt-2">
        <Header title="Notifications" onBack={onBack} />
      </div>

      <div className="px-6 space-y-3">
        {notifications.map((notif, i) => {
          const Icon = notif.icon;
          return (
            <Card key={i} className="p-4 flex gap-4">
              <div
                className={`w-10 h-10 rounded-full ${notif.bg} flex items-center justify-center ${notif.color} shrink-0`}>

                <Icon size={20} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-white text-sm">
                    {notif.title}
                  </h4>
                  <span className="text-[10px] text-text-tertiary">
                    {notif.time}
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-1">{notif.msg}</p>
              </div>
            </Card>);

        })}
      </div>
    </div>);

}