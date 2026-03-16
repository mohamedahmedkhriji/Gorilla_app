import React, { useEffect, useState } from 'react';
import { WorkoutOverviewScreen } from '../components/workout/WorkoutOverviewScreen';
import { LiveWorkoutScreen } from '../components/workout/LiveWorkoutScreen';
import { PostWorkoutSummary, type WorkoutDaySummaryData } from '../components/workout/PostWorkoutSummary';
import { ExerciseVideoScreen } from '../components/workout/ExerciseVideoScreen';
import { WorkoutPlanScreen } from '../components/workout/WorkoutPlanScreen';
import { TrackerScreen } from '../components/workout/TrackerScreen';
import { api } from '../services/api';
import { resolveExerciseVideoUrl } from '../services/exerciseVideos';
import { formatWorkoutDayLabel, normalizeWorkoutDayKey } from '../services/workoutDayLabel';
import { getActiveLanguage, getStoredLanguage } from '../services/language';
import { useScrollToTopOnChange } from '../shared/scroll';

interface WorkoutProps {
  onBack: () => void;
  workoutDay?: string;
  resetSignal?: number;
}

type AddedCatalogExercise = {
  id: number;
  name: string;
  muscle?: string;
  bodyPart?: string | null;
};

type TodayWorkoutExercise = {
  id: number | null;
  exerciseName: string;
  exerciseCatalogId: number | null;
  targetMuscles: string[];
  muscleGroup: string | null;
  sets: number;
  reps: string;
  targetWeight: number | null;
  rest: number;
  tempo: string | null;
  rpeTarget: number | null;
  notes: string | null;
  isExtra: boolean;
};

type ViewState = 'overview' | 'plan' | 'tracker' | 'video' | 'live' | 'summary';

type SummaryMuscle = {
  name: string;
  score: number;
};

type SummaryExercise = {
  name: string;
  sets: Array<{ set: number; reps: number; weight: number }>;
  totalSets: number;
  totalReps: number;
  topWeight: number;
  volume: number;
  targetMuscles: string[];
};

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const toScopePart = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_');

const getUserStorageScope = (user: any) => {
  const userId = Number(user?.id || 0);
  if (Number.isInteger(userId) && userId > 0) return `id_${userId}`;

  const email = toScopePart(user?.email);
  if (email) return `email_${email}`;

  const phone = toScopePart(user?.phone);
  if (phone) return `phone_${phone}`;

  const name = toScopePart(user?.name);
  if (name) return `name_${name}`;

  return 'guest';
};

const getWorkoutStorageKeys = (scope: string) => {
  return {
    workoutDate: `workoutDate:${scope}`,
    completedExercises: `completedExercises:${scope}`,
    exerciseSets: `exerciseSets:${scope}`,
    extraExercises: `extraExercises:${scope}`,
    exerciseCount: `exerciseCount:${scope}`,
    exerciseSnapshot: `exerciseSnapshot:${scope}`,
  };
};

const getHomeMetricStorageKeys = (scope: string) => {
  return {
    homeWorkoutProgress: `homeWorkoutProgress:${scope}`,
  };
};

const getWorkoutSummaryStorageKeys = (scope: string) => {
  return {
    blogPostedSummaries: `blogPostedSummaries:${scope}`,
  };
};

const readPostedWorkoutSummaryTokens = (scope: string) => {
  const keys = getWorkoutSummaryStorageKeys(scope);
  try {
    const raw = localStorage.getItem(keys.blogPostedSummaries);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  } catch {
    return [] as string[];
  }
};

const loadLocalWorkoutState = (scope: string) => {
  const keys = getWorkoutStorageKeys(scope);
  const today = new Date().toDateString();
  const savedDate = localStorage.getItem(keys.workoutDate);

  if (savedDate !== today) {
    localStorage.removeItem(keys.completedExercises);
    localStorage.removeItem(keys.exerciseSets);
    localStorage.removeItem(keys.extraExercises);
    localStorage.removeItem(keys.exerciseCount);
    localStorage.removeItem(keys.exerciseSnapshot);
    localStorage.setItem(keys.workoutDate, today);
    return {
      completedExercises: [] as string[],
      exerciseSets: {} as Record<string, any[]>,
      extraExercises: [] as any[],
    };
  }

  let completedExercises: string[] = [];
  let exerciseSets: Record<string, any[]> = {};
  let extraExercises: any[] = [];

  try {
    const completedRaw = localStorage.getItem(keys.completedExercises);
    const parsedCompleted = completedRaw ? JSON.parse(completedRaw) : [];
    completedExercises = Array.isArray(parsedCompleted) ? parsedCompleted : [];
  } catch {
    completedExercises = [];
  }

  try {
    const setsRaw = localStorage.getItem(keys.exerciseSets);
    const parsedSets = setsRaw ? JSON.parse(setsRaw) : {};
    exerciseSets = parsedSets && typeof parsedSets === 'object' ? parsedSets : {};
  } catch {
    exerciseSets = {};
  }

  try {
    const extraRaw = localStorage.getItem(keys.extraExercises);
    const parsedExtras = extraRaw ? JSON.parse(extraRaw) : [];
    extraExercises = Array.isArray(parsedExtras) ? parsedExtras : [];
  } catch {
    extraExercises = [];
  }

  return { completedExercises, exerciseSets, extraExercises };
};

const clearLocalWorkoutState = (scope: string) => {
  const keys = getWorkoutStorageKeys(scope);
  localStorage.setItem(keys.workoutDate, new Date().toDateString());
  localStorage.removeItem(keys.completedExercises);
  localStorage.removeItem(keys.exerciseSets);
  localStorage.removeItem(keys.extraExercises);
  localStorage.removeItem(keys.exerciseCount);
  localStorage.removeItem(keys.exerciseSnapshot);
};

const parseTargetMuscles = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }

  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return [];

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => String(entry || '').trim())
          .filter(Boolean);
      }
      if (typeof parsed === 'string' && parsed.trim()) return [parsed.trim()];
    } catch {
      // Fall through to delimited parsing.
    }

    return text
      .split(/[,;|]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeExerciseLookupName = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase();

const normalizeMuscleName = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

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

  return [...new Set(matches.map(normalizeMuscleName).filter(Boolean))];
};

const formatDateISO = (date = new Date()) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeWorkoutSummary = (raw: any): WorkoutDaySummaryData | null => {
  if (!raw || typeof raw !== 'object') return null;

  const workoutName = String(raw.workoutName || raw.workout_name || '').trim();
  if (!workoutName) return null;

  const musclesRaw = Array.isArray(raw.muscles) ? raw.muscles : [];
  const exercisesRaw = Array.isArray(raw.exercises) ? raw.exercises : [];

  const muscles: SummaryMuscle[] = musclesRaw
    .map((muscle: any) => ({
      name: normalizeMuscleName(muscle?.name || ''),
      score: Math.max(0, Math.min(100, Math.round(Number(muscle?.score || 0)))),
    }))
    .filter((muscle: SummaryMuscle) => muscle.name);

  const exercises: SummaryExercise[] = exercisesRaw
    .map((exercise: any) => {
      const name = String(exercise?.name || '').trim();
      if (!name) return null;

      const setsRaw = Array.isArray(exercise?.sets) ? exercise.sets : [];
      const sets = setsRaw.map((setRow: any, index: number) => ({
        set: Math.max(1, Math.round(Number(setRow?.set || index + 1))),
        reps: Math.max(0, Math.round(Number(setRow?.reps || 0))),
        weight: Number(Number(setRow?.weight || 0).toFixed(2)),
      }));

      return {
        name,
        sets,
        totalSets: Math.max(0, Math.round(Number(exercise?.totalSets || sets.length))),
        totalReps: Math.max(0, Math.round(Number(exercise?.totalReps || 0))),
        topWeight: Number(Number(exercise?.topWeight || 0).toFixed(2)),
        volume: Number(Number(exercise?.volume || 0).toFixed(2)),
        targetMuscles: Array.isArray(exercise?.targetMuscles)
          ? exercise.targetMuscles.map((entry: unknown) => normalizeMuscleName(String(entry || ''))).filter(Boolean)
          : [],
      };
    })
    .filter(Boolean) as SummaryExercise[];

  return {
    id: Number(raw.id || 0) || undefined,
    summaryDate: raw.summaryDate || raw.summary_date || null,
    workoutName,
    durationSeconds: Math.max(0, Math.round(Number(raw.durationSeconds ?? raw.duration_seconds ?? 0))),
    estimatedCalories: Math.max(0, Math.round(Number(raw.estimatedCalories ?? raw.estimated_calories ?? 0))),
    totalVolume: Number(Number(raw.totalVolume ?? raw.total_volume ?? 0).toFixed(2)),
    recordsCount: Math.max(0, Math.round(Number(raw.recordsCount ?? raw.records_count ?? 0))),
    muscles,
    exercises,
    summaryText: String(raw.summaryText || raw.summary_text || '').trim(),
  };
};

const escapeSvgText = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildSummaryShareText = (summary: WorkoutDaySummaryData) => {
  const totalSets = summary.exercises.reduce((acc, exercise) => acc + Number(exercise.totalSets || 0), 0);
  const topMuscles = summary.muscles
    .slice(0, 3)
    .map((muscle) => muscle.name)
    .filter(Boolean)
    .join(' - ');

  const lines = [
    `Completed ${summary.workoutName}`,
    `Duration: ${Math.round(summary.durationSeconds / 60)} min`,
    `Exercises: ${summary.exercises.length}`,
    `Sets: ${totalSets}`,
    `Volume: ${Math.round(summary.totalVolume).toLocaleString()} kg`,
  ];

  if (topMuscles) {
    lines.push(`Target muscles: ${topMuscles}`);
  }

  return lines.join('\n');
};

const buildSummaryImageDataUrl = (summary: WorkoutDaySummaryData) => {
  const title = escapeSvgText(summary.workoutName);
  const dateText = escapeSvgText(
    summary.summaryDate
      ? new Date(summary.summaryDate).toLocaleDateString()
      : new Date().toLocaleDateString(),
  );
  const durationText = `${Math.max(0, Math.round(summary.durationSeconds / 60))} min`;
  const exercisesText = `${summary.exercises.length} exercises`;
  const volumeText = `${Math.round(summary.totalVolume).toLocaleString()} kg`;
  const caloriesText = `${summary.estimatedCalories.toLocaleString()} kcal`;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#0b1230" />
          <stop offset="100%" stop-color="#0f1a46" />
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)" />
      <rect x="48" y="48" width="1104" height="534" rx="28" fill="#192443" stroke="#3a4b7a" />
      <text x="88" y="120" fill="#d5def2" font-size="34" font-family="Arial, sans-serif" font-weight="600">${dateText}</text>
      <text x="88" y="200" fill="#ffffff" font-size="68" font-family="Arial, sans-serif" font-weight="700">${title}</text>
      <text x="88" y="286" fill="#c9d5f0" font-size="38" font-family="Arial, sans-serif">${durationText} - ${exercisesText}</text>
      <text x="88" y="348" fill="#c9d5f0" font-size="38" font-family="Arial, sans-serif">Volume: ${volumeText}</text>
      <text x="88" y="410" fill="#c9d5f0" font-size="38" font-family="Arial, sans-serif">Energy: ${caloriesText}</text>
      <rect x="88" y="470" width="410" height="74" rx="37" fill="#c6f63e" />
      <text x="126" y="520" fill="#162014" font-size="34" font-family="Arial, sans-serif" font-weight="700">RepSet Workout Recap</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const normalizeWorkoutExerciseEntry = (ex: any, isExtra: boolean): TodayWorkoutExercise => ({
  id: Number(ex?.id ?? ex?.workoutExerciseId ?? ex?.workout_exercise_id ?? 0) || null,
  exerciseName: String(ex?.exerciseName || ex?.exercise_name || ex?.name || '').trim(),
  exerciseCatalogId: Number(ex?.exerciseCatalogId ?? ex?.exercise_catalog_id ?? 0) || null,
  targetMuscles: parseTargetMuscles(ex?.targetMuscles ?? ex?.muscleTargets ?? ex?.muscles),
  muscleGroup: String(ex?.muscleGroup || ex?.muscle_group || '').trim() || null,
  sets: Number(ex?.sets ?? ex?.targetSets ?? ex?.target_sets ?? 0),
  reps: String(ex?.reps ?? ex?.targetReps ?? ex?.target_reps ?? ''),
  targetWeight: Number(ex?.targetWeight ?? ex?.target_weight ?? 0) || null,
  rest: Number(ex?.rest ?? ex?.restSeconds ?? ex?.rest_seconds ?? 0),
  tempo: ex?.tempo || null,
  rpeTarget: Number(ex?.rpeTarget ?? ex?.rpe_target ?? 0) || null,
  notes: ex?.notes || null,
  isExtra,
});

const dedupeTodayExercises = (exercises: TodayWorkoutExercise[]) => {
  const seen = new Set<string>();
  return exercises.filter((exercise) => {
    const key = normalizeExerciseLookupName(exercise.exerciseName);
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const serializeTodayExercisesSnapshot = (exercises: TodayWorkoutExercise[]) =>
  exercises.map((exercise) => ({
    id: exercise.id,
    exerciseName: exercise.exerciseName,
    exerciseCatalogId: exercise.exerciseCatalogId,
    targetMuscles: exercise.targetMuscles,
    muscleGroup: exercise.muscleGroup,
    sets: exercise.sets,
    reps: exercise.reps,
    targetWeight: exercise.targetWeight,
    rest: exercise.rest,
    tempo: exercise.tempo,
    rpeTarget: exercise.rpeTarget,
    notes: exercise.notes,
    isExtra: exercise.isExtra,
  }));

const inferWorkoutLabelFromExercises = (exercises: TodayWorkoutExercise[]) => {
  const bucketScores = {
    push: 0,
    pull: 0,
    legs: 0,
    core: 0,
  };

  exercises.forEach((exercise) => {
    const muscles = (
      Array.isArray(exercise?.targetMuscles) && exercise.targetMuscles.length
        ? exercise.targetMuscles
        : exercise?.muscleGroup
          ? [exercise.muscleGroup]
          : inferMusclesFromExerciseName(exercise.exerciseName)
    )
      .map((entry) => normalizeMuscleName(String(entry || '')))
      .filter(Boolean);

    muscles.forEach((muscle) => {
      if (['Chest', 'Shoulders', 'Triceps'].includes(muscle)) bucketScores.push += 1;
      if (['Back', 'Biceps', 'Forearms'].includes(muscle)) bucketScores.pull += 1;
      if (['Quadriceps', 'Hamstrings', 'Calves', 'Glutes'].includes(muscle)) bucketScores.legs += 1;
      if (['Abs', 'Core'].includes(muscle)) bucketScores.core += 1;
    });
  });

  if (bucketScores.legs > 0 && bucketScores.push === 0 && bucketScores.pull === 0) {
    return 'Leg Day';
  }
  if (bucketScores.push > 0 && bucketScores.pull === 0 && bucketScores.legs === 0) {
    return 'Push Day';
  }
  if (bucketScores.pull > 0 && bucketScores.push === 0 && bucketScores.legs === 0) {
    return 'Pull Day';
  }
  if (bucketScores.push > 0 && bucketScores.pull > 0 && bucketScores.legs === 0) {
    return 'Upper Body';
  }
  if (bucketScores.push > 0 && bucketScores.pull > 0 && bucketScores.legs > 0) {
    return 'Full Body';
  }
  if (bucketScores.core > 0 && bucketScores.push === 0 && bucketScores.pull === 0 && bucketScores.legs === 0) {
    return 'Core Day';
  }

  return '';
};

const resolveWorkoutDisplayName = (rawName: unknown, exercises: TodayWorkoutExercise[]) => {
  const trimmedName = String(rawName || '').trim();
  const inferredLabel = inferWorkoutLabelFromExercises(exercises);
  if (!trimmedName) return inferredLabel || 'Workout';

  const normalizedName = trimmedName.toLowerCase();
  const isGenericSplitName = /(push|pull|leg|legs|upper|lower|full body|rest|recovery|core)/.test(normalizedName);
  if (!isGenericSplitName || !inferredLabel) return trimmedName;

  const normalizedInferred = inferredLabel.toLowerCase();
  if (normalizedName.includes(normalizedInferred)) return trimmedName;

  const inferredKey = normalizedInferred.split(' ')[0];
  const namedAsRest = normalizedName.includes('rest') || normalizedName.includes('recovery');
  if (namedAsRest) return trimmedName;

  return inferredKey && !normalizedName.includes(inferredKey) ? inferredLabel : trimmedName;
};

const resolveTodayWorkoutPayload = (program: any) => {
  if (String(program?.missedTodayWorkoutName || '').trim()) {
    return null;
  }

  const todayWorkout = program?.todayWorkout || null;
  const weeklyWorkouts = Array.isArray(program?.currentWeekWorkouts)
    ? program.currentWeekWorkouts
    : Array.isArray(program?.workouts)
      ? program.workouts
      : [];

  if (!todayWorkout && !weeklyWorkouts.length) return null;

  const clientWeekdayKey = normalizeWorkoutDayKey(new Date().toLocaleDateString('en-US', { weekday: 'long' }));
  const normalizedTodayName = String(todayWorkout?.name || '').trim().toLowerCase();
  const normalizedTodayDay = normalizeWorkoutDayKey(todayWorkout?.dayName);
  const weeklyWorkoutByClientDay = weeklyWorkouts.find((workout: any) =>
    normalizeWorkoutDayKey(workout?.day_name) === clientWeekdayKey,
  );
  const weeklyWorkoutByName = weeklyWorkouts.find((workout: any) =>
    String(workout?.workout_name || '').trim().toLowerCase() === normalizedTodayName,
  );
  const weeklyWorkoutByServerDay = weeklyWorkouts.find((workout: any) =>
    normalizeWorkoutDayKey(workout?.day_name) === normalizedTodayDay,
  );
  const todayNameMatchesClientDay = !!(
    weeklyWorkoutByName
    && normalizeWorkoutDayKey(weeklyWorkoutByName?.day_name) === clientWeekdayKey
  );
  const shouldUseTodayPayload = !!(
    todayWorkout
    && (
      !normalizedTodayDay
      || normalizedTodayDay === clientWeekdayKey
      || todayNameMatchesClientDay
      || !weeklyWorkoutByClientDay
    )
  );

  const resolvedWorkout =
    shouldUseTodayPayload
      ? (weeklyWorkoutByName || weeklyWorkoutByServerDay || weeklyWorkoutByClientDay || null)
      : (weeklyWorkoutByClientDay || weeklyWorkoutByServerDay || weeklyWorkoutByName || null)
    || null;

  const directExercises = shouldUseTodayPayload && Array.isArray(todayWorkout?.exercises)
    ? todayWorkout.exercises.map((ex: any) => normalizeWorkoutExerciseEntry(ex, false))
    : [];
  const weeklyExercises = Array.isArray(resolvedWorkout?.exercises)
    ? resolvedWorkout.exercises.map((ex: any) => normalizeWorkoutExerciseEntry(ex, false))
    : [];
  const exercises = shouldUseTodayPayload
    ? (weeklyExercises.length > directExercises.length ? weeklyExercises : directExercises)
    : weeklyExercises;
  const resolvedDayKey =
    normalizeWorkoutDayKey(resolvedWorkout?.day_name)
    || normalizeWorkoutDayKey(todayWorkout?.dayName)
    || clientWeekdayKey;

  return {
    exercises,
    dayLabel: formatWorkoutDayLabel(resolvedDayKey, 'Rest Day'),
    name: resolveWorkoutDisplayName(
      (shouldUseTodayPayload ? todayWorkout?.name : '') || resolvedWorkout?.workout_name || todayWorkout?.name || '',
      exercises,
    ),
  };
};

export function Workout({ onBack, workoutDay = 'Push Day', resetSignal = 0 }: WorkoutProps) {
  const currentUser = readStoredUser();
  const userId = Number(currentUser?.id || 0);
  const workoutStorageScope = getUserStorageScope(currentUser);
  const workoutStorageKeys = getWorkoutStorageKeys(workoutStorageScope);
  const homeMetricStorageKeys = getHomeMetricStorageKeys(workoutStorageScope);
  const workoutSummaryStorageKeys = getWorkoutSummaryStorageKeys(workoutStorageScope);

  const [view, setView] = useState<ViewState>('plan');
  const [videoReturnView, setVideoReturnView] = useState<ViewState>('tracker');
  const [selectedExercise, setSelectedExercise] = useState('Bench Press');
  const [currentWorkoutName, setCurrentWorkoutName] = useState(workoutDay);
  const [currentWorkoutDayLabel, setCurrentWorkoutDayLabel] = useState(formatWorkoutDayLabel(new Date().toLocaleDateString('en-US', { weekday: 'long' }), workoutDay));
  const [todayExercises, setTodayExercises] = useState<TodayWorkoutExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedExercises, setCompletedExercises] = useState<string[]>([]);
  const [exerciseSets, setExerciseSets] = useState<Record<string, any[]>>({});
  const [summary, setSummary] = useState<WorkoutDaySummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [hasLatestSummary, setHasLatestSummary] = useState(false);
  const [lastAutoSummaryKey, setLastAutoSummaryKey] = useState('');
  const [postedSummaryTokens, setPostedSummaryTokens] = useState<string[]>([]);

  useScrollToTopOnChange([view, resetSignal]);

  const normalizeExerciseName = (name: string) => String(name || '').trim().toLowerCase();
  const isSetCompleted = (setRow: any) =>
    !!(
      setRow?.completed
      ?? setRow?.isCompleted
      ?? setRow?.done
      ?? false
    );

  useEffect(() => {
    const state = loadLocalWorkoutState(workoutStorageScope);
    setCompletedExercises(state.completedExercises);
    setExerciseSets(state.exerciseSets);
  }, [workoutStorageScope]);

  useEffect(() => {
    setView('plan');
  }, [resetSignal]);

  useEffect(() => {
    setPostedSummaryTokens(readPostedWorkoutSummaryTokens(workoutStorageScope));
  }, [workoutStorageScope]);

  useEffect(() => {
    const loadLatestSummaryAvailability = async () => {
      if (!userId) {
        setHasLatestSummary(false);
        return;
      }
      try {
        const response = await api.getLatestWorkoutDaySummary(userId);
        const latestSummary = normalizeWorkoutSummary(response?.summary);
        setHasLatestSummary(Boolean(latestSummary));
      } catch {
        setHasLatestSummary(false);
      }
    };

    void loadLatestSummaryAvailability();
  }, [userId]);

  const persistExtraExercises = (exercises: any[]) => {
    const extras = exercises
      .filter((exercise) => exercise?.isExtra)
      .map((exercise) => ({
        exerciseName: exercise.exerciseName,
        exerciseCatalogId: exercise.exerciseCatalogId ?? null,
        targetMuscles: Array.isArray(exercise.targetMuscles) ? exercise.targetMuscles : [],
        muscleGroup: exercise.muscleGroup ?? null,
        sets: Number(exercise.sets || 0),
        reps: String(exercise.reps || ''),
        targetWeight: exercise.targetWeight ?? null,
        rest: Number(exercise.rest || 0),
        tempo: exercise.tempo ?? null,
        rpeTarget: exercise.rpeTarget ?? null,
        notes: exercise.notes ?? null,
        isExtra: true,
      }));
    localStorage.setItem(workoutStorageKeys.extraExercises, JSON.stringify(extras));
    localStorage.setItem(workoutStorageKeys.exerciseCount, String(exercises.length));
  };

  const syncTodayExercises = (exercises: TodayWorkoutExercise[]) => {
    const nextExercises = dedupeTodayExercises(exercises);
    setTodayExercises(nextExercises);
    persistExtraExercises(nextExercises);
    localStorage.setItem(
      workoutStorageKeys.exerciseSnapshot,
      JSON.stringify(serializeTodayExercisesSnapshot(nextExercises)),
    );
    return nextExercises;
  };

  const getPlannedSetsForExercise = (exerciseName: string) => {
    const planned = todayExercises.find(
      (ex: any) => normalizeExerciseName(ex.exerciseName) === normalizeExerciseName(exerciseName),
    );
    const sets = Number(planned?.sets || 0);
    return Number.isFinite(sets) && sets > 0 ? Math.round(sets) : null;
  };

  useEffect(() => {
    const fetchTodayWorkout = async () => {
      try {
        if (!userId) {
          setTodayExercises([]);
          setCurrentWorkoutName('Rest Day');
          setCurrentWorkoutDayLabel('Rest Day');
          localStorage.setItem(workoutStorageKeys.exerciseCount, '0');
          localStorage.removeItem(workoutStorageKeys.exerciseSnapshot);
          setLoading(false);
          return;
        }

        const program = await api.getUserProgram(userId);
        const resolvedWorkout = resolveTodayWorkoutPayload(program);
        const todayWorkout = program?.todayWorkout || null;

        if (!todayWorkout && !resolvedWorkout) {
          setTodayExercises([]);
          setCurrentWorkoutName('Rest Day');
          setCurrentWorkoutDayLabel('Rest Day');
          localStorage.setItem(workoutStorageKeys.exerciseCount, '0');
          localStorage.removeItem(workoutStorageKeys.exerciseSnapshot);
          setLoading(false);
          return;
        }

        const normalizedExercises = Array.isArray(resolvedWorkout?.exercises)
          ? resolvedWorkout.exercises
          : Array.isArray(todayWorkout?.exercises)
            ? todayWorkout.exercises.map((ex: any) => normalizeWorkoutExerciseEntry(ex, false))
            : [];

        const storedState = loadLocalWorkoutState(workoutStorageScope);
        const normalizedExtras = Array.isArray(storedState.extraExercises)
          ? storedState.extraExercises.map((ex: any) => normalizeWorkoutExerciseEntry(ex, true))
          : [];

        syncTodayExercises([...normalizedExercises, ...normalizedExtras]);
        setCurrentWorkoutDayLabel(String(resolvedWorkout?.dayLabel || formatWorkoutDayLabel(todayWorkout?.dayName, '') || workoutDay).trim() || 'Rest Day');
        setCurrentWorkoutName(
          resolveWorkoutDisplayName(
            resolvedWorkout?.name || todayWorkout?.name || workoutDay,
            normalizedExercises,
          ),
        );
      } catch (error) {
        console.error('Failed to fetch today workout:', error);
        setTodayExercises([]);
        setCurrentWorkoutName('Rest Day');
        setCurrentWorkoutDayLabel('Rest Day');
        localStorage.setItem(workoutStorageKeys.exerciseCount, '0');
        localStorage.removeItem(workoutStorageKeys.exerciseSnapshot);
      } finally {
        setLoading(false);
      }
    };
    void fetchTodayWorkout();
  }, [workoutDay, userId, workoutStorageScope]);

  const addExerciseToToday = async (exercise: AddedCatalogExercise) => {
    const isArabic = getActiveLanguage(getStoredLanguage()) === 'ar';
    const addCopy = {
      selectFirst: isArabic ? 'اختر تمرينًا أولاً.' : 'Select an exercise first.',
      duplicate: isArabic ? 'هذا التمرين موجود بالفعل في تمرين اليوم.' : "This exercise is already in today's workout.",
      addFail: isArabic ? 'تعذر إضافة التمرين.' : 'Could not add exercise.',
    };
    const exerciseName = String(exercise?.name || '').trim();
    if (!exerciseName) {
      return { added: false, reason: addCopy.selectFirst };
    }

    const normalizedName = normalizeExerciseName(exerciseName);
    if (todayExercises.some((entry: any) => normalizeExerciseName(entry?.exerciseName) === normalizedName)) {
      return { added: false, reason: addCopy.duplicate };
    }

    const nextExercise = {
      id: null,
      exerciseName,
      exerciseCatalogId: Number(exercise?.id || 0) || null,
      targetMuscles: parseTargetMuscles([exercise?.muscle || exercise?.bodyPart || '']),
      muscleGroup: String(exercise?.muscle || exercise?.bodyPart || '').trim() || null,
      sets: 3,
      reps: '8-12',
      targetWeight: null,
      rest: 90,
      tempo: null,
      rpeTarget: null,
      notes: 'Added for today',
      isExtra: true,
    };

    if (userId) {
      try {
        const response = await api.addExerciseToTodayWorkout(userId, nextExercise);
        const insertedExercise = response?.exercise
          ? normalizeWorkoutExerciseEntry(response.exercise, true)
          : nextExercise;
        const nextExercises = syncTodayExercises([...todayExercises, insertedExercise]);
        if (nextExercises.length) {
          window.dispatchEvent(new CustomEvent('workout-extra-exercises-updated'));
        }
        return { added: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : addCopy.addFail;
        return { added: false, reason: message };
      }
    }

    const nextExercises = syncTodayExercises([...todayExercises, nextExercise]);
    window.dispatchEvent(new CustomEvent('workout-extra-exercises-updated'));
    return { added: true };
  };

  const removeExerciseFromToday = async (exerciseName: string) => {
    const normalizedName = normalizeExerciseName(exerciseName);
    const targetExercise = todayExercises.find(
      (exercise) => normalizeExerciseName(exercise.exerciseName) === normalizedName,
    );

    if (!targetExercise) {
      throw new Error('Exercise not found in today\'s workout.');
    }

    if (userId && targetExercise.id) {
      await api.removeExerciseFromTodayWorkout(userId, targetExercise.id);
    }

    const nextExercises = todayExercises.filter(
      (exercise) => normalizeExerciseName(exercise.exerciseName) !== normalizedName,
    );
    syncTodayExercises(nextExercises);

    const nextExerciseSets = Object.fromEntries(
      Object.entries(exerciseSets).filter(
        ([name]) => normalizeExerciseName(name) !== normalizedName,
      ),
    );
    setExerciseSets(nextExerciseSets);
    localStorage.setItem(workoutStorageKeys.exerciseSets, JSON.stringify(nextExerciseSets));

    const nextCompletedExercises = completedExercises.filter(
      (name) => normalizeExerciseName(name) !== normalizedName,
    );
    setCompletedExercises(nextCompletedExercises);
    localStorage.setItem(workoutStorageKeys.completedExercises, JSON.stringify(nextCompletedExercises));

    if (normalizeExerciseName(selectedExercise) === normalizedName) {
      setView('plan');
    }

    window.dispatchEvent(new CustomEvent('workout-extra-exercises-updated'));
    window.dispatchEvent(new CustomEvent('workout-progress-updated'));
  };

  const buildWorkoutSummary = async (setsByExercise: Record<string, any[]>): Promise<WorkoutDaySummaryData | null> => {
    const exerciseMetaByName = new Map<string, any>();
    todayExercises.forEach((exercise: any) => {
      const normalized = normalizeExerciseLookupName(exercise.exerciseName || exercise.name || '');
      if (!normalized || exerciseMetaByName.has(normalized)) return;
      exerciseMetaByName.set(normalized, exercise);
    });

    const summaryExercises: SummaryExercise[] = [];
    const completedMuscleCount = new Map<string, number>();
    let durationSeconds = 0;

    Object.entries(setsByExercise).forEach(([exerciseName, rows]) => {
      const safeName = String(exerciseName || '').trim();
      if (!safeName || !Array.isArray(rows)) return;

      const completedRows = rows.filter((row) => isSetCompleted(row));
      if (!completedRows.length) return;

      const normalizedName = normalizeExerciseLookupName(safeName);
      const meta = exerciseMetaByName.get(normalizedName) || null;

      const sets = completedRows.map((row: any, index: number) => ({
        set: Math.max(1, Math.round(Number(row?.set || index + 1))),
        reps: Math.max(0, Math.round(Number(row?.reps || 0))),
        weight: Number(Number(row?.weight || 0).toFixed(2)),
      }));

      const totalReps = sets.reduce((acc, setRow) => acc + setRow.reps, 0);
      const topWeight = sets.reduce((max, setRow) => Math.max(max, setRow.weight), 0);
      const volume = Number(
        sets
          .reduce((acc, setRow) => acc + (setRow.reps * setRow.weight), 0)
          .toFixed(2),
      );

      const targetMuscles = (
        Array.isArray(meta?.targetMuscles) && meta.targetMuscles.length
          ? meta.targetMuscles.map((entry: unknown) => normalizeMuscleName(String(entry || '')))
          : meta?.muscleGroup
            ? [normalizeMuscleName(String(meta.muscleGroup || ''))]
            : inferMusclesFromExerciseName(safeName)
      ).filter(Boolean);

      targetMuscles.forEach((muscle) => {
        completedMuscleCount.set(muscle, (completedMuscleCount.get(muscle) || 0) + 1);
      });

      const rowDuration = completedRows.reduce((acc: number, row: any) => {
        const work = Math.max(0, Math.round(Number(row?.duration || 0)));
        const rest = Math.max(0, Math.round(Number(row?.restTime || 0)));
        if (!work && !rest) return acc + 45;
        return acc + work + rest;
      }, 0);

      durationSeconds += rowDuration;
      summaryExercises.push({
        name: safeName,
        sets,
        totalSets: sets.length,
        totalReps,
        topWeight,
        volume,
        targetMuscles,
      });
    });

    if (!summaryExercises.length) return null;

    if (durationSeconds <= 0) {
      durationSeconds = summaryExercises.reduce((acc, exercise) => acc + (exercise.totalSets * 90), 0);
    }

    const totalVolume = Number(
      summaryExercises.reduce((acc, exercise) => acc + Number(exercise.volume || 0), 0).toFixed(2),
    );
    const estimatedCalories = Math.max(
      1,
      Math.round((durationSeconds / 60) * 7 + (totalVolume * 0.015)),
    );

    const plannedMuscleCount = new Map<string, number>();
    todayExercises.forEach((exercise: any) => {
      const muscles = Array.isArray(exercise?.targetMuscles) && exercise.targetMuscles.length
        ? exercise.targetMuscles.map((entry: unknown) => normalizeMuscleName(String(entry || '')))
        : exercise?.muscleGroup
          ? [normalizeMuscleName(String(exercise.muscleGroup || ''))]
          : inferMusclesFromExerciseName(String(exercise?.exerciseName || exercise?.name || ''));

      muscles
        .filter(Boolean)
        .forEach((muscle) => {
          plannedMuscleCount.set(muscle, (plannedMuscleCount.get(muscle) || 0) + 1);
        });
    });

    const muscleNames = new Set<string>([
      ...Array.from(plannedMuscleCount.keys()),
      ...Array.from(completedMuscleCount.keys()),
    ]);

    const muscles: SummaryMuscle[] = Array.from(muscleNames)
      .map((muscleName) => {
        const plannedCount = plannedMuscleCount.get(muscleName) || 0;
        const completedCount = completedMuscleCount.get(muscleName) || 0;
        const score = plannedCount > 0
          ? Math.round((completedCount / plannedCount) * 100)
          : 100;
        return {
          name: muscleName,
          score: Math.max(0, Math.min(100, score)),
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 10);

    const todayDate = formatDateISO(new Date());
    const recordsByExercise = await Promise.all(
      summaryExercises.map(async (exercise) => {
        if (!userId || exercise.topWeight <= 0) return 0;
        try {
          const historyRows = await api.getWorkoutHistory(userId, exercise.name);
          const previousMax = (Array.isArray(historyRows) ? historyRows : [])
            .filter((row: any) => {
              const createdAt = row?.created_at ? new Date(row.created_at) : null;
              const dateKey = createdAt && !Number.isNaN(createdAt.getTime())
                ? formatDateISO(createdAt)
                : '';
              const completedFlag = Number(row?.completed ?? 1);
              return dateKey && dateKey < todayDate && completedFlag === 1;
            })
            .reduce((max: number, row: any) => {
              const weight = Number(row?.weight || 0);
              return Number.isFinite(weight) ? Math.max(max, weight) : max;
            }, 0);
          return exercise.topWeight > previousMax ? 1 : 0;
        } catch {
          return 0;
        }
      }),
    );

    const recordsCount = recordsByExercise.reduce((acc, value) => acc + value, 0);
    const summaryDate = formatDateISO(new Date());

    return {
      summaryDate,
      workoutName: String(currentWorkoutName || workoutDay || 'Workout').trim() || 'Workout',
      durationSeconds,
      estimatedCalories,
      totalVolume,
      recordsCount,
      muscles,
      exercises: summaryExercises,
      summaryText: '',
    };
  };

  const saveAndShowWorkoutSummary = async (
    setsByExercise: Record<string, any[]>,
    openAfterSave: boolean,
  ) => {
    if (!userId) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const generated = await buildWorkoutSummary(setsByExercise);
      if (!generated) {
        setSummaryError('No completed workout sets were found for today.');
        if (openAfterSave) setView('summary');
        return;
      }

      const summaryText = buildSummaryShareText(generated);
      const payload = {
        userId,
        summaryDate: generated.summaryDate || formatDateISO(new Date()),
        workoutName: generated.workoutName,
        durationSeconds: generated.durationSeconds,
        estimatedCalories: generated.estimatedCalories,
        totalVolume: generated.totalVolume,
        recordsCount: generated.recordsCount,
        muscles: generated.muscles,
        exercises: generated.exercises,
        summaryText,
      };

      try {
        await api.completeWorkoutDaySession({
          userId,
          summaryDate: payload.summaryDate,
          workoutName: payload.workoutName,
          durationSeconds: payload.durationSeconds,
          muscles: payload.muscles,
          exercises: payload.exercises,
        });
        window.dispatchEvent(new CustomEvent('gamification-updated'));
      } catch (sessionError) {
        console.error('Failed to finalize workout session:', sessionError);
      }

      const response = await api.saveWorkoutDaySummary(payload);
      const normalizedSummary = normalizeWorkoutSummary(response?.summary) || {
        ...generated,
        summaryText,
      };
      setSummary(normalizedSummary);
      setHasLatestSummary(true);
      if (openAfterSave) setView('summary');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save workout summary.';
      setSummaryError(message);
      if (openAfterSave) setView('summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const openLatestSummary = async () => {
    if (!userId) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const response = await api.getLatestWorkoutDaySummary(userId);
      const latestSummary = normalizeWorkoutSummary(response?.summary);
      if (!latestSummary) {
        setSummary(null);
        setSummaryError('No workout summary found yet. Finish a workout day first.');
        setHasLatestSummary(false);
      } else {
        setSummary(latestSummary);
        setHasLatestSummary(true);
      }
      setView('summary');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load latest workout summary.';
      setSummaryError(message);
      setSummary(null);
      setView('summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const shareSummary = async (summaryData: WorkoutDaySummaryData) => {
    const shareText = buildSummaryShareText(summaryData);
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const sharePayload = {
      title: `${summaryData.workoutName} recap`,
      text: shareText,
      url,
    };

    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      await (navigator as any).share(sharePayload);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${shareText}${url ? `\n${url}` : ''}`);
      return;
    }

    throw new Error('Sharing is not available on this device.');
  };

  const getWorkoutSummaryBlogTokens = (summaryData: WorkoutDaySummaryData) => {
    const tokens: string[] = [];
    const summaryId = Number(summaryData.id || 0);
    if (Number.isInteger(summaryId) && summaryId > 0) {
      tokens.push(`summary_${summaryId}`);
    }

    const workoutNameKey = normalizeExerciseLookupName(summaryData.workoutName || '');
    const summaryDateKey = String(summaryData.summaryDate || formatDateISO(new Date())).trim();
    if (workoutNameKey && summaryDateKey) {
      tokens.push(`${summaryDateKey}:${workoutNameKey}`);
    }

    return [...new Set(tokens)];
  };

  const hasSummaryBeenPostedToBlog = (summaryData: WorkoutDaySummaryData | null) => {
    if (!summaryData) return false;
    return getWorkoutSummaryBlogTokens(summaryData).some((token) => postedSummaryTokens.includes(token));
  };

  const markSummaryPostedToBlog = (summaryData: WorkoutDaySummaryData) => {
    const tokens = getWorkoutSummaryBlogTokens(summaryData);
    if (!tokens.length) return;

    setPostedSummaryTokens((prev) => {
      const next = [...new Set([...prev, ...tokens])];
      if (next.length === prev.length) return prev;
      localStorage.setItem(workoutSummaryStorageKeys.blogPostedSummaries, JSON.stringify(next));
      return next;
    });
  };

  const postSummaryToBlog = async (summaryData: WorkoutDaySummaryData) => {
    if (!userId) throw new Error('User is not authenticated.');
    if (hasSummaryBeenPostedToBlog(summaryData)) {
      return;
    }

    const description = [
      `Workout complete: ${summaryData.workoutName}`,
      `Duration: ${Math.round(summaryData.durationSeconds / 60)} min`,
      `Volume: ${Math.round(summaryData.totalVolume).toLocaleString()} kg`,
      `Energy: ${summaryData.estimatedCalories.toLocaleString()} kcal`,
      `Exercises: ${summaryData.exercises.length}`,
      '#WorkoutRecap #RepSet',
    ].join('\n');

    const mediaUrl = buildSummaryImageDataUrl(summaryData);
    await api.createBlogPost({
      userId,
      description,
      category: 'Training',
      mediaType: 'image',
      mediaUrl,
      mediaAlt: `${summaryData.workoutName} workout recap`,
    });
    markSummaryPostedToBlog(summaryData);
  };

  const updateExerciseSets = (sets: Record<string, any[]>) => {
    setExerciseSets(sets);
    localStorage.setItem(workoutStorageKeys.exerciseSets, JSON.stringify(sets));

    const coreExercises = todayExercises.filter((ex: any) => !ex?.isExtra);
    const plannedSetsByExercise = new Map(
      coreExercises.map((ex: any) => [normalizeExerciseName(ex.exerciseName), Number(ex.sets || 0)]),
    );

    const completed = Object.keys(sets).filter((exerciseName) => {
      const currentExerciseSets = sets[exerciseName] || [];
      const plannedSetCount = Number(plannedSetsByExercise.get(normalizeExerciseName(exerciseName)) || 0);
      const completedCount = currentExerciseSets.filter((s: any) => isSetCompleted(s)).length;

      if (plannedSetCount > 0) {
        return completedCount >= plannedSetCount;
      }

      return currentExerciseSets.length > 0 && currentExerciseSets.every((s: any) => isSetCompleted(s));
    });

    setCompletedExercises(completed);
    localStorage.setItem(workoutStorageKeys.completedExercises, JSON.stringify(completed));

    const normalizedSetsByExercise = new Map<string, any[]>();
    Object.entries(sets).forEach(([exerciseName, setRows]) => {
      const normalizedName = normalizeExerciseName(exerciseName);
      if (!normalizedName) return;
      normalizedSetsByExercise.set(normalizedName, Array.isArray(setRows) ? setRows : []);
    });

    let totalTargetSets = 0;
    let totalCompletedSets = 0;
    plannedSetsByExercise.forEach((plannedSetCount, exerciseName) => {
      const setRows = normalizedSetsByExercise.get(exerciseName) || [];
      const completedCount = setRows.filter((s: any) => isSetCompleted(s)).length;
      const targetSetCount = Math.max(plannedSetCount, setRows.length);
      totalTargetSets += targetSetCount;
      totalCompletedSets += Math.min(completedCount, targetSetCount);
    });

    const workoutProgress = totalTargetSets > 0
      ? Math.min(100, Math.round((totalCompletedSets / totalTargetSets) * 100))
      : 0;
    localStorage.setItem(homeMetricStorageKeys.homeWorkoutProgress, String(workoutProgress));
    window.dispatchEvent(new CustomEvent('workout-progress-updated'));

    const plannedExerciseNames = coreExercises.map((ex: any) => normalizeExerciseName(ex.exerciseName));
    const completedNormalized = new Set(completed.map(normalizeExerciseName));
    const allPlannedDone =
      plannedExerciseNames.length > 0 &&
      plannedExerciseNames.every((exerciseName: string) => completedNormalized.has(exerciseName));

    if (allPlannedDone) {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      const currentUserId = Number(user?.id || 0);
      const todayKey = new Date().toDateString();
      const finalizeKey = `recoveryFinalized:${currentUserId}:${todayKey}`;

      const finalizeRecovery = async () => {
        if (!currentUserId || localStorage.getItem(finalizeKey) === 'true') {
          localStorage.setItem('recoveryNeedsUpdate', 'true');
          window.dispatchEvent(new CustomEvent('recovery-updated'));
          return;
        }

        try {
          await api.recalculateTodayRecovery(currentUserId);
          localStorage.setItem(finalizeKey, 'true');
          localStorage.setItem('recoveryNeedsUpdate', 'true');
          window.dispatchEvent(new CustomEvent('recovery-updated'));
        } catch (error) {
          console.error('Failed to finalize recovery:', error);
        }
      };

      void finalizeRecovery();

      const summaryKey = `${formatDateISO(new Date())}:${String(currentWorkoutName || '').trim().toLowerCase()}`;
      if (lastAutoSummaryKey !== summaryKey) {
        setLastAutoSummaryKey(summaryKey);
        void saveAndShowWorkoutSummary(sets, true);
      }
    }
  };

  const markTodayWorkoutAsMissed = async () => {
    if (!userId) {
      return { missed: false, reason: 'User is not authenticated.' };
    }

    try {
      const response = await api.markTodayWorkoutMissed(userId);
      try {
        await api.recalculateTodayRecovery(userId);
      } catch (recoveryError) {
        console.error('Failed to recalculate recovery after missed day:', recoveryError);
      }
      clearLocalWorkoutState(workoutStorageScope);
      setTodayExercises([]);
      setCompletedExercises([]);
      setExerciseSets({});
      setCurrentWorkoutName('Rest Day');
      localStorage.setItem(homeMetricStorageKeys.homeWorkoutProgress, '0');
      localStorage.setItem('recoveryNeedsUpdate', 'true');
      window.dispatchEvent(new CustomEvent('program-updated'));
      window.dispatchEvent(new CustomEvent('workout-progress-updated'));
      window.dispatchEvent(new CustomEvent('recovery-updated'));
      onBack();
      return {
        missed: true,
        workoutName: String(response?.workoutName || currentWorkoutName || '').trim() || 'Workout',
      };
    } catch (error) {
      return {
        missed: false,
        reason: error instanceof Error ? error.message : 'Failed to mark this workout as missed.',
      };
    }
  };

  if (view === 'plan') {
    return (
      <WorkoutPlanScreen
        onBack={onBack}
        onExerciseClick={(exercise) => {
          setSelectedExercise(exercise);
          setView('tracker');
        }}
        onPreviewExercise={(exercise) => {
          setSelectedExercise(exercise);
          setVideoReturnView('plan');
          setView('video');
        }}
        onAddExercise={addExerciseToToday}
        onOpenLatestSummary={() => {
          void openLatestSummary();
        }}
        onMissDay={markTodayWorkoutAsMissed}
        hasLatestSummary={hasLatestSummary}
        workoutDay={currentWorkoutName}
        workoutDayLabel={currentWorkoutDayLabel}
        completedExercises={completedExercises}
        todayExercises={todayExercises}
        loading={loading}
      />
    );
  }

  if (view === 'tracker') {
    const selectedWorkoutExercise = todayExercises.find(
      (exercise) => normalizeExerciseName(exercise.exerciseName) === normalizeExerciseName(selectedExercise),
    );
    return (
      <TrackerScreen
        onBack={() => setView('plan')}
        exerciseName={selectedExercise}
        plannedSets={getPlannedSetsForExercise(selectedExercise) || undefined}
        onVideoClick={(exerciseName) => {
          setSelectedExercise(exerciseName);
          setVideoReturnView('tracker');
          setView('video');
        }}
        savedSets={exerciseSets[selectedExercise]}
        onSaveSets={(sets) => updateExerciseSets({ ...exerciseSets, [selectedExercise]: sets })}
        onRemoveExercise={selectedWorkoutExercise ? async () => removeExerciseFromToday(selectedWorkoutExercise.exerciseName) : undefined}
      />
    );
  }

  if (view === 'video') {
    const selectedWorkoutExercise = todayExercises.find(
      (exercise) => normalizeExerciseName(exercise.exerciseName) === normalizeExerciseName(selectedExercise),
    );
    const resolvedExerciseName = String(selectedWorkoutExercise?.exerciseName || selectedExercise || '').trim() || selectedExercise;
    const inferredMuscles = inferMusclesFromExerciseName(resolvedExerciseName);
    const primaryMuscle =
      String(
        selectedWorkoutExercise?.muscleGroup
        || selectedWorkoutExercise?.targetMuscles?.[0]
        || inferredMuscles[0]
        || 'General',
      ).trim()
      || 'General';
    const videoBodyPartHint =
      String(selectedWorkoutExercise?.muscleGroup || inferredMuscles[0] || primaryMuscle).trim()
      || 'General';
    const targetMuscles = Array.isArray(selectedWorkoutExercise?.targetMuscles)
      ? selectedWorkoutExercise.targetMuscles.join(', ')
      : primaryMuscle;
    return (
      <ExerciseVideoScreen
        onBack={() => setView(videoReturnView)}
        exercise={{
          name: resolvedExerciseName,
          muscle: primaryMuscle,
          targetMuscles,
          importance: `Technique reference for ${resolvedExerciseName}.`,
          anatomy: targetMuscles,
          video: resolveExerciseVideoUrl({
            name: resolvedExerciseName,
            muscle: primaryMuscle,
            bodyPart: videoBodyPartHint,
          }),
        }}
      />
    );
  }

  if (view === 'live') {
    return <LiveWorkoutScreen onFinish={() => setView('summary')} />;
  }

  if (view === 'summary') {
    return (
      <PostWorkoutSummary
        onClose={() => setView('plan')}
        summary={summary}
        loading={summaryLoading}
        error={summaryError}
        onShare={shareSummary}
        onPostToBlog={postSummaryToBlog}
        blogPosted={hasSummaryBeenPostedToBlog(summary)}
      />
    );
  }

  return <WorkoutOverviewScreen onStart={() => setView('live')} onBack={onBack} />;
}
