import { COACH_THRESHOLDS } from './coachThresholds';
import { getTierPriority } from './priority';
import type {
  CoachCandidate,
  CoachOutput,
  CoachStatus,
  CoachTier,
  CoachingInstruction,
  ExerciseType,
} from './types';

const getStatusForTier = (tier: CoachTier): CoachStatus => {
  if (tier === 'warning' || tier === 'setup') return 'warning';
  if (tier === 'error') return 'bad';
  if (tier === 'cue' || tier === 'affirmation') return 'good';
  return 'idle';
};

const toInstruction = (
  candidate: CoachCandidate,
  timestamp: number,
): CoachingInstruction => ({
  status: getStatusForTier(candidate.tier),
  tier: candidate.tier,
  message: candidate.message,
  code: candidate.code,
  interruptible: candidate.interruptible,
  createdAt: timestamp,
  expiresAt: candidate.expiresInMs !== undefined ? timestamp + candidate.expiresInMs : undefined,
  confidence: candidate.confidence,
});

const isExpired = (
  instruction: CoachingInstruction | undefined,
  timestamp: number,
) => (
  !instruction
  || (instruction.expiresAt !== undefined && instruction.expiresAt <= timestamp)
);

type ThrottleDecision = {
  output: CoachOutput;
  accepted: boolean;
};

export class MessageThrottle {
  private readonly exercise: ExerciseType;
  private activeInstruction?: CoachingInstruction;
  private lastDeliveredAt?: number;
  private lastDeliveredCode?: string;
  private readonly lastByCode = new Map<string, number>();

  constructor(exercise: ExerciseType) {
    this.exercise = exercise;
  }

  evaluate(candidate: CoachCandidate | undefined, timestamp: number): ThrottleDecision {
    const thresholds = COACH_THRESHOLDS[this.exercise];
    const current = isExpired(this.activeInstruction, timestamp) ? undefined : this.activeInstruction;
    const topTier = candidate?.tier;
    const topCode = candidate?.code;

    if (current) {
      if (candidate && getTierPriority(candidate.tier) > getTierPriority(current.tier) && current.interruptible) {
        return this.acceptCandidate(candidate, timestamp, topTier, topCode, false);
      }

      return {
        accepted: false,
        output: {
          status: current.status,
          activeInstruction: { ...current },
          shouldSpeak: false,
          shouldDisplay: true,
          silenceReason: candidate ? 'higher_priority_pending' : undefined,
          debug: {
            topCandidateCode: topCode,
            topCandidateTier: topTier,
            cooldownActive: false,
            lastMessageCode: this.lastDeliveredCode,
            queueDropped: candidate ? candidate.code !== current.code : false,
          },
        },
      };
    }

    this.activeInstruction = undefined;

    if (!candidate) {
      return {
        accepted: false,
        output: {
          status: 'idle',
          shouldSpeak: false,
          shouldDisplay: false,
          silenceReason: 'no_actionable_change',
          debug: {
            cooldownActive: false,
            lastMessageCode: this.lastDeliveredCode,
          },
        },
      };
    }

    const sameCodeCooldown = candidate.tier === 'cue'
      ? thresholds.cueCooldownMs
      : candidate.tier === 'affirmation'
        ? thresholds.affirmationCooldownMs
        : thresholds.sameMessageCooldownMs;
    const lastForCode = this.lastByCode.get(candidate.code);
    const sameCodeBlocked = lastForCode !== undefined && (timestamp - lastForCode) < sameCodeCooldown;
    const gapBlocked = this.lastDeliveredAt !== undefined
      && (timestamp - this.lastDeliveredAt) < thresholds.minGapBetweenMessagesMs;

    if (sameCodeBlocked || gapBlocked) {
      return {
        accepted: false,
        output: {
          status: 'idle',
          shouldSpeak: false,
          shouldDisplay: false,
          silenceReason: 'cooldown',
          debug: {
            topCandidateCode: topCode,
            topCandidateTier: topTier,
            cooldownActive: true,
            lastMessageCode: this.lastDeliveredCode,
          },
        },
      };
    }

    return this.acceptCandidate(candidate, timestamp, topTier, topCode, false);
  }

  reset() {
    this.activeInstruction = undefined;
    this.lastDeliveredAt = undefined;
    this.lastDeliveredCode = undefined;
    this.lastByCode.clear();
  }

  getActiveInstruction() {
    return this.activeInstruction ? { ...this.activeInstruction } : undefined;
  }

  getLastMessageCode() {
    return this.lastDeliveredCode;
  }

  private acceptCandidate(
    candidate: CoachCandidate,
    timestamp: number,
    topTier: CoachTier | undefined,
    topCode: string | undefined,
    queueDropped: boolean,
  ): ThrottleDecision {
    const instruction = toInstruction(candidate, timestamp);

    this.activeInstruction = instruction;
    this.lastDeliveredAt = timestamp;
    this.lastDeliveredCode = instruction.code;
    this.lastByCode.set(instruction.code, timestamp);

    return {
      accepted: true,
      output: {
        status: instruction.status,
        activeInstruction: { ...instruction },
        shouldSpeak: true,
        shouldDisplay: true,
        debug: {
          topCandidateCode: topCode,
          topCandidateTier: topTier,
          cooldownActive: false,
          lastMessageCode: this.lastDeliveredCode,
          queueDropped,
        },
      },
    };
  }
}
