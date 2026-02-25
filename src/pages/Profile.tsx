import React, { useState } from 'react';
import { ProfileScreen } from '../components/profile/ProfileScreen';
import { GymAccessScreen } from '../components/profile/GymAccessScreen';
import { RankingsRewardsScreen } from '../components/profile/RankingsRewardsScreen';
import { SettingsScreen } from '../components/profile/SettingsScreen';
import { WorkoutHistory } from '../components/profile/WorkoutHistory';
import { NotificationsScreen } from '../components/notifications/NotificationsScreen';
import { Bell } from 'lucide-react';
export function Profile() {
  const [view, setView] = useState<
    'main' | 'gym' | 'rank' | 'settings' | 'notifications'>(
    'main');

  const handleLogout = () => {
    localStorage.removeItem('appUser');
    localStorage.removeItem('appUserId');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    window.location.href = '/login';
  };
  if (view === 'gym') return <GymAccessScreen onBack={() => setView('main')} />;
  if (view === 'rank')
  return <RankingsRewardsScreen onBack={() => setView('main')} />;
  if (view === 'settings')
  return <SettingsScreen onBack={() => setView('main')} onLogout={handleLogout} />;
  if (view === 'notifications')
  return <NotificationsScreen onBack={() => setView('main')} />;
  return (
    <div className="relative">
      {/* Notification Bell Overlay */}
      <button
        onClick={() => setView('notifications')}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10">

        <Bell size={20} />
        <div className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full shadow-glow" />
      </button>

      <div className="space-y-6 pb-24">
        <ProfileScreen onNavigate={setView} />
      </div>
    </div>);

}
