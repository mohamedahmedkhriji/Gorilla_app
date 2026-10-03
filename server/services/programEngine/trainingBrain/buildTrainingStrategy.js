import { parseGenerationConstraints } from '../resolver/constraints.js';
import { normalizeTrainingProfile } from '../normalizeProfile.js';
import { validateTrainingProfile } from '../validateProfile.js';
import {
  GOAL_WORKLOAD_DEFAULTS,
  SEX_AWARE_RULES,
  TRAINING_BRAIN_VERSION,
} from './config/brainConfig.js';
import { assertValidTrainingStrategy } from './validateTrainingStrategy.js';
import { buildTrainingBrainQuality } from './explainability/confidence.js';
import {
  buildAlternatives,
  buildArchitectureFromCandidate,
  buildExerciseComplexity,
  durationCapacityFor,
  evaluateCandidateStrategies,
} from './candidateStrategies.js';
import {
  TRAINING_BRAIN_REASON_CODES,
  TRAINING_BRAIN_WARNING_CODES,
  reason,
  warning,
} from './explainability/reasonCodes.js';

export class TrainingBrainInputError extends Error {
  constructor(errors) {
    super(errors.map((entry) => entry.message).join('; '));
    this.name = 'TrainingBrainInputError';
    this.errors = errors;
  }
}

const sexProfileFor = (gender) => {
  if (gender === 'man') return 'male';
  if (gender === 'woman') return 'female';
  return 'unknown';
};

const normalizeRecovery = (value) => {
  if (value === 'conservative') return 'recovery';
  if (value === 'push_progression') return 'performance';
  return value || 'balanced';
};

const fatigueForRecovery = (recoveryStrategy) => {
  if (recoveryStrategy === 'recovery') return 'conservative';
  if (recoveryStrategy === 'performance') return 'performance_biased';
  return 'balanced';
};

const aggressivenessFor = ({ experience, recoveryStrategy, sessionDurationMinutes }) => {
  if (recoveryStrategy === 'recovery' || sessionDurationMinutes === 30) return 'conservative';
  if (recoveryStrategy === 'performance' && experience !== 'beginner') return 'moderate_high';
  return 'moderate';
};

const applyTrainingFocus = ({ profile, defaults, reasons }) => {
  const trainingFocus = profile.trainingFocus || 'balanced';
  const next = { ...defaults };

  if (trainingFocus === 'strength' && profile.goal !== 'endurance') {
    next.compoundPriority = next.compoundPriority === 'very_high' ? 'very_high' : 'high';
    reasons.push(reason('exerciseStrategy', TRAINING_BRAIN_REASON_CODES.TRAINING_FOCUS_STRENGTH, {
      goal: profile.goal,
      trainingFocus,
    }));
  } else if (trainingFocus === 'hypertrophy' && !['powerlifting', 'endurance', 'fat_loss'].includes(profile.goal)) {
    next.isolationPriority = 'high';
    reasons.push(reason('exerciseStrategy', TRAINING_BRAIN_REASON_CODES.TRAINING_FOCUS_HYPERTROPHY, {
      goal: profile.goal,
      trainingFocus,
    }));
  } else if (trainingFocus !== 'balanced' && trainingFocus !== profile.goal) {
    reasons.push(reason('preferences', TRAINING_BRAIN_REASON_CODES.TRAINING_FOCUS_GOAL_PRECEDENCE, {
      goal: profile.goal,
      trainingFocus,
    }));
  }

  return next;
};

const buildBypassStrategy = (profile) => ({
  brainVersion: TRAINING_BRAIN_VERSION,
  status: 'bypassed',
  bypassReason: profile.bypassReason,
  confidence: 1,
  warnings: [],
  reasons: [
    reason('routing', TRAINING_BRAIN_REASON_CODES.BYPASS_UNSUPPORTED_PATH, {
      identity: profile.identity,
      bypassReason: profile.bypassReason,
    }),
  ],
});

const buildProfileBlock = (profile) => ({
  goal: profile.goal,
  experience: profile.experience,
  sexProfile: sexProfileFor(profile.gender),
});

const buildNoCandidateStrategy = ({
  profile,
  daysPerWeek,
  sessionDurationMinutes,
  constraints,
  candidateDecision,
  quality,
}) => {
  const warnings = [
    ...quality.warnings,
    warning(TRAINING_BRAIN_WARNING_CODES.NO_PROGRAM_ENGINE_COMPATIBLE_STRATEGY, {
      goal: profile.goal,
      daysPerWeek,
      rejectedCandidates: candidateDecision.rejectedCandidates.length,
    }),
  ];

  if (profile.goal === 'powerlifting') {
    const conflict = candidateDecision.rejectedCandidates
      .flatMap((candidate) => candidate.reasons)
      .find((entry) => entry.code === 'POWERLIFTING_PRIMARY_MOVEMENT_CONFLICT');
    if (conflict) {
      warnings.push(warning(TRAINING_BRAIN_WARNING_CODES.POWERLIFTING_PRIMARY_MOVEMENT_CONFLICT, conflict.inputs));
    }
  }

  const strategy = {
    brainVersion: TRAINING_BRAIN_VERSION,
    status: 'conflict',
    goal: profile.goal,
    experience: profile.experience,
    sexProfile: sexProfileFor(profile.gender),
    profile: buildProfileBlock(profile),
    schedule: {
      daysPerWeek,
      availableDaysPerWeek: daysPerWeek,
      prescribedDaysPerWeek: null,
      sessionDurationMinutes,
      capacity: durationCapacityFor(sessionDurationMinutes),
    },
    constraints: {
      movementsToAvoid: constraints.excludedMovementPatterns,
      requiredEquipment: constraints.requiredEquipment,
      excludedEquipment: constraints.excludedEquipment,
      rawFlags: constraints.rawFlags,
      equipmentNotes: profile.equipmentNotes,
      injuriesOrMovementsToAvoid: profile.injuriesOrMovementsToAvoid,
    },
    referenceEvidence: {
      used: false,
      source: null,
      matchedCount: 0,
      supportLevel: 'none',
      evidence: {},
    },
    explainability: {
      reasons: [
        reason('goal', TRAINING_BRAIN_REASON_CODES.GOAL_RECOGNIZED, {
          goal: profile.goal,
          identity: profile.identity,
        }),
        reason('architecture', TRAINING_BRAIN_REASON_CODES.NO_COMPATIBLE_CANDIDATE, {
          goal: profile.goal,
          daysPerWeek,
        }),
      ],
      warnings,
      rejectedCandidates: candidateDecision.rejectedCandidates,
    },
    quality: {
      profileCompleteness: quality.profileCompleteness,
      decisionConfidence: 'low',
    },
    confidence: quality.confidence,
    warnings,
    reasons: [
      reason('goal', TRAINING_BRAIN_REASON_CODES.GOAL_RECOGNIZED, {
        goal: profile.goal,
        identity: profile.identity,
      }),
      reason('architecture', TRAINING_BRAIN_REASON_CODES.NO_COMPATIBLE_CANDIDATE, {
        goal: profile.goal,
        daysPerWeek,
      }),
    ],
  };

  assertValidTrainingStrategy(strategy);
  return strategy;
};

export const buildTrainingStrategy = (profileOrInput = {}, options = {}) => {
  const profile = profileOrInput.engineTarget
    ? profileOrInput
    : normalizeTrainingProfile(profileOrInput);

  if (profile.bypassReason) {
    const bypass = buildBypassStrategy(profile);
    assertValidTrainingStrategy(bypass);
    return bypass;
  }

  const profileValidation = validateTrainingProfile(profile);
  if (!profileValidation.valid) {
    throw new TrainingBrainInputError(profileValidation.errors);
  }

  const daysPerWeek = Number(profile.daysPerWeek);
  const sessionDurationMinutes = Number(profile.sessionDurationMinutes);
  const recoveryStrategy = normalizeRecovery(profile.recoveryStrategy);
  const constraints = parseGenerationConstraints({
    equipmentNotes: profile.equipmentNotes,
    injuriesOrMovementsToAvoid: profile.injuriesOrMovementsToAvoid,
  });
  const candidateDecision = evaluateCandidateStrategies({
    profile: { ...profile, daysPerWeek, sessionDurationMinutes },
    constraints,
    recoveryStrategy,
    trainingFocus: profile.trainingFocus || 'balanced',
    referencePrograms: options.referencePrograms || [],
    referenceMetadata: options.referenceMetadata || null,
  });
  const quality = buildTrainingBrainQuality({
    profile,
    constraints,
    selectedCandidate: candidateDecision.selectedCandidate,
    validCandidates: candidateDecision.validCandidates,
  });

  if (!candidateDecision.selectedCandidate) {
    return buildNoCandidateStrategy({
      profile,
      daysPerWeek,
      sessionDurationMinutes,
      constraints,
      candidateDecision,
      quality,
    });
  }

  const split = {
    id: candidateDecision.selectedCandidate.splitId,
    name: candidateDecision.selectedCandidate.splitName,
  };
  const prescribedDaysPerWeek = candidateDecision.selectedCandidate.daysPerWeek;

  const reasons = [
    reason('goal', TRAINING_BRAIN_REASON_CODES.GOAL_RECOGNIZED, {
      goal: profile.goal,
      identity: profile.identity,
    }),
    reason('architecture.candidates', TRAINING_BRAIN_REASON_CODES.CANDIDATES_GENERATED, {
      candidateCount: candidateDecision.candidateCount,
      validCandidates: candidateDecision.validCandidates.length,
      rejectedCandidates: candidateDecision.rejectedCandidates.length,
    }),
    reason('architecture.selectedStrategy', TRAINING_BRAIN_REASON_CODES.CANDIDATE_SELECTED, {
      goal: profile.goal,
      experience: profile.experience,
      daysPerWeek,
      splitStrategy: split.id,
      score: candidateDecision.selectedCandidate.evaluation.totalScore,
      components: candidateDecision.selectedCandidate.evaluation.components,
    }),
    reason('architecture.selectedStrategy', TRAINING_BRAIN_REASON_CODES.PROGRAM_ENGINE_COMPATIBLE, {
      splitStrategy: split.id,
    }),
    reason('architecture.frequencyStrategy', TRAINING_BRAIN_REASON_CODES.FREQUENCY_FROM_DAYS, {
      daysPerWeek,
    }),
    reason('workload.durationCapacity', TRAINING_BRAIN_REASON_CODES.DURATION_CAPACITY_FROM_SESSION_LENGTH, {
      sessionDurationMinutes,
    }),
    reason('workload', TRAINING_BRAIN_REASON_CODES.GOAL_WORKLOAD_DEFAULT, {
      goal: profile.goal,
    }),
    reason('exerciseStrategy.complexity', TRAINING_BRAIN_REASON_CODES.EXPERIENCE_COMPLEXITY, {
      experience: profile.experience,
    }),
    reason('constraints', TRAINING_BRAIN_REASON_CODES.HARD_CONSTRAINTS_RECORDED, {
      rawFlags: constraints.rawFlags,
    }),
    reason('sexAware', TRAINING_BRAIN_REASON_CODES.SEX_AWARE_NEUTRAL_FOUNDATION, {
      gender: profile.gender,
    }),
    reason('metadata.bodyType', TRAINING_BRAIN_REASON_CODES.BODY_TYPE_INFORMATIONAL_ONLY, {
      bodyType: profile.bodyType,
    }),
  ];

  if (profile.cycleContext) {
    reasons.push(reason('sexAware.cycleContextAvailable', TRAINING_BRAIN_REASON_CODES.CYCLE_CONTEXT_METADATA_ONLY, {
      cycleContextAvailable: true,
    }));
  }

  reasons.push(reason('referenceEvidence', TRAINING_BRAIN_REASON_CODES.REFERENCE_EVIDENCE_EVALUATED, {
    used: candidateDecision.selectedCandidate.referenceEvidence.used,
    matchedCount: candidateDecision.selectedCandidate.referenceEvidence.matchedCount,
    supportLevel: candidateDecision.selectedCandidate.referenceEvidence.supportLevel,
  }));

  if (recoveryStrategy === 'recovery') {
    reasons.push(reason('workload.fatigueStrategy', TRAINING_BRAIN_REASON_CODES.RECOVERY_CONSERVATIVE, {
      recoveryStrategy: profile.recoveryStrategy,
    }));
  } else if (recoveryStrategy === 'performance') {
    reasons.push(reason('progressionStrategy.aggressiveness', TRAINING_BRAIN_REASON_CODES.RECOVERY_PERFORMANCE, {
      recoveryStrategy: profile.recoveryStrategy,
    }));
  } else {
    reasons.push(reason('workload.fatigueStrategy', TRAINING_BRAIN_REASON_CODES.RECOVERY_BALANCED, {
      recoveryStrategy: profile.recoveryStrategy || 'balanced',
    }));
  }

  const goalDefaults = applyTrainingFocus({
    profile,
    defaults: GOAL_WORKLOAD_DEFAULTS[profile.goal],
    reasons,
  });
  const sexProfile = sexProfileFor(profile.gender);
  const sexAwareRule = SEX_AWARE_RULES[sexProfile] || SEX_AWARE_RULES.unknown;

  const strategy = {
    brainVersion: TRAINING_BRAIN_VERSION,
    status: 'ready',
    goal: profile.goal,
    experience: profile.experience,
    sexProfile,
    profile: buildProfileBlock(profile),
    schedule: {
      daysPerWeek,
      availableDaysPerWeek: daysPerWeek,
      prescribedDaysPerWeek,
      sessionDurationMinutes,
      capacity: durationCapacityFor(sessionDurationMinutes),
    },
    architecture: {
      ...buildArchitectureFromCandidate({
        candidate: candidateDecision.selectedCandidate,
        daysPerWeek: prescribedDaysPerWeek,
      }),
      alternatives: buildAlternatives(candidateDecision.validCandidates),
    },
    workload: {
      volumeStrategy: goalDefaults.volumeStrategy,
      intensityStrategy: goalDefaults.intensityStrategy,
      fatigueStrategy: fatigueForRecovery(recoveryStrategy),
      durationCapacity: durationCapacityFor(sessionDurationMinutes),
    },
    exerciseStrategy: {
      complexity: buildExerciseComplexity(profile.experience),
      compoundPriority: goalDefaults.compoundPriority,
      isolationPriority: goalDefaults.isolationPriority,
    },
    progression: {
      strategy: goalDefaults.progressionType,
      aggressiveness: aggressivenessFor({
        experience: profile.experience,
        recoveryStrategy,
        sessionDurationMinutes,
      }),
    },
    progressionStrategy: {
      type: goalDefaults.progressionType,
      aggressiveness: aggressivenessFor({
        experience: profile.experience,
        recoveryStrategy,
        sessionDurationMinutes,
      }),
    },
    constraints: {
      movementsToAvoid: constraints.excludedMovementPatterns,
      requiredEquipment: constraints.requiredEquipment,
      excludedEquipment: constraints.excludedEquipment,
      rawFlags: constraints.rawFlags,
      equipmentNotes: profile.equipmentNotes,
      injuriesOrMovementsToAvoid: profile.injuriesOrMovementsToAvoid,
    },
    preferences: {
      trainingFocus: profile.trainingFocus || 'balanced',
      recoveryStrategy,
      preferredTime: profile.preferredTime,
    },
    sexAware: {
      enabled: true,
      profile: sexProfile,
      adjustments: sexAwareRule.adjustments,
      cycleContextAvailable: Boolean(profile.cycleContext),
      cycleContextMetadataOnly: true,
    },
    referenceEvidence: candidateDecision.selectedCandidate.referenceEvidence,
    explainability: {
      reasons,
      warnings: quality.warnings,
      rejectedCandidates: candidateDecision.rejectedCandidates,
      evaluationDimensions: Object.keys(candidateDecision.selectedCandidate.evaluation.components),
    },
    quality: {
      profileCompleteness: quality.profileCompleteness,
      decisionConfidence: quality.decisionConfidence,
    },
    metadata: {
      engineTarget: profile.engineTarget,
      identity: profile.identity,
      bodyType: profile.bodyType,
      bodyTypeProgrammingEffect: 'none',
      motivation: profile.motivation,
      selectedCandidateScore: candidateDecision.selectedCandidate.evaluation.totalScore,
    },
    confidence: quality.confidence,
    warnings: quality.warnings,
    reasons,
  };

  assertValidTrainingStrategy(strategy);
  return strategy;
};
