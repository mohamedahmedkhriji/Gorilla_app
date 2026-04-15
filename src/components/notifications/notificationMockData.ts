import type { AppNotification } from './types';

export const mockNotifications: AppNotification[] = [
  {
    id: 101,
    type: 'mission_completed',
    title: 'مهمة مكتملة',
    message: 'حصلت على 120 نقطة بعد إنهاء تحدي السرعة الأسبوعي.',
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    unread: true,
    data: {
      points: 120,
      streak: 4,
    },
  },
  {
    id: 102,
    type: 'friend_request',
    title: 'طلب صداقة جديد',
    message: 'أرسل لك أحمد طلب صداقة جديد داخل RepSet.',
    created_at: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    unread: true,
    data: {
      senderName: 'أحمد',
      friendshipId: 55,
    },
  },
  {
    id: 103,
    type: 'workout_reminder',
    title: 'تذكير بالتمرين',
    message: 'حان وقت جلسة الجزء العلوي. حافظ على السلسلة وابدأ الآن.',
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    unread: false,
    data: {
      streak: 6,
    },
  },
  {
    id: 104,
    type: 'recovery_alert',
    title: 'تنبيه التعافي',
    message: 'معدل التعافي للجزء السفلي منخفض اليوم. خفف الشدة أو خذ راحة نشطة.',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    unread: true,
  },
  {
    id: 105,
    type: 'leaderboard_update',
    title: 'تحديث لوحة الصدارة',
    message: 'قفزت إلى المركز الثالث هذا الأسبوع بعد جلسة الصدر الأخيرة.',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
    unread: false,
    data: {
      points: 380,
    },
  },
  {
    id: 106,
    type: 'friend_challenge_invite',
    title: 'تحد جديد',
    message: 'تحداك كريم في Push-Up Duel.',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    unread: true,
    data: {
      senderUserId: 22,
      senderName: 'كريم',
      challengeKey: 'push-up-duel',
      challengeTitle: 'Push-Up Duel',
      sessionId: 908,
    },
  },
];
