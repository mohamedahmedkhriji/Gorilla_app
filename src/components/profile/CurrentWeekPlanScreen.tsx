import React, { useEffect, useState } from 'react';
import { Header } from '../ui/Header';
import { api } from '../../services/api';

interface CurrentWeekPlanScreenProps {
  onBack: () => void;
  onOpenWorkout: () => void;
  onCreateCustom: () => void;
}

interface WeekWorkout {
  id: number;
  workout_name: string;
  workout_type: string | null;
  day_order: number;
  day_name: string;
  notes?: string | null;
  exercises: Array<{
    exerciseName?: string;
    name?: string;
    sets?: number;
    reps?: string | number;
    rest?: number;
    notes?: string | null;
  }>;
}

interface RawWeekWorkout {
  id?: number;
  workout_name?: string;
  workout_type?: string | null;
  day_order?: number;
  day_name?: string;
  notes?: string | null;
  exercises?: unknown;
}

const parseExercises = (raw: unknown): WeekWorkout['exercises'] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function CurrentWeekPlanScreen({ onBack, onOpenWorkout, onCreateCustom }: CurrentWeekPlanScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [programName, setProgramName] = useState('Current Program');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(0);
  const [workouts, setWorkouts] = useState<WeekWorkout[]>([]);

  useEffect(() => {
    const fetchPlan = async () => {
      setLoading(true);
      setError(null);
      try {
        const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
        const userId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || user?.id || 0);
        if (!userId) {
          setError('No active user session found.');
          setWorkouts([]);
          return;
        }

        const data = await api.getUserProgram(userId);
        const weekWorkoutsRaw: RawWeekWorkout[] = Array.isArray(data?.currentWeekWorkouts)
          ? data.currentWeekWorkouts
          : [];
        const normalized = weekWorkoutsRaw
          .map((w) => ({
            id: Number(w.id || 0),
            workout_name: String(w.workout_name || 'Workout'),
            workout_type: w.workout_type || null,
            day_order: Number(w.day_order || 0),
            day_name: String(w.day_name || ''),
            notes: w.notes || null,
            exercises: parseExercises(w.exercises),
          }))
          .sort((a: WeekWorkout, b: WeekWorkout) => a.day_order - b.day_order);

        setProgramName(String(data?.name || 'Current Program'));
        setCurrentWeek(Number(data?.currentWeek || 1));
        setTotalWeeks(Number(data?.totalWeeks || 0));
        setWorkouts(normalized);
      } catch (e) {
        console.error('Failed to load current week plan:', e);
        setError('Failed to load current week plan.');
      } finally {
        setLoading(false);
      }
    };

    void fetchPlan();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-background pb-24">
      <div className="px-6 pt-2">
        <Header title="Current Week Plan" onBack={onBack} />
      </div>

      <div className="px-6 pt-2 space-y-4">
        <div className="bg-card rounded-xl border border-white/10 p-4">
          <div className="text-sm text-text-secondary">Program</div>
          <div className="text-white font-semibold mt-1">{programName}</div>
          <div className="text-xs text-text-tertiary mt-1">
            Week {currentWeek}{totalWeeks > 0 ? ` / ${totalWeeks}` : ''}
          </div>
        </div>

        {loading && (
          <div className="text-text-secondary text-sm">Loading current week workouts...</div>
        )}

        {!loading && error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && workouts.length === 0 && (
          <div className="bg-card rounded-xl border border-white/10 p-4 text-sm text-text-secondary">
            No workouts found for this week.
          </div>
        )}

        {!loading && !error && workouts.length > 0 && (
          <div className="space-y-3">
            {workouts.map((workout) => (
              <div key={`${workout.id}-${workout.day_order}`} className="bg-card rounded-xl border border-white/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase text-text-secondary">{workout.day_name || `Day ${workout.day_order}`}</div>
                    <div className="text-white font-semibold">{workout.workout_name}</div>
                  </div>
                  {workout.workout_type && (
                    <span className="text-[10px] uppercase text-accent bg-accent/10 border border-accent/20 px-2 py-1 rounded">
                      {workout.workout_type}
                    </span>
                  )}
                </div>

                {workout.exercises.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {workout.exercises.slice(0, 6).map((ex, idx) => (
                      <div key={`${workout.id}-ex-${idx}`} className="text-xs text-text-secondary">
                        <span className="text-white">{ex.exerciseName || ex.name || 'Exercise'}</span>
                        {' | '}
                        <span>{Number(ex.sets || 0)} sets</span>
                        {' | '}
                        <span>{String(ex.reps || '-')}</span>
                        {' | '}
                        <span>{Number(ex.rest || 0)}s rest</span>
                      </div>
                    ))}
                    {workout.exercises.length > 6 && (
                      <div className="text-xs text-text-tertiary">+{workout.exercises.length - 6} more exercises</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCreateCustom}
            className="w-full bg-white/5 text-white border border-white/10 font-semibold rounded-xl p-3 hover:bg-white/10 transition-colors"
          >
            Customize Plan
          </button>
          <button
            type="button"
            onClick={onOpenWorkout}
            className="w-full bg-accent text-black font-semibold rounded-xl p-3 hover:bg-accent/90 transition-colors"
          >
            Open Workout
          </button>
        </div>
      </div>
    </div>
  );
}

