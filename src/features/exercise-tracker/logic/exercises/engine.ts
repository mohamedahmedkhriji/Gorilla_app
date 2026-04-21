import type { ExerciseLogicModule, ExerciseName } from '../../types/tracking';
import { lateralRaiseModule } from './lateralRaise';
import { shoulderPressModule } from './shoulderPress';

const MODULES: Record<ExerciseName, ExerciseLogicModule> = {
  'lateral-raise': lateralRaiseModule,
  'shoulder-press': shoulderPressModule,
};

export const getExerciseModule = (exercise: ExerciseName) => MODULES[exercise];

