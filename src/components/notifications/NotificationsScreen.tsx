import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { Bell, Dumbbell, MessageSquare, Trophy, Gift, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';

interface NotificationsScreenProps {
  onBack: () => void;
}

interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  created_at: string;
  data?: unknown;
  unread?: boolean;
}

type FriendshipTerminalStatus = 'accepted' | 'declined';

type ApiLikeError = Error & {
  status?: number;
  data?: unknown;
};

const iconByType: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string }> = {
  message: { icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  friend_request: { icon: Dumbbell, color: 'text-accent', bg: 'bg-accent/10' },
  friend_accept: { icon: Trophy, color: 'text-green-500', bg: 'bg-green-500/10' },
  plan_review_request: { icon: Bell, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  plan_coach_request_sent: { icon: Bell, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  plan_created_by_coach: { icon: Trophy, color: 'text-green-500', bg: 'bg-green-500/10' },
  plan_review_approved: { icon: Trophy, color: 'text-green-500', bg: 'bg-green-500/10' },
  plan_review_rejected: { icon: Gift, color: 'text-red-500', bg: 'bg-red-500/10' },
};

const toPositiveInt = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const parseNotificationData = (rawValue: unknown): Record<string, unknown> => {
  if (!rawValue) return {};
  if (typeof rawValue === 'object') return rawValue as Record<string, unknown>;
  if (typeof rawValue !== 'string') return {};
  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const toFriendshipTerminalStatus = (value: unknown): FriendshipTerminalStatus | null => {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'accepted' || status === 'declined') return status;
  return null;
};

const getFriendshipConflictStatus = (error: unknown): FriendshipTerminalStatus | null => {
  const apiError = error as ApiLikeError;
  if (apiError?.status !== 409) return null;
  const data = (apiError?.data && typeof apiError.data === 'object')
    ? (apiError.data as Record<string, unknown>)
    : {};
  return toFriendshipTerminalStatus(data.status);
};

const isFriendshipConflictError = (error: unknown) => {
  const apiError = error as ApiLikeError;
  return apiError?.status === 409;
};

const formatTimeAgo = (value: string) => {
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return '';
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(value).toLocaleDateString();
};

export function NotificationsScreen({ onBack }: NotificationsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<AppNotification[]>([]);
  const [actioningNotificationId, setActioningNotificationId] = useState<number | null>(null);
  const [actioningFriendshipId, setActioningFriendshipId] = useState<number | null>(null);
  const pendingFriendshipIdsRef = useRef<Set<number>>(new Set());

  const userId = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      return Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || user?.id || 0);
    } catch {
      return 0;
    }
  }, []);

  const fetchNotifications = async () => {
    if (!userId) {
      setError('No active user session found.');
      setLoading(false);
      return;
    }
    try {
      setError('');
      const data = await api.getNotifications(userId);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to load notifications'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNotifications();
    const refresh = window.setInterval(() => {
      void fetchNotifications();
    }, 10000);
    return () => window.clearInterval(refresh);
  }, [userId]);

  const markAsRead = async (notificationId: number) => {
    try {
      await api.markNotificationRead(notificationId);
      setItems((prev) => prev.map((item) => (
        item.id === notificationId ? { ...item, unread: false } : item
      )));
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  };

  const handleFriendRequestResponse = async (
    notification: AppNotification,
    action: 'accept' | 'decline',
  ) => {
    if (!userId) return;
    const data = parseNotificationData(notification.data);
    const friendshipId = toPositiveInt(data.friendshipId);
    if (!friendshipId) return;
    if (pendingFriendshipIdsRef.current.has(friendshipId)) return;

    setError('');
    pendingFriendshipIdsRef.current.add(friendshipId);
    setActioningNotificationId(notification.id);
    setActioningFriendshipId(friendshipId);
    try {
      let resolvedStatus: FriendshipTerminalStatus = action === 'accept' ? 'accepted' : 'declined';
      try {
        const response = await api.respondToFriendRequest(userId, friendshipId, action);
        const responseData = (response && typeof response === 'object')
          ? (response as Record<string, unknown>)
          : {};
        resolvedStatus = toFriendshipTerminalStatus(responseData.status) || resolvedStatus;
      } catch (e) {
        const conflictStatus = getFriendshipConflictStatus(e);
        if (!conflictStatus) {
          if (isFriendshipConflictError(e)) {
            // Backend confirmed request is no longer pending; refresh local state quietly.
            await fetchNotifications();
            return;
          }
          setError(getErrorMessage(e, `Failed to ${action} friend request`));
          return;
        }
        resolvedStatus = conflictStatus;
      }

      try {
        await api.markNotificationRead(notification.id);
      } catch (e) {
        console.error('Failed to mark notification as read:', e);
      }

      if (resolvedStatus === 'accepted') {
        window.dispatchEvent(new Event('friends-updated'));
      }

      setItems((prev) => prev.map((item) => {
        const itemData = parseNotificationData(item.data);
        const itemFriendshipId = toPositiveInt(itemData.friendshipId);
        const isSameFriendRequest = item.type === 'friend_request' && itemFriendshipId === friendshipId;
        if (!isSameFriendRequest && item.id !== notification.id) return item;

        if (item.type !== 'friend_request') {
          return {
            ...item,
            unread: false,
          };
        }

        return {
          ...item,
          unread: false,
          message: resolvedStatus === 'accepted'
            ? 'You accepted this friend request.'
            : 'You declined this friend request.',
          data: {
            ...itemData,
            responseStatus: resolvedStatus,
          },
        };
      }));
    } finally {
      pendingFriendshipIdsRef.current.delete(friendshipId);
      setActioningNotificationId(null);
      setActioningFriendshipId(null);
    }
  };

  const handleClearAll = async () => {
    if (!userId || !items.length || clearing) return;

    try {
      setClearing(true);
      await api.clearNotifications(userId);
      setItems([]);
      setShowClearConfirm(false);
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to clear notifications'));
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header
          title="Notifications"
          onBack={onBack}
          rightElement={
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={clearing || items.length === 0}
              className="text-[11px] sm:text-xs px-2.5 sm:px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {clearing ? 'Clearing...' : 'Clear All'}
            </button>
          }
        />
      </div>

      <div className="px-4 sm:px-6 space-y-3">
        {loading && <div className="text-sm text-text-secondary">Loading notifications...</div>}
        {!loading && error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">{error}</div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="text-sm text-text-secondary">No notifications yet.</div>
        )}

        {!loading && !error && items.map((notif) => {
          const visual = iconByType[notif.type] || { icon: TrendingUp, color: 'text-accent', bg: 'bg-accent/10' };
          const Icon = visual.icon;
          const data = parseNotificationData(notif.data);
          const friendshipId = toPositiveInt(data.friendshipId);
          const requestType = String(data.requestType || '').trim().toLowerCase();
          const responseStatus = String(data.responseStatus || '').trim().toLowerCase();
          const isHandled = responseStatus === 'accepted' || responseStatus === 'declined';
          const isFriendRequest =
            notif.type === 'friend_request'
            && !!friendshipId
            && (!requestType || requestType === 'friendship');
          const showFriendRequestActions = isFriendRequest && !isHandled;
          const actionBusy = actioningNotificationId === notif.id || actioningFriendshipId === friendshipId;

          return (
            <Card
              key={notif.id}
              onClick={() => {
                if (notif.unread) {
                  void markAsRead(notif.id);
                }
              }}
              className={`p-3 sm:p-4 flex gap-3 sm:gap-4 transition-colors ${notif.unread ? 'border-accent/30 cursor-pointer' : ''}`}
            >
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full ${visual.bg} flex items-center justify-center ${visual.color} shrink-0`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <h4 className="font-bold text-white text-sm leading-snug break-words [overflow-wrap:anywhere]">
                    {notif.title}
                  </h4>
                  <span className="text-[10px] text-text-tertiary shrink-0">{formatTimeAgo(notif.created_at)}</span>
                </div>
                <p className="text-xs sm:text-sm text-text-secondary mt-1 leading-relaxed break-words [overflow-wrap:anywhere]">
                  {notif.message}
                </p>

                {showFriendRequestActions && (
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleFriendRequestResponse(notif, 'accept');
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-accent text-black hover:bg-accent/90 disabled:opacity-60"
                    >
                      {actionBusy ? 'Processing...' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleFriendRequestResponse(notif, 'decline');
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-semibold border border-white/15 text-text-secondary hover:bg-white/5 disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                )}

                {isHandled && (
                  <div className="mt-2 text-[11px] text-text-tertiary">
                    {responseStatus === 'accepted' ? 'Request accepted' : 'Request declined'}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            if (!clearing) setShowClearConfirm(false);
          }}
        >
          <div
            className="w-full max-w-sm bg-card border border-white/10 rounded-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold text-base">Remove all notifications?</h3>
            <p className="text-sm text-text-secondary">
              This will permanently delete all notifications.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={clearing}
                onClick={() => setShowClearConfirm(false)}
                className="w-full rounded-xl py-2.5 bg-white/5 border border-white/10 text-text-primary hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearing}
                onClick={() => void handleClearAll()}
                className="w-full rounded-xl py-2.5 bg-accent text-black border border-accent/40 hover:bg-accent/90 disabled:opacity-50"
              >
                {clearing ? 'Removing...' : 'Remove All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
