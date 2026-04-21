import type { CoachStatus } from '../types/tracking';

export interface FeedbackSample {
  status: CoachStatus;
  message: string;
  timestampMs: number;
}

const STATUS_PRIORITY: CoachStatus[] = ['warning', 'bad', 'good', 'idle'];

export const pushFeedbackSample = (
  samples: FeedbackSample[],
  next: FeedbackSample,
  maxSize: number,
) => [...samples, next].slice(-Math.max(1, maxSize));

export const resolveBufferedFeedback = (
  samples: FeedbackSample[],
  fallback: FeedbackSample,
): FeedbackSample => {
  if (!samples.length) {
    return fallback;
  }

  const dominantStatus = STATUS_PRIORITY
    .map((status) => {
      const matches = samples.filter((sample) => sample.status === status);
      return {
        status,
        count: matches.length,
        latestTimestamp: matches[matches.length - 1]?.timestampMs ?? -1,
      };
    })
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return right.latestTimestamp - left.latestTimestamp;
    })[0]?.status ?? fallback.status;

  const dominantSamples = samples.filter((sample) => sample.status === dominantStatus);
  const dominantMessage = [...new Set(dominantSamples.map((sample) => sample.message))]
    .map((message) => {
      const matches = dominantSamples.filter((sample) => sample.message === message);
      return {
        message,
        count: matches.length,
        latestTimestamp: matches[matches.length - 1]?.timestampMs ?? -1,
      };
    })
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return right.latestTimestamp - left.latestTimestamp;
    })[0]?.message ?? fallback.message;

  const latestMatch = [...dominantSamples]
    .reverse()
    .find((sample) => sample.message === dominantMessage);

  return {
    status: dominantStatus,
    message: dominantMessage,
    timestampMs: latestMatch?.timestampMs ?? fallback.timestampMs,
  };
};
