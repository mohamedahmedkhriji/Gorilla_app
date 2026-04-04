import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Header } from '../ui/Header';
import { api } from '../../services/api';
import { Bookmark, CalendarX2, Check, Plus, Play, Search, Square, TriangleAlert, X } from 'lucide-react';
import { getBodyPartImage } from '../../services/bodyPartTheme';
import { resolveExerciseVideo } from '../../services/exerciseVideos';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
import { formatWorkoutDayLabel, normalizeWorkoutDayKey } from '../../services/workoutDayLabel';
import { stripExercisePrefix } from '../../services/exerciseName';
import { translateProgramText } from '../../services/programI18n';

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
}

type CatalogExercise = {
  id: number;
  name: string;
  muscle: string;
  bodyPart?: string | null;
};

type WorkoutExerciseCard = {
  name: string;
  sets: number;
  reps: string;
  rest: unknown;
  targetWeight: number | null;
  notes: string;
  targetMuscles: string[];
};

type CardioPresetId = 'incline_walk' | 'bike' | 'jog' | 'row';

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
  if (key.includes('quad') || key.includes('thigh')) return 'Quadriceps';
  if (key.includes('hamstring')) return 'Hamstrings';
  if (key.includes('calf')) return 'Calves';
  if (key.includes('abs') || key.includes('core') || key.includes('oblique') || key.includes('abdom')) return 'Abs';
  if (key.includes('glute')) return 'Glutes';
  if (key.includes('forearm') || key.includes('grip') || key.includes('wrist')) return 'Forearms';
  if (key.includes('adductor')) return 'Adductors';

  return toTitleCase(key);
};

const inferMusclesFromExerciseName = (exerciseName = '') => {
  const name = String(exerciseName).toLowerCase();
  const matches: string[] = [];

  if (/bench|chest|fly|push-up|push up|pec deck|incline (db|dumbbell|barbell|machine|smith)? ?press|machine press|hammer strength press|weighted dip|dip/.test(name)) matches.push('Chest', 'Triceps', 'Shoulders');
  if (/deadlift|row|pull-up|pull up|pullup|chin-up|chin up|chinup|pulldown|pullover|lat pulldown|lat pull|rack pull/.test(name)) matches.push('Back', 'Biceps', 'Forearms');
  if (/squat|leg press|leg extension|lunge|split squat|step up|hip thrust/.test(name)) matches.push('Quadriceps', 'Hamstrings', 'Calves');
  if (/romanian deadlift|rdl|leg curl|hamstring/.test(name)) matches.push('Hamstrings');
  if (/shoulder|overhead press|lateral raise|\blateral\b|rear delt|face pull|arnold press|seated db press|seated shoulder press|machine shoulder press/.test(name)) matches.push('Shoulders', 'Triceps');
  if (/curl/.test(name)) matches.push('Biceps', 'Forearms');
  if (/tricep|triceps|pushdown|push down|skullcrusher|french press/.test(name)) matches.push('Triceps');
  if (/calf/.test(name)) matches.push('Calves');
  if (/abs|core|crunch|plank|sit-up|sit up|leg raise|leg lift|knee raise|vacuum|hollow|dead bug|toe touch|abs circuit/.test(name)) matches.push('Abs');

  return [...new Set(matches.map((entry) => canonicalizeMuscleLabel(entry)).filter(Boolean))];
};

const getMuscleImage = (muscle: string) => getBodyPartImage(muscle);

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

const SEGMENT_MAP: Record<string, [boolean, boolean, boolean, boolean, boolean, boolean, boolean]> = {
  '0': [true, true, true, true, true, true, false],
  '1': [false, true, true, false, false, false, false],
  '2': [true, true, false, true, true, false, true],
  '3': [true, true, true, true, false, false, true],
  '4': [false, true, true, false, false, true, true],
  '5': [true, false, true, true, false, true, true],
  '6': [true, false, true, true, true, true, true],
  '7': [true, true, true, false, false, false, false],
  '8': [true, true, true, true, true, true, true],
  '9': [true, true, true, true, false, true, true],
};

const CARDIO_PRESETS: Array<{ id: CardioPresetId; durationMinutes: number; kcalPerMinute: number; accentClass: string }> = [
  { id: 'incline_walk', durationMinutes: 15, kcalPerMinute: 6, accentClass: 'from-emerald-300/30 via-lime-300/20 to-transparent' },
  { id: 'bike', durationMinutes: 18, kcalPerMinute: 8, accentClass: 'from-sky-300/30 via-cyan-300/20 to-transparent' },
  { id: 'jog', durationMinutes: 12, kcalPerMinute: 10, accentClass: 'from-orange-300/30 via-amber-300/20 to-transparent' },
  { id: 'row', durationMinutes: 14, kcalPerMinute: 9, accentClass: 'from-fuchsia-300/25 via-violet-300/15 to-transparent' },
];

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
    noExercises: 'No exercises added for today yet. Tap the plus button to add one.',
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
    noExercises: 'لا توجد تمارين مضافة اليوم بعد. اضغط زر الإضافة لإضافة تمرين.',
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

const CARDIO_PLAN_I18N = {
  en: {
    title: 'Optional Cardio Finish',
    badge: 'Optional',
    body: 'Add a short cardio block after lifting if you want extra conditioning and calorie burn.',
    open: 'Open Cardio',
    resume: 'Resume Cardio',
    close: 'Close cardio dialog',
    modalEyebrow: 'Cardio Add-On',
    modalTitle: 'Finish strong with a cardio block',
    modalBody: 'Pick the style that feels right today, then start the timer whenever you are ready.',
    modeLabel: 'Cardio style',
    suggestedLabel: 'Suggested',
    caloriesLabel: 'Calories',
    liveBurnLabel: 'Live burn',
    timerLabel: 'Timer',
    timerAria: (value: string) => `Cardio timer ${value}`,
    reset: 'Reset',
    start: 'Start',
    stop: 'Stop',
    readyHint: 'You can skip this anytime. It is an extra finisher, not part of the required workout.',
    progressLabel: 'Target progress',
    completedHint: 'Nice finish. You can keep going or reset for another round.',
    minuteShort: 'min',
    kcalShort: 'kcal',
    presets: {
      incline_walk: { name: 'Incline Walk', hint: 'Easy recovery pace' },
      bike: { name: 'Bike Ride', hint: 'Smooth low-impact burn' },
      jog: { name: 'Light Jog', hint: 'Fastest calorie push' },
      row: { name: 'Row Machine', hint: 'Full-body cardio' },
    } as Record<CardioPresetId, { name: string; hint: string }>,
  },
  ar: {
    title: 'كارديو إضافي اختياري',
    badge: 'اختياري',
    body: 'أضف جزء كارديو قصير بعد الحديد إذا أردت لياقة أكثر وحرق سعرات إضافي.',
    open: 'فتح الكارديو',
    resume: 'متابعة الكارديو',
    close: 'إغلاق نافذة الكارديو',
    modalEyebrow: 'إضافة كارديو',
    modalTitle: 'اختم التمرين بجلسة كارديو',
    modalBody: 'اختر النوع المناسب لك اليوم ثم ابدأ المؤقت عندما تكون جاهزًا.',
    modeLabel: 'نوع الكارديو',
    suggestedLabel: 'المقترح',
    caloriesLabel: 'السعرات',
    liveBurnLabel: 'الحرق المباشر',
    timerLabel: 'المؤقت',
    timerAria: (value: string) => `مؤقت الكارديو ${value}`,
    reset: 'إعادة',
    start: 'ابدأ',
    stop: 'إيقاف',
    readyHint: 'يمكنك تخطي هذا في أي وقت. هو إضافة اختيارية وليس جزءًا إلزاميًا من التمرين.',
    progressLabel: 'تقدم الهدف',
    completedHint: 'أداء جميل. يمكنك الاستمرار أو إعادة المؤقت لجولة جديدة.',
    minuteShort: 'د',
    kcalShort: 'سعرة',
    presets: {
      incline_walk: { name: 'مشي مائل', hint: 'وتيرة سهلة للاستشفاء' },
      bike: { name: 'دراجة', hint: 'حرق سلس وخفيف على المفاصل' },
      jog: { name: 'جري خفيف', hint: 'أسرع دفعة للسعرات' },
      row: { name: 'جهاز التجديف', hint: 'كارديو للجسم بالكامل' },
    } as Record<CardioPresetId, { name: string; hint: string }>,
  },
} as const;

const LOCALIZED_WORKOUT_PLAN_I18N: Record<AppLanguage, typeof WORKOUT_PLAN_I18N.en> = {
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
    noExercises: 'Nessun esercizio aggiunto per oggi. Tocca il pulsante piu per aggiungerne uno.',
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
    noExercises: 'Fuer heute wurden noch keine Uebungen hinzugefuegt. Tippe auf Plus, um eine hinzuzufuegen.',
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

const LOCALIZED_CARDIO_PLAN_I18N: Record<AppLanguage, typeof CARDIO_PLAN_I18N.en> = {
  en: CARDIO_PLAN_I18N.en,
  ar: CARDIO_PLAN_I18N.ar,
  it: {
    title: 'Finale Cardio Opzionale',
    badge: 'Opzionale',
    body: 'Aggiungi un breve blocco cardio dopo i pesi se vuoi piu condizionamento e consumo calorico.',
    open: 'Apri Cardio',
    resume: 'Riprendi Cardio',
    close: 'Chiudi finestra cardio',
    modalEyebrow: 'Extra Cardio',
    modalTitle: 'Chiudi forte con un blocco cardio',
    modalBody: 'Scegli lo stile giusto per oggi, poi avvia il timer quando sei pronto.',
    modeLabel: 'Stile cardio',
    suggestedLabel: 'Consigliato',
    caloriesLabel: 'Calorie',
    liveBurnLabel: 'Consumo live',
    timerLabel: 'Timer',
    timerAria: (value: string) => `Timer cardio ${value}`,
    reset: 'Reset',
    start: 'Avvia',
    stop: 'Stop',
    readyHint: 'Puoi saltarlo in qualsiasi momento. E un extra finale, non parte obbligatoria dell allenamento.',
    progressLabel: 'Progresso obiettivo',
    completedHint: 'Ottima chiusura. Puoi continuare o resettare per un altro giro.',
    minuteShort: 'min',
    kcalShort: 'kcal',
    presets: {
      incline_walk: { name: 'Camminata in salita', hint: 'Recupero facile' },
      bike: { name: 'Bici', hint: 'Consumo fluido a basso impatto' },
      jog: { name: 'Jog leggero', hint: 'Spinta calorie piu rapida' },
      row: { name: 'Vogatore', hint: 'Cardio total body' },
    } as Record<CardioPresetId, { name: string; hint: string }>,
  },
  de: {
    title: 'Optionales Cardio-Finish',
    badge: 'Optional',
    body: 'Fuege nach dem Krafttraining einen kurzen Cardio-Block hinzu, wenn du mehr Kondition und Kalorienverbrauch moechtest.',
    open: 'Cardio Oeffnen',
    resume: 'Cardio Fortsetzen',
    close: 'Cardio-Dialog schliessen',
    modalEyebrow: 'Cardio Zusatz',
    modalTitle: 'Beende stark mit einem Cardio-Block',
    modalBody: 'Waehle heute den passenden Stil und starte den Timer, wenn du bereit bist.',
    modeLabel: 'Cardio-Stil',
    suggestedLabel: 'Empfohlen',
    caloriesLabel: 'Kalorien',
    liveBurnLabel: 'Live Verbrauch',
    timerLabel: 'Timer',
    timerAria: (value: string) => `Cardio-Timer ${value}`,
    reset: 'Zuruecksetzen',
    start: 'Start',
    stop: 'Stopp',
    readyHint: 'Du kannst dies jederzeit ueberspringen. Es ist ein extra Finisher und kein Pflichtteil des Workouts.',
    progressLabel: 'Ziel Fortschritt',
    completedHint: 'Starker Abschluss. Du kannst weitermachen oder fuer eine weitere Runde zuruecksetzen.',
    minuteShort: 'min',
    kcalShort: 'kcal',
    presets: {
      incline_walk: { name: 'Steigung Gehen', hint: 'Leichtes Erholungstempo' },
      bike: { name: 'Fahrrad', hint: 'Sanfter Low-Impact Verbrauch' },
      jog: { name: 'Leichter Lauf', hint: 'Schnellster Kalorien-Schub' },
      row: { name: 'Rudergeraet', hint: 'Ganzkoerper Cardio' },
    } as Record<CardioPresetId, { name: string; hint: string }>,
  },
};

const formatCardioClock = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

function SevenSegmentDigit({ digit }: { digit: string }) {
  const segments = SEGMENT_MAP[digit] || SEGMENT_MAP['0'];

  return (
    <div className="seven-seg-digit" aria-hidden="true">
      <span className={`seg seg-a ${segments[0] ? 'on' : ''}`} />
      <span className={`seg seg-b ${segments[1] ? 'on' : ''}`} />
      <span className={`seg seg-c ${segments[2] ? 'on' : ''}`} />
      <span className={`seg seg-d ${segments[3] ? 'on' : ''}`} />
      <span className={`seg seg-e ${segments[4] ? 'on' : ''}`} />
      <span className={`seg seg-f ${segments[5] ? 'on' : ''}`} />
      <span className={`seg seg-g ${segments[6] ? 'on' : ''}`} />
    </div>
  );
}

const resolvePrimaryExerciseMuscle = (exercise: WorkoutExerciseCard) => {
  const inferredMuscles = inferMusclesFromExerciseName(exercise.name);
  const normalizedTargets = exercise.targetMuscles.map((entry) => canonicalizeMuscleLabel(entry)).filter(Boolean);

  for (const inferred of inferredMuscles) {
    const match = normalizedTargets.find((target) => target.toLowerCase() === inferred.toLowerCase());
    if (match) return match;
  }

  if (inferredMuscles.length > 0) return inferredMuscles[0];
  if (normalizedTargets.length > 0) return normalizedTargets[0];
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
}: WorkoutPlanScreenProps) {
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
  const [isCardioModalOpen, setIsCardioModalOpen] = useState(false);
  const [addExerciseFeedback, setAddExerciseFeedback] = useState<string | null>(null);
  const [missDayFeedback, setMissDayFeedback] = useState<string | null>(null);
  const [markDoneFeedback, setMarkDoneFeedback] = useState<string | null>(null);
  const [isSubmittingExercise, setIsSubmittingExercise] = useState(false);
  const [isSubmittingMissDay, setIsSubmittingMissDay] = useState(false);
  const [isSubmittingMarkDone, setIsSubmittingMarkDone] = useState(false);
  const [lastWeights, setLastWeights] = useState<Record<string, number>>({});
  const [selectedCardioPresetId, setSelectedCardioPresetId] = useState<CardioPresetId>('incline_walk');
  const [cardioSeconds, setCardioSeconds] = useState(0);
  const [isCardioRunning, setIsCardioRunning] = useState(false);
  const cardioIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const copy = LOCALIZED_WORKOUT_PLAN_I18N[language] || LOCALIZED_WORKOUT_PLAN_I18N.en;
  const cardioCopy = LOCALIZED_CARDIO_PLAN_I18N[language] || LOCALIZED_CARDIO_PLAN_I18N.en;
  const isArabic = language === 'ar';

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
    if (!isAddModalOpen || catalogLoaded || catalogLoading) return;

    const loadCatalog = async () => {
      try {
        setCatalogLoading(true);
        setCatalogError(null);
        const result = await api.getExerciseCatalog('All', '', 500);
        const nextCatalog = Array.isArray(result?.exercises)
          ? result.exercises
            .map((exercise: any) => ({
              id: Number(exercise?.id || 0),
              name: String(exercise?.name || '').trim(),
              muscle: String(exercise?.muscle || exercise?.bodyPart || '').trim(),
              bodyPart: exercise?.bodyPart ? String(exercise.bodyPart) : null,
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

  useEffect(() => {
    if (cardioIntervalRef.current) {
      clearInterval(cardioIntervalRef.current);
      cardioIntervalRef.current = null;
    }

    if (isCardioRunning) {
      cardioIntervalRef.current = setInterval(() => {
        setCardioSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (cardioIntervalRef.current) {
        clearInterval(cardioIntervalRef.current);
        cardioIntervalRef.current = null;
      }
    };
  }, [isCardioRunning]);

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
        bodyPart: primaryMuscle,
      });
      return { primaryMuscle, videoMatch };
    })
  ), [exercises]);

  const displayTargetMuscles = useMemo(() => {
    const plannedLoadByMuscle = new Map<string, number>();

    exercises.forEach((exercise) => {
      const muscles = exercise.targetMuscles
        .map((entry) => canonicalizeMuscleLabel(entry))
        .filter(Boolean);
      if (!muscles.length) return;

      const setCount = Math.max(1, Number.isFinite(exercise.sets) ? exercise.sets : Number(exercise.sets || 0) || 1);
      const contribution = setCount / muscles.length;

      muscles.forEach((muscle) => {
        plannedLoadByMuscle.set(muscle, (plannedLoadByMuscle.get(muscle) || 0) + contribution);
      });
    });

    const totalLoad = Array.from(plannedLoadByMuscle.values()).reduce((sum, value) => sum + value, 0);
    if (totalLoad <= 0) return [];

    return Array.from(plannedLoadByMuscle.entries())
      .map(([name, load]) => ({
        name,
        score: Math.max(1, Math.round((load / totalLoad) * 100)),
        load,
      }))
      .sort((left, right) => right.load - left.load || left.name.localeCompare(right.name))
      .slice(0, 4)
      .map(({ name, score }) => ({ name, score }));
  }, [exercises]);

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
  const selectedCardioPreset = CARDIO_PRESETS.find((preset) => preset.id === selectedCardioPresetId) || CARDIO_PRESETS[0];
  const cardioTimerText = formatCardioClock(cardioSeconds);
  const [cardioMins, cardioSecs] = cardioTimerText.split(':');
  const [cardioM1 = '0', cardioM2 = '0'] = cardioMins.split('');
  const [cardioS1 = '0', cardioS2 = '0'] = cardioSecs.split('');
  const cardioEstimatedCalories = Math.max(0, Math.round((cardioSeconds / 60) * selectedCardioPreset.kcalPerMinute));
  const cardioSuggestedSeconds = selectedCardioPreset.durationMinutes * 60;
  const cardioProgress = cardioSuggestedSeconds > 0
    ? Math.min(100, Math.round((cardioSeconds / cardioSuggestedSeconds) * 100))
    : 0;
  const cardioPresetCopy = cardioCopy.presets[selectedCardioPreset.id];

  const headerActions = (
    <div className="flex items-center gap-2">
      {!isRestDayView && allowEditing && onMarkDayFullyDone && !isDayFullyDone && (
        <button
          type="button"
          onClick={() => {
            setMarkDoneFeedback(null);
            setIsMarkDoneModalOpen(true);
          }}
          className="flex h-10 items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-200 transition-colors hover:border-emerald-400/30 hover:bg-emerald-500/15"
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
          className="flex h-10 items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-200 transition-colors hover:border-rose-400/30 hover:bg-rose-500/15"
          aria-label={copy.markMissedAria}
        >
          <CalendarX2 size={15} />
          <span className="hidden sm:inline">{copy.missDay}</span>
        </button>
      )}

      {onOpenLatestSummary && (
        <button
          data-coachmark-target="workout_plan_latest_summary_button"
          type="button"
          onClick={onOpenLatestSummary}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
            hasLatestSummary
              ? 'border-accent/35 bg-accent/10 text-accent hover:bg-accent/20'
              : 'border-white/10 bg-card/60 text-text-tertiary hover:text-text-secondary'
          }`}
          aria-label={copy.openLatestSummaryAria}
        >
          <Bookmark size={17} />
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

  const toggleCardioTimer = () => {
    setIsCardioRunning((current) => !current);
  };

  const resetCardioTimer = () => {
    setIsCardioRunning(false);
    setCardioSeconds(0);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-y-auto pb-24">
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
            className="rounded-2xl border border-white/10 bg-card/60 px-4 py-3"
            data-coachmark-target="workout_plan_info_card"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
              {copy.workout}
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              {displayWorkoutName}
            </div>
          </div>
        )}
        {!isRestDayView && (
          <div
            className="space-y-3"
            data-no-translate="true"
            data-coachmark-target="workout_plan_target_muscles"
          >
            <div className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              {copy.targetMuscles}
            </div>
            {displayTargetMuscles.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {displayTargetMuscles.map((muscle) => (
                  <div
                    key={muscle.name}
                    className="surface-card min-w-[8.5rem] rounded-2xl border border-white/10 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-xl bg-white/5">
                        <img
                          src={getMuscleImage(muscle.name)}
                          alt={toLocalizedMuscleLabel(muscle.name)}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{toLocalizedMuscleLabel(muscle.name)}</div>
                        <div className="mt-1 inline-flex rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                          {muscle.score}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/8 bg-card/60 px-4 py-4 text-sm text-text-secondary">
                {copy.targetMusclesEmpty}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <h3 className="text-xl font-semibold text-white">
            {copy.exercisesCount(exercises.length)}
          </h3>
          <button
            data-coachmark-target="workout_plan_add_exercise_button"
            type="button"
            onClick={openAddExerciseModal}
            disabled={isRestDayView || !allowEditing}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-text-tertiary disabled:hover:bg-white/10"
            aria-label={copy.addExerciseAria}
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {exercises.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-card/70 px-4 py-5 text-sm text-text-secondary">
              {isRestDayView
                ? copy.restDayEmpty
                : copy.noExercises}
            </div>
          )}

          {exercises.map((exercise, index) => {
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
                  isCompleted
                    ? 'border-green-500/35 bg-green-500/5'
                    : isNext
                      ? 'border-accent/40 bg-accent/5'
                      : 'border-white/8 bg-card/70 hover:border-accent/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    {videoUrl ? (
                      <>
                        <video
                          src={videoUrl}
                          poster={getMuscleImage(primaryMuscle)}
                          className="block h-full w-full bg-black object-cover"
                          autoPlay
                          loop
                          playsInline
                          muted
                          preload="metadata"
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white">
                            <Play size={11} fill="currentColor" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <img
                          src={getMuscleImage(primaryMuscle)}
                          alt={exercise.name}
                          className="h-full w-full object-cover"
                        />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-200">
                          {copy.videoMissing}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold text-white">
                        {stripExercisePrefix(exercise.name)}
                      </h4>
                      <p className="mt-1 text-xs text-text-secondary">
                        {exercise.sets} {copy.setsLabel} - {exercise.reps || '--'} {copy.repsLabel} - {exercise.targetWeight ? `${exercise.targetWeight} ${copy.kgLabel}` : formatRestLabel(exercise.rest)}
                        {lastWeight ? ` - ${copy.lastWeightLabel} ${lastWeight} ${copy.kgLabel}` : ''}
                      </p>
                      {!!exercise.targetMuscles.length && (
                        <p className="mt-2 truncate text-[11px] text-text-tertiary">
                          {exercise.targetMuscles.map((entry) => toLocalizedMuscleLabel(entry)).join(' - ')}
                        </p>
                      )}
                      {!!exercise.notes && (
                        <p className="mt-2 line-clamp-2 text-[11px] text-text-tertiary">
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

        {!isRestDayView && (
          <div
            className={`relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(160deg,rgba(22,26,35,0.96),rgba(12,16,26,0.98))] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.22)] ${isArabic ? 'text-right' : 'text-left'}`}
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${selectedCardioPreset.accentClass}`} />
            <div className="pointer-events-none absolute -right-8 top-0 h-28 w-28 rounded-full bg-white/10 blur-3xl" />

            <div className="relative">
              <div className={`flex items-start justify-between gap-4 ${isArabic ? 'flex-row-reverse' : ''}`}>
                <div className="min-w-0">
                  <div className="inline-flex rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                    {cardioCopy.badge}
                  </div>
                  <h3 className="mt-3 text-xl font-semibold text-white">{cardioCopy.title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">
                    {cardioCopy.body}
                  </p>
                </div>

                <div className="flex h-14 min-w-[4.75rem] flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-3 text-center">
                  <span className="text-lg font-electrolize text-white">{selectedCardioPreset.durationMinutes}</span>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary">{cardioCopy.minuteShort}</span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                    {cardioCopy.modeLabel}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">{cardioPresetCopy.name}</div>
                  <div className="mt-1 text-[11px] text-text-secondary">{cardioPresetCopy.hint}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                    {cardioCopy.suggestedLabel}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">{selectedCardioPreset.durationMinutes} {cardioCopy.minuteShort}</div>
                  <div className="mt-1 text-[11px] text-text-secondary">{cardioCopy.progressLabel}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                    {cardioCopy.liveBurnLabel}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">{cardioEstimatedCalories} {cardioCopy.kcalShort}</div>
                  <div className="mt-1 text-[11px] text-text-secondary">{cardioTimerText}</div>
                </div>
              </div>

              <div className={`mt-5 flex items-center justify-between gap-3 ${isArabic ? 'flex-row-reverse' : ''}`}>
                <p className="text-xs leading-relaxed text-text-secondary">
                  {cardioCopy.readyHint}
                </p>
                <button
                  type="button"
                  onClick={() => setIsCardioModalOpen(true)}
                  className="inline-flex shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/15 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-text-primary transition-colors hover:bg-accent/22"
                >
                  {cardioSeconds > 0 ? cardioCopy.resume : cardioCopy.open}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {isCardioModalOpen && !isRestDayView && (
        <div
          className="fixed inset-x-0 top-0 bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] z-[70] flex items-end justify-center overflow-hidden bg-black/80 px-3 pb-3 pt-3 backdrop-blur-sm sm:inset-0 sm:items-center sm:px-4 sm:pb-4 sm:pt-4"
          onClick={() => {
            setIsCardioRunning(false);
            setIsCardioModalOpen(false);
          }}
        >
          <div
            className={`relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,23,34,0.98),rgba(9,12,20,0.98))] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.45)] ${isArabic ? 'text-right' : 'text-left'}`}
            dir={isArabic ? 'rtl' : 'ltr'}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${selectedCardioPreset.accentClass}`} />
            <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-white/10 blur-3xl" />

            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className={`flex items-start justify-between gap-3 ${isArabic ? 'flex-row-reverse' : ''}`}>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                    {cardioCopy.modalEyebrow}
                  </div>
                  <h3 className="mt-1.5 text-xl font-semibold text-white">{cardioCopy.modalTitle}</h3>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsCardioRunning(false);
                    setIsCardioModalOpen(false);
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/6 text-text-secondary transition-colors hover:bg-white/12 hover:text-white"
                  aria-label={cardioCopy.close}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 min-h-0 space-y-4 overflow-y-auto overscroll-contain pr-1">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary sm:text-[11px] sm:tracking-[0.16em]">
                  {cardioCopy.modeLabel}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CARDIO_PRESETS.map((preset) => {
                    const presetCopy = cardioCopy.presets[preset.id];
                    const isSelected = preset.id === selectedCardioPreset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedCardioPresetId(preset.id)}
                        className={`rounded-xl border px-3 py-2.5 transition-colors ${isSelected ? 'border-accent/45 bg-accent/12' : 'border-white/8 bg-white/[0.03] hover:border-accent/25'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className={`min-w-0 ${isArabic ? 'text-right' : 'text-left'}`}>
                            <div className="truncate text-xs font-semibold text-white sm:text-sm">{presetCopy.name}</div>
                            <div className="mt-0.5 text-[10px] text-text-secondary sm:text-[11px]">{presetCopy.hint}</div>
                          </div>
                          <div className="rounded-full border border-white/10 bg-black/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-text-secondary sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.12em]">
                            {preset.durationMinutes} {cardioCopy.minuteShort}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary sm:text-[11px] sm:tracking-[0.16em]">
                        {cardioCopy.timerLabel}
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.12em]">
                        {cardioProgress}% {cardioCopy.progressLabel}
                      </div>
                    </div>

                    <div className="mt-3 flex justify-center">
                      <div
                        className="seven-seg-shell"
                        role="timer"
                        aria-label={cardioCopy.timerAria(cardioTimerText)}
                      >
                        <div className="seven-seg-group">
                          <SevenSegmentDigit digit={cardioM1} />
                          <SevenSegmentDigit digit={cardioM2} />
                        </div>
                        <div className="seven-seg-colon" aria-hidden="true">
                          <span className="dot" />
                          <span className="dot" />
                        </div>
                        <div className="seven-seg-group">
                          <SevenSegmentDigit digit={cardioS1} />
                          <SevenSegmentDigit digit={cardioS2} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
                        <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-text-tertiary sm:text-[10px] sm:tracking-[0.14em]">
                          {cardioCopy.suggestedLabel}
                        </div>
                        <div className="mt-1.5 text-base font-semibold text-white sm:text-lg">{selectedCardioPreset.durationMinutes} {cardioCopy.minuteShort}</div>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
                        <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-text-tertiary sm:text-[10px] sm:tracking-[0.14em]">
                          {cardioCopy.caloriesLabel}
                        </div>
                        <div className="mt-1.5 text-base font-semibold text-white sm:text-lg">{cardioEstimatedCalories} {cardioCopy.kcalShort}</div>
                      </div>
                    </div>

                    {cardioProgress >= 100 && (
                      <div className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2.5 text-xs text-emerald-100 sm:text-sm">
                        {cardioCopy.completedHint}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={toggleCardioTimer}
                      className={`flex min-h-[3rem] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold uppercase tracking-[0.1em] transition-colors sm:text-sm sm:tracking-[0.12em] ${
                        isCardioRunning
                          ? 'bg-rose-500 text-white hover:bg-rose-400'
                          : 'bg-accent text-black hover:bg-[#aee600]'
                      }`}
                    >
                      {isCardioRunning ? <Square size={16} /> : <Play size={16} fill="currentColor" />}
                      {isCardioRunning ? cardioCopy.stop : cardioCopy.start}
                    </button>
                    <button
                      type="button"
                      onClick={resetCardioTimer}
                      className="flex min-h-[3rem] items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold uppercase tracking-[0.1em] text-text-primary transition-colors hover:bg-white/[0.08] sm:text-sm sm:tracking-[0.12em]"
                    >
                      {cardioCopy.reset}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className={`w-full max-w-3xl rounded-3xl border border-white/10 bg-card p-4 shadow-2xl ${isArabic ? 'text-right' : 'text-left'}`}
            dir={isArabic ? 'rtl' : 'ltr'}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`flex items-center justify-between ${isArabic ? 'flex-row-reverse' : ''}`}>
              <div>
                <h3 className="text-lg font-semibold text-white">{copy.addExerciseTitle}</h3>
                <p className="mt-1 text-sm text-text-secondary">{copy.addExerciseSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-text-secondary transition-colors hover:bg-white/10 hover:text-white"
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
                <div className="rounded-2xl border border-white/8 bg-background/60 px-4 py-3 text-sm text-text-secondary">
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
                        <div className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                          {selectedCatalogMuscle ? toLocalizedMuscleLabel(selectedCatalogMuscle) : copy.exercisesHeading}
                        </div>
                        <div className="mt-1 text-sm text-white">
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
                          className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:border-accent/30 hover:text-white"
                        >
                          {copy.clear}
                        </button>
                      )}
                    </div>

                    <div className="relative mt-4">
                      <Search size={16} className={`absolute top-1/2 -translate-y-1/2 text-text-secondary ${isArabic ? 'right-3' : 'left-3'}`} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={selectedCatalogMuscle ? copy.searchExercise : copy.selectMuscleFirst}
                        disabled={!selectedCatalogMuscle}
                        className={`w-full rounded-2xl border border-white/10 bg-background py-3 text-sm text-white outline-none transition-colors focus:border-accent/50 disabled:cursor-not-allowed disabled:opacity-60 ${isArabic ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'}`}
                      />
                    </div>

                    {!selectedCatalogMuscle && (
                      <div className="mt-4 rounded-2xl border border-white/8 bg-background/60 px-4 py-5 text-sm text-text-secondary">
                        {copy.pickMuscleCard}
                      </div>
                    )}

                    {selectedCatalogMuscle && filteredCatalog.length === 0 && (
                      <div className="mt-4 rounded-2xl border border-white/8 bg-background/60 px-4 py-5 text-sm text-text-secondary">
                        {copy.noMatchingExercise(toLocalizedMuscleLabel(selectedCatalogMuscle))}
                      </div>
                    )}

                    {selectedCatalogMuscle && filteredCatalog.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {filteredCatalog.map((exercise) => {
                          const muscleLabel = toTitleCase(exercise.muscle || exercise.bodyPart || selectedCatalogMuscle || 'General');
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
                              className={`surface-card rounded-2xl p-3 transition-colors group hover:border-accent/20 ${isArabic ? 'text-right' : 'text-left'}`}
                            >
                              <div className="relative -mx-3 -mt-3 mb-3 aspect-video overflow-hidden rounded-t-2xl border-b border-white/8 bg-white/5">
                                <img
                                  src={getMuscleImage(muscleLabel)}
                                  alt={exercise.name}
                                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onPreviewExercise?.(exercise.name);
                                  }}
                                  disabled={!onPreviewExercise}
                                  aria-label={copy.previewVideoAria}
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors group-hover:bg-accent group-hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Play size={12} fill="currentColor" />
                                </button>
                              </div>
                                <div className={`absolute top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white ${isArabic ? 'right-2' : 'left-2'}`}>
                                  {copy.add}
                                </div>
                              </div>
                              <div className="truncate text-sm font-bold text-white">
                                {stripExercisePrefix(exercise.name)}
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <div className="truncate text-[10px] uppercase tracking-wider text-text-secondary">
                                  {toLocalizedMuscleLabel(muscleLabel)}
                                </div>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleAddExercise(exercise);
                                  }}
                                  className="rounded-full bg-accent/15 px-2 py-1 text-[10px] font-semibold text-accent"
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
                    <div className="mb-3 text-xs font-bold uppercase tracking-wider text-text-secondary">
                      {copy.muscleGroups}
                    </div>
                    {catalogMuscles.length === 0 ? (
                      <div className="rounded-2xl border border-white/8 bg-background/60 px-4 py-3 text-sm text-text-secondary">
                        {copy.noExerciseGroups}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {catalogMuscles.map((muscle) => {
                          const isSelected = selectedCatalogMuscle === muscle.name;
                          return (
                            <button
                              key={muscle.name}
                              type="button"
                              onClick={() => {
                                setSelectedCatalogMuscle((current) => (current === muscle.name ? '' : muscle.name));
                                setSearchQuery('');
                              }}
                              className={`rounded-2xl border p-3 transition-colors ${isArabic ? 'text-right' : 'text-left'} ${
                                isSelected
                                  ? 'border-accent/45 bg-accent/10'
                                  : 'border-white/8 bg-background/60 hover:border-accent/25 hover:bg-accent/5'
                              }`}
                            >
                              <div className="-mx-3 -mt-3 mb-3 aspect-[4/3] overflow-hidden rounded-t-2xl border-b border-white/8 bg-white/5">
                                <img
                                  src={getMuscleImage(muscle.name)}
                                  alt={toLocalizedMuscleLabel(muscle.name)}
                                  className="h-full w-full object-contain p-3"
                                />
                              </div>
                              <div className="mt-3">
                                <div className="truncate text-sm font-semibold text-white">{toLocalizedMuscleLabel(muscle.name)}</div>
                                <div className="mt-1 text-[11px] text-text-secondary">
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

      {isMarkDoneModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setIsMarkDoneModalOpen(false)}
        >
          <div
            className={`relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(20,38,29,0.98),rgba(11,21,17,0.98))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] ${isArabic ? 'text-right' : 'text-left'}`}
            dir={isArabic ? 'rtl' : 'ltr'}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_70%)]" />

            <div className="relative">
              <div className={`flex items-start justify-between gap-4 ${isArabic ? 'flex-row-reverse' : ''}`}>
                <div className="space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/12 text-emerald-200">
                    <Check size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{copy.markDoneTitle}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                      {copy.markDoneDescription(displayWorkoutName)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMarkDoneModalOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-text-secondary transition-colors hover:bg-white/10 hover:text-white"
                  aria-label={copy.closeMarkDoneDialog}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-text-secondary">
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
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-white/10"
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
        </div>
      )}

      {isMissModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setIsMissModalOpen(false)}
        >
          <div
            className={`relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(27,31,43,0.98),rgba(15,18,28,0.98))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] ${isArabic ? 'text-right' : 'text-left'}`}
            dir={isArabic ? 'rtl' : 'ltr'}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.18),transparent_70%)]" />

            <div className="relative">
              <div className={`flex items-start justify-between gap-4 ${isArabic ? 'flex-row-reverse' : ''}`}>
                <div className="space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/12 text-rose-200">
                    <TriangleAlert size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{copy.missTitle}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                      {copy.missDescription(displayWorkoutName)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMissModalOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-text-secondary transition-colors hover:bg-white/10 hover:text-white"
                  aria-label={copy.closeMissDialog}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-text-secondary">
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
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-white/10"
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
        </div>
      )}

      <style>{`
        .seven-seg-shell {
          --seg-on: #ff2136;
          --seg-off: #3b2a2a;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: linear-gradient(180deg, #2a1717 0%, #120b0b 100%);
          box-shadow: inset 0 0 24px rgba(0, 0, 0, 0.65), 0 8px 18px rgba(0, 0, 0, 0.35);
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
          box-shadow: 0 0 6px var(--seg-on), 0 0 12px color-mix(in srgb, var(--seg-on) 85%, transparent), 0 0 20px color-mix(in srgb, var(--seg-on) 45%, transparent);
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
          box-shadow: 0 0 6px var(--seg-on), 0 0 12px color-mix(in srgb, var(--seg-on) 70%, transparent);
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
