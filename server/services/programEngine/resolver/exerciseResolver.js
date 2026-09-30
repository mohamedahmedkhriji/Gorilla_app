import { MOVEMENT_MAPPING } from './movementMapping.js';

const normalize = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const equipmentKey = (value) => normalize(value);

const muscleAliases = Object.freeze({
  chest: ['chest', 'pec', 'upper chest', 'mid chest', 'lower chest'],
  back: ['back', 'lats', 'lat', 'upper back', 'traps', 'rhomboids'],
  upper_back: ['upper back', 'traps', 'rhomboids', 'back'],
  shoulders: ['shoulders', 'delts', 'front delts', 'side delts', 'rear delts'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  quadriceps: ['quadriceps', 'quads', 'thigh'],
  hamstrings: ['hamstrings'],
  glutes: ['glutes'],
  calves: ['calves', 'calf'],
  core: ['abs', 'core', 'obliques'],
  full_body: ['full body'],
});

const getExerciseMuscleKeys = (exercise) => {
  const values = [
    exercise.primaryMuscle,
    exercise.muscle,
    exercise.bodyPart,
    exercise.type,
    ...(Array.isArray(exercise.muscles) ? exercise.muscles.flatMap((m) => [m.name, m.muscleGroup]) : []),
    ...(Array.isArray(exercise.categories) ? exercise.categories.map((category) => category.name) : []),
  ];
  return values.map(normalize).filter(Boolean);
};

const matchesMuscle = (exercise, targetMuscle) => {
  const aliases = muscleAliases[targetMuscle] ?? [targetMuscle];
  const keys = getExerciseMuscleKeys(exercise);
  return aliases.some((alias) => keys.some((key) => key.includes(normalize(alias))));
};

const includesAny = (text, patterns = []) => patterns.some((pattern) => text.includes(normalize(pattern)));

const excludesEquipment = (exercise, constraints) => {
  const key = equipmentKey(exercise.equipment);
  if (!key) return false;
  return constraints.excludedEquipment.some((excluded) => key.includes(excluded));
};

const missesRequiredEquipment = (exercise, constraints) => {
  if (!constraints.requiredEquipment.length) return false;
  const key = equipmentKey(exercise.equipment);
  const name = normalize(exercise.name);
  return !constraints.requiredEquipment.some((required) => key.includes(required) || name.includes(required));
};

const isAvoided = (exercise, slot, constraints) => {
  if (constraints.excludedMovementPatterns.includes(slot.movementPattern)) return true;
  const name = normalize(exercise.name);
  if (constraints.excludedMovementPatterns.includes('vertical_press') && /(overhead|shoulder|military|arnold).*press/.test(name)) return true;
  if (constraints.excludedMovementPatterns.includes('deadlift') && name.includes('deadlift')) return true;
  if (constraints.excludedMovementPatterns.includes('squat_pattern') && name.includes('squat')) return true;
  if (constraints.excludedMovementPatterns.includes('bench') && name.includes('bench')) return true;
  return false;
};

const scoreExercise = (exercise, slot, rule, usedExerciseIds) => {
  const name = normalize(exercise.name);
  let score = 0;

  if (usedExerciseIds.has(Number(exercise.id))) score -= 100;
  if (rule.primaryMuscles?.some((muscle) => matchesMuscle(exercise, muscle))) score += 40;
  if (matchesMuscle(exercise, slot.primaryMuscleGroup)) score += 20;
  if (includesAny(name, rule.include)) score += 35;
  if (includesAny(name, rule.exclude)) score -= 60;
  if (rule.competitionInclude && includesAny(name, rule.competitionInclude)) score += 80;
  if (slot.role === 'isolation' && normalize(exercise.mechanics).includes('isolation')) score += 8;
  if (['primary_compound', 'secondary_compound'].includes(slot.role) && normalize(exercise.mechanics).includes('compound')) score += 8;
  if (Number.isFinite(Number(exercise.difficultyLevel))) score += Math.max(0, 5 - Number(exercise.difficultyLevel));

  return score;
};

const publicExercise = (exercise, resolutionReason) => ({
  exerciseId: Number(exercise.id),
  slug: exercise.slug || null,
  name: exercise.name,
  primaryMuscle: exercise.muscle || exercise.bodyPart || exercise.muscles?.[0]?.name || null,
  equipment: exercise.equipment || null,
  difficultyLevel: exercise.difficultyLevel ?? exercise.difficulty ?? null,
  mechanics: exercise.mechanics || null,
  forceType: exercise.forceType || null,
  mediaReference: exercise.primaryMedia || null,
  resolutionReason,
});

export class ExerciseResolutionError extends Error {
  constructor({ code, slot, sessionType, candidatesChecked = 0 }) {
    super(`${code}: ${slot?.movementPattern || 'unknown'} could not be resolved`);
    this.name = 'ExerciseResolutionError';
    this.code = code;
    this.slot = slot;
    this.sessionType = sessionType;
    this.candidatesChecked = candidatesChecked;
  }
}

export const resolveExerciseForSlot = ({
  slot,
  sessionType,
  catalog,
  constraints,
  usedExerciseIds = new Set(),
}) => {
  const rule = MOVEMENT_MAPPING[slot.movementPattern];
  if (!rule) {
    throw new ExerciseResolutionError({
      code: 'SLOT_MAPPING_MISSING',
      slot,
      sessionType,
      candidatesChecked: 0,
    });
  }

  const candidates = (Array.isArray(catalog) ? catalog : [])
    .filter((exercise) => Number(exercise?.id) > 0 && exercise.name)
    .filter((exercise) => !excludesEquipment(exercise, constraints))
    .filter((exercise) => !missesRequiredEquipment(exercise, constraints))
    .filter((exercise) => !isAvoided(exercise, slot, constraints))
    .map((exercise) => ({
      exercise,
      score: scoreExercise(exercise, slot, rule, usedExerciseIds),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => (
      right.score - left.score
      || Number(left.exercise.id) - Number(right.exercise.id)
      || String(left.exercise.slug || left.exercise.name).localeCompare(String(right.exercise.slug || right.exercise.name))
    ));

  const best = candidates[0];
  const isCompetition = ['bench', 'deadlift'].includes(slot.movementPattern)
    || (slot.movementPattern === 'squat_pattern' && sessionType?.startsWith('pl_'));

  if (!best || (isCompetition && best.score < 100)) {
    if (slot.required || isCompetition) {
      throw new ExerciseResolutionError({
        code: isCompetition ? 'REQUIRED_COMPETITION_EXERCISE_UNRESOLVED' : 'REQUIRED_EXERCISE_UNRESOLVED',
        slot,
        sessionType,
        candidatesChecked: candidates.length,
      });
    }
    return null;
  }

  return publicExercise(best.exercise, `matched ${slot.movementPattern} by deterministic catalog scoring`);
};

export const resolveBlueprintExercises = ({ blueprint, catalog, constraints }) => {
  const resolvedBySlotId = new Map();

  blueprint.weekTemplate
    .filter((day) => day.type === 'training')
    .forEach((day) => {
      const usedExerciseIds = new Set();
      day.slots.forEach((slot) => {
        if (slot.role === 'conditioning' || slot.role === 'recovery') return;
        const resolved = resolveExerciseForSlot({
          slot,
          sessionType: day.sessionType,
          catalog,
          constraints,
          usedExerciseIds,
        });
        if (!resolved) return;
        usedExerciseIds.add(resolved.exerciseId);
        resolvedBySlotId.set(slot.slotId, resolved);
      });
    });

  return resolvedBySlotId;
};
