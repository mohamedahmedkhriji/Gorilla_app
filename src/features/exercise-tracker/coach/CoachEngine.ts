import { buildCoachCandidates } from './instructionRules';
import { MessageThrottle } from './messageThrottle';
import { selectTopCandidate } from './priority';
import type { CoachOutput, ExerciseType, MovementOutput, SessionOutput } from './types';

export class CoachEngine {
  private readonly exercise: ExerciseType;
  private readonly throttle: MessageThrottle;
  private state: CoachOutput | null = null;

  constructor(exercise: ExerciseType) {
    this.exercise = exercise;
    this.throttle = new MessageThrottle(exercise);
  }

  update(
    movement: MovementOutput,
    session: SessionOutput,
    timestamp: number,
  ): CoachOutput {
    const candidates = buildCoachCandidates(this.exercise, movement, session, timestamp);
    const topCandidate = selectTopCandidate(candidates);
    const decision = this.throttle.evaluate(topCandidate, timestamp);

    const output: CoachOutput = {
      ...decision.output,
      debug: {
        ...decision.output.debug,
        topCandidateCode: topCandidate?.code,
        topCandidateTier: topCandidate?.tier,
        queueDropped: candidates.length > 1 ? !decision.accepted || candidates.some((candidate) => candidate.code !== topCandidate?.code) : decision.output.debug.queueDropped,
      },
    };

    this.state = output;
    return output;
  }

  reset(): void {
    this.throttle.reset();
    this.state = null;
  }

  getState(): CoachOutput | null {
    if (!this.state) {
      return null;
    }

    return {
      ...this.state,
      activeInstruction: this.state.activeInstruction ? { ...this.state.activeInstruction } : undefined,
      debug: { ...this.state.debug },
    };
  }
}
