import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Dumbbell, Lock, Sparkles } from 'lucide-react';
import { Header } from '../ui/Header';
import { AgendaSection } from '../home/AgendaSection';
import { getBodyPartImage } from '../../services/bodyPartTheme';
import { AppLanguage, LocalizedLanguageRecord, getActiveLanguage, getStoredLanguage, normalizeLocalizedValue } from '../../services/language';
import { translateProgramText } from '../../services/programI18n';
import type { WorkoutAssignmentHistoryEntry } from '../../services/todayWorkoutSelection';
import { formatWorkoutDayLabel } from '../../services/workoutDayLabel';
import {
  buildT2PremiumCardMeta,
  getActiveT2PremiumConfig,
} from '../../services/premiumPlan';
import rightArrowIcon from '../../../assets/emoji/right-arrow.png';

type WorkoutOverviewCard = {
  key: string;
  dayLabel: string;
  workoutName: string;
  exerciseCount: number;
  exerciseNames: string[];
  targetMuscles: string[];
  isToday: boolean;
  isRecommendedNext?: boolean;
  isPickedForToday?: boolean;
  isCompletedToday?: boolean;
  isCompleted?: boolean;
};

interface WorkoutOverviewScreenProps {
  onBack: () => void;
  onSelectWorkout: (workoutKey: string) => void;
  onPickWorkoutForToday: (workoutKey: string) => void;
  onOpenNewPlanFlow?: () => void;
  currentDayLabel: string;
  workouts: WorkoutOverviewCard[];
  selectedTodayWorkoutName?: string;
  selectedTodayWorkoutDayLabel?: string;
  hasTodaySelection?: boolean;
  isTodaySelectionCompleted?: boolean;
  isTodayPlanLocked?: boolean;
  isPlanCompleted?: boolean;
  recommendedWorkout?: {
    workoutName: string;
    dayLabel: string;
  } | null;
  userProgram?: any;
  assignmentHistory?: WorkoutAssignmentHistoryEntry[];
  accountCreatedAt?: string | Date | null;
  loading?: boolean;
  error?: string | null;
}

const AR_DAY_LABELS: Record<string, string> = {
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
  saturday: 'السبت',
  sunday: 'الأحد',
};

const AR_MUSCLE_LABELS: Record<string, string> = {
  chest: 'الصدر',
  back: 'الظهر',
  shoulders: 'الأكتاف',
  'front shoulders': 'الأكتاف الأمامية',
  'side shoulders': 'الأكتاف الجانبية',
  'rear shoulders': 'الأكتاف الخلفية',
  triceps: 'الترايسبس',
  biceps: 'البايسبس',
  abs: 'البطن',
  quadriceps: 'الرباعية',
  hamstrings: 'الخلفية',
  calves: 'السمانة',
  forearms: 'الساعد',
  glutes: 'الألوية',
  adductors: 'المقربات',
  general: 'عام',
};

const IT_MUSCLE_LABELS: Record<string, string> = {
  chest: 'Petto',
  back: 'Schiena',
  shoulders: 'Spalle',
  'front shoulders': 'Spalle anteriori',
  'side shoulders': 'Spalle laterali',
  'rear shoulders': 'Spalle posteriori',
  triceps: 'Tricipiti',
  biceps: 'Bicipiti',
  abs: 'Addome',
  quadriceps: 'Quadricipiti',
  hamstrings: 'Femorali',
  calves: 'Polpacci',
  forearms: 'Avambracci',
  glutes: 'Glutei',
  adductors: 'Adduttori',
  general: 'Generale',
};

const DE_MUSCLE_LABELS: Record<string, string> = {
  chest: 'Brust',
  back: 'Ruecken',
  shoulders: 'Schultern',
  'front shoulders': 'Vordere Schultern',
  'side shoulders': 'Seitliche Schultern',
  'rear shoulders': 'Hintere Schultern',
  triceps: 'Trizeps',
  biceps: 'Bizeps',
  abs: 'Bauch',
  quadriceps: 'Quadrizeps',
  hamstrings: 'Beinbeuger',
  calves: 'Waden',
  forearms: 'Unterarme',
  glutes: 'Gesaess',
  adductors: 'Adduktoren',
  general: 'Allgemein',
};

const COPY = {
  en: {
    title: 'My Plan',
    heroEyebrow: 'Current Day',
    heroBody: 'No session selected yet. Choose the best fit for today.',
    heroSelectedEyebrow: 'Saved For Today',
    heroSelectedBody: 'This session is set for today.',
    heroLockedBody: 'Today is in progress. Complete it to unlock the rest.',
    heroCompletedBody: 'Today is completed. Use the next suggestion when you are ready.',
    heroLabelToday: 'اليوم',
    heroLabelStatus: 'الحالة',
    heroLabelNext: 'التالي',
    heroStatusNoPlan: 'لا توجد خطة مختارة',
    heroStatusPicked: 'مجدول لليوم',
    heroStatusLocked: 'قيد التنفيذ',
    heroStatusCompleted: 'مكتمل اليوم',
    heroNextFallback: 'اختر حصة لمعرفة التالي.',
    heroCtaStartToday: 'ابدأ اليوم',
    heroCtaContinueToday: 'أكمل اليوم',
    heroCtaViewNext: 'عرض الجلسة التالية',
    heroCtaPickRecommended: 'اجعلها خطة اليوم',
    heroCtaBrowse: 'تصفح الخطة',
    progressTitle: 'تقدم الخطة',
    progressSummary: (completed: number, total: number) => `${completed} من ${total} جلسات مكتملة`,
    progressHint: 'حافظ على الزخم دون إرهاق التعافي.',
    agendaTitle: 'أجندة 30 يوماً',
    agendaSubtitle: 'جدول تدريبك مع وضوح اليوم وما التالي.',
    recommendedReason: 'مُحسّن لتوازن التعافي.',
    completedReason: 'تم تسجيله وتحديث التعافي.',
    lockedReason: 'يفتح بعد جلسة اليوم.',
    futureReason: 'جاهز عندما تكون.',
    todayReason: 'مُعد لليوم.',
    nextUpLabel: 'التالي',
    sectionTitle: 'Week Plan',
    recommendationTitle: 'Recommended Next',
    loading: 'Loading your week plan...',
    empty: 'No workout plan was found for this week yet.',
    error: 'Could not load your week plan.',
    recommendedNextBadge: 'المقترح التالي',
    pickedBadge: 'اليوم',
    completedBadge: 'مكتمل',
    lockedBadge: 'مقفل',
    pickForToday: 'اخترها لليوم',
    startMyWorkout: 'Start My Workout',
    planLocked: 'Plan Locked',
    pickedForToday: 'Picked for today',
    completedForToday: 'Completed today',
    planFinishedTitle: 'Plan completed',
    planFinishedBody: 'You finished all weeks in this plan. Create a new plan to keep training next weeks.',
    createNewPlan: 'Create New Plan',
    exercisesIncluded: 'Exercises in this workout',
    showExercises: 'Show exercises',
    hideExercises: 'Hide exercises',
    noExercises: 'No exercises added yet.',
    exerciseCount: (count: number) => `${count} ${count === 1 ? 'exercise' : 'exercises'}`,
  },
  ar: {
    title: 'خطتي',
    heroEyebrow: 'يومك الحالي',
    heroBody: 'اختر بطاقة من الأسفل لحفظها كخطة تدريب اليوم.',
    heroSelectedEyebrow: 'محفوظ لليوم',
    heroSelectedBody: 'هذه هي الحصة المحفوظة لليوم حاليًا.',
    heroLockedBody: 'لقد بدأت تمرين اليوم بالفعل، لذلك أصبحت خطة اليوم مقفلة.',
    heroCompletedBody: 'تم تعليم حصة اليوم كمكتملة. اطلع على الاقتراح التالي عندما تكون جاهزًا.',
    heroLabelToday: 'Today',
    heroLabelStatus: 'Status',
    heroLabelNext: 'Next',
    heroStatusNoPlan: 'No plan selected',
    heroStatusPicked: 'Scheduled for today',
    heroStatusLocked: 'In progress',
    heroStatusCompleted: 'Completed today',
    heroNextFallback: 'Choose a session to see what is next.',
    heroCtaStartToday: 'Start Today',
    heroCtaContinueToday: 'Continue Today',
    heroCtaViewNext: 'View Next Session',
    heroCtaPickRecommended: 'Use As Today',
    heroCtaBrowse: 'Browse Plan',
    progressTitle: 'Plan Progress',
    progressSummary: (completed: number, total: number) => `${completed} of ${total} sessions completed`,
    progressHint: 'Keep momentum without overloading recovery.',
    agendaTitle: '30-Day Agenda',
    agendaSubtitle: 'Your training timeline with clear today and next states.',
    recommendedReason: 'Optimized for recovery balance.',
    completedReason: 'Logged and recovery updated.',
    lockedReason: 'Unlocks after today\'s session.',
    futureReason: 'Ready when you are.',
    todayReason: 'Set for today.',
    nextUpLabel: 'Next up',
    sectionTitle: 'خطة الأسبوع',
    recommendationTitle: 'الاقتراح التالي',
    loading: 'جارٍ تحميل خطة الأسبوع...',
    empty: 'لا توجد خطة تمارين لهذا الأسبوع بعد.',
    error: 'تعذر تحميل خطة الأسبوع.',
    recommendedNextBadge: 'Recommended Next',
    pickedBadge: 'Today',
    completedBadge: 'Completed',
    lockedBadge: 'Locked',
    pickForToday: 'Use as today',
    startMyWorkout: 'ابدأ تمريني',
    planLocked: 'الخطة مقفلة',
    pickedForToday: 'محفوظ لليوم',
    completedForToday: 'مكتمل اليوم',
    planFinishedTitle: 'اكتملت الخطة',
    planFinishedBody: 'أنهيت جميع أسابيع هذه الخطة. أنشئ خطة جديدة لتكمل التدريب في الأسابيع القادمة.',
    createNewPlan: 'أنشئ خطة جديدة',
    exercisesIncluded: 'التمارين داخل هذا التمرين',
    showExercises: 'أظهر التمارين',
    hideExercises: 'أخفِ التمارين',
    noExercises: 'لم يتم إضافة تمارين بعد.',
    exerciseCount: (count: number) => `${count} ${count === 1 ? 'تمرين' : 'تمارين'}`,
  },
} as const;

const LOCALIZED_COPY: LocalizedLanguageRecord<typeof COPY.en> = {
  en: COPY.en,
  ar: {
    title: 'خطتي',
    heroEyebrow: 'يومك الحالي',
    heroBody: 'اختر بطاقة من الأسفل لحفظها كخطة تدريب اليوم.',
    heroSelectedEyebrow: 'محفوظ لليوم',
    heroSelectedBody: 'هذه هي الحصة المحفوظة لليوم حالياً.',
    heroLockedBody: 'لقد بدأت تمرين اليوم بالفعل، لذلك أصبحت خطة اليوم مقفلة.',
    heroCompletedBody: 'تم تعليم حصة اليوم كمكتملة. اطلع على الاقتراح التالي عندما تكون جاهزاً.',
    heroLabelToday: 'Today',
    heroLabelStatus: 'Status',
    heroLabelNext: 'Next',
    heroStatusNoPlan: 'No plan selected',
    heroStatusPicked: 'Scheduled for today',
    heroStatusLocked: 'In progress',
    heroStatusCompleted: 'Completed today',
    heroNextFallback: 'Choose a session to see what is next.',
    heroCtaStartToday: 'Start Today',
    heroCtaContinueToday: 'Continue Today',
    heroCtaViewNext: 'View Next Session',
    heroCtaPickRecommended: 'Use As Today',
    heroCtaBrowse: 'Browse Plan',
    progressTitle: 'Plan Progress',
    progressSummary: (completed: number, total: number) => `${completed} of ${total} sessions completed`,
    progressHint: 'Keep momentum without overloading recovery.',
    agendaTitle: '30-Day Agenda',
    agendaSubtitle: 'Your training timeline with clear today and next states.',
    recommendedReason: 'Optimized for recovery balance.',
    completedReason: 'Logged and recovery updated.',
    lockedReason: 'Unlocks after today\'s session.',
    futureReason: 'Ready when you are.',
    todayReason: 'Set for today.',
    nextUpLabel: 'Next up',
    sectionTitle: 'خطة الأسبوع',
    recommendationTitle: 'الاقتراح التالي',
    loading: 'جارٍ تحميل خطة الأسبوع...',
    empty: 'لا توجد خطة تمارين لهذا الأسبوع بعد.',
    error: 'تعذر تحميل خطة الأسبوع.',
    recommendedNextBadge: 'Recommended Next',
    pickedBadge: 'Today',
    completedBadge: 'Completed',
    lockedBadge: 'Locked',
    pickForToday: 'Use as today',
    startMyWorkout: 'ابدأ تمريني',
    planLocked: 'الخطة مقفلة',
    pickedForToday: 'محفوظ لليوم',
    completedForToday: 'مكتمل اليوم',
    planFinishedTitle: 'اكتملت الخطة',
    planFinishedBody: 'أنهيت جميع أسابيع هذه الخطة. أنشئ خطة جديدة لتكمل التدريب في الأسابيع القادمة.',
    createNewPlan: 'أنشئ خطة جديدة',
    exercisesIncluded: 'التمارين داخل هذا التمرين',
    showExercises: 'أظهر التمارين',
    hideExercises: 'أخفِ التمارين',
    noExercises: 'لم يتم إضافة تمارين بعد.',
    exerciseCount: (count: number) => `${count} ${count === 1 ? 'تمرين' : 'تمارين'}`,
  },
  it: {
    title: 'Il Mio Piano',
    heroEyebrow: 'Giorno Attuale',
    heroBody: 'Scegli una scheda qui sotto per salvarla come piano di oggi.',
    heroSelectedEyebrow: 'Salvato Per Oggi',
    heroSelectedBody: 'Questo e il workout attualmente salvato per oggi.',
    heroLockedBody: 'Hai gia iniziato il workout di oggi, quindi il piano di oggi e bloccato.',
    heroCompletedBody: 'Il workout di oggi e segnato come completato. Usa il suggerimento seguente quando sei pronto.',
    heroLabelToday: 'Today',
    heroLabelStatus: 'Status',
    heroLabelNext: 'Next',
    heroStatusNoPlan: 'No plan selected',
    heroStatusPicked: 'Scheduled for today',
    heroStatusLocked: 'In progress',
    heroStatusCompleted: 'Completed today',
    heroNextFallback: 'Choose a session to see what is next.',
    heroCtaStartToday: 'Start Today',
    heroCtaContinueToday: 'Continue Today',
    heroCtaViewNext: 'View Next Session',
    heroCtaPickRecommended: 'Use As Today',
    heroCtaBrowse: 'Browse Plan',
    progressTitle: 'Plan Progress',
    progressSummary: (completed: number, total: number) => `${completed} of ${total} sessions completed`,
    progressHint: 'Keep momentum without overloading recovery.',
    agendaTitle: '30-Day Agenda',
    agendaSubtitle: 'Your training timeline with clear today and next states.',
    recommendedReason: 'Optimized for recovery balance.',
    completedReason: 'Logged and recovery updated.',
    lockedReason: 'Unlocks after today\'s session.',
    futureReason: 'Ready when you are.',
    todayReason: 'Set for today.',
    nextUpLabel: 'Next up',
    sectionTitle: 'Piano Settimanale',
    recommendationTitle: 'Prossimo Consigliato',
    loading: 'Caricamento del tuo piano settimanale...',
    empty: 'Nessun piano di allenamento trovato per questa settimana.',
    error: 'Impossibile caricare il tuo piano settimanale.',
    recommendedNextBadge: 'Recommended Next',
    pickedBadge: 'Today',
    completedBadge: 'Completed',
    lockedBadge: 'Locked',
    pickForToday: 'Use as today',
    startMyWorkout: 'Inizia Il Mio Workout',
    planLocked: 'Piano Bloccato',
    pickedForToday: 'Scelto per oggi',
    completedForToday: 'Completato oggi',
    planFinishedTitle: 'Piano completato',
    planFinishedBody: 'Hai finito tutte le settimane di questo piano. Crea un nuovo piano per continuare ad allenarti nelle prossime settimane.',
    createNewPlan: 'Crea Un Nuovo Piano',
    exercisesIncluded: 'Esercizi in questo workout',
    showExercises: 'Mostra esercizi',
    hideExercises: 'Nascondi esercizi',
    noExercises: 'Nessun esercizio aggiunto ancora.',
    exerciseCount: (count: number) => `${count} ${count === 1 ? 'esercizio' : 'esercizi'}`,
  },
  de: {
    title: 'Mein Plan',
    heroEyebrow: 'Aktueller Tag',
    heroBody: 'Waehle unten eine Karte aus, um sie als heutigen Plan zu speichern.',
    heroSelectedEyebrow: 'Fuer Heute Gespeichert',
    heroSelectedBody: 'Dies ist das Workout, das aktuell fuer heute gespeichert ist.',
    heroLockedBody: 'Du hast das heutige Workout bereits begonnen, deshalb ist der heutige Plan gesperrt.',
    heroCompletedBody: 'Das heutige Workout ist als erledigt markiert. Nutze den naechsten Vorschlag, wenn du bereit bist.',
    heroLabelToday: 'Today',
    heroLabelStatus: 'Status',
    heroLabelNext: 'Next',
    heroStatusNoPlan: 'No plan selected',
    heroStatusPicked: 'Scheduled for today',
    heroStatusLocked: 'In progress',
    heroStatusCompleted: 'Completed today',
    heroNextFallback: 'Choose a session to see what is next.',
    heroCtaStartToday: 'Start Today',
    heroCtaContinueToday: 'Continue Today',
    heroCtaViewNext: 'View Next Session',
    heroCtaPickRecommended: 'Use As Today',
    heroCtaBrowse: 'Browse Plan',
    progressTitle: 'Plan Progress',
    progressSummary: (completed: number, total: number) => `${completed} of ${total} sessions completed`,
    progressHint: 'Keep momentum without overloading recovery.',
    agendaTitle: '30-Day Agenda',
    agendaSubtitle: 'Your training timeline with clear today and next states.',
    recommendedReason: 'Optimized for recovery balance.',
    completedReason: 'Logged and recovery updated.',
    lockedReason: 'Unlocks after today\'s session.',
    futureReason: 'Ready when you are.',
    todayReason: 'Set for today.',
    nextUpLabel: 'Next up',
    sectionTitle: 'Wochenplan',
    recommendationTitle: 'Naechste Empfehlung',
    loading: 'Dein Wochenplan wird geladen...',
    empty: 'Fuer diese Woche wurde noch kein Trainingsplan gefunden.',
    error: 'Dein Wochenplan konnte nicht geladen werden.',
    recommendedNextBadge: 'Recommended Next',
    pickedBadge: 'Today',
    completedBadge: 'Completed',
    lockedBadge: 'Locked',
    pickForToday: 'Use as today',
    startMyWorkout: 'Mein Workout Starten',
    planLocked: 'Plan Gesperrt',
    pickedForToday: 'Fuer heute gewaehlt',
    completedForToday: 'Heute erledigt',
    planFinishedTitle: 'Plan abgeschlossen',
    planFinishedBody: 'Du hast alle Wochen dieses Plans abgeschlossen. Erstelle einen neuen Plan, um in den kommenden Wochen weiterzutrainieren.',
    createNewPlan: 'Neuen Plan Erstellen',
    exercisesIncluded: 'Uebungen in diesem Workout',
    showExercises: 'Uebungen zeigen',
    hideExercises: 'Uebungen ausblenden',
    noExercises: 'Noch keine Uebungen hinzugefuegt.',
    exerciseCount: (count: number) => `${count} ${count === 1 ? 'Uebung' : 'Uebungen'}`,
  },
  fr: {
    title: 'Mon Plan',
    heroEyebrow: 'Jour actuel',
    heroBody: 'Choisis une carte ci-dessous pour l enregistrer comme plan du jour.',
    heroSelectedEyebrow: 'Enregistre pour aujourd hui',
    heroSelectedBody: 'C est l entrainement actuellement enregistre pour aujourd hui.',
    heroLockedBody: 'Tu as deja commence l entrainement du jour, donc le plan d aujourd hui est verrouille.',
    heroCompletedBody: 'L entrainement du jour est marque comme termine. Utilise la suggestion suivante quand tu es pret.',
    heroLabelToday: 'Today',
    heroLabelStatus: 'Status',
    heroLabelNext: 'Next',
    heroStatusNoPlan: 'No plan selected',
    heroStatusPicked: 'Scheduled for today',
    heroStatusLocked: 'In progress',
    heroStatusCompleted: 'Completed today',
    heroNextFallback: 'Choose a session to see what is next.',
    heroCtaStartToday: 'Start Today',
    heroCtaContinueToday: 'Continue Today',
    heroCtaViewNext: 'View Next Session',
    heroCtaPickRecommended: 'Use As Today',
    heroCtaBrowse: 'Browse Plan',
    progressTitle: 'Plan Progress',
    progressSummary: (completed: number, total: number) => `${completed} of ${total} sessions completed`,
    progressHint: 'Keep momentum without overloading recovery.',
    agendaTitle: '30-Day Agenda',
    agendaSubtitle: 'Your training timeline with clear today and next states.',
    recommendedReason: 'Optimized for recovery balance.',
    completedReason: 'Logged and recovery updated.',
    lockedReason: 'Unlocks after today\'s session.',
    futureReason: 'Ready when you are.',
    todayReason: 'Set for today.',
    nextUpLabel: 'Next up',
    sectionTitle: 'Plan de la semaine',
    recommendationTitle: 'Prochain recommande',
    loading: 'Chargement de ton plan de la semaine...',
    empty: 'Aucun plan d entrainement n a encore ete trouve pour cette semaine.',
    error: 'Impossible de charger ton plan de la semaine.',
    recommendedNextBadge: 'Recommended Next',
    pickedBadge: 'Today',
    completedBadge: 'Completed',
    lockedBadge: 'Locked',
    pickForToday: 'Use as today',
    startMyWorkout: 'Commencer mon entrainement',
    planLocked: 'Plan verrouille',
    pickedForToday: 'Choisi pour aujourd hui',
    completedForToday: 'Termine aujourd hui',
    planFinishedTitle: 'Plan termine',
    planFinishedBody: 'Tu as termine toutes les semaines de ce plan. Cree un nouveau plan pour continuer a t entrainer les prochaines semaines.',
    createNewPlan: 'Creer un nouveau plan',
    exercisesIncluded: 'Exercices de cet entrainement',
    showExercises: 'Afficher les exercices',
    hideExercises: 'Masquer les exercices',
    noExercises: 'Aucun exercice ajoute pour le moment.',
    exerciseCount: (count: number) => `${count} ${count === 1 ? 'exercice' : 'exercices'}`,
  },
};

const MUSCLE_LABELS: LocalizedLanguageRecord<Record<string, string>> = {
  en: {},
  ar: {
    chest: 'الصدر',
    back: 'الظهر',
    shoulders: 'الأكتاف',
    'front shoulders': 'الأكتاف الأمامية',
    'side shoulders': 'الأكتاف الجانبية',
    'rear shoulders': 'الأكتاف الخلفية',
    triceps: 'الترايسبس',
    biceps: 'البايسبس',
    abs: 'البطن',
    quadriceps: 'الرباعية',
    hamstrings: 'الخلفية',
    calves: 'السمانة',
    forearms: 'الساعد',
    glutes: 'الألوية',
    adductors: 'المقربات',
    general: 'عام',
  },
  it: {
    chest: 'Petto',
    back: 'Schiena',
    shoulders: 'Spalle',
    'front shoulders': 'Spalle anteriori',
    'side shoulders': 'Spalle laterali',
    'rear shoulders': 'Spalle posteriori',
    triceps: 'Tricipiti',
    biceps: 'Bicipiti',
    abs: 'Addome',
    quadriceps: 'Quadricipiti',
    hamstrings: 'Femorali',
    calves: 'Polpacci',
    forearms: 'Avambracci',
    glutes: 'Glutei',
    adductors: 'Adduttori',
    general: 'Generale',
  },
  de: {
    chest: 'Brust',
    back: 'Ruecken',
    shoulders: 'Schultern',
    'front shoulders': 'Vordere Schultern',
    'side shoulders': 'Seitliche Schultern',
    'rear shoulders': 'Hintere Schultern',
    triceps: 'Trizeps',
    biceps: 'Bizeps',
    abs: 'Bauch',
    quadriceps: 'Quadrizeps',
    hamstrings: 'Beinbeuger',
    calves: 'Waden',
    forearms: 'Unterarme',
    glutes: 'Gesaess',
    adductors: 'Adduktoren',
    general: 'Allgemein',
  },
  fr: {
    chest: 'Poitrine',
    back: 'Dos',
    shoulders: 'Epaules',
    'front shoulders': 'Epaules avant',
    'side shoulders': 'Epaules laterales',
    'rear shoulders': 'Epaules arriere',
    triceps: 'Triceps',
    biceps: 'Biceps',
    abs: 'Abdos',
    quadriceps: 'Quadriceps',
    hamstrings: 'Ischio-jambiers',
    calves: 'Mollets',
    forearms: 'Avant-bras',
    glutes: 'Fessiers',
    adductors: 'Adducteurs',
    general: 'General',
  },
};

const toTitleCase = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export function WorkoutOverviewScreen({
  onBack,
  onSelectWorkout,
  onPickWorkoutForToday,
  onOpenNewPlanFlow,
  currentDayLabel,
  workouts,
  selectedTodayWorkoutName,
  selectedTodayWorkoutDayLabel,
  hasTodaySelection = false,
  isTodaySelectionCompleted = false,
  isTodayPlanLocked = false,
  isPlanCompleted = false,
  recommendedWorkout = null,
  userProgram,
  assignmentHistory = [],
  accountCreatedAt,
  loading = false,
  error = null,
}: WorkoutOverviewScreenProps) {
  const [language, setLanguage] = useState<AppLanguage>('en');

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

  const copy = useMemo(
    () => normalizeLocalizedValue(LOCALIZED_COPY[language] || LOCALIZED_COPY.en),
    [language],
  );
  const isArabic = language === 'ar';
  const localizedMuscleLabels = useMemo(
    () => normalizeLocalizedValue(MUSCLE_LABELS[language] || {}),
    [language],
  );

  const localizeDay = useCallback((value: string) => {
    return formatWorkoutDayLabel(value, value, language);
  }, [language]);

  const localizeWorkoutText = useCallback((value: string) => {
    return translateProgramText(value, language);
  }, [language]);

  const localizeMuscle = useCallback((value: string) => {
    const normalized = String(value || '').trim().toLowerCase();
    return localizedMuscleLabels[normalized] || value;
  }, [localizedMuscleLabels]);

  const selectableWorkouts = useMemo(
    () => workouts.filter((workout) => Number(workout.exerciseCount || 0) > 0),
    [workouts],
  );
  const latestAssignmentByWorkoutKey = useMemo(() => {
    const entries = Array.isArray(assignmentHistory) ? assignmentHistory : [];
    const latestByKey = new Map<string, WorkoutAssignmentHistoryEntry>();

    entries.forEach((entry) => {
      const workoutKey = String(entry?.workoutKey || '').trim();
      if (!workoutKey) return;

      const previousEntry = latestByKey.get(workoutKey);
      if (!previousEntry) {
        latestByKey.set(workoutKey, entry);
        return;
      }

      const nextDateKey = String(entry?.dateKey || '').trim();
      const previousDateKey = String(previousEntry?.dateKey || '').trim();
      const nextCompletedAt = String(entry?.completedAt || '').trim();
      const previousCompletedAt = String(previousEntry?.completedAt || '').trim();

      if (
        nextDateKey > previousDateKey
        || (nextDateKey === previousDateKey && nextCompletedAt > previousCompletedAt)
      ) {
        latestByKey.set(workoutKey, entry);
      }
    });

    return latestByKey;
  }, [assignmentHistory]);
  const premiumConfig = useMemo(() => getActiveT2PremiumConfig(userProgram), [userProgram]);
  const heroTitle = hasTodaySelection
    ? localizeWorkoutText(String(selectedTodayWorkoutName || '').trim()) || localizeDay(selectedTodayWorkoutDayLabel || currentDayLabel)
    : localizeDay(currentDayLabel);
  const heroSupportLine = hasTodaySelection
    ? (isTodaySelectionCompleted
        ? copy.heroCompletedBody
        : isTodayPlanLocked
          ? copy.heroLockedBody
          : copy.heroSelectedBody)
    : copy.heroBody;

  const cards = useMemo(
    () => selectableWorkouts.map((workout) => ({
      ...workout,
      isCompleted: workout.isCompletedToday || Boolean(latestAssignmentByWorkoutKey.get(workout.key)?.completed),
      premiumMeta: premiumConfig
        ? buildT2PremiumCardMeta({
            language,
            workoutName: workout.workoutName,
            exerciseCount: workout.exerciseCount,
            isPickedForToday: workout.isPickedForToday,
            isRecommendedNext: workout.isRecommendedNext,
          })
        : null,
      localizedWorkoutName: localizeWorkoutText(workout.workoutName),
      localizedMuscles: workout.targetMuscles.slice(0, 3).map((entry) => {
        const label = localizeMuscle(toTitleCase(entry));
        return {
          label,
          image: getBodyPartImage(entry),
        };
      }),
    })),
    [language, latestAssignmentByWorkoutKey, localizeMuscle, localizeWorkoutText, premiumConfig, selectableWorkouts],
  );
  const todayCard = useMemo(
    () => cards.find((workout) => workout.isPickedForToday) || null,
    [cards],
  );
  const recommendedCard = useMemo(
    () => cards.find((workout) => workout.isRecommendedNext) || null,
    [cards],
  );
  const nextRecommendation = useMemo(() => {
    if (recommendedCard) {
      return {
        title: localizeWorkoutText(recommendedCard.workoutName),
        dayLabel: localizeDay(recommendedCard.dayLabel),
      };
    }
    if (recommendedWorkout) {
      return {
        title: localizeWorkoutText(recommendedWorkout.workoutName),
        dayLabel: localizeDay(recommendedWorkout.dayLabel),
      };
    }
    return null;
  }, [localizeDay, localizeWorkoutText, recommendedCard, recommendedWorkout]);
  const heroStatus = isTodaySelectionCompleted
    ? copy.heroStatusCompleted
    : isTodayPlanLocked
      ? copy.heroStatusLocked
      : hasTodaySelection
        ? copy.heroStatusPicked
        : copy.heroStatusNoPlan;
  const heroStatusTone = isTodaySelectionCompleted
    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
    : isTodayPlanLocked
      ? 'border-rose-400/30 bg-rose-500/10 text-rose-200'
      : hasTodaySelection
        ? 'border-accent/30 bg-accent/15 text-accent'
        : 'border-white/15 bg-white/5 text-text-secondary';
  const completedCount = useMemo(
    () => cards.filter((workout) => workout.isCompleted).length,
    [cards],
  );
  const progressRatio = cards.length > 0 ? Math.min(1, completedCount / cards.length) : 0;
  const primaryAction = useMemo(() => {
    if (todayCard && !isTodaySelectionCompleted) {
      return {
        label: isTodayPlanLocked ? copy.heroCtaContinueToday : copy.heroCtaStartToday,
        onClick: () => onSelectWorkout(todayCard.key),
        tone: 'primary',
      };
    }
    if (recommendedCard) {
      if (!hasTodaySelection && !isTodayPlanLocked) {
        return {
          label: copy.heroCtaPickRecommended,
          onClick: () => onPickWorkoutForToday(recommendedCard.key),
          tone: 'primary',
        };
      }
      return {
        label: copy.heroCtaViewNext,
        onClick: () => onSelectWorkout(recommendedCard.key),
        tone: 'secondary',
      };
    }
    if (cards.length > 0) {
      return {
        label: copy.heroCtaBrowse,
        onClick: () => onSelectWorkout(cards[0].key),
        tone: 'secondary',
      };
    }
    return null;
  }, [
    cards,
    copy.heroCtaBrowse,
    copy.heroCtaContinueToday,
    copy.heroCtaPickRecommended,
    copy.heroCtaStartToday,
    copy.heroCtaViewNext,
    hasTodaySelection,
    isTodayPlanLocked,
    isTodaySelectionCompleted,
    onPickWorkoutForToday,
    onSelectWorkout,
    recommendedCard,
    todayCard,
  ]);
  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header
          title={copy.title}
          onBack={onBack}
          backButtonCoachmarkTargetId="my_plan_back_button"
          titleCoachmarkTargetId="my_plan_page_title"
        />
      </div>

      <div className="px-4 sm:px-6 space-y-5">
        <div
          data-coachmark-target="my_plan_current_day_card"
          className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-card/70 p-5"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(191,255,0,0.16),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_40%)]" aria-hidden="true" />
          <div
            className="absolute inset-0 bg-gradient-to-r from-background/65 via-background/45 to-background/25"
            data-coachmark-target="my_plan_current_day_gradient"
            aria-hidden="true"
          />
          <div className={`relative z-10 space-y-4 ${isArabic ? 'text-right' : 'text-left'}`}>
            <div className="space-y-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                  {copy.heroLabelToday}
                </div>
                <h2 className="mt-2 text-[1.7rem] font-semibold text-white">
                  {heroTitle}
                </h2>
                <p className="mt-2 max-w-md text-sm text-text-secondary">
                  {heroSupportLine}
                </p>
                <div className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${heroStatusTone}`}>
                  <span>{copy.heroLabelStatus}</span>
                  <span className="text-[11px] font-bold text-white/90">•</span>
                  <span>{heroStatus}</span>
                </div>
              </div>

              {nextRecommendation && (
                <div className="rounded-2xl border border-white/10 bg-background/40 p-3">
                  <div className="mt-2 text-base font-semibold text-white">
                    {nextRecommendation.title}
                  </div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {nextRecommendation.dayLabel}
                  </div>
                  <div className="mt-2 text-[11px] text-text-tertiary">
                    {copy.recommendedReason}
                  </div>
                </div>
              )}
            </div>

            {primaryAction && (
              <div className={`flex ${isArabic ? 'justify-start' : 'justify-end'}`}>
                <button
                  type="button"
                  onClick={primaryAction.onClick}
                  className={`font-marker inline-flex min-w-[12rem] items-center justify-center rounded-full border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                    primaryAction.tone === 'primary'
                      ? 'border-accent/30 bg-accent text-black hover:bg-[#aee600]'
                      : 'border-white/15 bg-white/5 text-text-primary hover:border-accent/30 hover:bg-white/10'
                  }`}
                >
                  {primaryAction.label}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1.4rem] border border-white/10 bg-card/60 p-4">
          <div className={`flex flex-wrap items-center justify-between gap-2 ${isArabic ? 'text-right' : 'text-left'}`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
              {copy.progressTitle}
            </div>
            <div className="text-xs text-text-secondary">
              {copy.progressSummary(completedCount, cards.length)}
            </div>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-accent/70 transition-all"
              style={{ width: `${progressRatio * 100}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-text-secondary">
            {copy.progressHint}
          </div>
        </div>

        <div data-coachmark-target="my_plan_agenda_card" className="space-y-3">
          <div className={`text-xs text-text-tertiary ${isArabic ? 'text-right' : 'text-left'}`}>
            {copy.agendaSubtitle}
          </div>
          <AgendaSection
            userProgram={userProgram}
            assignmentHistory={assignmentHistory}
            accountCreatedAt={accountCreatedAt}
            selectedWorkoutKey={selectableWorkouts.find((workout) => workout.isPickedForToday)?.key || ''}
            isTodayPlanLocked={isTodayPlanLocked}
            onPickWorkoutForToday={onPickWorkoutForToday}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">
              {copy.sectionTitle}
            </div>
          </div>

          {loading && (
            <div className="rounded-2xl border border-white/10 bg-card/60 p-6">
              <div className="flex min-h-[160px] items-center justify-center">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div
                    className="h-14 w-14 animate-spin rounded-full border-[6px] border-white/10 border-b-transparent border-l-transparent border-r-[#5b61ff] border-t-[#a8afff]"
                    aria-label={copy.loading}
                    role="status"
                  />
                </div>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-5 text-sm text-rose-200">
              {error || copy.error}
            </div>
          )}

          {!loading && !error && !isPlanCompleted && cards.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-card/60 px-4 py-5 text-sm text-text-secondary">
              {copy.empty}
            </div>
          )}

          {!loading && !error && isPlanCompleted && (
            <div className={`rounded-[1.6rem] border border-accent/30 bg-accent/10 p-5 ${isArabic ? 'text-right' : 'text-left'}`}>
              <div className="text-base font-semibold text-white">{copy.planFinishedTitle}</div>
              <div className="mt-2 text-sm text-text-secondary">
                {copy.planFinishedBody}
              </div>
              {onOpenNewPlanFlow && (
                <div className={`mt-4 flex ${isArabic ? 'justify-start' : 'justify-end'}`}>
                  <button
                    type="button"
                    onClick={onOpenNewPlanFlow}
                    className="font-marker inline-flex min-w-[12rem] items-center justify-center rounded-full border border-accent/30 bg-accent px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-black transition-colors hover:bg-[#aee600]"
                  >
                    {copy.createNewPlan}
                  </button>
                </div>
              )}
            </div>
          )}

          {!loading && !error && !isPlanCompleted && cards.length > 0 && (
            <div className="space-y-3">
              {cards.map((workout, index) => {
                const isCompleted = !!workout.isCompleted;
                const isLockedForSelection = isTodayPlanLocked && hasTodaySelection && !workout.isPickedForToday;
                const cardState = isCompleted
                  ? 'completed'
                  : workout.isPickedForToday
                    ? 'today'
                    : workout.isRecommendedNext
                      ? 'recommended'
                      : isLockedForSelection
                        ? 'locked'
                        : 'future';
                const stateBadge = cardState === 'completed'
                  ? copy.completedBadge
                  : cardState === 'today'
                    ? copy.pickedBadge
                    : cardState === 'recommended'
                      ? copy.recommendedNextBadge
                      : cardState === 'locked'
                        ? copy.lockedBadge
                        : null;
                const stateReason = cardState === 'completed'
                  ? copy.completedReason
                  : cardState === 'recommended'
                    ? copy.recommendedReason
                    : cardState === 'locked'
                      ? copy.lockedReason
                      : cardState === 'today'
                        ? copy.todayReason
                        : copy.futureReason;
                const detailLine = workout.premiumMeta?.insight || stateReason;
                const cardTone = cardState === 'completed'
                  ? 'border-emerald-500/25 bg-emerald-500/[0.06] hover:border-emerald-400/35'
                  : cardState === 'today'
                    ? 'border-accent/35 bg-accent/10 shadow-[0_8px_20px_rgba(0,0,0,0.22)]'
                    : cardState === 'recommended'
                      ? 'border-accent/45 bg-accent/14 shadow-[0_10px_24px_rgba(0,0,0,0.24)]'
                      : cardState === 'locked'
                        ? 'border-white/8 bg-white/[0.04]'
                        : 'border-white/10 bg-card/60 hover:border-accent/20 hover:bg-card/75';
                const iconTone = cardState === 'completed'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : cardState === 'recommended' || cardState === 'today'
                    ? 'border-accent/35 bg-accent/15 text-accent'
                    : cardState === 'locked'
                      ? 'border-white/10 bg-white/5 text-text-tertiary'
                      : 'border-white/10 bg-white/5 text-text-secondary';
                const Icon = cardState === 'completed'
                  ? CheckCircle2
                  : cardState === 'recommended'
                    ? Sparkles
                    : cardState === 'locked'
                      ? Lock
                      : Dumbbell;
                const isPrimaryAction = cardState === 'today' || cardState === 'recommended';

                return (
                <div
                  key={workout.key}
                  data-coachmark-target={index === 0 ? 'my_plan_first_week_card' : undefined}
                  className={`w-full rounded-[1.6rem] border p-4 transition-colors ${cardTone} ${isArabic ? 'text-right' : 'text-left'}`}
                  dir={isArabic ? 'rtl' : 'ltr'}
                >
                  <button
                    type="button"
                    onClick={() => onSelectWorkout(workout.key)}
                    className="w-full text-inherit"
                    aria-label={localizeWorkoutText(workout.premiumMeta?.displayTitle || workout.workoutName)}
                  >
                    <div className={`flex items-start justify-between gap-3 ${isArabic ? 'flex-row-reverse' : ''}`}>
                      <div className={`flex items-start gap-3 min-w-0 ${isArabic ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${iconTone}`}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          {workout.premiumMeta?.weekLabel && (
                            <div className={`mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary ${isArabic ? 'flex-row-reverse' : ''}`}>
                              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-text-secondary">
                                {workout.premiumMeta.weekLabel}
                              </span>
                              <span className="rounded-full border border-accent/15 bg-accent/10 px-2.5 py-1 text-accent">
                                {workout.premiumMeta.intensityLabel}
                              </span>
                            </div>
                          )}
                          <div className={`flex items-center justify-between gap-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
                            <div className="truncate text-base font-semibold text-white">
                              {localizeWorkoutText(workout.premiumMeta?.displayTitle || workout.localizedWorkoutName || workout.workoutName)}
                            </div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                              {localizeDay(workout.dayLabel)}
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-text-secondary">
                            {workout.premiumMeta
                              ? `${copy.exerciseCount(workout.exerciseCount)} • ${workout.premiumMeta.durationLabel}`
                              : copy.exerciseCount(workout.exerciseCount)}
                          </div>
                          <div className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
                            {detailLine}
                          </div>
                        </div>
                      </div>

                      <div className={`flex items-center gap-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
                        {stateBadge && (
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                            cardState === 'completed'
                              ? 'bg-emerald-500/15 text-emerald-200'
                              : cardState === 'recommended' || cardState === 'today'
                                ? 'bg-accent/15 text-accent'
                                : 'bg-white/10 text-text-tertiary'
                          }`}>
                            {stateBadge}
                          </span>
                        )}
                        <img
                          src={rightArrowIcon}
                          alt=""
                          aria-hidden="true"
                          className={`mb-1 h-[18px] w-[18px] shrink-0 object-contain opacity-70 transition-transform ${
                            isArabic
                              ? 'rotate-180'
                              : ''
                          }`}
                        />
                      </div>
                    </div>
                    {workout.localizedMuscles.length > 0 && (
                      <div className={`mt-3 flex items-center gap-2 ${isArabic ? 'justify-end' : 'justify-start'}`}>
                        {workout.localizedMuscles.map((muscle) => (
                          <div
                            key={`${workout.key}-${muscle.label}`}
                            className="h-11 w-11 overflow-hidden rounded-xl border border-white/10 bg-white/5"
                            title={muscle.label}
                          >
                            <img
                              src={muscle.image}
                              alt={muscle.label}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                  {cardState === 'completed' && workout.isCompletedToday && recommendedCard && (
                    <div className={`mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-text-secondary ${isArabic ? 'text-right' : 'text-left'}`}>
                      <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                        {copy.nextUpLabel}
                      </span>
                      {localizeWorkoutText(recommendedCard.workoutName)}
                    </div>
                  )}

                  <div className={`mt-4 flex ${isArabic ? 'justify-start' : 'justify-end'}`}>
                    <button
                      type="button"
                      data-coachmark-target={index === 0 ? 'my_plan_first_action_button' : undefined}
                      onClick={() => {
                        if (isCompleted || isLockedForSelection) {
                          return;
                        }

                        if (workout.isPickedForToday) {
                          onSelectWorkout(workout.key);
                          return;
                        }

                        onPickWorkoutForToday(workout.key);
                      }}
                      disabled={isCompleted || isLockedForSelection}
                      className={`font-marker inline-flex min-w-[10.5rem] items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                        isCompleted
                          ? 'cursor-default border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                          : isLockedForSelection
                            ? 'cursor-not-allowed border-white/10 bg-white/5 text-text-tertiary'
                            : isPrimaryAction
                              ? 'border-accent/30 bg-accent text-black hover:bg-[#aee600]'
                              : 'border-accent/30 bg-accent/20 text-text-primary hover:bg-accent/25'
                      }`}
                    >
                      {isCompleted
                        ? (workout.isCompletedToday ? copy.completedForToday : copy.completedBadge)
                        : workout.isPickedForToday
                          ? copy.startMyWorkout
                          : isLockedForSelection
                            ? copy.planLocked
                            : copy.pickForToday}
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
