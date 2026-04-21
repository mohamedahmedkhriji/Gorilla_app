import React, { RefObject, memo } from 'react';

interface PoseOverlayProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  isMirrored?: boolean;
}

export const PoseOverlay = memo(function PoseOverlay({
  canvasRef,
  isMirrored = true,
}: PoseOverlayProps) {
  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${isMirrored ? '-scale-x-100' : ''}`}
    />
  );
});
