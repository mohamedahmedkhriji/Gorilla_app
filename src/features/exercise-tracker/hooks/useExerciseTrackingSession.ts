import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { getExerciseModule } from '../logic/exercises/engine';
import { pushFeedbackSample, resolveBufferedFeedback } from '../logic/feedbackBuffer';
import { buildPreviewScores } from '../logic/session';
import { TRACKER_CONFIG } from '../logic/trackerConfig';
import type {
  CoachStatus,
  ExerciseName,
  ExerciseSessionView,
  PoseTrackingFrame,
  SetStatus,
} from '../types/tracking';

const UI_COMMIT_THROTTLE_MS = 1000 / TRACKER_CONFIG.general.uiCommitFps;
const COACHING_VOTE_WINDOW = TRACKER_CONFIG.general.feedbackBufferSize;

const createInitialView = (
  exercise: ExerciseName,
  history: ExerciseSessionView['history'],
): ExerciseSessionView => {
  const module = getExerciseModule(exercise);
  const initialState = module.createInitialState();

  return {
    status: 'idle',
    phase: initialState.phase,
    repCount: 0,
    validRepCount: 0,
    coachStatus: initialState.coachStatus,
    primaryFeedback: initialState.lastFeedback,
    debug: initialState.debug,
    scoresPreview: buildPreviewScores(initialState.metrics, initialState.activeRep),
    currentDurationMs: 0,
    summary: null,
    history,
  };
};

export function useExerciseTrackingSession(selectedExercise: ExerciseName) {
  const [view, setView] = useState<ExerciseSessionView>(() => createInitialView(selectedExercise, []));
  const [, startTransition] = useTransition();

  const module = useMemo(() => getExerciseModule(selectedExercise), [selectedExercise]);
  const engineStateRef = useRef(module.createInitialState());
  const setStatusRef = useRef<SetStatus>('idle');
  const viewRef = useRef<ExerciseSessionView>(createInitialView(selectedExercise, []));
  const historyRef = useRef<ExerciseSessionView['history']>([]);
  const activeStartedAtRef = useRef<number | null>(null);
  const elapsedMsRef = useRef(0);
  const lastUiCommitRef = useRef(0);
  const coachingBufferRef = useRef<Array<{
    status: CoachStatus;
    message: string;
    timestampMs: number;
  }>>([]);

  const resetCoachBuffer = useCallback(() => {
    coachingBufferRef.current = [];
  }, []);

  const stabilizeCoachResponse = useCallback((
    next: {
      status: CoachStatus;
      message: string;
      timestampMs: number;
    },
  ) => {
    const nextBuffer = pushFeedbackSample(coachingBufferRef.current, next, COACHING_VOTE_WINDOW);
    coachingBufferRef.current = nextBuffer;

    return resolveBufferedFeedback(nextBuffer, next);
  }, []);

  useEffect(() => {
    const nextView = createInitialView(selectedExercise, historyRef.current);
    engineStateRef.current = module.createInitialState();
    setStatusRef.current = 'idle';
    activeStartedAtRef.current = null;
    elapsedMsRef.current = 0;
    resetCoachBuffer();
    viewRef.current = nextView;
    setView(nextView);
  }, [module, resetCoachBuffer, selectedExercise]);

  const getCurrentDurationMs = useCallback((now: number) => {
    if (setStatusRef.current === 'active' && activeStartedAtRef.current !== null) {
      return elapsedMsRef.current + Math.max(0, now - activeStartedAtRef.current);
    }

    return elapsedMsRef.current;
  }, []);

  const commitView = useCallback((force = false) => {
    const now = performance.now();
    if (!force && now - lastUiCommitRef.current < UI_COMMIT_THROTTLE_MS) {
      return;
    }

    lastUiCommitRef.current = now;
    const nextView: ExerciseSessionView = {
      status: setStatusRef.current,
      phase: engineStateRef.current.phase,
      repCount: engineStateRef.current.repCount,
      validRepCount: engineStateRef.current.validRepCount,
      coachStatus: engineStateRef.current.coachStatus,
      primaryFeedback: engineStateRef.current.lastFeedback,
      debug: engineStateRef.current.debug,
      scoresPreview: buildPreviewScores(
        engineStateRef.current.metrics,
        engineStateRef.current.activeRep,
      ),
      currentDurationMs: getCurrentDurationMs(now),
      summary: viewRef.current.summary,
      history: historyRef.current,
    };

    viewRef.current = nextView;
    startTransition(() => setView(nextView));
  }, [getCurrentDurationMs]);

  const startSet = useCallback(() => {
    engineStateRef.current = module.createInitialState();
    setStatusRef.current = 'active';
    activeStartedAtRef.current = performance.now();
    elapsedMsRef.current = 0;
    resetCoachBuffer();
    viewRef.current = {
      ...createInitialView(selectedExercise, historyRef.current),
      status: 'active',
    };
    commitView(true);
  }, [commitView, module, resetCoachBuffer, selectedExercise]);

  const pauseSet = useCallback(() => {
    if (setStatusRef.current !== 'active' || activeStartedAtRef.current === null) return;

    elapsedMsRef.current += Math.max(0, performance.now() - activeStartedAtRef.current);
    activeStartedAtRef.current = null;
    setStatusRef.current = 'paused';
    commitView(true);
  }, [commitView]);

  const resumeSet = useCallback(() => {
    if (setStatusRef.current !== 'paused') return;

    activeStartedAtRef.current = performance.now();
    setStatusRef.current = 'active';
    resetCoachBuffer();
    commitView(true);
  }, [commitView, resetCoachBuffer]);

  const resetSet = useCallback(() => {
    engineStateRef.current = module.createInitialState();
    setStatusRef.current = 'idle';
    activeStartedAtRef.current = null;
    elapsedMsRef.current = 0;
    resetCoachBuffer();
    viewRef.current = createInitialView(selectedExercise, historyRef.current);
    commitView(true);
  }, [commitView, module, resetCoachBuffer, selectedExercise]);

  const finishSet = useCallback(() => {
    if (setStatusRef.current === 'finished' || setStatusRef.current === 'idle') return;

    if (setStatusRef.current === 'active' && activeStartedAtRef.current !== null) {
      elapsedMsRef.current += Math.max(0, performance.now() - activeStartedAtRef.current);
    }

    activeStartedAtRef.current = null;
    setStatusRef.current = 'finished';
    resetCoachBuffer();

    const summary = module.buildSummary(engineStateRef.current, elapsedMsRef.current);
    historyRef.current = [summary, ...historyRef.current].slice(0, 8);
    viewRef.current = {
      ...viewRef.current,
      status: 'finished',
      summary,
      history: historyRef.current,
    };

    commitView(true);
  }, [commitView, module, resetCoachBuffer]);

  const handlePoseFrame = useCallback((frame: PoseTrackingFrame) => {
    if (setStatusRef.current !== 'active') {
      commitView();
      return;
    }

    const shouldIgnoreFrame = (
      !frame.hasPose
      || frame.isLowConfidence
      || !frame.isCentered
      || frame.bodyScale === null
    );

    if (shouldIgnoreFrame) {
      const stabilized = stabilizeCoachResponse({
        status: 'warning',
        message: !frame.hasPose
          ? 'Position yourself'
          : !frame.isCentered
            ? 'Center your body in frame'
            : 'Hold steady in frame',
        timestampMs: frame.timestampMs,
      });

      const lostFrameCount = engineStateRef.current.lostFrameCount + 1;
      engineStateRef.current = {
        ...engineStateRef.current,
        coachStatus: stabilized.status,
        lostFrameCount,
        debug: {
          ...engineStateRef.current.debug,
          trackingLostFrames: lostFrameCount,
        },
        lastFeedback: stabilized.message,
        lastFeedbackTimestamp: stabilized.timestampMs,
      };

      if (lostFrameCount > TRACKER_CONFIG.general.lostFrameGraceCount) {
        engineStateRef.current = {
          ...engineStateRef.current,
          activeRep: null,
          phase: module.createInitialState().phase,
          phaseStartedAt: null,
        };
      }

      commitView();
      return;
    }

    const analysis = module.analyzeFrame(frame, engineStateRef.current);
    const stabilized = stabilizeCoachResponse({
      status: analysis.coachStatus,
      message: analysis.primaryFeedback,
      timestampMs: frame.timestampMs,
    });

    engineStateRef.current = analysis.nextState;
    engineStateRef.current = {
      ...engineStateRef.current,
      coachStatus: stabilized.status,
      lastFeedback: stabilized.message,
      lastFeedbackTimestamp: stabilized.timestampMs,
      lostFrameCount: 0,
    };
    commitView();
  }, [commitView, module, stabilizeCoachResponse]);

  return {
    sessionView: view,
    startSet,
    pauseSet,
    resumeSet,
    resetSet,
    finishSet,
    handlePoseFrame,
  };
}
