import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { ChevronRight } from 'lucide-react';
import { api } from '../../services/api';
import { emojiFriends } from '../../services/emojiTheme';

interface FriendsCardProps {
  onClick: () => void;
}

interface FriendProfile {
  id: number;
  name: string;
  profile_picture?: string | null;
  friend_status?: string;
}

const toFriendStatus = (value: unknown) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'accepted') return 'accepted';
  if (raw === 'outgoing_pending') return 'outgoing_pending';
  if (raw === 'incoming_pending') return 'incoming_pending';
  return 'none';
};

const getActiveUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const fallbackId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
    const userId = Number(user?.id || fallbackId || 0);
    return Number.isInteger(userId) && userId > 0 ? userId : 0;
  } catch {
    return 0;
  }
};

export function FriendsCard({ onClick }: FriendsCardProps) {
  const [friends, setFriends] = useState<FriendProfile[]>([]);

  useEffect(() => {
    const loadFriends = async () => {
      try {
        const userId = getActiveUserId();
        if (!userId) return;

        const response = await api.getGymMembers(userId);
        const members = Array.isArray(response?.members) ? response.members : [];
        const acceptedFriends = members.filter((member) => toFriendStatus(member?.friend_status) === 'accepted');
        setFriends(acceptedFriends);
      } catch (error) {
        console.error('Failed to load friends:', error);
      }
    };

    void loadFriends();
    const refresh = window.setInterval(() => {
      void loadFriends();
    }, 10000);
    const handleFriendsUpdated = () => {
      void loadFriends();
    };
    window.addEventListener('friends-updated', handleFriendsUpdated);
    return () => {
      window.clearInterval(refresh);
      window.removeEventListener('friends-updated', handleFriendsUpdated);
    };
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
    <Card onClick={onClick} className="p-4 flex flex-col justify-between h-full cursor-pointer border border-white/15 hover:border-accent/35 transition-colors group">
      <div className="flex justify-between items-start">
        <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/35 flex items-center justify-center text-accent group-hover:shadow-glow transition-all">
          <img src={emojiFriends} alt="Friends" className="h-7 w-7 object-contain" />
        </div>
        <ChevronRight size={16} className="text-text-tertiary group-hover:text-text-primary transition-colors" />
      </div>

      <div className="mt-4">
        <div className="text-2xl font-electrolize leading-none text-white">Friends</div>
      </div>

      <div className="flex -space-x-2 mt-3">
        {visibleFriends.map((friend) => (
          <div
            key={friend.id}
            className="w-7 h-7 rounded-full bg-white/10 border border-card overflow-hidden flex items-center justify-center text-[9px] text-white"
          >
            {friend.profile_picture ? (
              <img src={friend.profile_picture} alt={`${friend.name} profile`} className="w-full h-full object-cover" />
            ) : (
              <span>{getInitials(friend.name)}</span>
            )}
          </div>
        ))}
        {hiddenCount > 0 && <div className="w-7 h-7 rounded-full bg-white/5 border border-card flex items-center justify-center text-[9px] text-text-secondary">+{hiddenCount}</div>}
      </div>
    </Card>
  );
}
