import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Header } from '../ui/Header';
import { api } from '../../services/api';
import { CalendarX2, Check, Flag, FlagTriangleRight, Play, Search, TriangleAlert, X } from 'lucide-react';
import { getBodyPartImage } from '../../services/bodyPartTheme';
import { resolveExerciseCategoryVideo, resolveExerciseVideo } from '../../services/exerciseVideos';
import { AppLanguage, LocalizedLanguageRecord, getActiveLanguage, getStoredLanguage } from '../../services/language';
import { formatWorkoutDayLabel, normalizeWorkoutDayKey } from '../../services/workoutDayLabel';
import { stripExercisePrefix } from '../../services/exerciseName';
import { translateProgramText } from '../../services/programI18n';
import { useScreenshotProtection } from '../../shared/useScreenshotProtection';
import { MuscleSvgBadge } from './MuscleSvgBadge';
import { ExerciseMedia } from './ExerciseMedia';
import type { ExerciseRemoteMedia } from '../../services/exerciseVideos';

interface WorkoutPlanScreenProps {
  onBack: () => void;
  onExerciseClick: (exercise: string) => void;
  onPreviewExercise?: (exercise: string) => void;
  onAddExercise: (exercise: CatalogExercise) => Promise<{ added: boolean; reason?: string }> | { added: boolean; reason?: string };
  onMissDay?: () => Promise<{ missed: boolean; reason?: string }> | { missed: boolean; reason?: string };
  onMarkDayFullyDone?: () => Promise<{ completed: boolean; reason?: string }> | { completed: boolean; reason?: string };
  onOpenLatestSummary?: () => void;
  hasLatestSummary?: boolean;
  workoutDay: string;
  workoutDayLabel?: string;
  completedExercises: string[];
  todayExercises: any[];
  loading: boolean;
  allowEditing?: boolean;
  isDayFullyDone?: boolean;
  isHyroxMode?: boolean;
}

type CatalogExercise = {
  id: number;
  name: string;
  muscle: string;
  bodyPart?: string | null;
  primaryMedia?: ExerciseRemoteMedia | null;
  media?: ExerciseRemoteMedia[];
};

type WorkoutExerciseCard = {
  name: string;
  sets: number;
  reps: string;
  rest: unknown;
  targetWeight: number | null;
  notes: string;
  targetMuscles: string[];
  primaryMedia?: ExerciseRemoteMedia | null;
  media?: ExerciseRemoteMedia[];
};

const normalizeExerciseKey = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase();

const getLatestHistoryWeight = (rows: any[]): number | null => {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const normalized = rows
    .map((row: any) => {
      const completedFlag = Number(row?.completed ?? 1);
      if (completedFlag === 0) return null;
      const createdAt = row?.created_at || row?.createdAt || row?.date || null;
      const parsedDate = createdAt ? new Date(createdAt) : null;
      const timestamp = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.getTime() : 0;
      const dateKey = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : '';
      const weight = Number(row?.weight ?? 0);
      if (!Number.isFinite(weight) || weight <= 0) return null;
      return { weight, timestamp, dateKey };
    })
    .filter(Boolean) as Array<{ weight: number; timestamp: number; dateKey: string }>;

  if (normalized.length === 0) return null;

  normalized.sort((a, b) => b.timestamp - a.timestamp);
  const latestDateKey = normalized[0].dateKey;
  const sameDay = latestDateKey
    ? normalized.filter((row) => row.dateKey === latestDateKey)
    : normalized;

  const topWeight = sameDay.reduce((max, row) => Math.max(max, row.weight), 0);
  return topWeight > 0 ? Number(topWeight.toFixed(2)) : null;
};

const toTitleCase = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const canonicalizeMuscleLabel = (value: unknown) => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return '';

  if (key.includes('rear delt') || key.includes('rear deltoid') || key.includes('posterior delt')) return 'Rear Shoulders';
  if (key.includes('lateral delt') || key.includes('side delt') || key.includes('medial delt')) return 'Side Shoulders';
  if (key.includes('front delt') || key.includes('anterior delt') || key.includes('front deltoid')) return 'Front Shoulders';
  if (key.includes('shoulder') || key.includes('delt')) return 'Shoulders';
  if (key.includes('tricep') || key.includes('triceps brachii')) return 'Triceps';
  if (key.includes('bicep') || key.includes('biceps brachii') || key.includes('brachialis')) return 'Biceps';
  if (key.includes('chest') || key.includes('pect')) return 'Chest';
  if (key.includes('back') || key.includes('lat') || key.includes('trap') || key.includes('rhomboid')) return 'Back';
  if (key.includes('adductor') || key.includes('adducteur') || key.includes('addicteur') || key.includes('inner thigh')) return 'Adductors';
  if (key.includes('quad') || key.includes('thigh')) return 'Quadriceps';
  if (key.includes('hamstring')) return 'Hamstrings';
  if (key.includes('calf') || key.includes('calves') || key.includes('claves') || key.includes('mollet') || key.includes('moulet')) return 'Calves';
  if (key.includes('shin') || key.includes('tibia') || key.includes('tibialis') || key.includes('tibial')) return 'Tibialis';
  if (key.includes('abs') || key.includes('core') || key.includes('oblique') || key.includes('abdom')) return 'Abs';
  if (key.includes('glute')) return 'Glutes';
  if (key.includes('forearm') || key.includes('fore arm') || key.includes('avant bra') || key.includes('avant bras') || key.includes('avant-bras') || key.includes('grip') || key.includes('wrist')) return 'Forearms';

  return toTitleCase(key);
};

const inferMusclesFromExerciseName = (exerciseName = '') => {
  const name = String(exerciseName).toLowerCase();
  const matches: string[] = [];
  const isShoulderIsolation = /lateral raise|\blateral\b|rear delt|face pull|front raise/.test(name);
  const isShoulderPress = /shoulder|overhead press|arnold press|seated db press|seated shoulder press|machine shoulder press/.test(name);

  if (/bench|chest|fly|push-up|push up|pec deck|incline (db|dumbbell|barbell|machine|smith)? ?press|machine press|hammer strength press|weighted dip|dip/.test(name)) matches.push('Chest', 'Triceps', 'Shoulders');
  if (/deadlift|row|pull-up|pull up|pullup|chin-up|chin up|chinup|pulldown|pullover|lat pulldown|lat pull|rack pull/.test(name)) matches.push('Back', 'Biceps', 'Forearms');
  if (/squat|leg press|leg extension|lunge|split squat|step up|hip thrust/.test(name)) matches.push('Quadriceps', 'Hamstrings', 'Calves');
  if (/romanian deadlift|rdl|leg curl|hamstring/.test(name)) matches.push('Hamstrings');
  if (isShoulderIsolation) matches.push('Shoulders');
  if (isShoulderPress) matches.push('Shoulders', 'Triceps');
  if (/curl/.test(name)) matches.push('Biceps', 'Forearms');
  if (/tricep|triceps|pushdown|push down|skullcrusher|french press/.test(name)) matches.push('Triceps');
  if (/calf/.test(name)) matches.push('Calves');
  if (/abs|core|crunch|plank|sit-up|sit up|leg raise|leg lift|knee raise|vacuum|hollow|dead bug|toe touch|abs circuit/.test(name)) matches.push('Abs');

  return [...new Set(matches.map((entry) => canonicalizeMuscleLabel(entry)).filter(Boolean))];
};

const getMuscleImage = (muscle: string) => getBodyPartImage(muscle);

type TargetMuscleDisplay = {
  name: string;
  sourceName?: string;
  score: number;
};

const LOWER_BODY_MUSCLES = new Set(['Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Tibialis', 'Legs']);

const toMuscleDisplayGroup = (muscle: string) => {
  const canonical = canonicalizeMuscleLabel(muscle);
  if (LOWER_BODY_MUSCLES.has(canonical)) return 'Legs';
  if (canonical === 'Lats' || canonical === 'Traps' || canonical.toLowerCase().includes('back')) return 'Back';
  return canonical;
};

const resolveWorkoutMusclePriority = (workoutText: string) => {
  const normalized = String(workoutText || '').trim().toLowerCase();
  const isLegDay = /\b(leg|legs|lower|quad|hamstring|glute|calf|calves)\b/.test(normalized)
    || normalized.includes('lower body');
  const isBackDay = /\b(back|pull|lat|lats|row|pulldown|pull-up|pull up)\b/.test(normalized);

  if (isLegDay) return ['Legs', 'Back'];
  if (isBackDay) return ['Back', 'Legs'];
  return [];
};

const isGirlsStyleValue = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'woman' || normalized === 'female' || normalized === 'f' || normalized === 'girls' || normalized === 'femme';
};

const safeParseStoredJson = (key: string) => {
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
};

const readStoredStyleGender = () => {
  if (typeof window === 'undefined') return '';
  return String(localStorage.getItem('appStyleGender') || '').trim().toLowerCase();
};

const shouldUseGirlsTheme = () => {
  if (typeof window === 'undefined') return false;
  const styleGender = readStoredStyleGender();
  if (styleGender) return isGirlsStyleValue(styleGender);

  const user = safeParseStoredJson('appUser') || safeParseStoredJson('user');
  const profile = safeParseStoredJson('onboardingProfile');
  return isGirlsStyleValue(user?.gender) || isGirlsStyleValue(profile?.gender) || profile?.onboardingTheme === 'girls';
};

function TargetMuscleCards({ muscles, themeVariant = 'default' }: { muscles: TargetMuscleDisplay[]; themeVariant?: 'default' | 'girls' }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {muscles.map((muscle) => (
        <MuscleSvgBadge
          key={muscle.name}
          muscle={{ label: muscle.name, sourceName: muscle.sourceName || canonicalizeMuscleLabel(muscle.name) }}
          className="w-full"
          figureClassName="h-24 sm:h-28"
          themeVariant={themeVariant}
        />
      ))}
    </div>
  );
}

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
  tibialis: 'الظنبوبية',
  general: 'عام',
};

const AR_DAY_LABELS: Record<string, string> = {
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
  saturday: 'السبت',
  sunday: 'الأحد',
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
  tibialis: 'Tibiale',
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
  tibialis: 'Schienbein',
  general: 'Allgemein',
};

const WORKOUT_PLAN_I18N = {
  en: {
    markMissedAria: 'Mark today as missed',
    missDay: 'Miss Day',
    openLatestSummaryAria: 'Open latest workout summary',
    loadingWorkout: 'Loading workout...',
    workout: 'Workout',
    todayWorkoutTitle: 'Today\'s Workout',
    pickWorkoutTitle: 'Pick Your Workout',
    exerciseFallback: 'Exercise',
    generalMuscle: 'General',
    restDayLabel: 'Rest Day',
    targetMuscles: 'Target Muscles',
    targetMusclesEmpty: 'Target muscles will appear after exercises are loaded.',
    exercisesCount: (count: number) => `${count} ${count === 1 ? 'exercise' : 'exercises'}`,
    addExerciseAria: 'Add exercise',
    restDayEmpty: 'Rest day. No workout scheduled for today.',
    noExercises: 'No exercises added for today yet.',
    setsLabel: 'sets',
    repsLabel: 'reps',
    kgLabel: 'kg',
    restSeconds: (value: number) => `${value}s rest`,
    restAsNeeded: 'Rest as needed',
    lastWeightLabel: 'Last weight',
    videoMissing: 'Video missing',
    addExerciseTitle: 'Add Exercise',
    addExerciseSubtitle: 'Pick an exercise to add for today.',
    closeAddExercise: 'Close add exercise dialog',
    loadingExercises: 'Loading exercises...',
    catalogError: 'Could not load exercise catalog.',
    exercisesHeading: 'Exercises',
    chooseExerciseHint: 'Choose an exercise card to add it to today.',
    selectMuscleHint: 'Select a muscle group below to browse exercises.',
    previewVideoAria: 'Preview exercise video',
    clear: 'Clear',
    searchExercise: 'Search exercise name...',
    selectMuscleFirst: 'Select a muscle group first',
    pickMuscleCard: 'Pick a muscle card below to load matching exercises.',
    noMatchingExercise: (label: string) => `No matching exercise found for ${label}.`,
    muscleGroups: 'Muscle Groups',
    noExerciseGroups: 'No exercise groups available.',
    add: 'Add',
    addFail: 'Could not add exercise.',
    markDoneAria: 'Mark this day as fully done',
    markDone: 'Fully Done',
    markDoneFail: 'Could not mark this day as fully done.',
    markDoneTitle: 'Mark this day as fully done?',
    markDoneDescription: (workoutName: string) =>
      `This will save ${workoutName} as fully done and mark every exercise in this day as completed.`,
    markDoneWeightNote: 'Before you confirm, make sure the saved sets use the real weight you trained with today.',
    closeMarkDoneDialog: 'Close fully done dialog',
    confirmMarkDone: 'Yes, Mark Fully Done',
    markingDone: 'Saving...',
    missFail: 'Could not mark this workout as missed.',
    missTitle: "Miss today's workout?",
    missDescription: (workoutName: string) =>
      `This will mark ${workoutName} as missed, remove it from today's active flow, and break your current workout streak for today.`,
    closeMissDialog: 'Close miss day dialog',
    missWarning: 'Use this only when you are intentionally skipping the scheduled session.',
    keepWorkout: 'Keep Workout',
    marking: 'Marking...',
    confirmMiss: 'Yes, Miss This Day',
  },
  ar: {
    markMissedAria: 'وضع اليوم كمفقود',
    missDay: 'تفويت اليوم',
    openLatestSummaryAria: 'فتح ملخص آخر تمرين',
    loadingWorkout: 'جارٍ تحميل التمرين...',
    workout: 'التمرين',
    todayWorkoutTitle: 'تمرين اليوم',
    pickWorkoutTitle: 'اختر تمرينك لليوم',
    exerciseFallback: 'تمرين',
    generalMuscle: 'عام',
    restDayLabel: 'يوم راحة',
    targetMuscles: 'العضلات المستهدفة',
    targetMusclesEmpty: 'ستظهر العضلات المستهدفة بعد تحميل التمارين.',
    exercisesCount: (count: number) => `${count} تمرين`,
    addExerciseAria: 'إضافة تمرين',
    restDayEmpty: 'يوم راحة. لا يوجد تمرين مجدول اليوم.',
    noExercises: 'لا توجد تمارين مضافة اليوم بعد.',
    setsLabel: 'مجموعات',
    repsLabel: 'تكرارات',
    kgLabel: 'كجم',
    restSeconds: (value: number) => `راحة ${value}ث`,
    restAsNeeded: 'راحة حسب الحاجة',
    lastWeightLabel: 'آخر وزن',
    videoMissing: 'الفيديو غير متوفر',
    addExerciseTitle: 'إضافة تمرين',
    addExerciseSubtitle: 'اختر تمرينًا لإضافته لليوم.',
    closeAddExercise: 'إغلاق نافذة إضافة تمرين',
    loadingExercises: 'جارٍ تحميل التمارين...',
    catalogError: 'تعذر تحميل كتالوج التمارين.',
    exercisesHeading: 'التمارين',
    chooseExerciseHint: 'اختر بطاقة تمرين لإضافتها لليوم.',
    selectMuscleHint: 'اختر مجموعة عضلية أدناه لاستعراض التمارين.',
    previewVideoAria: 'معاينة فيديو التمرين',
    clear: 'مسح',
    searchExercise: 'ابحث عن اسم التمرين...',
    selectMuscleFirst: 'اختر مجموعة عضلية أولًا',
    pickMuscleCard: 'اختر بطاقة عضلة أدناه لعرض التمارين المطابقة.',
    noMatchingExercise: (label: string) => `لا توجد تمارين مطابقة لـ ${label}.`,
    muscleGroups: 'مجموعات العضلات',
    noExerciseGroups: 'لا توجد مجموعات تمارين متاحة.',
    add: 'إضافة',
    addFail: 'تعذر إضافة التمرين.',
    markDoneAria: 'تعليم هذا اليوم كمكتمل',
    markDone: 'اكتمل كليا',
    markDoneFail: 'تعذر تعليم هذا اليوم كمكتمل.',
    markDoneTitle: 'تعليم هذا اليوم كمكتمل؟',
    markDoneDescription: (workoutName: string) =>
      `سيتم حفظ ${workoutName} كيوم مكتمل بالكامل وتعليم جميع تمارين هذا اليوم كمكتملة.`,
    markDoneWeightNote: 'تأكد قبل التأكيد من اختيار الوزن الصحيح الذي استخدمته اليوم.',
    closeMarkDoneDialog: 'إغلاق نافذة الإكمال',
    confirmMarkDone: 'نعم، علّمه كمكتمل',
    markingDone: 'جارٍ الحفظ...',
    missFail: 'تعذر وضع هذا التمرين كمفقود.',
    missTitle: 'تفويت تمرين اليوم؟',
    missDescription: (workoutName: string) =>
      `سيتم اعتبار ${workoutName} مفقودًا وإزالته من مسار اليوم، وسيؤثر ذلك على سلسلة تمارينك لهذا اليوم.`,
    closeMissDialog: 'إغلاق نافذة تفويت اليوم',
    missWarning: 'استخدم هذا الخيار فقط عند تخطي الجلسة عن قصد.',
    keepWorkout: 'الاحتفاظ بالتمرين',
    marking: 'جارٍ التحديث...',
    confirmMiss: 'نعم، تفويت هذا اليوم',
  },
} as const;

const LOCALIZED_WORKOUT_PLAN_I18N: LocalizedLanguageRecord<typeof WORKOUT_PLAN_I18N.en> = {
  en: WORKOUT_PLAN_I18N.en,
  ar: WORKOUT_PLAN_I18N.ar,
  it: {
    markMissedAria: 'Segna oggi come saltato',
    missDay: 'Salta Giorno',
    openLatestSummaryAria: 'Apri l ultimo riepilogo allenamento',
    loadingWorkout: 'Caricamento allenamento...',
    workout: 'Allenamento',
    todayWorkoutTitle: 'Allenamento di oggi',
    pickWorkoutTitle: 'Scegli il workout di oggi',
    exerciseFallback: 'Esercizio',
    generalMuscle: 'Generale',
    restDayLabel: 'Giorno di riposo',
    targetMuscles: 'Muscoli Target',
    targetMusclesEmpty: 'I muscoli target appariranno dopo il caricamento degli esercizi.',
    exercisesCount: (count: number) => `${count} ${count === 1 ? 'esercizio' : 'esercizi'}`,
    addExerciseAria: 'Aggiungi esercizio',
    restDayEmpty: 'Giorno di riposo. Nessun allenamento programmato per oggi.',
    noExercises: 'Nessun esercizio aggiunto per oggi.',
    setsLabel: 'serie',
    repsLabel: 'ripetizioni',
    kgLabel: 'kg',
    restSeconds: (value: number) => `${value}s recupero`,
    restAsNeeded: 'Recupero libero',
    lastWeightLabel: 'Ultimo peso',
    videoMissing: 'Video mancante',
    addExerciseTitle: 'Aggiungi Esercizio',
    addExerciseSubtitle: 'Scegli un esercizio da aggiungere per oggi.',
    closeAddExercise: 'Chiudi finestra aggiungi esercizio',
    loadingExercises: 'Caricamento esercizi...',
    catalogError: 'Impossibile caricare il catalogo esercizi.',
    exercisesHeading: 'Esercizi',
    chooseExerciseHint: 'Scegli una scheda esercizio per aggiungerla a oggi.',
    selectMuscleHint: 'Seleziona un gruppo muscolare qui sotto per esplorare gli esercizi.',
    previewVideoAria: 'Anteprima video esercizio',
    clear: 'Cancella',
    searchExercise: 'Cerca nome esercizio...',
    selectMuscleFirst: 'Seleziona prima un gruppo muscolare',
    pickMuscleCard: 'Scegli una scheda muscolare qui sotto per caricare gli esercizi corrispondenti.',
    noMatchingExercise: (label: string) => `Nessun esercizio trovato per ${label}.`,
    muscleGroups: 'Gruppi Muscolari',
    noExerciseGroups: 'Nessun gruppo esercizi disponibile.',
    add: 'Aggiungi',
    addFail: 'Impossibile aggiungere l esercizio.',
    markDoneAria: 'Segna questo giorno come completato',
    markDone: 'Completato',
    markDoneFail: 'Impossibile segnare questo giorno come completato.',
    markDoneTitle: 'Segnare questo giorno come completato?',
    markDoneDescription: (workoutName: string) =>
      `Questo salvera ${workoutName} come completato e segnera tutti gli esercizi del giorno come svolti.`,
    markDoneWeightNote: 'Prima di confermare, assicurati che i set salvati usino il peso reale che hai usato oggi.',
    closeMarkDoneDialog: 'Chiudi finestra completato',
    confirmMarkDone: 'Si, Segna Come Completato',
    markingDone: 'Salvataggio...',
    missFail: 'Impossibile segnare questo allenamento come saltato.',
    missTitle: 'Saltare l allenamento di oggi?',
    missDescription: (workoutName: string) =>
      `Questo segnera ${workoutName} come saltato, lo rimuovera dal flusso attivo di oggi e interrompera la tua serie di oggi.`,
    closeMissDialog: 'Chiudi finestra giorno saltato',
    missWarning: 'Usa questa opzione solo se stai saltando intenzionalmente la sessione programmata.',
    keepWorkout: 'Mantieni Allenamento',
    marking: 'Aggiornamento...',
    confirmMiss: 'Si, Salta Questo Giorno',
  },
  de: {
    markMissedAria: 'Markiere heute als verpasst',
    missDay: 'Tag Ueberspringen',
    openLatestSummaryAria: 'Letzte Trainingszusammenfassung oeffnen',
    loadingWorkout: 'Training wird geladen...',
    workout: 'Workout',
    todayWorkoutTitle: 'Heutiges Workout',
    pickWorkoutTitle: 'Waehle dein Workout fuer heute',
    exerciseFallback: 'Uebung',
    generalMuscle: 'Allgemein',
    restDayLabel: 'Ruhetag',
    targetMuscles: 'Zielmuskeln',
    targetMusclesEmpty: 'Die Zielmuskeln erscheinen, sobald die Uebungen geladen sind.',
    exercisesCount: (count: number) => `${count} ${count === 1 ? 'Uebung' : 'Uebungen'}`,
    addExerciseAria: 'Uebung hinzufuegen',
    restDayEmpty: 'Ruhetag. Fuer heute ist kein Training geplant.',
    noExercises: 'Fuer heute wurden noch keine Uebungen hinzugefuegt.',
    setsLabel: 'Saetze',
    repsLabel: 'Wdh',
    kgLabel: 'kg',
    restSeconds: (value: number) => `${value}s Pause`,
    restAsNeeded: 'Pause nach Bedarf',
    lastWeightLabel: 'Letztes Gewicht',
    videoMissing: 'Video fehlt',
    addExerciseTitle: 'Uebung Hinzufuegen',
    addExerciseSubtitle: 'Waehle eine Uebung aus, die du heute hinzufuegen moechtest.',
    closeAddExercise: 'Dialog Uebung hinzufuegen schliessen',
    loadingExercises: 'Uebungen werden geladen...',
    catalogError: 'Der Uebungskatalog konnte nicht geladen werden.',
    exercisesHeading: 'Uebungen',
    chooseExerciseHint: 'Waehle eine Uebungskarte aus, um sie zu heute hinzuzufuegen.',
    selectMuscleHint: 'Waehle unten eine Muskelgruppe, um Uebungen zu durchsuchen.',
    previewVideoAria: 'Uebungsvideo vorschau',
    clear: 'Leeren',
    searchExercise: 'Uebungsname suchen...',
    selectMuscleFirst: 'Waehle zuerst eine Muskelgruppe',
    pickMuscleCard: 'Waehle unten eine Muskelkarte aus, um passende Uebungen zu laden.',
    noMatchingExercise: (label: string) => `Keine passende Uebung fuer ${label} gefunden.`,
    muscleGroups: 'Muskelgruppen',
    noExerciseGroups: 'Keine Uebungsgruppen verfuegbar.',
    add: 'Hinzufuegen',
    addFail: 'Die Uebung konnte nicht hinzugefuegt werden.',
    markDoneAria: 'Diesen Tag als vollstaendig erledigt markieren',
    markDone: 'Ganz erledigt',
    markDoneFail: 'Dieser Tag konnte nicht als erledigt markiert werden.',
    markDoneTitle: 'Diesen Tag als vollstaendig erledigt markieren?',
    markDoneDescription: (workoutName: string) =>
      `Dadurch wird ${workoutName} als vollstaendig erledigt gespeichert und jede Uebung dieses Tages als abgeschlossen markiert.`,
    markDoneWeightNote: 'Bevor du bestaetigst, stelle sicher, dass die gespeicherten Saetze das echte Gewicht von heute verwenden.',
    closeMarkDoneDialog: 'Erledigt-Dialog schliessen',
    confirmMarkDone: 'Ja, Vollstaendig Erledigen',
    markingDone: 'Wird gespeichert...',
    missFail: 'Dieses Training konnte nicht als verpasst markiert werden.',
    missTitle: 'Heutiges Training ueberspringen?',
    missDescription: (workoutName: string) =>
      `Dadurch wird ${workoutName} als verpasst markiert, aus dem heutigen aktiven Ablauf entfernt und deine heutige Trainingsserie unterbrochen.`,
    closeMissDialog: 'Dialog verpasster Tag schliessen',
    missWarning: 'Verwende dies nur, wenn du die geplante Einheit absichtlich auslaesst.',
    keepWorkout: 'Workout Behalten',
    marking: 'Wird aktualisiert...',
    confirmMiss: 'Ja, Diesen Tag Ueberspringen',
  },
};

const resolvePrimaryExerciseMuscle = (exercise: WorkoutExerciseCard) => {
  const inferredMuscles = inferMusclesFromExerciseName(exercise.name);
  const normalizedTargets = exercise.targetMuscles.map((entry) => canonicalizeMuscleLabel(entry)).filter(Boolean);

  for (const inferred of inferredMuscles) {
    const match = normalizedTargets.find((target) => target.toLowerCase() === inferred.toLowerCase());
    if (match) return match;
  }

  if (normalizedTargets.length > 0) return normalizedTargets[0];
  if (inferredMuscles.length > 0) return inferredMuscles[0];
  return 'Chest';
};


export function WorkoutPlanScreen({
  onBack,
  onExerciseClick,
  onAddExercise,
  onPreviewExercise,
  onMissDay,
  onMarkDayFullyDone,
  onOpenLatestSummary,
  hasLatestSummary = false,
  workoutDay,
  workoutDayLabel,
  completedExercises,
  todayExercises,
  loading,
  allowEditing = true,
  isDayFullyDone = false,
  isHyroxMode = false,
}: WorkoutPlanScreenProps) {
  useScreenshotProtection();
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatalogMuscle, setSelectedCatalogMuscle] = useState('');
  const addModalScrollRef = useRef<HTMLDivElement | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMissModalOpen, setIsMissModalOpen] = useState(false);
  const [isMarkDoneModalOpen, setIsMarkDoneModalOpen] = useState(false);
  const [addExerciseFeedback, setAddExerciseFeedback] = useState<string | null>(null);
  const [missDayFeedback, setMissDayFeedback] = useState<string | null>(null);
  const [markDoneFeedback, setMarkDoneFeedback] = useState<string | null>(null);
  const [isSubmittingExercise, setIsSubmittingExercise] = useState(false);
  const [isSubmittingMissDay, setIsSubmittingMissDay] = useState(false);
  const [isSubmittingMarkDone, setIsSubmittingMarkDone] = useState(false);
  const [lastWeights, setLastWeights] = useState<Record<string, number>>({});
  const [styleGender, setStyleGender] = useState(() => readStoredStyleGender());
  const copy = LOCALIZED_WORKOUT_PLAN_I18N[language] || LOCALIZED_WORKOUT_PLAN_I18N.en;
  const isArabic = language === 'ar';
  const isGirlsTheme = useMemo(
    () => (styleGender ? isGirlsStyleValue(styleGender) : shouldUseGirlsTheme()),
    [styleGender],
  );
  const preferredMediaAudience = isGirlsTheme ? 'female' : 'male';

  const toLocalizedMuscleLabel = useCallback(
    (value: string) => {
      const key = value.trim().toLowerCase();
      if (language === 'ar') return AR_MUSCLE_LABELS[key] || value;
      if (language === 'it') return IT_MUSCLE_LABELS[key] || value;
      if (language === 'de') return DE_MUSCLE_LABELS[key] || value;
      return value;
    },
    [language],
  );

  const toLocalizedDayLabel = useCallback(
    (value: string) => {
      const normalized = String(value || '').trim();
      if (!normalized) return copy.workout;
      if (normalized.toLowerCase().includes('rest day') || normalized.toLowerCase().includes('recovery day')) {
        return copy.restDayLabel;
      }
      const key = normalizeWorkoutDayKey(normalized);
      if (key) {
        return formatWorkoutDayLabel(key, normalized, language);
      }
      return translateProgramText(normalized, language);
    },
    [copy.restDayLabel, copy.workout, language],
  );

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
    const handleThemeChanged = () => {
      setStyleGender(readStoredStyleGender());
    };

    window.addEventListener('repset:app-style-gender-changed', handleThemeChanged);
    window.addEventListener('repset:stored-user-changed', handleThemeChanged);
    window.addEventListener('storage', handleThemeChanged);
    return () => {
      window.removeEventListener('repset:app-style-gender-changed', handleThemeChanged);
      window.removeEventListener('repset:stored-user-changed', handleThemeChanged);
      window.removeEventListener('storage', handleThemeChanged);
    };
  }, []);

  useEffect(() => {
    if (!isAddModalOpen || catalogLoaded || catalogLoading) return;

    const loadCatalog = async () => {
      try {
        setCatalogLoading(true);
        setCatalogError(null);
        const result = await api.getExerciseCatalog('All', '', 600);
        const nextCatalog = Array.isArray(result?.exercises)
          ? result.exercises
            .map((exercise: any) => ({
              id: Number(exercise?.id || 0),
              name: String(exercise?.name || '').trim(),
              muscle: String(exercise?.muscle || exercise?.bodyPart || '').trim(),
              bodyPart: exercise?.bodyPart ? String(exercise.bodyPart) : null,
              primaryMedia: exercise?.primaryMedia || null,
              media: Array.isArray(exercise?.media) ? exercise.media : [],
            }))
            .filter((exercise: CatalogExercise) => exercise.id > 0 && exercise.name.length > 0)
          : [];
        setCatalog(nextCatalog);
        setCatalogLoaded(true);
    } catch (error) {
      console.error('Failed to load exercise catalog:', error);
      setCatalogError(copy.catalogError);
    } finally {
      setCatalogLoading(false);
    }
  };

    void loadCatalog();
  }, [copy.catalogError, isAddModalOpen, catalogLoaded, catalogLoading]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const userId = Number(user?.id || 0);
    if (!userId) {
      setLastWeights({});
      return;
    }

    const exerciseNames = Array.from(
      new Set(
        todayExercises
          .map((ex) => String(ex?.exerciseName || ex?.name || '').trim())
          .filter(Boolean),
      ),
    );

    if (exerciseNames.length === 0) {
      setLastWeights({});
      return;
    }

    let cancelled = false;

    const loadLastWeights = async () => {
      const next: Record<string, number> = {};
      await Promise.all(
        exerciseNames.map(async (exerciseName) => {
          try {
            const rows = await api.getWorkoutHistory(userId, exerciseName);
            const lastWeight = getLatestHistoryWeight(rows);
            if (lastWeight && lastWeight > 0) {
              next[normalizeExerciseKey(exerciseName)] = lastWeight;
            }
          } catch {
            // Ignore failures per exercise.
          }
        }),
      );

      if (!cancelled) {
        setLastWeights(next);
      }
    };

    void loadLastWeights();

    return () => {
      cancelled = true;
    };
  }, [todayExercises]);

  const exercises: WorkoutExerciseCard[] = todayExercises.map((ex) => {
    const targetMuscles = Array.isArray(ex?.targetMuscles) && ex.targetMuscles.length
      ? ex.targetMuscles.map((entry: unknown) => canonicalizeMuscleLabel(entry)).filter(Boolean)
      : ex?.muscleGroup
        ? [canonicalizeMuscleLabel(ex.muscleGroup)]
        : inferMusclesFromExerciseName(String(ex.exerciseName || ex.name || ''));

    return {
      name: String(ex.exerciseName || ex.name || copy.exerciseFallback).trim(),
      sets: Number(ex.sets || 0),
      reps: String(ex.reps || ''),
      rest: ex.rest,
      targetWeight: Number(ex.targetWeight || 0) || null,
        notes: String(ex.notes || ''),
        targetMuscles,
        primaryMedia: ex.primaryMedia || null,
        media: Array.isArray(ex.media) ? ex.media : [],
      };
  });

  const completedLookup = new Set(completedExercises.map((name) => String(name || '').trim().toLowerCase()));
  const nextExercise = exercises.find((exercise) => !completedLookup.has(String(exercise.name || '').trim().toLowerCase()))
    || exercises[0];

  const formatRestLabel = (rest: unknown) => {
    const numeric = Number(rest || 0);
    if (Number.isFinite(numeric) && numeric > 0) return copy.restSeconds(numeric);
    return copy.restAsNeeded;
  };

  const exerciseVisuals = useMemo(() => (
    exercises.map((exercise) => {
      const primaryMuscle = resolvePrimaryExerciseMuscle(exercise);
      const videoMatch = resolveExerciseVideo({
        name: exercise.name,
        muscle: primaryMuscle,
        bodyPart: exercise.targetMuscles.join(' '),
        targetMuscles: exercise.targetMuscles,
        primaryMedia: exercise.primaryMedia,
        media: exercise.media,
        preferredAudience: preferredMediaAudience,
      });
      return { primaryMuscle, videoMatch };
    })
  ), [exercises, preferredMediaAudience]);

  const isHyroxWorkout = useMemo(() => {
    const haystack = [
      workoutDay,
      workoutDayLabel,
      ...exercises.flatMap((exercise) => [
        exercise.name,
        exercise.notes,
        ...exercise.targetMuscles,
      ]),
    ].join(' ').toLowerCase();

    const hasHyroxLabel = /\bhyrox\b/.test(haystack);
    const hasHyroxStation = /skierg|sled push|sled pull|wall balls?|burpee broad|farmer carry/.test(haystack);
    const hasRaceContext = /race primer|race-pace|simulation|compromised running|\brun\b|\brunning\b|\bstation\b|\bengine\b/.test(haystack);

    return isHyroxMode || hasHyroxLabel || (hasHyroxStation && hasRaceContext);
  }, [exercises, isHyroxMode, workoutDay, workoutDayLabel]);

  const displayTargetMuscles = useMemo(() => {
    const plannedLoadByMuscle = new Map<string, number>();

    exercises.forEach((exercise) => {
      const muscles = exercise.targetMuscles
        .map((entry) => canonicalizeMuscleLabel(entry))
        .map((entry) => toMuscleDisplayGroup(entry))
        .filter(Boolean);
      if (!muscles.length) return;

      const groupedMuscles = [...new Set(muscles)];
      const setCount = Math.max(1, Number.isFinite(exercise.sets) ? exercise.sets : Number(exercise.sets || 0) || 1);
      const contribution = setCount / groupedMuscles.length;

      groupedMuscles.forEach((muscle) => {
        plannedLoadByMuscle.set(muscle, (plannedLoadByMuscle.get(muscle) || 0) + contribution);
      });
    });

    const totalLoad = Array.from(plannedLoadByMuscle.values()).reduce((sum, value) => sum + value, 0);
    if (totalLoad <= 0) return [];

    const priority = resolveWorkoutMusclePriority(`${workoutDayLabel || ''} ${workoutDay || ''}`);
    const byName = new Map(Array.from(plannedLoadByMuscle.entries()));
    if (priority.length) {
      return priority.map((name, index) => ({
        name,
        sourceName: name,
        score: Math.max(1, Math.round(((byName.get(name) || (index === 0 ? totalLoad : totalLoad * 0.5)) / totalLoad) * 100)),
      }));
    }

    return Array.from(plannedLoadByMuscle.entries())
      .map(([name, load]) => ({
        name,
        sourceName: name,
        score: Math.max(1, Math.round((load / totalLoad) * 100)),
        load,
      }))
      .sort((left, right) => right.load - left.load || left.name.localeCompare(right.name))
      .slice(0, 3)
      .map(({ name, sourceName, score }) => ({ name, sourceName, score }));
  }, [exercises, workoutDay, workoutDayLabel]);

  const catalogMuscles = useMemo(() => {
    const counts = new Map<string, number>();

    catalog.forEach((exercise) => {
      const label = toTitleCase(exercise.muscle || exercise.bodyPart || copy.generalMuscle);
      counts.set(label, (counts.get(label) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [catalog, copy.generalMuscle]);

  const filteredCatalog = useMemo(() => {
    if (!selectedCatalogMuscle) return [];

    const query = searchQuery.trim().toLowerCase();
    return catalog
      .filter((exercise) => toTitleCase(exercise.muscle || exercise.bodyPart || copy.generalMuscle) === selectedCatalogMuscle)
      .filter((exercise) => {
        if (!query) return true;
        const haystack = `${stripExercisePrefix(exercise.name)} ${exercise.muscle} ${exercise.bodyPart || ''}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 40);
  }, [catalog, copy.generalMuscle, searchQuery, selectedCatalogMuscle]);

  const isRestDayView = useMemo(() => {
    const label = `${String(workoutDayLabel || '').trim().toLowerCase()} ${String(workoutDay || '').trim().toLowerCase()}`;
    return label.includes('rest') || label.includes('recovery') || label.includes('راحة') || label.includes('استشفاء');
  }, [workoutDay, workoutDayLabel]);

  const headerTitle = isRestDayView
    ? copy.restDayLabel
    : allowEditing
      ? copy.todayWorkoutTitle
      : copy.pickWorkoutTitle;
  const displayWorkoutName = toLocalizedDayLabel(String(workoutDay || copy.workout).trim() || copy.workout);
  const headerActions = (
    <div className="flex items-center gap-2">
      {!isRestDayView && allowEditing && onMarkDayFullyDone && !isDayFullyDone && (
        <button
          type="button"
          onClick={() => {
            setMarkDoneFeedback(null);
            setIsMarkDoneModalOpen(true);
          }}
          className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${isGirlsTheme ? 'border-emerald-300/45 bg-white/70 text-emerald-700 hover:border-emerald-300/70 hover:bg-emerald-50' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400/30 hover:bg-emerald-500/15'}`}
          aria-label={copy.markDoneAria}
        >
          <Check size={15} />
          <span className="hidden sm:inline">{copy.markDone}</span>
        </button>
      )}

      {!isRestDayView && onMissDay && (
        <button
          data-coachmark-target="workout_plan_miss_button"
          type="button"
          onClick={() => {
            setMissDayFeedback(null);
            setIsMissModalOpen(true);
          }}
          className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${isGirlsTheme ? 'border-[#E2B4BD]/55 bg-white/70 text-[#A87884] hover:border-[#F9B2D7]/70 hover:bg-[#FFF5F5]' : 'border-rose-500/20 bg-rose-500/10 text-rose-200 hover:border-rose-400/30 hover:bg-rose-500/15'}`}
          aria-label={copy.markMissedAria}
        >
          <CalendarX2 size={15} />
          <span className="hidden sm:inline">{copy.missDay}</span>
        </button>
      )}

    </div>
  );

  useEffect(() => {
    if (!isAddModalOpen) return;
    if (!selectedCatalogMuscle) return;
    if (!addModalScrollRef.current) return;
    addModalScrollRef.current.scrollTop = 0;
  }, [isAddModalOpen, selectedCatalogMuscle]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col h-full bg-background pb-24">
        <div className="px-4 sm:px-6 pt-2">
          <Header
            title={headerTitle}
            onBack={onBack}
            rightElement={headerActions}
          />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-text-secondary">{copy.loadingWorkout}</div>
        </div>
      </div>
    );
  }

  const openAddExerciseModal = () => {
    if (isRestDayView) return;
    setAddExerciseFeedback(null);
    setSearchQuery('');
    setSelectedCatalogMuscle('');
    setIsAddModalOpen(true);
  };

  const handleAddExercise = async (exercise: CatalogExercise) => {
    try {
      setIsSubmittingExercise(true);
      const result = await onAddExercise(exercise);
      if (!result?.added) {
        setAddExerciseFeedback(result?.reason || copy.addFail);
        return;
      }

      setAddExerciseFeedback(null);
      setSearchQuery('');
      setIsAddModalOpen(false);
    } finally {
      setIsSubmittingExercise(false);
    }
  };

  const handleMissDay = async () => {
    if (!onMissDay) return;

    try {
      setIsSubmittingMissDay(true);
      setMissDayFeedback(null);
      const result = await onMissDay();
      if (!result?.missed) {
        setMissDayFeedback(result?.reason || copy.missFail);
        return;
      }
      setIsMissModalOpen(false);
    } finally {
      setIsSubmittingMissDay(false);
    }
  };

  const handleMarkDayFullyDone = async () => {
    if (!onMarkDayFullyDone) return;

    try {
      setIsSubmittingMarkDone(true);
      setMarkDoneFeedback(null);
      const result = await onMarkDayFullyDone();
      if (!result?.completed) {
        setMarkDoneFeedback(result?.reason || copy.markDoneFail);
        return;
      }
      setIsMarkDoneModalOpen(false);
    } finally {
      setIsSubmittingMarkDone(false);
    }
  };

  const pageClassName = isGirlsTheme
    ? 'flex-1 flex flex-col h-full overflow-y-auto pb-24 bg-[radial-gradient(circle_at_top_left,rgba(249,178,215,0.22),transparent_34%),radial-gradient(circle_at_85%_8%,rgba(207,236,243,0.34),transparent_32%),linear-gradient(180deg,#FFF5F5_0%,#F7D6D0_52%,#FFF5F5_100%)] text-[#4A4A4A] [&_h1]:text-[#4A4A4A]'
    : 'flex-1 flex flex-col h-full bg-background overflow-y-auto pb-24';
  const labelClassName = isGirlsTheme
    ? 'text-xs font-bold uppercase tracking-wider text-[#795E67]'
    : 'text-xs font-bold uppercase tracking-wider text-text-secondary';
  const emptyCardClassName = isGirlsTheme
    ? 'rounded-2xl border border-[#E2B4BD]/45 bg-white/70 px-4 py-4 text-sm text-[#795E67] shadow-[0_12px_28px_rgba(226,180,189,0.12)]'
    : 'rounded-2xl border border-white/[0.08] bg-card/60 px-4 py-4 text-sm text-text-secondary';
  const exerciseEmptyClassName = isGirlsTheme
    ? 'rounded-2xl border border-[#E2B4BD]/45 bg-white/70 px-4 py-5 text-sm text-[#795E67] shadow-[0_12px_28px_rgba(226,180,189,0.12)]'
    : 'rounded-2xl border border-white/10 bg-card/70 px-4 py-5 text-sm text-text-secondary';

  return (
    <div className={pageClassName}>
      <div className="px-4 sm:px-6 pt-2">
        <Header
          title={headerTitle}
          onBack={onBack}
          backButtonCoachmarkTargetId="workout_plan_back_button"
          titleCoachmarkTargetId="workout_plan_day_title"
          rightElement={headerActions}
        />
      </div>

      <div className="mt-2 space-y-4 px-4 sm:px-6">
        {!isRestDayView && (
          <div
            className="space-y-3"
            data-no-translate="true"
            data-coachmark-target="workout_plan_target_muscles"
          >
            <div className={labelClassName}>
              {copy.targetMuscles}
            </div>
            {displayTargetMuscles.length > 0 ? (
              <TargetMuscleCards muscles={displayTargetMuscles} themeVariant={isGirlsTheme ? 'girls' : 'default'} />
            ) : (
              <div className={emptyCardClassName}>
                {copy.targetMusclesEmpty}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <h3 className={`text-xl font-semibold ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'}`}>
            {copy.exercisesCount(exercises.length)}
          </h3>
        </div>

        <div className={isHyroxWorkout && exercises.length > 0 ? 'relative py-3' : 'space-y-3'}>
          {exercises.length === 0 && (
            <div className={exerciseEmptyClassName}>
              {isRestDayView
                ? copy.restDayEmpty
                : copy.noExercises}
            </div>
          )}

          {isHyroxWorkout && exercises.length > 0 ? (
            <>
              <div className="pointer-events-none absolute inset-y-4 left-1/2 w-16 -translate-x-1/2" aria-hidden="true">
                <svg className="h-full w-full" viewBox="0 0 64 520" preserveAspectRatio="none">
                  <path
                    d="M23 4 C7 70 43 116 25 184 C8 250 48 306 28 378 C16 424 18 470 10 516"
                    fill="none"
                    stroke={isGirlsTheme ? 'rgba(168,120,132,0.34)' : 'rgba(255,255,255,0.22)'}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M39 4 C23 70 59 116 41 184 C24 250 64 306 44 378 C32 424 34 470 26 516"
                    fill="none"
                    stroke={isGirlsTheme ? 'rgba(249,178,215,0.52)' : 'rgba(187,255,92,0.30)'}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="relative space-y-4">
                {exercises.map((exercise, index) => {
                  const isCompleted = completedLookup.has(String(exercise.name || '').trim().toLowerCase());
                  const isNext = nextExercise?.name === exercise.name && !isCompleted;
                  const visual = exerciseVisuals[index];
                  const primaryMuscle = visual?.primaryMuscle || resolvePrimaryExerciseMuscle(exercise);
                  const videoUrl = visual?.videoMatch?.url || null;
                  const lastWeight = lastWeights[normalizeExerciseKey(exercise.name)];
                  const isLeft = index % 2 === 0;

                  const card = (
                    <button
                      key={exercise.name || index}
                      data-coachmark-target={isNext || (!nextExercise && index === 0) ? 'workout_plan_first_exercise_card' : undefined}
                      type="button"
                      onClick={() => onExerciseClick(exercise.name)}
                      className={`group relative aspect-square w-full overflow-hidden rounded-[1.35rem] border p-2 text-left transition-all active:scale-[0.985] ${
                        isGirlsTheme
                          ? isCompleted
                            ? 'border-emerald-300/50 bg-emerald-50/80 shadow-[0_14px_30px_rgba(16,185,129,0.12)]'
                            : isNext
                              ? 'border-[#F9B2D7]/80 bg-white/86 shadow-[0_18px_38px_rgba(249,178,215,0.22)]'
                              : 'border-[#E2B4BD]/50 bg-white/76 shadow-[0_14px_30px_rgba(226,180,189,0.16)] hover:border-[#F9B2D7]/75'
                          : isCompleted
                            ? 'border-green-500/35 bg-green-500/10'
                            : isNext
                              ? 'border-accent/50 bg-accent/10 shadow-[0_16px_36px_rgba(187,255,92,0.12)]'
                              : 'border-white/[0.10] bg-card/80 hover:border-accent/25'
                      }`}
                    >
                      <div className={`relative h-[54%] overflow-hidden rounded-2xl border ${isGirlsTheme ? 'border-[#E2B4BD]/40 bg-white/65' : 'border-white/10 bg-white/5'}`}>
                        {videoUrl ? (
                          <>
                            <ExerciseMedia
                              src={videoUrl}
                              mediaType={visual?.videoMatch?.mediaType}
                              alt={stripExercisePrefix(exercise.name)}
                              poster={getMuscleImage(primaryMuscle)}
                              className="block h-full w-full bg-black object-cover"
                              videoProps={{ autoPlay: true }}
                            />
                            <div className={`pointer-events-none absolute inset-0 flex items-center justify-center ${isGirlsTheme ? 'bg-[#4A4A4A]/12' : 'bg-black/28'}`}>
                              <div className={`flex h-7 w-7 items-center justify-center rounded-full ${isGirlsTheme ? 'bg-white/80 text-[#A87884]' : 'bg-black/55 text-white'}`}>
                                <Play size={11} fill="currentColor" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <MuscleSvgBadge
                              muscle={{ label: toLocalizedMuscleLabel(primaryMuscle), sourceName: canonicalizeMuscleLabel(primaryMuscle) }}
                              className="h-full w-full"
                              figureClassName="h-full"
                              showLabel={false}
                              variant="bare"
                              themeVariant={isGirlsTheme ? 'girls' : 'default'}
                            />
                            <div className={`pointer-events-none absolute inset-x-0 bottom-0 px-1.5 py-1 text-center text-[8px] font-semibold uppercase tracking-[0.1em] ${isGirlsTheme ? 'bg-white/84 text-[#A87884]' : 'bg-black/70 text-amber-200'}`}>
                              {copy.videoMissing}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="min-w-0 px-1 pt-2">
                        <h4 className={`line-clamp-2 text-[12px] font-bold leading-4 ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'}`}>
                          {stripExercisePrefix(exercise.name)}
                        </h4>
                        <p className={`mt-1 truncate text-[10px] ${isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary'}`}>
                          {exercise.sets} {copy.setsLabel} - {exercise.reps || '--'} {copy.repsLabel}
                        </p>
                        <p className={`mt-0.5 truncate text-[10px] ${isGirlsTheme ? 'text-[#A87884]' : 'text-text-tertiary'}`}>
                          {exercise.targetWeight ? `${exercise.targetWeight} ${copy.kgLabel}` : formatRestLabel(exercise.rest)}
                          {lastWeight ? ` - ${copy.lastWeightLabel} ${lastWeight} ${copy.kgLabel}` : ''}
                        </p>
                        {!!exercise.targetMuscles.length && (
                          <p className={`mt-1 truncate text-[9px] ${isGirlsTheme ? 'text-[#A87884]' : 'text-text-tertiary'}`}>
                            {exercise.targetMuscles.map((entry) => toLocalizedMuscleLabel(entry)).join(' - ')}
                          </p>
                        )}
                      </div>
                    </button>
                  );

                  return (
                    <div
                      key={exercise.name || index}
                      className="grid grid-cols-[minmax(0,1fr)_3.6rem_minmax(0,1fr)] items-center gap-2"
                    >
                      <div className={isLeft ? 'col-start-1' : 'col-start-3'}>{card}</div>
                      <div className="col-start-2 row-start-1 flex justify-center">
                        {(() => {
                          const isStartMarker = index === 0;
                          const isFinishMarker = index === exercises.length - 1;
                          const markerLabel = isStartMarker
                            ? 'Start'
                            : isFinishMarker
                              ? 'Finish'
                              : String(index + 1);

                          return (
                        <span
                          aria-label={markerLabel}
                          title={markerLabel}
                          className={`flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-black shadow-lg ${
                            isGirlsTheme
                              ? 'border-[#E2B4BD]/55 bg-white/88 text-[#A87884]'
                              : 'border-accent/35 bg-[#101824] text-accent'
                          }`}
                        >
                          {isStartMarker ? (
                            <Flag size={14} strokeWidth={2.4} aria-hidden="true" />
                          ) : isFinishMarker ? (
                            <FlagTriangleRight size={15} strokeWidth={2.4} aria-hidden="true" />
                          ) : (
                            index + 1
                          )}
                        </span>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : exercises.map((exercise, index) => {
            const isCompleted = completedLookup.has(String(exercise.name || '').trim().toLowerCase());
            const isNext = nextExercise?.name === exercise.name && !isCompleted;
            const visual = exerciseVisuals[index];
            const primaryMuscle = visual?.primaryMuscle || resolvePrimaryExerciseMuscle(exercise);
            const videoUrl = visual?.videoMatch?.url || null;
            const lastWeight = lastWeights[normalizeExerciseKey(exercise.name)];

            return (
              <button
                key={exercise.name || index}
                data-coachmark-target={isNext || (!nextExercise && index === 0) ? 'workout_plan_first_exercise_card' : undefined}
                type="button"
                onClick={() => onExerciseClick(exercise.name)}
                className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                  isGirlsTheme
                    ? isCompleted
                      ? 'border-emerald-300/45 bg-emerald-50/70'
                      : isNext
                        ? 'border-[#F9B2D7]/70 bg-white/80 shadow-[0_12px_28px_rgba(249,178,215,0.14)]'
                        : 'border-[#E2B4BD]/45 bg-white/70 hover:border-[#F9B2D7]/70 hover:bg-white/85'
                    : isCompleted
                      ? 'border-green-500/35 bg-green-500/5'
                      : isNext
                        ? 'border-accent/40 bg-accent/5'
                        : 'border-white/[0.08] bg-card/70 hover:border-accent/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border ${isGirlsTheme ? 'border-[#E2B4BD]/40 bg-white/65' : 'border-white/10 bg-white/5'}`}>
                    {videoUrl ? (
                      <>
                        <ExerciseMedia
                          src={videoUrl}
                          mediaType={visual?.videoMatch?.mediaType}
                          alt={stripExercisePrefix(exercise.name)}
                          poster={getMuscleImage(primaryMuscle)}
                          className="block h-full w-full bg-black object-cover"
                          videoProps={{ autoPlay: true }}
                        />
                        <div className={`pointer-events-none absolute inset-0 flex items-center justify-center ${isGirlsTheme ? 'bg-[#4A4A4A]/16' : 'bg-black/30'}`}>
                          <div className={`flex h-7 w-7 items-center justify-center rounded-full ${isGirlsTheme ? 'bg-white/75 text-[#A87884]' : 'bg-black/55 text-white'}`}>
                            <Play size={11} fill="currentColor" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <MuscleSvgBadge
                          muscle={{ label: toLocalizedMuscleLabel(primaryMuscle), sourceName: canonicalizeMuscleLabel(primaryMuscle) }}
                          className="h-full w-full"
                          figureClassName="h-full"
                          showLabel={false}
                          variant="bare"
                          themeVariant={isGirlsTheme ? 'girls' : 'default'}
                        />
                        <div className={`pointer-events-none absolute inset-x-0 bottom-0 px-2 py-1 text-center text-[9px] font-semibold uppercase tracking-[0.12em] ${isGirlsTheme ? 'bg-white/82 text-[#A87884]' : 'bg-black/70 text-amber-200'}`}>
                          {copy.videoMissing}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="min-w-0">
                      <h4 className={`truncate text-sm font-semibold ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'}`}>
                        {stripExercisePrefix(exercise.name)}
                      </h4>
                      <p className={`mt-1 text-xs ${isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary'}`}>
                        {exercise.sets} {copy.setsLabel} - {exercise.reps || '--'} {copy.repsLabel} - {exercise.targetWeight ? `${exercise.targetWeight} ${copy.kgLabel}` : formatRestLabel(exercise.rest)}
                        {lastWeight ? ` - ${copy.lastWeightLabel} ${lastWeight} ${copy.kgLabel}` : ''}
                      </p>
                      {!!exercise.targetMuscles.length && (
                        <p className={`mt-2 truncate text-[11px] ${isGirlsTheme ? 'text-[#A87884]' : 'text-text-tertiary'}`}>
                          {exercise.targetMuscles.map((entry) => toLocalizedMuscleLabel(entry)).join(' - ')}
                        </p>
                      )}
                      {!!exercise.notes && (
                        <p className={`mt-2 line-clamp-2 text-[11px] ${isGirlsTheme ? 'text-[#A87884]' : 'text-text-tertiary'}`}>
                          {exercise.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

      </div>

      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className={`w-full max-w-3xl rounded-3xl border p-4 shadow-2xl ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-[#FFF5F5] text-[#4A4A4A]' : 'border-white/10 bg-card'} ${isArabic ? 'text-right' : 'text-left'}`}
            dir={isArabic ? 'rtl' : 'ltr'}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`flex items-center justify-between ${isArabic ? 'flex-row-reverse' : ''}`}>
              <div>
                <h3 className={`text-lg font-semibold ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'}`}>{copy.addExerciseTitle}</h3>
                <p className={`mt-1 text-sm ${isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary'}`}>{copy.addExerciseSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${isGirlsTheme ? 'border border-[#E2B4BD]/45 bg-white/70 text-[#795E67] hover:bg-white' : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white'}`}
                aria-label={copy.closeAddExercise}
              >
                <X size={18} />
              </button>
            </div>

            {addExerciseFeedback && (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                {addExerciseFeedback}
              </div>
            )}

            <div ref={addModalScrollRef} className="mt-4 max-h-[70vh] space-y-5 overflow-y-auto pr-1">
              {catalogLoading && (
                  <div className={`rounded-2xl border px-4 py-3 text-sm ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 text-[#795E67]' : 'border-white/[0.08] bg-background/60 text-text-secondary'}`}>
                  {copy.loadingExercises}
                </div>
              )}

              {!catalogLoading && catalogError && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {catalogError}
                </div>
              )}

              {!catalogLoading && !catalogError && (
                <>
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className={labelClassName}>
                          {selectedCatalogMuscle ? toLocalizedMuscleLabel(selectedCatalogMuscle) : copy.exercisesHeading}
                        </div>
                        <div className={`mt-1 text-sm ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'}`}>
                          {selectedCatalogMuscle
                            ? copy.chooseExerciseHint
                            : copy.selectMuscleHint}
                        </div>
                      </div>
                      {selectedCatalogMuscle && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCatalogMuscle('');
                            setSearchQuery('');
                          }}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 text-[#795E67] hover:border-[#F9B2D7]/70' : 'border-white/10 text-text-secondary hover:border-accent/30 hover:text-white'}`}
                        >
                          {copy.clear}
                        </button>
                      )}
                    </div>

                    <div className="relative mt-4">
                      <Search size={16} className={`absolute top-1/2 -translate-y-1/2 ${isGirlsTheme ? 'text-[#A87884]' : 'text-text-secondary'} ${isArabic ? 'right-3' : 'left-3'}`} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={selectedCatalogMuscle ? copy.searchExercise : copy.selectMuscleFirst}
                        disabled={!selectedCatalogMuscle}
                        className={`w-full rounded-2xl border py-3 text-sm outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 text-[#4A4A4A] placeholder:text-[#A87884] focus:border-[#F9B2D7]/70' : 'border-white/10 bg-background text-white focus:border-accent/50'} ${isArabic ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'}`}
                      />
                    </div>

                    {!selectedCatalogMuscle && (
                      <div className={`mt-4 rounded-2xl border px-4 py-5 text-sm ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 text-[#795E67]' : 'border-white/[0.08] bg-background/60 text-text-secondary'}`}>
                        {copy.pickMuscleCard}
                      </div>
                    )}

                    {selectedCatalogMuscle && filteredCatalog.length === 0 && (
                      <div className={`mt-4 rounded-2xl border px-4 py-5 text-sm ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 text-[#795E67]' : 'border-white/[0.08] bg-background/60 text-text-secondary'}`}>
                        {copy.noMatchingExercise(toLocalizedMuscleLabel(selectedCatalogMuscle))}
                      </div>
                    )}

                    {selectedCatalogMuscle && filteredCatalog.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {filteredCatalog.map((exercise) => {
                          const muscleLabel = toTitleCase(exercise.muscle || exercise.bodyPart || selectedCatalogMuscle || 'General');
                          const videoMatch = resolveExerciseVideo({
                            name: exercise.name,
                            muscle: muscleLabel,
                            bodyPart: exercise.bodyPart || selectedCatalogMuscle || muscleLabel,
                            targetMuscles: [muscleLabel],
                            primaryMedia: exercise.primaryMedia,
                            media: exercise.media,
                            preferredAudience: preferredMediaAudience,
                          });
                          const previewUrl = videoMatch.url || null;
                          return (
                            <button
                              key={exercise.id}
                              type="button"
                              onClick={() => {
                                if (onPreviewExercise) {
                                  onPreviewExercise(exercise.name);
                                  return;
                                }
                                void handleAddExercise(exercise);
                              }}
                              disabled={isSubmittingExercise}
                              className={`rounded-2xl border p-3 transition-colors group ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 shadow-[0_10px_24px_rgba(226,180,189,0.12)] hover:border-[#F9B2D7]/70' : 'surface-card hover:border-accent/20'} ${isArabic ? 'text-right' : 'text-left'}`}
                            >
                              <div className={`relative -mx-3 -mt-3 mb-3 aspect-video overflow-hidden rounded-t-2xl border-b ${isGirlsTheme ? 'border-[#E2B4BD]/35 bg-white/65' : 'border-white/[0.08] bg-white/5'}`}>
                                {previewUrl ? (
                                  <ExerciseMedia
                                    src={previewUrl}
                                    mediaType={videoMatch.mediaType}
                                    alt={exercise.name}
                                    poster={getMuscleImage(muscleLabel)}
                                    className="h-full w-full bg-black object-cover transition-transform duration-200 group-hover:scale-105"
                                    videoProps={{ autoPlay: true }}
                                  />
                                ) : (
                                  <img
                                    src={getMuscleImage(muscleLabel)}
                                    alt={exercise.name}
                                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                  />
                                )}
                              <div className={`absolute inset-0 flex items-center justify-center ${isGirlsTheme ? 'bg-[#4A4A4A]/16' : 'bg-black/35'}`}>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onPreviewExercise?.(exercise.name);
                                  }}
                                  disabled={!onPreviewExercise}
                                  aria-label={copy.previewVideoAria}
                                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isGirlsTheme ? 'bg-white/78 text-[#A87884] group-hover:bg-[#F9B2D7] group-hover:text-[#4A4A4A]' : 'bg-black/50 text-white group-hover:bg-accent group-hover:text-black'}`}
                                >
                                  <Play size={12} fill="currentColor" />
                                </button>
                              </div>
                                <div className={`absolute top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${isGirlsTheme ? 'bg-white/78 text-[#795E67]' : 'bg-black/60 text-white'} ${isArabic ? 'right-2' : 'left-2'}`}>
                                  {copy.add}
                                </div>
                              </div>
                              <div className={`truncate text-sm font-bold ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'}`}>
                                {stripExercisePrefix(exercise.name)}
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <div className={`truncate text-[10px] uppercase tracking-wider ${isGirlsTheme ? 'text-[#A87884]' : 'text-text-secondary'}`}>
                                  {toLocalizedMuscleLabel(muscleLabel)}
                                </div>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleAddExercise(exercise);
                                  }}
                                  className={`rounded-full px-2 py-1 text-[10px] font-semibold ${isGirlsTheme ? 'bg-[#F9B2D7]/30 text-[#795E67]' : 'bg-accent/15 text-accent'}`}
                                >
                                  {copy.add}
                                </button>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className={`mb-3 ${labelClassName}`}>
                      {copy.muscleGroups}
                    </div>
                    {catalogMuscles.length === 0 ? (
                      <div className={`rounded-2xl border px-4 py-3 text-sm ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 text-[#795E67]' : 'border-white/[0.08] bg-background/60 text-text-secondary'}`}>
                        {copy.noExerciseGroups}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {catalogMuscles.map((muscle) => {
                          const isSelected = selectedCatalogMuscle === muscle.name;
                          const categoryVideo = resolveExerciseCategoryVideo(muscle.name);
                          return (
                            <button
                              key={muscle.name}
                              type="button"
                              onClick={() => {
                                setSelectedCatalogMuscle((current) => (current === muscle.name ? '' : muscle.name));
                                setSearchQuery('');
                              }}
                              className={`rounded-2xl border p-3 transition-colors ${isArabic ? 'text-right' : 'text-left'} ${
                                isGirlsTheme
                                  ? isSelected
                                    ? 'border-[#F9B2D7]/70 bg-[#F9B2D7]/20'
                                    : 'border-[#E2B4BD]/45 bg-white/70 hover:border-[#F9B2D7]/70 hover:bg-white/85'
                                  : isSelected
                                    ? 'border-accent/45 bg-accent/10'
                                    : 'border-white/[0.08] bg-background/60 hover:border-accent/25 hover:bg-accent/5'
                              }`}
                            >
                              <div className={`-mx-3 -mt-3 mb-3 aspect-[4/3] overflow-hidden rounded-t-2xl border-b ${isGirlsTheme ? 'border-[#E2B4BD]/35 bg-white/65' : 'border-white/[0.08] bg-white/5'}`}>
                                {categoryVideo ? (
                                  <ExerciseMedia
                                    src={categoryVideo.url}
                                    mediaType="video"
                                    alt={toLocalizedMuscleLabel(muscle.name)}
                                    poster={getMuscleImage(muscle.name)}
                                    className="h-full w-full bg-black object-cover"
                                    videoProps={{ autoPlay: true }}
                                  />
                                ) : (
                                  <img
                                    src={getMuscleImage(muscle.name)}
                                    alt={toLocalizedMuscleLabel(muscle.name)}
                                    className="h-full w-full object-contain p-3"
                                  />
                                )}
                              </div>
                              <div className="mt-3">
                                <div className={`truncate text-sm font-semibold ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'}`}>{toLocalizedMuscleLabel(muscle.name)}</div>
                                <div className={`mt-1 text-[11px] ${isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary'}`}>
                                  {copy.exercisesCount(muscle.count)}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isMarkDoneModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setIsMarkDoneModalOpen(false)}
        >
          <div
            className={`relative w-full max-w-md overflow-hidden rounded-[1.75rem] border p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-[#FFF5F5]' : 'border-white/10 bg-[linear-gradient(180deg,rgba(20,38,29,0.98),rgba(11,21,17,0.98))]'} ${isArabic ? 'text-right' : 'text-left'}`}
            dir={isArabic ? 'rtl' : 'ltr'}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-28 ${isGirlsTheme ? 'bg-[radial-gradient(circle_at_top,rgba(249,178,215,0.28),transparent_70%)]' : 'bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_70%)]'}`} />

            <div className="relative">
              <div className={`flex items-start justify-between gap-4 ${isArabic ? 'flex-row-reverse' : ''}`}>
                <div className="space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/12 text-emerald-200">
                    <Check size={22} />
                  </div>
                  <div>
                    <h3 className={`text-xl font-semibold ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'}`}>{copy.markDoneTitle}</h3>
                    <p className={`mt-2 text-sm leading-relaxed ${isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary'}`}>
                      {copy.markDoneDescription(displayWorkoutName)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMarkDoneModalOpen(false)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${isGirlsTheme ? 'border border-[#E2B4BD]/45 bg-white/70 text-[#795E67] hover:bg-white' : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white'}`}
                  aria-label={copy.closeMarkDoneDialog}
                >
                  <X size={18} />
                </button>
              </div>

              <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 text-[#795E67]' : 'border-white/10 bg-white/[0.03] text-text-secondary'}`}>
                {copy.markDoneWeightNote}
              </div>

              {markDoneFeedback && (
                <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {markDoneFeedback}
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsMarkDoneModalOpen(false)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 text-[#795E67] hover:bg-white' : 'border-white/10 bg-white/5 text-text-primary hover:bg-white/10'}`}
                >
                  {copy.keepWorkout}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleMarkDayFullyDone();
                  }}
                  disabled={isSubmittingMarkDone}
                  className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingMarkDone ? copy.markingDone : copy.confirmMarkDone}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {isMissModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setIsMissModalOpen(false)}
        >
          <div
            className={`relative w-full max-w-md overflow-hidden rounded-[1.75rem] border p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-[#FFF5F5]' : 'border-white/10 bg-[linear-gradient(180deg,rgba(27,31,43,0.98),rgba(15,18,28,0.98))]'} ${isArabic ? 'text-right' : 'text-left'}`}
            dir={isArabic ? 'rtl' : 'ltr'}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-28 ${isGirlsTheme ? 'bg-[radial-gradient(circle_at_top,rgba(249,178,215,0.28),transparent_70%)]' : 'bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.18),transparent_70%)]'}`} />

            <div className="relative">
              <div className={`flex items-start justify-between gap-4 ${isArabic ? 'flex-row-reverse' : ''}`}>
                <div className="space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/12 text-rose-200">
                    <TriangleAlert size={22} />
                  </div>
                  <div>
                    <h3 className={`text-xl font-semibold ${isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white'}`}>{copy.missTitle}</h3>
                    <p className={`mt-2 text-sm leading-relaxed ${isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary'}`}>
                      {copy.missDescription(displayWorkoutName)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMissModalOpen(false)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${isGirlsTheme ? 'border border-[#E2B4BD]/45 bg-white/70 text-[#795E67] hover:bg-white' : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-white'}`}
                  aria-label={copy.closeMissDialog}
                >
                  <X size={18} />
                </button>
              </div>

              <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 text-[#795E67]' : 'border-white/10 bg-white/[0.03] text-text-secondary'}`}>
                {copy.missWarning}
              </div>

              {missDayFeedback && (
                <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {missDayFeedback}
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsMissModalOpen(false)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/70 text-[#795E67] hover:bg-white' : 'border-white/10 bg-white/5 text-text-primary hover:bg-white/10'}`}
                >
                  {copy.keepWorkout}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleMissDay();
                  }}
                  disabled={isSubmittingMissDay}
                  className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingMissDay ? copy.marking : copy.confirmMiss}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <style>{`
        .seven-seg-shell {
          --seg-on: #bbff5c;
          --seg-off: #26351f;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(187, 255, 92, 0.22);
          background: linear-gradient(180deg, rgba(187, 255, 92, 0.08) 0%, rgba(12, 20, 14, 0.92) 100%);
          box-shadow: inset 0 0 14px rgba(0, 0, 0, 0.38);
        }

        .seven-seg-group {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .seven-seg-digit {
          position: relative;
          width: 28px;
          height: 48px;
        }

        .seg {
          position: absolute;
          background: var(--seg-off);
          border-radius: 999px;
          opacity: 0.32;
          transition: background 120ms ease, opacity 120ms ease, box-shadow 120ms ease;
        }

        .seg.on {
          background: var(--seg-on);
          opacity: 1;
          box-shadow: 0 0 3px color-mix(in srgb, var(--seg-on) 70%, transparent), 0 0 8px color-mix(in srgb, var(--seg-on) 28%, transparent);
        }

        .seg-a,
        .seg-d,
        .seg-g {
          width: 18px;
          height: 5px;
          left: 5px;
        }

        .seg-a { top: 0; }
        .seg-g { top: 22px; }
        .seg-d { bottom: 0; }

        .seg-b,
        .seg-c,
        .seg-e,
        .seg-f {
          width: 5px;
          height: 18px;
        }

        .seg-b { right: 0; top: 2px; }
        .seg-c { right: 0; bottom: 2px; }
        .seg-f { left: 0; top: 2px; }
        .seg-e { left: 0; bottom: 2px; }

        .seven-seg-colon {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 8px;
          margin: 0 2px;
        }

        .seven-seg-colon .dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: var(--seg-on);
          box-shadow: 0 0 3px color-mix(in srgb, var(--seg-on) 65%, transparent), 0 0 7px color-mix(in srgb, var(--seg-on) 25%, transparent);
        }

        [data-theme='light'] .seven-seg-shell {
          --seg-on: #9FCC2A;
          --seg-off: #2f3f1f;
          border-color: rgba(191, 255, 0, 0.35);
          background: linear-gradient(180deg, #1f2a16 0%, #12190d 100%);
        }

        [data-theme='light'] .seven-seg-shell .seg.on {
          box-shadow: 0 0 4px color-mix(in srgb, var(--seg-on) 70%, transparent), 0 0 8px color-mix(in srgb, var(--seg-on) 35%, transparent);
        }

        [data-theme='light'] .seven-seg-shell .seven-seg-colon .dot {
          box-shadow: 0 0 4px color-mix(in srgb, var(--seg-on) 65%, transparent), 0 0 7px color-mix(in srgb, var(--seg-on) 30%, transparent);
        }
      `}</style>
    </div>
  );
}
