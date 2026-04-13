/* eslint-env node */

import { XP_RULES } from './config.js';

export const SOURCE_TYPE_TO_EVENT_TYPE = Object.freeze({
  workout: 'workout_completed',
  planned_workout: 'planned_workout_completed',
  sleep: 'recovery_checkin',
  hydration: 'hydration_logged',
  nutrition: 'nutrition_logged',
  mission_complete: 'mission_complete',
  challenge_complete: 'challenge_complete',
  challenge_win: 'challenge_win',
  program_week: 'program_week',
  program_complete: 'program_complete',
  badge_unlock: 'badge_unlock',
  achievement_unlock: 'achievement_unlock',
  level_up: 'level_up',
  progress_photo: 'progress_photo_uploaded',
  share: 'share_completed',
  referral: 'referral_completed',
  pr: 'personal_record',
  manual_adjustment: 'manual_adjustment',
});

export const SUPPORTED_EVENT_SOURCE_TYPES = new Set(Object.keys(XP_RULES));

export const normalizeEventSourceType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || null;
};

export const isSupportedGamificationEventSource = (value) =>
  SUPPORTED_EVENT_SOURCE_TYPES.has(normalizeEventSourceType(value));

export const getGamificationEventTypeForSource = (value) => {
  const normalized = normalizeEventSourceType(value);
  if (!normalized) return null;
  return SOURCE_TYPE_TO_EVENT_TYPE[normalized] || null;
};

export const validateGamificationEventInput = ({
  userId,
  eventSourceType = null,
  eventSourceId = null,
} = {}) => {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return {
      valid: false,
      error: 'Invalid userId',
      normalizedUserId: 0,
      normalizedEventSourceType: null,
      normalizedEventSourceId: null,
    };
  }

  const normalizedEventSourceType = normalizeEventSourceType(eventSourceType);
  const normalizedEventSourceId = eventSourceId == null ? null : Math.floor(Number(eventSourceId || 0));

  if (normalizedEventSourceType && !isSupportedGamificationEventSource(normalizedEventSourceType)) {
    return {
      valid: false,
      error: `Unsupported eventSourceType: ${normalizedEventSourceType}`,
      normalizedUserId,
      normalizedEventSourceType: null,
      normalizedEventSourceId,
    };
  }

  return {
    valid: true,
    error: null,
    normalizedUserId,
    normalizedEventSourceType,
    normalizedEventSourceId: Number.isInteger(normalizedEventSourceId) && normalizedEventSourceId > 0
      ? normalizedEventSourceId
      : null,
  };
};
