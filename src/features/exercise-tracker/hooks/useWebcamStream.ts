import { useEffect, useRef, useState } from 'react';
import { CAMERA_CONSTRAINTS } from '../logic/constants';
import type { CameraState } from '../types/tracking';

const createIdleCameraState = (): CameraState => ({
  status: 'idle',
  errorMessage: null,
  videoWidth: 0,
  videoHeight: 0,
  isMirrored: true,
});

const getCameraErrorMessage = (error: unknown) => {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Camera permission was denied. Allow webcam access and try again.';
    }
    if (error.name === 'NotFoundError') {
      return 'No camera was found on this device.';
    }
    if (error.name === 'NotReadableError') {
      return 'The camera is already in use by another application.';
    }
  }

  return 'Unable to open the webcam feed.';
};

export function useWebcamStream(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>(createIdleCameraState);

  useEffect(() => {
    const stopStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    };

    if (!enabled) {
      stopStream();
      setCameraState(createIdleCameraState());
      return undefined;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState({
        ...createIdleCameraState(),
        status: 'error',
        errorMessage: 'This browser does not support webcam access.',
      });
      return undefined;
    }

    let cancelled = false;

    const startStream = async () => {
      setCameraState({
        ...createIdleCameraState(),
        status: 'requesting',
      });

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: CAMERA_CONSTRAINTS,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const videoElement = videoRef.current;
        if (!videoElement) {
          setCameraState({
            ...createIdleCameraState(),
            status: 'error',
            errorMessage: 'Camera preview element is unavailable.',
          });
          return;
        }

        const commitReadyState = () => {
          if (cancelled) return;

          const videoWidth = videoElement.videoWidth || 0;
          const videoHeight = videoElement.videoHeight || 0;
          if (!videoWidth || !videoHeight) {
            return;
          }

          setCameraState({
            status: 'ready',
            errorMessage: null,
            videoWidth,
            videoHeight,
            isMirrored: true,
          });
        };

        videoElement.srcObject = stream;
        videoElement.playsInline = true;
        videoElement.muted = true;

        const handleLoadedMetadata = () => {
          void videoElement.play()
            .then(() => {
              commitReadyState();
            })
            .catch(() => {
              commitReadyState();
            });
        };

        videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
        videoElement.addEventListener('resize', commitReadyState);

        const detachListeners = () => {
          videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
          videoElement.removeEventListener('resize', commitReadyState);
        };

        if (videoElement.readyState >= HTMLMediaElement.HAVE_METADATA) {
          handleLoadedMetadata();
        }

        if (cancelled) {
          detachListeners();
          return undefined;
        }

        return () => {
          detachListeners();
        };
      } catch (error) {
        if (!cancelled) {
          setCameraState({
            ...createIdleCameraState(),
            status: 'error',
            errorMessage: getCameraErrorMessage(error),
          });
        }
      }

      return undefined;
    };

    let detachVideoListeners: (() => void) | undefined;

    void startStream().then((cleanup) => {
      detachVideoListeners = cleanup;
    });

    return () => {
      cancelled = true;
      detachVideoListeners?.();
      stopStream();
    };
  }, [enabled]);

  return {
    videoRef,
    cameraState,
  };
}
