import type { ProcessedFrame } from '../signal/processFrame';
import { getLateralRaiseOutput, updateLateralRaiseFSM, createLateralRaiseState } from './lateralRaiseFSM';
import { getShoulderPressOutput, updateShoulderPressFSM, createShoulderPressState } from './shoulderPressFSM';
import type { ExerciseType, MovementOutput, MovementState } from './types';

const createMovementState = (exercise: ExerciseType): MovementState => {
  if (exercise === 'lateralRaise') {
    return createLateralRaiseState();
  }

  return createShoulderPressState();
};

const toMovementOutput = (state: MovementState): MovementOutput => {
  if (state.exercise === 'lateralRaise') {
    return getLateralRaiseOutput(state);
  }

  return getShoulderPressOutput(state);
};

export class MovementEngine {
  private readonly exercise: ExerciseType;
  private state: MovementState;
  private hasUpdates = false;

  constructor(exercise: ExerciseType) {
    this.exercise = exercise;
    this.state = createMovementState(exercise);
  }

  update(frame: ProcessedFrame): MovementOutput {
    this.state = this.exercise === 'lateralRaise'
      ? updateLateralRaiseFSM(frame, this.state)
      : updateShoulderPressFSM(frame, this.state);
    this.hasUpdates = true;

    return toMovementOutput(this.state);
  }

  reset(): void {
    this.state = createMovementState(this.exercise);
    this.hasUpdates = false;
  }

  getState(): MovementOutput | null {
    if (!this.hasUpdates) {
      return null;
    }

    return toMovementOutput(this.state);
  }
}
