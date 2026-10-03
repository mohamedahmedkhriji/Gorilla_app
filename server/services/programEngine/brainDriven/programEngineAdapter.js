import { parseGenerationConstraints } from '../resolver/constraints.js';

export class BrainProgramEngineContractError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'BrainProgramEngineContractError';
    this.details = details;
  }
}

export const buildProgramEngineInputFromTrainingStrategy = ({
  normalizedProfile,
  trainingStrategy,
  referenceEvidence = null,
} = {}) => {
  if (!normalizedProfile) {
    throw new BrainProgramEngineContractError('normalizedProfile is required');
  }
  if (!trainingStrategy || trainingStrategy.status !== 'ready') {
    throw new BrainProgramEngineContractError('A ready TrainingStrategy is required', {
      status: trainingStrategy?.status,
    });
  }

  const availableDaysPerWeek = Number(trainingStrategy.schedule?.availableDaysPerWeek ?? trainingStrategy.schedule?.daysPerWeek);
  const prescribedDaysPerWeek = Number(trainingStrategy.schedule?.prescribedDaysPerWeek ?? trainingStrategy.schedule?.daysPerWeek);
  const selectedSplitStrategy = trainingStrategy.architecture?.selectedStrategy
    || trainingStrategy.architecture?.splitStrategy;

  if (!Number.isInteger(availableDaysPerWeek) || !Number.isInteger(prescribedDaysPerWeek)) {
    throw new BrainProgramEngineContractError('TrainingStrategy schedule is missing available/prescribed days.');
  }
  if (prescribedDaysPerWeek > availableDaysPerWeek) {
    throw new BrainProgramEngineContractError('prescribedDaysPerWeek must not exceed availableDaysPerWeek.', {
      availableDaysPerWeek,
      prescribedDaysPerWeek,
    });
  }
  if (!selectedSplitStrategy) {
    throw new BrainProgramEngineContractError('TrainingStrategy architecture is missing selectedStrategy.');
  }

  const constraints = parseGenerationConstraints({
    equipmentNotes: normalizedProfile.equipmentNotes,
    injuriesOrMovementsToAvoid: normalizedProfile.injuriesOrMovementsToAvoid,
  });

  return {
    profile: {
      ...normalizedProfile,
      availableDaysPerWeek,
      daysPerWeek: prescribedDaysPerWeek,
      prescribedDaysPerWeek,
      sessionDurationMinutes: Number(trainingStrategy.schedule.sessionDurationMinutes),
    },
    availableDaysPerWeek,
    prescribedDaysPerWeek,
    selectedSplitStrategy,
    constraints,
    strategyMetadata: {
      brainVersion: trainingStrategy.brainVersion,
      selectedStrategy: selectedSplitStrategy,
      decisionConfidence: trainingStrategy.quality?.decisionConfidence,
      profileCompleteness: trainingStrategy.quality?.profileCompleteness,
      referenceEvidence,
    },
  };
};

