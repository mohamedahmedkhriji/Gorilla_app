export {
  getProgramEngineBypassReason,
  isProgramEngineSupportedProfile,
  normalizeProgramEngineBodyType,
  normalizeProgramEngineExperience,
  normalizeProgramEngineGender,
  normalizeProgramEngineGoal,
  normalizeProgramEngineIdentity,
  normalizeTrainingProfile,
} from './normalizeProfile.js';

export {
  PROGRAM_ENGINE_SUPPORTED_EXPERIENCE_LEVELS,
  PROGRAM_ENGINE_SUPPORTED_GOALS,
  PROGRAM_ENGINE_SUPPORTED_SESSION_DURATIONS,
  assertValidTrainingProfile,
  validateTrainingProfile,
} from './validateProfile.js';

export {
  analyzeProgramDataset,
  analyzeProgramDatasetFiles,
} from './referenceData/analyzeDataset.js';

export {
  analyzeExerciseMatches,
  buildCatalogIndex,
  matchExerciseName,
} from './referenceData/exerciseMatcher.js';

export {
  buildReferencePrograms,
  normalizeExerciseRow,
  normalizeSummaryRow,
} from './referenceData/referenceProgram.js';

export {
  DEFAULT_PROGRAM_LENGTH_WEEKS,
  PROGRAM_ENGINE_VERSION,
} from './config/engineConfig.js';

export {
  buildProgramBlueprint,
  ProgramBlueprintGenerationError,
} from './blueprint/buildBlueprint.js';

export {
  assertValidProgramBlueprint,
  ProgramBlueprintValidationError,
  validateProgramBlueprint,
} from './blueprint/validateBlueprint.js';

export {
  createStaticCatalogProvider,
  loadMysqlProgramEngineCatalog,
  loadSupabaseProgramEngineCatalog,
} from './catalog/catalogProvider.js';

export {
  ExerciseResolutionError,
  resolveBlueprintExercises,
  resolveExerciseForSlot,
} from './resolver/exerciseResolver.js';

export {
  parseGenerationConstraints,
} from './resolver/constraints.js';

export {
  buildCompleteGeneratedProgram,
} from './program/buildCompleteProgram.js';

export {
  getProgramEngineSplitById,
  resolveProgramEngineSplitOverride,
} from './scheduling/splitSelector.js';

export {
  buildProgramEngineOnboardingInput,
  generateAndPersistProgramEnginePlan,
  ProgramEngineOrchestrationError,
  routeProgramEngineRequest,
} from './integration/generationOrchestrator.js';

export {
  persistCompleteGeneratedProgram,
  ProgramEnginePersistenceError,
} from './integration/persistenceAdapter.js';

export {
  assertValidCompleteGeneratedProgram,
  CompleteProgramValidationError,
  validateCompleteGeneratedProgram,
} from './program/validateCompleteProgram.js';

export {
  generateBrainDrivenProgram,
  BrainDrivenGenerationError,
} from './brainDriven/generateBrainDrivenProgram.js';

export {
  buildProgramEngineInputFromTrainingStrategy,
  BrainProgramEngineContractError,
} from './brainDriven/programEngineAdapter.js';

export {
  validateBrainDrivenProgram,
} from './brainDriven/validateBrainDrivenProgram.js';

export {
  loadLocalReferenceArtifact,
  loadLocalReferencePrograms,
} from './referenceData/localReferenceProvider.js';

export {
  analyzeTrainingProfile,
  assertValidTrainingStrategy,
  buildTrainingStrategy,
  evaluateCandidateStrategies,
  evaluateReferenceEvidence,
  generateCandidateStrategies,
  TrainingBrainInputError,
  TrainingStrategyValidationError,
  TRAINING_BRAIN_VERSION,
  validateTrainingStrategy,
} from './trainingBrain/index.js';

