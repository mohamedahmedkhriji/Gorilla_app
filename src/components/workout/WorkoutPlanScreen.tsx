import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Header } from '../ui/Header';
import { api } from '../../services/api';
import { Bookmark, CalendarX2, Plus, Play, Search, TriangleAlert, X } from 'lucide-react';
import { getBodyPartImage } from '../../services/bodyPartTheme';
import { resolveExerciseVideo } from '../../services/exerciseVideos';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
import { normalizeWorkoutDayKey } from '../../services/workoutDayLabel';
import { stripExercisePrefix } from '../../services/exerciseName';

interface WorkoutPlanScreenProps {
  onBack: () => void;
  onExerciseClick: (exercise: string) => void;
  onPreviewExercise?: (exercise: string) => void;
  onAddExercise: (exercise: CatalogExercise) => Promise<{ added: boolean; reason?: string }> | { added: boolean; reason?: string };
  onMissDay?: () => Promise<{ missed: boolean; reason?: string }> | { missed: boolean; reason?: string };
  onOpenLatestSummary?: () => void;
  hasLatestSummary?: boolean;
  workoutDay: string;
  workoutDayLabel?: string;
  completedExercises: string[];
  todayExercises: any[];
  loading: boolean;
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

  if (/bench|chest|fly|push-up|push up/.test(name)) matches.push('Chest', 'Triceps', 'Shoulders');
  if (/deadlift|row|pull-up|pull up|lat|pulldown|pullover/.test(name)) matches.push('Back', 'Biceps', 'Forearms');
  if (/squat|leg press|lunge|split squat|step up/.test(name)) matches.push('Quadriceps', 'Hamstrings', 'Calves');
  if (/romanian deadlift|rdl|leg curl|hamstring/.test(name)) matches.push('Hamstrings');
  if (/shoulder|overhead press|lateral raise|rear delt/.test(name)) matches.push('Shoulders', 'Triceps');
  if (/curl/.test(name)) matches.push('Biceps', 'Forearms');
  if (/tricep|triceps|dip/.test(name)) matches.push('Triceps');
  if (/calf/.test(name)) matches.push('Calves');
  if (/abs|core|crunch|plank|sit-up|sit up/.test(name)) matches.push('Abs');

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

const WORKOUT_PLAN_I18N = {
  en: {
    markMissedAria: 'Mark today as missed',
    missDay: 'Miss Day',
    openLatestSummaryAria: 'Open latest workout summary',
    loadingWorkout: 'Loading workout...',
    workout: 'Workout',
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
    startWorkout: 'Start Workout',
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
    startWorkout: 'ابدأ التمرين',
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
  onOpenLatestSummary,
  hasLatestSummary = false,
  workoutDay,
  workoutDayLabel,
  completedExercises,
  todayExercises,
  loading,
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
  const [addExerciseFeedback, setAddExerciseFeedback] = useState<string | null>(null);
  const [missDayFeedback, setMissDayFeedback] = useState<string | null>(null);
  const [isSubmittingExercise, setIsSubmittingExercise] = useState(false);
  const [isSubmittingMissDay, setIsSubmittingMissDay] = useState(false);
  const [lastWeights, setLastWeights] = useState<Record<string, number>>({});
  const copy = WORKOUT_PLAN_I18N[language] || WORKOUT_PLAN_I18N.en;
  const isArabic = language === 'ar';

  const toLocalizedMuscleLabel = useCallback(
    (value: string) => (language === 'ar' ? (AR_MUSCLE_LABELS[value.trim().toLowerCase()] || value) : value),
    [language],
  );

  const toLocalizedDayLabel = useCallback(
    (value: string) => {
      if (language !== 'ar') return value;
      if (value.toLowerCase().includes('rest day')) return copy.restDayLabel;
      const key = normalizeWorkoutDayKey(value);
      return key ? (AR_DAY_LABELS[key] || value) : value;
    },
    [copy.restDayLabel, language],
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

  const headerTitleRaw = String(workoutDayLabel || workoutDay || copy.workout).trim() || copy.workout;
  const headerTitle = toLocalizedDayLabel(headerTitleRaw);
  const displayWorkoutName = toLocalizedDayLabel(String(workoutDay || copy.workout).trim() || copy.workout);

  const headerActions = (
    <div className="flex items-center gap-2">
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
            disabled={isRestDayView}
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
                          className="h-full w-full object-cover"
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
                      <h4 className="truncate text-sm font-semibold text-white">{stripExercisePrefix(exercise.name)}</h4>
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

      {exercises.length > 0 && (
        <div className="sticky bottom-4 pt-2">
          <button
            data-coachmark-target="workout_plan_start_button"
            type="button"
            onClick={() => nextExercise && onExerciseClick(nextExercise.name)}
            className="w-full rounded-2xl bg-accent px-5 py-4 text-sm font-bold uppercase tracking-[0.08em] text-black shadow-[0_10px_30px_rgba(191,255,0,0.22)] transition-colors hover:bg-[#aee600]"
          >
            {copy.startWorkout}
          </button>
        </div>
      )}
      </div>

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
                              <div className="truncate text-sm font-bold text-white">{stripExercisePrefix(exercise.name)}</div>
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
    </div>
  );
}
