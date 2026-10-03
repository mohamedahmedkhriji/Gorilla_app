import {
  PROGRAM_ENGINE_SUPPORTED_EXPERIENCE_LEVELS,
  PROGRAM_ENGINE_SUPPORTED_GOALS,
  PROGRAM_ENGINE_SUPPORTED_SESSION_DURATIONS,
} from '../../validateProfile.js';

export const TRAINING_BRAIN_VERSION = '1.1';

export const TRAINING_BRAIN_SUPPORTED_GOALS = PROGRAM_ENGINE_SUPPORTED_GOALS;
export const TRAINING_BRAIN_SUPPORTED_EXPERIENCE_LEVELS = PROGRAM_ENGINE_SUPPORTED_EXPERIENCE_LEVELS;
export const TRAINING_BRAIN_SUPPORTED_SESSION_DURATIONS = PROGRAM_ENGINE_SUPPORTED_SESSION_DURATIONS;

export const TRAINING_BRAIN_SUPPORTED_DAYS = Object.freeze([2, 3, 4, 5, 6]);

export const TRAINING_BRAIN_SUPPORTED_VALUES = Object.freeze({
  status: ['ready', 'bypassed', 'conflict'],
  sexProfile: ['male', 'female', 'unknown'],
  frequencyStrategy: ['minimum_effective', 'moderate_frequency', 'high_frequency', 'very_high_frequency'],
  volumeStrategy: ['low_moderate', 'moderate', 'moderate_high', 'goal_specific'],
  intensityStrategy: ['moderate', 'moderate_high', 'high_skill_strength', 'aerobic_controlled'],
  fatigueStrategy: ['conservative', 'balanced', 'performance_biased'],
  durationCapacity: ['compact', 'standard', 'expanded', 'extended'],
  exerciseComplexity: ['foundational', 'intermediate', 'advanced'],
  compoundPriority: ['moderate', 'high', 'very_high'],
  isolationPriority: ['low', 'moderate', 'high'],
  progressionType: [
    'double_progression',
    'strength_rir_progression',
    'performance_retention',
    'aerobic_progression',
  ],
  progressionAggressiveness: ['conservative', 'moderate', 'moderate_high'],
  decisionConfidence: ['low', 'medium', 'high'],
});

export const TRAINING_BRAIN_DECISION_PRECEDENCE = Object.freeze([
  'safety_hard_constraints',
  'movement_restrictions',
  'available_equipment',
  'training_days',
  'session_duration',
  'primary_goal',
  'experience',
  'recovery_strategy',
  'training_focus',
  'sex_aware_modifiers',
  'optional_preferences',
  'reference_evidence',
]);

export const GOAL_WORKLOAD_DEFAULTS = Object.freeze({
  hypertrophy: {
    volumeStrategy: 'moderate',
    intensityStrategy: 'moderate_high',
    compoundPriority: 'high',
    isolationPriority: 'moderate',
    progressionType: 'double_progression',
  },
  powerlifting: {
    volumeStrategy: 'goal_specific',
    intensityStrategy: 'high_skill_strength',
    compoundPriority: 'very_high',
    isolationPriority: 'low',
    progressionType: 'strength_rir_progression',
  },
  cutting: {
    volumeStrategy: 'low_moderate',
    intensityStrategy: 'moderate',
    compoundPriority: 'high',
    isolationPriority: 'moderate',
    progressionType: 'performance_retention',
  },
  bulking: {
    volumeStrategy: 'moderate_high',
    intensityStrategy: 'moderate_high',
    compoundPriority: 'high',
    isolationPriority: 'moderate',
    progressionType: 'double_progression',
  },
  fat_loss: {
    volumeStrategy: 'moderate',
    intensityStrategy: 'moderate',
    compoundPriority: 'high',
    isolationPriority: 'low',
    progressionType: 'performance_retention',
  },
  endurance: {
    volumeStrategy: 'goal_specific',
    intensityStrategy: 'aerobic_controlled',
    compoundPriority: 'moderate',
    isolationPriority: 'low',
    progressionType: 'aerobic_progression',
  },
});

export const SEX_AWARE_RULES = Object.freeze({
  male: {
    adjustments: [],
  },
  female: {
    adjustments: [],
  },
  unknown: {
    adjustments: [],
  },
});

export const REFERENCE_EVIDENCE_SOURCE = 'fitness.project/program_summary';
