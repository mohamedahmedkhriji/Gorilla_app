import React, { useState, useEffect } from 'react';
import { Header } from '../ui/Header';
import { Trophy, Medal, Award, User } from 'lucide-react';
import { api } from '../../services/api';

interface LeaderboardScreenProps {
  onBack: () => void;
}

interface LeaderboardUser {
  id: string;
  name: string;
  avatar: string;
  profilePicture?: string;
  points: number;
  rank: number;
  level: number;
}

const getLevelFromPoints = (points: number) => {
  if (points >= 5000) return 5;
  if (points >= 2500) return 4;
  if (points >= 1200) return 3;
  if (points >= 500) return 2;
  return 1;
};

export function LeaderboardScreen({ onBack }: LeaderboardScreenProps) {
  const [tab, setTab] = useState<'week' | 'alltime'>('week');
  const currentUser = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const currentUserId = currentUser.id;
  const [currentUserProfilePicture, setCurrentUserProfilePicture] = useState<string | null>(null);
  const isValidImageDataUrl = (value: string | null | undefined) =>
    typeof value === 'string' && value.startsWith('data:image/') && value.includes(';base64,');
  
  useEffect(() => {
    const fetchCurrentUserProfilePicture = async () => {
      if (currentUserId) {
        try {
          const result = await api.getProfilePicture(currentUserId);
          setCurrentUserProfilePicture(isValidImageDataUrl(result.profilePicture) ? result.profilePicture : null);
        } catch (error) {
          console.error('Failed to load leaderboard profile picture:', error);
          setCurrentUserProfilePicture(null);
        }
      }
    };
    fetchCurrentUserProfilePicture();
  }, [currentUserId]);
  
  const [leaderboard] = useState<LeaderboardUser[]>([
    { id: '1', name: 'You', avatar: '👤', points: 1800, rank: 1, level: getLevelFromPoints(1800) },
    { id: '2', name: 'Alex Johnson', avatar: '👤', points: 1320, rank: 2, level: getLevelFromPoints(1320) },
    { id: '3', name: 'Sarah FitQueen', avatar: '👤', points: 980, rank: 3, level: getLevelFromPoints(980) },
    { id: '4', name: 'Mike Beast', avatar: '👤', points: 750, rank: 4, level: getLevelFromPoints(750) },
    { id: '5', name: 'Emma Strong', avatar: '👤', points: 620, rank: 5, level: getLevelFromPoints(620) },
    { id: '6', name: 'David Power', avatar: '👤', points: 480, rank: 6, level: getLevelFromPoints(480) },
    { id: '7', name: 'Lisa Gains', avatar: '👤', points: 350, rank: 7, level: getLevelFromPoints(350) },
    { id: '8', name: 'Tom Lifter', avatar: '👤', points: 280, rank: 8, level: getLevelFromPoints(280) },
  ]);

  const maxPoints = Math.max(...leaderboard.map(u => u.points));
  
  const getBarWidth = (points: number) => {
    return (points / maxPoints) * 100;
  };
  
  const getBarColor = (rank: number) => {
    if (rank === 1) return 'from-red-500 to-orange-500';
    if (rank === 2) return 'from-orange-500 to-yellow-500';
    if (rank === 3) return 'from-yellow-500 to-yellow-400';
    return 'from-gray-500 to-gray-600';
  };

  const getCardBorder = (rank: number) => {
    if (rank === 1) return 'border-yellow-500';
    if (rank === 2) return 'border-gray-400';
    if (rank === 3) return 'border-gray-400';
    return 'border-white/5';
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background pb-24">
      <div className="px-6 pt-2">
        <Header title="Leaderboard" onBack={onBack} />
      </div>

      <div className="px-6 pt-4">
        {/* Toggle Tabs */}
        <div className="flex gap-2 mb-6 bg-card rounded-xl p-1 border border-white/5">
          <button
            onClick={() => setTab('week')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === 'week' ? 'bg-accent text-black' : 'text-text-secondary'
            }`}>
            This Week
          </button>
          <button
            onClick={() => setTab('alltime')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === 'alltime' ? 'bg-accent text-black' : 'text-text-secondary'
            }`}>
            All Time
          </button>
        </div>

        <div className="space-y-3">
          {leaderboard.map((user) => (
            <div
              key={user.id}
              className={`rounded-xl p-4 border-2 ${
                user.id === String(currentUserId)
                  ? 'bg-accent/5 border-accent'
                  : `bg-card ${getCardBorder(user.rank)}`
              }`}>
              <div className="flex items-center gap-3 mb-3">
                {/* Rank */}
                <div className="w-8 flex items-center justify-center">
                  {user.rank === 1 && <Trophy className="text-yellow-500" size={20} />}
                  {user.rank === 2 && <Medal className="text-gray-400" size={20} />}
                  {user.rank === 3 && <Award className="text-orange-600" size={20} />}
                  {user.rank > 3 && <span className="text-text-secondary font-bold text-sm">#{user.rank}</span>}
                </div>
                
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl overflow-hidden">
                  {user.id === String(currentUserId) && currentUserProfilePicture ? (
                    <img src={currentUserProfilePicture} alt="Profile" className="w-full h-full object-cover" />
                  ) : user.id === String(currentUserId) ? (
                    <User size={20} className="text-text-tertiary" />
                  ) : (
                    user.avatar
                  )}
                </div>
                
                {/* Name & Level */}
                <div className="flex-1">
                  <h4 className={`font-bold text-sm ${user.id === String(currentUserId) ? 'text-accent' : 'text-white'}`}>
                    {user.name}
                  </h4>
                  <p className="text-xs text-text-secondary">Level {user.level}</p>
                </div>

                {/* Points */}
                <div className="text-right">
                  <p className="text-lg font-bold text-white">{user.points}</p>
                  <p className="text-xs text-text-secondary">pts</p>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${getBarColor(user.rank)} rounded-full transition-all duration-500`}
                  style={{ width: `${getBarWidth(user.points)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
