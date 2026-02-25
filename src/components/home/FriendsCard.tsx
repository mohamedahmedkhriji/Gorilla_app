import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Users, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';

interface FriendsCardProps {
  onClick: () => void;
}

interface FriendProfile {
  id: number;
  name: string;
  profile_picture?: string | null;
}

export function FriendsCard({ onClick }: FriendsCardProps) {
  const [friends, setFriends] = useState<FriendProfile[]>([]);

  useEffect(() => {
    const loadFriends = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
        if (!user?.id) return;

        const response = await api.getGymMembers(user.id);
        const members = Array.isArray(response?.members) ? response.members : [];
        setFriends(members);
      } catch (error) {
        console.error('Failed to load friends:', error);
      }
    };

    loadFriends();
  }, []);

  const visibleFriends = friends.slice(0, 3);
  const hiddenCount = Math.max(0, friends.length - visibleFriends.length);

  const getInitials = (name: string) =>
    String(name || '')
      .split(' ')
      .filter(Boolean)
      .map((n: string) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <Card
      onClick={onClick}
      className="p-4 flex flex-col justify-between h-full cursor-pointer border border-accent/30 hover:border-accent transition-colors group">

      <div className="flex justify-between items-start">
        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent group-hover:shadow-glow transition-all">
          <Users size={20} />
        </div>
        <ChevronRight
          size={16}
          className="text-text-tertiary group-hover:text-white transition-colors" />

      </div>

      <div className="mt-4">
        <div className="text-2xl font-bold text-white">{friends.length}</div>
        <div className="text-xs text-text-secondary font-medium uppercase tracking-wider">
          Friends
        </div>
      </div>

      <div className="flex -space-x-2 mt-3">
        {visibleFriends.map((friend) =>
        <div
          key={friend.id}
          className="w-6 h-6 rounded-full bg-white/10 border border-card overflow-hidden flex items-center justify-center text-[8px] text-white">
            {friend.profile_picture ? (
              <img
                src={friend.profile_picture}
                alt={`${friend.name} profile`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{getInitials(friend.name)}</span>
            )}
          </div>

        )}
        {hiddenCount > 0 && (
          <div className="w-6 h-6 rounded-full bg-white/5 border border-card flex items-center justify-center text-[8px] text-text-secondary">
            +{hiddenCount}
          </div>
        )}
      </div>
    </Card>);

}
