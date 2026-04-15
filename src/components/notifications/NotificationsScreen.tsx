import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, LoaderCircle } from 'lucide-react';
import challengeHeroImage from '../../../assets/Workout/CHALLENGE.png';
import { api } from '../../services/api';
import { useAppLanguage } from '../../hooks/useAppLanguage';
import { Card } from '../ui/Card';
import { Header } from '../ui/Header';
import { NotificationCard } from './NotificationCard';
import {
  buildNotificationMetadata,
  formatNotificationTime,
  getNotificationResponseStatus,
  getNotificationVisual,
  getNotificationsCopy,
  isFriendRequestNotification,
  localizeNotificationText,
  parseNotificationData,
  readStoredUserId,
  resolveNotificationType,
  toPositiveInt,
} from './notificationUtils';
import type {
  AcceptedChallengePayload,
  AppNotification,
  NotificationActionId,
  NotificationCardModel,
  NotificationsScreenProps,
} from './types';

type FriendshipTerminalStatus = 'accepted' | 'declined';
type ChallengeInviteTerminalStatus = 'accepted' | 'declined' | 'cancelled';

type ApiLikeError = Error & {
  status?: number;
  data?: unknown;
};

const POLL_INTERVAL_MS = 10000;

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

const toFriendshipTerminalStatus = (value: unknown): FriendshipTerminalStatus | null => {
  const status = String(value || '').trim().toLowerCase();
  return status === 'accepted' || status === 'declined' ? status : null;
};

const getFriendshipConflictStatus = (error: unknown): FriendshipTerminalStatus | null => {
  const apiError = error as ApiLikeError;
  if (apiError?.status !== 409) return null;
  const data = apiError?.data && typeof apiError.data === 'object'
    ? apiError.data as Record<string, unknown>
    : {};
  return toFriendshipTerminalStatus(data.status);
};

const isFriendshipConflictError = (error: unknown) => {
  const apiError = error as ApiLikeError;
  return apiError?.status === 409;
};

const toChallengeInviteTerminalStatus = (value: unknown): ChallengeInviteTerminalStatus | null => {
  const status = String(value || '').trim().toLowerCase();
  return status === 'accepted' || status === 'declined' || status === 'cancelled' ? status : null;
};

const getChallengeInviteConflictStatus = (error: unknown): ChallengeInviteTerminalStatus | null => {
  const apiError = error as ApiLikeError;
  if (apiError?.status !== 409) return null;
  const data = apiError?.data && typeof apiError.data === 'object'
    ? apiError.data as Record<string, unknown>
    : {};
  return toChallengeInviteTerminalStatus(data.status);
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim() ? error.message : fallback;

function NotificationEmptyState({
  title,
  body,
  isRtl,
}: {
  title: string;
  body: string;
  isRtl: boolean;
}) {
  return (
    <Card className="rounded-[1.8rem] border-white/10 bg-card/70 p-0">
      <div className={cx('flex flex-col items-center px-6 py-10 text-center', isRtl && 'text-right')}>
        <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-white/10 bg-white/5 text-text-secondary">
          <Bell size={24} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-white">{title}</h2>
        <p className="mt-2 max-w-xs text-sm leading-6 text-text-secondary">{body}</p>
      </div>
    </Card>
  );
}

function ClearNotificationsDialog({
  open,
  title,
  message,
  cancelLabel,
  confirmLabel,
  busyLabel,
  busy,
  isRtl,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  isRtl: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        onClick={() => {
          if (!busy) onCancel();
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          dir={isRtl ? 'rtl' : 'ltr'}
          className="w-full max-w-sm rounded-[1.8rem] border border-white/10 bg-card/95 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 className={cx('text-lg font-semibold text-white', isRtl ? 'text-right' : 'text-left')}>{title}</h2>
          <p className={cx('mt-2 text-sm leading-6 text-text-secondary', isRtl ? 'text-right' : 'text-left')}>{message}</p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="min-h-11 rounded-2xl border border-rose-500/20 bg-rose-500/12 px-4 text-sm font-semibold text-rose-200 transition-colors hover:bg-rose-500/16 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? busyLabel : confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function NotificationsScreen({ onBack, onOpenAcceptedChallenge }: NotificationsScreenProps) {
  const { language, isArabic } = useAppLanguage();
  const copy = getNotificationsCopy(language);

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [actioningNotificationId, setActioningNotificationId] = useState<number | null>(null);
  const [actioningFriendshipId, setActioningFriendshipId] = useState<number | null>(null);
  const [challengeIntroTitle, setChallengeIntroTitle] = useState('');
  const [acceptedChallenge, setAcceptedChallenge] = useState<AcceptedChallengePayload | null>(null);
  const pendingFriendshipIdsRef = useRef<Set<number>>(new Set());

  const userId = useMemo(() => readStoredUserId(), []);
  const unreadCount = useMemo(
    () => items.filter((item) => Boolean(item.unread)).length,
    [items],
  );

  const updateNotification = useCallback(
    (notificationId: number, updater: (notification: AppNotification) => AppNotification) => {
      setItems((current) => current.map((item) => (item.id === notificationId ? updater(item) : item)));
    },
    [],
  );

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setError(copy.noActiveSession);
      setLoading(false);
      return;
    }

    try {
      setError('');
      const response = await api.getNotifications(userId);
      setItems(Array.isArray(response) ? response : []);
    } catch (requestError) {
      setError(getErrorMessage(requestError, copy.failedLoadNotifications));
    } finally {
      setLoading(false);
    }
  }, [copy.failedLoadNotifications, copy.noActiveSession, userId]);

  useEffect(() => {
    setLoading(true);
    void fetchNotifications();

    const interval = window.setInterval(() => {
      void fetchNotifications();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!challengeIntroTitle) return undefined;

    const timeout = window.setTimeout(() => {
      setChallengeIntroTitle('');
      if (acceptedChallenge && onOpenAcceptedChallenge) {
        onOpenAcceptedChallenge(acceptedChallenge);
      }
      setAcceptedChallenge(null);
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [acceptedChallenge, challengeIntroTitle, onOpenAcceptedChallenge]);

  const markAsRead = useCallback(async (notificationId: number) => {
    try {
      await api.markNotificationRead(notificationId);
      updateNotification(notificationId, (item) => ({ ...item, unread: false }));
    } catch (requestError) {
      console.error('Failed to mark notification as read:', requestError);
    }
  }, [updateNotification]);

  const handleFriendRequestResponse = useCallback(async (
    notification: AppNotification,
    action: 'accept' | 'decline',
  ) => {
    if (!userId) return;

    const data = parseNotificationData(notification.data);
    const friendshipId = toPositiveInt(data.friendshipId);
    if (!friendshipId || pendingFriendshipIdsRef.current.has(friendshipId)) return;

    setError('');
    pendingFriendshipIdsRef.current.add(friendshipId);
    setActioningNotificationId(notification.id);
    setActioningFriendshipId(friendshipId);

    try {
      let resolvedStatus: FriendshipTerminalStatus = action === 'accept' ? 'accepted' : 'declined';

      try {
        const response = await api.respondToFriendRequest(userId, friendshipId, action);
        resolvedStatus = toFriendshipTerminalStatus((response as Record<string, unknown> | null)?.status) || resolvedStatus;
      } catch (requestError) {
        const conflictStatus = getFriendshipConflictStatus(requestError);
        if (!conflictStatus) {
          if (isFriendshipConflictError(requestError)) {
            await fetchNotifications();
            return;
          }

          setError(getErrorMessage(
            requestError,
            action === 'accept' ? copy.failedAcceptRequest : copy.failedDeclineRequest,
          ));
          return;
        }

        resolvedStatus = conflictStatus;
      }

      try {
        await api.markNotificationRead(notification.id);
      } catch (requestError) {
        console.error('Failed to mark notification as read:', requestError);
      }

      if (resolvedStatus === 'accepted') {
        window.dispatchEvent(new Event('friends-updated'));
      }

      setItems((current) => current.map((item) => {
        const itemData = parseNotificationData(item.data);
        const itemFriendshipId = toPositiveInt(itemData.friendshipId);
        const sameFriendRequest = item.type === 'friend_request' && itemFriendshipId === friendshipId;
        if (!sameFriendRequest && item.id !== notification.id) return item;

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
            ? copy.acceptedFriendRequestMessage
            : copy.declinedFriendRequestMessage,
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
  }, [
    copy.acceptedFriendRequestMessage,
    copy.declinedFriendRequestMessage,
    copy.failedAcceptRequest,
    copy.failedDeclineRequest,
    fetchNotifications,
    userId,
  ]);

  const handleChallengeInviteResponse = useCallback(async (
    notification: AppNotification,
    action: 'accept' | 'decline',
  ) => {
    if (!userId) return;

    const notificationData = parseNotificationData(notification.data);
    setError('');
    setActioningNotificationId(notification.id);

    try {
      let resolvedStatus: ChallengeInviteTerminalStatus = action === 'accept' ? 'accepted' : 'declined';
      let resolvedTitle = String(notificationData.challengeTitle || 'Challenge').trim() || 'Challenge';
      let resolvedChallengeKey = String(notificationData.challengeKey || '').trim().toLowerCase();
      let resolvedSenderId = toPositiveInt(notificationData.senderUserId);
      let resolvedSenderName = String(notificationData.senderName || '').trim() || 'Friend';
      let resolvedSessionId = toPositiveInt(notificationData.sessionId);

      try {
        const response = await api.respondToFriendChallengeInvite(userId, notification.id, action);
        const payload = response as Record<string, unknown> | null;
        resolvedStatus = toChallengeInviteTerminalStatus(payload?.status) || resolvedStatus;
        resolvedTitle = String(payload?.challengeTitle || resolvedTitle).trim() || resolvedTitle;
        resolvedChallengeKey = String(payload?.challengeKey || resolvedChallengeKey).trim().toLowerCase();
        resolvedSenderId = toPositiveInt(payload?.senderUserId) || resolvedSenderId;
        resolvedSenderName = String(payload?.senderName || resolvedSenderName).trim() || resolvedSenderName;
        resolvedSessionId = toPositiveInt(payload?.sessionId) || resolvedSessionId;
      } catch (requestError) {
        const conflictStatus = getChallengeInviteConflictStatus(requestError);
        if (!conflictStatus) {
          setError(getErrorMessage(
            requestError,
            action === 'accept' ? copy.failedAcceptChallengeInvite : copy.failedDeclineChallengeInvite,
          ));
          return;
        }
        resolvedStatus = conflictStatus;
      }

      updateNotification(notification.id, (item) => {
        const itemData = parseNotificationData(item.data);
        return {
          ...item,
          unread: false,
          message: resolvedStatus === 'accepted'
            ? copy.acceptedChallengeInviteMessage
            : resolvedStatus === 'cancelled'
              ? copy.cancelledChallengeInviteMessage
              : copy.declinedChallengeInviteMessage,
          data: {
            ...itemData,
            responseStatus: resolvedStatus,
            challengeTitle: resolvedTitle,
            sessionId: resolvedSessionId,
          },
        };
      });

      if (resolvedStatus === 'accepted') {
        if (resolvedSenderId && resolvedChallengeKey && resolvedSessionId) {
          setAcceptedChallenge({
            friendId: resolvedSenderId,
            friendName: resolvedSenderName,
            challengeKey: resolvedChallengeKey,
            challengeTitle: resolvedTitle,
            challengeSessionId: resolvedSessionId,
          });
        }
        setChallengeIntroTitle(resolvedTitle);
      }
    } finally {
      setActioningNotificationId(null);
    }
  }, [
    copy.acceptedChallengeInviteMessage,
    copy.cancelledChallengeInviteMessage,
    copy.declinedChallengeInviteMessage,
    copy.failedAcceptChallengeInvite,
    copy.failedDeclineChallengeInvite,
    updateNotification,
    userId,
  ]);

  const handleNotificationAction = useCallback((notificationId: number, actionId: NotificationActionId) => {
    const notification = items.find((item) => item.id === notificationId);
    if (!notification) return;

    const type = resolveNotificationType(notification, parseNotificationData(notification.data));
    if (type === 'friend_request' && (actionId === 'accept' || actionId === 'decline')) {
      void handleFriendRequestResponse(notification, actionId);
      return;
    }

    if (type === 'friend_challenge_invite' && (actionId === 'accept' || actionId === 'decline')) {
      void handleChallengeInviteResponse(notification, actionId);
    }
  }, [handleChallengeInviteResponse, handleFriendRequestResponse, items]);

  const handleOpenNotification = useCallback((notificationId: number) => {
    const notification = items.find((item) => item.id === notificationId);
    if (!notification?.unread) return;
    void markAsRead(notificationId);
  }, [items, markAsRead]);

  const handleClearAll = useCallback(async () => {
    if (!userId || !items.length || clearing) return;

    try {
      setClearing(true);
      await api.clearNotifications(userId);
      setItems([]);
      setShowClearConfirm(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError, copy.failedClearNotifications));
    } finally {
      setClearing(false);
    }
  }, [clearing, copy.failedClearNotifications, items.length, userId]);

  const notificationCards = useMemo<NotificationCardModel[]>(() => (
    items.map((notification) => {
      const data = parseNotificationData(notification.data);
      const type = resolveNotificationType(notification, data);
      const visual = getNotificationVisual(type);
      const localizedText = localizeNotificationText(notification, language);
      const responseStatus = getNotificationResponseStatus(data);
      const friendshipId = toPositiveInt(data.friendshipId);
      const isChallengeInvite = type === 'friend_challenge_invite';
      const showFriendRequestActions = isFriendRequestNotification(type, data) && !responseStatus;
      const showChallengeInviteActions = isChallengeInvite && !responseStatus;
      const actionBusy = actioningNotificationId === notification.id
        || (!!friendshipId && actioningFriendshipId === friendshipId);

      return {
        id: notification.id,
        type,
        title: localizedText.title,
        message: localizedText.message,
        timeLabel: formatNotificationTime(notification.created_at, language),
        unread: Boolean(notification.unread),
        visual,
        metadata: buildNotificationMetadata(type, data, language),
        note: showChallengeInviteActions ? copy.challengeInvitePendingNote : undefined,
        statusLabel: responseStatus
          ? {
            label: isChallengeInvite
              ? (
                responseStatus === 'accepted'
                  ? copy.challengeInviteAccepted
                  : responseStatus === 'cancelled'
                    ? copy.challengeInviteCancelled
                    : copy.challengeInviteDeclined
              )
              : (responseStatus === 'accepted' ? copy.requestAccepted : copy.requestDeclined),
            tone: responseStatus === 'accepted'
              ? 'success'
              : responseStatus === 'cancelled'
                ? 'warning'
                : 'neutral',
          }
          : undefined,
        actions: showFriendRequestActions
          ? [
            {
              id: 'accept',
              label: actionBusy ? copy.processing : copy.accept,
              tone: 'primary',
              disabled: actionBusy,
            },
            {
              id: 'decline',
              label: copy.decline,
              tone: 'secondary',
              disabled: actionBusy,
            },
          ]
          : showChallengeInviteActions
            ? [
              {
                id: 'accept',
                label: actionBusy ? copy.processing : copy.challengeInviteAcceptButton,
                tone: 'primary',
                disabled: actionBusy,
              },
              {
                id: 'decline',
                label: copy.challengeInviteRefuseButton,
                tone: 'secondary',
                disabled: actionBusy,
              },
            ]
            : undefined,
      };
    })
  ), [
    actioningFriendshipId,
    actioningNotificationId,
    copy.accept,
    copy.challengeInviteAcceptButton,
    copy.challengeInviteAccepted,
    copy.challengeInviteCancelled,
    copy.challengeInviteDeclined,
    copy.challengeInvitePendingNote,
    copy.challengeInviteRefuseButton,
    copy.decline,
    copy.processing,
    copy.requestAccepted,
    copy.requestDeclined,
    items,
    language,
  ]);

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="flex min-h-screen flex-1 flex-col bg-background pb-24">
      <div className="px-4 pt-2 sm:px-6">
        <Header
          title={copy.title}
          onBack={onBack}
          rightElement={(
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={clearing || items.length === 0}
              className="min-h-10 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 text-[11px] font-semibold text-rose-200 transition-colors hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
            >
              {clearing ? copy.clearing : copy.clearAll}
            </button>
          )}
        />
      </div>

      <div className="space-y-4 px-4 sm:px-6">
        <Card className="overflow-hidden rounded-[1.8rem] border-white/10 bg-card/75 p-0">
          <div className="relative px-5 py-5">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(188,255,0,0.12),transparent_45%)]"
              aria-hidden="true"
            />
            <div className={cx('relative z-10 flex items-start justify-between gap-4', isArabic && 'flex-row-reverse')}>
              <div className={cx('space-y-2', isArabic ? 'text-right' : 'text-left')}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                  RepSet
                </p>
                <h2 className="text-base font-semibold text-white">{copy.subtitle}</h2>
              </div>

              <div className={cx('shrink-0 rounded-2xl border px-3 py-2 text-center', unreadCount > 0 ? 'border-accent/20 bg-accent/10' : 'border-white/10 bg-white/5')}>
                <div className={cx('text-lg font-semibold', unreadCount > 0 ? 'text-accent' : 'text-white')}>
                  {unreadCount}
                </div>
                <div className="text-[10px] text-text-tertiary">
                  {unreadCount > 0 ? copy.unreadCount(unreadCount) : copy.allCaughtUp}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {loading ? (
          <Card className="rounded-[1.8rem] border-white/10 bg-card/70">
            <div className={cx('flex items-center gap-3', isArabic && 'flex-row-reverse')}>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <LoaderCircle size={20} className="animate-spin text-text-secondary" />
              </div>
              <div className={cx('space-y-1', isArabic ? 'text-right' : 'text-left')}>
                <div className="text-sm font-semibold text-white">{copy.loadingTitle}</div>
                <div className="text-sm text-text-secondary">{copy.loadingBody}</div>
              </div>
            </div>
          </Card>
        ) : null}

        {!loading && error ? (
          <Card className="rounded-[1.8rem] border border-rose-500/20 bg-rose-500/10 text-sm text-rose-200">
            <div className={isArabic ? 'text-right' : 'text-left'}>{error}</div>
          </Card>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <NotificationEmptyState title={copy.emptyTitle} body={copy.emptyBody} isRtl={isArabic} />
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <motion.section layout aria-live="polite" className="space-y-3">
            <AnimatePresence initial={false}>
              {notificationCards.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  isRtl={isArabic}
                  onOpen={handleOpenNotification}
                  onAction={handleNotificationAction}
                />
              ))}
            </AnimatePresence>
          </motion.section>
        ) : null}
      </div>

      <ClearNotificationsDialog
        open={showClearConfirm}
        title={copy.clearDialogTitle}
        message={copy.clearDialogMessage}
        cancelLabel={copy.cancel}
        confirmLabel={copy.removeAll}
        busyLabel={copy.removing}
        busy={clearing}
        isRtl={isArabic}
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={() => void handleClearAll()}
      />

      {challengeIntroTitle ? (
        <div className="fixed inset-0 z-[70] bg-black">
          <img
            src={challengeHeroImage}
            alt={challengeIntroTitle}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
    </div>
  );
}
