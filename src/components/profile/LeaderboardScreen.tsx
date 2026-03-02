import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../ui/Header';
import { Trophy, Medal, Award, User } from 'lucide-react';
import { api } from '../../services/api';

interface LeaderboardScreenProps {
  onBack: () => void;
}

interface LeaderboardUser {
  id: string;
  name: string;
  points: number;
  rank: number;
  level: number;
  profilePicture: string | null;
}

interface LeaderboardApiRow {
  id?: number | string;
  name?: string;
  points?: number | string;
  rank?: number | string;
  profile_picture?: string | null;
}

const getLevelFromPoints = (points: number) => {
  if (points >= 5000) return 5;
  if (points >= 2500) return 4;
  if (points >= 1200) return 3;
  if (points >= 500) return 2;
  return 1;
};

const isValidImageDataUrl = (value: string | null | undefined) =>
  typeof value === 'string' && value.startsWith('data:image/') && value.includes(';base64,');

export function LeaderboardScreen({ onBack }: LeaderboardScreenProps) {
  const [tab, setTab] = useState<'monthly' | 'alltime'>('monthly');
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUser = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  const currentUserId = String(currentUser?.id || '');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      if (!currentUser?.id) {
        setLeaderboard([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await api.getLeaderboard(Number(currentUser.id), tab);
        const normalized = Array.isArray(result?.leaderboard)
          ? result.leaderboard.map((row: LeaderboardApiRow) => {
              const points = Number(row?.points || 0);
              return {
                id: String(row?.id || ''),
                name: row?.name || 'User',
                points,
                rank: Number(row?.rank || 0),
                level: getLevelFromPoints(points),
                profilePicture: isValidImageDataUrl(row?.profile_picture) ? row.profile_picture : null,
              };
            })
          : [];
        setLeaderboard(normalized);
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
        setError('Failed to load leaderboard');
        setLeaderboard([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [currentUser?.id, tab]);

  const maxPoints = useMemo(
    () => (leaderboard.length ? Math.max(...leaderboard.map((u) => u.points)) : 0),
    [leaderboard],
  );

  const getBarWidth = (points: number) => (maxPoints > 0 ? (points / maxPoints) * 100 : 0);

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
    <div className="flex-1 flex flex-col min-h-screen bg-background pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title="Leaderboard" onBack={onBack} />
      </div>

      <div className="px-4 sm:px-6 pt-4">
        <div className="flex gap-2 mb-6 bg-card rounded-xl p-1 border border-white/5">
          <button
            onClick={() => setTab('monthly')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === 'monthly' ? 'bg-accent text-black' : 'text-text-secondary'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setTab('alltime')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === 'alltime' ? 'bg-accent text-black' : 'text-text-secondary'
            }`}
          >
            All Time
          </button>
        </div>

        {loading && <p className="text-sm text-text-secondary">Loading leaderboard...</p>}
        {!loading && error && <p className="text-sm text-red-400">{error}</p>}
        {!loading && !error && leaderboard.length === 0 && (
          <p className="text-sm text-text-secondary">No leaderboard data found.</p>
        )}

        {!loading && !error && leaderboard.length > 0 && (
          <div className="space-y-3">
            {leaderboard.map((user) => (
              <div
                key={user.id}
                className={`rounded-xl p-4 border-2 ${
                  user.id === currentUserId ? 'bg-accent/5 border-accent' : `bg-card ${getCardBorder(user.rank)}`
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 flex items-center justify-center">
                    {user.rank === 1 && <Trophy className="text-yellow-500" size={20} />}
                    {user.rank === 2 && <Medal className="text-gray-400" size={20} />}
                    {user.rank === 3 && <Award className="text-orange-600" size={20} />}
                    {user.rank > 3 && <span className="text-text-secondary font-bold text-sm">#{user.rank}</span>}
                  </div>

                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl overflow-hidden">
                    {user.profilePicture ? (
                      <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={20} className="text-text-tertiary" />
                    )}
                  </div>

                  <div className="flex-1">
                    <h4 className={`font-bold text-sm ${user.id === currentUserId ? 'text-accent' : 'text-white'}`}>
                      {user.name}
                    </h4>
                    <p className="text-xs text-text-secondary">Level {user.level}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-white">{user.points}</p>
                    <p className="text-xs text-text-secondary">pts</p>
                  </div>
                </div>

                <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${getBarColor(user.rank)} rounded-full transition-all duration-500`}
                    style={{ width: `${getBarWidth(user.points)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

