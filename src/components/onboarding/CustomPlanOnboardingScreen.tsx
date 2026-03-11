import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { api } from '../../services/api';

interface CustomPlanOnboardingScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
}

type ExerciseDraft = {
  exerciseName: string;
  exerciseCatalogId: number | null;
  sets: number;
  reps: string;
  restSeconds: number;
};

type DayPlanDraft = {
  workoutName: string;
  exercises: ExerciseDraft[];
};

type CatalogExercise = {
  id: number;
  name: string;
  muscle: string;
  bodyPart?: string | null;
};

interface RawCatalogExercise {
  id?: number;
  name?: string;
  muscle?: string;
  bodyPart?: string | null;
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

const toTrainingDays = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4;
  return Math.max(2, Math.min(6, Math.round(parsed)));
};

const createDefaultExercise = (): ExerciseDraft => ({
  exerciseName: '',
  exerciseCatalogId: null,
  sets: 3,
  reps: '8-12',
  restSeconds: 90,
});

const createDefaultDayPlan = (dayKey: string): DayPlanDraft => ({
  workoutName: `${dayKey.charAt(0).toUpperCase()}${dayKey.slice(1)} Workout`,
  exercises: [createDefaultExercise()],
});

const createInitialDays = (trainingDays: number) => {
  return WEEK_DAYS.slice(0, trainingDays).map((entry) => entry.key);
};

const toValidDays = (days: unknown[]): string[] => {
  const valid = new Set(WEEK_DAYS.map((entry) => entry.key));
  return [...new Set(days.map((day) => String(day || '').trim().toLowerCase()).filter((day) => valid.has(day)))];
};

const getCatalogExerciseMuscle = (exercise?: Pick<CatalogExercise, 'muscle' | 'bodyPart'> | null) => {
  const normalizedMuscle = String(exercise?.muscle || '').trim();
  if (normalizedMuscle && normalizedMuscle.toLowerCase() !== 'other') return normalizedMuscle;

  const bodyPart = String(exercise?.bodyPart || '').trim();
  if (bodyPart) return bodyPart;

  return '';
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
        className="w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent/60"
      />

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-30 max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-card shadow-xl">
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
                className="w-full px-3 py-2 text-left text-sm text-white transition-colors hover:bg-white/10"
              >
                <div>{exercise.name}</div>
                <div className="text-[11px] uppercase tracking-[0.08em] text-text-secondary">
                  {getCatalogExerciseMuscle(exercise) || 'General'}
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-text-secondary">No matching exercise</div>
          )}
        </div>
      )}
    </div>
  );
}

export function CustomPlanOnboardingScreen({
  onNext,
  onDataChange,
  onboardingData,
}: CustomPlanOnboardingScreenProps) {
  const trainingDays = toTrainingDays(onboardingData?.workoutDays);
  const existing = onboardingData?.customPlan || {};

  const defaultSelectedDays = useMemo(
    () => (
      Array.isArray(existing.selectedDays) && toValidDays(existing.selectedDays).length
        ? toValidDays(existing.selectedDays)
        : createInitialDays(trainingDays)
    ),
    [existing.selectedDays, trainingDays],
  );

  const [planName, setPlanName] = useState<string>(
    String(existing.planName || 'My Custom Plan'),
  );
  const [cycleWeeks, setCycleWeeks] = useState<number>(
    Math.max(8, Math.min(16, Number(existing.cycleWeeks || 8))),
  );
  const [selectedDays, setSelectedDays] = useState<string[]>(defaultSelectedDays);
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [error, setError] = useState<string>('');

  const catalogByName = useMemo(() => {
    const map = new Map<string, CatalogExercise>();
    catalog.forEach((exercise) => {
      map.set(exercise.name.trim().toLowerCase(), exercise);
    });
    return map;
  }, [catalog]);

  const catalogById = useMemo(() => {
    const map = new Map<number, CatalogExercise>();
    catalog.forEach((exercise) => {
      map.set(exercise.id, exercise);
    });
    return map;
  }, [catalog]);

  const initialDayPlans = useMemo(() => {
    const fromPayload = new Map<string, DayPlanDraft>();
    const payloadWorkouts = Array.isArray(existing.weeklyWorkouts) ? existing.weeklyWorkouts : [];
    payloadWorkouts.forEach((workout: any) => {
      const dayName = String(workout?.dayName || '').trim().toLowerCase();
      if (!dayName) return;
      const rawExercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
      const normalizedExercises = rawExercises
        .map((exercise: any) => ({
          exerciseName: String(exercise?.exerciseName || exercise?.name || '').trim(),
          exerciseCatalogId: Number(exercise?.exerciseCatalogId || 0) || null,
          sets: Math.max(1, Math.min(10, Number(exercise?.sets || 3))),
          reps: String(exercise?.reps || '8-12').trim().slice(0, 20) || '8-12',
          restSeconds: Math.max(30, Math.min(600, Number(exercise?.restSeconds || exercise?.rest || 90))),
        }))
        .filter((exercise: ExerciseDraft) => exercise.exerciseName.length > 0);

      fromPayload.set(dayName, {
        workoutName: String(workout?.workoutName || `${dayName} workout`).trim(),
        exercises: normalizedExercises.length ? normalizedExercises : [createDefaultExercise()],
      });
    });

    const nextPlans: Record<string, DayPlanDraft> = {};
    WEEK_DAYS.forEach((day) => {
      nextPlans[day.key] = fromPayload.get(day.key) || createDefaultDayPlan(day.key);
    });
    return nextPlans;
  }, [existing.weeklyWorkouts]);

  const [dayPlans, setDayPlans] = useState<Record<string, DayPlanDraft>>(initialDayPlans);

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

  const toggleDay = (dayKey: string) => {
    setSelectedDays((prev) => (
      prev.includes(dayKey) ? prev.filter((entry) => entry !== dayKey) : [...prev, dayKey]
    ));
    setDayPlans((prev) => ({
      ...prev,
      [dayKey]: prev[dayKey] || createDefaultDayPlan(dayKey),
    }));
  };

  const updateWorkoutName = (dayKey: string, workoutName: string) => {
    setDayPlans((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        workoutName,
      },
    }));
  };

  const addExercise = (dayKey: string) => {
    setDayPlans((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        exercises: [...prev[dayKey].exercises, createDefaultExercise()],
      },
    }));
  };

  const removeExercise = (dayKey: string, index: number) => {
    setDayPlans((prev) => {
      const nextExercises = prev[dayKey].exercises.filter((_, i) => i !== index);
      return {
        ...prev,
        [dayKey]: {
          ...prev[dayKey],
          exercises: nextExercises.length ? nextExercises : [createDefaultExercise()],
        },
      };
    });
  };

  const updateExercise = (
    dayKey: string,
    index: number,
    patch: Partial<ExerciseDraft>,
  ) => {
    setDayPlans((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        exercises: prev[dayKey].exercises.map((exercise, i) => (
          i === index ? { ...exercise, ...patch } : exercise
        )),
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

  const getExerciseTargetLabel = (exercise: ExerciseDraft) => {
    const byId = exercise.exerciseCatalogId ? catalogById.get(Number(exercise.exerciseCatalogId)) : null;
    if (byId) {
      const label = getCatalogExerciseMuscle(byId);
      if (label) return label;
    }

    const byName = catalogByName.get(String(exercise.exerciseName || '').trim().toLowerCase());
    if (byName) {
      const label = getCatalogExerciseMuscle(byName);
      if (label) return label;
    }

    return '';
  };

  useEffect(() => {
    const draftWorkouts = selectedDays.map((dayName) => {
      const plan = dayPlans[dayName] || createDefaultDayPlan(dayName);
      return {
        dayName,
        workoutName: String(plan.workoutName || `${dayName} workout`).trim() || `${dayName} workout`,
        workoutType: 'Custom',
        exercises: plan.exercises.map((exercise) => ({
          exerciseName: String(exercise.exerciseName || '').trim(),
          exerciseCatalogId: Number(exercise.exerciseCatalogId || 0) || null,
          sets: Math.max(1, Math.min(10, Math.round(Number(exercise.sets || 3)))),
          reps: String(exercise.reps || '8-12').trim().slice(0, 20) || '8-12',
          restSeconds: Math.max(30, Math.min(600, Math.round(Number(exercise.restSeconds || 90)))),
        })),
      };
    });

    onDataChange?.({
      customPlan: {
        planName: String(planName || 'My Custom Plan').trim() || 'My Custom Plan',
        cycleWeeks: Math.max(8, Math.min(16, Math.round(Number(cycleWeeks || 8)))),
        selectedDays,
        weeklyWorkouts: draftWorkouts,
      },
    });
  }, [cycleWeeks, dayPlans, onDataChange, planName, selectedDays]);

  const handleContinue = () => {
    setError('');
    if (!selectedDays.length) {
      setError('Select at least one training day.');
      return;
    }

    try {
      const weeklyWorkouts = selectedDays.map((dayName) => {
        const plan = dayPlans[dayName];
        const cleanedExercises = plan.exercises
          .map((exercise) => ({
            exerciseName: String(exercise.exerciseName || '').trim(),
            exerciseCatalogId: Number(exercise.exerciseCatalogId || 0) || null,
            sets: Math.max(1, Math.min(10, Math.round(Number(exercise.sets || 3)))),
            reps: String(exercise.reps || '8-12').trim().slice(0, 20) || '8-12',
            restSeconds: Math.max(30, Math.min(600, Math.round(Number(exercise.restSeconds || 90)))),
          }))
          .filter((exercise) => exercise.exerciseName.length > 0 || Boolean(exercise.exerciseCatalogId));

        if (!cleanedExercises.length) {
          throw new Error(`Add at least one exercise for ${dayName}.`);
        }

        return {
          dayName,
          workoutName: String(plan.workoutName || `${dayName} workout`).trim() || `${dayName} workout`,
          workoutType: 'Custom',
          exercises: cleanedExercises,
        };
      });

      onDataChange?.({
        customPlan: {
          planName: String(planName || 'My Custom Plan').trim() || 'My Custom Plan',
          cycleWeeks: Math.max(8, Math.min(16, Math.round(Number(cycleWeeks || 8)))),
          selectedDays,
          weeklyWorkouts,
        },
      });
      onNext();
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Invalid custom plan.');
    }
  };

  return (
    <div className="flex-1 flex flex-col space-y-5">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">Build your customized plan</h2>
        <p className="text-text-secondary">
          Create your own weekly structure. AI will keep this plan and only provide suggestions to improve it.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-card/70 p-4 space-y-3">
        <label className="block">
          <span className="text-xs uppercase text-text-secondary">Plan Name</span>
          <input
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent/60"
            maxLength={255}
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase text-text-secondary">Duration (Weeks)</span>
          <input
            type="number"
            min={8}
            max={16}
            value={cycleWeeks}
            onChange={(e) => setCycleWeeks(Math.max(8, Math.min(16, Number(e.target.value || 8))))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent/60"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-white/10 bg-card/70 p-4">
        <p className="text-xs uppercase text-text-secondary mb-3">Training Days</p>
        <div className="grid grid-cols-4 gap-2">
          {WEEK_DAYS.map((day) => {
            const active = selectedDays.includes(day.key);
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => toggleDay(day.key)}
                className={`rounded-lg border py-2 text-sm transition-colors ${
                  active
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-white/10 bg-background text-text-secondary hover:text-white'
                }`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDays.map((dayKey) => (
        <div key={dayKey} className="rounded-2xl border border-white/10 bg-card/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-white capitalize">{dayKey} plan</p>
            <button
              type="button"
              onClick={() => addExercise(dayKey)}
              className="text-xs text-accent hover:text-white transition-colors"
            >
              + Add Exercise
            </button>
          </div>

          <input
            value={dayPlans[dayKey].workoutName}
            onChange={(e) => updateWorkoutName(dayKey, e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent/60"
            placeholder="Workout name"
          />

          <div className="space-y-2">
            {dayPlans[dayKey].exercises.map((exercise, index) => {
              const targetLabel = getExerciseTargetLabel(exercise);

              return (
                <div key={`${dayKey}-${index}`} className="rounded-xl border border-white/8 bg-background/60 p-2">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <ExerciseAutocompleteField
                      value={exercise.exerciseName}
                      options={catalog}
                      onChange={(nextValue) => handleExerciseNameChange(dayKey, index, nextValue)}
                      onSelect={(selected) => handleExerciseSelect(dayKey, index, selected)}
                      className="col-span-12 sm:col-span-5"
                      placeholder="Exercise name"
                    />
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={exercise.sets}
                      onChange={(e) => updateExercise(dayKey, index, { sets: Number(e.target.value || 1) })}
                      className="col-span-3 sm:col-span-2 rounded-lg border border-white/10 bg-background px-2 py-2 text-sm text-white outline-none focus:border-accent/60"
                      placeholder="Sets"
                    />
                    <input
                      value={exercise.reps}
                      onChange={(e) => updateExercise(dayKey, index, { reps: e.target.value })}
                      className="col-span-5 sm:col-span-3 rounded-lg border border-white/10 bg-background px-2 py-2 text-sm text-white outline-none focus:border-accent/60"
                      placeholder="Reps"
                    />
                    <input
                      type="number"
                      min={30}
                      max={600}
                      value={exercise.restSeconds}
                      onChange={(e) => updateExercise(dayKey, index, { restSeconds: Number(e.target.value || 90) })}
                      className="col-span-3 sm:col-span-1 rounded-lg border border-white/10 bg-background px-2 py-2 text-sm text-white outline-none focus:border-accent/60"
                      placeholder="Rest"
                    />
                    <button
                      type="button"
                      onClick={() => removeExercise(dayKey, index)}
                      className="col-span-1 text-red-400 hover:text-red-300 text-sm"
                      title="Remove exercise"
                    >
                      x
                    </button>
                    {targetLabel && (
                      <p className="col-span-12 text-[11px] text-accent">
                        Targets: {targetLabel}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex-1" />

      <Button onClick={handleContinue}>Save And Continue</Button>
    </div>
  );
}
