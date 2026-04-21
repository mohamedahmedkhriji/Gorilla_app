import React, { useEffect, useRef, useState } from 'react';
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
  const { videoRef, cameraState } = useWebcamStream(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { trackingState } = usePoseTracking({
    enabled: true,
    selectedExercise,
    cameraState,
    videoRef,
    canvasRef,
    onFrame: handlePoseFrame,
  });

  useEffect(() => {
    updateTrackingState(trackingState);
  }, [trackingState, updateTrackingState]);

  const selectedLabel = EXERCISE_OPTIONS.find((option) => option.name === selectedExercise)?.label
    || 'Exercise';
  const canStartSet = trackingState.isCameraReady && trackingState.isModelReady;
  const showDebug = import.meta.env.DEV;

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
            />

            <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-4 sm:min-w-[180px]">
              <div className="text-[11px] uppercase tracking-[0.16em] text-text-tertiary">
                Phase
              </div>
              <div className="mt-2 text-lg font-semibold text-text-primary">
                {ui.phaseLabel}
              </div>
            </div>
          </div>

          <TrackerControls
            status={ui.trackerStatus}
            canStart={canStartSet}
            onStart={start}
            onPause={pause}
            onResume={start}
            onReset={reset}
            onFinish={finish}
          />

          {ui.trackerStatus === 'finished' && ui.summary ? (
            <SetSummaryCard summary={ui.summary} />
          ) : null}

          {showDebug ? (
            <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-3 text-xs text-text-tertiary">
              phase: {ui.debug.stablePhase || 'n/a'} | raw: {ui.debug.rawPhase || 'n/a'} | confidence:{' '}
              {ui.debug.confidence?.toFixed(2) ?? 'n/a'} | rep complete:{' '}
              {ui.debug.repJustCompleted ? 'yes' : 'no'} | fatigue:{' '}
              {ui.debug.fatigueDetected ? 'yes' : 'no'} | coach:{' '}
              {ui.debug.coachCandidateCode || 'silent'}
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
      {screen === 'selection' ? (
        <>
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
        </>
      ) : selectedExercise ? (
        <ActiveTrackerScreen
          selectedExercise={selectedExercise}
          onBackToSelection={() => setScreen('selection')}
        />
      ) : null}
    </div>
  );
}
