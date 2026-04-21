import { CoachEngine } from '../coach/CoachEngine';
import type { CoachOutput } from '../coach/types';
import { MovementEngine } from '../movement/MovementEngine';
import type { ExerciseType, MovementOutput } from '../movement/types';
import { SessionEngine } from '../session/SessionEngine';
import type { SessionConfig, SessionOutput, SetScore } from '../session/types';
import { SignalProcessor } from '../signal/processFrame';
import type { FrameInput, ProcessedFrame } from '../signal/processFrame';

export type TrackerRuntimeStatus = 'idle' | 'active' | 'paused' | 'finished';

export type TrackerRuntimeSnapshot = {
  exercise: ExerciseType;
  status: TrackerRuntimeStatus;
  signal: ProcessedFrame | null;
  movement: MovementOutput | null;
  session: SessionOutput | null;
  coach: CoachOutput | null;
  summary: SetScore | null;
  startedAt: number | null;
  finishedAt: number | null;
};

const cloneProcessedFrame = (frame: ProcessedFrame): ProcessedFrame => ({
  ...frame,
  landmarks: Object.fromEntries(
    Object.entries(frame.landmarks).map(([key, landmark]) => [key, { ...landmark }]),
  ),
  interpolatedJoints: [...frame.interpolatedJoints],
  features: {
    ...frame.features,
    velocity: { ...frame.features.velocity },
  },
  rawFeatures: {
    ...frame.rawFeatures,
    velocity: { ...frame.rawFeatures.velocity },
  },
});

const cloneMovementOutput = (movement: MovementOutput): MovementOutput => ({
  ...movement,
  repResult: movement.repResult
    ? {
      ...movement.repResult,
      metrics: { ...movement.repResult.metrics },
    }
    : undefined,
  debug: { ...movement.debug },
});

const cloneSessionOutput = (session: SessionOutput): SessionOutput => ({
  ...session,
  currentSetScore: session.currentSetScore
    ? {
      ...session.currentSetScore,
      average: { ...session.currentSetScore.average },
      fatigueTrend: session.currentSetScore.fatigueTrend
        ? { ...session.currentSetScore.fatigueTrend }
        : undefined,
    }
    : undefined,
  completedSetScores: session.completedSetScores.map((score) => ({
    ...score,
    average: { ...score.average },
    fatigueTrend: score.fatigueTrend ? { ...score.fatigueTrend } : undefined,
  })),
  repHistory: session.repHistory.map((rep) => ({
    ...rep,
    metrics: { ...rep.metrics },
    score: { ...rep.score },
    notes: rep.notes ? [...rep.notes] : undefined,
  })),
  fatigue: { ...session.fatigue },
  debug: { ...session.debug },
});

const cloneCoachOutput = (coach: CoachOutput): CoachOutput => ({
  ...coach,
  activeInstruction: coach.activeInstruction ? { ...coach.activeInstruction } : undefined,
  debug: { ...coach.debug },
});

const cloneSetScore = (score: SetScore): SetScore => ({
  ...score,
  average: { ...score.average },
  fatigueTrend: score.fatigueTrend ? { ...score.fatigueTrend } : undefined,
});

const createEmptySnapshot = (exercise: ExerciseType): TrackerRuntimeSnapshot => ({
  exercise,
  status: 'idle',
  signal: null,
  movement: null,
  session: null,
  coach: null,
  summary: null,
  startedAt: null,
  finishedAt: null,
});

export class TrackerRuntime {
  private readonly exercise: ExerciseType;
  private readonly signal: SignalProcessor;
  private readonly movement: MovementEngine;
  private readonly session: SessionEngine;
  private readonly coach: CoachEngine;
  private snapshot: TrackerRuntimeSnapshot;

  constructor(exercise: ExerciseType, config?: SessionConfig) {
    this.exercise = exercise;
    this.signal = new SignalProcessor();
    this.movement = new MovementEngine(exercise);
    this.session = new SessionEngine(exercise, config);
    this.coach = new CoachEngine(exercise);
    this.snapshot = createEmptySnapshot(exercise);
  }

  start(timestamp = performance.now()): TrackerRuntimeSnapshot {
    if (this.snapshot.status === 'finished') {
      this.snapshot.status = 'idle';
      this.snapshot.finishedAt = null;
      this.snapshot.summary = null;
    }

    if (this.snapshot.status !== 'active') {
      this.session.startSet();
      this.snapshot.session = this.session.getState();
      this.snapshot.status = 'active';
      this.snapshot.startedAt ??= timestamp;
    }

    return this.getSnapshot();
  }

  pause(): TrackerRuntimeSnapshot {
    if (this.snapshot.status === 'active') {
      this.snapshot.status = 'paused';
    }

    return this.getSnapshot();
  }

  reset(): TrackerRuntimeSnapshot {
    this.signal.reset();
    this.movement.reset();
    this.session.reset();
    this.coach.reset();
    this.snapshot = createEmptySnapshot(this.exercise);

    return this.getSnapshot();
  }

  finishSet(timestamp = performance.now()): TrackerRuntimeSnapshot {
    if (this.snapshot.status === 'active' || this.snapshot.status === 'paused') {
      this.session.finishSet();
      this.snapshot.session = this.session.getState();
      this.snapshot.summary = this.getLatestSetScore();
      this.snapshot.status = 'finished';
      this.snapshot.finishedAt = timestamp;
    }

    return this.getSnapshot();
  }

  processFrame(frameInput: FrameInput): TrackerRuntimeSnapshot {
    if (this.snapshot.status !== 'active') {
      return this.getSnapshot();
    }

    const signal = this.signal.processFrame(frameInput);
    const movement = this.movement.update(signal);
    const session = this.session.update(movement, frameInput.timestamp);
    const coach = this.coach.update(movement, session, frameInput.timestamp);

    this.snapshot = {
      ...this.snapshot,
      signal,
      movement,
      session,
      coach,
      summary: this.getLatestSetScore(session),
    };

    return this.getSnapshot();
  }

  getSnapshot(): TrackerRuntimeSnapshot {
    return {
      ...this.snapshot,
      signal: this.snapshot.signal ? cloneProcessedFrame(this.snapshot.signal) : null,
      movement: this.snapshot.movement ? cloneMovementOutput(this.snapshot.movement) : null,
      session: this.snapshot.session ? cloneSessionOutput(this.snapshot.session) : null,
      coach: this.snapshot.coach ? cloneCoachOutput(this.snapshot.coach) : null,
      summary: this.snapshot.summary ? cloneSetScore(this.snapshot.summary) : null,
    };
  }

  private getLatestSetScore(session = this.snapshot.session): SetScore | null {
    if (!session) {
      return this.snapshot.summary;
    }

    if (session.completedSetScores.length > 0) {
      return session.completedSetScores[session.completedSetScores.length - 1] ?? null;
    }

    return session.currentSetScore ?? null;
  }
}
