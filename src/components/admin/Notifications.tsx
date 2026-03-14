import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bell, Calendar, MessageSquare, TrendingUp, Trophy, Gift } from 'lucide-react';
import { api } from '../../services/api';

interface NotificationsProps {
  onBack: () => void;
  coachId: number | null;
  isLightTheme?: boolean;
  onOpenPlanInvitation?: (userId: number) => void;
  onOpenMessageThread?: (userId: number) => void;
}

interface CoachNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  created_at: string;
  is_read?: boolean | number;
  unread?: boolean;
  data?: unknown;
}

const iconByType: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string }> = {
  message: { icon: MessageSquare, color: 'text-blue-500' },
  session: { icon: Calendar, color: 'text-purple-500' },
  achievement: { icon: TrendingUp, color: 'text-green-500' },
  plan_review_request: { icon: Bell, color: 'text-yellow-500' },
  plan_coach_request: { icon: Bell, color: 'text-emerald-600' },
  plan_review_approved: { icon: Trophy, color: 'text-green-500' },
  plan_review_rejected: { icon: Gift, color: 'text-red-500' },
};

const parseDataObject = (data: unknown): Record<string, unknown> => {
  if (!data) return {};
  if (typeof data === 'object') return data as Record<string, unknown>;
  if (typeof data !== 'string') return {};
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const formatTimeAgo = (value: string) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
};

export const Notifications: React.FC<NotificationsProps> = ({
  onBack,
  coachId,
  isLightTheme,
  onOpenPlanInvitation,
  onOpenMessageThread,
}) => {
  const [items, setItems] = useState<CoachNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [error, setError] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const [clockTick, setClockTick] = useState(0);

  const resolvedIsLightTheme = isLightTheme ?? (localStorage.getItem('coach-dashboard-theme') === 'light');
  const normalizeNotifications = (payload: unknown): CoachNotification[] => {
    if (!Array.isArray(payload)) return [];

    return payload
      .map((raw: any) => ({
        id: Number(raw?.id || 0),
        type: String(raw?.type || '').trim() || 'general',
        title: String(raw?.title || '').trim() || 'Notification',
        message: String(raw?.message || '').trim(),
        created_at: String(raw?.created_at || raw?.createdAt || ''),
        unread: typeof raw?.unread === 'boolean'
          ? raw.unread
          : !Boolean(raw?.is_read),
        data: raw?.data,
      }))
      .filter((item) => item.id > 0)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const unreadCount = useMemo(
    () => items.filter((notification) => Boolean(notification.unread)).length,
    [items],
  );
  const visibleItems = useMemo(
    () => (filterMode === 'unread' ? items.filter((item) => Boolean(item.unread)) : items),
    [items, filterMode],
  );

  const fetchNotifications = async (silent = false) => {
    if (!coachId) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');
      const data = await api.getNotifications(coachId);
      setItems(normalizeNotifications(data));
    } catch (e: any) {
      setError(e?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchNotifications();
    const timer = window.setInterval(() => {
      void fetchNotifications(true);
    }, 10000);

    return () => {
      window.clearInterval(timer);
    };
  }, [coachId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick((prev) => (prev + 1) % 100000);
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const markAsRead = async (notificationId: number) => {
    try {
      await api.markNotificationRead(notificationId);
      setItems((prev) => prev.map((item) => (
        item.id === notificationId ? { ...item, unread: false } : item
      )));
    } catch (error) {
      console.error('Failed to mark coach notification as read:', error);
    }
  };

  const handleOpenNotification = async (notification: CoachNotification) => {
    if (notification.unread) {
      await markAsRead(notification.id);
    }

    const data = parseDataObject(notification.data);
    if (notification.type === 'message') {
      const senderType = String(data.senderType || '').trim().toLowerCase();
      const senderId = Number(data.senderId || 0);
      const fallbackUserId = Number(data.userId || data.fromUserId || data.senderId || 0);
      const userId = senderType === 'user' ? senderId : fallbackUserId;

      if (Number.isFinite(userId) && userId > 0) {
        onOpenMessageThread?.(userId);
      }
      return;
    }

    if (notification.type === 'plan_coach_request' || notification.type === 'plan_review_request') {
      const userId = Number(data.userId || 0);
      if (Number.isFinite(userId) && userId > 0) {
        onOpenPlanInvitation?.(userId);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = items.filter((item) => Boolean(item.unread));
    if (!unread.length || markingAllRead) return;

    try {
      setMarkingAllRead(true);
      await Promise.all(
        unread.map((item) => api.markNotificationRead(item.id).catch(() => null)),
      );
      setItems((prev) => prev.map((item) => ({ ...item, unread: false })));
    } finally {
      setMarkingAllRead(false);
    }
  };

  return (
    <div className={`min-h-screen ${resolvedIsLightTheme ? 'bg-[#F5F7FB] text-[#111827]' : 'bg-[#1A1A1A] text-white'}`}>
      <div className={`border-b p-4 ${resolvedIsLightTheme ? 'border-slate-200' : 'border-gray-800'}`}>
        <button
          onClick={onBack}
          className={`flex items-center gap-2 mb-4 ${resolvedIsLightTheme ? 'text-slate-600 hover:text-[#111827]' : 'text-gray-400 hover:text-white'}`}
        >
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className={`text-sm ${resolvedIsLightTheme ? 'text-slate-600' : 'text-gray-400'}`}>{unreadCount} unread notifications</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                filterMode === 'all'
                  ? 'border-[#10b981] text-black bg-[#10b981]/80'
                  : resolvedIsLightTheme
                    ? 'border-slate-300 text-slate-600 bg-white hover:bg-slate-50'
                    : 'border-gray-700 text-gray-400 bg-[#242424] hover:bg-[#2A2A2A]'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unread')}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                filterMode === 'unread'
                  ? 'border-[#10b981] text-black bg-[#10b981]/80'
                  : resolvedIsLightTheme
                    ? 'border-slate-300 text-slate-600 bg-white hover:bg-slate-50'
                    : 'border-gray-700 text-gray-400 bg-[#242424] hover:bg-[#2A2A2A]'
              }`}
            >
              Unread
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchNotifications(true)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                resolvedIsLightTheme
                  ? 'border-slate-300 text-slate-600 bg-white hover:bg-slate-50'
                  : 'border-gray-700 text-gray-400 bg-[#242424] hover:bg-[#2A2A2A]'
              }`}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={() => void handleMarkAllAsRead()}
              disabled={!unreadCount || markingAllRead}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                resolvedIsLightTheme
                  ? 'border-[#10b981]/70 text-[#111827] bg-[#10b981]/25 hover:bg-[#10b981]/40'
                  : 'border-[#10b981]/40 text-emerald-600 bg-[#10b981]/10 hover:bg-[#10b981]/20'
              }`}
            >
              {markingAllRead ? 'Marking...' : 'Mark All Read'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-2" data-clock-tick={clockTick}>
        {loading && (
          <div className={`text-sm ${resolvedIsLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>Loading notifications...</div>
        )}

        {!loading && error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && visibleItems.length === 0 && (
          <div className={`text-sm ${resolvedIsLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>
            {filterMode === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
          </div>
        )}

        {!loading && !error && visibleItems.map((notification) => {
          const visual = iconByType[notification.type] || { icon: Bell, color: 'text-gray-500' };
          const Icon = visual.icon;

          return (
            <button
              key={notification.id}
              type="button"
              onClick={() => void handleOpenNotification(notification)}
              className={`w-full text-left rounded-lg p-4 transition-colors ${
                resolvedIsLightTheme
                  ? `bg-white border ${notification.unread ? 'border-[#10b981]/70' : 'border-slate-200'} hover:bg-slate-50`
                  : `bg-[#242424] ${notification.unread ? 'border-l-4 border-[#10b981]' : 'border border-gray-800'} hover:bg-[#2A2A2A]`
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <Icon size={20} className={visual.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-3">
                    <p className="font-semibold break-words [overflow-wrap:anywhere]">{notification.title || 'Notification'}</p>
                    <span className={`text-xs shrink-0 ${resolvedIsLightTheme ? 'text-slate-500' : 'text-gray-400'}`}>
                      {formatTimeAgo(notification.created_at)}
                    </span>
                  </div>
                  <p className={`text-sm break-words [overflow-wrap:anywhere] ${resolvedIsLightTheme ? 'text-slate-600' : 'text-gray-400'}`}>
                    {notification.message}
                  </p>
                </div>
                {notification.unread && (
                  <div className="w-2 h-2 bg-[#10b981] rounded-full mt-2" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

