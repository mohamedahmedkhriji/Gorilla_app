import {
  Bell,
  Dumbbell,
  Flame,
  Gift,
  HeartPulse,
  Medal,
  MessageSquare,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
} from 'lucide-react';
import { AppLanguage, getLanguageLocale, pickLanguage } from '../../services/language';
import type {
  AppNotification,
  NotificationActionStatus,
  NotificationData,
  NotificationMetaChip,
  NotificationType,
  NotificationVisual,
} from './types';

const KNOWN_NOTIFICATION_TYPES: NotificationType[] = [
  'message',
  'coach_message',
  'coach_session_note',
  'friend_request',
  'friend_accept',
  'plan_review_request',
  'plan_coach_request_sent',
  'plan_created_by_coach',
  'plan_review_approved',
  'plan_review_rejected',
  'friend_challenge_invite',
  'friend_challenge_response',
  'mission_completed',
  'workout_reminder',
  'recovery_alert',
  'leaderboard_update',
  'challenge_invite',
  'system',
];

const NOTIFICATION_TYPE_ALIASES: Record<string, NotificationType> = {
  workout: 'workout_reminder',
  workout_notification: 'workout_reminder',
  recovery: 'recovery_alert',
  leaderboard: 'leaderboard_update',
  mission: 'mission_completed',
  friend_challenge: 'friend_challenge_invite',
};

const NOTIFICATION_VISUALS: Record<NotificationType, NotificationVisual> = {
  message: {
    icon: MessageSquare,
    iconClassName: 'text-sky-300',
    backgroundClassName: 'bg-sky-500/12 ring-1 ring-sky-400/20',
  },
  coach_message: {
    icon: Bell,
    iconClassName: 'text-emerald-300',
    backgroundClassName: 'bg-emerald-500/12 ring-1 ring-emerald-400/20',
  },
  coach_session_note: {
    icon: Bell,
    iconClassName: 'text-emerald-300',
    backgroundClassName: 'bg-emerald-500/12 ring-1 ring-emerald-400/20',
  },
  friend_request: {
    icon: UserPlus,
    iconClassName: 'text-accent',
    backgroundClassName: 'bg-accent/12 ring-1 ring-accent/20',
  },
  friend_accept: {
    icon: Trophy,
    iconClassName: 'text-emerald-300',
    backgroundClassName: 'bg-emerald-500/12 ring-1 ring-emerald-400/20',
  },
  plan_review_request: {
    icon: Target,
    iconClassName: 'text-amber-300',
    backgroundClassName: 'bg-amber-500/12 ring-1 ring-amber-400/20',
  },
  plan_coach_request_sent: {
    icon: Target,
    iconClassName: 'text-amber-300',
    backgroundClassName: 'bg-amber-500/12 ring-1 ring-amber-400/20',
  },
  plan_created_by_coach: {
    icon: Trophy,
    iconClassName: 'text-emerald-300',
    backgroundClassName: 'bg-emerald-500/12 ring-1 ring-emerald-400/20',
  },
  plan_review_approved: {
    icon: Trophy,
    iconClassName: 'text-emerald-300',
    backgroundClassName: 'bg-emerald-500/12 ring-1 ring-emerald-400/20',
  },
  plan_review_rejected: {
    icon: Gift,
    iconClassName: 'text-rose-300',
    backgroundClassName: 'bg-rose-500/12 ring-1 ring-rose-400/20',
  },
  friend_challenge_invite: {
    icon: Flame,
    iconClassName: 'text-orange-300',
    backgroundClassName: 'bg-orange-500/12 ring-1 ring-orange-400/20',
  },
  friend_challenge_response: {
    icon: Flame,
    iconClassName: 'text-orange-300',
    backgroundClassName: 'bg-orange-500/12 ring-1 ring-orange-400/20',
  },
  mission_completed: {
    icon: TrendingUp,
    iconClassName: 'text-accent',
    backgroundClassName: 'bg-accent/12 ring-1 ring-accent/20',
  },
  workout_reminder: {
    icon: Dumbbell,
    iconClassName: 'text-violet-300',
    backgroundClassName: 'bg-violet-500/12 ring-1 ring-violet-400/20',
  },
  recovery_alert: {
    icon: HeartPulse,
    iconClassName: 'text-cyan-300',
    backgroundClassName: 'bg-cyan-500/12 ring-1 ring-cyan-400/20',
  },
  leaderboard_update: {
    icon: Medal,
    iconClassName: 'text-yellow-300',
    backgroundClassName: 'bg-yellow-500/12 ring-1 ring-yellow-400/20',
  },
  challenge_invite: {
    icon: Flame,
    iconClassName: 'text-orange-300',
    backgroundClassName: 'bg-orange-500/12 ring-1 ring-orange-400/20',
  },
  system: {
    icon: Bell,
    iconClassName: 'text-text-secondary',
    backgroundClassName: 'bg-white/8 ring-1 ring-white/10',
  },
};

const NOTIFICATION_COPY = {
  en: {
    title: 'Notifications',
    subtitle: 'Stay on top of requests, recovery alerts, and mission momentum.',
    noActiveSession: 'No active user session found.',
    failedLoadNotifications: 'Failed to load notifications.',
    failedAcceptRequest: 'Failed to accept friend request.',
    failedDeclineRequest: 'Failed to decline friend request.',
    acceptedFriendRequestMessage: 'You accepted this friend request.',
    declinedFriendRequestMessage: 'You declined this friend request.',
    failedClearNotifications: 'Failed to clear notifications.',
    clearAll: 'Clear all',
    clearing: 'Clearing...',
    loadingTitle: 'Loading notifications',
    loadingBody: 'Fetching your latest activity and requests.',
    emptyTitle: 'No notifications yet',
    emptyBody: 'Mission wins, reminders, and challenges will show up here.',
    unreadCount: (count: number) => `${count} unread`,
    allCaughtUp: 'All caught up',
    processing: 'Processing...',
    accept: 'Accept',
    decline: 'Decline',
    requestAccepted: 'Request accepted',
    requestDeclined: 'Request declined',
    clearDialogTitle: 'Remove all notifications?',
    clearDialogMessage: 'This will permanently delete all notifications.',
    cancel: 'Cancel',
    removeAll: 'Remove all',
    removing: 'Removing...',
    failedAcceptChallengeInvite: 'Failed to accept challenge invite.',
    failedDeclineChallengeInvite: 'Failed to decline challenge invite.',
    acceptedChallengeInviteMessage: 'You accepted this challenge invite.',
    declinedChallengeInviteMessage: 'You declined this challenge invite.',
    cancelledChallengeInviteMessage: 'This challenge invite expired after 5 minutes.',
    challengeInviteAccepted: 'Challenge accepted',
    challengeInviteDeclined: 'Challenge declined',
    challengeInviteCancelled: 'Challenge cancelled',
    challengeInvitePendingNote: 'If you accept, each player only counts their own turn.',
    challengeInviteAcceptButton: 'Accept',
    challengeInviteRefuseButton: 'Decline',
    defaultTitle: 'Notification',
    defaultMessage: 'You have a new update.',
  },
  ar: {
    title: 'الإشعارات',
    subtitle: 'تابع الطلبات والتنبيهات وتقدّمك اليومي في مكان واحد.',
    noActiveSession: 'لا توجد جلسة مستخدم نشطة.',
    failedLoadNotifications: 'فشل تحميل الإشعارات.',
    failedAcceptRequest: 'فشل قبول طلب الصداقة.',
    failedDeclineRequest: 'فشل رفض طلب الصداقة.',
    acceptedFriendRequestMessage: 'لقد قبلت طلب الصداقة هذا.',
    declinedFriendRequestMessage: 'لقد رفضت طلب الصداقة هذا.',
    failedClearNotifications: 'فشل مسح الإشعارات.',
    clearAll: 'مسح الكل',
    clearing: 'جارٍ المسح...',
    loadingTitle: 'جارٍ تحميل الإشعارات',
    loadingBody: 'نحدّث آخر الطلبات والتنبيهات والأنشطة الخاصة بك.',
    emptyTitle: 'لا توجد إشعارات بعد',
    emptyBody: 'ستظهر هنا التحديات والتنبيهات وتحديثات التمرين عندما تصل.',
    unreadCount: (count: number) => `${count} غير مقروءة`,
    allCaughtUp: 'كل شيء مقروء',
    processing: 'جارٍ المعالجة...',
    accept: 'قبول',
    decline: 'رفض',
    requestAccepted: 'تم قبول الطلب',
    requestDeclined: 'تم رفض الطلب',
    clearDialogTitle: 'إزالة كل الإشعارات؟',
    clearDialogMessage: 'سيؤدي هذا إلى حذف جميع الإشعارات نهائيًا.',
    cancel: 'إلغاء',
    removeAll: 'إزالة الكل',
    removing: 'جارٍ الإزالة...',
    failedAcceptChallengeInvite: 'فشل قبول دعوة التحدي.',
    failedDeclineChallengeInvite: 'فشل رفض دعوة التحدي.',
    acceptedChallengeInviteMessage: 'لقد قبلت دعوة التحدي هذه.',
    declinedChallengeInviteMessage: 'لقد رفضت دعوة التحدي هذه.',
    cancelledChallengeInviteMessage: 'انتهت صلاحية دعوة التحدي بعد 5 دقائق.',
    challengeInviteAccepted: 'تم قبول التحدي',
    challengeInviteDeclined: 'تم رفض التحدي',
    challengeInviteCancelled: 'تم إلغاء التحدي',
    challengeInvitePendingNote: 'إذا قبلت، سيُحتسب لكل لاعب دوره الخاص فقط.',
    challengeInviteAcceptButton: 'قبول',
    challengeInviteRefuseButton: 'رفض',
    defaultTitle: 'إشعار',
    defaultMessage: 'لديك تحديث جديد.',
  },
} as const;

const NOTIFICATION_TEXT_BY_LANGUAGE = {
  en: {
    message: { title: 'New message', message: 'You received a new message.' },
    friend_request: { title: 'New friend request', message: 'You have a new friend request.' },
    friend_accept: { title: 'Friend request accepted', message: 'Your friend request was accepted.' },
    plan_review_request: { title: 'Plan review request', message: 'A new training plan was sent for review.' },
    plan_coach_request_sent: { title: 'Plan request sent', message: 'Your plan request was sent to your coach.' },
    plan_created_by_coach: { title: 'New plan from your coach', message: 'Your coach created and activated a new training plan for you.' },
    plan_review_approved: { title: 'Plan approved', message: 'Your training plan was approved.' },
    plan_review_rejected: { title: 'Plan rejected', message: 'Your training plan needs changes before approval.' },
    mission_completed: { title: 'Mission completed', message: 'You earned points for completing a mission.' },
    workout_reminder: { title: 'Workout reminder', message: 'Your next session is ready when you are.' },
    recovery_alert: { title: 'Recovery alert', message: 'Recovery is trending low for one of your key muscle groups.' },
    leaderboard_update: { title: 'Leaderboard update', message: 'Your rank changed on this week’s leaderboard.' },
  },
  ar: {
    message: { title: 'رسالة جديدة', message: 'لديك رسالة جديدة.' },
    friend_request: { title: 'طلب صداقة جديد', message: 'لديك طلب صداقة جديد.' },
    friend_accept: { title: 'تم قبول طلب الصداقة', message: 'تم قبول طلب الصداقة الخاص بك.' },
    plan_review_request: { title: 'طلب مراجعة الخطة', message: 'تم إرسال خطة تدريب جديدة للمراجعة.' },
    plan_coach_request_sent: { title: 'تم إرسال طلب الخطة', message: 'تم إرسال طلبك إلى المدرب.' },
    plan_created_by_coach: { title: 'خطة جديدة من مدربك', message: 'أنشأ مدربك خطة تدريب جديدة وفعّلها لك.' },
    plan_review_approved: { title: 'تمت الموافقة على الخطة', message: 'تمت الموافقة على خطتك الجديدة.' },
    plan_review_rejected: { title: 'تم رفض الخطة', message: 'تم رفض الخطة. راجع التفاصيل وأعد الإرسال.' },
    mission_completed: { title: 'مهمة مكتملة', message: 'حصلت على نقاط بعد إكمال مهمة.' },
    workout_reminder: { title: 'تذكير بالتمرين', message: 'جلسة التمرين التالية جاهزة عندما تكون مستعدًا.' },
    recovery_alert: { title: 'تنبيه التعافي', message: 'التعافي منخفض اليوم لأحد المجموعات العضلية المهمة لديك.' },
    leaderboard_update: { title: 'تحديث لوحة الصدارة', message: 'تغيّر ترتيبك في لوحة الصدارة هذا الأسبوع.' },
  },
} as const;

const isKnownNotificationType = (value: string): value is NotificationType =>
  KNOWN_NOTIFICATION_TYPES.includes(value as NotificationType);

export type NotificationsCopy = typeof NOTIFICATION_COPY.en;

export const getNotificationsCopy = (language: AppLanguage): NotificationsCopy =>
  pickLanguage(language, NOTIFICATION_COPY);

export const toPositiveInt = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const readStoredUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    return Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || user?.id || 0);
  } catch {
    return 0;
  }
};

export const parseNotificationData = (rawValue: unknown): NotificationData => {
  if (!rawValue) return {};
  if (typeof rawValue === 'object') return rawValue as NotificationData;
  if (typeof rawValue !== 'string') return {};
  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed as NotificationData : {};
  } catch {
    return {};
  }
};

export const resolveNotificationType = (
  notification: Pick<AppNotification, 'type' | 'title'>,
  data: NotificationData,
): NotificationType => {
  const normalizedType = String(notification.type || '').trim().toLowerCase();
  const aliasedType = NOTIFICATION_TYPE_ALIASES[normalizedType] || normalizedType;
  if (isKnownNotificationType(aliasedType)) return aliasedType;

  const title = String(notification.title || '').trim();
  if (
    title === 'New Challenge'
    && toPositiveInt(data.senderUserId)
    && String(data.challengeKey || '').trim()
  ) {
    return 'friend_challenge_invite';
  }

  if (
    (title === 'Challenge Accepted' || title === 'Challenge Declined' || title === 'Challenge Cancelled')
    && toPositiveInt(data.receiverNotificationId)
    && String(data.challengeKey || '').trim()
  ) {
    return 'friend_challenge_response';
  }

  return 'system';
};

export const getNotificationVisual = (type: NotificationType): NotificationVisual =>
  NOTIFICATION_VISUALS[type] || NOTIFICATION_VISUALS.system;

export const getNotificationResponseStatus = (data: NotificationData): NotificationActionStatus | null => {
  const status = String(data.responseStatus || '').trim().toLowerCase();
  if (status === 'accepted' || status === 'declined' || status === 'cancelled') return status;
  return null;
};

export const isFriendRequestNotification = (type: NotificationType, data: NotificationData) => {
  const requestType = String(data.requestType || '').trim().toLowerCase();
  return type === 'friend_request' && !!toPositiveInt(data.friendshipId) && (!requestType || requestType === 'friendship');
};

export const localizeNotificationText = (notification: AppNotification, language: AppLanguage) => {
  const copy = getNotificationsCopy(language);
  const data = parseNotificationData(notification.data);
  const notificationType = resolveNotificationType(notification, data);
  const challengeTitle = String(data.challengeTitle || 'Challenge').trim() || 'Challenge';
  const senderName = String(data.senderName || 'Friend').trim() || 'Friend';
  const responseStatus = getNotificationResponseStatus(data);

  if (notificationType === 'friend_challenge_invite') {
    return pickLanguage(language, {
      en: {
        title: 'New challenge',
        message: `${senderName} challenged you to ${challengeTitle}.`,
      },
      ar: {
        title: 'تحدٍ جديد',
        message: `${senderName} تحداك في ${challengeTitle}.`,
      },
    });
  }

  if (notificationType === 'friend_challenge_response' && responseStatus) {
    return pickLanguage(language, {
      en: {
        accepted: { title: 'Challenge accepted', message: `${challengeTitle} was accepted.` },
        declined: { title: 'Challenge declined', message: `${challengeTitle} was declined.` },
        cancelled: { title: 'Challenge cancelled', message: `${challengeTitle} expired after 5 minutes.` },
      },
      ar: {
        accepted: { title: 'تم قبول التحدي', message: `تم قبول ${challengeTitle}.` },
        declined: { title: 'تم رفض التحدي', message: `تم رفض ${challengeTitle}.` },
        cancelled: { title: 'تم إلغاء التحدي', message: `انتهت صلاحية ${challengeTitle} بعد 5 دقائق.` },
      },
    })[responseStatus];
  }

  const localizedFallbacks = pickLanguage(language, NOTIFICATION_TEXT_BY_LANGUAGE);
  const fallback = localizedFallbacks[notificationType as keyof typeof localizedFallbacks];

  return {
    title: String(notification.title || '').trim() || fallback?.title || copy.defaultTitle,
    message: String(notification.message || '').trim() || fallback?.message || copy.defaultMessage,
  };
};

export const buildNotificationMetadata = (
  notificationType: NotificationType,
  data: NotificationData,
  language: AppLanguage,
): NotificationMetaChip[] => {
  const items: NotificationMetaChip[] = [];
  const challengeTitle = String(data.challengeTitle || '').trim();
  const points = Number(data.points || 0);
  const streak = Number(data.streak || 0);

  if (challengeTitle && (notificationType === 'friend_challenge_invite' || notificationType === 'friend_challenge_response')) {
    items.push({ label: challengeTitle, tone: 'accent' });
  }

  if (Number.isFinite(points) && points > 0) {
    items.push({
      label: pickLanguage(language, {
        en: `+${points} pts`,
        ar: `+${points} نقطة`,
      }),
      tone: 'success',
    });
  }

  if (Number.isFinite(streak) && streak > 0) {
    items.push({
      label: pickLanguage(language, {
        en: `${streak} day streak`,
        ar: `سلسلة ${streak} أيام`,
      }),
      tone: 'neutral',
    });
  }

  return items.slice(0, 2);
};

export const formatNotificationTime = (value: string, language: AppLanguage) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';

  const diffMinutes = Math.round((timestamp - Date.now()) / (1000 * 60));
  const formatter = new Intl.RelativeTimeFormat(getLanguageLocale(language), {
    numeric: 'auto',
    style: 'short',
  });

  const absMinutes = Math.abs(diffMinutes);
  if (absMinutes < 60) return formatter.format(diffMinutes, 'minute');

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, 'hour');

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) return formatter.format(diffDays, 'day');

  return new Intl.DateTimeFormat(getLanguageLocale(language), {
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
};
