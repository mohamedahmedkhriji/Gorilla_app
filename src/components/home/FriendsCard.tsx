import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { api } from '../../services/api';
import { emojiFriends, emojiGymFriendsBg, emojiRightArrow } from '../../services/emojiTheme';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';

interface FriendsCardProps {
  onClick: () => void;
  coachmarkTargetId?: string;
}

interface FriendProfile {
  id: number;
  name: string;
  profile_picture?: string | null;
  friend_status?: string;
}

const FRIENDS_CARD_I18N = {
  en: {
    friends: 'Friends',
    friendsLogoAlt: 'Friends',
    profileSuffix: 'profile',
  },
  ar: {
    friends: 'الأصدقاء',
    friendsLogoAlt: 'الأصدقاء',
    profileSuffix: 'الملف الشخصي',
  },
  it: {
    friends: 'Amici',
    friendsLogoAlt: 'Amici',
    profileSuffix: 'profilo',
  },
  fr: {
    friends: 'Amis',
    friendsLogoAlt: 'Amis',
    profileSuffix: 'profil',
  },
  de: {
    friends: 'Freunde',
    friendsLogoAlt: 'Freunde',
    profileSuffix: 'Profil',
  },
} as const;

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

export function FriendsCard({ onClick, coachmarkTargetId }: FriendsCardProps) {
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const copy = FRIENDS_CARD_I18N[language as keyof typeof FRIENDS_CARD_I18N] || FRIENDS_CARD_I18N.en;

  useEffect(() => {
    setLanguage(getActiveLanguage());

    const handleLanguageChanged = () => {
      setLanguage(getStoredLanguage());
    };

    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('storage', handleLanguageChanged);
    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('storage', handleLanguageChanged);
    };
  }, []);

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
    <Card
      onClick={onClick}
      coachmarkTargetId={coachmarkTargetId}
      className="relative h-full cursor-pointer overflow-hidden rounded-[24px] border border-white/10 p-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-white/[0.03] transition-all duration-300 group hover:-translate-y-1 hover:border-accent/25 active:scale-[0.985]"
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-50 transition-transform duration-300 group-hover:scale-105"
        style={{ backgroundImage: `url(${emojiGymFriendsBg})` }}
      />
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(205,255,88,0.14),transparent_30%),linear-gradient(180deg,rgba(7,11,17,0.28),rgba(7,11,17,0.74))]" />

      <div className="relative z-10 flex justify-between items-start">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-[18px] border border-accent/20 bg-white/[0.08] text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] transition-all duration-300 group-hover:border-accent/35">
          <div className="absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <img src={emojiFriends} alt={copy.friendsLogoAlt} className="h-7 w-7 object-contain" />
        </div>
        <img src={emojiRightArrow} alt="" aria-hidden="true" className="h-4 w-4 object-contain opacity-70 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
      </div>

      <div className="relative z-10 mt-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/52">Community</div>
        <div className="mt-2 text-[22px] font-semibold leading-none tracking-[-0.03em] text-white">{copy.friends}</div>
      </div>

      <div className="relative z-10 flex -space-x-2 mt-3">
        {visibleFriends.map((friend) => (
          <div
            key={friend.id}
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[#11161f] bg-white/10 text-[9px] text-white shadow-[0_8px_16px_-12px_rgba(0,0,0,0.8)]"
          >
            {friend.profile_picture ? (
              <img src={friend.profile_picture} alt={`${friend.name} ${copy.profileSuffix}`} className="w-full h-full object-cover" />
            ) : (
              <span>{getInitials(friend.name)}</span>
            )}
          </div>
        ))}
        {hiddenCount > 0 && <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#11161f] bg-white/[0.06] text-[9px] text-text-secondary">+{hiddenCount}</div>}
      </div>
    </Card>
  );
}
