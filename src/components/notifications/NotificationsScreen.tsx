import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import challengeHeroImage from '../../../assets/Workout/CHALLENGE.png';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { Bell, Dumbbell, MessageSquare, Trophy, Gift, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';
import { AppLanguage, getActiveLanguage, getStoredLanguage, pickLanguage } from '../../services/language';

interface NotificationsScreenProps {
  onBack: () => void;
  onOpenAcceptedChallenge?: (challenge: {
    friendId: number;
    friendName: string;
    challengeKey: string;
    challengeTitle: string;
    challengeSessionId: number;
  }) => void;
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
type ChallengeInviteTerminalStatus = 'accepted' | 'declined' | 'cancelled';

type ApiLikeError = Error & {
  status?: number;
  data?: unknown;
};

const iconByType: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string }> = {
  message: { icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  coach_message: { icon: Bell, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  coach_session_note: { icon: Bell, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  friend_request: { icon: Dumbbell, color: 'text-accent', bg: 'bg-accent/10' },
  friend_accept: { icon: Trophy, color: 'text-green-500', bg: 'bg-green-500/10' },
  plan_review_request: { icon: Bell, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  plan_coach_request_sent: { icon: Bell, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  plan_created_by_coach: { icon: Trophy, color: 'text-green-500', bg: 'bg-green-500/10' },
  plan_review_approved: { icon: Trophy, color: 'text-green-500', bg: 'bg-green-500/10' },
  plan_review_rejected: { icon: Gift, color: 'text-red-500', bg: 'bg-red-500/10' },
  friend_challenge_invite: { icon: TrendingUp, color: 'text-accent', bg: 'bg-accent/10' },
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

const resolveNotificationType = (notification: AppNotification, data: Record<string, unknown>) => {
  const normalizedType = String(notification.type || '').trim().toLowerCase();
  if (normalizedType) return normalizedType;

  const title = String(notification.title || '').trim();
  if (
    title === 'New Challenge'
    && Number(data.senderUserId || 0) > 0
    && String(data.challengeKey || '').trim()
  ) {
    return 'friend_challenge_invite';
  }

  if (
    (title === 'Challenge Accepted' || title === 'Challenge Declined' || title === 'Challenge Cancelled')
    && Number(data.receiverNotificationId || 0) > 0
    && String(data.challengeKey || '').trim()
  ) {
    return 'friend_challenge_response';
  }

  return normalizedType;
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

const toChallengeInviteTerminalStatus = (value: unknown): ChallengeInviteTerminalStatus | null => {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'accepted' || status === 'declined' || status === 'cancelled') return status;
  return null;
};

const getChallengeInviteConflictStatus = (error: unknown): ChallengeInviteTerminalStatus | null => {
  const apiError = error as ApiLikeError;
  if (apiError?.status !== 409) return null;
  const data = (apiError?.data && typeof apiError.data === 'object')
    ? (apiError.data as Record<string, unknown>)
    : {};
  return toChallengeInviteTerminalStatus(data.status);
};

const NOTIFICATIONS_I18N = {
  en: {
    title: 'Notifications',
    noActiveSession: 'No active user session found.',
    failedLoadNotifications: 'Failed to load notifications',
    failedAcceptRequest: 'Failed to accept friend request',
    failedDeclineRequest: 'Failed to decline friend request',
    acceptedFriendRequestMessage: 'You accepted this friend request.',
    declinedFriendRequestMessage: 'You declined this friend request.',
    failedClearNotifications: 'Failed to clear notifications',
    clearing: 'Clearing...',
    clearAll: 'Clear All',
    loadingNotifications: 'Loading notifications...',
    noNotificationsYet: 'No notifications yet.',
    processing: 'Processing...',
    accept: 'Accept',
    decline: 'Decline',
    requestAccepted: 'Request accepted',
    requestDeclined: 'Request declined',
    clearDialogTitle: 'Remove all notifications?',
    clearDialogMessage: 'This will permanently delete all notifications.',
    cancel: 'Cancel',
    removing: 'Removing...',
    removeAll: 'Remove All',
    justNow: 'Just now',
    minutesAgo: 'm ago',
    hoursAgo: 'h ago',
    daysAgo: 'd ago',
    failedAcceptChallengeInvite: 'Failed to accept challenge invite',
    failedDeclineChallengeInvite: 'Failed to decline challenge invite',
    acceptedChallengeInviteMessage: 'You accepted this challenge invite.',
    declinedChallengeInviteMessage: 'You declined this challenge invite.',
    cancelledChallengeInviteMessage: 'This challenge invite expired after 5 minutes.',
    challengeInviteAccepted: 'Challenge accepted',
    challengeInviteDeclined: 'Challenge declined',
    challengeInviteCancelled: 'Challenge cancelled',
    challengeInvitePendingNote: 'If you accept, both of you count only your own turn.',
    challengeInviteAcceptButton: 'Accept',
    challengeInviteRefuseButton: 'Refuse',
  },
  ar: {
    title: 'الإشعارات',
    noActiveSession: 'لا توجد جلسة مستخدم نشطة.',
    failedLoadNotifications: 'فشل تحميل الإشعارات',
    failedAcceptRequest: 'فشل قبول طلب الصداقة',
    failedDeclineRequest: 'فشل رفض طلب الصداقة',
    acceptedFriendRequestMessage: 'لقد قبلت طلب الصداقة هذا.',
    declinedFriendRequestMessage: 'لقد رفضت طلب الصداقة هذا.',
    failedClearNotifications: 'فشل مسح الإشعارات',
    clearing: 'جارٍ المسح...',
    clearAll: 'مسح الكل',
    loadingNotifications: 'جارٍ تحميل الإشعارات...',
    noNotificationsYet: 'لا توجد إشعارات بعد.',
    processing: 'جارٍ المعالجة...',
    accept: 'قبول',
    decline: 'رفض',
    requestAccepted: 'تم قبول الطلب',
    requestDeclined: 'تم رفض الطلب',
    clearDialogTitle: 'إزالة كل الإشعارات؟',
    clearDialogMessage: 'سيؤدي هذا إلى حذف جميع الإشعارات نهائيًا.',
    cancel: 'إلغاء',
    removing: 'جارٍ الإزالة...',
    removeAll: 'إزالة الكل',
    justNow: 'الآن',
    minutesAgo: 'د قبل',
    hoursAgo: 'س قبل',
    daysAgo: 'ي قبل',
  },
  it: {
    title: 'Notifiche',
    noActiveSession: 'Nessuna sessione utente attiva trovata.',
    failedLoadNotifications: 'Impossibile caricare le notifiche',
    failedAcceptRequest: 'Impossibile accettare la richiesta di amicizia',
    failedDeclineRequest: 'Impossibile rifiutare la richiesta di amicizia',
    acceptedFriendRequestMessage: 'Hai accettato questa richiesta di amicizia.',
    declinedFriendRequestMessage: 'Hai rifiutato questa richiesta di amicizia.',
    failedClearNotifications: 'Impossibile cancellare le notifiche',
    clearing: 'Pulizia...',
    clearAll: 'Cancella Tutto',
    loadingNotifications: 'Caricamento notifiche...',
    noNotificationsYet: 'Nessuna notifica ancora.',
    processing: 'Elaborazione...',
    accept: 'Accetta',
    decline: 'Rifiuta',
    requestAccepted: 'Richiesta accettata',
    requestDeclined: 'Richiesta rifiutata',
    clearDialogTitle: 'Rimuovere tutte le notifiche?',
    clearDialogMessage: 'Questo eliminera permanentemente tutte le notifiche.',
    cancel: 'Annulla',
    removing: 'Rimozione...',
    removeAll: 'Rimuovi Tutto',
    justNow: 'Ora',
    minutesAgo: 'm fa',
    hoursAgo: 'h fa',
    daysAgo: 'g fa',
  },
  de: {
    title: 'Benachrichtigungen',
    noActiveSession: 'Keine aktive Benutzersitzung gefunden.',
    failedLoadNotifications: 'Benachrichtigungen konnten nicht geladen werden',
    failedAcceptRequest: 'Freundschaftsanfrage konnte nicht angenommen werden',
    failedDeclineRequest: 'Freundschaftsanfrage konnte nicht abgelehnt werden',
    acceptedFriendRequestMessage: 'Du hast diese Freundschaftsanfrage angenommen.',
    declinedFriendRequestMessage: 'Du hast diese Freundschaftsanfrage abgelehnt.',
    failedClearNotifications: 'Benachrichtigungen konnten nicht geloescht werden',
    clearing: 'Loeschen...',
    clearAll: 'Alle Loeschen',
    loadingNotifications: 'Benachrichtigungen werden geladen...',
    noNotificationsYet: 'Noch keine Benachrichtigungen.',
    processing: 'Verarbeitung...',
    accept: 'Annehmen',
    decline: 'Ablehnen',
    requestAccepted: 'Anfrage angenommen',
    requestDeclined: 'Anfrage abgelehnt',
    clearDialogTitle: 'Alle Benachrichtigungen entfernen?',
    clearDialogMessage: 'Dadurch werden alle Benachrichtigungen dauerhaft geloescht.',
    cancel: 'Abbrechen',
    removing: 'Wird entfernt...',
    removeAll: 'Alle Entfernen',
    justNow: 'Gerade eben',
    minutesAgo: ' Min',
    hoursAgo: ' Std',
    daysAgo: ' Tg',
  },
} as const;

const NOTIFICATION_TYPE_AR_COPY: Record<string, { title?: string; message?: string }> = {
  message: {
    title: 'رسالة جديدة',
    message: 'لديك رسالة جديدة.',
  },
  friend_request: {
    title: 'طلب صداقة جديد',
    message: 'لديك طلب صداقة جديد.',
  },
  friend_accept: {
    title: 'تم قبول طلب الصداقة',
    message: 'تم قبول طلب الصداقة الخاص بك.',
  },
  plan_review_request: {
    title: 'طلب مراجعة الخطة',
    message: 'تم إرسال خطة جديدة للمراجعة.',
  },
  plan_coach_request_sent: {
    title: 'تم إرسال طلب الخطة',
    message: 'تم إرسال طلبك إلى المدرب.',
  },
  plan_created_by_coach: {
    title: 'خطة جديدة من مدربك',
    message: 'أنشأ مدربك خطة تدريب جديدة وفعّلها لك.',
  },
  plan_review_approved: {
    title: 'تمت الموافقة على الخطة',
    message: 'تمت الموافقة على خطتك الجديدة.',
  },
  plan_review_rejected: {
    title: 'تم رفض الخطة',
    message: 'تم رفض الخطة. راجع التفاصيل وأعد الإرسال.',
  },
};

const EXACT_NOTIFICATION_TEXT_AR: Record<string, string> = {
  'New plan from your coach': 'خطة جديدة من مدربك',
  'Your coach created and activated a new training plan for you.': 'أنشأ مدربك خطة تدريب جديدة وفعّلها لك.',
};

const localizeNotificationText = (notif: AppNotification, language: AppLanguage) => {
  const data = parseNotificationData(notif.data);
  const notificationType = resolveNotificationType(notif, data);
  const challengeTitle = String(data.challengeTitle || 'Challenge').trim() || 'Challenge';
  const senderName = String(data.senderName || 'Friend').trim() || 'Friend';
  const responseStatus = String(data.responseStatus || '').trim().toLowerCase();

  if (notificationType === 'friend_challenge_invite') {
    const localized = pickLanguage(language, {
      en: {
        title: 'New Challenge',
        message: `${senderName} challenged you to ${challengeTitle}`,
      },
      ar: {
        title: 'تحدٍ جديد',
        message: `${senderName} تحداك في ${challengeTitle}`,
      },
      it: {
        title: 'Nuova sfida',
        message: `${senderName} ti ha sfidato in ${challengeTitle}`,
      },
      de: {
        title: 'Neue Challenge',
        message: `${senderName} hat dich zu ${challengeTitle} herausgefordert`,
      },
    });

    return localized;
  }

  if (notificationType === 'friend_challenge_response') {
    const localized = pickLanguage(language, {
      en: {
        accepted: { title: 'Challenge Accepted', message: `${challengeTitle} was accepted.` },
        declined: { title: 'Challenge Declined', message: `${challengeTitle} was declined.` },
        cancelled: { title: 'Challenge Cancelled', message: `${challengeTitle} expired after 5 minutes.` },
      },
      ar: {
        accepted: { title: 'تم قبول التحدي', message: `تم قبول ${challengeTitle}.` },
        declined: { title: 'تم رفض التحدي', message: `تم رفض ${challengeTitle}.` },
        cancelled: { title: 'تم إلغاء التحدي', message: `انتهى ${challengeTitle} بعد 5 دقائق.` },
      },
      it: {
        accepted: { title: 'Sfida accettata', message: `${challengeTitle} e stata accettata.` },
        declined: { title: 'Sfida rifiutata', message: `${challengeTitle} e stata rifiutata.` },
        cancelled: { title: 'Sfida annullata', message: `${challengeTitle} e scaduta dopo 5 minuti.` },
      },
      de: {
        accepted: { title: 'Challenge angenommen', message: `${challengeTitle} wurde angenommen.` },
        declined: { title: 'Challenge abgelehnt', message: `${challengeTitle} wurde abgelehnt.` },
        cancelled: { title: 'Challenge abgebrochen', message: `${challengeTitle} ist nach 5 Minuten abgelaufen.` },
      },
    });

    if (responseStatus === 'accepted' || responseStatus === 'declined' || responseStatus === 'cancelled') {
      return localized[responseStatus];
    }
  }

  if (language !== 'ar') {
    return { title: notif.title, message: notif.message };
  }

  const byType = NOTIFICATION_TYPE_AR_COPY[notif.type] || {};
  const localizedTitle = byType.title || EXACT_NOTIFICATION_TEXT_AR[notif.title] || notif.title;
  const localizedMessage = byType.message || EXACT_NOTIFICATION_TEXT_AR[notif.message] || notif.message;
  return {
    title: localizedTitle,
    message: localizedMessage,
  };
};

const formatTimeAgo = (value: string, language: AppLanguage) => {
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return '';
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const copy = NOTIFICATIONS_I18N[language] || NOTIFICATIONS_I18N.en;
  if (diffMin < 1) return copy.justNow;
  if (diffMin < 60) return `${diffMin}${copy.minutesAgo}`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}${copy.hoursAgo}`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}${copy.daysAgo}`;
  return new Date(value).toLocaleDateString();
};

export function NotificationsScreen({ onBack, onOpenAcceptedChallenge }: NotificationsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<AppNotification[]>([]);
  const [actioningNotificationId, setActioningNotificationId] = useState<number | null>(null);
  const [actioningFriendshipId, setActioningFriendshipId] = useState<number | null>(null);
  const [challengeIntroTitle, setChallengeIntroTitle] = useState('');
  const [acceptedChallenge, setAcceptedChallenge] = useState<{
    friendId: number;
    friendName: string;
    challengeKey: string;
    challengeTitle: string;
    challengeSessionId: number;
  } | null>(null);
  const pendingFriendshipIdsRef = useRef<Set<number>>(new Set());
  const [language, setLanguage] = useState<AppLanguage>('en');
  const copy = NOTIFICATIONS_I18N[language] || NOTIFICATIONS_I18N.en;
  const copyWithFallbacks = copy as typeof copy & {
    failedAcceptChallengeInvite?: string;
    failedDeclineChallengeInvite?: string;
    acceptedChallengeInviteMessage?: string;
    declinedChallengeInviteMessage?: string;
    cancelledChallengeInviteMessage?: string;
    challengeInviteAccepted?: string;
    challengeInviteDeclined?: string;
    challengeInviteCancelled?: string;
    challengeInvitePendingNote?: string;
    challengeInviteAcceptButton?: string;
    challengeInviteRefuseButton?: string;
  };
  const localizedChallengeInviteCopy = useMemo(
    () => pickLanguage(language, {
      en: {
        failedAcceptChallengeInvite: 'Failed to accept challenge invite',
        failedDeclineChallengeInvite: 'Failed to decline challenge invite',
        acceptedChallengeInviteMessage: 'You accepted this challenge invite.',
        declinedChallengeInviteMessage: 'You declined this challenge invite.',
        cancelledChallengeInviteMessage: 'This challenge invite expired after 5 minutes.',
        challengeInviteAccepted: 'Challenge accepted',
        challengeInviteDeclined: 'Challenge declined',
        challengeInviteCancelled: 'Challenge cancelled',
        challengeInvitePendingNote: 'If you accept, both of you count only your own turn.',
        challengeInviteAcceptButton: 'Accept',
        challengeInviteRefuseButton: 'Refuse',
      },
      ar: {
        failedAcceptChallengeInvite: 'فشل قبول دعوة التحدي',
        failedDeclineChallengeInvite: 'فشل رفض دعوة التحدي',
        acceptedChallengeInviteMessage: 'لقد قبلت دعوة التحدي هذه.',
        declinedChallengeInviteMessage: 'لقد رفضت دعوة التحدي هذه.',
        cancelledChallengeInviteMessage: 'انتهت دعوة التحدي بعد 5 دقائق.',
        challengeInviteAccepted: 'تم قبول التحدي',
        challengeInviteDeclined: 'تم رفض التحدي',
        challengeInviteCancelled: 'تم إلغاء التحدي',
        challengeInvitePendingNote: 'إذا قبلت، فكل واحد منكما يسجل دوره فقط.',
        challengeInviteAcceptButton: 'قبول',
        challengeInviteRefuseButton: 'رفض',
      },
      it: {
        failedAcceptChallengeInvite: 'Impossibile accettare l invito alla sfida',
        failedDeclineChallengeInvite: 'Impossibile rifiutare l invito alla sfida',
        acceptedChallengeInviteMessage: 'Hai accettato questo invito alla sfida.',
        declinedChallengeInviteMessage: 'Hai rifiutato questo invito alla sfida.',
        cancelledChallengeInviteMessage: 'Questo invito alla sfida e scaduto dopo 5 minuti.',
        challengeInviteAccepted: 'Sfida accettata',
        challengeInviteDeclined: 'Sfida rifiutata',
        challengeInviteCancelled: 'Sfida annullata',
        challengeInvitePendingNote: 'Se accetti, ognuno di voi conta solo il proprio turno.',
        challengeInviteAcceptButton: 'Accetta',
        challengeInviteRefuseButton: 'Rifiuta',
      },
      de: {
        failedAcceptChallengeInvite: 'Die Challenge-Einladung konnte nicht angenommen werden',
        failedDeclineChallengeInvite: 'Die Challenge-Einladung konnte nicht abgelehnt werden',
        acceptedChallengeInviteMessage: 'Du hast diese Challenge-Einladung angenommen.',
        declinedChallengeInviteMessage: 'Du hast diese Challenge-Einladung abgelehnt.',
        cancelledChallengeInviteMessage: 'Diese Challenge-Einladung ist nach 5 Minuten abgelaufen.',
        challengeInviteAccepted: 'Challenge angenommen',
        challengeInviteDeclined: 'Challenge abgelehnt',
        challengeInviteCancelled: 'Challenge abgebrochen',
        challengeInvitePendingNote: 'Wenn du annimmst, zahlt jeder nur seinen eigenen Zug.',
        challengeInviteAcceptButton: 'Annehmen',
        challengeInviteRefuseButton: 'Ablehnen',
      },
    }),
    [language],
  );
  const failedAcceptChallengeInvite =
    copyWithFallbacks.failedAcceptChallengeInvite || localizedChallengeInviteCopy.failedAcceptChallengeInvite;
  const failedDeclineChallengeInvite =
    copyWithFallbacks.failedDeclineChallengeInvite || localizedChallengeInviteCopy.failedDeclineChallengeInvite;
  const acceptedChallengeInviteMessage =
    copyWithFallbacks.acceptedChallengeInviteMessage || localizedChallengeInviteCopy.acceptedChallengeInviteMessage;
  const declinedChallengeInviteMessage =
    copyWithFallbacks.declinedChallengeInviteMessage || localizedChallengeInviteCopy.declinedChallengeInviteMessage;
  const cancelledChallengeInviteMessage =
    copyWithFallbacks.cancelledChallengeInviteMessage || localizedChallengeInviteCopy.cancelledChallengeInviteMessage;
  const challengeInviteAcceptedLabel =
    copyWithFallbacks.challengeInviteAccepted || localizedChallengeInviteCopy.challengeInviteAccepted;
  const challengeInviteDeclinedLabel =
    copyWithFallbacks.challengeInviteDeclined || localizedChallengeInviteCopy.challengeInviteDeclined;
  const challengeInviteCancelledLabel =
    copyWithFallbacks.challengeInviteCancelled || localizedChallengeInviteCopy.challengeInviteCancelled;
  const challengeInvitePendingNote =
    copyWithFallbacks.challengeInvitePendingNote || localizedChallengeInviteCopy.challengeInvitePendingNote;
  const challengeInviteAcceptButton =
    copyWithFallbacks.challengeInviteAcceptButton || localizedChallengeInviteCopy.challengeInviteAcceptButton;
  const challengeInviteRefuseButton =
    copyWithFallbacks.challengeInviteRefuseButton || localizedChallengeInviteCopy.challengeInviteRefuseButton;

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
    if (!challengeIntroTitle) return undefined;

    const timer = window.setTimeout(() => {
      setChallengeIntroTitle('');
      if (acceptedChallenge && onOpenAcceptedChallenge) {
        onOpenAcceptedChallenge(acceptedChallenge);
      }
      setAcceptedChallenge(null);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [acceptedChallenge, challengeIntroTitle, onOpenAcceptedChallenge]);

  const userId = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      return Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || user?.id || 0);
    } catch {
      return 0;
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    const currentCopy = NOTIFICATIONS_I18N[language] || NOTIFICATIONS_I18N.en;
    if (!userId) {
      setError(currentCopy.noActiveSession);
      setLoading(false);
      return;
    }
    try {
      setError('');
      const data = await api.getNotifications(userId);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(getErrorMessage(e, currentCopy.failedLoadNotifications));
    } finally {
      setLoading(false);
    }
  }, [language, userId]);

  useEffect(() => {
    setLoading(true);
    void fetchNotifications();
    const refresh = window.setInterval(() => {
      void fetchNotifications();
    }, 10000);
    return () => window.clearInterval(refresh);
  }, [fetchNotifications]);

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
          setError(
            getErrorMessage(
              e,
              action === 'accept' ? copy.failedAcceptRequest : copy.failedDeclineRequest,
            ),
          );
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
  };

  const handleChallengeInviteResponse = async (
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
        resolvedStatus = toChallengeInviteTerminalStatus(response?.status) || resolvedStatus;
        resolvedTitle = String(response?.challengeTitle || resolvedTitle).trim() || resolvedTitle;
        resolvedChallengeKey = String(response?.challengeKey || resolvedChallengeKey).trim().toLowerCase();
        resolvedSenderId = toPositiveInt(response?.senderUserId) || resolvedSenderId;
        resolvedSenderName = String(response?.senderName || resolvedSenderName).trim() || resolvedSenderName;
        resolvedSessionId = toPositiveInt(response?.sessionId) || resolvedSessionId;
      } catch (e) {
        const conflictStatus = getChallengeInviteConflictStatus(e);
        if (!conflictStatus) {
          setError(
            getErrorMessage(
              e,
              action === 'accept' ? failedAcceptChallengeInvite : failedDeclineChallengeInvite,
            ),
          );
          return;
        }
        resolvedStatus = conflictStatus;
      }

      setItems((prev) => prev.map((item) => {
        if (item.id !== notification.id) return item;
        const itemData = parseNotificationData(item.data);
        return {
          ...item,
          unread: false,
          message: resolvedStatus === 'accepted'
            ? acceptedChallengeInviteMessage
            : resolvedStatus === 'cancelled'
              ? cancelledChallengeInviteMessage
              : declinedChallengeInviteMessage,
          data: {
            ...itemData,
            responseStatus: resolvedStatus,
            challengeTitle: resolvedTitle,
            sessionId: resolvedSessionId,
          },
        };
      }));

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
  };

  const handleClearAll = async () => {
    if (!userId || !items.length || clearing) return;

    try {
      setClearing(true);
      await api.clearNotifications(userId);
      setItems([]);
      setShowClearConfirm(false);
    } catch (e) {
      setError(getErrorMessage(e, copy.failedClearNotifications));
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header
          title={copy.title}
          onBack={onBack}
          rightElement={
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={clearing || items.length === 0}
              className="text-[11px] sm:text-xs px-2.5 sm:px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {clearing ? copy.clearing : copy.clearAll}
            </button>
          }
        />
      </div>

      <div className="px-4 sm:px-6 space-y-3">
        {loading && <div className="text-sm text-text-secondary">{copy.loadingNotifications}</div>}
        {!loading && error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">{error}</div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="text-sm text-text-secondary">{copy.noNotificationsYet}</div>
        )}

        {!loading && !error && items.map((notif) => {
          const data = parseNotificationData(notif.data);
          const notificationType = resolveNotificationType(notif, data);
          const visual = iconByType[notificationType] || { icon: TrendingUp, color: 'text-accent', bg: 'bg-accent/10' };
          const Icon = visual.icon;
          const friendshipId = toPositiveInt(data.friendshipId);
          const requestType = String(data.requestType || '').trim().toLowerCase();
          const responseStatus = String(data.responseStatus || '').trim().toLowerCase();
          const isHandled = responseStatus === 'accepted' || responseStatus === 'declined' || responseStatus === 'cancelled';
          const isFriendRequest =
            notificationType === 'friend_request'
            && !!friendshipId
            && (!requestType || requestType === 'friendship');
          const showFriendRequestActions = isFriendRequest && !isHandled;
          const isChallengeInvite = notificationType === 'friend_challenge_invite';
          const showChallengeInviteActions = isChallengeInvite && !isHandled;
          const actionBusy =
            actioningNotificationId === notif.id
            || (!!friendshipId && actioningFriendshipId === friendshipId);
          const localizedNotif = localizeNotificationText(notif, language);

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
                    {localizedNotif.title}
                  </h4>
                  <span className="text-[10px] text-text-tertiary shrink-0">{formatTimeAgo(notif.created_at, language)}</span>
                </div>
                <p className="text-xs sm:text-sm text-text-secondary mt-1 leading-relaxed break-words [overflow-wrap:anywhere]">
                  {localizedNotif.message}
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
                      {actionBusy ? copy.processing : copy.accept}
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
                      {copy.decline}
                    </button>
                  </div>
                )}

                {showChallengeInviteActions && (
                  <div className="mt-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleChallengeInviteResponse(notif, 'accept');
                        }}
                        className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold bg-accent text-black hover:bg-accent/90 disabled:opacity-60"
                      >
                        {actionBusy ? copy.processing : challengeInviteAcceptButton}
                      </button>
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleChallengeInviteResponse(notif, 'decline');
                        }}
                        className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold border border-white/15 text-text-secondary hover:bg-white/5 disabled:opacity-60"
                      >
                        {challengeInviteRefuseButton}
                      </button>
                    </div>
                    <div className="mt-2 text-[11px] text-text-tertiary">
                      {challengeInvitePendingNote}
                    </div>
                  </div>
                )}

                {isHandled && (
                  <div className="mt-2 text-[11px] text-text-tertiary">
                    {isChallengeInvite
                      ? (
                        responseStatus === 'accepted'
                          ? challengeInviteAcceptedLabel
                          : responseStatus === 'cancelled'
                            ? challengeInviteCancelledLabel
                            : challengeInviteDeclinedLabel
                      )
                      : (responseStatus === 'accepted' ? copy.requestAccepted : copy.requestDeclined)}
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
            <h3 className="text-white font-semibold text-base">{copy.clearDialogTitle}</h3>
            <p className="text-sm text-text-secondary">
              {copy.clearDialogMessage}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={clearing}
                onClick={() => setShowClearConfirm(false)}
                className="w-full rounded-xl py-2.5 bg-white/5 border border-white/10 text-text-primary hover:bg-white/10 disabled:opacity-50"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                disabled={clearing}
                onClick={() => void handleClearAll()}
                className="w-full rounded-xl py-2.5 bg-accent text-black border border-accent/40 hover:bg-accent/90 disabled:opacity-50"
              >
                {clearing ? copy.removing : copy.removeAll}
              </button>
            </div>
          </div>
        </div>
      )}

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
