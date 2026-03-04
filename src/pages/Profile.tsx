import React, { useEffect, useMemo, useState } from 'react';
import { ProfileScreen } from '../components/profile/ProfileScreen';
import { GymAccessScreen } from '../components/profile/GymAccessScreen';
import { RankingsRewardsScreen } from '../components/profile/RankingsRewardsScreen';
import { SettingsScreen } from '../components/profile/SettingsScreen';
import { CurrentWeekPlanScreen } from '../components/profile/CurrentWeekPlanScreen';
import { CustomPlanBuilderScreen } from '../components/profile/CustomPlanBuilderScreen';
import { MyPostsScreen } from '../components/profile/MyPostsScreen';
import { NotificationsScreen } from '../components/notifications/NotificationsScreen';
import { api } from '../services/api';
import { Bell } from 'lucide-react';
interface ProfileProps {
  onNavigateTab?: (tab: string, day?: string) => void;
}
export function Profile({ onNavigateTab }: ProfileProps) {
  const [view, setView] = useState<
    'main' | 'gym' | 'rank' | 'settings' | 'notifications' | 'weeklyPlan' | 'customPlanBuilder' | 'posts'>(
    'main');
  const [unreadCount, setUnreadCount] = useState(0);

  const userId = useMemo(() => {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    return Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || user?.id || 0);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refreshUnread = async () => {
      if (!userId) {
        if (!cancelled) setUnreadCount(0);
        return;
      }
      try {
        const notifications = await api.getNotifications(userId);
        if (cancelled) return;
        const count = Array.isArray(notifications)
          ? notifications.filter((item: any) => Boolean(item?.unread)).length
          : 0;
        setUnreadCount(count);
      } catch (error) {
        if (!cancelled) setUnreadCount(0);
      }
    };

    void refreshUnread();
    const timer = window.setInterval(() => {
      void refreshUnread();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [userId, view]);

  const handleNavigate = (screen: 'gym' | 'rank' | 'settings' | 'workout' | 'weeklyPlan' | 'customPlanBuilder' | 'posts') => {
    if (screen === 'workout') {
      onNavigateTab?.('workout');
      return;
    }
    if (screen === 'weeklyPlan') {
      setView('weeklyPlan');
      return;
    }
    if (screen === 'customPlanBuilder') {
      setView('customPlanBuilder');
      return;
    }
    if (screen === 'posts') {
      setView('posts');
      return;
    }
    setView(screen);
  };

  const handleLogout = () => {
    localStorage.removeItem('appUser');
    localStorage.removeItem('appUserId');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    window.location.href = '/';
  };
  if (view === 'gym') return <GymAccessScreen onBack={() => setView('main')} />;
  if (view === 'rank')
  return <RankingsRewardsScreen onBack={() => setView('main')} />;
  if (view === 'settings')
  return <SettingsScreen onBack={() => setView('main')} onLogout={handleLogout} />;
  if (view === 'notifications')
  return <NotificationsScreen onBack={() => setView('main')} />;
  if (view === 'weeklyPlan')
  return (
    <CurrentWeekPlanScreen
      onBack={() => setView('main')}
      onOpenWorkout={() => onNavigateTab?.('workout')}
      onCreateCustom={() => setView('customPlanBuilder')}
    />
  );
  if (view === 'customPlanBuilder')
  return (
    <CustomPlanBuilderScreen
      onBack={() => setView('weeklyPlan')}
      onSaved={() => onNavigateTab?.('workout')}
    />
  );
  if (view === 'posts')
  return <MyPostsScreen onBack={() => setView('main')} />;
  return (
    <div className="relative">
      {/* Notification Bell Overlay */}
      <button
        onClick={() => setView('notifications')}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10">

        <Bell size={20} />
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-accent text-black text-[10px] font-bold rounded-full flex items-center justify-center shadow-glow">
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </button>

      <div className="space-y-6 pb-24 px-4 sm:px-6">
        <ProfileScreen onNavigate={handleNavigate} />
      </div>
    </div>);

}
