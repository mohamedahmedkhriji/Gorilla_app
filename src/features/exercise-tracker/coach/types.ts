import type { ExerciseType, MovementOutput } from '../movement/types';
import type { SessionOutput } from '../session/types';

export type { ExerciseType, MovementOutput, SessionOutput };

export type CoachTier =
  | 'silent'
  | 'warning'
  | 'setup'
  | 'error'
  | 'cue'
  | 'affirmation';

export type CoachStatus =
  | 'idle'
  | 'warning'
  | 'good'
  | 'bad';

export type CoachingInstruction = {
  status: CoachStatus;
  tier: CoachTier;
  message: string;
  code: string;
  interruptible: boolean;
  createdAt: number;
  expiresAt?: number;
  confidence: number;
};

export type CoachCandidate = {
  tier: Exclude<CoachTier, 'silent'>;
  message: string;
  code: string;
  confidence: number;
  interruptible: boolean;
  expiresInMs?: number;
};

export type CoachOutput = {
  status: CoachStatus;
  activeInstruction?: CoachingInstruction;
  shouldSpeak: boolean;
  shouldDisplay: boolean;
  silenceReason?: string;
  debug: {
    topCandidateCode?: string;
    topCandidateTier?: CoachTier;
    cooldownActive: boolean;
    lastMessageCode?: string;
    queueDropped?: boolean;
  };
};

export interface CoachThresholds {
  minimumConfidenceForWarning: number;
  minimumConfidenceForCorrection: number;
  minGapBetweenMessagesMs: number;
  sameMessageCooldownMs: number;
  cueCooldownMs: number;
  affirmationCooldownMs: number;
  errorPersistenceMs: number;
  setupPersistenceMs: number;
  warningPersistenceMs: number;
  cuePersistenceMs: number;
  affirmationPersistenceMs: number;
  affirmationRepOverallMin: number;
  affirmationSetOverallMin: number;
  cleanRepStreakForAffirmation: number;
  lateralRaise?: {
    setupPrimaryMax: number;
    cueApproachPeakPrimary: number;
    lowPeakPrimary: number;
    highVelocitySignal: number;
  };
  shoulderPress?: {
    setupPrimaryMax: number;
    cueApproachPeakPrimary: number;
    lowPeakPrimary: number;
    highVelocitySignal: number;
  };
}

export type CoachContext = {
  exercise: ExerciseType;
  movement: MovementOutput;
  session: SessionOutput;
  timestamp: number;
};
