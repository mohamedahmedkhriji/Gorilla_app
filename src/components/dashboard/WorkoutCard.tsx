import React from 'react';
import { motion } from 'framer-motion';
import { Clock3 } from 'lucide-react';
import { emojiGymWallpaper, emojiRestDayBg } from '../../services/emojiTheme';
import { AppLanguage, getActiveLanguage, getStoredLanguage, pickLanguage, repairMojibakeText } from '../../services/language';

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
  exerciseCount?: number;
  estimatedDurationMinutes?: number | null;
  progress: number;
  isRestDay?: boolean;
  coachmarkTargetId?: string;
  coachmarkGradientTargetId?: string;
  eyebrowLabel?: string;
  subtitleOverride?: string | null;
  detailLines?: string[];
  actionLabel?: string | null;
  progressCaption?: string;
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

const inferWorkoutLabelFromTargetMuscles = (muscles: string[]) => {
  const normalized = muscles.map((entry) => toTitleCase(entry));
  const hasPush = normalized.some((muscle) => ['Chest', 'Shoulders', 'Triceps'].includes(muscle));
  const hasPull = normalized.some((muscle) => ['Back', 'Biceps', 'Forearms', 'Rear Delts'].includes(muscle));
  const hasLegs = normalized.some((muscle) => ['Quadriceps', 'Hamstrings', 'Calves', 'Glutes', 'Legs'].includes(muscle));

  if (hasPush && !hasPull && !hasLegs) return 'Push Day';
  if (hasPull && !hasPush && !hasLegs) return 'Pull Day';
  if (hasLegs && !hasPush && !hasPull) return 'Leg Day';
  if (hasPush && hasPull && !hasLegs) return 'Upper Body';
  if (hasPush && hasPull && hasLegs) return 'Full Body';
  return '';
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

const AR_MUSCLE_LABELS: Record<string, string> = {
  chest: 'الصدر',
  back: 'الظهر',
  shoulders: 'الأكتاف',
  triceps: 'الترايسبس',
  biceps: 'البايسبس',
  forearms: 'الساعد',
  quadriceps: 'الرباعية',
  hamstrings: 'الخلفية',
  calves: 'السمانة',
  glutes: 'الألوية',
  legs: 'الأرجل',
  abs: 'البطن',
  core: 'الجذع',
  'rear delts': 'الدالية الخلفية',
  'side delts': 'الدالية الجانبية',
  'front delts': 'الدالية الأمامية',
  'upper back': 'أعلى الظهر',
  'lower back': 'أسفل الظهر',
  lats: 'اللاتس',
  mobility: 'الحركة',
  walking: 'المشي',
  sleep: 'النوم',
  'full body': 'كامل الجسم',
};

const IT_MUSCLE_LABELS: Record<string, string> = {
  chest: 'Petto',
  back: 'Schiena',
  shoulders: 'Spalle',
  triceps: 'Tricipiti',
  biceps: 'Bicipiti',
  forearms: 'Avambracci',
  quadriceps: 'Quadricipiti',
  hamstrings: 'Femorali',
  calves: 'Polpacci',
  glutes: 'Glutei',
  legs: 'Gambe',
  abs: 'Addome',
  core: 'Core',
  'rear delts': 'Deltoidi posteriori',
  'side delts': 'Deltoidi laterali',
  'front delts': 'Deltoidi anteriori',
  'upper back': 'Schiena alta',
  'lower back': 'Schiena bassa',
  lats: 'Dorsali',
  mobility: 'Mobilita',
  walking: 'Camminata',
  sleep: 'Sonno',
  'full body': 'Corpo completo',
};

const DE_MUSCLE_LABELS: Record<string, string> = {
  chest: 'Brust',
  back: 'Rucken',
  shoulders: 'Schultern',
  triceps: 'Trizeps',
  biceps: 'Bizeps',
  forearms: 'Unterarme',
  quadriceps: 'Quadrizeps',
  hamstrings: 'Beinbeuger',
  calves: 'Waden',
  glutes: 'Gesass',
  legs: 'Beine',
  abs: 'Bauch',
  core: 'Rumpf',
  'rear delts': 'Hintere Schultern',
  'side delts': 'Seitliche Schultern',
  'front delts': 'Vordere Schultern',
  'upper back': 'Oberer Rucken',
  'lower back': 'Unterer Rucken',
  lats: 'Latissimus',
  mobility: 'Mobilitat',
  walking: 'Gehen',
  sleep: 'Schlaf',
  'full body': 'Ganzkorper',
};

const localizeWorkoutTitle = (value: string, language: AppLanguage) => {
  if (language === 'en') return value;
  let next = String(value || '').trim();
  if (!next) return next;

  next = next.replace(/^(?:week\s*\d+\s*-\s*){2,}/i, (match) => {
    const single = match.match(/week\s*\d+\s*-\s*/i)?.[0];
    return single || match;
  });

  if (language === 'ar') {
    next = next.replace(/week\s*(\d+)/gi, 'الأسبوع $1');
    next = next.replace(/\brest day\b/gi, 'يوم راحة');
    next = next.replace(/\bcustom workout\b/gi, 'تمرين مخصص');
    next = next.replace(/\bworkout\b/gi, 'تمرين');
    next = next.replace(/\bpush day\b/gi, 'يوم الدفع');
    next = next.replace(/\bpull day\b/gi, 'يوم السحب');
    next = next.replace(/\bleg day\b/gi, 'يوم الأرجل');
    next = next.replace(/\bupper body\b/gi, 'الجزء العلوي');
    next = next.replace(/\blower body\b/gi, 'الجزء السفلي');
    next = next.replace(/\bfull body\b/gi, 'كامل الجسم');
    next = next.replace(/\bpush\b/gi, 'دفع');
    next = next.replace(/\bpull\b/gi, 'سحب');
    next = next.replace(/\blegs?\b/gi, 'أرجل');
    next = next.replace(/^(?:الأسبوع\s*\d+\s*-\s*){2,}/, (match) => {
      const single = match.match(/الأسبوع\s*\d+\s*-\s*/)?.[0];
      return single || match;
    });
    return repairMojibakeText(next);
  }

  if (language === 'de') {
    next = next.replace(/week\s*(\d+)/gi, 'Woche $1');
    next = next.replace(/\brest day\b/gi, 'Ruhetag');
    next = next.replace(/\bcustom workout\b/gi, 'Benutzerdefiniertes Workout');
    next = next.replace(/\bworkout\b/gi, 'Workout');
    next = next.replace(/\bpush day\b/gi, 'Push-Tag');
    next = next.replace(/\bpull day\b/gi, 'Pull-Tag');
    next = next.replace(/\bleg day\b/gi, 'Beintag');
    next = next.replace(/\bupper body\b/gi, 'Oberkorper');
    next = next.replace(/\blower body\b/gi, 'Unterkorper');
    next = next.replace(/\bfull body\b/gi, 'Ganzkorper');
    next = next.replace(/\bpush\b/gi, 'Push');
    next = next.replace(/\bpull\b/gi, 'Pull');
    next = next.replace(/\blegs?\b/gi, 'Beine');
    return repairMojibakeText(next);
  }

  next = next.replace(/week\s*(\d+)/gi, 'Settimana $1');
  next = next.replace(/\brest day\b/gi, 'Giorno di riposo');
  next = next.replace(/\bcustom workout\b/gi, 'Allenamento personalizzato');
  next = next.replace(/\bworkout\b/gi, 'Allenamento');
  next = next.replace(/\bpush day\b/gi, 'Giorno push');
  next = next.replace(/\bpull day\b/gi, 'Giorno pull');
  next = next.replace(/\bleg day\b/gi, 'Giorno gambe');
  next = next.replace(/\bupper body\b/gi, 'Parte superiore');
  next = next.replace(/\blower body\b/gi, 'Parte inferiore');
  next = next.replace(/\bfull body\b/gi, 'Corpo completo');
  next = next.replace(/\bpush\b/gi, 'Push');
  next = next.replace(/\bpull\b/gi, 'Pull');
  next = next.replace(/\blegs?\b/gi, 'Gambe');
  return repairMojibakeText(next);
};

export function WorkoutCard({
  title,
  workoutType = '',
  exercises = [],
  exerciseCount,
  estimatedDurationMinutes = null,
  progress,
  isRestDay = false,
  coachmarkTargetId,
  coachmarkGradientTargetId,
  eyebrowLabel,
  subtitleOverride,
  detailLines,
  actionLabel,
  progressCaption,
}: WorkoutCardProps) {
  const language = getActiveLanguage(getStoredLanguage());
  const copy = pickLanguage(language, {
    en: {
      todayPlan: 'Today\'s Plan',
      restDay: 'Rest Day',
      restAndRecover: 'Rest and recover',
      fullBodyFocus: 'Full body focus',
      exercisesLabel: (count: number) => `${count} ${count === 1 ? 'exercise' : 'exercises'}`,
      estimated: (minutes: number) => `Estimated ${minutes} min`,
      startWorkout: 'Start Workout',
      complete: 'Complete',
      recovery: 'Recovery',
    },
    ar: {
      todayPlan: 'خطة اليوم',
      restDay: 'يوم راحة',
      restAndRecover: 'راحة وتعافٍ',
      fullBodyFocus: 'تركيز كامل للجسم',
      exercisesLabel: (count: number) => `${count} ${count === 1 ? 'تمرين' : 'تمارين'}`,
      estimated: (minutes: number) => `المدة المتوقعة ${minutes} دقيقة`,
      startWorkout: 'ابدأ التمرين',
      complete: 'مكتمل',
      recovery: 'التعافي',
    },
    it: {
      todayPlan: 'Piano di oggi',
      restDay: 'Giorno di riposo',
      restAndRecover: 'Riposa e recupera',
      fullBodyFocus: 'Focus corpo completo',
      exercisesLabel: (count: number) => `${count} ${count === 1 ? 'esercizio' : 'esercizi'}`,
      estimated: (minutes: number) => `Durata stimata ${minutes} min`,
      startWorkout: 'Avvia allenamento',
      complete: 'Completato',
      recovery: 'Recupero',
    },
    de: {
      todayPlan: 'Plan fur heute',
      restDay: 'Ruhetag',
      restAndRecover: 'Ruhe dich aus und erhole dich',
      fullBodyFocus: 'Ganzkorper-Fokus',
      exercisesLabel: (count: number) => `${count} ${count === 1 ? 'Ubung' : 'Ubungen'}`,
      estimated: (minutes: number) => `Geschatzte Dauer ${minutes} Min`,
      startWorkout: 'Workout starten',
      complete: 'Abgeschlossen',
      recovery: 'Erholung',
    },
  });
  const normalizedTitle = String(title || '').trim().toLowerCase();
  const normalizedType = String(workoutType || '').trim().toLowerCase();
  const looksLikeRestDay =
    normalizedTitle.includes('rest')
    || normalizedTitle.includes('recovery')
    || normalizedType.includes('rest')
    || normalizedType.includes('recovery');

  const resolvedExerciseCount = Number.isFinite(Number(exerciseCount))
    ? Math.max(0, Math.round(Number(exerciseCount)))
    : exercises.length;
  const isResolvedRestDay = isRestDay || (looksLikeRestDay && resolvedExerciseCount === 0);
  const safeProgress = Math.max(0, Math.min(100, progress));
  const displayedProgress = isResolvedRestDay ? 100 : safeProgress;
  const progressLabelSize = displayedProgress >= 100 ? '1.8rem' : undefined;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayedProgress / 100) * circumference;
  const badgeSource = !isGenericWorkoutLabel(title)
    ? title
    : !isGenericWorkoutLabel(workoutType)
      ? workoutType
      : 'Workout';
  const workoutLabel = cleanWorkoutLabel(badgeSource) || 'Workout';
  const targetMuscles = collectTargetMuscles(exercises, title, workoutType);
  const inferredWorkoutLabel = inferWorkoutLabelFromTargetMuscles(targetMuscles);
  const durationMinutes = isResolvedRestDay ? null : estimateDurationMinutes(exercises, estimatedDurationMinutes);
  const displayTitle = isResolvedRestDay
    ? copy.restDay
    : !isGenericWorkoutLabel(title)
      ? String(title).trim()
      : !isGenericWorkoutLabel(workoutType)
        ? `${toTitleCase(cleanWorkoutLabel(workoutType))} Day`
        : inferredWorkoutLabel || 'Workout';
  const targetMusclesLabel = isResolvedRestDay
    ? copy.restAndRecover
    : targetMuscles.length
      ? targetMuscles
        .map((entry) => {
          const key = String(entry || '').trim().toLowerCase();
          if (language === 'ar') return repairMojibakeText(AR_MUSCLE_LABELS[key] || entry);
          if (language === 'it') return IT_MUSCLE_LABELS[key] || entry;
          if (language === 'de') return DE_MUSCLE_LABELS[key] || entry;
          return entry;
        })
        .join(' - ')
      : !isGenericWorkoutLabel(workoutLabel)
        ? localizeWorkoutTitle(toTitleCase(workoutLabel), language)
        : copy.fullBodyFocus;
  const displayTitleText = localizeWorkoutTitle(displayTitle, language);
  const cardBackgroundImage = isResolvedRestDay ? emojiRestDayBg : emojiGymWallpaper;
  const resolvedEyebrowLabel = eyebrowLabel || (isResolvedRestDay ? copy.restDay : copy.todayPlan);
  const resolvedSubtitle = subtitleOverride === null
    ? null
    : (subtitleOverride || targetMusclesLabel);
  const resolvedDetailLines = Array.isArray(detailLines) && detailLines.length
    ? detailLines.filter((line) => String(line || '').trim())
    : null;
  const resolvedActionLabel = typeof actionLabel === 'string'
    ? actionLabel
    : (isResolvedRestDay ? '' : copy.startWorkout);
  const resolvedProgressCaption = progressCaption || (isResolvedRestDay ? copy.recovery : copy.complete);

  return (
    <motion.div
      data-coachmark-target={coachmarkTargetId}
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
      <div
        className="absolute inset-0 bg-cover bg-center opacity-60"
        style={{ backgroundImage: `url(${cardBackgroundImage})` }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-background/65 via-background/45 to-background/25"
        data-coachmark-target={coachmarkGradientTargetId}
        aria-hidden="true"
      />

      <div className="relative z-10 grid min-h-[10.75rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex min-w-0 flex-col justify-between self-stretch text-left">
          <div>
            <div className="text-sm font-medium text-text-secondary">
              {resolvedEyebrowLabel}
            </div>

            <h3 className="mt-2 text-[1.9rem] font-electrolize font-bold leading-tight text-text-primary">
              {displayTitleText}
            </h3>

            {resolvedSubtitle && (
              <p className="mt-1 text-sm text-text-secondary">
                {resolvedSubtitle}
              </p>
            )}

            <div className="mt-4 space-y-1.5 text-sm font-medium text-text-secondary">
              {resolvedDetailLines ? (
                resolvedDetailLines.map((line) => (
                  <div key={line}>{line}</div>
                ))
              ) : isResolvedRestDay ? (
                <div>{copy.restDay}</div>
              ) : (
                <>
                  <div>{copy.exercisesLabel(resolvedExerciseCount)}</div>
                  {!!durationMinutes && (
                    <div className="flex items-center gap-1.5">
                      <Clock3 size={13} className="text-text-tertiary" />
                      <span>{copy.estimated(durationMinutes)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {!isResolvedRestDay && resolvedActionLabel && (
            <button
              type="button"
              className="mt-5 inline-flex w-fit items-center justify-center whitespace-nowrap rounded-full border border-accent/30 bg-accent/20 px-7 py-2.5 text-sm font-marker text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_18px_rgba(0,0,0,0.18)]"
            >
              {resolvedActionLabel}
            </button>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center">
          <div className="relative h-36 w-36">
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

            <div className="absolute inset-0 grid place-items-center px-3 text-center">
              <span
                className="max-w-full px-2 text-4xl text-text-primary leading-none font-electrolize"
                style={{ fontSize: progressLabelSize }}
              >
                {displayedProgress}%
              </span>
            </div>
          </div>

          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
            {resolvedProgressCaption}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
