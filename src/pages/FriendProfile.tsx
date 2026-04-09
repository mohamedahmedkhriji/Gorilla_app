import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import { getBodyPartImage } from '../services/bodyPartTheme';
import {
  FRIEND_CHALLENGE_BADGE_KEYS,
  getFriendChallengeByKey,
} from '../services/friendChallenges';
import {
  AppLanguage,
  getActiveLanguage,
  getLanguageLocale,
  getStoredLanguage,
  pickLanguage,
} from '../services/language';
import {
  translateProgramText,
  translateWorkoutType,
} from '../services/programI18n';
import {
  formatWorkoutDayShortLabel,
} from '../services/workoutDayLabel';
import { useScrollToTopOnChange } from '../shared/scroll';
import { useScreenshotProtection } from '../shared/useScreenshotProtection';
import type { FriendMember } from './FriendsList';

interface FriendProfileProps {
  onBack: () => void;
  onChallenge: () => void;
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

type WorkoutExercise = {
  exerciseName?: string;
  exercise_name?: string;
  name?: string;
  sets?: number;
  targetSets?: number;
  target_sets?: number;
  reps?: string | number;
  rest?: number;
  notes?: string | null;
  targetMuscles?: unknown;
  muscleTargets?: unknown;
  muscles?: unknown;
  muscleGroup?: unknown;
  muscle_group?: unknown;
  muscle?: unknown;
  bodyPart?: unknown;
};

type FriendWorkout = {
  id: number;
  workout_name: string;
  workout_type: string | null;
  day_order: number;
  day_name: string;
  notes?: string | null;
  focusMuscles?: string[];
  exercises: WorkoutExercise[];
};

type FriendPlanMuscle = {
  name: string;
  percent: number;
};

type FriendPlanView = 'overview' | 'plan';
type ChallengeBadgeKey = typeof FRIEND_CHALLENGE_BADGE_KEYS[number];

type FriendChallengeWinStats = Record<ChallengeBadgeKey, number>;

const PROFILE_CHALLENGE_BADGE_KEYS = [
  'push_until_failure',
  'deadlift_monster',
  'bench_press_king',
  'squat_titan',
] satisfies ChallengeBadgeKey[];

type FriendProfileCopy = {
  profileTitle: string;
  planTitle: string;
  lockedTitle: string;
  lockedBody: string;
  backToFriends: string;
  inviteToGymDay: string;
  challenge: string;
  badges: string;
  trainingSplit: string;
  viewFriendPlan: string;
  planPeek: string;
  planLoading: string;
  planError: string;
  emptyPlan: string;
  posts: string;
  loadingPosts: string;
  noPosts: string;
  today: string;
  yesterday: string;
  recently: string;
  likes: string;
  comments: string;
  views: string;
  inviteModalTitle: string;
  inviteModalSubtitle: string;
  selectedSession: string;
  chooseDateTime: string;
  time: string;
  sendInvitation: string;
  closeImagePreview: string;
  comingSoon: string;
  challengeSoonTitle: string;
  challengeSoonBody: string;
  challengeSoonHint: string;
  challengeSoonCta: string;
  noSession: string;
  friendNotSelected: string;
  inviteSent: string;
  inviteFailed: string;
  level: (value: number) => string;
  weekLabel: (week: number, total: number) => string;
  workoutsLabel: (value: number) => string;
  exerciseCount: (value: number) => string;
  moreExercises: (value: number) => string;
  targetMuscles: string;
  targetMusclesHint: string;
  weeklySchedule: string;
  weeklyScheduleHint: string;
  planHighlights: string;
  planHighlightsHint: string;
  notes: string;
  sets: (value: number) => string;
  reps: (value: string | number) => string;
  rest: (value: number) => string;
  workoutFallback: (value: number) => string;
  postMediaAlt: string;
};

const FRIEND_PROFILE_I18N = {
  en: {
    profileTitle: 'Friend Profile',
    planTitle: 'Friend Plan',
    lockedTitle: 'Profile locked',
    lockedBody: 'Send a friend invitation and wait for acceptance before viewing this profile.',
    backToFriends: 'Back to Friends',
    inviteToGymDay: 'Invite to Gym Day',
    challenge: 'Challenge',
    badges: 'Badges',
    trainingSplit: 'Training Split',
    viewFriendPlan: 'Open full plan',
    planPeek: 'Tap to explore workouts, focus muscles, and weekly details.',
    planLoading: 'Loading friend plan...',
    planError: 'Unable to load this friend plan right now.',
    emptyPlan: 'No active training plan was found for this friend yet.',
    posts: 'Posts',
    loadingPosts: 'Loading posts...',
    noPosts: 'No posts uploaded yet.',
    today: 'Today',
    yesterday: 'Yesterday',
    recently: 'Recently',
    likes: 'likes',
    comments: 'comments',
    views: 'views',
    inviteModalTitle: 'Invite to Session',
    inviteModalSubtitle: 'Pick date and time for your workout together.',
    selectedSession: 'Selected session',
    chooseDateTime: 'Choose a date and time',
    time: 'Time',
    sendInvitation: 'Send Invitation',
    closeImagePreview: 'Close image preview',
    comingSoon: 'Coming Soon',
    challengeSoonTitle: 'Challenges are almost here',
    challengeSoonBody: 'We are polishing competitive workouts so you can challenge friends with score tracking and better matchups.',
    challengeSoonHint: 'For now, invite them to a gym session while we finish the challenge experience.',
    challengeSoonCta: 'Got it',
    noSession: 'No active user session found.',
    friendNotSelected: 'Friend not selected.',
    inviteSent: 'Session invitation sent!',
    inviteFailed: 'Failed to send invitation',
    level: (value: number) => `Level ${value}`,
    weekLabel: (week: number, total: number) => `Week ${week}${total > 0 ? ` / ${total}` : ''}`,
    workoutsLabel: (value: number) => `${value} workouts`,
    exerciseCount: (value: number) => `${value} exercises`,
    moreExercises: (value: number) => `+${value} more exercises`,
    targetMuscles: 'Target Muscles',
    targetMusclesHint: 'Main muscle groups this friend is focusing on right now.',
    weeklySchedule: 'Weekly Schedule',
    weeklyScheduleHint: 'A polished look at the current plan week.',
    planHighlights: 'Plan Highlights',
    planHighlightsHint: 'Current split, active week, and workout density.',
    notes: 'Coach note',
    sets: (value: number) => `${value} sets`,
    reps: (value: string | number) => `${value} reps`,
    rest: (value: number) => `${value}s rest`,
    workoutFallback: (value: number) => `Workout ${value}`,
    postMediaAlt: 'Post media',
  },
  ar: {
    profileTitle: 'ملف الصديق',
    planTitle: 'خطة الصديق',
    lockedTitle: 'الملف مقفل',
    lockedBody: 'أرسل دعوة صداقة وانتظر القبول قبل عرض هذا الملف.',
    backToFriends: 'العودة إلى الأصدقاء',
    inviteToGymDay: 'ادعُ إلى يوم جيم',
    challenge: 'تحدي',
    badges: 'الشارات',
    trainingSplit: 'تقسيمة التدريب',
    viewFriendPlan: 'افتح الخطة كاملة',
    planPeek: 'اضغط لاستكشاف التمارين والعضلات المستهدفة وتفاصيل الأسبوع.',
    planLoading: 'جارٍ تحميل خطة الصديق...',
    planError: 'تعذر تحميل خطة هذا الصديق الآن.',
    emptyPlan: 'لا توجد خطة تدريب نشطة لهذا الصديق حتى الآن.',
    posts: 'المنشورات',
    loadingPosts: 'جارٍ تحميل المنشورات...',
    noPosts: 'لا توجد منشورات حتى الآن.',
    today: 'اليوم',
    yesterday: 'أمس',
    recently: 'مؤخرًا',
    likes: 'إعجاب',
    comments: 'تعليق',
    views: 'مشاهدة',
    inviteModalTitle: 'دعوة إلى جلسة',
    inviteModalSubtitle: 'اختر التاريخ والوقت للتمرين معًا.',
    selectedSession: 'الجلسة المحددة',
    chooseDateTime: 'اختر التاريخ والوقت',
    time: 'الوقت',
    sendInvitation: 'إرسال الدعوة',
    closeImagePreview: 'إغلاق معاينة الصورة',
    comingSoon: 'قريبًا',
    challengeSoonTitle: 'التحديات قادمة قريبًا',
    challengeSoonBody: 'نعمل الآن على تحسين تجربة التحديات بين الأصدقاء مع تتبع النتائج ومواجهات أفضل.',
    challengeSoonHint: 'إلى ذلك الحين يمكنك دعوة صديقك إلى جلسة تدريب حتى نكمل هذه الميزة.',
    challengeSoonCta: 'حسنًا',
    noSession: 'لم يتم العثور على جلسة مستخدم نشطة.',
    friendNotSelected: 'لم يتم تحديد صديق.',
    inviteSent: 'تم إرسال دعوة الجلسة!',
    inviteFailed: 'فشل في إرسال الدعوة',
    level: (value: number) => `المستوى ${value}`,
    weekLabel: (week: number, total: number) => `الأسبوع ${week}${total > 0 ? ` / ${total}` : ''}`,
    workoutsLabel: (value: number) => `${value} تمارين`,
    exerciseCount: (value: number) => `${value} تمارين`,
    moreExercises: (value: number) => `+${value} تمارين إضافية`,
    targetMuscles: 'العضلات المستهدفة',
    targetMusclesHint: 'أهم مجموعات العضلات التي يركز عليها هذا الصديق الآن.',
    weeklySchedule: 'الجدول الأسبوعي',
    weeklyScheduleHint: 'نظرة مرتبة على أسبوع الخطة الحالي.',
    planHighlights: 'أهم الخطة',
    planHighlightsHint: 'التقسيمة الحالية والأسبوع النشط وكثافة التمرين.',
    notes: 'ملاحظة المدرب',
    sets: (value: number) => `${value} مجموعات`,
    reps: (value: string | number) => `${value} تكرارات`,
    rest: (value: number) => `${value}ث راحة`,
    workoutFallback: (value: number) => `تمرين ${value}`,
    postMediaAlt: 'وسائط المنشور',
  },
  it: {
    profileTitle: 'Profilo Amico',
    planTitle: 'Piano Amico',
    lockedTitle: 'Profilo bloccato',
    lockedBody: 'Invia una richiesta di amicizia e attendi l\'accettazione prima di visualizzare questo profilo.',
    backToFriends: 'Torna agli amici',
    inviteToGymDay: 'Invita a una sessione',
    challenge: 'Sfida',
    badges: 'Badge',
    trainingSplit: 'Split di allenamento',
    viewFriendPlan: 'Apri piano completo',
    planPeek: 'Tocca per vedere allenamenti, muscoli target e dettagli della settimana.',
    planLoading: 'Caricamento piano dell\'amico...',
    planError: 'Impossibile caricare il piano di questo amico ora.',
    emptyPlan: 'Nessun piano di allenamento attivo trovato per questo amico.',
    posts: 'Post',
    loadingPosts: 'Caricamento post...',
    noPosts: 'Nessun post caricato.',
    today: 'Oggi',
    yesterday: 'Ieri',
    recently: 'Di recente',
    likes: 'mi piace',
    comments: 'commenti',
    views: 'visualizzazioni',
    inviteModalTitle: 'Invita alla sessione',
    inviteModalSubtitle: 'Scegli data e ora per allenarvi insieme.',
    selectedSession: 'Sessione selezionata',
    chooseDateTime: 'Scegli data e ora',
    time: 'Ora',
    sendInvitation: 'Invia invito',
    closeImagePreview: 'Chiudi anteprima immagine',
    comingSoon: 'Prossimamente',
    challengeSoonTitle: 'Le sfide stanno arrivando',
    challengeSoonBody: 'Stiamo rifinendo le sfide tra amici con tracciamento punteggi e abbinamenti migliori.',
    challengeSoonHint: 'Nel frattempo puoi invitare il tuo amico a una sessione in palestra.',
    challengeSoonCta: 'Capito',
    noSession: 'Nessuna sessione utente attiva trovata.',
    friendNotSelected: 'Amico non selezionato.',
    inviteSent: 'Invito alla sessione inviato!',
    inviteFailed: 'Impossibile inviare l\'invito',
    level: (value: number) => `Livello ${value}`,
    weekLabel: (week: number, total: number) => `Settimana ${week}${total > 0 ? ` / ${total}` : ''}`,
    workoutsLabel: (value: number) => `${value} allenamenti`,
    exerciseCount: (value: number) => `${value} esercizi`,
    moreExercises: (value: number) => `+${value} altri esercizi`,
    targetMuscles: 'Muscoli Target',
    targetMusclesHint: 'I principali gruppi muscolari su cui si concentra adesso.',
    weeklySchedule: 'Programma Settimanale',
    weeklyScheduleHint: 'Una vista piu curata della settimana attiva.',
    planHighlights: 'Punti Chiave del Piano',
    planHighlightsHint: 'Split attuale, settimana attiva e densita del lavoro.',
    notes: 'Nota del coach',
    sets: (value: number) => `${value} serie`,
    reps: (value: string | number) => `${value} ripetizioni`,
    rest: (value: number) => `${value}s recupero`,
    workoutFallback: (value: number) => `Allenamento ${value}`,
    postMediaAlt: 'Media del post',
  },
  de: {
    profileTitle: 'Freundesprofil',
    planTitle: 'Trainingsplan des Freundes',
    lockedTitle: 'Profil gesperrt',
    lockedBody: 'Sende zuerst eine Freundesanfrage und warte auf die Annahme, bevor du dieses Profil ansiehst.',
    backToFriends: 'Zuruck zu Freunden',
    inviteToGymDay: 'Zum Training einladen',
    challenge: 'Herausfordern',
    badges: 'Abzeichen',
    trainingSplit: 'Trainingssplit',
    viewFriendPlan: 'Kompletten Plan offnen',
    planPeek: 'Tippe hier fur Workouts, Zielmuskeln und Wochen-Details.',
    planLoading: 'Freundesplan wird geladen...',
    planError: 'Dieser Freundesplan kann gerade nicht geladen werden.',
    emptyPlan: 'Fur diesen Freund wurde noch kein aktiver Trainingsplan gefunden.',
    posts: 'Beitrage',
    loadingPosts: 'Beitrage werden geladen...',
    noPosts: 'Noch keine Beitrage hochgeladen.',
    today: 'Heute',
    yesterday: 'Gestern',
    recently: 'Kuerzlich',
    likes: 'Likes',
    comments: 'Kommentare',
    views: 'Aufrufe',
    inviteModalTitle: 'Zur Session einladen',
    inviteModalSubtitle: 'Wahle Datum und Uhrzeit fur euer gemeinsames Training.',
    selectedSession: 'Ausgewahlte Session',
    chooseDateTime: 'Datum und Uhrzeit auswahlen',
    time: 'Uhrzeit',
    sendInvitation: 'Einladung senden',
    closeImagePreview: 'Bildvorschau schliessen',
    comingSoon: 'Demnaechst',
    challengeSoonTitle: 'Challenges kommen bald',
    challengeSoonBody: 'Wir verfeinern gerade Wettbewerbe mit Freunden inklusive Punktestand und besseren Matchups.',
    challengeSoonHint: 'Bis dahin kannst du deinen Freund zu einer gemeinsamen Session einladen.',
    challengeSoonCta: 'Verstanden',
    noSession: 'Keine aktive Benutzersitzung gefunden.',
    friendNotSelected: 'Kein Freund ausgewahlt.',
    inviteSent: 'Session-Einladung gesendet!',
    inviteFailed: 'Einladung konnte nicht gesendet werden',
    level: (value: number) => `Level ${value}`,
    weekLabel: (week: number, total: number) => `Woche ${week}${total > 0 ? ` / ${total}` : ''}`,
    workoutsLabel: (value: number) => `${value} Workouts`,
    exerciseCount: (value: number) => `${value} Ubungen`,
    moreExercises: (value: number) => `+${value} weitere Ubungen`,
    targetMuscles: 'Zielmuskeln',
    targetMusclesHint: 'Die wichtigsten Muskelgruppen, auf die sich der Plan gerade konzentriert.',
    weeklySchedule: 'Wochenplan',
    weeklyScheduleHint: 'Eine klarere Ansicht der aktiven Trainingswoche.',
    planHighlights: 'Plan-Highlights',
    planHighlightsHint: 'Aktueller Split, aktive Woche und Trainingsdichte.',
    notes: 'Coach-Notiz',
    sets: (value: number) => `${value} Satze`,
    reps: (value: string | number) => `${value} Wiederholungen`,
    rest: (value: number) => `${value}s Pause`,
    workoutFallback: (value: number) => `Workout ${value}`,
    postMediaAlt: 'Beitragsmedium',
  },
} satisfies Record<AppLanguage, FriendProfileCopy>;

const MUSCLE_NAME_MAP: Record<AppLanguage, Record<string, string>> = {
  en: {},
  ar: {
    Abs: 'Abs',
    Back: 'Back',
    Biceps: 'Biceps',
    Calves: 'Calves',
    Chest: 'Chest',
    Forearms: 'Forearms',
    Glutes: 'Glutes',
    Hamstrings: 'Hamstrings',
    Quadriceps: 'Quadriceps',
    Shoulders: 'Shoulders',
    Triceps: 'Triceps',
  },
  it: {
    Abs: 'Addome',
    Back: 'Schiena',
    Biceps: 'Bicipiti',
    Calves: 'Polpacci',
    Chest: 'Petto',
    Forearms: 'Avambracci',
    Glutes: 'Glutei',
    Hamstrings: 'Femorali',
    Quadriceps: 'Quadricipiti',
    Shoulders: 'Spalle',
    Triceps: 'Tricipiti',
  },
  de: {
    Abs: 'Bauch',
    Back: 'Ruecken',
    Biceps: 'Bizeps',
    Calves: 'Waden',
    Chest: 'Brust',
    Forearms: 'Unterarme',
    Glutes: 'Gesaess',
    Hamstrings: 'Beinbeuger',
    Quadriceps: 'Quadrizeps',
    Shoulders: 'Schultern',
    Triceps: 'Trizeps',
  },
};

const createEmptyChallengeWinStats = (): FriendChallengeWinStats =>
  PROFILE_CHALLENGE_BADGE_KEYS.reduce((totals, key) => {
    totals[key] = 0;
    return totals;
  }, {} as FriendChallengeWinStats);

const CHALLENGE_BADGE_ITEMS = PROFILE_CHALLENGE_BADGE_KEYS.map((key) => {
  const definition = getFriendChallengeByKey(key);
  return {
    key,
    title: definition?.title || key,
    image: definition?.image || '',
    accentClassName: definition?.accentClassName || 'from-white/10 via-white/5 to-transparent',
  };
});

const getLocalizedFriendFallbackName = (language: AppLanguage) =>
  pickLanguage(language, {
    en: 'Friend',
    ar: 'صديق',
    it: 'Amico',
    de: 'Freund',
  });

const getLocalizedMemberRank = (language: AppLanguage) =>
  pickLanguage(language, {
    en: 'Member',
    ar: 'عضو',
    it: 'Membro',
    de: 'Mitglied',
  });

const getLocalizedAvatarAlt = (language: AppLanguage, name: string) =>
  pickLanguage(language, {
    en: `${name} avatar`,
    ar: `صورة ${name}`,
    it: `Avatar di ${name}`,
    de: `Avatar von ${name}`,
  });

const getLocalizedBadgeAlt = (_language: AppLanguage, key: ChallengeBadgeKey) => {
  return getFriendChallengeByKey(key)?.title || String(key);
};

const getLocalizedRankLabel = (language: AppLanguage, rank: string) => {
  const normalizedRank = String(rank || '').trim().toLowerCase();

  if (!normalizedRank) {
    return getLocalizedMemberRank(language);
  }

  const localizedRanks = {
    bronze: pickLanguage(language, { en: 'Bronze', ar: 'برونزي', it: 'Bronzo', de: 'Bronze' }),
    silver: pickLanguage(language, { en: 'Silver', ar: 'فضي', it: 'Argento', de: 'Silber' }),
    gold: pickLanguage(language, { en: 'Gold', ar: 'ذهبي', it: 'Oro', de: 'Gold' }),
    platinum: pickLanguage(language, { en: 'Platinum', ar: 'بلاتيني', it: 'Platino', de: 'Platin' }),
    diamond: pickLanguage(language, { en: 'Diamond', ar: 'ألماسي', it: 'Diamante', de: 'Diamant' }),
    member: getLocalizedMemberRank(language),
  } satisfies Record<string, string>;

  return localizedRanks[normalizedRank] || rank;
};

const QUICK_SESSION_TIMES = ['06:30', '08:00', '17:30', '19:00'];
const TEMPLATE_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

const toTitleCase = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const parseExercises = (raw: unknown): WorkoutExercise[] => {
  if (Array.isArray(raw)) return raw as WorkoutExercise[];
  if (typeof raw !== 'string') return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as WorkoutExercise[] : [];
  } catch {
    return [];
  }
};

const parseTargetMuscles = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.map((entry) => toTitleCase(entry)).filter(Boolean);
  }

  if (typeof raw !== 'string' || !raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => toTitleCase(entry)).filter(Boolean);
    }
  } catch {
    return raw
      .split(/[,;|]+/)
      .map((entry) => toTitleCase(entry))
      .filter(Boolean);
  }

  return [];
};

const inferMusclesFromExerciseName = (exerciseName: unknown) => {
  const name = String(exerciseName || '').toLowerCase();
  const matches: string[] = [];

  if (/bench|chest|fly|push-up|push up/.test(name)) matches.push('Chest', 'Triceps', 'Shoulders');
  if (/deadlift|row|pull-up|pull up|lat|pulldown|pullover/.test(name)) matches.push('Back', 'Biceps', 'Forearms');
  if (/squat|leg press|lunge|split squat|step up/.test(name)) matches.push('Quadriceps', 'Hamstrings', 'Calves');
  if (/romanian deadlift|rdl|leg curl|hamstring/.test(name)) matches.push('Hamstrings');
  if (/lateral raise|rear delt|face pull|front raise/.test(name)) matches.push('Shoulders');
  if (/shoulder|overhead press|arnold press|seated shoulder press|machine shoulder press/.test(name)) matches.push('Shoulders', 'Triceps');
  if (/curl/.test(name)) matches.push('Biceps', 'Forearms');
  if (/tricep|triceps|dip/.test(name)) matches.push('Triceps');
  if (/calf/.test(name)) matches.push('Calves');
  if (/abs|core|crunch|plank|sit-up|sit up/.test(name)) matches.push('Abs');
  if (/glute|hip thrust/.test(name)) matches.push('Glutes');

  return [...new Set(matches.map((entry) => toTitleCase(entry)).filter(Boolean))];
};

const getExerciseMuscles = (exercise: WorkoutExercise) => {
  const explicit = [
    ...parseTargetMuscles(exercise.targetMuscles),
    ...parseTargetMuscles(exercise.muscleTargets),
    ...parseTargetMuscles(exercise.muscles),
    toTitleCase(exercise.muscleGroup || exercise.muscle_group || exercise.muscle || exercise.bodyPart || ''),
  ].filter(Boolean);

  if (explicit.length > 0) {
    return [...new Set(explicit)];
  }

  return inferMusclesFromExerciseName(exercise.exerciseName || exercise.exercise_name || exercise.name || '');
};

const buildProgramDistribution = (workouts: FriendWorkout[]): FriendPlanMuscle[] => {
  const byMuscle = new Map<string, number>();

  workouts.forEach((workout) => {
    if (Array.isArray(workout.focusMuscles) && workout.focusMuscles.length > 0 && workout.exercises.length === 0) {
      const share = 1 / workout.focusMuscles.length;
      workout.focusMuscles.forEach((muscle) => {
        byMuscle.set(muscle, Number(byMuscle.get(muscle) || 0) + share);
      });
      return;
    }

    workout.exercises.forEach((exercise) => {
      const plannedSets = Math.max(
        1,
        Number(exercise.sets ?? exercise.targetSets ?? exercise.target_sets ?? 1) || 1,
      );
      const muscles = getExerciseMuscles(exercise);
      if (muscles.length === 0) return;

      const share = plannedSets / muscles.length;
      muscles.forEach((muscle) => {
        byMuscle.set(muscle, Number(byMuscle.get(muscle) || 0) + share);
      });
    });
  });

  const total = Array.from(byMuscle.values()).reduce((sum, value) => sum + Number(value || 0), 0);
  if (total <= 0) return [];

  return Array.from(byMuscle.entries())
    .map(([name, value]) => ({
      name,
      percent: Math.max(0, Math.min(100, (Number(value) / total) * 100)),
    }))
    .sort((left, right) => right.percent - left.percent)
    .slice(0, 4);
};

const localizeMuscleName = (value: string, language: AppLanguage) =>
  MUSCLE_NAME_MAP[language][value] || value;

const normalizeWorkouts = (raw: unknown): FriendWorkout[] =>
  (Array.isArray(raw) ? raw : [])
    .map((entry: any) => ({
      id: Number(entry?.id || 0),
      workout_name: String(entry?.workout_name || entry?.name || 'Workout'),
      workout_type: entry?.workout_type ? String(entry.workout_type) : null,
      day_order: Number(entry?.day_order || 0),
      day_name: String(entry?.day_name || ''),
      notes: entry?.notes ? String(entry.notes) : null,
      focusMuscles: [],
      exercises: parseExercises(entry?.exercises),
    }))
    .sort((left, right) => left.day_order - right.day_order);

const normalizeSplitPreference = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const createTemplateWorkout = (
  dayOrder: number,
  workoutName: string,
  focusMuscles: string[],
  note = 'Built from saved split preference.',
): FriendWorkout => ({
  id: -(dayOrder + 1),
  workout_name: workoutName,
  workout_type: null,
  day_order: dayOrder + 1,
  day_name: TEMPLATE_DAY_NAMES[dayOrder] || `Day ${dayOrder + 1}`,
  notes: note,
  focusMuscles,
  exercises: [],
});

const buildFallbackSplitWorkouts = (splitPreference: unknown, splitLabel: unknown) => {
  const normalized = normalizeSplitPreference(splitPreference || splitLabel);
  const templateNote = 'Fallback preview generated from saved split preference.';

  if (normalized.includes('push_pull_legs') || normalized === 'ppl') {
    return {
      programName: String(splitLabel || 'Push / Pull / Legs'),
      workouts: [
        createTemplateWorkout(0, 'Push', ['Chest', 'Shoulders', 'Triceps'], templateNote),
        createTemplateWorkout(1, 'Pull', ['Back', 'Biceps', 'Forearms'], templateNote),
        createTemplateWorkout(2, 'Legs', ['Quadriceps', 'Hamstrings', 'Calves'], templateNote),
        createTemplateWorkout(3, 'Push', ['Chest', 'Shoulders', 'Triceps'], templateNote),
        createTemplateWorkout(4, 'Pull', ['Back', 'Biceps', 'Forearms'], templateNote),
        createTemplateWorkout(5, 'Legs', ['Quadriceps', 'Hamstrings', 'Calves'], templateNote),
      ],
    };
  }

  if (normalized.includes('upper_lower') || normalized === 'upperlower') {
    return {
      programName: String(splitLabel || 'Upper / Lower'),
      workouts: [
        createTemplateWorkout(0, 'Upper Body', ['Chest', 'Back', 'Shoulders'], templateNote),
        createTemplateWorkout(1, 'Lower Body', ['Quadriceps', 'Hamstrings', 'Calves'], templateNote),
        createTemplateWorkout(2, 'Upper Body', ['Chest', 'Back', 'Biceps'], templateNote),
        createTemplateWorkout(3, 'Lower Body', ['Glutes', 'Quadriceps', 'Hamstrings'], templateNote),
      ],
    };
  }

  if (normalized.includes('full_body')) {
    return {
      programName: String(splitLabel || 'Full Body Focus'),
      workouts: [
        createTemplateWorkout(0, 'Full Body A', ['Chest', 'Back', 'Quadriceps'], templateNote),
        createTemplateWorkout(1, 'Full Body B', ['Shoulders', 'Hamstrings', 'Biceps'], templateNote),
        createTemplateWorkout(2, 'Full Body C', ['Chest', 'Back', 'Abs'], templateNote),
      ],
    };
  }

  if (normalized.includes('hybrid') || normalized.includes('splitpush')) {
    return {
      programName: String(splitLabel || 'Hybrid Split'),
      workouts: [
        createTemplateWorkout(0, 'Chest & Triceps', ['Chest', 'Triceps'], templateNote),
        createTemplateWorkout(1, 'Back & Biceps', ['Back', 'Biceps'], templateNote),
        createTemplateWorkout(2, 'Legs', ['Quadriceps', 'Hamstrings', 'Calves'], templateNote),
        createTemplateWorkout(3, 'Upper Body', ['Chest', 'Back', 'Shoulders'], templateNote),
        createTemplateWorkout(4, 'Lower Body', ['Glutes', 'Quadriceps', 'Hamstrings'], templateNote),
      ],
    };
  }

  if (normalized.includes('custom') || normalized.includes('body_part') || normalized.includes('bro')) {
    return {
      programName: String(splitLabel || 'Body Part Split'),
      workouts: [
        createTemplateWorkout(0, 'Chest & Triceps', ['Chest', 'Triceps'], templateNote),
        createTemplateWorkout(1, 'Back & Biceps', ['Back', 'Biceps'], templateNote),
        createTemplateWorkout(2, 'Legs', ['Quadriceps', 'Hamstrings', 'Calves'], templateNote),
        createTemplateWorkout(3, 'Shoulders', ['Shoulders', 'Forearms'], templateNote),
        createTemplateWorkout(4, 'Arms & Core', ['Biceps', 'Triceps', 'Abs'], templateNote),
      ],
    };
  }

  if (normalized.includes('auto') || normalized) {
    return {
      programName: String(splitLabel || 'Balanced Split'),
      workouts: [
        createTemplateWorkout(0, 'Chest & Triceps', ['Chest', 'Triceps'], templateNote),
        createTemplateWorkout(1, 'Legs', ['Quadriceps', 'Hamstrings', 'Calves'], templateNote),
        createTemplateWorkout(2, 'Back & Biceps', ['Back', 'Biceps'], templateNote),
        createTemplateWorkout(3, 'Shoulders & Core', ['Shoulders', 'Abs'], templateNote),
      ],
    };
  }

  return {
    programName: String(splitLabel || 'Balanced Split'),
    workouts: [
      createTemplateWorkout(0, 'Chest & Triceps', ['Chest', 'Triceps'], templateNote),
      createTemplateWorkout(1, 'Legs', ['Quadriceps', 'Hamstrings', 'Calves'], templateNote),
      createTemplateWorkout(2, 'Back & Biceps', ['Back', 'Biceps'], templateNote),
      createTemplateWorkout(3, 'Shoulders & Core', ['Shoulders', 'Abs'], templateNote),
    ],
  };
};

const getWorkoutLabel = (
  workout: FriendWorkout,
  language: AppLanguage,
  fallback: string,
) => {
  if (workout.workout_type) {
    return translateWorkoutType(workout.workout_type, language);
  }
  return translateProgramText(workout.workout_name || fallback, language);
};

const buildSplitPreviewRows = (
  workouts: FriendWorkout[],
  language: AppLanguage,
  fallback: (value: number) => string,
) => {
  const groups = new Map<string, { label: string; days: string[] }>();

  workouts.forEach((workout) => {
    const key = String(workout.workout_type || workout.workout_name || workout.day_order || 'workout');
    const existing = groups.get(key);
    const nextDay = formatWorkoutDayShortLabel(
      workout.day_name,
      fallback(workout.day_order),
      language,
    );
    const nextLabel = getWorkoutLabel(workout, language, fallback(workout.day_order));

    if (existing) {
      if (nextDay && !existing.days.includes(nextDay)) {
        existing.days.push(nextDay);
      }
      return;
    }

    groups.set(key, {
      label: nextLabel,
      days: nextDay ? [nextDay] : [],
    });
  });

  return Array.from(groups.values()).slice(0, 4);
};

const formatRelativeDay = (
  isoDate: string,
  language: AppLanguage,
  copy: FriendProfileCopy,
) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return copy.recently;

  const now = new Date();
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startThen = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.floor((startNow - startThen) / (24 * 60 * 60 * 1000));

  if (dayDiff <= 0) return copy.today;
  if (dayDiff === 1) return copy.yesterday;
  if (dayDiff < 7) {
    return pickLanguage(language, {
      en: `${dayDiff}d`,
      ar: `منذ ${dayDiff} يوم`,
      it: `${dayDiff}g`,
      de: `vor ${dayDiff} T`,
    });
  }
  return date.toLocaleDateString(getLanguageLocale(language));
};

const getActiveViewerId = () => {
  try {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    return Number(user?.id || localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
  } catch {
    return Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
  }
};

export function FriendProfile({ onBack, onChallenge, friend }: FriendProfileProps) {
  useScreenshotProtection();
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [showInvite, setShowInvite] = useState(false);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState({ hour: 9, minute: 0 });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [friendPosts, setFriendPosts] = useState<FriendPost[]>([]);
  const [loadingFriendPosts, setLoadingFriendPosts] = useState(false);
  const [view, setView] = useState<FriendPlanView>('overview');
  const [friendPlanLoading, setFriendPlanLoading] = useState(false);
  const [friendPlanFailed, setFriendPlanFailed] = useState(false);
  const [friendProgramName, setFriendProgramName] = useState('Current Program');
  const [friendCurrentWeek, setFriendCurrentWeek] = useState(1);
  const [friendTotalWeeks, setFriendTotalWeeks] = useState(0);
  const [friendWorkouts, setFriendWorkouts] = useState<FriendWorkout[]>([]);
  const [friendPlanMuscles, setFriendPlanMuscles] = useState<FriendPlanMuscle[]>([]);
  const [friendChallengeWins, setFriendChallengeWins] = useState<FriendChallengeWinStats>(() => createEmptyChallengeWinStats());

  const copy = pickLanguage(language, FRIEND_PROFILE_I18N);

  const friendId = Number(friend?.id || 0);
  const fallbackFriendName = getLocalizedFriendFallbackName(language);
  const friendName = String(friend?.name || fallbackFriendName).trim() || fallbackFriendName;
  const friendRank = getLocalizedRankLabel(language, String(friend?.rank || getLocalizedMemberRank(language)));
  const friendTotalPoints = Number(friend?.total_points || 0);
  const friendLevel = getLevelFromPoints(friendTotalPoints);
  const friendProfilePicture = isUsableProfileImage(friend?.profile_picture)
    ? String(friend?.profile_picture)
    : '';
  const friendStatus = String(friend?.friend_status || '').trim().toLowerCase();
  const canViewProfile = friendStatus === 'accepted' || !!friend?.can_view_profile;
  const friendInitials = useMemo(
    () => friendName.split(' ').filter(Boolean).map((name) => name[0]).join('').slice(0, 2).toUpperCase() || 'FR',
    [friendName],
  );

  useScrollToTopOnChange([friendId, view]);

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
    setView('overview');
  }, [friendId]);

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
            mediaAlt: String(post?.mediaAlt || copy.postMediaAlt),
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
  }, [copy.postMediaAlt, friendId]);

  useEffect(() => {
    let cancelled = false;

    const loadFriendPlan = async () => {
      if (!canViewProfile || !friendId || friendId <= 0) {
        setFriendPlanLoading(false);
        setFriendPlanFailed(false);
        setFriendProgramName('Current Program');
        setFriendCurrentWeek(1);
        setFriendTotalWeeks(0);
        setFriendWorkouts([]);
        setFriendPlanMuscles([]);
        return;
      }

      setFriendPlanLoading(true);
      setFriendPlanFailed(false);

      try {
        const viewerId = getActiveViewerId();
        if (!viewerId || viewerId <= 0) {
          throw new Error(copy.noSession);
        }

        const programData = await api.getFriendPlanPreview(viewerId, friendId);
        if (cancelled) return;

        let normalizedWorkouts = normalizeWorkouts(
          Array.isArray(programData?.currentWeekWorkouts)
            ? programData.currentWeekWorkouts
            : Array.isArray(programData?.workouts)
              ? programData.workouts
              : [],
        );

        let nextProgramName = String(programData?.name || 'Current Program');
        let nextCurrentWeek = Number(programData?.currentWeek || 1);
        let nextTotalWeeks = Number(programData?.totalWeeks || 0);
        const fallbackSplitPreference = String(
          programData?.splitPreference || friend?.workout_split_preference || '',
        );
        const fallbackSplitLabel = String(
          programData?.splitLabel || friend?.workout_split_label || '',
        );

        if (normalizedWorkouts.length === 0) {
          const fallback = buildFallbackSplitWorkouts(
            fallbackSplitPreference,
            fallbackSplitLabel,
          );

          if (fallback.workouts.length > 0) {
            normalizedWorkouts = fallback.workouts;
            nextProgramName = fallback.programName || nextProgramName;
            nextCurrentWeek = 1;
            nextTotalWeeks = 1;
          }
        }

        setFriendProgramName(nextProgramName);
        setFriendCurrentWeek(nextCurrentWeek);
        setFriendTotalWeeks(nextTotalWeeks);
        setFriendWorkouts(normalizedWorkouts);
        setFriendPlanMuscles(buildProgramDistribution(normalizedWorkouts));
      } catch (error) {
        if (!cancelled) {
          const fallback = buildFallbackSplitWorkouts(
            friend?.workout_split_preference,
            friend?.workout_split_label,
          );

          if (fallback.workouts.length > 0) {
            setFriendPlanFailed(false);
            setFriendProgramName(fallback.programName || 'Current Program');
            setFriendCurrentWeek(1);
            setFriendTotalWeeks(1);
            setFriendWorkouts(fallback.workouts);
            setFriendPlanMuscles(buildProgramDistribution(fallback.workouts));
          } else {
            const apiError = error as Error & { status?: number };
            if (apiError?.status && ![403, 404].includes(Number(apiError.status))) {
              console.error('Failed to load friend plan:', error);
            }
            setFriendPlanFailed(true);
            setFriendProgramName('Current Program');
            setFriendCurrentWeek(1);
            setFriendTotalWeeks(0);
            setFriendWorkouts([]);
            setFriendPlanMuscles([]);
          }
        }
      } finally {
        if (!cancelled) {
          setFriendPlanLoading(false);
        }
      }
    };

    void loadFriendPlan();
    return () => {
      cancelled = true;
    };
  }, [canViewProfile, copy.noSession, friend?.workout_split_label, friend?.workout_split_preference, friendId]);

  useEffect(() => {
    let cancelled = false;

    const loadFriendChallengeWins = async () => {
      if (!canViewProfile || !friendId || friendId <= 0) {
        setFriendChallengeWins(createEmptyChallengeWinStats());
        return;
      }

      try {
        const viewerId = getActiveViewerId();
        if (!viewerId || viewerId <= 0) {
          throw new Error(copy.noSession);
        }

        const response = await api.getFriendChallengeWinStats(viewerId, friendId);
        if (cancelled) return;

        const rawStats = response?.stats && typeof response.stats === 'object'
          ? response.stats as Partial<Record<string, unknown>>
          : {};

        setFriendChallengeWins(
          PROFILE_CHALLENGE_BADGE_KEYS.reduce((totals, key) => {
            totals[key] = Math.max(0, Number.parseInt(String(rawStats[key] ?? 0), 10) || 0);
            return totals;
          }, createEmptyChallengeWinStats()),
        );
      } catch (error) {
        if (cancelled) return;
        const apiError = error as Error & { status?: number };
        if (apiError?.status && ![403, 404].includes(Number(apiError.status))) {
          console.error('Failed to load friend challenge win stats:', error);
        }
        setFriendChallengeWins(createEmptyChallengeWinStats());
      }
    };

    void loadFriendChallengeWins();

    return () => {
      cancelled = true;
    };
  }, [canViewProfile, copy.noSession, friendId]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate()
      && date.getMonth() === today.getMonth()
      && date.getFullYear() === today.getFullYear();
  };

  const isSameDay = (date1: Date | null, date2: Date) => {
    if (!date1) return false;
    return date1.getDate() === date2.getDate()
      && date1.getMonth() === date2.getMonth()
      && date1.getFullYear() === date2.getFullYear();
  };

  const handleSendInvite = async () => {
    if (!selectedDate) return;

    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const fromUserId = Number(user?.id || 0);

    if (!fromUserId || fromUserId <= 0) {
      alert(copy.noSession);
      return;
    }

    if (!friendId || friendId <= 0) {
      alert(copy.friendNotSelected);
      return;
    }

    const dateStr = selectedDate.toISOString().split('T')[0];
    const timeStr = `${selectedTime.hour.toString().padStart(2, '0')}:${selectedTime.minute.toString().padStart(2, '0')}`;

    try {
      await api.sendInvitation(fromUserId, friendId, dateStr, timeStr);
      setShowInvite(false);
      alert(copy.inviteSent);
    } catch (error) {
      alert(error instanceof Error ? error.message : copy.inviteFailed);
    }
  };

  const selectedTimeValue = `${selectedTime.hour.toString().padStart(2, '0')}:${selectedTime.minute.toString().padStart(2, '0')}`;
  const selectedSessionLabel = selectedDate
    ? `${selectedDate.toLocaleDateString(getLanguageLocale(language), { weekday: 'short', month: 'short', day: 'numeric' })} · ${selectedTimeValue}`
    : null;
  const selectedDateLabel = selectedDate
    ? selectedDate.toLocaleDateString(getLanguageLocale(language), { weekday: 'long', month: 'long', day: 'numeric' })
    : copy.chooseDateTime;

  const handleTimeInputChange = (value: string) => {
    const [hourRaw, minuteRaw] = value.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return;
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) return;
    setSelectedTime({ hour, minute });
  };

  const splitPreviewRows = useMemo(
    () => buildSplitPreviewRows(friendWorkouts, language, copy.workoutFallback),
    [copy, friendWorkouts, language],
  );

  const totalExercises = useMemo(
    () => friendWorkouts.reduce((sum, workout) => sum + workout.exercises.length, 0),
    [friendWorkouts],
  );

  if (!canViewProfile) {
    return (
      <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
        <div className="px-4 sm:px-6 pt-2">
          <Header title={copy.profileTitle} onBack={onBack} />
        </div>
        <div className="px-4 sm:px-6 pt-8">
          <Card className="p-5 border border-white/10">
            <h2 className="text-lg font-semibold text-white">{copy.lockedTitle}</h2>
            <p className="mt-2 text-sm text-text-secondary">{copy.lockedBody}</p>
            <button
              type="button"
              onClick={onBack}
              className="mt-4 w-full rounded-xl bg-accent py-2.5 font-semibold text-black transition-colors hover:bg-accent/90"
            >
              {copy.backToFriends}
            </button>
          </Card>
        </div>
      </div>
    );
  }

  const renderPlanView = () => (
    <div className="px-4 sm:px-6 space-y-5 pb-24">
      <div className="relative overflow-hidden rounded-[1.9rem] border border-white/12 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(187,255,92,0.14),transparent_32%),linear-gradient(160deg,rgba(18,24,34,0.98),rgba(10,14,22,0.98))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.26)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_56%)]" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                <Sparkles size={12} />
                {copy.planHighlights}
              </div>
              <h2 className="mt-3 text-2xl font-semibold leading-tight text-white">
                {translateProgramText(friendProgramName, language)}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">
                {copy.planHighlightsHint}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary">{copy.workoutsLabel(friendWorkouts.length)}</div>
              <div className="mt-2 text-xl font-semibold text-white">{friendWorkouts.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary">{copy.exerciseCount(totalExercises)}</div>
              <div className="mt-2 text-xl font-semibold text-white">{totalExercises}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary">{copy.targetMuscles}</div>
              <div className="mt-2 text-xl font-semibold text-white">{friendPlanMuscles.length}</div>
            </div>
          </div>
        </div>
      </div>

      {friendPlanLoading && (
        <Card className="border border-white/10 !p-4 text-sm text-text-secondary">
          {copy.planLoading}
        </Card>
      )}

      {!friendPlanLoading && friendPlanFailed && (
        <Card className="border border-red-500/25 bg-red-500/10 !p-4 text-sm text-red-200">
          {copy.planError}
        </Card>
      )}

      {!friendPlanLoading && !friendPlanFailed && friendWorkouts.length === 0 && (
        <Card className="border border-white/10 !p-4 text-sm text-text-secondary">
          {copy.emptyPlan}
        </Card>
      )}

      {!friendPlanLoading && !friendPlanFailed && friendPlanMuscles.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-white">{copy.targetMuscles}</h3>
            <p className="mt-1 text-sm text-text-secondary">{copy.targetMusclesHint}</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {friendPlanMuscles.map((muscle) => (
              <div
                key={`${muscle.name}-card`}
                className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-card/80"
              >
                <img
                  src={getBodyPartImage(muscle.name)}
                  alt={localizeMuscleName(muscle.name, language)}
                  className="h-20 w-full object-cover object-center sm:h-24"
                  loading="lazy"
                />
                <div className="p-2.5">
                  <div className="text-[13px] font-semibold text-white sm:text-sm">
                    {localizeMuscleName(muscle.name, language)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-text-secondary">{copy.targetMuscles}</div>
                  <div className="mt-2 inline-flex rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                    {Math.round(muscle.percent)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!friendPlanLoading && !friendPlanFailed && friendWorkouts.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-white">{copy.weeklySchedule}</h3>
            <p className="mt-1 text-sm text-text-secondary">{copy.weeklyScheduleHint}</p>
          </div>
          <div className="space-y-3">
            {friendWorkouts.map((workout) => {
              const workoutMuscles = [
                ...new Set(
                  Array.isArray(workout.focusMuscles) && workout.focusMuscles.length > 0
                    ? workout.focusMuscles
                    : workout.exercises.flatMap(getExerciseMuscles),
                ),
              ].slice(0, 4);
              const workoutLabel = getWorkoutLabel(workout, language, copy.workoutFallback(workout.day_order));

              return (
                <div
                  key={`${workout.id}-${workout.day_order}`}
                  className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,31,0.96),rgba(13,17,24,0.98))] p-4 shadow-[0_12px_34px_rgba(0,0,0,0.22)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="text-xl font-semibold text-white">{workoutLabel}</h4>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary">
                        {copy.targetMuscles}
                      </div>
                      <div className="mt-1 text-lg font-electrolize text-white">{workoutMuscles.length}</div>
                    </div>
                  </div>

                  {workoutMuscles.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                      {workoutMuscles.map((muscle) => (
                        <div
                          key={`${workout.id}-focus-${muscle}`}
                          className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]"
                        >
                          <img
                            src={getBodyPartImage(muscle)}
                            alt={localizeMuscleName(muscle, language)}
                            className="h-20 w-full object-cover object-center"
                            loading="lazy"
                          />
                          <div className="px-3 py-2.5 text-center">
                            <div className="text-sm font-semibold text-white">
                              {localizeMuscleName(muscle, language)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header
          title={view === 'plan' ? copy.planTitle : copy.profileTitle}
          onBack={view === 'plan' ? () => setView('overview') : onBack}
        />
      </div>

      {view === 'plan' ? (
        renderPlanView()
      ) : (
        <div className="px-4 sm:px-6 space-y-6">
          <div className="mb-8 flex flex-col items-center pt-2">
            <div className="mb-4 h-24 w-24 rounded-full bg-white/10 text-2xl font-bold text-white">
              {friendProfilePicture ? (
                <button
                  type="button"
                  onClick={() => setShowAvatarPreview(true)}
                  className="h-full w-full cursor-zoom-in overflow-hidden rounded-full"
                  aria-label={`${copy.profileTitle}: ${friendName}`}
                >
                  <img
                    src={friendProfilePicture}
                    alt={getLocalizedAvatarAlt(language, friendName)}
                    className="h-full w-full rounded-full object-cover"
                  />
                </button>
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full">
                  {friendInitials}
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white">{friendName}</h2>
            <div className="mt-2 flex items-center gap-2">
              <Trophy size={16} className="text-yellow-500" />
              <span className="text-sm text-text-secondary">
                {friendRank} · {copy.level(friendLevel)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="w-full rounded-xl bg-accent py-3 font-bold text-black transition-colors hover:bg-accent/90"
            >
              {copy.inviteToGymDay}
            </button>
            <button
              type="button"
              onClick={onChallenge}
              className="w-full rounded-xl border border-white/15 bg-white/5 py-3 font-bold text-white transition-colors hover:bg-white/10"
            >
              {copy.challenge}
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
              {copy.badges}
            </h3>
            <div className="flex flex-wrap justify-center gap-4 pb-2">
              {CHALLENGE_BADGE_ITEMS.map((badge) => {
                const winCount = friendChallengeWins[badge.key];
                const isUnlocked = winCount > 0;

                return (
                  <div
                    key={badge.key}
                    className="flex min-w-[5.5rem] max-w-[5.5rem] flex-col items-center gap-2"
                  >
                    <div
                      className={`relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${
                        isUnlocked ? 'border-accent/30 bg-accent/12' : 'border-white/10 bg-card'
                      }`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${badge.accentClassName} ${isUnlocked ? 'opacity-100' : 'opacity-45'}`} />
                      {badge.image ? (
                        <img
                          src={badge.image}
                          alt={getLocalizedBadgeAlt(language, badge.key)}
                          className={`relative h-full w-full object-cover ${isUnlocked ? '' : 'opacity-60 grayscale'}`}
                        />
                      ) : (
                        <span
                          aria-label={getLocalizedBadgeAlt(language, badge.key)}
                          className={`relative text-sm font-black tracking-[0.12em] ${isUnlocked ? 'text-white' : 'text-text-secondary'}`}
                        >
                          {badge.title
                            .split(/\s+/)
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part.charAt(0).toUpperCase())
                            .join('')}
                        </span>
                      )}
                    </div>
                    <div className={`text-sm font-black ${isUnlocked ? 'text-accent' : 'text-text-tertiary'}`}>
                      {winCount}
                    </div>
                    <div className="text-center text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-text-secondary">
                      {badge.title}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
              {copy.trainingSplit}
            </h3>
            <button
              type="button"
              onClick={() => setView('plan')}
              className="block w-full text-left"
            >
              <Card className="relative overflow-hidden border border-white/12 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(187,255,92,0.1),transparent_28%),linear-gradient(160deg,rgba(20,24,31,0.98),rgba(11,15,24,0.98))] p-4 transition-all duration-200 hover:border-accent/35">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_58%)]" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                        <Dumbbell size={12} />
                        {copy.trainingSplit}
                      </div>
                      <h4 className="mt-3 text-xl font-semibold leading-tight text-white">
                        {translateProgramText(friendProgramName, language)}
                      </h4>
                      <p className="mt-1 text-sm text-text-secondary">
                        {copy.weekLabel(friendCurrentWeek, friendTotalWeeks)} · {copy.workoutsLabel(friendWorkouts.length)}
                      </p>
                    </div>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
                      <ArrowRight size={18} />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 rounded-2xl border border-white/8 bg-black/15 p-3">
                    {friendPlanLoading ? (
                      <div className="text-sm text-text-secondary">{copy.planLoading}</div>
                    ) : friendPlanFailed ? (
                      <div className="text-sm text-red-200">{copy.planError}</div>
                    ) : splitPreviewRows.length === 0 ? (
                      <div className="text-sm text-text-secondary">{copy.emptyPlan}</div>
                    ) : (
                      splitPreviewRows.map((row) => (
                        <div key={`${row.label}-${row.days.join(',')}`} className="flex items-center justify-between gap-4 text-sm">
                          <span className="font-semibold text-white">{row.label}</span>
                          <span className="text-text-tertiary">{row.days.join(', ')}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 text-xs text-text-secondary">
                    <span>{copy.planPeek}</span>
                    <span className="font-semibold text-accent">{copy.viewFriendPlan}</span>
                  </div>
                </div>
              </Card>
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
              {copy.posts}
            </h3>
            {loadingFriendPosts ? (
              <Card className="!p-3 text-sm text-text-secondary">{copy.loadingPosts}</Card>
            ) : friendPosts.length === 0 ? (
              <Card className="!p-3 text-sm text-text-secondary">{copy.noPosts}</Card>
            ) : (
              <div className="space-y-3">
                {friendPosts.map((post) => (
                  <Card key={post.id} className="!p-3 space-y-2">
                    <div className="text-xs text-text-secondary">
                      {formatRelativeDay(post.createdAt || '', language, copy)}
                    </div>
                    {post.mediaUrl && (
                      post.mediaType === 'video' ? (
                        <video
                          src={post.mediaUrl}
                          className="block max-h-64 w-full rounded-xl border border-white/10 bg-black object-contain sm:max-h-72"
                          controls
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={post.mediaUrl}
                          alt={post.mediaAlt || copy.postMediaAlt}
                          className="max-h-64 w-full rounded-xl border border-white/10 bg-black/20 object-contain"
                          loading="lazy"
                        />
                      )
                    )}
                    {post.description.trim() && (
                      <div className="text-sm leading-relaxed text-white">{post.description}</div>
                    )}
                    <div className="text-xs text-text-tertiary">
                      {new Intl.NumberFormat(getLanguageLocale(language)).format(Math.max(0, post.likes))} {copy.likes}
                      {' · '}
                      {new Intl.NumberFormat(getLanguageLocale(language)).format(Math.max(0, post.comments))} {copy.comments}
                      {' · '}
                      {new Intl.NumberFormat(getLanguageLocale(language)).format(Math.max(0, post.views))} {copy.views}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showInvite && (
        <div
          className="fixed inset-x-0 top-0 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-40 flex items-end overflow-hidden bg-black/70 p-0 backdrop-blur-md sm:inset-0 sm:items-center sm:justify-center sm:p-6"
          onClick={() => setShowInvite(false)}
        >
          <div
            className="relative flex min-h-0 max-h-full w-full flex-col overflow-hidden rounded-t-[2rem] border border-white/12 bg-[radial-gradient(circle_at_top_right,rgba(187,255,92,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.07),transparent_34%),linear-gradient(160deg,rgba(24,24,30,0.98),rgba(11,11,15,0.98))] shadow-[0_24px_90px_rgba(0,0,0,0.55)] sm:max-h-[88vh] sm:max-w-lg sm:rounded-[2rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),transparent_42%)]" />
            <div className="pointer-events-none absolute left-1/2 top-3 h-1.5 w-14 -translate-x-1/2 rounded-full bg-white/20 sm:hidden" />

            <div className="relative shrink-0 border-b border-white/10 bg-black/10 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                    <Sparkles size={12} />
                    {copy.inviteToGymDay}
                  </div>

                  <div>
                    <h3 className="text-2xl font-semibold leading-tight text-white">{copy.inviteModalTitle}</h3>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">{copy.inviteModalSubtitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-text-secondary transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/85">
                    <CalendarDays size={13} />
                    {copy.selectedSession}
                  </div>
                  <div className="mt-3 text-sm font-semibold text-white">
                    {selectedDateLabel}
                  </div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {selectedSessionLabel || copy.chooseDateTime}
                  </div>
                </div>

                <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/85">
                    <Clock3 size={13} />
                    {copy.time}
                  </div>
                  <div className="mt-3 text-lg font-semibold tracking-[0.08em] text-white">
                    {selectedTimeValue}
                  </div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {selectedDate ? copy.selectedSession : copy.chooseDateTime}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative flex-1 min-h-0 space-y-4 overflow-y-auto overscroll-contain p-5 [-webkit-overflow-scrolling:touch] sm:p-6">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-text-secondary transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
                    {currentMonth.toLocaleDateString(getLanguageLocale(language), { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-text-secondary transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="mb-3 grid grid-cols-7 gap-2">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                    <div key={index} className="py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: getDaysInMonth(currentMonth).firstDay }).map((_, index) => (
                    <div key={`empty-${index}`} />
                  ))}
                  {Array.from({ length: getDaysInMonth(currentMonth).daysInMonth }).map((_, index) => {
                    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), index + 1);
                    const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                    const selected = isSameDay(selectedDate, date);
                    const today = isToday(date);

                    return (
                      <button
                        key={index}
                        type="button"
                        disabled={isPast}
                        onClick={() => setSelectedDate(date)}
                        className={`aspect-square rounded-2xl border text-sm font-semibold transition-all ${
                          selected
                            ? 'border-accent/70 bg-accent text-black shadow-[0_18px_35px_rgba(187,255,92,0.22)]'
                            : today
                              ? 'border-white/20 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                              : isPast
                                ? 'cursor-not-allowed border-transparent bg-transparent text-text-tertiary opacity-40'
                                : 'border-transparent bg-white/[0.03] text-white hover:-translate-y-0.5 hover:border-white/12 hover:bg-white/[0.08]'
                        }`}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                  <Clock3 size={16} className="text-accent" />
                  {copy.time}
                </div>
                <input
                  type="time"
                  value={selectedTimeValue}
                  step={900}
                  onChange={(event) => handleTimeInputChange(event.target.value)}
                  className="w-full rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition-all focus:border-accent/60 focus:bg-white/[0.06]"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {QUICK_SESSION_TIMES.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => handleTimeInputChange(time)}
                      className={`rounded-full border px-3.5 py-2 text-xs font-semibold tracking-wide transition-all ${
                        selectedTimeValue === time
                          ? 'border-accent/80 bg-accent text-black shadow-[0_12px_24px_rgba(187,255,92,0.18)]'
                          : 'border-white/12 bg-white/[0.03] text-text-secondary hover:border-white/20 hover:bg-white/[0.08] hover:text-white'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative shrink-0 border-t border-white/10 bg-black/20 p-5 backdrop-blur-sm sm:p-6">
              <button
                type="button"
                onClick={handleSendInvite}
                disabled={!selectedDate}
                className="group w-full rounded-2xl bg-accent px-4 py-4 text-sm font-bold text-black shadow-[0_18px_45px_rgba(187,255,92,0.28)] transition-all hover:-translate-y-0.5 hover:bg-accent/90 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex items-center justify-center gap-2">
                  {copy.sendInvitation}
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showAvatarPreview && friendProfilePicture && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 sm:p-8"
          onClick={() => setShowAvatarPreview(false)}
        >
          <button
            type="button"
            onClick={() => setShowAvatarPreview(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
            aria-label={copy.closeImagePreview}
          >
            <X size={20} />
          </button>
          <img
            src={friendProfilePicture}
            alt={`${friendName} avatar`}
            className="max-h-full max-w-full rounded-2xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
