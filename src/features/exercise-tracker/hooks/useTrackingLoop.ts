import { useEffect, useRef } from 'react';

interface UseTrackingLoopArgs {
  enabled: boolean;
  onTick: (timestampMs: number) => void;
  targetFps: number;
}

export function useTrackingLoop({
  enabled,
  onTick,
  targetFps,
}: UseTrackingLoopArgs) {
  const frameRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const onTickRef = useRef(onTick);

  onTickRef.current = onTick;

  useEffect(() => {
    if (!enabled) {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastTickRef.current = 0;
      return undefined;
    }

    let cancelled = false;
    const minFrameMs = 1000 / Math.max(1, targetFps);

    const loop = (timestampMs: number) => {
      if (cancelled) return;

      frameRef.current = window.requestAnimationFrame(loop);

      if (
        lastTickRef.current !== 0
        && timestampMs - lastTickRef.current < minFrameMs
      ) {
        return;
      }

      lastTickRef.current = timestampMs;
      onTickRef.current(timestampMs);
    };

    frameRef.current = window.requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastTickRef.current = 0;
    };
  }, [enabled, targetFps]);
}
