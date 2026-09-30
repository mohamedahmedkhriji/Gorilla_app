import { normalizeTrainingProfile } from '../normalizeProfile.js';
import { assertValidTrainingProfile } from '../validateProfile.js';
import {
  DEFAULT_PROGRAM_LENGTH_WEEKS,
  PROGRAM_ENGINE_VERSION,
} from '../config/engineConfig.js';
import { getGoalStrategy } from '../strategies/index.js';
import { buildWeekTemplate } from '../scheduling/weeklyScheduler.js';
import { resolveProgramEngineSplitOverride } from '../scheduling/splitSelector.js';
import { buildSessionSlots } from '../slots/sessionTemplates.js';
import { assertValidProgramBlueprint } from './validateBlueprint.js';

export class ProgramBlueprintGenerationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ProgramBlueprintGenerationError';
    this.details = details;
  }
}

const normalizeRecoveryForBlueprint = (value) => {
  if (value === 'conservative') return 'recovery';
  if (value === 'push_progression') return 'performance';
  return value || 'balanced';
};

const normalizeTrainingFocusForBlueprint = (value) => {
  if (value === 'muscle_growth') return 'hypertrophy';
  return value || 'balanced';
};

export const buildProgramBlueprint = (profileOrInput = {}, options = {}) => {
  const profile = profileOrInput.engineTarget
    ? profileOrInput
    : normalizeTrainingProfile(profileOrInput);

  if (profile.bypassReason) {
    throw new ProgramBlueprintGenerationError('Bypassed profiles cannot enter the Program Blueprint generator.', {
      bypassReason: profile.bypassReason,
    });
  }

  assertValidTrainingProfile(profile);

  const strategy = getGoalStrategy(profile.goal);
  if (!strategy) {
    throw new ProgramBlueprintGenerationError(`No blueprint strategy for goal: ${profile.goal}`);
  }

  const programLengthWeeks = Number(options.programLengthWeeks || DEFAULT_PROGRAM_LENGTH_WEEKS);
  const daysPerWeek = Number(profile.daysPerWeek);
  const sessionDurationMinutes = Number(profile.sessionDurationMinutes);
  const trainingFocus = normalizeTrainingFocusForBlueprint(profile.trainingFocus);
  const recoveryStrategy = normalizeRecoveryForBlueprint(profile.recoveryStrategy);
  const decision = strategy({
    ...profile,
    daysPerWeek,
    sessionDurationMinutes,
    trainingFocus,
    recoveryStrategy,
  });

  if (!decision?.split) {
    throw new ProgramBlueprintGenerationError('No split rule matched the normalized profile.', {
      goal: profile.goal,
      experience: profile.experience,
      daysPerWeek,
      sessionDurationMinutes,
    });
  }

  const splitOverride = resolveProgramEngineSplitOverride({
    splitPreference: options.splitOverride ?? options.splitPreference,
    profile: { ...profile, daysPerWeek, goal: profile.goal },
    recommendedSplit: decision.split,
  });

  if (splitOverride.error) {
    throw new ProgramBlueprintGenerationError(splitOverride.error.message, {
      code: splitOverride.error.code,
      splitPreference: splitOverride.requestedSplitPreference,
      recommendedSplit: decision.split.id,
      goal: profile.goal,
      daysPerWeek,
    });
  }

  const selectedSplit = splitOverride.split || decision.split;

  const weekTemplate = buildWeekTemplate({
    daysPerWeek,
    sessionSequence: selectedSplit.sessionSequence,
    targetDurationMinutes: sessionDurationMinutes,
    buildSlots: (sessionType, sessionIndex) => buildSessionSlots({
      sessionType,
      sessionIndex,
      sessionDurationMinutes,
      experience: profile.experience,
      recoveryStrategy,
      trainingFocus,
    }),
  });

  const blueprint = {
    engineVersion: PROGRAM_ENGINE_VERSION,
    profile: {
      identity: profile.identity,
      goal: profile.goal,
      experience: profile.experience,
    },
    programLengthWeeks,
    daysPerWeek,
    sessionDurationMinutes,
    split: {
      id: selectedSplit.id,
      name: selectedSplit.name,
    },
    modifiers: {
      trainingFocus,
      recoveryStrategy,
    },
    weekTemplate,
    metadata: {
      strategyId: decision.strategyId,
      workloadBias: decision.workloadBias,
      cycleContextPresent: Boolean(profile.cycleContext),
      motivationPresent: Boolean(profile.motivation),
      bodyTypePresent: Boolean(profile.bodyType),
      datasetRequired: false,
      recommendedSplitId: decision.split.id,
      splitOverrideApplied: Boolean(splitOverride.applied),
      requestedSplitPreference: splitOverride.requestedSplitPreference || 'auto',
    },
  };

  assertValidProgramBlueprint(blueprint);
  return blueprint;
};
