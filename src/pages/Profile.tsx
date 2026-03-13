import React, { useEffect, useMemo, useState } from 'react';
import { ProfileScreen } from '../components/profile/ProfileScreen';
import { GymAccessScreen } from '../components/profile/GymAccessScreen';
import { RankingsRewardsScreen } from '../components/profile/RankingsRewardsScreen';
import { SettingsScreen } from '../components/profile/SettingsScreen';
import { CurrentWeekPlanScreen } from '../components/profile/CurrentWeekPlanScreen';
import { CustomPlanBuilderScreen } from '../components/profile/CustomPlanBuilderScreen';
import { PresetProgramScreen } from '../components/profile/PresetProgramScreen';
import { MyPostsScreen } from '../components/profile/MyPostsScreen';
import { NotificationsScreen } from '../components/notifications/NotificationsScreen';
import { FriendsList, FriendMember } from './FriendsList';
import { FriendProfile } from './FriendProfile';
import { CoachList } from './CoachList';
import { Messaging } from './Messaging';
import { api } from '../services/api';
import { ArrowLeft, Bell, Settings } from 'lucide-react';
import { useScrollToTopOnChange } from '../shared/scroll';
interface ProfileProps {
  onNavigateTab?: (tab: string, day?: string) => void;
  resetSignal?: number;
}
export function Profile({ onNavigateTab, resetSignal = 0 }: ProfileProps) {
  const [view, setView] = useState<
    'main' | 'gym' | 'rank' | 'settings' | 'notifications' | 'weeklyPlan' | 'presetPlans' | 'customPlanBuilder' | 'posts' | 'friends' | 'friendProfile' | 'friendChallenge' | 'coachList' | 'chat'>(
    'main');
  const [selectedFriend, setSelectedFriend] = useState<FriendMember | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<{id: number, name: string} | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useScrollToTopOnChange([view, resetSignal]);

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

  useEffect(() => {
    setView('main');
    setSelectedFriend(null);
    setSelectedCoach(null);
  }, [resetSignal]);

  const handleNavigate = (screen: 'gym' | 'rank' | 'settings' | 'workout' | 'weeklyPlan' | 'customPlanBuilder' | 'posts' | 'friends' | 'coachList') => {
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
    if (screen === 'friends') {
      setView('friends');
      return;
    }
    if (screen === 'coachList') {
      setView('coachList');
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
  return <SettingsScreen onBack={() => setView('main')} onOpenGym={() => setView('gym')} />;
  if (view === 'notifications')
  return <NotificationsScreen onBack={() => setView('main')} />;
  if (view === 'weeklyPlan')
  return (
    <CurrentWeekPlanScreen
      onBack={() => setView('main')}
      onOpenWorkout={() => onNavigateTab?.('workout')}
      onCreateCustom={() => setView('presetPlans')}
    />
  );
  if (view === 'presetPlans')
  return (
    <PresetProgramScreen
      onBack={() => setView('weeklyPlan')}
      onSaved={() => onNavigateTab?.('workout')}
      onBuildCustom={() => setView('customPlanBuilder')}
    />
  );
  if (view === 'customPlanBuilder')
  return (
    <CustomPlanBuilderScreen
      onBack={() => setView('presetPlans')}
      onSaved={() => onNavigateTab?.('workout')}
    />
  );
  if (view === 'posts')
  return <MyPostsScreen onBack={() => setView('main')} />;
  if (view === 'friends')
  return (
    <FriendsList
      onBack={() => setView('main')}
      onFriendClick={(friend) => {
        setSelectedFriend(friend);
        setView('friendProfile');
      }}
    />
  );
  if (view === 'friendProfile')
  return (
    <FriendProfile
      onBack={() => setView('friends')}
      onChallenge={() => setView('friendChallenge')}
      friend={selectedFriend}
    />
  );
  if (view === 'friendChallenge') {
    return (
      <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
        <div className="px-4 sm:px-6 pt-2">
          <button
            type="button"
            onClick={() => setView('friendProfile')}
            className="inline-flex items-center gap-2 rounded-xl surface-glass px-3 py-2 text-sm text-text-primary"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
        <div className="px-4 sm:px-6 pt-8">
          <div className="surface-card rounded-2xl border border-white/10 p-5">
            <h2 className="text-xl font-semibold text-white">Challenge</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Challenge screen placeholder for {selectedFriend?.name || 'this friend'}.
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (view === 'coachList')
  return (
    <CoachList
      onBack={() => setView('main')}
      onSelectCoach={(id, name) => {
        setSelectedCoach({ id, name });
        setView('chat');
      }}
    />
  );
  if (view === 'chat')
  return (
    <Messaging
      onBack={() => setView('coachList')}
      coachId={selectedCoach?.id}
      coachName={selectedCoach?.name}
    />
  );
  return (
    <div className="relative">
      {/* Header action icons */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
        <button
          onClick={() => setView('settings')}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          aria-label="Open settings"
        >
          <Settings size={20} />
        </button>

        <button
          onClick={() => setView('notifications')}
          className="relative w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          aria-label="Open notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-accent text-black text-[10px] font-bold rounded-full flex items-center justify-center shadow-glow">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
        </button>
      </div>

      <div className="space-y-6 pb-24 px-4 sm:px-6">
        <ProfileScreen onNavigate={handleNavigate} onLogout={handleLogout} />
      </div>
    </div>);

}
