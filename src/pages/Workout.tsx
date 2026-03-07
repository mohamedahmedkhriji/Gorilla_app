import React, { useState, useEffect } from 'react';
import { WorkoutOverviewScreen } from '../components/workout/WorkoutOverviewScreen';
import { LiveWorkoutScreen } from '../components/workout/LiveWorkoutScreen';
import { PostWorkoutSummary } from '../components/workout/PostWorkoutSummary';
import { ExerciseVideoScreen } from '../components/workout/ExerciseVideoScreen';
import { WorkoutPlanScreen } from '../components/workout/WorkoutPlanScreen';
import { TrackerScreen } from '../components/workout/TrackerScreen';
import { api } from '../services/api';
interface WorkoutProps {
  onBack: () => void;
  workoutDay?: string;
}

type AddedCatalogExercise = {
  id: number;
  name: string;
  muscle?: string;
  bodyPart?: string | null;
};

type ViewState = 'overview' | 'plan' | 'tracker' | 'video' | 'live' | 'summary';

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
  };
};

const getHomeMetricStorageKeys = (scope: string) => {
  return {
    homeWorkoutProgress: `homeWorkoutProgress:${scope}`,
  };
};

const loadLocalWorkoutState = (scope: string) => {
  const keys = getWorkoutStorageKeys(scope);
  const today = new Date().toDateString();
  const savedDate = localStorage.getItem(keys.workoutDate);

  if (savedDate !== today) {
    localStorage.removeItem(keys.completedExercises);
    localStorage.removeItem(keys.exerciseSets);
    localStorage.removeItem(keys.extraExercises);
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

export function Workout({ onBack, workoutDay = 'Push Day' }: WorkoutProps) {
  const currentUser = readStoredUser();
  const userId = Number(currentUser?.id || 0);
  const workoutStorageScope = getUserStorageScope(currentUser);
  const workoutStorageKeys = getWorkoutStorageKeys(workoutStorageScope);
  const homeMetricStorageKeys = getHomeMetricStorageKeys(workoutStorageScope);

  const [view, setView] = useState<ViewState>('plan');
  const [selectedExercise, setSelectedExercise] = useState('Bench Press');
  const [currentWorkoutName, setCurrentWorkoutName] = useState(workoutDay);
  const [todayExercises, setTodayExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedExercises, setCompletedExercises] = useState<string[]>([]);
  const [exerciseSets, setExerciseSets] = useState<Record<string, any[]>>({});

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
          setLoading(false);
          return;
        }

        const program = await api.getUserProgram(userId);
        const todayWorkout = program?.todayWorkout || null;

        if (!todayWorkout) {
          setTodayExercises([]);
          setCurrentWorkoutName('Rest Day');
          setLoading(false);
          return;
        }

        const normalizedExercises = Array.isArray(todayWorkout.exercises)
          ? todayWorkout.exercises.map((ex: any) => ({
              exerciseName: ex.exerciseName || ex.exercise_name || ex.name,
              exerciseCatalogId: Number(ex.exerciseCatalogId ?? ex.exercise_catalog_id ?? 0) || null,
              targetMuscles: parseTargetMuscles(ex.targetMuscles ?? ex.muscleTargets ?? ex.muscles),
              muscleGroup: String(ex.muscleGroup || ex.muscle_group || '').trim() || null,
              sets: Number(ex.sets ?? ex.targetSets ?? ex.target_sets ?? 0),
              reps: String(ex.reps ?? ex.targetReps ?? ex.target_reps ?? ''),
              targetWeight: Number(ex.targetWeight ?? ex.target_weight ?? 0) || null,
              rest: Number(ex.rest ?? ex.restSeconds ?? ex.rest_seconds ?? 0),
              tempo: ex.tempo || null,
              rpeTarget: Number(ex.rpeTarget ?? ex.rpe_target ?? 0) || null,
              notes: ex.notes || null,
              isExtra: false,
            }))
          : [];

        const storedState = loadLocalWorkoutState(workoutStorageScope);
        const normalizedExtras = Array.isArray(storedState.extraExercises)
          ? storedState.extraExercises.map((ex: any) => ({
              exerciseName: ex.exerciseName || ex.exercise_name || ex.name,
              exerciseCatalogId: Number(ex.exerciseCatalogId ?? ex.exercise_catalog_id ?? 0) || null,
              targetMuscles: parseTargetMuscles(ex.targetMuscles ?? ex.muscleTargets ?? ex.muscles),
              muscleGroup: String(ex.muscleGroup || ex.muscle_group || '').trim() || null,
              sets: Number(ex.sets ?? ex.targetSets ?? ex.target_sets ?? 0),
              reps: String(ex.reps ?? ex.targetReps ?? ex.target_reps ?? ''),
              targetWeight: Number(ex.targetWeight ?? ex.target_weight ?? 0) || null,
              rest: Number(ex.rest ?? ex.restSeconds ?? ex.rest_seconds ?? 0),
              tempo: ex.tempo || null,
              rpeTarget: Number(ex.rpeTarget ?? ex.rpe_target ?? 0) || null,
              notes: ex.notes || null,
              isExtra: true,
            }))
          : [];

        setTodayExercises([...normalizedExercises, ...normalizedExtras]);
        setCurrentWorkoutName(todayWorkout.name || workoutDay);
      } catch (error) {
        console.error('Failed to fetch today workout:', error);
        setTodayExercises([]);
        setCurrentWorkoutName('Rest Day');
      } finally {
        setLoading(false);
      }
    };
    fetchTodayWorkout();
  }, [workoutDay, userId, workoutStorageScope]);

  const addExerciseToToday = (exercise: AddedCatalogExercise) => {
    const exerciseName = String(exercise?.name || '').trim();
    if (!exerciseName) {
      return { added: false, reason: 'Select an exercise first.' };
    }

    const normalizedName = normalizeExerciseName(exerciseName);
    if (todayExercises.some((entry: any) => normalizeExerciseName(entry?.exerciseName) === normalizedName)) {
      return { added: false, reason: 'This exercise is already in today\'s workout.' };
    }

    const nextExercise = {
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

    const nextExercises = [...todayExercises, nextExercise];
    setTodayExercises(nextExercises);
    persistExtraExercises(nextExercises);
    window.dispatchEvent(new CustomEvent('workout-extra-exercises-updated'));
    return { added: true };
  };

  const updateExerciseSets = (sets: Record<string, any[]>) => {
    setExerciseSets(sets);
    localStorage.setItem(workoutStorageKeys.exerciseSets, JSON.stringify(sets));
    
    // Mark an exercise completed once all planned sets for that exercise are completed.
    const coreExercises = todayExercises.filter((ex: any) => !ex?.isExtra);
    const plannedSetsByExercise = new Map(
      coreExercises.map((ex: any) => [normalizeExerciseName(ex.exerciseName), Number(ex.sets || 0)]),
    );

    const completed = Object.keys(sets).filter(exerciseName => {
      const exerciseSets = sets[exerciseName] || [];
      const plannedSetCount = Number(plannedSetsByExercise.get(normalizeExerciseName(exerciseName)) || 0);
      const completedCount = exerciseSets.filter((s: any) => isSetCompleted(s)).length;

      if (plannedSetCount > 0) {
        return completedCount >= plannedSetCount;
      }

      return exerciseSets.length > 0 && exerciseSets.every((s: any) => isSetCompleted(s));
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
    
    // Trigger immediate recovery refresh when the day is fully completed.
    const plannedExerciseNames = coreExercises.map((ex: any) => normalizeExerciseName(ex.exerciseName));
    const completedNormalized = new Set(completed.map(normalizeExerciseName));
    const allPlannedDone =
      plannedExerciseNames.length > 0 &&
      plannedExerciseNames.every((exerciseName: string) => completedNormalized.has(exerciseName));

    if (allPlannedDone) {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      const userId = Number(user?.id || 0);
      const todayKey = new Date().toDateString();
      const finalizeKey = `recoveryFinalized:${userId}:${todayKey}`;

      const finalizeRecovery = async () => {
        if (!userId || localStorage.getItem(finalizeKey) === 'true') {
          localStorage.setItem('recoveryNeedsUpdate', 'true');
          window.dispatchEvent(new CustomEvent('recovery-updated'));
          return;
        }

        try {
          await api.recalculateTodayRecovery(userId);
          localStorage.setItem(finalizeKey, 'true');
          localStorage.setItem('recoveryNeedsUpdate', 'true');
          window.dispatchEvent(new CustomEvent('recovery-updated'));
        } catch (error) {
          console.error('Failed to finalize recovery:', error);
        }
      };

      void finalizeRecovery();
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
        onAddExercise={addExerciseToToday}
        workoutDay={currentWorkoutName}
        completedExercises={completedExercises}
        todayExercises={todayExercises}
        loading={loading}
      />
    );
  }
  if (view === 'tracker') {
    return (
      <TrackerScreen
        onBack={() => setView('plan')}
        exerciseName={selectedExercise}
        plannedSets={getPlannedSetsForExercise(selectedExercise) || undefined}
        onVideoClick={() => setView('video')}
        savedSets={exerciseSets[selectedExercise]}
        onSaveSets={(sets) => updateExerciseSets({ ...exerciseSets, [selectedExercise]: sets })}
      />
    );
  }
  if (view === 'video') {
    return (
      <ExerciseVideoScreen
        onBack={() => setView('tracker')}
        exercise={{ name: selectedExercise, muscle: 'Back', video: '/Squat.mp4' }}
      />
    );
  }
  if (view === 'live') {
    return <LiveWorkoutScreen onFinish={() => setView('summary')} />;
  }
  if (view === 'summary') {
    return <PostWorkoutSummary onClose={onBack} />;
  }
  return (
    <WorkoutOverviewScreen onStart={() => setView('live')} onBack={onBack} />);

}
