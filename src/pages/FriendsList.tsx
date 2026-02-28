import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../components/ui/Header';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Search, Trophy, ChevronRight } from 'lucide-react';
import { api } from '../services/api';

interface FriendsListProps {
  onBack: () => void;
  onFriendClick: (friend: FriendMember) => void;
}

export interface FriendMember {
  id: number | string;
  name: string;
  gym_id?: number | string | null;
  profile_picture?: string | null;
  total_points?: number | string;
  total_workouts?: number | string;
  rank?: string;
}

const rankScore = (rank: unknown) => {
  const value = String(rank || '').trim().toLowerCase();
  if (value === 'elite') return 6;
  if (value === 'diamond') return 5;
  if (value === 'platinum') return 4;
  if (value === 'gold') return 3;
  if (value === 'silver') return 2;
  if (value === 'bronze') return 1;
  return 0;
};

const toPositiveInt = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const toNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

export function FriendsList({ onBack, onFriendClick }: FriendsListProps) {
  const [members, setMembers] = useState<FriendMember[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'gym' | 'rank'>('all');
  const [userGymId, setUserGymId] = useState<number | null>(null);

  const isUsableProfileImage = (value: unknown) => {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    return (
      trimmed.startsWith('data:image/')
      || trimmed.startsWith('http://')
      || trimmed.startsWith('https://')
      || trimmed.startsWith('/')
    );
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    setUserGymId(toPositiveInt(user.gym_id));

    if (user.id) {
      api.getGymMembers(user.id).then((data: { members?: FriendMember[] }) => {
        if (!Array.isArray(data?.members)) return;

        const normalizedMembers = data.members.map((member) => ({
          ...member,
          gym_id: toPositiveInt(member.gym_id),
          total_points: toNonNegativeNumber(member.total_points),
          total_workouts: toNonNegativeNumber(member.total_workouts),
        }));
        setMembers(normalizedMembers);
      });
    }
  }, []);

  const allCount = members.length;
  const gymCount = useMemo(
    () => members.filter((member) => Number(member.gym_id || 0) === Number(userGymId || 0)).length,
    [members, userGymId],
  );

  const filteredMembers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const searched = members.filter((member) => member.name.toLowerCase().includes(normalizedSearch));

    if (filter === 'gym') {
      if (!userGymId) return [];
      return searched.filter((member) => Number(member.gym_id || 0) === userGymId);
    }

    if (filter === 'rank') {
      return [...searched].sort((a, b) => {
        const pointsDelta = toNonNegativeNumber(b.total_points) - toNonNegativeNumber(a.total_points);
        if (pointsDelta !== 0) return pointsDelta;

        const workoutsDelta = toNonNegativeNumber(b.total_workouts) - toNonNegativeNumber(a.total_workouts);
        if (workoutsDelta !== 0) return workoutsDelta;

        return rankScore(b.rank) - rankScore(a.rank);
      });
    }

    return searched;
  }, [filter, members, search, userGymId]);

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-6 pt-2">
        <Header title="Friends" onBack={onBack} />
      </div>

      <div className="px-6 mb-4">
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all' ? 'bg-accent text-black' : 'bg-card text-text-secondary border border-white/10'
            }`}
          >
            All ({allCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('gym')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'gym' ? 'bg-accent text-black' : 'bg-card text-text-secondary border border-white/10'
            }`}
          >
            My Gym ({gymCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('rank')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'rank' ? 'bg-accent text-black' : 'bg-card text-text-secondary border border-white/10'
            }`}
          >
            Top Rank
          </button>
        </div>
      </div>

      <div className="px-6 mb-6 relative">
        <Input
          placeholder="Search friends..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Search
          className="absolute left-10 top-1/2 -translate-y-1/2 text-text-tertiary"
          size={18}
        />
      </div>

      <div className="px-6 space-y-4">
        {filteredMembers.map((member) => (
          <Card
            key={member.id}
            onClick={() => onFriendClick(member)}
            className="p-4 flex items-center gap-4 cursor-pointer border border-accent/30 hover:border-accent transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center font-bold text-white">
              {isUsableProfileImage(member.profile_picture) ? (
                <img
                  src={String(member.profile_picture)}
                  alt={`${member.name} profile`}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                member.name.split(' ').map((n: string) => n[0]).join('')
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white">{member.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                  <Trophy size={10} /> {member.rank || 'Member'}
                </span>
                <span className="text-xs text-text-tertiary">
                  - {toNonNegativeNumber(member.total_workouts)} workouts
                </span>
              </div>
            </div>
            <ChevronRight size={20} className="text-text-tertiary" />
          </Card>
        ))}

        {filteredMembers.length === 0 && (
          <Card className="p-4 text-sm text-text-secondary border border-white/10">
            No friends found for this filter.
          </Card>
        )}
      </div>
    </div>
  );
}
