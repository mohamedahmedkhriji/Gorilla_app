import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Header } from '../components/ui/Header';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Search, Trophy, ChevronRight, X, CheckCircle2, Clock3, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../services/language';

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

type ApiLikeError = Error & {
  status?: number;
  data?: unknown;
};

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

const getInitials = (name: string) =>
  String(name || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'FR';

type RequestFeedbackTone = 'success' | 'info' | 'error';

const getFriendshipConflictStatus = (error: unknown): 'accepted' | 'declined' | null => {
  const apiError = error as ApiLikeError;
  if (apiError?.status !== 409) return null;
  const data = (apiError?.data && typeof apiError.data === 'object')
    ? (apiError.data as Record<string, unknown>)
    : {};
  const status = String(data.status || '').trim().toLowerCase();
  if (status === 'accepted' || status === 'declined') return status;
  return null;
};

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

const FRIENDS_LIST_I18N = {
  en: {
    title: 'Friends',
    tabFriends: 'Friends',
    tabGymMembers: 'Gym Members',
    tabRequests: 'Requests',
    searchPlaceholder: 'Search gym members by name...',
    invitationAlreadyPending: 'invitation already pending.',
    requestSentPrefix: 'Friend request sent to',
    requestSentTitle: 'Request sent',
    requestPendingTitle: 'Already pending',
    failedToSendInvitation: 'Failed to send invitation.',
    requestFailedTitle: 'Could not send request',
    failedToAcceptRequest: 'Failed to accept request.',
    failedToDeclineRequest: 'Failed to decline request.',
    requestAcceptedTitle: 'Friend added',
    requestIgnoredTitle: 'Request ignored',
    requestAccepted: 'Request accepted.',
    requestIgnored: 'Request ignored.',
    profileSuffix: 'profile',
    openImagePreview: 'Open profile photo preview',
    member: 'Member',
    workouts: 'workouts',
    friendRequest: 'Friend request',
    requestSubtitle: 'Wants to connect with you',
    sameGym: 'Same gym',
    view: 'View',
    sending: 'Sending...',
    sendInvite: 'Send Invite',
    pending: 'Pending',
    accept: 'Accept',
    decline: 'Ignore',
    tapPhoto: 'Tap photo to expand',
    noPendingFriendRequests: 'No pending friend requests.',
    noUsersForFilter: 'No users found for this filter.',
  },
  ar: {
    title: 'الأصدقاء',
    tabFriends: 'الأصدقاء',
    tabGymMembers: 'أعضاء النادي',
    tabRequests: 'الطلبات',
    searchPlaceholder: 'ابحث عن أعضاء النادي بالاسم...',
    invitationAlreadyPending: 'الدعوة معلقة بالفعل.',
    requestSentPrefix: 'تم إرسال طلب صداقة إلى',
    requestSentTitle: 'تم إرسال الطلب',
    requestPendingTitle: 'الطلب معلق بالفعل',
    failedToSendInvitation: 'فشل إرسال الدعوة.',
    requestFailedTitle: 'تعذر إرسال الطلب',
    failedToAcceptRequest: 'فشل قبول الطلب.',
    failedToDeclineRequest: 'فشل رفض الطلب.',
    requestAcceptedTitle: 'تمت الإضافة',
    requestIgnoredTitle: 'تم تجاهل الطلب',
    requestAccepted: 'تم قبول الطلب.',
    requestIgnored: 'تم تجاهل الطلب.',
    profileSuffix: 'الملف الشخصي',
    openImagePreview: 'عرض صورة الملف بحجم أكبر',
    member: 'عضو',
    workouts: 'تمرين',
    friendRequest: 'طلب صداقة',
    requestSubtitle: 'يريد التواصل معك',
    sameGym: 'نفس النادي',
    view: 'عرض',
    sending: 'جارٍ الإرسال...',
    sendInvite: 'إرسال دعوة',
    pending: 'قيد الانتظار',
    accept: 'قبول',
    decline: 'تجاهل',
    tapPhoto: 'اضغط على الصورة لعرضها بحجم أكبر',
    noPendingFriendRequests: 'لا توجد طلبات صداقة معلقة.',
    noUsersForFilter: 'لم يتم العثور على مستخدمين لهذا الفلتر.',
  },
} as const;

export function FriendsList({ onBack, onFriendClick }: FriendsListProps) {
  const [members, setMembers] = useState<FriendMember[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'friends' | 'requests' | 'rank'>('friends');
  const [activeUserId, setActiveUserId] = useState<number>(0);
  const [busyMemberId, setBusyMemberId] = useState<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [requestFeedback, setRequestFeedback] = useState<{
    tone: RequestFeedbackTone;
    title: string;
    message: string;
  } | null>(null);
  const requestFeedbackTimerRef = useRef<number | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<{ src: string; name: string } | null>(null);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const copy = FRIENDS_LIST_I18N[language] || FRIENDS_LIST_I18N.en;

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

  const showRequestFeedback = (tone: RequestFeedbackTone, title: string, message: string) => {
    if (requestFeedbackTimerRef.current) {
      window.clearTimeout(requestFeedbackTimerRef.current);
    }
    setRequestFeedback({ tone, title, message });
    requestFeedbackTimerRef.current = window.setTimeout(() => {
      setRequestFeedback(null);
      requestFeedbackTimerRef.current = null;
    }, 3200);
  };

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

  useEffect(() => () => {
    if (requestFeedbackTimerRef.current) {
      window.clearTimeout(requestFeedbackTimerRef.current);
    }
  }, []);

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
        showRequestFeedback('info', copy.requestPendingTitle, `${member.name}: ${copy.invitationAlreadyPending}`);
      } else {
        showRequestFeedback('success', copy.requestSentTitle, `${copy.requestSentPrefix} ${member.name}.`);
      }
    } catch (error) {
      showRequestFeedback('error', copy.requestFailedTitle, getErrorMessage(error, copy.failedToSendInvitation));
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
        showRequestFeedback('success', copy.requestAcceptedTitle, copy.requestAccepted);
        window.dispatchEvent(new Event('friends-updated'));
      } else {
        updateMemberById(memberId, (current) => ({
          ...current,
          friend_status: 'none',
          friendship_id: null,
          can_view_profile: false,
        }));
        showRequestFeedback('info', copy.requestIgnoredTitle, copy.requestIgnored);
        window.dispatchEvent(new Event('friends-updated'));
      }
    } catch (error) {
      const conflictStatus = getFriendshipConflictStatus(error);
      if (conflictStatus === 'accepted') {
        updateMemberById(memberId, (current) => ({
          ...current,
          friend_status: 'accepted',
          can_view_profile: true,
        }));
        window.dispatchEvent(new Event('friends-updated'));
        return;
      }
      if (conflictStatus === 'declined') {
        updateMemberById(memberId, (current) => ({
          ...current,
          friend_status: 'none',
          friendship_id: null,
          can_view_profile: false,
        }));
        window.dispatchEvent(new Event('friends-updated'));
        return;
      }
      const fallbackMessage = action === 'accept'
        ? copy.failedToAcceptRequest
        : copy.failedToDeclineRequest;
      alert(getErrorMessage(error, fallbackMessage));
    } finally {
      setBusyMemberId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title={copy.title} onBack={onBack} />
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
            {copy.tabFriends}
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all' ? 'bg-accent text-black' : 'bg-card text-text-secondary border border-white/10'
            }`}
          >
            {copy.tabGymMembers}
          </button>
          <button
            type="button"
            onClick={() => setFilter('requests')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'requests' ? 'bg-accent text-black' : 'bg-card text-text-secondary border border-white/10'
            }`}
          >
            {copy.tabRequests}
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 mb-6 relative">
        <Input
          placeholder={copy.searchPlaceholder}
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
          const profileImage = isUsableProfileImage(member.profile_picture) ? String(member.profile_picture) : null;
          const memberInitials = getInitials(member.name);
          const isIncomingRequest = status === 'incoming_pending';

          return (
            <Card
              key={member.id}
              onClick={() => {
                if (canViewProfile) onFriendClick(member);
              }}
              className={`p-4 border transition-all ${
                isIncomingRequest
                  ? 'border-white/12 bg-white/[0.03] shadow-[0_18px_40px_rgba(0,0,0,0.18)]'
                  : canViewProfile
                    ? 'cursor-pointer border-accent/30 hover:border-accent'
                    : 'border-white/10'
              }`}
            >
              <div className={`flex items-center gap-4 ${isIncomingRequest ? 'min-w-0 flex-1' : ''}`}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (profileImage) {
                      setAvatarPreview({ src: profileImage, name: member.name });
                    }
                  }}
                  disabled={!profileImage}
                  className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white/10 flex items-center justify-center font-bold text-white ${
                    profileImage ? 'cursor-zoom-in ring-2 ring-white/15 shadow-lg shadow-black/20' : ''
                  }`}
                  aria-label={profileImage ? copy.openImagePreview : undefined}
                >
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt={`${member.name} ${copy.profileSuffix}`}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    memberInitials
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-white truncate">{member.name}</h3>
                  {isIncomingRequest ? (
                    <div className="mt-1 space-y-1">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-text-tertiary">
                        {copy.friendRequest}
                      </div>
                      <div className="text-sm text-text-secondary">
                        {copy.requestSubtitle}
                      </div>
                      <div className="text-[11px] text-text-tertiary">
                        {copy.tapPhoto}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                        <Trophy size={10} /> {member.rank || copy.member}
                      </span>
                      <span className="text-xs text-text-tertiary">
                        {toNonNegativeNumber(member.total_workouts)} {copy.workouts}
                      </span>
                      <span className="text-[11px] text-text-secondary bg-white/5 px-2 py-0.5 rounded">
                        {copy.sameGym}
                      </span>
                    </div>
                  )}
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
                  {copy.view}
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
                  {isBusy ? copy.sending : copy.sendInvite}
                </button>
              )}

              {status === 'outgoing_pending' && (
                <span className="px-3 py-2 rounded-lg text-xs font-semibold border border-white/15 text-text-secondary">
                  {copy.pending}
                </span>
              )}

              {status === 'incoming_pending' && (
                <div className="ml-auto flex min-w-[96px] flex-col items-end justify-center gap-2 self-center">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleRespond(member, 'accept');
                    }}
                    className="min-w-[92px] rounded-full bg-[#51df78] px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(81,223,120,0.35)] transition hover:bg-[#46d06c] disabled:opacity-60"
                  >
                    {copy.accept}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleRespond(member, 'decline');
                    }}
                    className="px-2 text-xs font-medium text-text-tertiary transition hover:text-white disabled:opacity-60"
                  >
                    {copy.decline}
                  </button>
                </div>
              )}
            </Card>
          );
        })}

        {filteredMembers.length === 0 && (
          <Card className="p-4 text-sm text-text-secondary border border-white/10">
            {filter === 'requests' ? copy.noPendingFriendRequests : copy.noUsersForFilter}
          </Card>
        )}
      </div>

      {avatarPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 sm:p-8"
          onClick={() => setAvatarPreview(null)}
        >
          <button
            type="button"
            onClick={() => setAvatarPreview(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
            aria-label="Close image preview"
          >
            <X size={20} />
          </button>
          <img
            src={avatarPreview.src}
            alt={`${avatarPreview.name} ${copy.profileSuffix}`}
            className="max-h-full max-w-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {requestFeedback && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 sm:bottom-8">
          <div
            className={`pointer-events-auto w-full max-w-sm rounded-3xl border px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all ${
              requestFeedback.tone === 'success'
                ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-50'
                : requestFeedback.tone === 'info'
                  ? 'border-accent/35 bg-accent/12 text-white'
                  : 'border-red-400/35 bg-red-500/12 text-red-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                  requestFeedback.tone === 'success'
                    ? 'bg-emerald-400/18 text-emerald-200'
                    : requestFeedback.tone === 'info'
                      ? 'bg-accent/18 text-accent'
                      : 'bg-red-400/18 text-red-200'
                }`}
              >
                {requestFeedback.tone === 'success' ? (
                  <CheckCircle2 size={20} />
                ) : requestFeedback.tone === 'info' ? (
                  <Clock3 size={20} />
                ) : (
                  <AlertCircle size={20} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{requestFeedback.title}</div>
                <div className="mt-1 text-sm leading-relaxed text-white/80">{requestFeedback.message}</div>
              </div>
              <button
                type="button"
                onClick={() => setRequestFeedback(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Dismiss feedback"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
