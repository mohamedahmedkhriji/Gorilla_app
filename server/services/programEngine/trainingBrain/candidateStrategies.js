import { SUPPORTED_SPLIT_IDS } from '../config/engineConfig.js';
import { buildProgramBlueprint } from '../blueprint/buildBlueprint.js';
import { getProgramEngineSplitById } from '../scheduling/splitSelector.js';
import { GOAL_WORKLOAD_DEFAULTS } from './config/brainConfig.js';
import { evaluateReferenceEvidence } from './referenceEvidence.js';

const BODYBUILDING_GOALS = new Set(['hypertrophy', 'cutting', 'bulking']);

const unique = (items) => [...new Set(items)];

const splitGoalFamily = (splitId) => {
  if (splitId.startsWith('powerlifting_')) return 'powerlifting';
  if (splitId.startsWith('fat_loss_')) return 'fat_loss';
  if (splitId.startsWith('endurance_')) return 'endurance';
  return 'bodybuilding';
};

const isGoalCompatible = (goal, family) => {
  if (BODYBUILDING_GOALS.has(goal)) return family === 'bodybuilding';
  return goal === family;
};

export const selectPrescribedDaysTarget = ({ goal, experience, availableDaysPerWeek, sessionDurationMinutes }) => {
  if (goal === 'fat_loss') {
    if (availableDaysPerWeek <= 2) return availableDaysPerWeek;
    if (experience === 'beginner') return 3;
    if (sessionDurationMinutes <= 45) return 3;
    if (availableDaysPerWeek >= 5 && experience === 'advanced' && sessionDurationMinutes >= 90) return 5;
    return Math.min(4, availableDaysPerWeek);
  }

  if (goal === 'endurance') {
    if (experience === 'beginner' && availableDaysPerWeek >= 5) return 4;
    return availableDaysPerWeek;
  }

  return availableDaysPerWeek;
};

const frequencyForDays = (daysPerWeek) => {
  if (daysPerWeek <= 2) return 'minimum_effective';
  if (daysPerWeek <= 4) return 'moderate_frequency';
  if (daysPerWeek === 5) return 'high_frequency';
  return 'very_high_frequency';
};

export const durationCapacityFor = (minutes) => {
  if (minutes === 30) return 'compact';
  if (minutes === 45) return 'standard';
  if (minutes === 60) return 'expanded';
  return 'extended';
};

const complexityForExperience = (experience) => ({
  beginner: 'foundational',
  intermediate: 'intermediate',
  advanced: 'advanced',
})[experience];

const hasPowerliftingMovementConflict = (constraints) => {
  const excluded = new Set(constraints.excludedMovementPatterns);
  return excluded.has('squat_pattern')
    || excluded.has('bench')
    || excluded.has('horizontal_press')
    || excluded.has('deadlift')
    || excluded.has('hip_hinge');
};

const hasPowerliftingEquipmentConflict = (constraints) =>
  constraints.excludedEquipment.includes('barbell')
  || (
    constraints.requiredEquipment.includes('dumbbell')
    && constraints.excludedEquipment.includes('barbell')
  );

const candidateHardRejections = ({ profile, candidate, constraints }) => {
  const reasons = [];
  if (candidate.daysPerWeek > Number(profile.daysPerWeek)) {
    reasons.push({ code: 'TRAINING_DAYS_INCOMPATIBLE', inputs: { available: profile.daysPerWeek, candidate: candidate.daysPerWeek } });
  }
  if (!isGoalCompatible(profile.goal, candidate.goalFamily)) {
    reasons.push({ code: 'GOAL_INCOMPATIBLE', inputs: { goal: profile.goal, candidateFamily: candidate.goalFamily } });
  }
  if (profile.goal === 'powerlifting' && candidate.goalFamily === 'powerlifting' && hasPowerliftingMovementConflict(constraints)) {
    reasons.push({ code: 'POWERLIFTING_PRIMARY_MOVEMENT_CONFLICT', inputs: { movementsToAvoid: constraints.excludedMovementPatterns } });
  }
  if (profile.goal === 'powerlifting' && candidate.goalFamily === 'powerlifting' && hasPowerliftingEquipmentConflict(constraints)) {
    reasons.push({ code: 'POWERLIFTING_EQUIPMENT_CONFLICT', inputs: { rawFlags: constraints.rawFlags } });
  }
  return reasons;
};

const compatibilityRejections = ({ profile, candidate }) => {
  try {
    const prescribedProfile = {
      ...profile,
      daysPerWeek: candidate.daysPerWeek,
    };
    const blueprint = buildProgramBlueprint(prescribedProfile);
    if (blueprint.split.id !== candidate.splitId) {
      return [{
        code: 'PROGRAM_ENGINE_SELECTED_DIFFERENT_SPLIT',
        inputs: {
          candidate: candidate.splitId,
          programEngineSplit: blueprint.split.id,
        },
      }];
    }
    return [];
  } catch (err) {
    return [{
      code: 'PROGRAM_ENGINE_INCOMPATIBLE',
      inputs: {
        splitStrategy: candidate.splitId,
        errorName: err?.name,
        message: err?.message,
      },
    }];
  }
};

const evaluateCandidate = ({ profile, candidate, recoveryStrategy, trainingFocus, referenceEvidence }) => {
  const availableDaysPerWeek = Number(profile.daysPerWeek);
  const prescribedDaysTarget = selectPrescribedDaysTarget({
    goal: profile.goal,
    experience: profile.experience,
    availableDaysPerWeek,
    sessionDurationMinutes: Number(profile.sessionDurationMinutes),
  });
  const components = {};
  components.goalFit = isGoalCompatible(profile.goal, candidate.goalFamily) ? 4 : 0;
  components.scheduleFit = candidate.daysPerWeek <= availableDaysPerWeek ? 3 : 0;
  components.durationFit = Number(profile.sessionDurationMinutes) === 30 && candidate.daysPerWeek >= 6 ? 1 : 2;
  components.frequencyFit = candidate.daysPerWeek === prescribedDaysTarget
    ? 3
    : candidate.daysPerWeek < prescribedDaysTarget
      ? 1
      : 0;
  components.experienceFit = profile.experience === 'beginner' && candidate.daysPerWeek >= 6 ? 1 : 2;
  components.recoveryFit = recoveryStrategy === 'recovery' && candidate.daysPerWeek >= 6 ? 1 : 2;
  components.focusFit = trainingFocus === 'strength' && ['powerlifting', 'hypertrophy', 'bulking'].includes(profile.goal) ? 2 : 1;
  components.constraintFit = 2;
  components.referenceFit = referenceEvidence.supportLevel === 'strong'
    ? 1
    : referenceEvidence.supportLevel === 'moderate'
      ? 0.5
      : 0;

  return {
    components,
    totalScore: Object.values(components).reduce((sum, value) => sum + value, 0),
  };
};

export const generateCandidateStrategies = ({ profile }) => {
  const availableDaysPerWeek = Number(profile.daysPerWeek);
  return SUPPORTED_SPLIT_IDS
    .map((splitId) => {
      const split = getProgramEngineSplitById(splitId);
      if (!split) return null;
      return {
        id: splitId,
        splitId,
        splitName: split.name,
        goalFamily: splitGoalFamily(splitId),
        daysPerWeek: split.sessionSequence.length,
        sessionTypes: split.sessionSequence.map((session) => session.sessionType),
      };
    })
    .filter(Boolean)
    .filter((candidate) => candidate.daysPerWeek <= availableDaysPerWeek);
};

export const evaluateCandidateStrategies = ({
  profile,
  constraints,
  recoveryStrategy,
  trainingFocus,
  referencePrograms = [],
  referenceMetadata = null,
}) => {
  const candidates = generateCandidateStrategies({ profile });
  const rejectedCandidates = [];
  const validCandidates = [];

  candidates.forEach((candidate) => {
    const hardRejections = candidateHardRejections({ profile, candidate, constraints });
    if (hardRejections.length) {
      rejectedCandidates.push({
        strategy: candidate.splitId,
        reasons: hardRejections,
      });
      return;
    }

    const engineRejections = compatibilityRejections({ profile, candidate });
    if (engineRejections.length) {
      rejectedCandidates.push({
        strategy: candidate.splitId,
        reasons: engineRejections,
      });
      return;
    }

    const referenceEvidence = evaluateReferenceEvidence({
      profile,
      candidateStrategy: candidate,
      referencePrograms,
      referenceMetadata,
      constraints,
    });
    const evaluation = evaluateCandidate({
      profile,
      candidate,
      recoveryStrategy,
      trainingFocus,
      referenceEvidence,
    });

    validCandidates.push({
      ...candidate,
      evaluation,
      referenceEvidence,
    });
  });

  validCandidates.sort((left, right) =>
    right.evaluation.totalScore - left.evaluation.totalScore
    || left.splitId.localeCompare(right.splitId));

  const selectedCandidate = validCandidates[0] || null;
  const defaults = selectedCandidate ? GOAL_WORKLOAD_DEFAULTS[profile.goal] : null;

  return {
    selectedCandidate,
    validCandidates,
    rejectedCandidates,
    candidateCount: candidates.length,
    programmingDefaults: defaults,
  };
};

export const buildArchitectureFromCandidate = ({ candidate, daysPerWeek }) => ({
  splitStrategy: candidate.splitId,
  selectedStrategy: candidate.splitId,
  splitName: candidate.splitName,
  frequencyStrategy: frequencyForDays(daysPerWeek),
  alternatives: [],
});

export const buildAlternatives = (validCandidates) => validCandidates.slice(1, 4).map((candidate) => ({
  strategy: candidate.splitId,
  splitName: candidate.splitName,
  totalScore: candidate.evaluation.totalScore,
  components: candidate.evaluation.components,
}));

export const buildExerciseComplexity = complexityForExperience;

export const collectEvaluationCodes = (validCandidates = []) => unique(
  validCandidates.flatMap((candidate) => Object.keys(candidate.evaluation.components)),
);
