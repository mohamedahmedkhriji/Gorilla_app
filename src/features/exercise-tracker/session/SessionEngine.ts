import type { MovementOutput } from '../movement/types';
import type {
  ExerciseType,
  FatigueStatus,
  SessionConfig,
  SessionOutput,
  SessionPhase,
  SetScore,
  RepRecord,
} from './types';
import { createRepRecord } from './repHistory';
import { buildSetScore } from './scoring';
import { detectFatigueTrend, getRecentAverages } from './fatigue';

const DEFAULT_CONFIG: Required<Pick<SessionConfig, 'autoCompleteSetOnTarget' | 'restDurationMs'>> = {
  autoCompleteSetOnTarget: false,
  restDurationMs: 60_000,
};

type SessionState = {
  sessionPhase: SessionPhase;
  exercise: ExerciseType;
  currentSet: number;
  currentSetRepHistory: RepRecord[];
  repHistory: RepRecord[];
  completedSetScores: SetScore[];
  currentSetScore?: SetScore;
  fatigue: FatigueStatus;
  repJustLogged: boolean;
  setJustCompleted: boolean;
  sessionJustCompleted: boolean;
  lastLoggedRepKey?: string;
  restStartedAt?: number;
};

const cloneRepRecord = (record: RepRecord): RepRecord => ({
  ...record,
  metrics: { ...record.metrics },
  score: { ...record.score },
  notes: record.notes ? [...record.notes] : undefined,
});

const cloneSetScore = (score: SetScore): SetScore => ({
  ...score,
  average: { ...score.average },
  fatigueTrend: score.fatigueTrend ? { ...score.fatigueTrend } : undefined,
});

const createInitialState = (exercise: ExerciseType): SessionState => ({
  sessionPhase: 'sessionIdle',
  exercise,
  currentSet: 1,
  currentSetRepHistory: [],
  repHistory: [],
  completedSetScores: [],
  currentSetScore: undefined,
  fatigue: {
    detected: false,
    confidence: 0,
  },
  repJustLogged: false,
  setJustCompleted: false,
  sessionJustCompleted: false,
  lastLoggedRepKey: undefined,
  restStartedAt: undefined,
});

export class SessionEngine {
  private readonly exercise: ExerciseType;
  private readonly config: SessionConfig;
  private state: SessionState;
  private hasUpdates = false;

  constructor(exercise: ExerciseType, config?: SessionConfig) {
    this.exercise = exercise;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.state = createInitialState(exercise);
  }

  update(movementOutput: MovementOutput, timestamp: number): SessionOutput {
    this.resetUpdateFlags();

    if (movementOutput.exercise !== this.exercise) {
      this.hasUpdates = true;
      return this.toOutput();
    }

    if (this.state.sessionPhase === 'setRest' && this.shouldAutoFinishRest(timestamp)) {
      this.finishRest();
    }

    if (
      this.state.sessionPhase === 'setActive'
      && movementOutput.repJustCompleted
      && movementOutput.repResult
    ) {
      const repKey = `${this.state.currentSet}:${movementOutput.repResult.repNumber}:${timestamp}`;

      if (repKey !== this.state.lastLoggedRepKey) {
        const record = createRepRecord({
          exercise: this.exercise,
          repResult: movementOutput.repResult,
          setNumber: this.state.currentSet,
          completedAt: timestamp,
        });

        this.state.currentSetRepHistory.push(record);
        this.state.repHistory.push(record);
        this.state.lastLoggedRepKey = repKey;
        this.state.repJustLogged = true;
        this.recomputeCurrentSetInsights();

        if (
          this.config.autoCompleteSetOnTarget
          && this.config.targetReps !== undefined
          && this.getCurrentSetValidRepCount() >= this.config.targetReps
        ) {
          this.finishSet();
        }
      }
    }

    this.hasUpdates = true;
    return this.toOutput();
  }

  startSet(): void {
    this.resetUpdateFlags();

    if (this.state.sessionPhase === 'sessionComplete') {
      this.hasUpdates = true;
      return;
    }

    if (this.state.sessionPhase === 'setActive') {
      this.hasUpdates = true;
      return;
    }

    if (this.state.sessionPhase === 'setComplete' || this.state.sessionPhase === 'setRest') {
      this.prepareNextSet();
    }

    this.state.sessionPhase = 'setActive';
    this.state.restStartedAt = undefined;
    this.hasUpdates = true;
  }

  finishSet(): void {
    this.resetUpdateFlags();

    if (this.state.sessionPhase !== 'setActive') {
      this.hasUpdates = true;
      return;
    }

    this.finalizeCurrentSet();
    this.hasUpdates = true;
  }

  startRest(): void {
    this.resetUpdateFlags();

    if (this.state.sessionPhase !== 'setComplete') {
      this.hasUpdates = true;
      return;
    }

    if (this.isSessionTargetReached()) {
      this.finishSession();
      return;
    }

    this.state.sessionPhase = 'setRest';
    this.state.restStartedAt = undefined;
    this.hasUpdates = true;
  }

  finishRest(): void {
    this.resetUpdateFlags();

    if (this.state.sessionPhase !== 'setRest') {
      this.hasUpdates = true;
      return;
    }

    this.prepareNextSet();
    this.state.sessionPhase = 'setActive';
    this.state.restStartedAt = undefined;
    this.hasUpdates = true;
  }

  finishSession(): void {
    this.resetUpdateFlags();

    if (this.state.sessionPhase === 'setActive') {
      this.finalizeCurrentSet();
    }

    this.state.sessionPhase = 'sessionComplete';
    this.state.sessionJustCompleted = true;
    this.hasUpdates = true;
  }

  reset(): void {
    this.state = createInitialState(this.exercise);
    this.hasUpdates = false;
  }

  getState(): SessionOutput | null {
    if (!this.hasUpdates) {
      return null;
    }

    return this.toOutput();
  }

  private prepareNextSet() {
    this.state.currentSet += 1;
    this.state.currentSetRepHistory = [];
    this.state.currentSetScore = undefined;
    this.state.fatigue = {
      detected: false,
      confidence: 0,
    };
    this.state.lastLoggedRepKey = undefined;
  }

  private finalizeCurrentSet() {
    this.recomputeCurrentSetInsights();

    if (this.state.currentSetScore) {
      this.state.completedSetScores.push(this.state.currentSetScore);
    }

    this.state.sessionPhase = this.isSessionTargetReached() ? 'sessionComplete' : 'setComplete';
    this.state.setJustCompleted = true;
    this.state.sessionJustCompleted = this.state.sessionPhase === 'sessionComplete';
  }

  private recomputeCurrentSetInsights() {
    this.state.fatigue = detectFatigueTrend(this.exercise, this.state.currentSetRepHistory);
    this.state.currentSetScore = buildSetScore(
      this.exercise,
      this.state.currentSetRepHistory,
      this.state.fatigue.detected
        ? {
          detected: true,
          confidence: this.state.fatigue.confidence,
          reason: this.state.fatigue.reason,
        }
        : undefined,
    );
  }

  private isSessionTargetReached() {
    if (this.config.targetSets === undefined) {
      return false;
    }

    return this.state.completedSetScores.length >= this.config.targetSets;
  }

  private shouldAutoFinishRest(timestamp: number) {
    if (this.state.restStartedAt === undefined) {
      this.state.restStartedAt = timestamp;
      return false;
    }

    return (timestamp - this.state.restStartedAt) >= (this.config.restDurationMs ?? DEFAULT_CONFIG.restDurationMs);
  }

  private getCurrentSetValidRepCount() {
    return this.state.currentSetRepHistory.filter((record) => record.valid).length;
  }

  private resetUpdateFlags() {
    this.state.repJustLogged = false;
    this.state.setJustCompleted = false;
    this.state.sessionJustCompleted = false;
  }

  private toOutput(): SessionOutput {
    const repCount = this.state.currentSetRepHistory.length;
    const validRepCount = this.getCurrentSetValidRepCount();
    const recentAverages = getRecentAverages(this.exercise, this.state.currentSetRepHistory);

    return {
      sessionPhase: this.state.sessionPhase,
      exercise: this.exercise,
      currentSet: this.state.currentSet,
      currentRep: repCount,
      targetReps: this.config.targetReps,
      targetSets: this.config.targetSets,
      repJustLogged: this.state.repJustLogged,
      setJustCompleted: this.state.setJustCompleted,
      sessionJustCompleted: this.state.sessionJustCompleted,
      currentSetScore: this.state.currentSetScore ? cloneSetScore(this.state.currentSetScore) : undefined,
      completedSetScores: this.state.completedSetScores.map(cloneSetScore),
      repHistory: this.state.repHistory.map(cloneRepRecord),
      fatigue: { ...this.state.fatigue },
      debug: {
        validRepRatio: repCount > 0 ? validRepCount / repCount : 0,
        recentRomAverage: recentAverages.recentRomAverage,
        recentControlAverage: recentAverages.recentControlAverage,
      },
    };
  }
}
