import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Header } from '../ui/Header';
import { api } from '../../services/api';

interface CustomPlanBuilderScreenProps {
  onBack: () => void;
  onSaved: () => void;
}

interface CatalogExercise {
  id: number;
  name: string;
}

interface PlanExerciseDraft {
  exerciseName: string;
  exerciseCatalogId: number | null;
  sets: number;
  reps: string;
  restSeconds: number;
}

interface DayPlanDraft {
  workoutName: string;
  exercises: PlanExerciseDraft[];
}

interface RawCatalogExercise {
  id?: number;
  name?: string;
}

interface RawProgramWorkout {
  day_order?: number;
  day_name?: string;
  workout_name?: string;
  exercises?: unknown;
}

interface RawProgramResponse {
  name?: string;
  totalWeeks?: number;
  currentWeekWorkouts?: RawProgramWorkout[];
}

interface ExerciseAutocompleteFieldProps {
  value: string;
  options: CatalogExercise[];
  onChange: (nextValue: string) => void;
  onSelect: (exercise: CatalogExercise) => void;
  placeholder?: string;
  className?: string;
}

const WEEK_DAYS: Array<{ key: string; label: string }> = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

const fullDayName = (dayKey: string) => {
  const entry = WEEK_DAYS.find((d) => d.key === dayKey);
  return entry ? entry.label : dayKey;
};

const createDefaultExercise = (): PlanExerciseDraft => ({
  exerciseName: '',
  exerciseCatalogId: null,
  sets: 3,
  reps: '8-12',
  restSeconds: 90,
});

const parseExercises = (raw: unknown) => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

function ExerciseAutocompleteField({
  value,
  options,
  onChange,
  onSelect,
  placeholder = 'Exercise name',
  className = '',
}: ExerciseAutocompleteFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const filteredOptions = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return options.slice(0, 10);
    return options
      .filter((exercise) => exercise.name.toLowerCase().includes(query))
      .slice(0, 10);
  }, [options, value]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsOpen(false);
            return;
          }
          if (e.key === 'Enter' && isOpen && filteredOptions.length) {
            e.preventDefault();
            onSelect(filteredOptions[0]);
            setIsOpen(false);
          }
        }}
        placeholder={placeholder}
        className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-accent/60"
      />

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-30 max-h-56 overflow-y-auto bg-card border border-white/10 rounded-lg shadow-xl">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(exercise);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
              >
                {exercise.name}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-text-secondary">
              No matching exercise
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CustomPlanBuilderScreen({ onBack, onSaved }: CustomPlanBuilderScreenProps) {
  const [loading, setLoading] = useState(true);
  const [activeSubmitMode, setActiveSubmitMode] = useState<'direct' | 'coach' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [planName, setPlanName] = useState('My Custom Plan');
  const [cycleWeeks, setCycleWeeks] = useState(4);
  const [selectedDays, setSelectedDays] = useState<string[]>(['monday', 'wednesday', 'friday']);
  const [dayPlans, setDayPlans] = useState<Record<string, DayPlanDraft>>({});

  const catalogByName = useMemo(() => {
    const map = new Map<string, CatalogExercise>();
    catalog.forEach((exercise) => {
      map.set(exercise.name.trim().toLowerCase(), exercise);
    });
    return map;
  }, [catalog]);

  const ensureDayPlan = (dayKey: string): DayPlanDraft => {
    return dayPlans[dayKey] || {
      workoutName: `${fullDayName(dayKey)} Workout`,
      exercises: [createDefaultExercise()],
    };
  };

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      setError(null);
      try {
        const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
        const userId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || user?.id || 0);
        if (!userId) {
          setError('No active user session found.');
          return;
        }

        const [catalogRes, programRes] = await Promise.all([
          api.getExerciseCatalog('All', '', 500),
          api.getUserProgram(userId),
        ]);
        const typedProgram = (programRes || {}) as RawProgramResponse;

        const catalogExercises = Array.isArray(catalogRes?.exercises)
          ? (catalogRes.exercises as RawCatalogExercise[])
            .map((ex) => ({
              id: Number(ex.id || 0),
              name: String(ex.name || '').trim(),
            }))
            .filter((ex: CatalogExercise) => ex.id > 0 && ex.name.length > 0)
          : [];
        setCatalog(catalogExercises);

        const currentWeekWorkouts = Array.isArray(typedProgram.currentWeekWorkouts)
          ? typedProgram.currentWeekWorkouts
          : [];
        if (!currentWeekWorkouts.length) {
          return;
        }

        const sorted = [...currentWeekWorkouts].sort((a, b) => Number(a.day_order || 0) - Number(b.day_order || 0));
        const days = sorted
          .map((workout) => String(workout.day_name || '').trim().toLowerCase())
          .filter((day: string) => WEEK_DAYS.some((entry) => entry.key === day));
        const uniqueDays = [...new Set(days)];
        if (uniqueDays.length) setSelectedDays(uniqueDays);

        const nextPlans: Record<string, DayPlanDraft> = {};
        sorted.forEach((workout) => {
          const dayKey = String(workout.day_name || '').trim().toLowerCase();
          if (!WEEK_DAYS.some((entry) => entry.key === dayKey)) return;

          const normalizedWorkoutName = String(workout.workout_name || '')
            .replace(/^week\s+\d+\s*-\s*/i, '')
            .trim() || `${fullDayName(dayKey)} Workout`;

          const rawExercises = parseExercises(workout.exercises);
          const exercises = rawExercises
            .map((exercise) => {
              const raw = typeof exercise === 'object' && exercise !== null
                ? (exercise as Record<string, unknown>)
                : {};
              return {
                exerciseName: String(raw.exerciseName || raw.name || '').trim(),
                exerciseCatalogId: null,
                sets: Math.max(1, Math.min(10, Math.round(Number(raw.sets || 3)))),
                reps: String(raw.reps || '8-12').slice(0, 20),
                restSeconds: Math.max(30, Math.min(600, Math.round(Number(raw.rest || 90)))),
              };
            })
            .filter((exercise: PlanExerciseDraft) => exercise.exerciseName.length > 0);

          nextPlans[dayKey] = {
            workoutName: normalizedWorkoutName,
            exercises: exercises.length ? exercises : [createDefaultExercise()],
          };
        });
        setDayPlans(nextPlans);

        const inferredWeeks = Number(typedProgram.totalWeeks || 0);
        if (Number.isFinite(inferredWeeks) && inferredWeeks >= 2 && inferredWeeks <= 8) {
          setCycleWeeks(inferredWeeks);
        }

        if (typedProgram.name) {
          setPlanName(String(typedProgram.name).slice(0, 255));
        }
      } catch (e) {
        console.error('Failed to initialize custom plan builder:', e);
        setError('Could not load data to build your custom plan.');
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, []);

  const toggleDay = (dayKey: string) => {
    setSelectedDays((prev) => {
      if (prev.includes(dayKey)) return prev.filter((d) => d !== dayKey);
      return [...prev, dayKey];
    });
    setDayPlans((prev) => ({
      ...prev,
      [dayKey]: prev[dayKey] || {
        workoutName: `${fullDayName(dayKey)} Workout`,
        exercises: [createDefaultExercise()],
      },
    }));
  };

  const setWorkoutName = (dayKey: string, value: string) => {
    setDayPlans((prev) => ({
      ...prev,
      [dayKey]: {
        ...ensureDayPlan(dayKey),
        workoutName: value,
      },
    }));
  };

  const addExercise = (dayKey: string) => {
    setDayPlans((prev) => ({
      ...prev,
      [dayKey]: {
        ...ensureDayPlan(dayKey),
        exercises: [...ensureDayPlan(dayKey).exercises, createDefaultExercise()],
      },
    }));
  };

  const removeExercise = (dayKey: string, index: number) => {
    const plan = ensureDayPlan(dayKey);
    const nextExercises = plan.exercises.filter((_, i) => i !== index);
    setDayPlans((prev) => ({
      ...prev,
      [dayKey]: {
        ...plan,
        exercises: nextExercises.length ? nextExercises : [createDefaultExercise()],
      },
    }));
  };

  const updateExercise = (dayKey: string, index: number, patch: Partial<PlanExerciseDraft>) => {
    const plan = ensureDayPlan(dayKey);
    const nextExercises = plan.exercises.map((exercise, i) => (i === index ? { ...exercise, ...patch } : exercise));
    setDayPlans((prev) => ({
      ...prev,
      [dayKey]: {
        ...plan,
        exercises: nextExercises,
      },
    }));
  };

  const handleExerciseNameChange = (dayKey: string, index: number, inputName: string) => {
    const normalized = inputName.trim().toLowerCase();
    const catalogMatch = catalogByName.get(normalized) || null;
    updateExercise(dayKey, index, {
      exerciseName: inputName,
      exerciseCatalogId: catalogMatch ? catalogMatch.id : null,
    });
  };

  const handleExerciseSelect = (dayKey: string, index: number, exercise: CatalogExercise) => {
    updateExercise(dayKey, index, {
      exerciseName: exercise.name,
      exerciseCatalogId: exercise.id,
    });
  };

  const handleSubmit = async (mode: 'direct' | 'coach') => {
    setError(null);
    setSuccess(null);
    if (!selectedDays.length) {
      setError('Select at least one training day.');
      return;
    }

    const validDays = selectedDays.filter((day) => WEEK_DAYS.some((entry) => entry.key === day));
    if (!validDays.length) {
      setError('No valid training days selected.');
      return;
    }

    const weeklyWorkouts = [];
    for (const dayKey of validDays) {
      const plan = ensureDayPlan(dayKey);
      const workoutName = String(plan.workoutName || '').trim() || `${fullDayName(dayKey)} Workout`;
      const exercises = plan.exercises
        .map((exercise) => ({
          exerciseCatalogId: exercise.exerciseCatalogId || null,
          exerciseName: String(exercise.exerciseName || '').trim(),
          sets: Math.max(1, Math.min(10, Math.round(Number(exercise.sets || 0)))),
          reps: String(exercise.reps || '8-12').slice(0, 20),
          restSeconds: Math.max(30, Math.min(600, Math.round(Number(exercise.restSeconds || 90)))),
        }))
        .filter((exercise) => exercise.exerciseName.length > 0 || Boolean(exercise.exerciseCatalogId));

      if (!exercises.length) {
        setError(`Add at least one exercise for ${fullDayName(dayKey)}.`);
        return;
      }

      weeklyWorkouts.push({
        dayName: dayKey,
        workoutName,
        workoutType: 'Custom',
        exercises,
      });
    }

    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const userId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || user?.id || 0);
    if (!userId) {
      setError('No active user session found.');
      return;
    }

    setActiveSubmitMode(mode);
    try {
      const payload = {
        planName: String(planName || 'My Custom Plan').trim() || 'My Custom Plan',
        cycleWeeks: Math.max(2, Math.min(8, Math.round(Number(cycleWeeks || 4)))),
        selectedDays: validDays,
        weeklyWorkouts,
      };

      if (mode === 'coach') {
        const result = await api.requestCustomProgramApproval(userId, payload);
        if (!result?.success) {
          throw new Error(result?.error || 'Failed to send plan to coach');
        }
        setSuccess('Plan sent to coach for approval. It will activate only after approval.');
        window.setTimeout(() => onBack(), 700);
        return;
      }

      const result = await api.saveCustomProgram(userId, payload);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to save custom plan');
      }
      localStorage.removeItem('recoveryNeedsUpdate');
      onSaved();
    } catch (e) {
      console.error('Failed to save custom plan:', e);
      setError(e instanceof Error ? e.message : 'Failed to save custom plan.');
    } finally {
      setActiveSubmitMode(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background pb-24">
      <div className="px-6 pt-2">
        <Header title="Build Custom Plan" onBack={onBack} />
      </div>

      <div className="px-6 pt-4 space-y-4">
        {loading ? (
          <div className="text-sm text-text-secondary">Loading plan builder...</div>
        ) : (
          <>
            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-sm p-3">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl border border-green-500/40 bg-green-500/10 text-green-300 text-sm p-3">
                {success}
              </div>
            )}

            <div className="bg-card border border-white/10 rounded-xl p-4 space-y-3">
              <label className="block">
                <span className="text-xs uppercase text-text-secondary">Plan Name</span>
                <input
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-accent/60"
                  maxLength={255}
                />
              </label>

              <label className="block">
                <span className="text-xs uppercase text-text-secondary">Duration (Weeks)</span>
                <input
                  type="number"
                  min={2}
                  max={8}
                  value={cycleWeeks}
                  onChange={(e) => setCycleWeeks(Math.max(2, Math.min(8, Number(e.target.value || 4))))}
                  className="mt-1 w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-accent/60"
                />
              </label>
            </div>

            <div className="bg-card border border-white/10 rounded-xl p-4">
              <div className="text-xs uppercase text-text-secondary mb-3">Training Days</div>
              <div className="grid grid-cols-4 gap-2">
                {WEEK_DAYS.map((day) => {
                  const active = selectedDays.includes(day.key);
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => toggleDay(day.key)}
                      className={`rounded-lg py-2 text-sm border transition-colors ${
                        active
                          ? 'bg-accent/20 border-accent text-accent'
                          : 'bg-background border-white/10 text-text-secondary hover:text-white'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDays.map((dayKey) => {
              const dayPlan = ensureDayPlan(dayKey);
              return (
                <div key={dayKey} className="bg-card border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-white font-semibold">{fullDayName(dayKey)} Plan</div>
                    <button
                      type="button"
                      onClick={() => addExercise(dayKey)}
                      className="text-xs text-accent hover:text-white transition-colors"
                    >
                      + Add Exercise
                    </button>
                  </div>

                  <input
                    type="text"
                    value={dayPlan.workoutName}
                    onChange={(e) => setWorkoutName(dayKey, e.target.value)}
                    placeholder={`${fullDayName(dayKey)} Workout`}
                    className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-accent/60"
                  />

                  <div className="grid grid-cols-12 gap-2 px-1 text-[10px] uppercase text-text-secondary">
                    <div className="col-span-12 sm:col-span-5">Exercise</div>
                    <div className="col-span-4 sm:col-span-2">Sets</div>
                    <div className="col-span-4 sm:col-span-4">Reps</div>
                    <div className="col-span-1"> </div>
                  </div>

                  <div className="space-y-2">
                    {dayPlan.exercises.map((exercise, index) => (
                      <div key={`${dayKey}-ex-${index}`} className="grid grid-cols-12 gap-2 items-center">
                        <ExerciseAutocompleteField
                          value={exercise.exerciseName}
                          options={catalog}
                          onChange={(nextValue) => handleExerciseNameChange(dayKey, index, nextValue)}
                          onSelect={(selected) => handleExerciseSelect(dayKey, index, selected)}
                          placeholder="Exercise name"
                          className="col-span-12 sm:col-span-5"
                        />
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={exercise.sets}
                          onChange={(e) => updateExercise(dayKey, index, { sets: Number(e.target.value || 1) })}
                          className="col-span-4 sm:col-span-2 bg-background border border-white/10 rounded-lg px-2 py-2 text-white text-sm outline-none focus:border-accent/60"
                          title="Sets"
                          placeholder="Sets"
                          aria-label="Sets"
                        />
                        <input
                          type="text"
                          value={exercise.reps}
                          onChange={(e) => updateExercise(dayKey, index, { reps: e.target.value })}
                          className="col-span-4 sm:col-span-4 bg-background border border-white/10 rounded-lg px-2 py-2 text-white text-sm outline-none focus:border-accent/60"
                          title="Reps"
                          placeholder="Reps"
                          aria-label="Reps"
                        />
                        <button
                          type="button"
                          onClick={() => removeExercise(dayKey, index)}
                          className="col-span-1 text-red-400 hover:text-red-300 text-sm"
                          title="Remove exercise"
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSubmit('coach')}
                disabled={Boolean(activeSubmitMode)}
                className="w-full bg-white/5 text-white border border-white/10 font-semibold rounded-xl p-3 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {activeSubmitMode === 'coach' ? 'Sending...' : 'Send To Coach'}
              </button>
              <button
                type="button"
                onClick={() => handleSubmit('direct')}
                disabled={Boolean(activeSubmitMode)}
                className="w-full bg-accent text-black font-semibold rounded-xl p-3 hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {activeSubmitMode === 'direct' ? 'Saving...' : 'Save Directly'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
