import crypto from 'node:crypto';

import { buildProgramBlueprint } from '../blueprint/buildBlueprint.js';
import { PROGRAM_ENGINE_VERSION } from '../config/engineConfig.js';
import { normalizeTrainingProfile } from '../normalizeProfile.js';
import { loadSupabaseProgramEngineCatalog } from '../catalog/catalogProvider.js';
import {
  assertNoPowerliftingCompetitionConflict,
  parseGenerationConstraints,
} from '../resolver/constraints.js';
import { resolveBlueprintExercises } from '../resolver/exerciseResolver.js';
import {
  prescribeCardioSlot,
  prescribeResistanceSlot,
} from '../prescription/prescriptionRules.js';
import { buildProgressionPolicy } from '../progression/progressionPolicy.js';
import {
  estimateDayDurationMinutes,
  reduceToDuration,
} from './durationModel.js';
import { assertValidCompleteGeneratedProgram } from './validateCompleteProgram.js';
import { calculateProgramVolumeSummary } from './volumeSummary.js';

const isCardioSlot = (slot) => ['conditioning', 'recovery'].includes(slot.role);

const generationKeyFor = (payload) => crypto
  .createHash('sha256')
  .update(JSON.stringify(payload))
  .digest('hex')
  .slice(0, 24);

const requiredPatternsForGoal = (goal) => (goal === 'powerlifting'
  ? ['squat_pattern', 'bench', 'deadlift']
  : []);

const buildDay = ({
  blueprintDay,
  resolvedBySlotId,
  blueprint,
  weekNumber,
}) => {
  if (blueprintDay.type === 'rest') {
    return { dayOfWeek: blueprintDay.dayOfWeek, type: 'rest' };
  }

  let exercises = [];
  let cardioPrescription = null;

  blueprintDay.slots.forEach((slot) => {
    if (isCardioSlot(slot)) {
      const cardio = prescribeCardioSlot({
        movementPattern: slot.movementPattern,
        goal: blueprint.profile.goal,
        sessionDurationMinutes: blueprint.sessionDurationMinutes,
        weekNumber,
      });
      cardioPrescription = cardioPrescription ?? cardio;
      return;
    }

    const exercise = resolvedBySlotId.get(slot.slotId);
    if (!exercise) return;
    exercises.push({
      stableId: `${slot.slotId}:${exercise.exerciseId}`,
      slot,
      exercise,
      prescription: prescribeResistanceSlot({
        goal: blueprint.profile.goal,
        experience: blueprint.profile.experience,
        recoveryStrategy: blueprint.modifiers.recoveryStrategy,
        slot,
        weekNumber,
      }),
    });
  });

  exercises = reduceToDuration({
    exercises,
    targetDurationMinutes: blueprint.sessionDurationMinutes,
    requiredMovementPatterns: requiredPatternsForGoal(blueprint.profile.goal),
  });

  const day = {
    dayOfWeek: blueprintDay.dayOfWeek,
    type: 'training',
    sessionType: blueprintDay.sessionType,
    dayPurpose: blueprintDay.dayPurpose,
    targetDurationMinutes: blueprint.sessionDurationMinutes,
    estimatedDurationMinutes: 0,
    exercises,
    cardioPrescription,
  };
  day.estimatedDurationMinutes = estimateDayDurationMinutes(day);
  return day;
};

export const buildCompleteGeneratedProgram = async (
  profileOrInput,
  {
    catalogProvider = loadSupabaseProgramEngineCatalog,
    catalog = null,
    programLengthWeeks = 8,
    splitOverride = null,
    splitPreference = null,
  } = {},
) => {
  const normalizedProfile = profileOrInput.engineTarget
    ? profileOrInput
    : normalizeTrainingProfile(profileOrInput);
  const blueprint = buildProgramBlueprint(profileOrInput, {
    programLengthWeeks,
    splitOverride: splitOverride ?? splitPreference,
  });
  const constraints = parseGenerationConstraints({
    equipmentNotes: normalizedProfile.equipmentNotes,
    injuriesOrMovementsToAvoid: normalizedProfile.injuriesOrMovementsToAvoid,
  });

  assertNoPowerliftingCompetitionConflict(blueprint.profile.goal, constraints);

  const loadedCatalog = catalog ?? await catalogProvider({
    gender: normalizedProfile.gender,
  });

  const resolvedBySlotId = resolveBlueprintExercises({
    blueprint,
    catalog: loadedCatalog,
    constraints,
  });

  const progressionPolicy = buildProgressionPolicy(blueprint.profile.goal);
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const weekNumber = index + 1;
    const phase = progressionPolicy.weeks[weekNumber];
    return {
      weekNumber,
      phase,
      days: blueprint.weekTemplate.map((day) => buildDay({
        blueprintDay: day,
        resolvedBySlotId,
        blueprint,
        weekNumber,
      })),
    };
  });

  const generationPayload = {
    engineVersion: PROGRAM_ENGINE_VERSION,
    profile: blueprint.profile,
    daysPerWeek: blueprint.daysPerWeek,
    sessionDurationMinutes: blueprint.sessionDurationMinutes,
    split: blueprint.split.id,
    modifiers: blueprint.modifiers,
    constraints: constraints.rawFlags,
  };

  const program = {
    engineVersion: PROGRAM_ENGINE_VERSION,
    generationKey: generationKeyFor(generationPayload),
    goal: blueprint.profile.goal,
    experience: blueprint.profile.experience,
    programLengthWeeks: 8,
    daysPerWeek: blueprint.daysPerWeek,
    split: blueprint.split,
    sessionDurationMinutes: blueprint.sessionDurationMinutes,
    weeks,
    progressionPolicy,
    volumeSummary: calculateProgramVolumeSummary(weeks),
    generationMetadata: {
      source: 'program_engine_phase4',
      blueprintEngineVersion: blueprint.engineVersion,
      datasetRequired: false,
      resolvedExerciseCount: resolvedBySlotId.size,
      catalogExerciseCount: Array.isArray(loadedCatalog) ? loadedCatalog.length : null,
      cycleContextPresent: blueprint.metadata.cycleContextPresent,
      constraints: constraints.rawFlags,
      recommendedSplitId: blueprint.metadata.recommendedSplitId,
      splitOverrideApplied: blueprint.metadata.splitOverrideApplied,
      requestedSplitPreference: blueprint.metadata.requestedSplitPreference,
    },
  };

  assertValidCompleteGeneratedProgram(program);
  return program;
};
