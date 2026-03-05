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

export type FriendRelationshipStatus =
  | 'accepted'
  | 'outgoing_pending'
  | 'incoming_pending'
  | 'none';

export interface FriendMember {
  id: number | string;
  name: string;
  gym_id?: number | string | null;
  profile_picture?: string | null;
  total_points?: number | string;
  total_workouts?: number | string;
  rank?: string;
  friend_status?: FriendRelationshipStatus;
  friendship_id?: number | string | null;
  can_view_profile?: boolean;
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

const toFriendStatus = (value: unknown): FriendRelationshipStatus => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'accepted') return 'accepted';
  if (raw === 'outgoing_pending') return 'outgoing_pending';
  if (raw === 'incoming_pending') return 'incoming_pending';
  return 'none';
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const getActiveUserId = () => {
  const user = readStoredUser();
  const fallbackId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
  const userId = toPositiveInt(user?.id) || toPositiveInt(fallbackId) || 0;
  return Number(userId || 0);
};

const normalizeMember = (member: FriendMember): FriendMember => {
  const friendStatus = toFriendStatus(member.friend_status);
  return {
    ...member,
    gym_id: toPositiveInt(member.gym_id),
    total_points: toNonNegativeNumber(member.total_points),
    total_workouts: toNonNegativeNumber(member.total_workouts),
    friend_status: friendStatus,
    friendship_id: toPositiveInt(member.friendship_id),
    can_view_profile: friendStatus === 'accepted',
  };
};

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

export function FriendsList({ onBack, onFriendClick }: FriendsListProps) {
  const [members, setMembers] = useState<FriendMember[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'friends' | 'requests' | 'rank'>('friends');
  const [activeUserId, setActiveUserId] = useState<number>(0);
  const [busyMemberId, setBusyMemberId] = useState<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const loadMembers = async () => {
      const userId = getActiveUserId();
      setActiveUserId(userId);
      if (!userId) return;

      try {
        const data = await api.getGymMembers(userId);
        const rawMembers = Array.isArray(data?.members) ? data.members : [];
        setMembers(rawMembers.map((member: FriendMember) => normalizeMember(member)));
      } catch (error) {
        console.error('Failed to load gym members:', error);
      }
    };

    void loadMembers();
    const refresh = window.setInterval(() => {
      void loadMembers();
    }, 10000);
    return () => window.clearInterval(refresh);
  }, [refreshTick]);

  useEffect(() => {
    const handleFriendsUpdated = () => {
      setRefreshTick((prev) => prev + 1);
    };
    window.addEventListener('friends-updated', handleFriendsUpdated);
    return () => window.removeEventListener('friends-updated', handleFriendsUpdated);
  }, []);

  const allCount = members.length;
  const friendsCount = useMemo(
    () => members.filter((member) => toFriendStatus(member.friend_status) === 'accepted').length,
    [members],
  );
  const requestsCount = useMemo(
    () => members.filter((member) => toFriendStatus(member.friend_status) === 'incoming_pending').length,
    [members],
  );

  const filteredMembers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const searched = members.filter((member) => member.name.toLowerCase().includes(normalizedSearch));

    if (filter === 'requests') {
      return searched.filter((member) => toFriendStatus(member.friend_status) === 'incoming_pending');
    }

    if (filter === 'friends') {
      return searched.filter((member) => toFriendStatus(member.friend_status) === 'accepted');
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
  }, [filter, members, search]);

  const updateMemberById = (memberId: number, updater: (member: FriendMember) => FriendMember) => {
    setMembers((prev) => prev.map((member) => (
      Number(member.id) === memberId ? updater(member) : member
    )));
  };

  const handleSendInvite = async (member: FriendMember) => {
    const memberId = toPositiveInt(member.id);
    if (!activeUserId || !memberId) return;

    setBusyMemberId(memberId);
    try {
      const response = await api.sendFriendRequest(activeUserId, memberId);
      const friendshipId = toPositiveInt(response?.friendshipId);
      updateMemberById(memberId, (current) => ({
        ...current,
        friend_status: 'outgoing_pending',
        friendship_id: friendshipId || toPositiveInt(current.friendship_id),
        can_view_profile: false,
      }));

      if (response?.alreadyPending) {
        alert('Invitation already sent and still pending.');
      } else {
        alert('Friend invitation sent.');
      }
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to send invitation.'));
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleRespond = async (member: FriendMember, action: 'accept' | 'decline') => {
    const memberId = toPositiveInt(member.id);
    const friendshipId = toPositiveInt(member.friendship_id);
    if (!activeUserId || !memberId || !friendshipId) return;

    setBusyMemberId(memberId);
    try {
      await api.respondToFriendRequest(activeUserId, friendshipId, action);
      if (action === 'accept') {
        updateMemberById(memberId, (current) => ({
          ...current,
          friend_status: 'accepted',
          can_view_profile: true,
        }));
        window.dispatchEvent(new Event('friends-updated'));
      } else {
        updateMemberById(memberId, (current) => ({
          ...current,
          friend_status: 'none',
          friendship_id: null,
          can_view_profile: false,
        }));
        window.dispatchEvent(new Event('friends-updated'));
      }
    } catch (error) {
      alert(getErrorMessage(error, `Failed to ${action} request.`));
    } finally {
      setBusyMemberId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title="Friends" onBack={onBack} />
      </div>

      <div className="px-4 sm:px-6 mb-4">
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setFilter('friends')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'friends' ? 'bg-accent text-black' : 'bg-card text-text-secondary border border-white/10'
            }`}
          >
            Friends ({friendsCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all' ? 'bg-accent text-black' : 'bg-card text-text-secondary border border-white/10'
            }`}
          >
            Gym Members ({allCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('requests')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'requests' ? 'bg-accent text-black' : 'bg-card text-text-secondary border border-white/10'
            }`}
          >
            Requests ({requestsCount})
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 mb-6 relative">
        <Input
          placeholder="Search gym members by name..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Search
          className="absolute left-10 top-1/2 -translate-y-1/2 text-text-tertiary"
          size={18}
        />
      </div>

      <div className="px-4 sm:px-6 space-y-4">
        {filteredMembers.map((member) => {
          const memberId = toPositiveInt(member.id) || 0;
          const status = toFriendStatus(member.friend_status);
          const isBusy = busyMemberId === memberId;
          const canViewProfile = status === 'accepted' || !!member.can_view_profile;

          return (
            <Card
              key={member.id}
              onClick={() => {
                if (canViewProfile) onFriendClick(member);
              }}
              className={`p-4 flex items-center gap-4 border transition-colors ${
                canViewProfile
                  ? 'cursor-pointer border-accent/30 hover:border-accent'
                  : 'border-white/10'
              }`}
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
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white truncate">{member.name}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                    <Trophy size={10} /> {member.rank || 'Member'}
                  </span>
                  <span className="text-xs text-text-tertiary">
                    {toNonNegativeNumber(member.total_workouts)} workouts
                  </span>
                  {status === 'incoming_pending' && (
                    <span className="text-[11px] text-accent bg-accent/10 px-2 py-0.5 rounded">
                      Friend request
                    </span>
                  )}
                  <span className="text-[11px] text-text-secondary bg-white/5 px-2 py-0.5 rounded">
                    Same gym
                  </span>
                </div>
              </div>

              {status === 'accepted' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFriendClick(member);
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-accent text-black hover:bg-accent/90 transition-colors inline-flex items-center gap-1"
                >
                  View
                  <ChevronRight size={14} />
                </button>
              )}

              {status === 'none' && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleSendInvite(member);
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border border-accent/40 text-accent hover:bg-accent/10 disabled:opacity-60"
                >
                  {isBusy ? 'Sending...' : 'Send Invite'}
                </button>
              )}

              {status === 'outgoing_pending' && (
                <span className="px-3 py-2 rounded-lg text-xs font-semibold border border-white/15 text-text-secondary">
                  Pending
                </span>
              )}

              {status === 'incoming_pending' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleRespond(member, 'accept');
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-accent text-black hover:bg-accent/90 disabled:opacity-60"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleRespond(member, 'decline');
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-semibold border border-white/15 text-text-secondary hover:bg-white/5 disabled:opacity-60"
                  >
                    Decline
                  </button>
                </div>
              )}
            </Card>
          );
        })}

        {filteredMembers.length === 0 && (
          <Card className="p-4 text-sm text-text-secondary border border-white/10">
            {filter === 'requests' ? 'No pending friend requests.' : 'No users found for this filter.'}
          </Card>
        )}
      </div>
    </div>
  );
}
