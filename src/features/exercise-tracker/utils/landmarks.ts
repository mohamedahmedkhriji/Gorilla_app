import type { Connection, NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { PoseLandmark } from '../types/tracking';

export const toPoseLandmarks = (landmarks?: NormalizedLandmark[]) =>
  (landmarks || []).map((landmark, index) => ({
    ...landmark,
    index,
  }));

export const getLandmark = (
  landmarks: PoseLandmark[],
  index: number,
) => landmarks.find((landmark) => landmark.index === index) || null;

export const isLandmarkReliable = (
  landmark: PoseLandmark | null | undefined,
  visibilityThreshold: number,
) =>
  Boolean(
    landmark
    && Number.isFinite(landmark.x)
    && Number.isFinite(landmark.y)
    && Number.isFinite(landmark.z)
    && landmark.visibility >= visibilityThreshold,
  );

export const countVisibleLandmarks = (
  landmarks: PoseLandmark[],
  visibilityThreshold: number,
) =>
  landmarks.reduce(
    (count, landmark) => count + (isLandmarkReliable(landmark, visibilityThreshold) ? 1 : 0),
    0,
  );

export const getRenderableConnections = (
  landmarks: PoseLandmark[],
  connections: Connection[],
  visibilityThreshold: number,
) =>
  connections.filter((connection) => {
    const start = getLandmark(landmarks, connection.start);
    const end = getLandmark(landmarks, connection.end);
    return (
      isLandmarkReliable(start, visibilityThreshold)
      && isLandmarkReliable(end, visibilityThreshold)
    );
  });
