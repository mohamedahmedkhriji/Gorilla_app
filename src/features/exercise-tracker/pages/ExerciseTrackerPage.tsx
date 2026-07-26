import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Header } from '../../../components/ui/Header';
import { CameraPreview } from '../components/CameraPreview';
import { RepCounter } from '../components/RepCounter';
import { SetSummaryCard } from '../components/SetSummaryCard';
import { StatusIndicator } from '../components/StatusIndicator';
import { TrackerControls } from '../components/TrackerControls';
import { TrackerHeader } from '../components/TrackerHeader';
import { useExerciseTrackerRuntime } from '../hooks/useExerciseTrackerRuntime';
import { usePoseTracking } from '../hooks/usePoseTracking';
import { useWebcamStream } from '../hooks/useWebcamStream';
import { EXERCISE_OPTIONS } from '../logic/constants';
import { ExerciseSelectionPage } from './ExerciseSelectionPage';
import type { ExerciseName } from '../types/tracking';

interface ExerciseTrackerPageProps {
  onBack: () => void;
}

interface ActiveTrackerScreenProps {
  selectedExercise: ExerciseName;
  onBackToSelection: () => void;
}

function ActiveTrackerScreen({
  selectedExercise,
  onBackToSelection,
}: ActiveTrackerScreenProps) {
  const {
    ui,
    handlePoseFrame,
    updateTrackingState,
    start,
    pause,
    reset,
    finish,
  } = useExerciseTrackerRuntime({
    selectedExercise,
  });
  const [trackerResetKey, setTrackerResetKey] = useState(0);
  const { videoRef, cameraState, retry: retryCamera } = useWebcamStream(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { trackingState } = usePoseTracking({
    enabled: true,
    selectedExercise,
    cameraState,
    videoRef,
    canvasRef,
    onFrame: handlePoseFrame,
    resetKey: trackerResetKey,
  });

  useEffect(() => {
    updateTrackingState(trackingState);
  }, [trackingState, updateTrackingState]);

  const selectedLabel = EXERCISE_OPTIONS.find((option) => option.name === selectedExercise)?.label
    || 'Exercise';
  const canStartSet = trackingState.isCameraReady && trackingState.isModelReady;
  const startDisabledReason = trackingState.status === 'requesting-camera'
    ? 'Waiting for camera...'
    : trackingState.status === 'loading-model'
      ? 'Loading pose model...'
      : !canStartSet
        ? 'Waiting for tracker...'
        : undefined;
  const showDebug = import.meta.env.DEV;
  const retryTracker = () => {
    retryCamera();
    setTrackerResetKey((value) => value + 1);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-20">
      <TrackerHeader
        title={selectedLabel}
        subtitle="Front view"
        onBack={onBackToSelection}
      />

      <CameraPreview
        videoRef={videoRef}
        canvasRef={canvasRef}
        cameraState={cameraState}
        trackingState={trackingState}
        onRetry={retryTracker}
      />

      <StatusIndicator
        status={ui.feedback.tone}
        title={ui.feedback.title}
        message={ui.feedback.message}
      />

      <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.22)] sm:p-5">
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <RepCounter
              value={ui.repCount}
              label="Reps"
              hint={`Set ${ui.setNumber}`}
              pulse={ui.debug.repJustCompleted}
            />

            <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4 sm:min-w-[180px]">
              <div className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">
                Phase
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={ui.phaseLabel}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="mt-2 text-lg font-semibold text-text-primary"
                >
                  {ui.phaseLabel}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <TrackerControls
            status={ui.trackerStatus}
            canStart={canStartSet}
            startDisabledReason={startDisabledReason}
            onStart={start}
            onPause={pause}
            onResume={start}
            onReset={reset}
            onFinish={finish}
          />

          {ui.trackerStatus === 'finished' && ui.summary ? (
            <SetSummaryCard
              summary={ui.summary}
              onBackToExercises={onBackToSelection}
            />
          ) : null}

          {showDebug ? (
            <div className="grid grid-cols-2 gap-2 rounded-[20px] border border-white/10 bg-black/25 px-4 py-3 font-mono text-[11px] text-text-secondary sm:grid-cols-3">
              <div><span className="text-text-tertiary">phase</span><br />{ui.debug.stablePhase || 'n/a'}</div>
              <div><span className="text-text-tertiary">raw</span><br />{ui.debug.rawPhase || 'n/a'}</div>
              <div><span className="text-text-tertiary">confidence</span><br />{ui.debug.confidence?.toFixed(2) ?? 'n/a'}</div>
              <div><span className="text-text-tertiary">rep</span><br />{ui.debug.repJustCompleted ? 'complete' : 'no'}</div>
              <div><span className="text-text-tertiary">fatigue</span><br />{ui.debug.fatigueDetected ? 'yes' : 'no'}</div>
              <div><span className="text-text-tertiary">coach</span><br />{ui.debug.coachCandidateCode || 'silent'}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ExerciseTrackerPage({ onBack }: ExerciseTrackerPageProps) {
  const [selectedExercise, setSelectedExercise] = useState<ExerciseName | null>(null);
  const [screen, setScreen] = useState<'selection' | 'tracker'>('selection');

  return (
    <div className="pb-20 pt-4">
      <AnimatePresence mode="wait" initial={false}>
        {screen === 'selection' ? (
        <motion.div
          key="selection"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <Header
            onBack={onBack}
            compact
          />
          <ExerciseSelectionPage
            selectedExercise={selectedExercise}
            onSelectExercise={setSelectedExercise}
            onContinue={() => {
              if (selectedExercise) {
                setScreen('tracker');
              }
            }}
          />
        </motion.div>
      ) : selectedExercise ? (
        <motion.div
          key="tracker"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <ActiveTrackerScreen
            selectedExercise={selectedExercise}
            onBackToSelection={() => setScreen('selection')}
          />
        </motion.div>
      ) : null}
      </AnimatePresence>
    </div>
  );
}
