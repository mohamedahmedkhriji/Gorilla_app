import { normalizeTrainingProfile } from '../normalizeProfile.js';
import { validateTrainingProfile } from '../validateProfile.js';
import { buildCompleteGeneratedProgram } from '../program/buildCompleteProgram.js';
import { buildTrainingStrategy } from '../trainingBrain/buildTrainingStrategy.js';
import { loadLocalReferencePrograms } from '../referenceData/localReferenceProvider.js';
import { buildProgramEngineInputFromTrainingStrategy } from './programEngineAdapter.js';
import {
  assertValidBrainDrivenProgram,
  validateBrainDrivenProgram,
} from './validateBrainDrivenProgram.js';

export class BrainDrivenGenerationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'BrainDrivenGenerationError';
    this.details = details;
  }
}

const resolveReferencePrograms = async ({
  referencePrograms,
  referenceProvider = loadLocalReferencePrograms,
  disableReferenceEvidence = false,
} = {}) => {
  if (disableReferenceEvidence) {
    return {
      metadata: null,
      programs: [],
      indexes: null,
    };
  }
  if (Array.isArray(referencePrograms)) {
    return {
      metadata: null,
      programs: referencePrograms,
      indexes: null,
    };
  }
  return referenceProvider();
};

export const generateBrainDrivenProgram = async (profileOrInput = {}, {
  catalogProvider,
  catalog = null,
  referencePrograms = null,
  referenceProvider = loadLocalReferencePrograms,
  disableReferenceEvidence = false,
  programLengthWeeks = 8,
} = {}) => {
  const normalizedProfile = profileOrInput.engineTarget
    ? profileOrInput
    : normalizeTrainingProfile(profileOrInput);
  const profileValidation = validateTrainingProfile(normalizedProfile);
  if (!profileValidation.valid || profileValidation.bypassed) {
    throw new BrainDrivenGenerationError('Profile cannot enter Brain-driven Program Engine generation.', {
      profileValidation,
      bypassReason: normalizedProfile.bypassReason,
    });
  }

  const reference = await resolveReferencePrograms({
    referencePrograms,
    referenceProvider,
    disableReferenceEvidence,
  });

  const trainingStrategy = buildTrainingStrategy(normalizedProfile, {
    referencePrograms: reference.programs,
    referenceMetadata: reference.metadata,
  });
  if (trainingStrategy.status !== 'ready') {
    throw new BrainDrivenGenerationError('Training Brain did not produce a ready strategy.', {
      trainingStrategy,
    });
  }

  const engineInput = buildProgramEngineInputFromTrainingStrategy({
    normalizedProfile,
    trainingStrategy,
    referenceEvidence: trainingStrategy.referenceEvidence,
  });

  const generatedProgram = await buildCompleteGeneratedProgram(engineInput.profile, {
    catalogProvider,
    catalog,
    programLengthWeeks,
    selectedSplitStrategy: engineInput.selectedSplitStrategy,
    trainingStrategy,
    referenceEvidence: trainingStrategy.referenceEvidence,
    availableDaysPerWeek: engineInput.availableDaysPerWeek,
  });

  const validation = validateBrainDrivenProgram({
    program: generatedProgram,
    trainingStrategy,
    engineInput,
  });
  assertValidBrainDrivenProgram({
    program: generatedProgram,
    trainingStrategy,
    engineInput,
  });

  return {
    normalizedProfile,
    trainingStrategy,
    referenceEvidence: trainingStrategy.referenceEvidence,
    referenceArtifactMetadata: reference.metadata,
    engineInput,
    generatedProgram,
    validation,
  };
};

