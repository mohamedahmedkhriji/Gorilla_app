import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../ui/Header';
import { api } from '../../services/api';
import { Bookmark, CalendarX2, Plus, Play, Search, TriangleAlert, X } from 'lucide-react';
import { getBodyPartImage } from '../../services/bodyPartTheme';

interface WorkoutPlanScreenProps {
  onBack: () => void;
  onExerciseClick: (exercise: string) => void;
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

type RecoveryItem = {
  muscle?: string;
  name?: string;
  score?: number;
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

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const toTitleCase = (value: string) =>
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

  return [...new Set(matches.map((entry) => toTitleCase(entry)).filter(Boolean))];
};

const getMuscleImage = (muscle: string) => getBodyPartImage(muscle);

const formatRestLabel = (rest: unknown) => {
  const numeric = Number(rest || 0);
  if (Number.isFinite(numeric) && numeric > 0) return `${numeric}s rest`;
  return 'Rest as needed';
};

const resolvePrimaryExerciseMuscle = (exercise: WorkoutExerciseCard) => {
  const inferredMuscles = inferMusclesFromExerciseName(exercise.name);
  const normalizedTargets = exercise.targetMuscles.map((entry) => toTitleCase(String(entry || ''))).filter(Boolean);

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
  onMissDay,
  onOpenLatestSummary,
  hasLatestSummary = false,
  workoutDay,
  workoutDayLabel,
  completedExercises,
  todayExercises,
  loading,
}: WorkoutPlanScreenProps) {
  const [recoveryByMuscle, setRecoveryByMuscle] = useState<Record<string, number>>({});
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatalogMuscle, setSelectedCatalogMuscle] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMissModalOpen, setIsMissModalOpen] = useState(false);
  const [addExerciseFeedback, setAddExerciseFeedback] = useState<string | null>(null);
  const [missDayFeedback, setMissDayFeedback] = useState<string | null>(null);
  const [isSubmittingExercise, setIsSubmittingExercise] = useState(false);
  const [isSubmittingMissDay, setIsSubmittingMissDay] = useState(false);

  useEffect(() => {
    const loadRecovery = async () => {
      const user = readStoredUser();
      if (!user?.id) {
        setRecoveryByMuscle({});
        return;
      }

      try {
        const data = await api.getRecoveryStatus(user.id);
        const lookup = (Array.isArray(data?.recovery) ? data.recovery : []).reduce((acc: Record<string, number>, item: RecoveryItem) => {
          const key = String(item?.name || item?.muscle || '').trim().toLowerCase();
          const score = Number(item?.score || 0);
          if (!key) return acc;
          acc[key] = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 100;
          return acc;
        }, {});
        setRecoveryByMuscle(lookup);
      } catch {
        setRecoveryByMuscle({});
      }
    };

    void loadRecovery();
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
        setCatalogError('Could not load exercise catalog.');
      } finally {
        setCatalogLoading(false);
      }
    };

    void loadCatalog();
  }, [isAddModalOpen, catalogLoaded, catalogLoading]);

  const exercises: WorkoutExerciseCard[] = todayExercises.map((ex) => {
    const targetMuscles = Array.isArray(ex?.targetMuscles) && ex.targetMuscles.length
      ? ex.targetMuscles.map((entry: unknown) => toTitleCase(String(entry || ''))).filter(Boolean)
      : ex?.muscleGroup
        ? [toTitleCase(String(ex.muscleGroup))]
        : inferMusclesFromExerciseName(String(ex.exerciseName || ex.name || ''));

    return {
      name: String(ex.exerciseName || ex.name || 'Exercise').trim(),
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

  const targetMuscles = exercises.reduce((acc: Array<{ name: string; score: number }>, exercise) => {
    exercise.targetMuscles.forEach((muscle) => {
      const normalized = toTitleCase(muscle);
      if (!normalized || acc.some((entry) => entry.name === normalized)) return;
      acc.push({
        name: normalized,
        score: recoveryByMuscle[normalized.toLowerCase()] ?? 100,
      });
    });
    return acc;
  }, []).slice(0, 4);

  const displayTargetMuscles = useMemo(() => {
    if (targetMuscles.length > 0) return targetMuscles;

    return Object.entries(recoveryByMuscle)
      .map(([name, score]) => ({
        name: toTitleCase(name),
        score: Number.isFinite(Number(score)) ? Math.max(0, Math.min(100, Number(score))) : 100,
      }))
      .filter((entry) => entry.name)
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, 4);
  }, [targetMuscles, recoveryByMuscle]);

  const catalogMuscles = useMemo(() => {
    const counts = new Map<string, number>();

    catalog.forEach((exercise) => {
      const label = toTitleCase(exercise.muscle || exercise.bodyPart || 'General');
      counts.set(label, (counts.get(label) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    if (!selectedCatalogMuscle) return [];

    const query = searchQuery.trim().toLowerCase();
    return catalog
      .filter((exercise) => toTitleCase(exercise.muscle || exercise.bodyPart || 'General') === selectedCatalogMuscle)
      .filter((exercise) => {
        if (!query) return true;
        const haystack = `${exercise.name} ${exercise.muscle} ${exercise.bodyPart || ''}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 40);
  }, [catalog, searchQuery, selectedCatalogMuscle]);

  const isRestDayView = useMemo(() => {
    const label = `${String(workoutDayLabel || '').trim().toLowerCase()} ${String(workoutDay || '').trim().toLowerCase()}`;
    return label.includes('rest') || label.includes('recovery');
  }, [workoutDay, workoutDayLabel]);

  const headerTitle = String(workoutDayLabel || workoutDay || 'Workout').trim() || 'Workout';

  const headerActions = (
    <div className="flex items-center gap-2">
      {!isRestDayView && onMissDay && (
        <button
          type="button"
          onClick={() => {
            setMissDayFeedback(null);
            setIsMissModalOpen(true);
          }}
          className="flex h-10 items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-200 transition-colors hover:border-rose-400/30 hover:bg-rose-500/15"
          aria-label="Mark today as missed"
        >
          <CalendarX2 size={15} />
          <span className="hidden sm:inline">Miss Day</span>
        </button>
      )}

      <button
        type="button"
        onClick={onOpenLatestSummary}
        className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
          hasLatestSummary
            ? 'border-accent/35 bg-accent/10 text-accent hover:bg-accent/20'
            : 'border-white/10 bg-card/60 text-text-tertiary hover:text-text-secondary'
        }`}
        aria-label="Open latest workout summary"
      >
        <Bookmark size={17} />
      </button>
    </div>
  );

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
          <div className="text-text-secondary">Loading workout...</div>
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
        setAddExerciseFeedback(result?.reason || 'Could not add exercise.');
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
        setMissDayFeedback(result?.reason || 'Could not mark this workout as missed.');
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
          rightElement={headerActions}
        />
      </div>

      <div className="mt-2 space-y-4 px-4 sm:px-6">
        {!isRestDayView && (
          <div className="rounded-2xl border border-white/10 bg-card/60 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
              Workout
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              {workoutDay}
            </div>
          </div>
        )}
        {!isRestDayView && (
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Target Muscles
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
                          alt={muscle.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{muscle.name}</div>
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
                Target muscles will appear after exercises are loaded.
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <h3 className="text-xl font-semibold text-white">
            {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}
          </h3>
          <button
            type="button"
            onClick={openAddExerciseModal}
            disabled={isRestDayView}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-text-tertiary disabled:hover:bg-white/10"
            aria-label="Add exercise"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {exercises.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-card/70 px-4 py-5 text-sm text-text-secondary">
              {isRestDayView
                ? 'Rest day. No workout scheduled for today.'
                : 'No exercises added for today yet. Tap the plus button to add one.'}
            </div>
          )}

          {exercises.map((exercise, index) => {
            const isCompleted = completedLookup.has(String(exercise.name || '').trim().toLowerCase());
            const isNext = nextExercise?.name === exercise.name && !isCompleted;
            const primaryMuscle = resolvePrimaryExerciseMuscle(exercise);

            return (
              <button
                key={exercise.name || index}
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
                    <img
                      src={getMuscleImage(primaryMuscle)}
                      alt={exercise.name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold text-white">{exercise.name}</h4>
                      <p className="mt-1 text-xs text-text-secondary">
                        {exercise.sets} sets - {exercise.reps || '--'} reps - {exercise.targetWeight ? `${exercise.targetWeight} kg` : formatRestLabel(exercise.rest)}
                      </p>
                      {!!exercise.targetMuscles.length && (
                        <p className="mt-2 truncate text-[11px] text-text-tertiary">
                          {exercise.targetMuscles.join(' - ')}
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
              type="button"
              onClick={() => nextExercise && onExerciseClick(nextExercise.name)}
              className="w-full rounded-2xl bg-accent px-5 py-4 text-sm font-bold uppercase tracking-[0.08em] text-black shadow-[0_10px_30px_rgba(191,255,0,0.22)] transition-colors hover:bg-[#aee600]"
            >
              Start Workout
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
            className="w-full max-w-3xl rounded-3xl border border-white/10 bg-card p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Add Exercise</h3>
                <p className="mt-1 text-sm text-text-secondary">Pick an exercise to add for today.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-text-secondary transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close add exercise dialog"
              >
                <X size={18} />
              </button>
            </div>

            {addExerciseFeedback && (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                {addExerciseFeedback}
              </div>
            )}

            <div className="mt-4 max-h-[70vh] space-y-5 overflow-y-auto pr-1">
              {catalogLoading && (
                <div className="rounded-2xl border border-white/8 bg-background/60 px-4 py-3 text-sm text-text-secondary">
                  Loading exercises...
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
                          {selectedCatalogMuscle || 'Exercises'}
                        </div>
                        <div className="mt-1 text-sm text-white">
                          {selectedCatalogMuscle
                            ? 'Choose an exercise card to add it to today.'
                            : 'Select a muscle group below to browse exercises.'}
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
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="relative mt-4">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={selectedCatalogMuscle ? 'Search exercise name...' : 'Select a muscle group first'}
                        disabled={!selectedCatalogMuscle}
                        className="w-full rounded-2xl border border-white/10 bg-background py-3 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>

                    {!selectedCatalogMuscle && (
                      <div className="mt-4 rounded-2xl border border-white/8 bg-background/60 px-4 py-5 text-sm text-text-secondary">
                        Pick a muscle card below to load matching exercises.
                      </div>
                    )}

                    {selectedCatalogMuscle && filteredCatalog.length === 0 && (
                      <div className="mt-4 rounded-2xl border border-white/8 bg-background/60 px-4 py-5 text-sm text-text-secondary">
                        No matching exercise found for {selectedCatalogMuscle}.
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
                                void handleAddExercise(exercise);
                              }}
                              disabled={isSubmittingExercise}
                              className="surface-card rounded-2xl p-3 text-left transition-colors group hover:border-accent/20"
                            >
                              <div className="relative mb-3 aspect-video overflow-hidden rounded-lg border border-white/8 bg-white/5">
                                <img
                                  src={getMuscleImage(muscleLabel)}
                                  alt={exercise.name}
                                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors group-hover:bg-accent group-hover:text-black">
                                    <Play size={12} fill="currentColor" />
                                  </div>
                                </div>
                                <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                                  Add
                                </div>
                              </div>
                              <div className="truncate text-sm font-bold text-white">{exercise.name}</div>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <div className="truncate text-[10px] uppercase tracking-wider text-text-secondary">
                                  {muscleLabel}
                                </div>
                                <div className="rounded-full bg-accent/15 px-2 py-1 text-[10px] font-semibold text-accent">
                                  Add
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-3 text-xs font-bold uppercase tracking-wider text-text-secondary">
                      Muscle Groups
                    </div>
                    {catalogMuscles.length === 0 ? (
                      <div className="rounded-2xl border border-white/8 bg-background/60 px-4 py-3 text-sm text-text-secondary">
                        No exercise groups available.
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
                              className={`rounded-2xl border p-3 text-left transition-colors ${
                                isSelected
                                  ? 'border-accent/45 bg-accent/10'
                                  : 'border-white/8 bg-background/60 hover:border-accent/25 hover:bg-accent/5'
                              }`}
                            >
                              <div className="aspect-[4/3] overflow-hidden rounded-xl border border-white/8 bg-white/5">
                                <img
                                  src={getMuscleImage(muscle.name)}
                                  alt={muscle.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="mt-3">
                                <div className="truncate text-sm font-semibold text-white">{muscle.name}</div>
                                <div className="mt-1 text-[11px] text-text-secondary">
                                  {muscle.count} {muscle.count === 1 ? 'exercise' : 'exercises'}
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
            className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(27,31,43,0.98),rgba(15,18,28,0.98))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.18),transparent_70%)]" />

            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/12 text-rose-200">
                    <TriangleAlert size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">Miss today&apos;s workout?</h3>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                      This will mark <span className="text-white">{workoutDay}</span> as missed, remove it from today&apos;s active flow, and break your current workout streak for today.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMissModalOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-text-secondary transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Close miss day dialog"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-text-secondary">
                Use this only when you are intentionally skipping the scheduled session.
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
                  Keep Workout
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleMissDay();
                  }}
                  disabled={isSubmittingMissDay}
                  className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingMissDay ? 'Marking...' : 'Yes, Miss This Day'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
