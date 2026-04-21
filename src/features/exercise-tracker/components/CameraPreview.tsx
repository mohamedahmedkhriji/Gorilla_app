import React, { RefObject, memo, useEffect, useRef } from 'react';
import type { CameraState, TrackingState } from '../types/tracking';
import { useElementSize } from '../hooks/useElementSize';
import { PoseOverlay } from './PoseOverlay';

interface CameraPreviewProps {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  cameraState: CameraState;
  trackingState: TrackingState;
}

export const CameraPreview = memo(function CameraPreview({
  videoRef,
  canvasRef,
  cameraState,
  trackingState,
}: CameraPreviewProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const size = useElementSize(stageRef);
  const aspectRatio = cameraState.videoWidth > 0 && cameraState.videoHeight > 0
    ? `${cameraState.videoWidth} / ${cameraState.videoHeight}`
    : '4 / 5';
  const mirrorClass = cameraState.isMirrored ? '-scale-x-100' : '';

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement || !size.width || !size.height) return;

    const context = canvasElement.getContext('2d');
    const pixelRatio = window.devicePixelRatio || 1;

    canvasElement.width = Math.round(size.width * pixelRatio);
    canvasElement.height = Math.round(size.height * pixelRatio);
    canvasElement.style.width = `${size.width}px`;
    canvasElement.style.height = `${size.height}px`;

    if (context) {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }
  }, [canvasRef, size.height, size.width]);

  const overlayTitle = cameraState.status === 'requesting'
    ? 'Waiting for camera access'
    : !trackingState.isModelReady
      ? 'Preparing tracker'
      : null;

  return (
    <div
      ref={stageRef}
      className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(191,255,0,0.08),transparent_34%),linear-gradient(180deg,#0a101a_0%,#05080e_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0)_34%,rgba(0,0,0,0.38)_100%)]" />

      <div className="w-full" style={{ aspectRatio }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`absolute inset-0 h-full w-full object-contain ${mirrorClass}`}
        />
        <PoseOverlay canvasRef={canvasRef} isMirrored={cameraState.isMirrored} />
      </div>

      {overlayTitle && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[radial-gradient(circle,rgba(7,12,22,0.7),rgba(4,7,15,0.94))] px-6 text-center">
          <div className="max-w-sm">
            <div className="text-lg font-semibold text-text-primary">
              {overlayTitle}
            </div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {cameraState.status === 'requesting'
                ? 'Allow webcam access to start tracking.'
                : 'Loading pose detection and warming up the overlay.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});
