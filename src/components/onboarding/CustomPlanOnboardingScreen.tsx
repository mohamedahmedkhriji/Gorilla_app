import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { getBodyPartImage } from '../../services/bodyPartTheme';
import { stripExercisePrefix } from '../../services/exerciseName';
import { resolveExerciseVideo } from '../../services/exerciseVideos';
import { localizeCustomPlanName } from '../../services/programI18n';
import { getOnboardingLanguage } from './onboardingI18n';
import { playMediaSafely } from '../../shared/mediaPlayback';

interface CustomPlanOnboardingScreenProps {
  onNext: () => void;
  onComplete?: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
  stepId?: string;
  userId?: number;
  persistOnboardingState?: boolean;
}

type ExerciseDraft = {
  exerciseName: string;
  exerciseCatalogId: number | null;
  sets: number;
  reps: string;
  restSeconds: number;
  targetWeight: number;
  targetMuscles: string[];
};

type DayPlanDraft = {
  workoutName: string;
  selectedMuscles: string[];
  musclesSaved: boolean;
  exercises: ExerciseDraft[];
};

type WeekPlanDraft = {
  dayPlans: Record<string, DayPlanDraft>;
};

type CatalogExercise = {
  id: number;
  name: string;
  muscle: string;
  bodyPart?: string | null;
};

type CatalogExerciseOption = CatalogExercise & {
  displayName: string;
  videoUrl: string | null;
  videoAssetName: string | null;
  videoMatchType: 'alias' | 'filename' | 'fallback' | 'none';
};

interface RawCatalogExercise {
  id?: number;
  name?: string;
  muscle?: string;
  bodyPart?: string | null;
}

type MuscleOption = {
  value: string;
  label: string;
  arabicLabel: string;
};

const WEEK_DAYS: Array<{ key: string; label: string }> = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

const DAY_LABELS_AR: Record<string, string> = {
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
  saturday: 'السبت',
  sunday: 'الأحد',
};

const DAY_LABELS_AR_SHORT: Record<string, string> = {
  monday: 'اثن',
  tuesday: 'ثلا',
  wednesday: 'أرب',
  thursday: 'خم',
  friday: 'جم',
  saturday: 'سبت',
  sunday: 'أحد',
};

const CLEAN_DAY_LABELS_AR: Record<string, string> = {
  monday: '\u0627\u0644\u0627\u062b\u0646\u064a\u0646',
  tuesday: '\u0627\u0644\u062b\u0644\u0627\u062b\u0627\u0621',
  wednesday: '\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621',
  thursday: '\u0627\u0644\u062e\u0645\u064a\u0633',
  friday: '\u0627\u0644\u062c\u0645\u0639\u0629',
  saturday: '\u0627\u0644\u0633\u0628\u062a',
  sunday: '\u0627\u0644\u0623\u062d\u062f',
};

const CLEAN_DAY_LABELS_AR_SHORT: Record<string, string> = {
  monday: '\u0627\u062b\u0646',
  tuesday: '\u062b\u0644\u0627',
  wednesday: '\u0623\u0631\u0628',
  thursday: '\u062e\u0645',
  friday: '\u062c\u0645',
  saturday: '\u0633\u0628\u062a',
  sunday: '\u0623\u062d\u062f',
};

const CUSTOM_PLAN_COPY_AR = {
  title: '\u0627\u0628\u0646\u0650 \u062e\u0637\u062a\u0643 \u0627\u0644\u0645\u062e\u0635\u0635\u0629',
  subtitle: '\u0623\u0646\u0634\u0626 \u0647\u064a\u0643\u0644 \u0623\u0633\u0628\u0648\u0639\u0643 \u0628\u0646\u0641\u0633\u0643. \u0633\u064a\u062d\u0641\u0638 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0627\u0644\u062e\u0637\u0629 \u0648\u064a\u0642\u062a\u0631\u062d \u062a\u062d\u0633\u064a\u0646\u0627\u062a \u0641\u0642\u0637.',
  planNameLabel: '\u0627\u0633\u0645 \u0627\u0644\u062e\u0637\u0629',
  planDurationLabel: '\u0627\u0644\u0645\u062f\u0629 (\u0623\u0633\u0627\u0628\u064a\u0639)',
  templateWeeksLabel: '\u0642\u0648\u0627\u0644\u0628 \u0627\u0644\u0623\u0633\u0627\u0628\u064a\u0639',
  chooseWeekLabel: '\u0627\u062e\u062a\u0631 \u0627\u0644\u0623\u0633\u0628\u0648\u0639',
  chooseMusclesLabel: '\u0627\u062e\u062a\u0631 1-3 \u0639\u0636\u0644\u0627\u062a',
  chooseMusclesHint: '\u0627\u062d\u0641\u0638 \u0627\u0644\u0639\u0636\u0644\u0627\u062a \u0623\u0648\u0644\u064b\u0627 \u062b\u0645 \u0623\u0636\u0641 \u0627\u0644\u062a\u0645\u0627\u0631\u064a\u0646 \u0644\u0647\u0630\u0627 \u0627\u0644\u064a\u0648\u0645.',
  saveMuscles: '\u062d\u0641\u0638 \u0627\u0644\u0639\u0636\u0644\u0627\u062a',
  editMuscles: '\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0639\u0636\u0644\u0627\u062a',
  savedMuscles: '\u0627\u0644\u0639\u0636\u0644\u0627\u062a \u0627\u0644\u0645\u062d\u0641\u0648\u0638\u0629',
  trainingDays: '\u0623\u064a\u0627\u0645 \u0627\u0644\u062a\u062f\u0631\u064a\u0628',
  createTemplates: '\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0642\u0648\u0627\u0644\u0628',
  savePlan: '\u062d\u0641\u0638 \u0627\u0644\u062e\u0637\u0629',
  savingPlan: '\u062c\u0627\u0631\u064d \u062d\u0641\u0638 \u0627\u0644\u062e\u0637\u0629...',
  sendToAiReview: '\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062e\u0637\u0629 \u0644\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a',
  addExercise: '\u0625\u0636\u0627\u0641\u0629 \u062a\u0645\u0631\u064a\u0646',
  workoutNamePlaceholder: '\u0627\u0633\u0645 \u0627\u0644\u062a\u0645\u0631\u064a\u0646',
  exerciseNamePlaceholder: '\u0627\u0633\u0645 \u0627\u0644\u062a\u0645\u0631\u064a\u0646',
  setsPlaceholder: '\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a',
  repsPlaceholder: '\u0627\u0644\u062a\u0643\u0631\u0627\u0631\u0627\u062a',
  restPlaceholder: '\u0627\u0644\u0631\u0627\u062d\u0629',
  removeExerciseTitle: '\u062d\u0630\u0641 \u0627\u0644\u062a\u0645\u0631\u064a\u0646',
  targets: '\u064a\u0633\u062a\u0647\u062f\u0641',
  saveContinue: '\u062d\u0641\u0638 \u0648\u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629',
  defaultPlanName: '\u062e\u0637\u062a\u064a \u0627\u0644\u0645\u062e\u0635\u0635\u0629',
  noMatch: '\u0644\u0627 \u062a\u0648\u062c\u062f \u062a\u0645\u0627\u0631\u064a\u0646 \u0645\u0637\u0627\u0628\u0642\u0629',
  general: '\u0639\u0627\u0645',
  selectDayError: '\u0627\u062e\u062a\u0631 \u064a\u0648\u0645 \u062a\u062f\u0631\u064a\u0628 \u0648\u0627\u062d\u062f\u064b\u0627 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644.',
  selectMusclesError: '\u0627\u062e\u062a\u0631 \u0645\u0646 1 \u0625\u0644\u0649 3 \u0639\u0636\u0644\u0627\u062a \u0648\u0627\u062d\u0641\u0638\u0647\u0627 \u0642\u0628\u0644 \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u062a\u0645\u0627\u0631\u064a\u0646.',
  invalidPlan: '\u062e\u0637\u0629 \u0645\u062e\u0635\u0635\u0629 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d\u0629.',
  missingUserSession: '\u0644\u0627 \u062a\u0648\u062c\u062f \u062c\u0644\u0633\u0629 \u0645\u0633\u062a\u062e\u062f\u0645 \u0635\u0627\u0644\u062d\u0629. \u064a\u0631\u062c\u0649 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.',
} as const;

const MUSCLE_OPTIONS: MuscleOption[] = [
  { value: 'Chest', label: 'Chest', arabicLabel: 'الصدر' },
  { value: 'Back', label: 'Back', arabicLabel: 'الظهر' },
  { value: 'Shoulders', label: 'Shoulders', arabicLabel: 'الأكتاف' },
  { value: 'Biceps', label: 'Biceps', arabicLabel: 'البايسبس' },
  { value: 'Triceps', label: 'Triceps', arabicLabel: 'الترايسبس' },
  { value: 'Forearms', label: 'Forearms', arabicLabel: 'الساعد' },
  { value: 'Quadriceps', label: 'Quadriceps', arabicLabel: 'الرباعية' },
  { value: 'Hamstrings', label: 'Hamstrings', arabicLabel: 'الخلفية' },
  { value: 'Glutes', label: 'Glutes', arabicLabel: 'الأرداف' },
  { value: 'Calves', label: 'Calves', arabicLabel: 'السمانة' },
  { value: 'Abs', label: 'Abs', arabicLabel: 'البطن' },
];

const MUSCLE_OPTION_MAP = new Map(MUSCLE_OPTIONS.map((option) => [option.value.toLowerCase(), option.value]));
const MAX_EXERCISES_PER_DAY = 7;
const MIN_EXERCISES_PER_DAY = 5;

const MUSCLE_MATCH_ALIASES: Record<string, string[]> = {
  Chest: ['chest', 'pec', 'pect'],
  Back: ['back', 'lat', 'lats', 'trap', 'traps', 'rhomboid'],
  Shoulders: ['shoulder', 'shoulders', 'delt', 'delts'],
  Biceps: ['bicep', 'biceps', 'brachialis'],
  Triceps: ['tricep', 'triceps'],
  Forearms: ['forearm', 'forearms', 'grip', 'wrist'],
  Quadriceps: ['quadricep', 'quadriceps', 'quad', 'quads'],
  Hamstrings: ['hamstring', 'hamstrings'],
  Glutes: ['glute', 'glutes'],
  Calves: ['calf', 'calves'],
  Abs: ['abs', 'abdom', 'core', 'oblique'],
};

const normalizeLookupValue = (value: unknown) => (
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
);

const normalizeSelectedMuscles = (value: unknown) => {
  const incoming = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : [];

  return [...new Set(
    incoming
      .map((entry) => MUSCLE_OPTION_MAP.get(String(entry || '').trim().toLowerCase()) || '')
      .filter(Boolean),
  )].slice(0, 3);
};

const toTrainingDays = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4;
  return Math.max(2, Math.min(6, Math.round(parsed)));
};

const createDefaultExercise = (overrides: Partial<ExerciseDraft> = {}): ExerciseDraft => ({
  exerciseName: '',
  exerciseCatalogId: null,
  sets: 3,
  reps: '8-12',
  restSeconds: 90,
  targetWeight: 20,
  targetMuscles: [],
  ...overrides,
});

const createDefaultDayPlan = (
  dayKey: string,
  workoutName?: string,
  selectedMuscles: string[] = [],
  musclesSaved = false,
): DayPlanDraft => ({
  workoutName: workoutName || `${dayKey.charAt(0).toUpperCase()}${dayKey.slice(1)} Workout`,
  selectedMuscles,
  musclesSaved,
  exercises: [],
});

const createInitialDays = (trainingDays: number) => {
  return WEEK_DAYS.slice(0, trainingDays).map((entry) => entry.key);
};

const buildEmptyDayPlans = (getDefaultWorkoutName: (dayKey: string) => string) => {
  const next: Record<string, DayPlanDraft> = {};
  WEEK_DAYS.forEach((day) => {
    next[day.key] = createDefaultDayPlan(day.key, getDefaultWorkoutName(day.key));
  });
  return next;
};

const buildDayPlansFromWorkouts = (
  workouts: unknown[],
  getDefaultWorkoutName: (dayKey: string) => string,
) => {
  const fromPayload = new Map<string, DayPlanDraft>();
  const payloadWorkouts = Array.isArray(workouts) ? workouts : [];

  payloadWorkouts.forEach((workout: any) => {
    const dayName = String(workout?.dayName || '').trim().toLowerCase();
    if (!dayName) return;
    const selectedMuscles = normalizeSelectedMuscles(
      workout?.targetMuscles
      ?? workout?.muscles
      ?? workout?.muscleGroup
      ?? [],
    );
    const rawExercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
    const normalizedExercises = rawExercises
      .map((exercise: any) => ({
        exerciseName: stripExercisePrefix(String(exercise?.exerciseName || exercise?.name || '').trim()),
        exerciseCatalogId: Number(exercise?.exerciseCatalogId || 0) || null,
        sets: Math.max(1, Math.min(10, Number(exercise?.sets || 3))),
        reps: String(exercise?.reps || '8-12').trim().slice(0, 20) || '8-12',
        restSeconds: Math.max(30, Math.min(600, Number(exercise?.restSeconds || exercise?.rest || 90))),
        targetWeight: Math.max(0, Math.min(1000, Number(exercise?.targetWeight ?? exercise?.weightKg ?? exercise?.weight ?? 20) || 20)),
        targetMuscles: normalizeSelectedMuscles(
          exercise?.targetMuscles
          ?? exercise?.muscleGroup
          ?? exercise?.targetMuscle
          ?? selectedMuscles[0]
          ?? [],
        ),
      }))
      .filter((exercise: ExerciseDraft) => exercise.exerciseName.length > 0 || Boolean(exercise.exerciseCatalogId));

    fromPayload.set(dayName, {
      workoutName: String(workout?.workoutName || `${dayName} workout`).trim(),
      selectedMuscles,
      musclesSaved: selectedMuscles.length > 0,
      exercises: normalizedExercises,
    });
  });

  const nextPlans: Record<string, DayPlanDraft> = {};
  WEEK_DAYS.forEach((day) => {
    nextPlans[day.key] = fromPayload.get(day.key) || createDefaultDayPlan(day.key, getDefaultWorkoutName(day.key));
  });
  return nextPlans;
};

const toValidDays = (days: unknown[]): string[] => {
  const valid = new Set(WEEK_DAYS.map((entry) => entry.key));
  return [...new Set(days.map((day) => String(day || '').trim().toLowerCase()).filter((day) => valid.has(day)))];
};

export function CustomPlanOnboardingScreen({
  onNext,
  onComplete,
  onDataChange,
  onboardingData,
  stepId,
  userId,
  persistOnboardingState = true,
}: CustomPlanOnboardingScreenProps) {
  const language = getOnboardingLanguage();
  const isArabic = language === 'ar';
  const isTemplateStage = stepId === 'custom_plan_builder' || stepId === 'custom_plan_templates';
  const copy = isArabic
    ? {
        title: 'ابنِ خطتك المخصصة',
        subtitle: 'أنشئ هيكل أسبوعك بنفسك. سيحفظ الذكاء الاصطناعي الخطة ويقترح تحسينات فقط.',
        planNameLabel: 'اسم الخطة',
        planDurationLabel: 'المدة (أسابيع)',
        templateWeeksLabel: 'قوالب الأسابيع',
        chooseWeekLabel: 'اختر الأسبوع',
        chooseMusclesLabel: 'اختر 1-3 عضلات',
        chooseMusclesHint: 'احفظ العضلات أولًا ثم أضف التمارين لهذا اليوم.',
        saveMuscles: 'حفظ العضلات',
        editMuscles: 'تعديل العضلات',
        savedMuscles: 'العضلات المحفوظة',
        trainingDays: 'أيام التدريب',
        createTemplates: 'إنشاء القوالب',
        savePlan: 'حفظ الخطة',
        savingPlan: 'جارٍ حفظ الخطة...',
        addExercise: 'إضافة تمرين',
        workoutNamePlaceholder: 'اسم التمرين',
        exerciseNamePlaceholder: 'اسم التمرين',
        setsPlaceholder: 'المجموعات',
        repsPlaceholder: 'التكرارات',
        restPlaceholder: 'الراحة',
        removeExerciseTitle: 'حذف التمرين',
        targets: 'يستهدف',
        saveContinue: 'حفظ والمتابعة',
        defaultPlanName: 'خطتي المخصصة',
        noMatch: 'لا توجد تمارين مطابقة',
        general: 'عام',
        selectDayError: 'اختر يوم تدريب واحدًا على الأقل.',
        selectMusclesError: 'اختر من 1 إلى 3 عضلات واحفظها قبل إضافة التمارين.',
        invalidPlan: 'خطة مخصصة غير صالحة.',
      }
    : {
        title: 'Build your customized plan',
        subtitle: 'Create your own weekly structure. AI will keep this plan and only provide suggestions to improve it.',
        planNameLabel: 'Plan Name',
        planDurationLabel: 'Duration (Weeks)',
        templateWeeksLabel: 'Template Weeks',
        chooseWeekLabel: 'Choose week',
        chooseMusclesLabel: 'Choose 1-3 muscles',
        chooseMusclesHint: 'Save the muscles first, then start adding exercises for this day.',
        saveMuscles: 'Save muscles',
        editMuscles: 'Edit muscles',
        savedMuscles: 'Saved muscles',
        trainingDays: 'Training Days',
        createTemplates: 'Create templates',
        savePlan: 'Save Plan',
        savingPlan: 'Saving plan...',
        addExercise: 'Add Exercise',
        workoutNamePlaceholder: 'Workout name',
        exerciseNamePlaceholder: 'Exercise name',
        setsPlaceholder: 'Sets',
        repsPlaceholder: 'Reps',
        restPlaceholder: 'Rest',
        removeExerciseTitle: 'Remove exercise',
        targets: 'Targets',
        saveContinue: 'Save And Continue',
        defaultPlanName: 'My Custom Plan',
        noMatch: 'No matching exercise',
        general: 'General',
        selectDayError: 'Select at least one training day.',
        selectMusclesError: 'Choose 1 to 3 muscles and save them before adding exercises.',
        invalidPlan: 'Invalid custom plan.',
        missingUserSession: 'No active user session found. Please login again.',
      };

  const uiCopy = isArabic ? CUSTOM_PLAN_COPY_AR : copy;
  const resolvePlanName = useCallback((value: unknown) => {
    const localizedName = localizeCustomPlanName(value, language).trim();
    return localizedName || uiCopy.defaultPlanName;
  }, [language, uiCopy.defaultPlanName]);

  const capitalize = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  const getDayLabel = useCallback((dayKey: string, variant: 'short' | 'full' = 'short') => {
    if (isArabic) {
      return variant === 'short'
        ? (CLEAN_DAY_LABELS_AR_SHORT[dayKey] || DAY_LABELS_AR_SHORT[dayKey] || dayKey)
        : (CLEAN_DAY_LABELS_AR[dayKey] || DAY_LABELS_AR[dayKey] || dayKey);
    }
    if (variant === 'short') {
      return WEEK_DAYS.find((entry) => entry.key === dayKey)?.label || capitalize(dayKey);
    }
    return capitalize(dayKey);
  }, [isArabic]);
  const resolvedDefaultWorkoutName = useCallback(
    (dayKey: string) =>
      isArabic ? `\u062a\u0645\u0631\u064a\u0646 ${getDayLabel(dayKey, 'full')}` : `${capitalize(dayKey)} Workout`,
    [getDayLabel, isArabic],
  );
  const trainingDays = toTrainingDays(onboardingData?.workoutDays);
  const existing = onboardingData?.customPlan || {};
  const durationOptions = [6, 8, 12, 16] as const;
  const normalizedTemplateWeekCount = Math.max(
    1,
    Math.min(
      2,
      Number(
        existing.templateWeekCount
          || (Array.isArray(existing.weekPlans) && existing.weekPlans.length > 1 ? 2 : 1),
      ) || 1,
    ),
  );
  const normalizedCycleWeeks = durationOptions.reduce((best, option) => {
    const existingWeeks = Number(existing.cycleWeeks || 6);
    if (!Number.isFinite(existingWeeks)) return best;
    return Math.abs(option - existingWeeks) < Math.abs(best - existingWeeks) ? option : best;
  }, durationOptions[0]);

  const defaultSelectedDays = useMemo(
    () => (
      Array.isArray(existing.selectedDays) && toValidDays(existing.selectedDays).length
        ? toValidDays(existing.selectedDays)
        : createInitialDays(trainingDays)
    ),
    [existing.selectedDays, trainingDays],
  );

  const [planName, setPlanName] = useState<string>(
    resolvePlanName(existing.planName || uiCopy.defaultPlanName),
  );
  const [cycleWeeks, setCycleWeeks] = useState<number>(
    normalizedCycleWeeks,
  );
  const [templateWeekCount, setTemplateWeekCount] = useState<number>(normalizedTemplateWeekCount);
  const [selectedDays, setSelectedDays] = useState<string[]>(defaultSelectedDays);
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [expandedMusclePickers, setExpandedMusclePickers] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string>('');
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  useEffect(() => {
    setPlanName((current) => {
      const nextPlanName = resolvePlanName(current);
      return nextPlanName === current ? current : nextPlanName;
    });
  }, [resolvePlanName]);

  const advanceToNextStep = () => {
    if (typeof window !== 'undefined') {
      window.setTimeout(() => onNext(), 0);
      return;
    }
    onNext();
  };
  const finishFlow = () => {
    if (onComplete) {
      onComplete();
      return;
    }
    advanceToNextStep();
  };

  const initialDayPlans = useMemo(() => buildDayPlansFromWorkouts(
    existing.weeklyWorkouts || existing.workouts || [],
    resolvedDefaultWorkoutName,
  ), [existing.weeklyWorkouts, existing.workouts, resolvedDefaultWorkoutName]);

  const initialWeekPlans = useMemo<WeekPlanDraft[]>(() => {
    const weekPlanPayload = Array.isArray(existing.weekPlans) ? existing.weekPlans : [];
    const weekTemplateCount = 2;
    if (weekPlanPayload.length > 0) {
      return Array.from({ length: weekTemplateCount }, (_unused, index) => {
        const payload = weekPlanPayload[index] || weekPlanPayload[weekPlanPayload.length - 1] || {};
        return {
          dayPlans: buildDayPlansFromWorkouts(
            payload.weeklyWorkouts || payload.workouts || [],
            resolvedDefaultWorkoutName,
          ),
        };
      });
    }

    return Array.from({ length: weekTemplateCount }, (_unused, index) => ({
      dayPlans: index === 0
        ? initialDayPlans
        : buildDayPlansFromWorkouts(existing.weeklyWorkouts || existing.workouts || [], resolvedDefaultWorkoutName),
    }));
  }, [existing.weekPlans, existing.weeklyWorkouts, existing.workouts, resolvedDefaultWorkoutName, initialDayPlans, normalizedCycleWeeks]);

  const [weekPlans, setWeekPlans] = useState<WeekPlanDraft[]>(initialWeekPlans);
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);

  useEffect(() => {
    setWeekPlans((prev) => {
      const next = [...prev];
      while (next.length < 2) {
        next.push({ dayPlans: buildEmptyDayPlans(resolvedDefaultWorkoutName) });
      }
      return next.slice(0, 2);
    });
    setActiveWeekIndex((prev) => Math.min(prev, templateWeekCount - 1));
  }, [resolvedDefaultWorkoutName, templateWeekCount]);

  const activeWeekPlan = weekPlans[activeWeekIndex] || weekPlans[0] || { dayPlans: buildEmptyDayPlans(resolvedDefaultWorkoutName) };
  const resolvedUserId = useMemo(() => {
    const fromProp = Number(userId || 0);
    if (Number.isFinite(fromProp) && fromProp > 0) return fromProp;

    if (typeof window === 'undefined') return 0;

    const localUser = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    return Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || localUser?.id || 0);
  }, [userId]);

  const catalogOptions = useMemo<CatalogExerciseOption[]>(() => (
    catalog
      .map((exercise) => {
        const videoMatch = resolveExerciseVideo({
          name: exercise.name,
          muscle: exercise.muscle,
          bodyPart: exercise.bodyPart,
        });
        const hasTrustedVideo = videoMatch.matchType === 'alias' || videoMatch.matchType === 'filename';
        return {
          ...exercise,
          displayName: stripExercisePrefix(exercise.name),
          videoUrl: hasTrustedVideo ? videoMatch.url : null,
          videoAssetName: hasTrustedVideo ? videoMatch.assetName : null,
          videoMatchType: videoMatch.matchType,
        };
      })
      .filter((exercise) => exercise.displayName.length > 0)
  ), [catalog]);

  useEffect(() => {
    let cancelled = false;

    const loadCatalog = async () => {
      try {
        const catalogRes = await api.getExerciseCatalog('All', '', 500);
        if (cancelled) return;
        const nextCatalog = Array.isArray(catalogRes?.exercises)
          ? (catalogRes.exercises as RawCatalogExercise[])
            .map((exercise) => ({
              id: Number(exercise.id || 0),
              name: String(exercise.name || '').trim(),
              muscle: String(exercise.muscle || '').trim(),
              bodyPart: exercise.bodyPart ? String(exercise.bodyPart).trim() : null,
            }))
            .filter((exercise) => exercise.id > 0 && exercise.name.length > 0)
          : [];
        setCatalog(nextCatalog);
      } catch (e) {
        if (!cancelled) {
          console.error('Failed to load exercise catalog for onboarding custom plan:', e);
        }
      }
    };

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateActiveWeekDayPlans = (updater: (current: Record<string, DayPlanDraft>) => Record<string, DayPlanDraft>) => {
    setWeekPlans((prev) => {
      const next = [...prev];
      const current = next[activeWeekIndex]?.dayPlans || buildEmptyDayPlans(resolvedDefaultWorkoutName);
      next[activeWeekIndex] = {
        dayPlans: updater(current),
      };
      return next;
    });
  };

  const getLocalizedMuscleLabel = useCallback(
    (muscle: string) => {
      const option = MUSCLE_OPTIONS.find((entry) => entry.value === muscle);
      if (!option) return muscle;
      return isArabic ? option.arabicLabel : option.label;
    },
    [isArabic],
  );

  const getDayNumber = useCallback(
    (dayKey: string) => {
      const index = selectedDays.indexOf(dayKey);
      return index >= 0 ? index + 1 : 1;
    },
    [selectedDays],
  );

  const getPlanCardLabel = useCallback(
    (dayKey: string) => {
      const dayNumber = getDayNumber(dayKey);
      return isArabic ? `اليوم ${dayNumber}` : `Day ${dayNumber}`;
    },
    [getDayNumber, isArabic],
  );

  const getMusclePickerKey = useCallback(
    (dayKey: string) => `${activeWeekIndex}-${dayKey}`,
    [activeWeekIndex],
  );

  const doesExerciseMatchMuscle = useCallback((exercise: Pick<CatalogExercise, 'muscle' | 'bodyPart'>, muscle: string) => {
    const haystack = `${normalizeLookupValue(exercise.muscle)} ${normalizeLookupValue(exercise.bodyPart)}`.trim();
    if (!haystack) return false;

    const aliases = MUSCLE_MATCH_ALIASES[muscle] || [normalizeLookupValue(muscle)];
    return aliases.some((alias) => haystack.includes(alias));
  }, []);

  const getMuscleExerciseOptions = useCallback((muscle: string) => {
    const matched = catalogOptions.filter((exercise) => doesExerciseMatchMuscle(exercise, muscle));
    const deduped = new Map<string, CatalogExerciseOption>();

    matched.forEach((exercise) => {
      const dedupeKey = exercise.videoAssetName
        ? `video:${exercise.videoAssetName.toLowerCase()}`
        : `name:${stripExercisePrefix(exercise.displayName).toLowerCase()}`;
      const existing = deduped.get(dedupeKey);
      if (!existing) {
        deduped.set(dedupeKey, exercise);
        return;
      }

      const currentScore = Number(Boolean(exercise.videoUrl)) * 1000 + exercise.displayName.length;
      const existingScore = Number(Boolean(existing.videoUrl)) * 1000 + existing.displayName.length;
      if (currentScore > existingScore) {
        deduped.set(dedupeKey, exercise);
      }
    });

    const ordered = [...deduped.values()].sort((left, right) => {
      const leftVideo = Number(Boolean(left.videoUrl));
      const rightVideo = Number(Boolean(right.videoUrl));
      if (leftVideo !== rightVideo) return rightVideo - leftVideo;
      return left.displayName.localeCompare(right.displayName);
    });

    return ordered.slice(0, 18);
  }, [catalogOptions, doesExerciseMatchMuscle]);

  const getExerciseMatchKey = useCallback((exercise: Pick<ExerciseDraft, 'exerciseCatalogId' | 'exerciseName'> | Pick<CatalogExerciseOption, 'id' | 'name'>) => {
    const catalogId = 'exerciseCatalogId' in exercise
      ? Number(exercise.exerciseCatalogId || 0)
      : Number(exercise.id || 0);
    if (catalogId > 0) return `catalog:${catalogId}`;
    const name = 'exerciseName' in exercise ? exercise.exerciseName : exercise.name;
    return `name:${stripExercisePrefix(String(name || '').trim()).toLowerCase()}`;
  }, []);

  const getSelectedExercisesForMuscle = useCallback((dayPlan: DayPlanDraft, muscle: string) => (
    dayPlan.exercises.filter((exercise) => normalizeSelectedMuscles(exercise.targetMuscles).includes(muscle))
  ), []);

  const isExerciseSelectedForMuscle = useCallback((dayPlan: DayPlanDraft, muscle: string, exercise: CatalogExerciseOption) => {
    const matchKey = getExerciseMatchKey(exercise);
    return getSelectedExercisesForMuscle(dayPlan, muscle).some((entry) => getExerciseMatchKey(entry) === matchKey);
  }, [getExerciseMatchKey, getSelectedExercisesForMuscle]);

  const toggleExerciseSelection = (dayKey: string, muscle: string, exercise: CatalogExerciseOption) => {
    setError('');
    updateActiveWeekDayPlans((prev) => {
      const currentPlan = prev[dayKey];
      const matchKey = getExerciseMatchKey(exercise);
      const existingIndex = currentPlan.exercises.findIndex((entry) => (
        normalizeSelectedMuscles(entry.targetMuscles).includes(muscle)
        && getExerciseMatchKey(entry) === matchKey
      ));

      if (existingIndex >= 0) {
        return {
          ...prev,
          [dayKey]: {
            ...currentPlan,
            exercises: currentPlan.exercises.filter((_entry, index) => index !== existingIndex),
          },
        };
      }

      if (currentPlan.exercises.length >= MAX_EXERCISES_PER_DAY) {
        return prev;
      }

      return {
        ...prev,
        [dayKey]: {
          ...currentPlan,
          exercises: [
            ...currentPlan.exercises,
            createDefaultExercise({
              exerciseName: stripExercisePrefix(exercise.name),
              exerciseCatalogId: exercise.id,
              targetMuscles: [muscle],
            }),
          ],
        },
      };
    });
  };

  const toggleMuscleSelection = (dayKey: string, muscle: string) => {
    updateActiveWeekDayPlans((prev) => {
      const currentPlan = prev[dayKey];
      const alreadySelected = currentPlan.selectedMuscles.includes(muscle);
      const nextSelectedMuscles = alreadySelected
        ? currentPlan.selectedMuscles.filter((entry) => entry !== muscle)
        : currentPlan.selectedMuscles.length < 3
          ? [...currentPlan.selectedMuscles, muscle]
          : currentPlan.selectedMuscles;
      const removedMuscles = currentPlan.selectedMuscles.filter((entry) => !nextSelectedMuscles.includes(entry));

      return {
        ...prev,
        [dayKey]: {
          ...currentPlan,
          selectedMuscles: nextSelectedMuscles,
          exercises: removedMuscles.length
            ? currentPlan.exercises.filter((exercise) => {
                const targets = normalizeSelectedMuscles(exercise.targetMuscles);
                return !targets.some((entry) => removedMuscles.includes(entry));
              })
            : currentPlan.exercises,
        },
      };
    });
    setExpandedMusclePickers((prev) => ({
      ...prev,
      [getMusclePickerKey(dayKey)]: false,
    }));
  };

  const openMusclePicker = (dayKey: string) => {
    setExpandedMusclePickers((prev) => ({
      ...prev,
      [getMusclePickerKey(dayKey)]: true,
    }));
  };

  const saveDayMuscles = (dayKey: string) => {
    const currentPlan = activeWeekPlan.dayPlans[dayKey];
    if (!currentPlan || currentPlan.selectedMuscles.length < 1 || currentPlan.selectedMuscles.length > 3) {
      setError(uiCopy.selectMusclesError);
      return;
    }

    setError('');
    updateActiveWeekDayPlans((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        workoutName: getPlanCardLabel(dayKey),
        musclesSaved: true,
        exercises: prev[dayKey].exercises.filter((exercise) => (
          normalizeSelectedMuscles(exercise.targetMuscles).some((muscle) => prev[dayKey].selectedMuscles.includes(muscle))
        )),
      },
    }));
  };

  const editDayMuscles = (dayKey: string) => {
    updateActiveWeekDayPlans((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        musclesSaved: false,
      },
    }));
    setExpandedMusclePickers((prev) => ({
      ...prev,
      [getMusclePickerKey(dayKey)]: true,
    }));
  };

  useEffect(() => {
    const weekPayloads = weekPlans.slice(0, templateWeekCount).map((week) => ({
      weeklyWorkouts: selectedDays.map((dayName) => {
        const fallbackName = getPlanCardLabel(dayName);
        const plan = week.dayPlans[dayName] || createDefaultDayPlan(dayName, fallbackName);
        return {
          dayName,
          workoutName: String(plan.workoutName || fallbackName).trim() || fallbackName,
          workoutType: 'Custom',
          targetMuscles: plan.selectedMuscles,
          exercises: plan.exercises.map((exercise) => ({
            exerciseName: stripExercisePrefix(String(exercise.exerciseName || '').trim()),
            exerciseCatalogId: Number(exercise.exerciseCatalogId || 0) || null,
            sets: Math.max(1, Math.min(10, Math.round(Number(exercise.sets || 3)))),
            reps: String(exercise.reps || '8-12').trim().slice(0, 20) || '8-12',
            restSeconds: Math.max(30, Math.min(600, Math.round(Number(exercise.restSeconds || 90)))),
            targetWeight: Math.max(0, Math.min(1000, Number(exercise.targetWeight || 20))),
            targetMuscles: normalizeSelectedMuscles(exercise.targetMuscles),
          })),
        };
      }),
    }));

    onDataChange?.({
      customPlan: {
        planName: resolvePlanName(planName),
        cycleWeeks: Math.max(6, Math.min(16, Math.round(Number(cycleWeeks || 6)))),
        templateWeekCount,
        selectedDays,
        weeklyWorkouts: weekPayloads[0]?.weeklyWorkouts || [],
        weekPlans: weekPayloads,
      },
    });
  }, [cycleWeeks, templateWeekCount, weekPlans, onDataChange, planName, selectedDays, getPlanCardLabel, resolvePlanName]);

  const buildWeekPayloads = useCallback(
    (weeks: WeekPlanDraft[]) => weeks.slice(0, templateWeekCount).map((week) => buildValidatedWeekPayload(week)),
    [templateWeekCount, selectedDays, uiCopy.selectMusclesError, getPlanCardLabel, getDayLabel, isArabic],
  );

  const buildCustomPlanPayload = useCallback(
    (weekPayloads: Array<{ weeklyWorkouts: any[] }>) => ({
      planName: resolvePlanName(planName),
      cycleWeeks: Math.max(6, Math.min(16, Math.round(Number(cycleWeeks || 6)))),
      templateWeekCount,
      selectedDays,
      weeklyWorkouts: weekPayloads[0]?.weeklyWorkouts || [],
      weekPlans: weekPayloads,
    }),
    [cycleWeeks, planName, resolvePlanName, selectedDays, templateWeekCount],
  );

  const buildValidatedWeekPayload = (week: WeekPlanDraft) => ({
    weeklyWorkouts: selectedDays.map((dayName) => {
      const plan = week.dayPlans[dayName];
      const fallbackName = getPlanCardLabel(dayName);
      const selectedMuscles = normalizeSelectedMuscles(plan.selectedMuscles);

      if (!plan.musclesSaved || !selectedMuscles.length || selectedMuscles.length > 3) {
        throw new Error(uiCopy.selectMusclesError);
      }

      const cleanedExercises = plan.exercises
        .map((exercise) => ({
          exerciseName: stripExercisePrefix(String(exercise.exerciseName || '').trim()),
          exerciseCatalogId: Number(exercise.exerciseCatalogId || 0) || null,
          sets: Math.max(1, Math.min(10, Math.round(Number(exercise.sets || 3)))),
          reps: String(exercise.reps || '8-12').trim().slice(0, 20) || '8-12',
          restSeconds: Math.max(30, Math.min(600, Math.round(Number(exercise.restSeconds || 90)))),
          targetWeight: Math.max(0, Math.min(1000, Number(exercise.targetWeight || 20))),
          targetMuscles: normalizeSelectedMuscles(exercise.targetMuscles),
        }))
        .filter((exercise) => exercise.exerciseName.length > 0 || Boolean(exercise.exerciseCatalogId));

      if (!cleanedExercises.length) {
        const label = getDayLabel(dayName, 'full');
        throw new Error(isArabic ? `أضف تمرينًا واحدًا على الأقل ليوم ${label}.` : `Add at least one exercise for ${label}.`);
      }

      if (cleanedExercises.length < MIN_EXERCISES_PER_DAY || cleanedExercises.length > MAX_EXERCISES_PER_DAY) {
        throw new Error(
          isArabic
            ? `اختر من ${MIN_EXERCISES_PER_DAY} إلى ${MAX_EXERCISES_PER_DAY} تمارين لهذا اليوم.`
            : `Choose ${MIN_EXERCISES_PER_DAY}-${MAX_EXERCISES_PER_DAY} exercises for this day.`,
        );
      }

      return {
        dayName,
        workoutName: String(plan.workoutName || fallbackName).trim() || fallbackName,
        workoutType: 'Custom',
        targetMuscles: selectedMuscles,
        exercises: cleanedExercises,
      };
    }),
  });

  const handleContinue = async () => {
    setError('');
    if (!selectedDays.length) {
      setError(uiCopy.selectDayError);
      return;
    }

    if (!isTemplateStage) {
      onDataChange?.({
        customPlan: {
          planName: resolvePlanName(planName),
          cycleWeeks: Math.max(6, Math.min(16, Math.round(Number(cycleWeeks || 6)))),
          templateWeekCount,
          selectedDays,
        },
      });
      advanceToNextStep();
      return;
    }

    try {
      if (templateWeekCount > 1 && activeWeekIndex < templateWeekCount - 1) {
        buildValidatedWeekPayload(activeWeekPlan);
        setActiveWeekIndex((prev) => Math.min(prev + 1, templateWeekCount - 1));
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }

      const weekPayloads = buildWeekPayloads(weekPlans);
      const customPlanPayload = buildCustomPlanPayload(weekPayloads);

      onDataChange?.({
        customPlan: customPlanPayload,
      });

      if (!Number.isFinite(resolvedUserId) || resolvedUserId <= 0) {
        setError(uiCopy.missingUserSession);
        return;
      }

      setIsSavingPlan(true);
      try {
        if (persistOnboardingState) {
          await api.saveOnboarding(Number(resolvedUserId || 0), {
            ...(onboardingData || {}),
            customPlan: null,
            language,
            useClaude: false,
            disableClaude: true,
          });
        }

        const response = await api.saveCustomProgram(Number(resolvedUserId || 0), customPlanPayload);

        if (typeof window !== 'undefined') {
          const repeatedWeekPlans = Array.from(
            { length: Math.max(1, Number(customPlanPayload.cycleWeeks || 1)) },
            (_unused, index) => weekPayloads[index % weekPayloads.length] || weekPayloads[0],
          );

          if (response?.assignedProgram) {
            localStorage.setItem('assignedProgramTemplate', JSON.stringify({
              ...response.assignedProgram,
              templateWeekCount: customPlanPayload.templateWeekCount,
              templateWeekPlans: weekPayloads,
              repeatedWeekPlans,
            }));
          }
          if (persistOnboardingState) {
            localStorage.removeItem('onboardingCustomAdvice');
            localStorage.removeItem('onboardingPlanWarning');
          }
        }
      } finally {
        setIsSavingPlan(false);
      }

      finishFlow();
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : uiCopy.invalidPlan);
    }
  };

  const getCycleDurationLabel = (option: number) => {
    if (!isArabic) {
      return option === 16 ? '16+ Weeks' : `${option} Weeks`;
    }
    if (option === 12) return '12 \u0623\u0633\u0628\u0648\u0639\u064b\u0627';
    if (option === 16) return '16+ \u0623\u0633\u0628\u0648\u0639';
    return `${option} \u0623\u0633\u0627\u0628\u064a\u0639`;
  };

  const getTemplateWeekLabel = (option: number) => (
    isArabic ? `${option} \u0623\u0633\u0628\u0648\u0639` : `${option} Week${option > 1 ? 's' : ''}`
  );

  const getWeekTabLabel = (option: number) => (
    isArabic ? `\u0627\u0644\u0623\u0633\u0628\u0648\u0639 ${option}` : `Week ${option}`
  );

  const getExercisePickerLabel = (muscle: string) => (
    isArabic ? `تمارين ${getLocalizedMuscleLabel(muscle)}` : `${getLocalizedMuscleLabel(muscle)} Exercises`
  );

  const getExercisePickerHint = (count: number) => (
    isArabic
      ? `اختر من ${MIN_EXERCISES_PER_DAY} إلى ${MAX_EXERCISES_PER_DAY} تمارين لهذا اليوم. المحدد الآن ${count}/${MAX_EXERCISES_PER_DAY}.`
      : `Pick ${MIN_EXERCISES_PER_DAY}-${MAX_EXERCISES_PER_DAY} exercises for this day. Selected ${count}/${MAX_EXERCISES_PER_DAY}.`
  );

  const defaultExerciseSettingsCopy = isArabic
    ? 'كل تمرين يُحفظ تلقائيًا بـ 3 مجموعات، 8-12 تكرار، و20 كجم كبداية.'
    : 'Each exercise is saved with 3 sets, 8-12 reps, and 20 kg by default.';

  const noExercisesForMuscleCopy = isArabic
    ? 'لا توجد تمارين جاهزة لهذه العضلة الآن.'
    : 'No ready exercises found for this muscle yet.';

  const selectedExerciseBadgeCopy = isArabic ? 'تم الاختيار' : 'Selected';
  const videoBadgeCopy = isArabic ? 'فيديو' : 'Video';
  const noVideoBadgeCopy = isArabic ? 'بدون فيديو' : 'No Video';
  const isCurrentWeekComplete = useMemo(() => {
    if (!isTemplateStage) return true;
    try {
      buildValidatedWeekPayload(activeWeekPlan);
      return true;
    } catch {
      return false;
    }
  }, [activeWeekPlan, isTemplateStage, selectedDays, uiCopy.selectMusclesError, getPlanCardLabel, getDayLabel, isArabic]);
  const primaryButtonLabel = isTemplateStage
    ? (templateWeekCount > 1 && activeWeekIndex < templateWeekCount - 1
      ? (isArabic ? `الانتقال إلى الأسبوع ${activeWeekIndex + 2}` : `Continue to Week ${activeWeekIndex + 2}`)
      : (isSavingPlan ? uiCopy.savingPlan : uiCopy.savePlan))
    : uiCopy.createTemplates;

  return (
    <div className="flex-1 flex flex-col space-y-5">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">{uiCopy.title}</h2>
        <p className="text-text-secondary">{uiCopy.subtitle}</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {!isTemplateStage && (
        <div className="rounded-2xl border border-white/10 bg-card/70 p-4 space-y-3">
        <label className="block">
          <span className="text-xs uppercase text-text-secondary">{uiCopy.planNameLabel}</span>
          <input
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent/60"
            maxLength={255}
          />
        </label>
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-xs uppercase text-text-secondary">{uiCopy.planDurationLabel}</span>
              <div className="grid grid-cols-2 gap-2">
                {durationOptions.map((option) => {
                  const active = cycleWeeks === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setCycleWeeks(option)}
                      className={`rounded-lg border py-2 text-sm transition-colors ${
                        active
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-white/10 bg-background text-text-secondary hover:text-white'
                      }`}
                    >
                      {getCycleDurationLabel(option)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs uppercase text-text-secondary">{uiCopy.templateWeeksLabel}</span>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2].map((option) => {
                  const active = templateWeekCount === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setTemplateWeekCount(option)}
                      className={`rounded-lg border py-2 text-sm transition-colors ${
                        active
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-white/10 bg-background text-text-secondary hover:text-white'
                      }`}
                    >
                      {getTemplateWeekLabel(option)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {isTemplateStage && (
        <>
          <div className="rounded-2xl border border-white/10 bg-card/70 p-4">
            <p className="text-xs uppercase text-text-secondary mb-3">{uiCopy.chooseWeekLabel}</p>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: templateWeekCount }, (_unused, index) => index + 1).map((option, index) => {
                const active = activeWeekIndex === index;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setActiveWeekIndex(index)}
                    className={`rounded-lg border py-2 text-sm transition-colors ${
                      active
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-white/10 bg-background text-text-secondary hover:text-white'
                    }`}
                  >
                    {getWeekTabLabel(option)}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDays.map((dayKey) => {
            const dayPlan = activeWeekPlan.dayPlans[dayKey];
            const dayExerciseCount = dayPlan.exercises.length;
            const canSaveMuscles = dayPlan.selectedMuscles.length >= 1 && dayPlan.selectedMuscles.length <= 3;
            const pickerKey = getMusclePickerKey(dayKey);
            const isMusclePickerExpanded = expandedMusclePickers[pickerKey] ?? dayPlan.selectedMuscles.length === 0;

            return (
              <div key={dayKey} className="rounded-2xl border border-white/10 bg-card/70 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">{getPlanCardLabel(dayKey)}</p>
                  {dayPlan.musclesSaved ? (
                    <button
                      type="button"
                      onClick={() => editDayMuscles(dayKey)}
                      className="text-xs text-accent hover:text-white transition-colors"
                    >
                      {uiCopy.editMuscles}
                    </button>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase text-text-secondary">{uiCopy.chooseMusclesLabel}</p>
                  <p className="text-xs text-text-tertiary">{uiCopy.chooseMusclesHint}</p>
                  {isMusclePickerExpanded ? (
                    <div className="flex flex-wrap gap-2">
                      {MUSCLE_OPTIONS.map((muscle) => {
                        const active = dayPlan.selectedMuscles.includes(muscle.value);
                        const blocked = !active && dayPlan.selectedMuscles.length >= 3;
                        return (
                          <button
                            key={`${dayKey}-${muscle.value}`}
                            type="button"
                            onClick={() => toggleMuscleSelection(dayKey, muscle.value)}
                            disabled={blocked || dayPlan.musclesSaved}
                            className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                              active
                                ? 'border-accent bg-accent/10'
                                : 'border-white/10 bg-background hover:border-white/20'
                            } ${blocked || dayPlan.musclesSaved ? 'opacity-60' : 'opacity-100'}`}
                          >
                            <img
                              src={getBodyPartImage(muscle.value)}
                              alt={getLocalizedMuscleLabel(muscle.value)}
                              className="h-9 w-9 rounded-lg object-cover"
                            />
                            <div className="text-xs font-medium text-white">
                              {getLocalizedMuscleLabel(muscle.value)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {dayPlan.selectedMuscles.map((muscle) => (
                        <button
                          key={`${dayKey}-${muscle}-selected`}
                          type="button"
                          onClick={() => openMusclePicker(dayKey)}
                          disabled={dayPlan.musclesSaved}
                          className={`flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-2.5 py-2 text-left transition-colors ${
                            dayPlan.musclesSaved ? 'opacity-100' : 'hover:border-accent/60'
                          }`}
                        >
                          <img
                            src={getBodyPartImage(muscle)}
                            alt={getLocalizedMuscleLabel(muscle)}
                            className="h-9 w-9 rounded-lg object-cover"
                          />
                          <span className="text-xs font-medium text-white">
                            {getLocalizedMuscleLabel(muscle)}
                          </span>
                        </button>
                      ))}
                      {!dayPlan.musclesSaved && dayPlan.selectedMuscles.length < 3 && (
                        <button
                          type="button"
                          onClick={() => openMusclePicker(dayKey)}
                          className="flex h-[57px] w-[57px] items-center justify-center rounded-xl border border-dashed border-white/20 bg-background text-xl text-accent transition-colors hover:border-accent/50 hover:text-white"
                          aria-label="Add muscle"
                        >
                          +
                        </button>
                      )}
                    </div>
                  )}

                  {!dayPlan.musclesSaved ? (
                    <Button onClick={() => saveDayMuscles(dayKey)} disabled={!canSaveMuscles}>
                      {uiCopy.saveMuscles}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-[11px] text-text-secondary">
                        {defaultExerciseSettingsCopy}
                      </div>

                      {dayPlan.selectedMuscles.map((muscle) => {
                        const muscleExercises = getSelectedExercisesForMuscle(dayPlan, muscle);
                        const exerciseOptions = getMuscleExerciseOptions(muscle);

                        return (
                          <div key={`${dayKey}-${muscle}-exercises`} className="space-y-3 rounded-2xl border border-white/8 bg-background/40 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{getExercisePickerLabel(muscle)}</p>
                                <p className="text-[11px] text-text-secondary">{getExercisePickerHint(dayExerciseCount)}</p>
                              </div>
                              <div className="inline-flex rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
                                {dayExerciseCount}/{MAX_EXERCISES_PER_DAY}
                              </div>
                            </div>

                            {exerciseOptions.length > 0 ? (
                              <div className="grid grid-cols-2 gap-2">
                                {exerciseOptions.map((exercise) => {
                                  const selected = isExerciseSelectedForMuscle(dayPlan, muscle, exercise);
                                  return (
                                    <button
                                      key={`${dayKey}-${muscle}-${exercise.id}`}
                                      type="button"
                                      onClick={() => toggleExerciseSelection(dayKey, muscle, exercise)}
                                      className={`overflow-hidden rounded-2xl border text-left transition-colors ${
                                        selected
                                          ? 'border-accent bg-accent/10'
                                          : 'border-white/8 bg-card/70 hover:border-accent/25'
                                      }`}
                                    >
                                      <div className="relative aspect-square overflow-hidden bg-white/5">
                                        {exercise.videoUrl ? (
                                          <video
                                            src={exercise.videoUrl}
                                            poster={getBodyPartImage(muscle)}
                                            className="block h-full w-full cursor-pointer bg-black object-cover"
                                            muted
                                            playsInline
                                            autoPlay
                                            loop
                                            preload="metadata"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              const video = event.currentTarget;
                                              video.currentTime = 0;
                                              void playMediaSafely(video);
                                            }}
                                          />
                                        ) : (
                                          <img
                                            src={getBodyPartImage(muscle)}
                                            alt={exercise.displayName}
                                            className="h-full w-full object-cover"
                                          />
                                        )}
                                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-black/10" />
                                        <div className="absolute left-2 right-2 top-2 flex items-center justify-between gap-2">
                                          <span className="rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
                                            {exercise.videoUrl ? videoBadgeCopy : noVideoBadgeCopy}
                                          </span>
                                          {selected && (
                                            <span className="rounded-full bg-accent px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-black">
                                              {selectedExerciseBadgeCopy}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="space-y-1.5 px-2.5 py-2.5">
                                        <p className="line-clamp-2 text-xs font-semibold text-white">{exercise.displayName}</p>
                                        <p className="text-[11px] text-text-secondary">
                                          {uiCopy.targets}: {getLocalizedMuscleLabel(muscle)}
                                        </p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-white/8 bg-card/60 px-4 py-4 text-sm text-text-secondary">
                                {noExercisesForMuscleCopy}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      <div className="flex-1" />

      <Button onClick={() => { void handleContinue(); }} disabled={!isCurrentWeekComplete || isSavingPlan}>
        {primaryButtonLabel}
      </Button>
    </div>
  );
}


