TrackerRuntime Manual Repro

Bug #2 verification:

1. Open the exercise tracker and choose either supported exercise.
2. Before pressing Start, move through a full rep while the camera overlay is live.
3. Confirm the visible rep count stays at 0 and the phase label does not advance from the idle/waiting state.
4. Press Start and perform one rep. Confirm the rep count and phase can update while status is active.
5. Press Pause and move through another rep. Confirm the rep count and phase stay frozen until Resume.
6. Press Finish and move through another rep. Confirm the finished summary, rep count, and phase stay unchanged.

Code guard:

TrackerRuntime.processFrame returns the current snapshot without running SignalProcessor, MovementEngine, SessionEngine, or CoachEngine unless status is active.

Phase 3 verification:

1. Hold still in frame for 10 seconds. Confirm the skeleton overlay stays stable without visible landmark jitter.
2. Move quickly through a supported rep. Confirm the overlay follows the movement without obvious rubber-band lag.
3. Partially cover one wrist mid-rep. Confirm no false rep is counted and the feedback changes to visibility/framing guidance instead of form correction.
4. During an active set, switch tabs for a few seconds and return. Confirm the console has no MediaPipe timestamp errors.
5. Confirm `TRACKER_CONFIG.general.poseDetectionFps` remains capped at 20 fps for detector stability on mid-range devices.
