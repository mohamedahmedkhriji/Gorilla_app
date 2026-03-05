import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { Trophy, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import type { FriendMember } from './FriendsList';
interface FriendProfileProps {
  onBack: () => void;
  friend?: FriendMember | null;
}
type FriendPost = {
  id: number;
  userId: number;
  description: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  mediaAlt: string;
  createdAt: string | null;
  likes: number;
  comments: number;
  views: number;
};

type BlogFeedPost = {
  id?: number;
  userId?: number;
  description?: string;
  mediaType?: 'image' | 'video' | string;
  mediaUrl?: string;
  mediaAlt?: string;
  createdAt?: string | null;
  metrics?: {
    likes?: number;
    comments?: number;
    views?: number;
  };
};

const getLevelFromPoints = (points: number) => {
  if (points >= 2200) return 6;
  if (points >= 1400) return 5;
  if (points >= 800) return 4;
  if (points >= 400) return 3;
  if (points >= 150) return 2;
  return 1;
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

const formatRelativeDay = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const now = new Date();
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startThen = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.floor((startNow - startThen) / (24 * 60 * 60 * 1000));
  if (dayDiff <= 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return `${dayDiff}d ago`;
  return date.toLocaleDateString();
};

const QUICK_SESSION_TIMES = ['06:30', '08:00', '17:30', '19:00'];

export function FriendProfile({ onBack, friend }: FriendProfileProps) {
  const [showInvite, setShowInvite] = useState(false);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState({ hour: 9, minute: 0 });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [friendPosts, setFriendPosts] = useState<FriendPost[]>([]);
  const [loadingFriendPosts, setLoadingFriendPosts] = useState(false);

  const friendId = Number(friend?.id || 0);
  const friendName = String(friend?.name || 'Friend').trim() || 'Friend';
  const friendRank = String(friend?.rank || 'Member');
  const friendTotalPoints = Number(friend?.total_points || 0);
  const friendLevel = getLevelFromPoints(friendTotalPoints);
  const friendProfilePicture = isUsableProfileImage(friend?.profile_picture)
    ? String(friend?.profile_picture)
    : '';
  const friendStatus = String(friend?.friend_status || '').trim().toLowerCase();
  const canViewProfile = friendStatus === 'accepted' || !!friend?.can_view_profile;
  const friendInitials = useMemo(
    () => friendName.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'FR',
    [friendName],
  );

  useEffect(() => {
    const loadFriendPosts = async () => {
      if (!friendId || friendId <= 0) {
        setFriendPosts([]);
        return;
      }

      setLoadingFriendPosts(true);
      try {
        const currentUser = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
        const viewerId = Number(currentUser?.id || localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
        const response = await api.getBlogsFeed(viewerId > 0 ? viewerId : friendId, {
          limit: 12,
          authorId: friendId,
        });
        const posts = Array.isArray(response?.posts)
          ? response.posts.map((post: BlogFeedPost) => ({
            id: Number(post?.id || 0),
            userId: Number(post?.userId || 0),
            description: String(post?.description || ''),
            mediaType: post?.mediaType === 'video' ? 'video' : 'image',
            mediaUrl: String(post?.mediaUrl || ''),
            mediaAlt: String(post?.mediaAlt || 'Post media'),
            createdAt: typeof post?.createdAt === 'string' ? post.createdAt : null,
            likes: Number(post?.metrics?.likes || 0),
            comments: Number(post?.metrics?.comments || 0),
            views: Number(post?.metrics?.views || 0),
          }))
          : [];
        setFriendPosts(posts.filter((post: FriendPost) => post.id > 0 && post.userId === friendId));
      } catch {
        setFriendPosts([]);
      } finally {
        setLoadingFriendPosts(false);
      }
    };

    void loadFriendPosts();
  }, [friendId]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };

  const isSameDay = (date1: Date | null, date2: Date) => {
    if (!date1) return false;
    return date1.getDate() === date2.getDate() && 
           date1.getMonth() === date2.getMonth() && 
           date1.getFullYear() === date2.getFullYear();
  };

  const handleSendInvite = async () => {
    if (!selectedDate) return;
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const fromUserId = Number(user?.id || 0);
    if (!fromUserId || fromUserId <= 0) {
      alert('No active user session found.');
      return;
    }
    if (!friendId || friendId <= 0) {
      alert('Friend not selected.');
      return;
    }
    const dateStr = selectedDate.toISOString().split('T')[0];
    const timeStr = `${selectedTime.hour.toString().padStart(2, '0')}:${selectedTime.minute.toString().padStart(2, '0')}`;
    try {
      await api.sendInvitation(fromUserId, friendId, dateStr, timeStr);
      setShowInvite(false);
      alert('Session invitation sent!');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to send invitation');
    }
  };

  const selectedTimeValue = `${selectedTime.hour.toString().padStart(2, '0')}:${selectedTime.minute.toString().padStart(2, '0')}`;
  const selectedSessionLabel = selectedDate
    ? `${selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${selectedTimeValue}`
    : null;

  const handleTimeInputChange = (value: string) => {
    const [hourRaw, minuteRaw] = value.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return;
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) return;
    setSelectedTime({ hour, minute });
  };

  if (!canViewProfile) {
    return (
      <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
        <div className="px-4 sm:px-6 pt-2">
          <Header title="Friend Profile" onBack={onBack} />
        </div>
        <div className="px-4 sm:px-6 pt-8">
          <Card className="p-5 border border-white/10">
            <h2 className="text-lg font-semibold text-white">Profile locked</h2>
            <p className="text-sm text-text-secondary mt-2">
              Send a friend invitation and wait for acceptance before viewing this profile.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="mt-4 w-full bg-accent text-black py-2.5 rounded-xl font-semibold hover:bg-accent/90 transition-colors"
            >
              Back to Friends
            </button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title="Friend Profile" onBack={onBack} />
      </div>

      <div className="px-4 sm:px-6 flex flex-col items-center mb-8">
        <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold text-white mb-4">
          {friendProfilePicture ? (
            <button
              type="button"
              onClick={() => setShowAvatarPreview(true)}
              className="w-full h-full rounded-full overflow-hidden cursor-zoom-in"
              aria-label={`View ${friendName} profile image`}
            >
              <img
                src={friendProfilePicture}
                alt={`${friendName} avatar`}
                className="w-full h-full rounded-full object-cover"
              />
            </button>
          ) : (
            friendInitials
          )}
        </div>
        <h2 className="text-2xl font-bold text-white">{friendName}</h2>
        <div className="flex items-center gap-2 mt-2">
          <Trophy size={16} className="text-yellow-500" />
          <span className="text-sm text-text-secondary">
            {friendRank} - Level {friendLevel}
          </span>
        </div>
      </div>

      <div className="px-4 sm:px-6 space-y-6">
        <button 
          onClick={() => setShowInvite(true)}
          className="w-full bg-accent text-black font-bold py-3 rounded-xl hover:bg-accent/90 transition-colors">
          Invite to Gym Day
        </button>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
            Badges
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2, 3, 4].map((i) =>
            <div
              key={i}
              className="w-16 h-16 rounded-full bg-card border border-white/10 flex items-center justify-center shrink-0">

                <Trophy
                size={24}
                className={i === 1 ? 'text-accent' : 'text-text-tertiary'} />

              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
            Training Split
          </h3>
          <Card className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white">Push</span>
              <span className="text-text-tertiary">Mon, Thu</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white">Pull</span>
              <span className="text-text-tertiary">Tue, Fri</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white">Legs</span>
              <span className="text-text-tertiary">Wed, Sat</span>
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
            Posts
          </h3>
          {loadingFriendPosts ? (
            <Card className="!p-3 text-sm text-text-secondary">Loading posts...</Card>
          ) : friendPosts.length === 0 ? (
            <Card className="!p-3 text-sm text-text-secondary">No posts uploaded yet.</Card>
          ) : (
            <div className="space-y-3">
              {friendPosts.map((post) => (
                <Card key={post.id} className="!p-3 space-y-2">
                  <div className="text-xs text-text-secondary">{formatRelativeDay(post.createdAt || '')}</div>
                  {post.mediaUrl && (
                    post.mediaType === 'video' ? (
                      <video
                        src={post.mediaUrl}
                        className="w-full rounded-xl border border-white/10 bg-black/20 max-h-64 object-contain"
                        controls
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={post.mediaUrl}
                        alt={post.mediaAlt}
                        className="w-full rounded-xl border border-white/10 bg-black/20 max-h-64 object-contain"
                        loading="lazy"
                      />
                    )
                  )}
                  {post.description.trim() && (
                    <div className="text-sm text-white leading-relaxed">{post.description}</div>
                  )}
                  <div className="text-xs text-text-tertiary">
                    {new Intl.NumberFormat('en-US').format(Math.max(0, post.likes))} likes - {' '}
                    {new Intl.NumberFormat('en-US').format(Math.max(0, post.comments))} comments - {' '}
                    {new Intl.NumberFormat('en-US').format(Math.max(0, post.views))} views
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {showInvite && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={() => setShowInvite(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-white/15 bg-gradient-to-b from-[#1f1f25] to-[#131318] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-white/10">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Invite to Session</h3>
                  <p className="text-xs text-text-secondary mt-1">Pick date and time for your workout together.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="w-9 h-9 rounded-xl border border-white/15 text-text-secondary hover:text-white hover:bg-white/5 flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 px-3 py-2.5 rounded-xl bg-accent/10 border border-accent/25">
                <div className="text-[11px] uppercase tracking-wide text-accent/80">Selected session</div>
                <div className="text-sm text-white mt-1">
                  {selectedSessionLabel || 'Choose a date and time'}
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    className="w-8 h-8 rounded-lg border border-white/10 hover:bg-white/5 text-text-secondary flex items-center justify-center"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-white font-semibold">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    className="w-8 h-8 rounded-lg border border-white/10 hover:bg-white/5 text-text-secondary flex items-center justify-center"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1.5 mb-2">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <div key={i} className="text-center text-[11px] text-text-tertiary font-semibold py-1.5">{day}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: getDaysInMonth(currentMonth).firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: getDaysInMonth(currentMonth).daysInMonth }).map((_, i) => {
                    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1);
                    const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                    const selected = isSameDay(selectedDate, date);
                    const today = isToday(date);

                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={isPast}
                        onClick={() => setSelectedDate(date)}
                        className={`aspect-square rounded-xl text-sm font-semibold transition-all ${
                          selected
                            ? 'bg-accent text-black shadow-[0_0_0_2px_rgba(255,255,255,0.08)]'
                            : today
                              ? 'bg-white/10 text-white border border-white/20'
                              : isPast
                                ? 'text-text-tertiary cursor-not-allowed'
                                : 'text-white hover:bg-white/6 border border-transparent hover:border-white/10'
                        }`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm text-text-secondary block">Time</label>
                <input
                  type="time"
                  value={selectedTimeValue}
                  step={900}
                  onChange={(e) => handleTimeInputChange(e.target.value)}
                  className="w-full bg-background/80 border border-white/15 rounded-xl px-4 py-3 text-white outline-none focus:border-accent/60"
                />
                <div className="flex gap-2 flex-wrap">
                  {QUICK_SESSION_TIMES.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => handleTimeInputChange(time)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        selectedTimeValue === time
                          ? 'bg-accent text-black border-accent/80'
                          : 'border-white/15 text-text-secondary hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSendInvite}
                disabled={!selectedDate}
                className="w-full bg-accent text-black font-bold py-3.5 rounded-xl hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}

      {showAvatarPreview && friendProfilePicture && (
        <div
          className="fixed inset-0 z-50 bg-black/90 p-4 sm:p-8 flex items-center justify-center"
          onClick={() => setShowAvatarPreview(false)}
        >
          <button
            type="button"
            onClick={() => setShowAvatarPreview(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center hover:bg-white/20"
            aria-label="Close image preview"
          >
            <X size={20} />
          </button>
          <img
            src={friendProfilePicture}
            alt={`${friendName} avatar`}
            className="max-w-full max-h-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>);

}


