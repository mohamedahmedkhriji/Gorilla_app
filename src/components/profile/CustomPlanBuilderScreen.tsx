import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CustomPlanOnboardingScreen } from '../onboarding/CustomPlanOnboardingScreen';
import { OnboardingLayout } from '../onboarding/OnboardingLayout';
import { api } from '../../services/api';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
import { localizeCustomPlanName } from '../../services/programI18n';

interface CustomPlanBuilderScreenProps {
  onBack: () => void;
  onSaved: () => void;
}

type BuilderStage = 'setup' | 'templates';

type ExercisePayload = {
  exerciseName: string;
  exerciseCatalogId: number | null;
  sets: number;
  reps: string;
  restSeconds: number;
  targetWeight: number;
  targetMuscles: string[];
};

type WorkoutPayload = {
  dayName: string;
  workoutName: string;
  workoutType: 'Custom';
  targetMuscles: string[];
  exercises: ExercisePayload[];
};

type WeekPlanPayload = {
  weeklyWorkouts: WorkoutPayload[];
};

type BuilderData = {
  workoutDays: number;
  customPlan: {
    planName: string;
    cycleWeeks: number;
    templateWeekCount: number;
    selectedDays: string[];
    weeklyWorkouts: WorkoutPayload[];
    weekPlans: WeekPlanPayload[];
  };
};

interface RawProgramWorkout {
  day_order?: number;
  day_name?: string;
  dayName?: string;
  workout_name?: string;
  workoutName?: string;
  exercises?: unknown;
  targetMuscles?: unknown;
  target_muscles?: unknown;
  muscles?: unknown;
  muscleGroup?: unknown;
  muscle_group?: unknown;
}

interface RawProgramResponse {
  name?: string;
  planName?: string;
  totalWeeks?: number;
  cycleWeeks?: number;
  currentWeekWorkouts?: RawProgramWorkout[];
}

interface StoredAssignedProgramTemplate {
  name?: string;
  planName?: string;
  totalWeeks?: number;
  cycleWeeks?: number;
  templateWeekCount?: number;
  selectedDays?: unknown[];
  templateWeekPlans?: Array<{ weeklyWorkouts?: unknown[] }>;
}

const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const COPY = {
  en: {
    setupTitle: 'Custom Plan',
    templatesTitle: 'Plan Templates',
    loading: 'Loading your custom plan...',
    loadError: 'Could not load your current plan.',
    noSession: 'No active user session found.',
    defaultPlanName: 'My Custom Plan',
  },
  ar: {
    setupTitle: 'الخطة المخصصة',
    templatesTitle: 'قوالب الخطة',
    loading: 'جارٍ تحميل خطتك المخصصة...',
    loadError: 'تعذر تحميل خطتك الحالية.',
    noSession: 'لا توجد جلسة مستخدم نشطة.',
    defaultPlanName: 'خطتي المخصصة',
  },
  it: {
    setupTitle: 'Piano personalizzato',
    templatesTitle: 'Modelli piano',
    loading: 'Caricamento del tuo piano personalizzato...',
    loadError: 'Impossibile caricare il piano attuale.',
    noSession: 'Nessuna sessione utente attiva trovata.',
    defaultPlanName: 'Piano personalizzato',
  },
  de: {
    setupTitle: 'Individueller Plan',
    templatesTitle: 'Planvorlagen',
    loading: 'Dein individueller Plan wird geladen...',
    loadError: 'Dein aktueller Plan konnte nicht geladen werden.',
    noSession: 'Keine aktive Benutzersitzung gefunden.',
    defaultPlanName: 'Individueller Plan',
  },
} as const;

const orderDays = (days: string[]) => {
  const selected = new Set(days);
  return WEEK_DAYS.filter((day) => selected.has(day));
};

const normalizeDayKey = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  return WEEK_DAYS.includes(normalized as typeof WEEK_DAYS[number]) ? normalized : '';
};

const parseArrayInput = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [trimmed];
  } catch {
    return trimmed.includes(',') ? trimmed.split(',') : [trimmed];
  }
};

const parseStringList = (value: unknown) => (
  [...new Set(
    parseArrayInput(value)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean),
  )]
);

const parseExercises = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseExerciseMuscles = (exercise: Record<string, unknown>) => (
  parseStringList(
    exercise.targetMuscles
    ?? exercise.target_muscles
    ?? exercise.muscles
    ?? exercise.muscleGroup
    ?? exercise.muscle_group
    ?? exercise.targetMuscle,
  ).slice(0, 3)
);

const extractWorkoutMuscles = (workout: RawProgramWorkout) => {
  const directMuscles = parseStringList(
    workout.targetMuscles
    ?? workout.target_muscles
    ?? workout.muscles
    ?? workout.muscleGroup
    ?? workout.muscle_group,
  );

  if (directMuscles.length) {
    return directMuscles.slice(0, 3);
  }

  const exerciseMuscles = parseExercises(workout.exercises).flatMap((exercise) => {
    if (!exercise || typeof exercise !== 'object') return [];
    return parseExerciseMuscles(exercise as Record<string, unknown>);
  });

  return [...new Set(exerciseMuscles)].slice(0, 3);
};

const normalizeWorkoutPayload = (workout: RawProgramWorkout, fallbackIndex: number): WorkoutPayload | null => {
  const dayName = normalizeDayKey(workout.dayName || workout.day_name);
  if (!dayName) return null;

  const exercises = parseExercises(workout.exercises)
    .map((exercise) => {
      const raw = exercise && typeof exercise === 'object'
        ? exercise as Record<string, unknown>
        : {};

      const exerciseName = String(raw.exerciseName || raw.name || '').trim();
      const exerciseCatalogId = Number(raw.exerciseCatalogId || raw.exerciseId || 0) || null;
      if (!exerciseName && !exerciseCatalogId) return null;

      return {
        exerciseName,
        exerciseCatalogId,
        sets: Math.max(1, Math.min(10, Math.round(Number(raw.sets || 3)))),
        reps: String(raw.reps || '8-12').trim().slice(0, 20) || '8-12',
        restSeconds: Math.max(30, Math.min(600, Math.round(Number(raw.restSeconds || raw.rest || 90)))),
        targetWeight: Math.max(0, Math.min(1000, Number(raw.targetWeight ?? raw.weightKg ?? raw.weight ?? 20) || 20)),
        targetMuscles: parseExerciseMuscles(raw),
      } satisfies ExercisePayload;
    })
    .filter((exercise): exercise is ExercisePayload => Boolean(exercise));

  const workoutName = String(workout.workoutName || workout.workout_name || '').trim()
    .replace(/^week\s+\d+\s*-\s*/i, '')
    || `Day ${fallbackIndex + 1}`;

  return {
    dayName,
    workoutName,
    workoutType: 'Custom',
    targetMuscles: extractWorkoutMuscles(workout),
    exercises,
  };
};

const normalizeWeekPlanPayload = (value: unknown): WeekPlanPayload | null => {
  if (!value || typeof value !== 'object') return null;

  const weeklyWorkouts = parseArrayInput((value as { weeklyWorkouts?: unknown[] }).weeklyWorkouts)
    .map((workout, index) => {
      if (!workout || typeof workout !== 'object') return null;
      return normalizeWorkoutPayload(workout as RawProgramWorkout, index);
    })
    .filter((workout): workout is WorkoutPayload => Boolean(workout));

  return weeklyWorkouts.length ? { weeklyWorkouts } : null;
};

const createDefaultSelectedDays = (count: number) => WEEK_DAYS.slice(0, Math.max(2, Math.min(6, count)));

const buildInitialBuilderData = (
  program: RawProgramResponse | null,
  storedTemplate: StoredAssignedProgramTemplate | null,
  language: AppLanguage,
): BuilderData => {
  const copy = COPY[language] || COPY.en;
  const sortedCurrentWeekWorkouts = [...(Array.isArray(program?.currentWeekWorkouts) ? program.currentWeekWorkouts : [])]
    .sort((left, right) => {
      const leftDay = normalizeDayKey(left.day_name || left.dayName);
      const rightDay = normalizeDayKey(right.day_name || right.dayName);
      const leftIndex = leftDay ? WEEK_DAYS.indexOf(leftDay as typeof WEEK_DAYS[number]) : Number.MAX_SAFE_INTEGER;
      const rightIndex = rightDay ? WEEK_DAYS.indexOf(rightDay as typeof WEEK_DAYS[number]) : Number.MAX_SAFE_INTEGER;
      return (Number(left.day_order || leftIndex) - Number(right.day_order || rightIndex));
    });

  const weeklyWorkouts = sortedCurrentWeekWorkouts
    .map((workout, index) => normalizeWorkoutPayload(workout, index))
    .filter((workout): workout is WorkoutPayload => Boolean(workout));

  const templateWeekPlans = Array.isArray(storedTemplate?.templateWeekPlans)
    ? storedTemplate.templateWeekPlans
      .map((weekPlan) => normalizeWeekPlanPayload(weekPlan))
      .filter((weekPlan): weekPlan is WeekPlanPayload => Boolean(weekPlan))
    : [];

  const selectedDays = orderDays(
    parseArrayInput(storedTemplate?.selectedDays).length
      ? parseArrayInput(storedTemplate?.selectedDays).map((day) => normalizeDayKey(day)).filter(Boolean)
      : weeklyWorkouts.map((workout) => workout.dayName),
  );

  const fallbackSelectedDays = selectedDays.length
    ? selectedDays
    : createDefaultSelectedDays(weeklyWorkouts.length || 4);

  const templateWeekCount = Math.max(
    1,
    Math.min(
      2,
      Number(
        storedTemplate?.templateWeekCount
        || (templateWeekPlans.length > 1 ? templateWeekPlans.length : 1),
      ) || 1,
    ),
  );

  const resolvedWeeklyWorkouts = templateWeekPlans[0]?.weeklyWorkouts?.length
    ? templateWeekPlans[0].weeklyWorkouts
    : weeklyWorkouts;

  const resolvedWeekPlans = templateWeekPlans.length
    ? templateWeekPlans.slice(0, templateWeekCount)
    : [{ weeklyWorkouts: resolvedWeeklyWorkouts }];

  return {
    workoutDays: Math.max(2, Math.min(6, fallbackSelectedDays.length || 4)),
    customPlan: {
      planName: localizeCustomPlanName(
        storedTemplate?.planName
        || storedTemplate?.name
        || program?.planName
        || program?.name
        || copy.defaultPlanName,
        language,
      ).trim() || copy.defaultPlanName,
      cycleWeeks: Math.max(
        6,
        Math.min(
          16,
          Math.round(Number(storedTemplate?.cycleWeeks || storedTemplate?.totalWeeks || program?.cycleWeeks || program?.totalWeeks || 6)),
        ),
      ),
      templateWeekCount,
      selectedDays: fallbackSelectedDays,
      weeklyWorkouts: resolvedWeeklyWorkouts,
      weekPlans: resolvedWeekPlans,
    },
  };
};

const getStoredUserId = () => {
  if (typeof window === 'undefined') return 0;

  try {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    return Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || user?.id || 0);
  } catch {
    return 0;
  }
};

const getStoredAssignedTemplate = (): StoredAssignedProgramTemplate | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem('assignedProgramTemplate');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as StoredAssignedProgramTemplate : null;
  } catch {
    return null;
  }
};

export function CustomPlanBuilderScreen({ onBack, onSaved }: CustomPlanBuilderScreenProps) {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<BuilderStage>('setup');
  const [userId, setUserId] = useState<number>(0);
  const [builderData, setBuilderData] = useState<BuilderData | null>(null);

  useEffect(() => {
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

  const copy = COPY[language] || COPY.en;

  useEffect(() => {
    const initialize = async () => {
      if (builderData) return;

      setLoading(true);
      setError(null);

      const resolvedUserId = getStoredUserId();
      if (!resolvedUserId) {
        setError(copy.noSession);
        setLoading(false);
        return;
      }

      try {
        const program = await api.getUserProgram(resolvedUserId) as RawProgramResponse;
        setBuilderData(buildInitialBuilderData(program, getStoredAssignedTemplate(), language));
        setUserId(resolvedUserId);
      } catch (initializationError) {
        console.error('Failed to initialize profile custom plan builder:', initializationError);
        setBuilderData(buildInitialBuilderData(null, getStoredAssignedTemplate(), language));
        setUserId(resolvedUserId);
        setError(copy.loadError);
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, [builderData, copy.loadError, copy.noSession, language]);

  const handleDataChange = useCallback((
    patch: Partial<BuilderData> & { customPlan?: Partial<BuilderData['customPlan']> },
  ) => {
    setBuilderData((previous) => {
      const base = previous || buildInitialBuilderData(null, null, language);
      return {
        ...base,
        ...patch,
        customPlan: {
          ...base.customPlan,
          ...(patch.customPlan || {}),
        },
      };
    });
  }, [language]);

  const handleComplete = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('recoveryNeedsUpdate');
    }
    onSaved();
  }, [onSaved]);

  const activeTitle = useMemo(
    () => (stage === 'templates' ? copy.templatesTitle : copy.setupTitle),
    [copy.setupTitle, copy.templatesTitle, stage],
  );

  const handleBack = useCallback(() => {
    if (stage === 'templates') {
      setStage('setup');
      return;
    }
    onBack();
  }, [onBack, stage]);

  return (
    <div className="flex-1 flex flex-col bg-background">
      <OnboardingLayout
        currentStep={stage === 'templates' ? 1 : 0}
        totalSteps={2}
        onBack={handleBack}
        title={activeTitle}
      >
        {loading || !builderData ? (
          <div className="rounded-2xl border border-white/10 bg-card/70 px-4 py-5 text-sm text-text-secondary">
            {loading ? copy.loading : (error || copy.loadError)}
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-xl border border-white/10 bg-card/70 px-4 py-3 text-sm text-text-secondary">
                {error}
              </div>
            )}

            <CustomPlanOnboardingScreen
              key={stage}
              onNext={() => setStage('templates')}
              onComplete={handleComplete}
              onDataChange={handleDataChange}
              onboardingData={builderData}
              stepId={stage === 'templates' ? 'custom_plan_builder' : 'profile_custom_plan_setup'}
              userId={userId || undefined}
              persistOnboardingState={false}
            />
          </>
        )}
      </OnboardingLayout>
    </div>
  );
}
