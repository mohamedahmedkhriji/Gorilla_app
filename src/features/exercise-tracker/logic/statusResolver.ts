import type {
  CoachStatus,
  ExerciseSummary,
  FeedbackMessage,
  SetStatus,
  TrackingState,
} from '../types/tracking';

interface ResolveCoachFeedbackArgs {
  setStatus: SetStatus;
  trackingState: TrackingState;
  coachStatus: CoachStatus;
  sessionFeedback: string;
  summary: ExerciseSummary | null;
}

const toFeedbackLevel = (status: CoachStatus): FeedbackMessage['level'] => {
  if (status === 'good') return 'success';
  if (status === 'bad') return 'error';
  if (status === 'warning') return 'warning';
  return 'info';
};

export const resolveCoachFeedback = ({
  setStatus,
  trackingState,
  coachStatus,
  sessionFeedback,
  summary,
}: ResolveCoachFeedbackArgs): FeedbackMessage => {
  if (trackingState.status === 'camera-error') {
    return {
      status: 'bad',
      level: 'error',
      title: 'Camera unavailable',
      message: 'Camera unavailable',
    };
  }

  if (trackingState.status === 'model-error') {
    return {
      status: 'bad',
      level: 'error',
      title: 'Tracker unavailable',
      message: 'Tracker unavailable',
    };
  }

  if (trackingState.status === 'requesting-camera') {
    return {
      status: 'warning',
      level: 'warning',
      title: 'Waiting',
      message: 'Allow camera access',
    };
  }

  if (trackingState.status === 'loading-model') {
    return {
      status: 'warning',
      level: 'warning',
      title: 'Preparing',
      message: 'Preparing tracker',
    };
  }

  if (setStatus === 'idle') {
    return {
      status: 'idle',
      level: 'info',
      title: 'Ready',
      message: 'Ready to start',
    };
  }

  if (setStatus === 'paused') {
    return {
      status: 'idle',
      level: 'info',
      title: 'Paused',
      message: 'Paused',
    };
  }

  if (setStatus === 'finished' && summary) {
    return {
      status: summary.validReps === summary.totalReps ? 'good' : 'warning',
      level: summary.validReps === summary.totalReps ? 'success' : 'warning',
      title: 'Set complete',
      message: `${summary.validReps}/${summary.totalReps} valid reps`,
    };
  }

  if (!trackingState.hasPose) {
    return {
      status: 'warning',
      level: 'warning',
      title: 'Adjust position',
      message: 'Position yourself',
    };
  }

  if (trackingState.isLowConfidence) {
    return {
      status: 'warning',
      level: 'warning',
      title: 'Adjust position',
      message: 'Hold steady in frame',
    };
  }

  if (!trackingState.isCentered) {
    return {
      status: 'warning',
      level: 'warning',
      title: 'Adjust position',
      message: 'Center your body in frame',
    };
  }

  return {
    status: coachStatus,
    level: toFeedbackLevel(coachStatus),
    title: sessionFeedback,
    message: sessionFeedback,
  };
};
