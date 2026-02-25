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
type ViewState = 'overview' | 'plan' | 'tracker' | 'video' | 'live' | 'summary';
export function Workout({ onBack, workoutDay = 'Push Day' }: WorkoutProps) {
  const [view, setView] = useState<ViewState>('plan');
  const [selectedExercise, setSelectedExercise] = useState('Bench Press');
  const [currentWorkoutName, setCurrentWorkoutName] = useState(workoutDay);
  const [todayExercises, setTodayExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedExercises, setCompletedExercises] = useState<string[]>(() => {
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem('workoutDate');
    if (savedDate !== today) {
      localStorage.removeItem('completedExercises');
      localStorage.removeItem('exerciseSets');
      localStorage.setItem('workoutDate', today);
      return [];
    }
    const saved = localStorage.getItem('completedExercises');
    return saved ? JSON.parse(saved) : [];
  });
  const [exerciseSets, setExerciseSets] = useState<Record<string, any[]>>(() => {
    const saved = localStorage.getItem('exerciseSets');
    return saved ? JSON.parse(saved) : {};
  });

  const normalizeExerciseName = (name: string) => String(name || '').trim().toLowerCase();

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
        const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
        if (!user?.id) {
          setTodayExercises([]);
          setCurrentWorkoutName('Rest Day');
          setLoading(false);
          return;
        }

        const program = await api.getUserProgram(user.id);
        const todayWorkout = program?.todayWorkout || null;

        if (!todayWorkout) {
          setTodayExercises([]);
          setCurrentWorkoutName('Rest Day');
          setLoading(false);
          return;
        }

        const normalizedExercises = Array.isArray(todayWorkout.exercises)
          ? todayWorkout.exercises.map((ex: any) => ({
              exerciseName: ex.exerciseName || ex.name,
              sets: Number(ex.sets || 0),
              reps: String(ex.reps || ''),
              rest: Number(ex.rest || 0),
              notes: ex.notes || null,
            }))
          : [];

        setTodayExercises(normalizedExercises);
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
  }, [workoutDay]);

  const updateExerciseSets = (sets: Record<string, any[]>) => {
    setExerciseSets(sets);
    localStorage.setItem('exerciseSets', JSON.stringify(sets));
    
    // Mark an exercise completed once all planned sets for that exercise are completed.
    const plannedSetsByExercise = new Map(
      todayExercises.map((ex: any) => [normalizeExerciseName(ex.exerciseName), Number(ex.sets || 0)]),
    );

    const completed = Object.keys(sets).filter(exerciseName => {
      const exerciseSets = sets[exerciseName] || [];
      const plannedSetCount = Number(plannedSetsByExercise.get(normalizeExerciseName(exerciseName)) || 0);
      const completedCount = exerciseSets.filter((s: any) => s.completed).length;

      if (plannedSetCount > 0) {
        return completedCount >= plannedSetCount;
      }

      return exerciseSets.length > 0 && exerciseSets.every((s: any) => s.completed);
    });

    setCompletedExercises(completed);
    localStorage.setItem('completedExercises', JSON.stringify(completed));
    
    // Trigger immediate recovery refresh when the day is fully completed.
    const plannedExerciseNames = todayExercises.map((ex: any) => normalizeExerciseName(ex.exerciseName));
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
