import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CoachmarkOverlay, type CoachmarkStep } from '../components/coachmarks/CoachmarkOverlay';
import { WorkoutOverviewScreen } from '../components/workout/WorkoutOverviewScreen';
import { LiveWorkoutScreen } from '../components/workout/LiveWorkoutScreen';
import { PostWorkoutSummary, type WorkoutDaySummaryData } from '../components/workout/PostWorkoutSummary';
import { T2PostWorkoutCheckInCard } from '../components/workout/T2PostWorkoutCheckInCard';
import { ExerciseVideoScreen } from '../components/workout/ExerciseVideoScreen';
import { WorkoutPlanScreen } from '../components/workout/WorkoutPlanScreen';
import { TrackerScreen } from '../components/workout/TrackerScreen';
import { PresetProgramScreen } from '../components/profile/PresetProgramScreen';
import { CustomPlanBuilderScreen } from '../components/profile/CustomPlanBuilderScreen';
import { api } from '../services/api';
import {
  getCoachmarkUserScope,
  patchCoachmarkProgress,
  readCoachmarkProgress,
  WORKOUT_PLAN_COACHMARK_TOUR_ID,
  WORKOUT_PLAN_COACHMARK_VERSION,
  WORKOUT_TRACKER_COACHMARK_TOUR_ID,
  WORKOUT_TRACKER_COACHMARK_VERSION,
} from '../services/coachmarks';
import { resolveExerciseVideoUrl } from '../services/exerciseVideos';
import { formatWorkoutDayLabel, normalizeWorkoutDayKey } from '../services/workoutDayLabel';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../services/language';
import {
  clearTodayWorkoutSelection,
  markTodayWorkoutSelectionCompleted,
  readTodayWorkoutSelection,
  readWorkoutAssignmentHistory,
  saveTodayWorkoutSelection,
  TODAY_WORKOUT_SELECTION_UPDATED_EVENT,
  type TodayWorkoutSelection,
  type WorkoutAssignmentHistoryEntry,
} from '../services/todayWorkoutSelection';
import { OPEN_PICKED_WORKOUT_PLAN } from '../services/workoutNavigation';
import { getActiveT2PremiumConfig } from '../services/premiumPlan';
import { useScrollToTopOnChange } from '../shared/scroll';

interface WorkoutProps {
  onBack: () => void;
  workoutDay?: string;
  openPickedPlan?: boolean;
  resetSignal?: number;
  guidedTourActive?: boolean;
  onGuidedTourComplete?: () => void;
  onGuidedTourDismiss?: () => void;
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

type WeekPlanWorkout = {
  key: string;
  id: number | null;
  dayKey: string;
  dayLabel: string;
  workoutName: string;
  exercises: TodayWorkoutExercise[];
  isToday: boolean;
  dayOrder: number;
};

type RecoveryMuscleStatus = {
  name: string;
  score: number;
};

type ViewState = 'overview' | 'plan' | 'tracker' | 'video' | 'live' | 'summary' | 'presetPlans' | 'customPlanBuilder';

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

type CoachOption = {
  id: number;
  name: string;
  email?: string;
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
      exerciseSnapshot: [] as any[],
      hasExerciseSnapshot: false,
    };
  }

  let completedExercises: string[] = [];
  let exerciseSets: Record<string, any[]> = {};
  let extraExercises: any[] = [];
  let exerciseSnapshot: any[] = [];
  let hasExerciseSnapshot = false;

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

  try {
    const snapshotRaw = localStorage.getItem(keys.exerciseSnapshot);
    hasExerciseSnapshot = snapshotRaw !== null;
    if (snapshotRaw !== null) {
      const parsedSnapshot = JSON.parse(snapshotRaw);
      exerciseSnapshot = Array.isArray(parsedSnapshot) ? parsedSnapshot : [];
    }
  } catch {
    exerciseSnapshot = [];
    hasExerciseSnapshot = false;
  }

  return { completedExercises, exerciseSets, extraExercises, exerciseSnapshot, hasExerciseSnapshot };
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

const parseWorkoutExercisesPayload = (raw: unknown, isExtra: boolean) => {
  if (Array.isArray(raw)) {
    return raw.map((entry: any) => normalizeWorkoutExerciseEntry(entry, isExtra));
  }

  if (typeof raw !== 'string') return [] as TodayWorkoutExercise[];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((entry: any) => normalizeWorkoutExerciseEntry(entry, isExtra));
    }
  } catch {
    // Ignore malformed serialized exercise payloads.
  }

  return [] as TodayWorkoutExercise[];
};

const hasCoachmarkTargets = (steps: CoachmarkStep[]) =>
  typeof document !== 'undefined'
  && steps.every((step) => Boolean(document.querySelector(`[data-coachmark-target="${step.targetId}"]`)));

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

const buildWeekPlanWorkouts = (program: any): WeekPlanWorkout[] => {
  const weeklyWorkouts = Array.isArray(program?.currentWeekWorkouts)
    ? program.currentWeekWorkouts
    : Array.isArray(program?.workouts)
      ? program.workouts
      : [];
  const todayPayload = resolveTodayWorkoutPayload(program);
  const clientWeekdayKey = normalizeWorkoutDayKey(new Date().toLocaleDateString('en-US', { weekday: 'long' }));
  const todayNameKey = normalizeExerciseLookupName(todayPayload?.name || program?.todayWorkout?.name || '');

  const normalized = weeklyWorkouts
    .map((workout: any, index: number) => {
      const exercises = parseWorkoutExercisesPayload(workout?.exercises, false);
      const dayKey = normalizeWorkoutDayKey(workout?.day_name);
      const workoutName = resolveWorkoutDisplayName(workout?.workout_name || '', exercises);
      const isToday = !!(
        (dayKey && dayKey === clientWeekdayKey)
        || (!dayKey && normalizeExerciseLookupName(workoutName) === todayNameKey)
      );

      return {
        key: String(workout?.id || `${dayKey || 'day'}-${index}`),
        id: Number(workout?.id || 0) || null,
        dayKey,
        dayLabel: formatWorkoutDayLabel(dayKey, `Day ${Number(workout?.day_order || index + 1)}`),
        workoutName,
        exercises,
        isToday,
        dayOrder: Number(workout?.day_order || index + 1) || (index + 1),
      };
    })
    .sort((left, right) => left.dayOrder - right.dayOrder);

  if (todayPayload && !normalized.some((workout) => workout.isToday)) {
    normalized.unshift({
      key: 'today',
      id: null,
      dayKey: clientWeekdayKey,
      dayLabel: todayPayload.dayLabel,
      workoutName: todayPayload.name,
      exercises: Array.isArray(todayPayload.exercises) ? todayPayload.exercises : [],
      isToday: true,
      dayOrder: 0,
    });
  }

  return normalized;
};

const findNextWeekPlanWorkout = (workouts: WeekPlanWorkout[], currentWorkoutKey?: string | null) => {
  if (!Array.isArray(workouts) || workouts.length === 0) return null;
  if (!currentWorkoutKey) return workouts[0] || null;

  const currentIndex = workouts.findIndex((workout) => workout.key === currentWorkoutKey);
  if (currentIndex < 0) return workouts[0] || null;
  return workouts[currentIndex + 1] || null;
};

const hasWorkoutExercises = (workout: WeekPlanWorkout | null | undefined) =>
  !!(workout && Array.isArray(workout.exercises) && workout.exercises.length > 0);

const getWorkoutTargetMuscles = (workout: WeekPlanWorkout | null | undefined) => {
  if (!workout || !Array.isArray(workout.exercises)) return [] as string[];

  return Array.from(
    new Set(
      workout.exercises
        .flatMap((exercise) => (
          Array.isArray(exercise.targetMuscles) && exercise.targetMuscles.length
            ? exercise.targetMuscles
            : exercise.muscleGroup
              ? [exercise.muscleGroup]
              : inferMusclesFromExerciseName(exercise.exerciseName)
        ))
        .map((entry) => normalizeMuscleName(String(entry || '')))
        .filter(Boolean),
    ),
  );
};

const pickRecommendedWorkoutByRecovery = (
  workouts: WeekPlanWorkout[],
  recoveryStatuses: RecoveryMuscleStatus[],
  excludedWorkoutKey?: string | null,
) => {
  if (!Array.isArray(recoveryStatuses) || recoveryStatuses.length === 0) return null;

  const recoveryByMuscle = new Map(
    recoveryStatuses.map((entry) => [normalizeMuscleName(entry.name), Math.max(0, Math.min(100, Math.round(entry.score)))]),
  );

  const candidates = workouts
    .filter((workout) => hasWorkoutExercises(workout) && workout.key !== excludedWorkoutKey)
    .map((workout) => {
      const targetMuscles = getWorkoutTargetMuscles(workout);
      const scores = targetMuscles.map((muscle) => recoveryByMuscle.get(muscle) ?? 100);
      const minScore = scores.length ? Math.min(...scores) : 100;
      const averageScore = scores.length
        ? scores.reduce((sum, value) => sum + value, 0) / scores.length
        : 100;
      const fullyRecovered = scores.every((score) => score >= 100);

      return {
        workout,
        targetMuscles,
        minScore,
        averageScore,
        fullyRecovered,
      };
    });

  const fullyRecoveredCandidates = candidates.filter((candidate) => candidate.fullyRecovered);
  if (!fullyRecoveredCandidates.length) return null;

  fullyRecoveredCandidates.sort((left, right) => {
    if (right.averageScore !== left.averageScore) return right.averageScore - left.averageScore;
    if (right.targetMuscles.length !== left.targetMuscles.length) return right.targetMuscles.length - left.targetMuscles.length;
    return left.workout.dayOrder - right.workout.dayOrder;
  });

  return fullyRecoveredCandidates[0]?.workout || null;
};

export function Workout({
  onBack,
  workoutDay = 'Push Day',
  openPickedPlan = false,
  resetSignal = 0,
  guidedTourActive = false,
  onGuidedTourComplete,
  onGuidedTourDismiss,
}: WorkoutProps) {
  const currentUser = readStoredUser();
  const userId = Number(currentUser?.id || 0);
  const workoutStorageScope = getUserStorageScope(currentUser);
  const workoutStorageKeys = getWorkoutStorageKeys(workoutStorageScope);
  const homeMetricStorageKeys = getHomeMetricStorageKeys(workoutStorageScope);
  const workoutSummaryStorageKeys = getWorkoutSummaryStorageKeys(workoutStorageScope);
  const initialWorkoutDay = workoutDay === OPEN_PICKED_WORKOUT_PLAN ? 'Workout' : workoutDay;

  const [view, setView] = useState<ViewState>('overview');
  const [videoReturnView, setVideoReturnView] = useState<ViewState>('tracker');
  const [selectedExercise, setSelectedExercise] = useState('Bench Press');
  const [currentWorkoutName, setCurrentWorkoutName] = useState(initialWorkoutDay);
  const [currentWorkoutDayLabel, setCurrentWorkoutDayLabel] = useState(
    formatWorkoutDayLabel(new Date().toLocaleDateString('en-US', { weekday: 'long' }), initialWorkoutDay),
  );
  const [todayExercises, setTodayExercises] = useState<TodayWorkoutExercise[]>([]);
  const [weekPlanWorkouts, setWeekPlanWorkouts] = useState<WeekPlanWorkout[]>([]);
  const [selectedWorkoutKey, setSelectedWorkoutKey] = useState('');
  const [todayWorkoutSelection, setTodayWorkoutSelection] = useState<TodayWorkoutSelection | null>(
    () => readTodayWorkoutSelection(workoutStorageScope),
  );
  const [workoutAssignmentHistory, setWorkoutAssignmentHistory] = useState<WorkoutAssignmentHistoryEntry[]>(
    () => readWorkoutAssignmentHistory(workoutStorageScope),
  );
  const [userProgram, setUserProgram] = useState<any>(null);
  const [programProgress, setProgramProgress] = useState<any>(null);
  const [recoveryStatuses, setRecoveryStatuses] = useState<RecoveryMuscleStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completedExercises, setCompletedExercises] = useState<string[]>([]);
  const [exerciseSets, setExerciseSets] = useState<Record<string, any[]>>({});
  const [summary, setSummary] = useState<WorkoutDaySummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [hasLatestSummary, setHasLatestSummary] = useState(false);
  const [lastAutoSummaryKey, setLastAutoSummaryKey] = useState('');
  const [postedSummaryTokens, setPostedSummaryTokens] = useState<string[]>([]);
  const [isPlanChoiceOpen, setIsPlanChoiceOpen] = useState(false);
  const [isCoachPickerOpen, setIsCoachPickerOpen] = useState(false);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(false);
  const [coachRequestingId, setCoachRequestingId] = useState<number | null>(null);
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [coachmarkMode, setCoachmarkMode] = useState<'plan' | 'tracker' | null>(null);
  const [coachmarkStepIndex, setCoachmarkStepIndex] = useState(0);

  useScrollToTopOnChange([view, resetSignal]);

  useEffect(() => {
    const handleLanguageChanged = () => {
      setLanguage(getActiveLanguage());
    };

    handleLanguageChanged();
    window.addEventListener('app-language-changed', handleLanguageChanged);
    return () => window.removeEventListener('app-language-changed', handleLanguageChanged);
  }, []);

  useEffect(() => {
    if (!openPickedPlan || loading) return;

    setView(todayWorkoutSelection?.workoutKey ? 'plan' : 'overview');
  }, [loading, openPickedPlan, todayWorkoutSelection?.workoutKey]);

  const normalizeExerciseName = (name: string) => String(name || '').trim().toLowerCase();
  const isSetCompleted = (setRow: any) =>
    !!(
      setRow?.completed
      ?? setRow?.isCompleted
      ?? setRow?.done
      ?? false
    );

  const isArabic = language === 'ar';
  const activeT2PremiumConfig = useMemo(
    () => getActiveT2PremiumConfig(userProgram),
    [userProgram],
  );
  const renewalCopy = useMemo(
    () => ({
      modalTitle: isArabic ? 'أنشئ خطة تمريني' : 'Create My Workout Plan',
      modalBody: isArabic ? 'اختر طريقة بناء خطتك.' : 'Choose how you want to build your next plan.',
      buildSolo: isArabic ? 'إنشاء بنفسي' : 'Build By Myself',
      withCoach: isArabic ? 'مع مدرب' : 'With Coach',
      chooseCoach: isArabic ? 'اختر مدرباً' : 'Choose a Coach',
      chooseCoachBody: isArabic ? 'اختر مدرباً لإرسال طلب خطة جديدة.' : 'Choose a coach to request a new plan.',
      loadingCoaches: isArabic ? 'جارٍ تحميل المدربين...' : 'Loading coaches...',
      noCoaches: isArabic ? 'لا يوجد مدربون متاحون الآن.' : 'No coaches are available right now.',
      sending: isArabic ? 'جارٍ الإرسال' : 'Sending',
      requestSent: isArabic ? 'تم إرسال طلب الخطة إلى' : 'Plan request sent to',
      requestFailed: isArabic ? 'تعذر إرسال طلب الخطة.' : 'Failed to send plan request.',
      completedTitle: isArabic ? 'خطة مكتملة' : 'Plan Complete',
      completedSubtitle: isArabic ? 'أنشئ خطة جديدة' : 'Create a new plan',
    }),
    [isArabic],
  );
  const hasStartedTodayWorkout = useMemo(() => {
    if (!todayWorkoutSelection?.workoutKey) return false;
    if (todayWorkoutSelection.completed) return true;
    if (completedExercises.length > 0) return true;

    return Object.values(exerciseSets).some((setRows) =>
      Array.isArray(setRows) && setRows.some((setRow) => isSetCompleted(setRow)),
    );
  }, [
      completedExercises,
      exerciseSets,
      todayWorkoutSelection?.completed,
      todayWorkoutSelection?.workoutKey,
    ]);
  const isPlanCompleted = useMemo(() => {
    const summary = programProgress?.summary;
    const totalWeeks = Number(summary?.totalWeeks || userProgram?.totalWeeks || 0);
    if (!programProgress?.hasActiveProgram || totalWeeks <= 0) return false;

    const plannedWorkouts = Number(summary?.plannedWorkouts || 0);
    const completedWorkouts = Number(summary?.completedWorkouts || 0);
    const calendarDaysLeft = Number(summary?.calendarDaysLeft ?? -1);

    if (plannedWorkouts > 0 && completedWorkouts >= plannedWorkouts) {
      return true;
    }

    return calendarDaysLeft === 0;
  }, [programProgress, userProgram?.totalWeeks]);
  const coachmarkScope = getCoachmarkUserScope(currentUser);
  const planCoachmarkOptions = useMemo(
    () => ({
      tourId: WORKOUT_PLAN_COACHMARK_TOUR_ID,
      version: WORKOUT_PLAN_COACHMARK_VERSION,
      userScope: coachmarkScope,
      defaultSeenSteps: {
        back: false,
        current_day_gradient: false,
        current_day: false,
        agenda: false,
        week_card: false,
        action_button: false,
      },
    }),
    [coachmarkScope],
  );
  const trackerCoachmarkOptions = useMemo(
    () => ({
      tourId: WORKOUT_TRACKER_COACHMARK_TOUR_ID,
      version: WORKOUT_TRACKER_COACHMARK_VERSION,
      userScope: coachmarkScope,
      defaultSeenSteps: {
        back: false,
        remove: false,
        timer: false,
        start_stop: false,
        video: false,
        analytics: false,
        set_row: false,
        add_set: false,
      },
    }),
    [coachmarkScope],
  );
  const coachmarkCopy = useMemo(
    () => ({
      next: isArabic ? 'التالي' : 'Next',
      skip: isArabic ? 'تخطي' : 'Skip',
      finish: isArabic ? 'حسناً' : 'Got it',
      tryIt: isArabic ? 'جرّبه الآن' : 'Try it now',
      planBackTitle: isArabic ? 'ارجع وقت ما تحتاج' : 'Go back anytime',
      planBackBody: isArabic
        ? 'هذا الزر يعيدك للشاشة السابقة بدون أن تفقد تقدمك في التمرين.'
        : 'Use this to return to the previous screen without losing your workout progress.',
      planMissTitle: isArabic ? 'إذا احتجت تفويت اليوم' : 'If you need to skip today',
      planMissBody: isArabic
        ? 'هذا الزر مخصص لتفويت الجلسة المجدولة اليوم عندما تتعذر عليك التمرين.'
        : 'This button marks the scheduled session as missed when you cannot train today.',
      planSummaryTitle: isArabic ? 'راجع آخر جلسة' : 'Review your last session',
      planSummaryBody: isArabic
        ? 'افتح آخر ملخص تمرين بسرعة لتتذكر أداءك قبل أن تبدأ.'
        : 'Open your latest workout summary to quickly remember how your last session went.',
      planWorkoutTitle: isArabic ? 'هذه خطة اليوم' : 'This is today’s plan',
      planWorkoutBody: isArabic
        ? 'هنا ترى اسم الحصة الحالية حتى تعرف بالضبط ماذا ستتمرن اليوم.'
        : 'This card shows the current session so you know exactly what you are training today.',
      planMusclesTitle: isArabic ? 'لماذا هذا التمرين؟' : 'Why this workout matters',
      planMusclesBody: isArabic
        ? 'هذه البطاقات توضح العضلات المستهدفة ونسبة تركيز الحصة على كل عضلة.'
        : 'These cards show the muscles this workout targets and how much focus each one gets.',
      planAddTitle: isArabic ? 'أضف تمريناً عند الحاجة' : 'Add an exercise when needed',
      planAddBody: isArabic
        ? 'من هنا يمكنك إضافة تمرين إضافي لليوم إذا أردت تعديل الحصة.'
        : 'Use this to add an extra exercise when you want to customize today’s session.',
      planStartTitle: isArabic ? 'ابدأ بسرعة' : 'Start quickly',
      planStartBody: isArabic
        ? 'هذا الزر يرسلك مباشرة إلى أول تمرين غير مكتمل لتبدأ أسرع.'
        : 'This button jumps straight into your next unfinished exercise.',
      planExerciseTitle: isArabic ? 'اختر أي تمرين' : 'Pick any exercise',
      planExerciseBody: isArabic
        ? 'افتح بطاقة التمرين لرؤية المتتبع وتسجيل التكرارات والأوزان خطوة بخطوة.'
        : 'Open an exercise card to see the tracker and log reps and weight step by step.',
      trackerBackTitle: isArabic ? 'الرجوع للخطة' : 'Back to the plan',
      trackerBackBody: isArabic
        ? 'ارجع إلى قائمة تمارين اليوم في أي وقت من هنا.'
        : 'Use this to return to your workout plan at any time.',
      trackerRemoveTitle: isArabic ? 'احذف إذا لزم' : 'Remove if needed',
      trackerRemoveBody: isArabic
        ? 'هذا الزر يزيل التمرين من جلسة اليوم إذا لم تعد تريد أداءه.'
        : 'This button removes the exercise from today’s session if you no longer want it.',
      trackerTimerTitle: isArabic ? 'هذا مؤقتك' : 'This is your timer',
      trackerTimerBody: isArabic
        ? 'يعرض وقت المجموعة الحالية لمساعدتك على ضبط الإيقاع والراحة.'
        : 'It shows the current set timer so you can control pace and rest.',
      trackerPlayTitle: isArabic ? 'ابدأ وأوقف المجموعة' : 'Start and stop the set',
      trackerPlayBody: isArabic
        ? 'اضغط هنا عند بدء المجموعة، واضغط مرة أخرى عند الانتهاء لحفظها وبدء الراحة.'
        : 'Tap here when a set begins, then tap again when you finish to save it and start rest.',
      trackerVideoTitle: isArabic ? 'شاهد الأداء الصحيح' : 'Watch the right technique',
      trackerVideoBody: isArabic
        ? 'افتح الفيديو للتأكد من الشكل الصحيح قبل أو أثناء التمرين.'
        : 'Open the video to confirm proper technique before or during the set.',
      trackerAnalyticsTitle: isArabic ? 'راجع التحليلات' : 'Review analytics',
      trackerAnalyticsBody: isArabic
        ? 'هنا ترى الحجم والأزمنة والمجموعات المكتملة لهذا التمرين.'
        : 'Here you can review volume, timing, and completed-set analytics for this exercise.',
      trackerSetRowTitle: isArabic ? 'سجّل كل مجموعة' : 'Log each set',
      trackerSetRowBody: isArabic
        ? 'عدّل التكرارات والوزن لكل مجموعة، ثم استخدم الشريط لضبط الوزن بسرعة.'
        : 'Edit reps and weight for each set, then use the slider for quick weight adjustments.',
      trackerAddSetTitle: isArabic ? 'أضف مجموعة إضافية' : 'Add an extra set',
      trackerAddSetBody: isArabic
        ? 'إذا احتجت حجم تمرين أعلى، أضف مجموعة جديدة من هنا.'
        : 'If you want more training volume, add another set from here.',
    }),
    [isArabic],
  );
  const nextPlannedExerciseName = useMemo(() => {
    const completedLookup = new Set(completedExercises.map((name) => normalizeExerciseName(name)));
    const nextExercise = todayExercises.find(
      (exercise) => !completedLookup.has(normalizeExerciseName(exercise.exerciseName)),
    ) || todayExercises[0];
    return String(nextExercise?.exerciseName || '').trim();
  }, [completedExercises, todayExercises]);
  const selectableWeekPlanWorkouts = useMemo(
    () => weekPlanWorkouts.filter(hasWorkoutExercises),
    [weekPlanWorkouts],
  );
  const scheduledTodayWorkout = useMemo(
    () => selectableWeekPlanWorkouts.find((workout) => workout.isToday) || null,
    [selectableWeekPlanWorkouts],
  );
  const activeTodayWorkout = useMemo(
    () => selectableWeekPlanWorkouts.find((workout) => workout.key === todayWorkoutSelection?.workoutKey) || null,
    [todayWorkoutSelection?.workoutKey, selectableWeekPlanWorkouts],
  );
  const selectedWeekWorkout = useMemo(
    () => selectableWeekPlanWorkouts.find((workout) => workout.key === selectedWorkoutKey)
      || activeTodayWorkout
      || scheduledTodayWorkout
      || selectableWeekPlanWorkouts[0]
      || null,
    [activeTodayWorkout, scheduledTodayWorkout, selectedWorkoutKey, selectableWeekPlanWorkouts],
  );
  const isSelectedWorkoutPickedForToday = !!(
    selectedWeekWorkout
    && activeTodayWorkout
    && selectedWeekWorkout.key === activeTodayWorkout.key
  );
  const canSyncSelectedWorkoutWithServer = !!(
    selectedWeekWorkout
    && activeTodayWorkout
    && scheduledTodayWorkout
    && selectedWeekWorkout.key === activeTodayWorkout.key
    && selectedWeekWorkout.key === scheduledTodayWorkout.key
  );
  const recommendedRecoveryWorkout = useMemo(
    () => pickRecommendedWorkoutByRecovery(
      selectableWeekPlanWorkouts,
      recoveryStatuses,
      todayWorkoutSelection?.workoutKey || null,
    ),
    [recoveryStatuses, selectableWeekPlanWorkouts, todayWorkoutSelection?.workoutKey],
  );
  const detailWorkoutName = isSelectedWorkoutPickedForToday
    ? currentWorkoutName
    : String(selectedWeekWorkout?.workoutName || currentWorkoutName || workoutDay).trim() || 'Workout';
  const detailWorkoutDayLabel = isSelectedWorkoutPickedForToday
    ? currentWorkoutDayLabel
    : String(selectedWeekWorkout?.dayLabel || currentWorkoutDayLabel || workoutDay).trim() || 'Workout';
  const detailExercises = isSelectedWorkoutPickedForToday
    ? todayExercises
    : (selectedWeekWorkout?.exercises || []);
  const detailCompletedExercises = isSelectedWorkoutPickedForToday ? completedExercises : [];
  const planCoachmarkSteps = useMemo<CoachmarkStep[]>(
    () => [
      {
        id: 'back',
        targetId: 'my_plan_back_button',
        title: isArabic ? 'الرجوع من هنا' : 'Go back from here',
        body: isArabic
          ? 'استخدم هذا الزر للخروج من صفحة خطتي والعودة للصفحة السابقة.'
          : 'Use this button to leave My Plan and return to the previous page.',
        placement: 'bottom',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 16,
      },
      {
        id: 'current_day_gradient',
        targetId: 'my_plan_current_day_gradient',
        title: isArabic ? 'هذه الواجهة الرئيسية' : 'This is the main hero area',
        body: isArabic
          ? 'هنا ترى بطاقة اليوم الرئيسية قبل النزول إلى خطة الأسبوع.'
          : 'This highlighted hero area shows your main My Plan focus before you move down into the week plan.',
        placement: 'bottom',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 20,
      },
      {
        id: 'current_day',
        targetId: 'my_plan_current_day_card',
        title: isArabic ? 'هذه بطاقة اليوم' : 'This is your day card',
        body: isArabic
          ? 'هنا سترى ما تم حفظه لليوم، أو تذكيرًا باختيار حصة تدريب أولاً.'
          : 'This card tells you what is currently saved for today, or reminds you to choose a session first.',
        placement: 'bottom',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 20,
      },
      {
        id: 'agenda',
        targetId: 'my_plan_agenda_card',
        title: isArabic ? 'هذه أجندة الأسبوع' : 'This is your week agenda',
        body: isArabic
          ? 'هنا يمكنك رؤية أيام التمرين والراحة ولمس أي يوم لمعاينته بسرعة.'
          : 'Here you can quickly spot training and rest days, and tap any day for a quick preview.',
        placement: 'bottom',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 20,
      },
      {
        id: 'week_card',
        targetId: 'my_plan_first_week_card',
        title: isArabic ? 'كل بطاقة هي حصة' : 'Each card is one session',
        body: isArabic
          ? 'كل بطاقة في خطة الأسبوع تمثل حصة مختلفة. المسها لفتح تفاصيل التمرين.'
          : 'Each week-plan card is a different session. Tap one to open the full workout details.',
        placement: 'top',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 24,
      },
      {
        id: 'action_button',
        targetId: 'my_plan_first_action_button',
        title: isArabic ? 'هذا زر الإجراء' : 'This is your action button',
        body: isArabic
          ? 'إذا لم تختر حصة بعد فسيحفظها هذا الزر لليوم. وبعد الاختيار سيتحول إلى زر بدء التمرين.'
          : 'If no session is chosen yet, this button saves it for today. Once it is chosen, the same button becomes your workout start button.',
        placement: 'top',
        shape: 'circle',
        padding: 8,
      },
    ],
    [isArabic],
  );
  const trackerCoachmarkSteps = useMemo<CoachmarkStep[]>(
    () => [
      {
        id: 'timer',
        targetId: 'workout_tracker_timer',
        title: coachmarkCopy.trackerTimerTitle,
        body: coachmarkCopy.trackerTimerBody,
        placement: 'bottom',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 14,
      },
      {
        id: 'start_stop',
        targetId: 'workout_tracker_play_button',
        title: coachmarkCopy.trackerPlayTitle,
        body: coachmarkCopy.trackerPlayBody,
        placement: 'top',
        shape: 'circle',
        padding: 8,
      },
      {
        id: 'video',
        targetId: 'workout_tracker_video_button',
        title: coachmarkCopy.trackerVideoTitle,
        body: coachmarkCopy.trackerVideoBody,
        placement: 'top',
        shape: 'circle',
        padding: 8,
      },
      {
        id: 'analytics',
        targetId: 'workout_tracker_analytics_button',
        title: coachmarkCopy.trackerAnalyticsTitle,
        body: coachmarkCopy.trackerAnalyticsBody,
        placement: 'top',
        shape: 'circle',
        padding: 8,
      },
      {
        id: 'set_row',
        targetId: 'workout_tracker_first_set_row',
        title: coachmarkCopy.trackerSetRowTitle,
        body: coachmarkCopy.trackerSetRowBody,
        placement: 'top',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 20,
      },
      {
        id: 'add_set',
        targetId: 'workout_tracker_add_set_button',
        title: coachmarkCopy.trackerAddSetTitle,
        body: coachmarkCopy.trackerAddSetBody,
        placement: 'top',
        shape: 'rounded',
        padding: 8,
        cornerRadius: 999,
      },
    ],
    [coachmarkCopy],
  );
  const activeCoachmarkSteps = coachmarkMode === 'tracker' ? trackerCoachmarkSteps : planCoachmarkSteps;
  const activeCoachmarkOptions = coachmarkMode === 'tracker' ? trackerCoachmarkOptions : planCoachmarkOptions;
  const activeCoachmarkStep = activeCoachmarkSteps[coachmarkStepIndex] || null;
  const isCoachmarkOpen = coachmarkMode !== null && !!activeCoachmarkStep;

  useEffect(() => {
    const state = loadLocalWorkoutState(workoutStorageScope);
    setCompletedExercises(state.completedExercises);
    setExerciseSets(state.exerciseSets);
  }, [workoutStorageScope]);

  useEffect(() => {
    setTodayWorkoutSelection(readTodayWorkoutSelection(workoutStorageScope));
    setWorkoutAssignmentHistory(readWorkoutAssignmentHistory(workoutStorageScope));
  }, [workoutStorageScope]);

  useEffect(() => {
    if (!userId) {
      setRecoveryStatuses([]);
      return;
    }

    let cancelled = false;

    const loadRecoveryStatuses = async () => {
      try {
        const data = await api.getRecoveryStatus(userId);
        if (cancelled) return;

        const normalized = Array.isArray(data?.recovery)
          ? data.recovery
            .map((item: any) => ({
              name: normalizeMuscleName(String(item?.name || item?.muscle || '')),
              score: Math.max(0, Math.min(100, Math.round(Number(item?.score || 0)))),
            }))
            .filter((item: RecoveryMuscleStatus) => item.name)
          : [];
        setRecoveryStatuses(normalized);
      } catch (error) {
        console.error('Failed to load recovery recommendation data:', error);
        if (!cancelled) {
          setRecoveryStatuses([]);
        }
      }
    };

    const handleRecoveryUpdated = () => {
      void loadRecoveryStatuses();
    };

    void loadRecoveryStatuses();
    window.addEventListener('recovery-updated', handleRecoveryUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('recovery-updated', handleRecoveryUpdated);
    };
  }, [userId]);

  useEffect(() => {
    const handleTodayWorkoutSelectionUpdated = () => {
      setTodayWorkoutSelection(readTodayWorkoutSelection(workoutStorageScope));
      setWorkoutAssignmentHistory(readWorkoutAssignmentHistory(workoutStorageScope));
    };

    window.addEventListener(TODAY_WORKOUT_SELECTION_UPDATED_EVENT, handleTodayWorkoutSelectionUpdated);
    return () => {
      window.removeEventListener(TODAY_WORKOUT_SELECTION_UPDATED_EVENT, handleTodayWorkoutSelectionUpdated);
    };
  }, [workoutStorageScope]);

  useEffect(() => {
    setView('overview');
  }, [resetSignal]);

  useEffect(() => {
    setPostedSummaryTokens(readPostedWorkoutSummaryTokens(workoutStorageScope));
  }, [workoutStorageScope]);

  const closeCoachmarks = () => {
    setCoachmarkMode(null);
    setCoachmarkStepIndex(0);
  };

  const handleCoachmarkNext = () => {
    if (!coachmarkMode || !activeCoachmarkStep) return;

    const isLastStep = coachmarkStepIndex >= activeCoachmarkSteps.length - 1;
    if (isLastStep) return;

    patchCoachmarkProgress(activeCoachmarkOptions, (current) => ({
      currentStep: coachmarkStepIndex + 1,
      seenSteps: {
        ...current.seenSteps,
        [activeCoachmarkStep.id]: true,
      },
    }));

    setCoachmarkStepIndex((current) => Math.min(current + 1, activeCoachmarkSteps.length - 1));
  };

  const handleCoachmarkFinish = () => {
    if (!coachmarkMode || !activeCoachmarkStep) return;

    patchCoachmarkProgress(activeCoachmarkOptions, (current) => ({
      completed: true,
      dismissed: false,
      currentStep: Math.max(activeCoachmarkSteps.length - 1, 0),
      seenSteps: {
        ...current.seenSteps,
        [activeCoachmarkStep.id]: true,
      },
    }));

    closeCoachmarks();
    if (coachmarkMode === 'plan' && guidedTourActive) onGuidedTourComplete?.();
  };

  const handleCoachmarkSkip = () => {
    if (!coachmarkMode) return;

    patchCoachmarkProgress(activeCoachmarkOptions, {
      dismissed: true,
      currentStep: coachmarkStepIndex,
    });

    closeCoachmarks();
    if (coachmarkMode === 'plan' && guidedTourActive) onGuidedTourDismiss?.();
  };

  const handleCoachmarkTargetAction = () => {
    if (!coachmarkMode || !activeCoachmarkStep) return;

    patchCoachmarkProgress(activeCoachmarkOptions, (current) => ({
      completed: true,
      dismissed: false,
      currentStep: Math.max(activeCoachmarkSteps.length - 1, 0),
      seenSteps: {
        ...current.seenSteps,
        [activeCoachmarkStep.id]: true,
      },
    }));

    if (coachmarkMode === 'plan' && activeCoachmarkStep.id === 'exercise_card' && nextPlannedExerciseName) {
      closeCoachmarks();
      setSelectedExercise(nextPlannedExerciseName);
      setView('tracker');
      return;
    }

    closeCoachmarks();
  };

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

  useEffect(() => {
    closeCoachmarks();
  }, [resetSignal]);

  useEffect(() => {
    if (coachmarkMode === 'plan' && view !== 'overview') {
      closeCoachmarks();
      return;
    }

    if (coachmarkMode === 'tracker' && view !== 'tracker') {
      closeCoachmarks();
    }
  }, [coachmarkMode, view]);

  useEffect(() => {
    if (loading || isCoachmarkOpen) return;
    if (view !== 'overview' && view !== 'tracker') return;

    const timer = window.setTimeout(() => {
      if (view === 'overview') {
        const progress = readCoachmarkProgress(planCoachmarkOptions);
        const canShowPlanTour =
          guidedTourActive
          && !progress.completed
          && !progress.dismissed
          && weekPlanWorkouts.length > 0
          && hasCoachmarkTargets(planCoachmarkSteps);

        if (canShowPlanTour) {
          setCoachmarkStepIndex(Math.min(progress.currentStep, planCoachmarkSteps.length - 1));
          setCoachmarkMode('plan');
        }
        return;
      }

      const progress = readCoachmarkProgress(trackerCoachmarkOptions);
      const canShowTrackerTour =
        guidedTourActive
        && !progress.completed
        && !progress.dismissed
        && hasCoachmarkTargets(trackerCoachmarkSteps);

      if (canShowTrackerTour) {
        setCoachmarkStepIndex(Math.min(progress.currentStep, trackerCoachmarkSteps.length - 1));
        setCoachmarkMode('tracker');
      }
    }, 420);

    return () => window.clearTimeout(timer);
  }, [
    isCoachmarkOpen,
    loading,
    guidedTourActive,
    planCoachmarkOptions,
    planCoachmarkSteps,
    weekPlanWorkouts.length,
    trackerCoachmarkOptions,
    trackerCoachmarkSteps,
    view,
  ]);

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

  const parseRepTarget = (value: unknown) => {
    const text = String(value || '').trim();
    if (!text) return 0;

    const matches = text.match(/\d+/g) || [];
    const values = matches
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry) && entry > 0);

    if (!values.length) return 0;
    if (values.length >= 2 && /[-/]/.test(text)) {
      return Math.max(0, Math.round((values[0] + values[1]) / 2));
    }

    return Math.max(0, Math.round(values[0]));
  };

  const buildCompletedSetRowsForExercise = (exercise: TodayWorkoutExercise, existingRows: any[] = []) => {
    const requestedSets = Number(exercise?.sets || 0);
    const targetSetCount = Math.max(
      1,
      Number.isFinite(requestedSets) && requestedSets > 0 ? Math.round(requestedSets) : 1,
      Array.isArray(existingRows) ? existingRows.length : 0,
    );
    const fallbackReps = parseRepTarget(exercise?.reps);
    const fallbackWeight = Number(exercise?.targetWeight || 0);
    const fallbackRest = Number(exercise?.rest || 0);

    return Array.from({ length: targetSetCount }, (_, index) => {
      const current = Array.isArray(existingRows) ? existingRows[index] || {} : {};
      const setNumber = Number(current?.set || index + 1);
      const reps = Number(current?.reps);
      const weight = Number(current?.weight);
      const duration = Number(current?.duration || 45);
      const restTime = Number(current?.restTime || fallbackRest);

      return {
        set: Number.isFinite(setNumber) && setNumber > 0 ? Math.round(setNumber) : index + 1,
        reps: Number.isFinite(reps) && reps >= 0 ? Math.round(reps) : fallbackReps,
        weight: Number.isFinite(weight) && weight >= 0
          ? Number(weight.toFixed(2))
          : Number((Number.isFinite(fallbackWeight) && fallbackWeight > 0 ? fallbackWeight : 0).toFixed(2)),
        completed: true,
        duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 45,
        restTime: Number.isFinite(restTime) && restTime >= 0 ? Math.round(restTime) : 0,
      };
    });
  };

  const loadWorkoutData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      if (!userId) {
        setTodayExercises([]);
        setWeekPlanWorkouts([]);
        setSelectedWorkoutKey('');
        setTodayWorkoutSelection(null);
        setWorkoutAssignmentHistory([]);
        setCurrentWorkoutName('Rest Day');
        setCurrentWorkoutDayLabel('Rest Day');
        setProgramProgress(null);
        localStorage.setItem(workoutStorageKeys.exerciseCount, '0');
        localStorage.removeItem(workoutStorageKeys.exerciseSnapshot);
        return;
      }

      const [program, progress] = await Promise.all([
        api.getUserProgram(userId),
        api.getProgramProgress(userId).catch((progressError) => {
          console.error('Failed to fetch workout program progress:', progressError);
          return null;
        }),
      ]);
      const nextProgramProgress = progress && typeof progress === 'object' ? progress : null;
      const nextWeekPlanWorkouts = buildWeekPlanWorkouts(program);
      const nextSelectableWorkouts = nextWeekPlanWorkouts.filter(hasWorkoutExercises);
      const storedSelection = readTodayWorkoutSelection(workoutStorageScope);
      const nextSelectedWorkout = storedSelection
        ? nextWeekPlanWorkouts.find((workout) => workout.key === storedSelection.workoutKey) || null
        : null;
      const normalizedSelection = hasWorkoutExercises(nextSelectedWorkout) ? storedSelection : null;
      setUserProgram({
        ...(program || {}),
        workouts: Array.isArray(program?.currentWeekWorkouts)
          ? program.currentWeekWorkouts
          : Array.isArray(program?.workouts)
            ? program.workouts
            : [],
      });
      setProgramProgress(nextProgramProgress);

      setWeekPlanWorkouts(nextWeekPlanWorkouts);
      const nextPlanSummary = nextProgramProgress?.summary;
      const nextPlanCompleted = Boolean(
        nextProgramProgress?.hasActiveProgram
        && Number(nextPlanSummary?.totalWeeks || program?.totalWeeks || 0) > 0
        && (
          (Number(nextPlanSummary?.plannedWorkouts || 0) > 0
            && Number(nextPlanSummary?.completedWorkouts || 0) >= Number(nextPlanSummary?.plannedWorkouts || 0))
          || Number(nextPlanSummary?.calendarDaysLeft ?? -1) === 0
        )
      );

      if (nextPlanCompleted) {
        clearTodayWorkoutSelection(workoutStorageScope);
        clearLocalWorkoutState(workoutStorageScope);
        setTodayWorkoutSelection(null);
        setWorkoutAssignmentHistory(readWorkoutAssignmentHistory(workoutStorageScope));
        setSelectedWorkoutKey('');
        setTodayExercises([]);
        setCompletedExercises([]);
        setExerciseSets({});
        setCurrentWorkoutName(renewalCopy.completedTitle);
        setCurrentWorkoutDayLabel(renewalCopy.completedSubtitle);
        localStorage.setItem(homeMetricStorageKeys.homeWorkoutProgress, '0');
        localStorage.setItem(workoutStorageKeys.exerciseCount, '0');
        localStorage.removeItem(workoutStorageKeys.exerciseSnapshot);
        setView('overview');
        return;
      }

      if (storedSelection && !hasWorkoutExercises(nextSelectedWorkout)) {
        clearTodayWorkoutSelection(workoutStorageScope);
      }
      setTodayWorkoutSelection(normalizedSelection);
      setWorkoutAssignmentHistory(readWorkoutAssignmentHistory(workoutStorageScope));
      setSelectedWorkoutKey((currentKey) => {
        if (currentKey && nextSelectableWorkouts.some((workout) => workout.key === currentKey)) {
          return currentKey;
        }
        return normalizedSelection?.workoutKey
          || nextSelectableWorkouts.find((workout) => workout.isToday)?.key
          || nextSelectableWorkouts[0]?.key
          || '';
      });

      if (!normalizedSelection || !hasWorkoutExercises(nextSelectedWorkout)) {
        clearLocalWorkoutState(workoutStorageScope);
        setTodayExercises([]);
        setCompletedExercises([]);
        setExerciseSets({});
        setCurrentWorkoutName('Rest Day');
        setCurrentWorkoutDayLabel(
          formatWorkoutDayLabel(new Date().toLocaleDateString('en-US', { weekday: 'long' }), 'Today'),
        );
        localStorage.setItem(homeMetricStorageKeys.homeWorkoutProgress, '0');
        localStorage.setItem(workoutStorageKeys.exerciseCount, '0');
        localStorage.removeItem(workoutStorageKeys.exerciseSnapshot);
        return;
      }

      const storedState = loadLocalWorkoutState(workoutStorageScope);
      setCompletedExercises(storedState.completedExercises);
      setExerciseSets(storedState.exerciseSets);
      const normalizedExtras = Array.isArray(storedState.extraExercises)
        ? storedState.extraExercises.map((ex: any) => normalizeWorkoutExerciseEntry(ex, true))
        : [];
      const normalizedSnapshot = Array.isArray(storedState.exerciseSnapshot)
        ? storedState.exerciseSnapshot.map((ex: any) => normalizeWorkoutExerciseEntry(ex, Boolean(ex?.isExtra)))
        : [];

      syncTodayExercises(
        storedState.hasExerciseSnapshot
          ? normalizedSnapshot
          : [...(nextSelectedWorkout.exercises || []), ...normalizedExtras],
      );
      setCurrentWorkoutDayLabel(String(nextSelectedWorkout.dayLabel || workoutDay).trim() || 'Workout');
      setCurrentWorkoutName(
        String(nextSelectedWorkout.workoutName || workoutDay).trim() || 'Workout',
      );
    } catch (error) {
      console.error('Failed to fetch today workout:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to load workout plan.');
      setTodayExercises([]);
      setWeekPlanWorkouts([]);
      setSelectedWorkoutKey('');
      setTodayWorkoutSelection(null);
      setProgramProgress(null);
      setUserProgram(null);
      setCurrentWorkoutName('Rest Day');
      setCurrentWorkoutDayLabel('Rest Day');
      localStorage.setItem(workoutStorageKeys.exerciseCount, '0');
      localStorage.removeItem(workoutStorageKeys.exerciseSnapshot);
    } finally {
      setLoading(false);
    }
  }, [
    homeMetricStorageKeys.homeWorkoutProgress,
    renewalCopy.completedSubtitle,
    renewalCopy.completedTitle,
    userId,
    workoutDay,
    workoutStorageKeys.exerciseCount,
    workoutStorageKeys.exerciseSnapshot,
    workoutStorageScope,
  ]);

  useEffect(() => {
    void loadWorkoutData();
  }, [loadWorkoutData]);

  useEffect(() => {
    if (!isCoachPickerOpen) return;

    let cancelled = false;

    const loadCoaches = async () => {
      try {
        setCoachesLoading(true);
        const list = await api.getAllCoaches();
        if (cancelled) return;
        const normalized = Array.isArray(list)
          ? list
            .map((coach: any) => ({
              id: Number(coach?.id || 0),
              name: String(coach?.name || '').trim() || (isArabic ? 'مدرب' : 'Coach'),
              email: coach?.email ? String(coach.email).trim() : undefined,
            }))
            .filter((coach: CoachOption) => coach.id > 0)
          : [];
        setCoaches(normalized);
      } catch (error) {
        console.error('Failed to load coaches:', error);
        if (!cancelled) setCoaches([]);
      } finally {
        if (!cancelled) setCoachesLoading(false);
      }
    };

    void loadCoaches();
    return () => {
      cancelled = true;
    };
  }, [isArabic, isCoachPickerOpen]);

  useEffect(() => {
    setView('overview');
  }, [resetSignal]);

  const handleNewPlanSaved = useCallback(() => {
    setIsPlanChoiceOpen(false);
    setIsCoachPickerOpen(false);
    setView('overview');
    window.dispatchEvent(new CustomEvent('program-updated'));
    void loadWorkoutData();
  }, [loadWorkoutData]);

  const handleSelectCoachForNewPlan = useCallback(async (coach: CoachOption) => {
    if (!userId || coachRequestingId) return;

    try {
      setCoachRequestingId(coach.id);
      await api.requestCoachPlanCreation(userId, coach.id);
      setIsCoachPickerOpen(false);
      setIsPlanChoiceOpen(false);
      window.alert(`${renewalCopy.requestSent} ${coach.name}.`);
    } catch (error: any) {
      console.error('Failed to send coach plan request:', error);
      window.alert(error?.message || renewalCopy.requestFailed);
    } finally {
      setCoachRequestingId(null);
    }
  }, [coachRequestingId, renewalCopy.requestFailed, renewalCopy.requestSent, userId]);

  const pickWorkoutForToday = (workoutKey: string) => {
    const nextWorkout = selectableWeekPlanWorkouts.find((workout) => workout.key === workoutKey);
    if (!hasWorkoutExercises(nextWorkout)) return;

    if (
      hasStartedTodayWorkout
      && todayWorkoutSelection?.workoutKey
      && todayWorkoutSelection.workoutKey !== workoutKey
    ) {
      return;
    }

    setSelectedWorkoutKey(workoutKey);

    if (todayWorkoutSelection?.workoutKey === workoutKey) {
      setView('plan');
      return;
    }

    clearLocalWorkoutState(workoutStorageScope);
    const nextSelection = saveTodayWorkoutSelection(workoutStorageScope, {
      workoutKey: nextWorkout.key,
      workoutName: nextWorkout.workoutName,
      dayLabel: nextWorkout.dayLabel,
      completed: false,
      completedAt: null,
    });

    setTodayWorkoutSelection(nextSelection);
    setCompletedExercises([]);
    setExerciseSets({});
    setSummary(null);
    setSummaryError(null);
    setLastAutoSummaryKey('');
    setCurrentWorkoutName(nextWorkout.workoutName);
    setCurrentWorkoutDayLabel(nextWorkout.dayLabel);
    syncTodayExercises(nextWorkout.exercises);
    localStorage.setItem(homeMetricStorageKeys.homeWorkoutProgress, '0');
    window.dispatchEvent(new CustomEvent('workout-progress-updated'));
    window.dispatchEvent(new CustomEvent('workout-extra-exercises-updated'));
    setView('plan');
  };

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

    if (userId && canSyncSelectedWorkoutWithServer) {
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

    if (userId && targetExercise.id && canSyncSelectedWorkoutWithServer) {
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

    if (todayWorkoutSelection?.workoutKey) {
      const nextSelection = markTodayWorkoutSelectionCompleted(workoutStorageScope, allPlannedDone);
      setTodayWorkoutSelection(nextSelection);
    }

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

  const markSelectedWorkoutFullyDone = async () => {
    if (!isSelectedWorkoutPickedForToday || !todayWorkoutSelection?.workoutKey) {
      return {
        completed: false,
        reason: 'Pick this workout for today before marking it as fully done.',
      };
    }

    const exercisesToComplete = todayExercises.filter((exercise) => String(exercise?.exerciseName || '').trim());
    if (!exercisesToComplete.length) {
      return {
        completed: false,
        reason: 'No exercises were found for this workout day.',
      };
    }

    const nextExerciseSets: Record<string, any[]> = {
      ...exerciseSets,
    };
    const nextCompletedExercises = Array.from(new Set(
      exercisesToComplete.map((exercise) => String(exercise.exerciseName || '').trim()).filter(Boolean),
    ));

    exercisesToComplete.forEach((exercise) => {
      const exerciseName = String(exercise.exerciseName || '').trim();
      if (!exerciseName) return;
      nextExerciseSets[exerciseName] = buildCompletedSetRowsForExercise(
        exercise,
        Array.isArray(exerciseSets[exerciseName]) ? exerciseSets[exerciseName] : [],
      );
    });

    setExerciseSets(nextExerciseSets);
    localStorage.setItem(workoutStorageKeys.exerciseSets, JSON.stringify(nextExerciseSets));

    setCompletedExercises(nextCompletedExercises);
    localStorage.setItem(workoutStorageKeys.completedExercises, JSON.stringify(nextCompletedExercises));

    const nextSelection = markTodayWorkoutSelectionCompleted(workoutStorageScope, true);
    setTodayWorkoutSelection(nextSelection);

    localStorage.setItem(homeMetricStorageKeys.homeWorkoutProgress, '100');
    window.dispatchEvent(new CustomEvent('workout-progress-updated'));
    window.dispatchEvent(new CustomEvent('program-updated'));

    const currentUserId = Number(userId || 0);
    const todayKey = new Date().toDateString();
    const finalizeKey = `recoveryFinalized:${currentUserId}:${todayKey}`;
    if (currentUserId > 0) {
      try {
        await api.recalculateTodayRecovery(currentUserId);
        localStorage.setItem(finalizeKey, 'true');
      } catch (error) {
        console.error('Failed to finalize recovery for fully done workout:', error);
      }
    }
    localStorage.setItem('recoveryNeedsUpdate', 'true');
    window.dispatchEvent(new CustomEvent('recovery-updated'));

    const summaryKey = `${formatDateISO(new Date())}:${String(currentWorkoutName || '').trim().toLowerCase()}`;
    setLastAutoSummaryKey(summaryKey);
    await saveAndShowWorkoutSummary(nextExerciseSets, false);

    return { completed: true };
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
      clearTodayWorkoutSelection(workoutStorageScope);
      setTodayWorkoutSelection(null);
      setTodayExercises([]);
      setCompletedExercises([]);
      setExerciseSets({});
      setCurrentWorkoutName('Rest Day');
      localStorage.setItem(homeMetricStorageKeys.homeWorkoutProgress, '0');
      localStorage.setItem('recoveryNeedsUpdate', 'true');
      window.dispatchEvent(new CustomEvent('program-updated'));
      window.dispatchEvent(new CustomEvent('workout-progress-updated'));
      window.dispatchEvent(new CustomEvent('recovery-updated'));
      setView('overview');
      await loadWorkoutData();
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

  if (view === 'presetPlans') {
    return (
      <PresetProgramScreen
        onBack={() => setView('overview')}
        onSaved={handleNewPlanSaved}
        onBuildCustom={() => setView('customPlanBuilder')}
      />
    );
  }

  if (view === 'customPlanBuilder') {
    return (
      <CustomPlanBuilderScreen
        onBack={() => setView('presetPlans')}
        onSaved={handleNewPlanSaved}
      />
    );
  }

  if (view === 'overview') {
    return (
      <>
        <WorkoutOverviewScreen
          onBack={onBack}
          onSelectWorkout={(workoutKey) => {
            setSelectedWorkoutKey(workoutKey);
            setView('plan');
          }}
          onPickWorkoutForToday={pickWorkoutForToday}
          onOpenNewPlanFlow={() => setIsPlanChoiceOpen(true)}
          currentDayLabel={currentWorkoutDayLabel}
          workouts={selectableWeekPlanWorkouts.map((workout) => ({
            key: workout.key,
            dayLabel: workout.dayLabel,
            workoutName: workout.workoutName,
            exerciseCount: workout.exercises.length,
            exerciseNames: workout.exercises
              .map((exercise) => String(exercise?.exerciseName || '').trim())
              .filter(Boolean),
            targetMuscles: getWorkoutTargetMuscles(workout).slice(0, 3),
            isToday: workout.isToday,
            isRecommendedNext: workout.key === recommendedRecoveryWorkout?.key,
            isPickedForToday: workout.key === todayWorkoutSelection?.workoutKey,
            isCompletedToday: workout.key === todayWorkoutSelection?.workoutKey && !!todayWorkoutSelection?.completed,
          }))}
          selectedTodayWorkoutName={todayWorkoutSelection?.workoutName || currentWorkoutName}
          selectedTodayWorkoutDayLabel={todayWorkoutSelection?.dayLabel || currentWorkoutDayLabel}
          hasTodaySelection={!!todayWorkoutSelection?.workoutKey}
          isTodaySelectionCompleted={!!todayWorkoutSelection?.completed}
          isTodayPlanLocked={hasStartedTodayWorkout}
          isPlanCompleted={isPlanCompleted}
          recommendedWorkout={
            !isPlanCompleted && recommendedRecoveryWorkout
              ? {
                  workoutName: recommendedRecoveryWorkout.workoutName,
                  dayLabel: recommendedRecoveryWorkout.dayLabel,
                }
              : null
          }
          userProgram={userProgram}
          assignmentHistory={workoutAssignmentHistory}
          accountCreatedAt={currentUser?.created_at || currentUser?.createdAt || null}
          loading={loading}
          error={loadError}
        />
        {isPlanChoiceOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
            onClick={() => setIsPlanChoiceOpen(false)}
          >
            <div
              dir={isArabic ? 'rtl' : 'ltr'}
              className={`w-full max-w-sm bg-card border border-white/10 rounded-2xl p-4 space-y-3 ${isArabic ? 'text-right' : 'text-left'}`}
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-white font-semibold text-lg">{renewalCopy.modalTitle}</h3>
              <p className="text-sm text-text-secondary">{renewalCopy.modalBody}</p>
              <button
                type="button"
                onClick={() => {
                  setIsPlanChoiceOpen(false);
                  setView('presetPlans');
                }}
                className={`w-full bg-white/5 hover:bg-white/10 transition-colors rounded-xl p-3 text-white border border-white/10 ${isArabic ? 'text-right' : 'text-left'}`}
              >
                {renewalCopy.buildSolo}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlanChoiceOpen(false);
                  setIsCoachPickerOpen(true);
                }}
                className={`w-full bg-white/5 hover:bg-white/10 transition-colors rounded-xl p-3 text-white border border-white/10 ${isArabic ? 'text-right' : 'text-left'}`}
              >
                {renewalCopy.withCoach}
              </button>
            </div>
          </div>
        )}
        {isCoachPickerOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
            onClick={() => setIsCoachPickerOpen(false)}
          >
            <div
              dir={isArabic ? 'rtl' : 'ltr'}
              className={`w-full max-w-sm bg-card border border-white/10 rounded-2xl p-4 space-y-3 max-h-[80vh] overflow-y-auto ${isArabic ? 'text-right' : 'text-left'}`}
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-white font-semibold text-lg">{renewalCopy.chooseCoach}</h3>
              <p className="text-sm text-text-secondary">{renewalCopy.chooseCoachBody}</p>

              {coachesLoading && (
                <div className="text-sm text-text-secondary">{renewalCopy.loadingCoaches}</div>
              )}

              {!coachesLoading && coaches.length === 0 && (
                <div className="text-sm text-text-secondary">{renewalCopy.noCoaches}</div>
              )}

              {!coachesLoading && coaches.map((coach) => (
                <button
                  key={coach.id}
                  type="button"
                  disabled={coachRequestingId !== null}
                  onClick={() => void handleSelectCoachForNewPlan(coach)}
                  className={`w-full bg-white/5 hover:bg-white/10 transition-colors rounded-xl p-3 text-white border border-white/10 disabled:opacity-50 ${isArabic ? 'text-right' : 'text-left'}`}
                >
                  <div className="font-medium">
                    {coach.name}
                    {coachRequestingId === coach.id ? ` (${renewalCopy.sending})` : ''}
                  </div>
                  {coach.email && (
                    <div className="text-xs text-text-secondary mt-0.5">{coach.email}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        <CoachmarkOverlay
          isOpen={coachmarkMode === 'plan' && !!activeCoachmarkStep}
          step={coachmarkMode === 'plan' ? activeCoachmarkStep : null}
          stepIndex={coachmarkMode === 'plan' ? coachmarkStepIndex : 0}
          totalSteps={planCoachmarkSteps.length}
          nextLabel={coachmarkCopy.next}
          finishLabel={coachmarkCopy.finish}
          skipLabel={coachmarkCopy.skip}
          onNext={handleCoachmarkNext}
          onFinish={handleCoachmarkFinish}
          onSkip={handleCoachmarkSkip}
        />
      </>
    );
  }

  if (view === 'plan') {
    return (
      <>
        <WorkoutPlanScreen
          onBack={() => setView('overview')}
          onExerciseClick={(exercise) => {
            setSelectedExercise(exercise);
            if (isSelectedWorkoutPickedForToday) {
              setView('tracker');
              return;
            }
            setVideoReturnView('plan');
            setView('video');
          }}
          onPreviewExercise={(exercise) => {
            setSelectedExercise(exercise);
            setVideoReturnView('plan');
            setView('video');
          }}
          onAddExercise={addExerciseToToday}
          onMarkDayFullyDone={isSelectedWorkoutPickedForToday ? () => markSelectedWorkoutFullyDone() : undefined}
          onOpenLatestSummary={isSelectedWorkoutPickedForToday ? () => {
            void openLatestSummary();
          } : undefined}
          onMissDay={canSyncSelectedWorkoutWithServer ? markTodayWorkoutAsMissed : undefined}
          hasLatestSummary={isSelectedWorkoutPickedForToday && hasLatestSummary}
          workoutDay={detailWorkoutName}
          workoutDayLabel={detailWorkoutDayLabel}
          completedExercises={detailCompletedExercises}
          todayExercises={detailExercises}
          loading={isSelectedWorkoutPickedForToday ? loading : false}
          allowEditing={isSelectedWorkoutPickedForToday}
          isDayFullyDone={isSelectedWorkoutPickedForToday && !!todayWorkoutSelection?.completed}
        />
      </>
    );
  }

  if (view === 'tracker') {
    const selectedWorkoutExercise = todayExercises.find(
      (exercise) => normalizeExerciseName(exercise.exerciseName) === normalizeExerciseName(selectedExercise),
    );
    return (
      <>
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
        <CoachmarkOverlay
          isOpen={coachmarkMode === 'tracker' && !!activeCoachmarkStep}
          step={coachmarkMode === 'tracker' ? activeCoachmarkStep : null}
          stepIndex={coachmarkMode === 'tracker' ? coachmarkStepIndex : 0}
          totalSteps={trackerCoachmarkSteps.length}
          nextLabel={coachmarkCopy.next}
          finishLabel={coachmarkCopy.finish}
          skipLabel={coachmarkCopy.skip}
          onNext={handleCoachmarkNext}
          onFinish={handleCoachmarkFinish}
          onSkip={handleCoachmarkSkip}
        />
      </>
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
        topContent={activeT2PremiumConfig && summary ? (
          <T2PostWorkoutCheckInCard
            summary={summary}
            userId={userId}
          />
        ) : null}
      />
    );
  }

  return null;
}
