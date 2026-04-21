import type { CoachStatus, ExerciseName } from '../types/tracking';

export interface CoachingIssue {
  active: boolean;
  message: string;
  status?: Exclude<CoachStatus, 'idle'>;
  priority: number;
}

interface AnalyzeExerciseArgs {
  exerciseType: ExerciseName;
  phase: string;
  phaseDurationMs: number;
  holdDurationMs?: number;
  completedReps?: number;
  issues: CoachingIssue[];
}

export interface CoachingDecision {
  status: CoachStatus;
  message: string;
}

export const getInstruction = (
  phase: string,
  exercise: ExerciseName,
  phaseDurationMs = 0,
  holdDurationMs = 500,
  completedReps = 0,
) => {
  if (exercise === 'lateral-raise') {
    if (phase === 'down') return completedReps > 0 ? 'Lift again' : 'Start position';
    if (phase === 'lifting') return 'Lift';
    if (phase === 'top') {
      return phaseDurationMs >= holdDurationMs ? 'Hold the position' : 'Lift';
    }

    return 'Lower slowly';
  }

  if (phase === 'start') return completedReps > 0 ? 'Press again' : 'Get ready';
  if (phase === 'pressing') return 'Press up';
  if (phase === 'top') {
    return phaseDurationMs >= holdDurationMs ? 'Hold overhead' : 'Press up';
  }

  return 'Lower with control';
};

const sortByPriority = (left: CoachingIssue, right: CoachingIssue) => left.priority - right.priority;

export const analyzeExercise = ({
  exerciseType,
  phase,
  phaseDurationMs,
  holdDurationMs,
  completedReps,
  issues,
}: AnalyzeExerciseArgs): CoachingDecision => {
  const activeIssues = issues.filter((candidate) => candidate.active).sort(sortByPriority);
  const warningIssue = activeIssues.find((candidate) => candidate.status === 'warning');

  if (warningIssue) {
    return {
      status: 'warning',
      message: warningIssue.message,
    };
  }

  const errorIssue = activeIssues.find((candidate) => candidate.status !== 'warning');

  if (errorIssue) {
    return {
      status: errorIssue.status || 'bad',
      message: errorIssue.message,
    };
  }

  return {
    status: 'good',
    message: getInstruction(phase, exerciseType, phaseDurationMs, holdDurationMs, completedReps),
  };
};
