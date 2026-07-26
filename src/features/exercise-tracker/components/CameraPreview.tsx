import React, { RefObject, memo, useEffect, useRef } from 'react';
import { AlertTriangle, Crosshair, EyeOff, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { CameraState, TrackingState } from '../types/tracking';
import { useElementSize } from '../hooks/useElementSize';
import { PoseOverlay } from './PoseOverlay';

interface CameraPreviewProps {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  cameraState: CameraState;
  trackingState: TrackingState;
  onRetry?: () => void;
}

export const CameraPreview = memo(function CameraPreview({
  videoRef,
  canvasRef,
  cameraState,
  trackingState,
  onRetry,
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

  const overlayContent = (() => {
    if (trackingState.status === 'camera-error' || trackingState.status === 'model-error') {
      return {
        icon: AlertTriangle,
        title: trackingState.status === 'camera-error' ? 'Camera unavailable' : 'Pose model unavailable',
        message: trackingState.errorMessage || 'Tracker unavailable.',
        retry: true,
      };
    }

    if (trackingState.status === 'requesting-camera') {
      return {
        icon: Loader2,
        title: 'Requesting camera access',
        message: 'Allow webcam access to start tracking.',
        retry: false,
      };
    }

    if (trackingState.status === 'loading-model') {
      return {
        icon: Loader2,
        title: 'Loading pose model',
        message: 'Preparing MediaPipe pose detection.',
        retry: false,
      };
    }

    if (trackingState.status === 'ready' && trackingState.isCameraReady && trackingState.isModelReady && !trackingState.hasPose) {
      return {
        icon: Loader2,
        title: 'Warming up tracking',
        message: 'Step into frame with shoulders, elbows, and wrists visible.',
        retry: false,
      };
    }

    return null;
  })();

  const framingHint = (() => {
    if (trackingState.status === 'requesting-camera' || trackingState.status === 'loading-model') {
      return { icon: Loader2, label: 'Tracker setup in progress', className: 'border-sky-300/25 bg-sky-400/10 text-sky-50' };
    }
    if (trackingState.isLowConfidence) {
      return { icon: EyeOff, label: 'Low confidence pose detected', className: 'border-amber-300/35 bg-amber-400/12 text-amber-50' };
    }
    if (!trackingState.isCentered) {
      return { icon: Crosshair, label: 'Center your body in frame', className: 'border-orange-300/35 bg-orange-400/12 text-orange-50' };
    }
    return null;
  })();
  const OverlayIcon = overlayContent?.icon;
  const FramingIcon = framingHint?.icon;

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

      {framingHint && FramingIcon ? (
        <div className={`absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${framingHint.className}`}>
          <FramingIcon size={14} className={trackingState.status === 'requesting-camera' || trackingState.status === 'loading-model' ? 'animate-spin' : ''} />
          <span>{framingHint.label}</span>
        </div>
      ) : null}

      {overlayContent && OverlayIcon ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[radial-gradient(circle,rgba(7,12,22,0.7),rgba(4,7,15,0.94))] px-6 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-text-primary">
              <OverlayIcon size={22} className={overlayContent.retry ? '' : 'animate-spin'} />
            </div>
            <div className="text-lg font-semibold text-text-primary">
              {overlayContent.title}
            </div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {overlayContent.message}
            </p>
            {overlayContent.retry && onRetry ? (
              <Button
                type="button"
                variant="secondary"
                fullWidth={false}
                onClick={onRetry}
                className="mx-auto mt-5 px-5"
              >
                <RefreshCw size={16} />
                <span>Retry</span>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
});
