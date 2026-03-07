import React from 'react';
import { motion } from 'framer-motion';
import { Clock3 } from 'lucide-react';

type WorkoutExercise = {
  exerciseName?: unknown;
  exercise_name?: unknown;
  name?: unknown;
  targetMuscles?: unknown;
  muscles?: unknown;
  muscleGroup?: unknown;
  muscle?: unknown;
  bodyPart?: unknown;
  sets?: unknown;
  targetSets?: unknown;
  target_sets?: unknown;
  rest?: unknown;
  restSeconds?: unknown;
  rest_seconds?: unknown;
  duration?: unknown;
};

interface WorkoutCardProps {
  title: string;
  workoutType?: string;
  exercises?: WorkoutExercise[];
  estimatedDurationMinutes?: number | null;
  progress: number;
  isRestDay?: boolean;
}

const cleanWorkoutLabel = (value: string) =>
  String(value || '')
    .replace(/\s*day$/i, '')
    .trim();

const toTitleCase = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const getExerciseName = (exercise: WorkoutExercise) =>
  String(exercise?.exerciseName || exercise?.exercise_name || exercise?.name || '').trim();

const isGenericWorkoutLabel = (value: string) => {
  const normalized = cleanWorkoutLabel(value).toLowerCase();
  return !normalized || ['custom', 'workout', 'session', 'training', 'day'].includes(normalized);
};

const inferMusclesFromExerciseName = (exerciseName: string) => {
  const name = String(exerciseName || '').toLowerCase();
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

  return [...new Set(matches)];
};

const getExerciseSetCount = (exercise: WorkoutExercise) => {
  const raw = Number(
    exercise?.sets
    ?? exercise?.targetSets
    ?? exercise?.target_sets
    ?? 0,
  );
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 1;
};

const parseRestSeconds = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;

  const text = String(value || '').trim().toLowerCase();
  if (!text) return 0;

  const amount = Number.parseFloat(text);
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  if (text.includes('min')) return amount * 60;
  return amount;
};

const getFallbackMuscles = (title: string, workoutType: string) => {
  const label = `${title} ${workoutType}`.toLowerCase();

  if (label.includes('push')) return ['Chest', 'Shoulders', 'Triceps'];
  if (label.includes('pull')) return ['Back', 'Biceps', 'Rear Delts'];
  if (label.includes('leg') || label.includes('lower')) return ['Quadriceps', 'Hamstrings', 'Calves'];
  if (label.includes('upper')) return ['Chest', 'Back', 'Shoulders'];
  if (label.includes('full')) return ['Chest', 'Back', 'Legs'];
  if (label.includes('rest') || label.includes('recovery')) return ['Mobility', 'Walking', 'Sleep'];

  return [];
};

const collectTargetMuscles = (exercises: WorkoutExercise[], title: string, workoutType: string) => {
  const seen = new Set<string>();
  const ordered: string[] = [];

  exercises.forEach((exercise) => {
    const values: string[] = [];

    if (Array.isArray(exercise?.targetMuscles)) {
      values.push(...exercise.targetMuscles.map((entry) => String(entry || '')));
    }

    if (Array.isArray(exercise?.muscles)) {
      values.push(...exercise.muscles.map((entry) => String(entry || '')));
    }

    values.push(
      String(exercise?.muscleGroup || ''),
      String(exercise?.muscle || ''),
      String(exercise?.bodyPart || ''),
    );

    if (!values.some((value) => String(value || '').trim())) {
      values.push(...inferMusclesFromExerciseName(getExerciseName(exercise)));
    }

    values.forEach((value) => {
      const normalized = toTitleCase(value);
      const key = normalized.toLowerCase();
      if (!normalized || seen.has(key)) return;
      seen.add(key);
      ordered.push(normalized);
    });
  });

  if (ordered.length) return ordered.slice(0, 3);
  return getFallbackMuscles(title, workoutType).slice(0, 3);
};

const estimateDurationMinutes = (
  exercises: WorkoutExercise[],
  explicitDurationMinutes?: number | null,
) => {
  const explicit = Number(explicitDurationMinutes || 0);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  if (!exercises.length) return null;

  const totalSetCount = exercises.reduce((sum, exercise) => sum + getExerciseSetCount(exercise), 0);
  const totalRestSeconds = exercises.reduce((sum, exercise) => {
    const setCount = getExerciseSetCount(exercise);
    const restSeconds = parseRestSeconds(
      exercise?.restSeconds
      ?? exercise?.rest_seconds
      ?? exercise?.rest,
    );

    return sum + Math.max(setCount - 1, 0) * restSeconds;
  }, 0);

  const activeSeconds = totalSetCount * 75;
  const transitionSeconds = exercises.length * 90;
  const totalMinutes = Math.round((activeSeconds + totalRestSeconds + transitionSeconds) / 60);

  return Math.max(totalMinutes, exercises.length * 6);
};

export function WorkoutCard({
  title,
  workoutType = '',
  exercises = [],
  estimatedDurationMinutes = null,
  progress,
  isRestDay = false,
}: WorkoutCardProps) {
  const normalizedTitle = String(title || '').trim().toLowerCase();
  const normalizedType = String(workoutType || '').trim().toLowerCase();
  const looksLikeRestDay =
    normalizedTitle.includes('rest')
    || normalizedTitle.includes('recovery')
    || normalizedType.includes('rest')
    || normalizedType.includes('recovery');

  const exerciseCount = exercises.length;
  const isResolvedRestDay = isRestDay || (looksLikeRestDay && exerciseCount === 0);
  const safeProgress = Math.max(0, Math.min(100, progress));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeProgress / 100) * circumference;
  const badgeSource = !isGenericWorkoutLabel(title)
    ? title
    : !isGenericWorkoutLabel(workoutType)
      ? workoutType
      : 'Workout';
  const workoutLabel = cleanWorkoutLabel(badgeSource) || 'Workout';
  const targetMuscles = collectTargetMuscles(exercises, title, workoutType);
  const durationMinutes = isResolvedRestDay ? null : estimateDurationMinutes(exercises, estimatedDurationMinutes);
  const displayTitle = !isGenericWorkoutLabel(title)
    ? String(title).trim()
    : !isGenericWorkoutLabel(workoutType)
      ? `${toTitleCase(cleanWorkoutLabel(workoutType))} Day`
      : 'Workout';
  const targetMusclesLabel = isResolvedRestDay
    ? 'Rest and recover'
    : targetMuscles.length
      ? targetMuscles.join(' - ')
      : !isGenericWorkoutLabel(workoutLabel)
        ? toTitleCase(workoutLabel)
        : 'Full body focus';

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 20,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.5,
        delay: 0.1,
      }}
      className="surface-card relative overflow-hidden rounded-2xl border border-white/12 p-5"
    >
      <div className="grid min-h-[10.75rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex min-w-0 flex-col justify-between self-stretch text-left">
          <div>
            <div className="text-sm font-medium text-text-secondary">
              {isResolvedRestDay ? 'Rest Day' : 'Today\'s Plan'}
            </div>

            <h3 className="mt-2 text-[1.9rem] font-semibold leading-tight text-text-primary">
              {displayTitle}
            </h3>

            <p className="mt-1 text-sm text-text-secondary">
              {targetMusclesLabel}
            </p>

            <div className="mt-4 space-y-1.5 text-sm font-medium text-text-secondary">
              {isResolvedRestDay ? (
                <div>Rest Day</div>
              ) : (
                <>
                  <div>{exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}</div>
                  {!!durationMinutes && (
                    <div className="flex items-center gap-1.5">
                      <Clock3 size={13} className="text-text-tertiary" />
                      <span>Estimated {durationMinutes} min</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {!isResolvedRestDay && (
            <button
              type="button"
              className="mt-5 inline-flex w-fit items-center justify-center rounded-full border border-accent/30 bg-accent/20 px-7 py-2.5 text-sm font-semibold text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_18px_rgba(0,0,0,0.18)]"
            >
              Start Workout
            </button>
          )}
        </div>

        <div className="relative h-32 w-32 shrink-0">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 132 132">
            <circle cx="66" cy="66" r={radius} stroke="rgb(var(--color-border) / 0.55)" strokeWidth="6" fill="transparent" />

            <motion.circle
              cx="66"
              cy="66"
              r={radius}
              stroke="rgb(var(--color-accent))"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={circumference}
              initial={{
                strokeDashoffset: circumference,
              }}
              animate={{
                strokeDashoffset,
              }}
              transition={{
                duration: 1.3,
                ease: 'easeOut',
              }}
              strokeLinecap="round"
              className="drop-shadow-[0_0_8px_rgba(187,255,92,0.2)]"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl text-text-primary leading-none">{safeProgress}%</span>
            <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
              {isResolvedRestDay ? 'Recovery' : 'Complete'}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
