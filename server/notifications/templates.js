import { NOTIFICATION_TYPES } from './types.js';

const templates = {
  [NOTIFICATION_TYPES.WORKOUT_REMINDER]: {
    en: ['Workout reminder', '{{workoutName}} starts in 1 hour.'],
    fr: ["Rappel d'entrainement", '{{workoutName}} commence dans 1 heure.'],
    ar: ['تذكير بالتمرين', 'يبدأ تمرين {{workoutName}} خلال ساعة.'],
  },
  [NOTIFICATION_TYPES.RECOVERY_READY]: {
    en: ['Recovery ready', '{{muscles}} recovered. Good time to train.'],
    fr: ['Recuperation terminee', '{{muscles}} ont recupere. Bon moment pour vous entrainer.'],
    ar: ['اكتمل الاستشفاء', 'تعافت {{muscles}}. هذا وقت مناسب للتمرين.'],
  },
  [NOTIFICATION_TYPES.PLAN_UPDATED]: {
    en: ['Plan updated', 'Your coach updated your workout plan.'],
    fr: ['Programme mis a jour', "Votre coach a mis a jour votre programme d'entrainement."],
    ar: ['تم تحديث الخطة', 'قام مدربك بتحديث خطة التمرين.'],
  },
  [NOTIFICATION_TYPES.COACH_MESSAGE]: {
    en: ['New coach message', '{{senderName}} sent you a message.'],
    fr: ['Nouveau message du coach', '{{senderName}} vous a envoye un message.'],
    ar: ['رسالة جديدة من المدرب', 'أرسل لك {{senderName}} رسالة.'],
  },
  [NOTIFICATION_TYPES.MISSED_WORKOUT]: {
    en: ['Workout missed', 'You planned to train today. Want to reschedule?'],
    fr: ['Entrainement manque', "Vous aviez prevu de vous entrainer aujourd'hui. Reprogrammer ?"],
    ar: ['فاتك التمرين', 'كنت تخطط للتمرين اليوم. هل تريد إعادة الجدولة؟'],
  },
  [NOTIFICATION_TYPES.STREAK_PROTECTION]: {
    en: ['Protect your streak', 'One workout today keeps your {{streak}}-day streak alive.'],
    fr: ['Protegez votre serie', "Un entrainement aujourd'hui maintient votre serie de {{streak}} jours."],
    ar: ['حافظ على سلسلتك', 'تمرين واحد اليوم يحافظ على سلسلتك لمدة {{streak}} يومًا.'],
  },
  [NOTIFICATION_TYPES.CHALLENGE_INVITATION]: {
    en: ['New challenge', '{{senderName}} invited you to {{challengeName}}.'],
    fr: ['Nouveau defi', '{{senderName}} vous a invite au defi {{challengeName}}.'],
    ar: ['تحدٍ جديد', 'دعاك {{senderName}} إلى تحدي {{challengeName}}.'],
  },
  [NOTIFICATION_TYPES.SUBSCRIPTION_REMINDER]: {
    en: ['Subscription reminder', 'Your {{subscriptionType}} subscription expires in {{daysRemaining}} days.'],
    fr: ["Rappel d'abonnement", 'Votre abonnement {{subscriptionType}} expire dans {{daysRemaining}} jours.'],
    ar: ['تذكير بالاشتراك', 'ينتهي اشتراك {{subscriptionType}} خلال {{daysRemaining}} أيام.'],
  },
  [NOTIFICATION_TYPES.ONBOARDING_REMINDER]: {
    en: ['Complete your profile', 'Finish your profile to generate your training plan.'],
    fr: ['Completez votre profil', "Terminez votre profil pour generer votre programme d'entrainement."],
    ar: ['أكمل ملفك الشخصي', 'أكمل ملفك لإنشاء خطة التدريب الخاصة بك.'],
  },
  [NOTIFICATION_TYPES.SHOP_DISCOUNT]: {
    en: ['New RepSet offer', '{{offerName}} is now available.'],
    fr: ['Nouvelle offre RepSet', '{{offerName}} est maintenant disponible.'],
    ar: ['عرض جديد من RepSet', 'عرض {{offerName}} متاح الآن.'],
  },
  [NOTIFICATION_TYPES.FRIEND_INVITATION]: {
    en: ['New friend request', '{{senderName}} wants to connect with you on RepSet.'],
    fr: ["Nouvelle demande d'ami", '{{senderName}} souhaite se connecter avec vous sur RepSet.'],
    ar: ['طلب صداقة جديد', 'يريد {{senderName}} التواصل معك على RepSet.'],
  },
  [NOTIFICATION_TYPES.SOCIAL_ACTIVITY]: {
    en: ['New post activity', '{{senderName}} {{action}} your post.'],
    fr: ['Nouvelle activite', '{{senderName}} a {{action}} votre publication.'],
    ar: ['نشاط جديد على منشورك', 'قام {{senderName}} بـ {{action}} منشورك.'],
  },
  [NOTIFICATION_TYPES.NEW_BOOK]: {
    en: ['New book', '{{bookName}} is now available.'],
    fr: ['Nouveau livre', '{{bookName}} est maintenant disponible.'],
    ar: ['كتاب جديد', 'كتاب {{bookName}} متاح الآن.'],
  },
};

const interpolate = (text, variables) => String(text).replace(/\{\{(\w+)\}\}/g, (_match, key) => {
  const value = variables?.[key];
  return value == null || value === '' ? '' : String(value);
});

export const normalizeNotificationLocale = (value) => {
  const locale = String(value || '').trim().toLowerCase().split(/[-_]/)[0];
  return ['en', 'fr', 'ar'].includes(locale) ? locale : 'en';
};

export const renderNotificationTemplate = (type, locale, variables = {}) => {
  const resolvedLocale = normalizeNotificationLocale(locale);
  const template = templates[type]?.[resolvedLocale] || templates[type]?.en;
  if (!template) throw new Error(`Missing notification template for ${type}`);
  const actionKey = String(variables.action || '').trim().toLowerCase();
  const localizedActions = {
    en: { liked: 'liked', 'reacted to': 'reacted to', 'commented on': 'commented on' },
    fr: { liked: 'aime', 'reacted to': 'reagi a', 'commented on': 'commente' },
    ar: { liked: 'أعجب بـ', 'reacted to': 'تفاعل مع', 'commented on': 'علّق على' },
  };
  const localizedVariables = {
    ...variables,
    action: localizedActions[resolvedLocale]?.[actionKey] || variables.action,
  };
  return {
    locale: resolvedLocale,
    title: interpolate(template[0], localizedVariables).trim(),
    body: interpolate(template[1], localizedVariables).replace(/\s+/g, ' ').trim(),
  };
};
