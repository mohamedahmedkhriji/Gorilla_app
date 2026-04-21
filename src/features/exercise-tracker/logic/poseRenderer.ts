import { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseLandmark } from '../types/tracking';
import { TRACKER_CONFIG } from './trackerConfig';
import { getLandmark, getRenderableConnections, isLandmarkReliable } from '../utils/landmarks';

const getCanvasContext = (canvas: HTMLCanvasElement | null) => canvas?.getContext('2d') || null;

export const clearCanvas = (canvas: HTMLCanvasElement | null) => {
  const context = getCanvasContext(canvas);
  if (!context || !canvas) return;

  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || canvas.height;
  context.clearRect(0, 0, width, height);
};

export const drawPoseOverlay = (
  canvas: HTMLCanvasElement | null,
  landmarks: PoseLandmark[],
) => {
  const context = getCanvasContext(canvas);
  if (!context || !canvas) return;

  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || canvas.height;

  context.clearRect(0, 0, width, height);

  if (!landmarks.length) return;

  const connections = getRenderableConnections(
    landmarks,
    PoseLandmarker.POSE_CONNECTIONS,
    TRACKER_CONFIG.general.minLandmarkVisibility,
  );

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = 'rgba(191, 255, 0, 0.9)';
  context.lineWidth = 3;
  context.shadowColor = 'rgba(191, 255, 0, 0.25)';
  context.shadowBlur = 14;

  connections.forEach((connection) => {
    const start = getLandmark(landmarks, connection.start);
    const end = getLandmark(landmarks, connection.end);
    if (!start || !end) return;

    context.beginPath();
    context.moveTo(start.x * width, start.y * height);
    context.lineTo(end.x * width, end.y * height);
    context.stroke();
  });

  context.shadowBlur = 0;

  landmarks.forEach((landmark) => {
    if (!isLandmarkReliable(landmark, TRACKER_CONFIG.general.minLandmarkVisibility)) return;

    const radius = landmark.index <= 10 ? 3.25 : 4.2;
    context.beginPath();
    context.fillStyle = 'rgba(10, 16, 28, 0.92)';
    context.arc(landmark.x * width, landmark.y * height, radius + 1.6, 0, Math.PI * 2);
    context.fill();

    context.beginPath();
    context.fillStyle = 'rgba(191, 255, 0, 0.95)';
    context.arc(landmark.x * width, landmark.y * height, radius, 0, Math.PI * 2);
    context.fill();
  });

  context.restore();
};
