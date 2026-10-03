import {
  normalizeTrainingProfile,
  validateTrainingProfile,
} from '../index.js';
import { generateBrainDrivenProgram } from '../brainDriven/generateBrainDrivenProgram.js';
import { validateBrainDrivenProgram } from '../brainDriven/validateBrainDrivenProgram.js';
import { validateCompleteGeneratedProgram } from '../program/validateCompleteProgram.js';
import { persistCompleteGeneratedProgram } from './persistenceAdapter.js';

export class ProgramEngineOrchestrationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ProgramEngineOrchestrationError';
    this.code = details.code || 'PROGRAM_ENGINE_ORCHESTRATION_ERROR';
    this.details = details;
    this.statusCode = details.statusCode || 400;
  }
}

const normalizeSplitPreference = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s-]+/g, '_');

const isCustomSplit = (value) => normalizeSplitPreference(value) === 'custom';

const validateFinalBrainProgramForPersistence = ({ brainResult }) => {
  const completeValidation = validateCompleteGeneratedProgram(brainResult?.generatedProgram);
  const brainValidation = validateBrainDrivenProgram({
    program: brainResult?.generatedProgram,
    trainingStrategy: brainResult?.trainingStrategy,
    engineInput: brainResult?.engineInput,
  });

  if (!completeValidation.valid || !brainValidation.valid) {
    throw new ProgramEngineOrchestrationError('Brain-driven program failed final validation gate.', {
      code: 'BRAIN_PROGRAM_FINAL_VALIDATION_FAILED',
      statusCode: 422,
      completeProgramErrors: completeValidation.errors,
      brainProgramErrors: brainValidation.errors,
    });
  }

  return {
    completeValidation,
    brainValidation,
  };
};

export const buildProgramEngineOnboardingInput = ({
  age = null,
  gender = null,
  height = null,
  weight = null,
  bodyType = null,
  onboardingReason = null,
  athleteIdentity = null,
  athleteSubCategoryId = null,
  athleteSubCategoryIds = [],
  athleteSubCategoryLabel = null,
  athleteGoal = null,
  fitnessGoal = null,
  primaryGoal = null,
  experienceLevel = null,
  workoutDays = null,
  sessionDuration = null,
  preferredTime = null,
  aiTrainingFocus = null,
  aiLimitations = null,
  aiRecoveryPriority = null,
  aiEquipmentNotes = null,
} = {}) => ({
  age,
  gender,
  height,
  weight,
  bodyType,
  onboardingReason,
  athleteIdentity,
  athleteSubCategoryId,
  athleteSubCategoryIds,
  athleteSubCategoryLabel,
  athleteGoal,
  fitnessGoal,
  primaryGoal,
  experienceLevel,
  workoutDays,
  sessionDuration,
  preferredTime,
  aiTrainingFocus,
  aiLimitations,
  aiRecoveryPriority,
  aiEquipmentNotes,
});

export const routeProgramEngineRequest = ({ onboardingInput = {}, splitPreference = 'auto' } = {}) => {
  const profile = normalizeTrainingProfile(onboardingInput);
  const validation = validateTrainingProfile(profile);

  if (profile.bypassReason === 'hyrox') {
    return { route: 'legacy_hyrox', profile, validation };
  }
  if (profile.bypassReason === 'boxing') {
    return { route: 'legacy_boxing', profile, validation };
  }
  if (isCustomSplit(splitPreference)) {
    return { route: 'manual_custom', profile, validation };
  }
  if (!validation.valid) {
    return { route: 'legacy_unsupported', profile, validation };
  }

  return { route: 'program_engine_v1', profile, validation };
};

export const generateAndPersistProgramEnginePlan = async (
  conn,
  {
    userId,
    gymId = null,
    onboardingInput,
    splitPreference = 'auto',
    catalogProvider,
    assignmentReason = 'user_request',
    assignmentNote = null,
    assignmentSource = 'ai',
    actorUserId = userId,
  },
) => {
  const route = routeProgramEngineRequest({ onboardingInput, splitPreference });
  if (route.route !== 'program_engine_v1') {
    return { route: route.route, profile: route.profile, validation: route.validation };
  }

  let brainResult = null;
  let program;
  try {
    brainResult = await generateBrainDrivenProgram(onboardingInput, {
      catalogProvider,
    });
    validateFinalBrainProgramForPersistence({ brainResult });
    program = brainResult.generatedProgram;
  } catch (error) {
    const code = error?.details?.code || error?.code || error?.name || 'PROGRAM_ENGINE_GENERATION_FAILED';
    throw new ProgramEngineOrchestrationError(error?.message || 'Program Engine generation failed.', {
      code,
      statusCode: code === 'INCOMPATIBLE_SPLIT_OVERRIDE' ? 409 : 422,
      originalErrorName: error?.name,
      errors: error?.errors || null,
      details: error?.details || null,
    });
  }

  const persisted = await persistCompleteGeneratedProgram(conn, {
    userId,
    gymId,
    program,
    assignmentReason,
    assignmentNote: assignmentNote || `Training Brain onboarding plan: goal=${program.goal}, available=${program.generationMetadata?.availableDaysPerWeek ?? program.daysPerWeek}, prescribed=${program.daysPerWeek}, split=${program.split?.id || 'unknown'}`,
    assignmentSource,
    actorUserId,
  });

  return {
    route: 'program_engine_v1',
    profile: route.profile,
    validation: route.validation,
    trainingStrategy: brainResult.trainingStrategy,
    referenceEvidence: brainResult.referenceEvidence,
    engineInput: brainResult.engineInput,
    finalValidation: brainResult.validation,
    completeProgram: program,
    ...persisted,
  };
};
