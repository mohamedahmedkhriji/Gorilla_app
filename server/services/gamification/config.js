/* eslint-env node */

export const GAMIFICATION_CONFIG = {
  nearCompletion: {
    missionPercent: 80,
    missionUrgentPercent: 90,
    weeklyTargetPercent: 80,
    weeklyAlmostDonePercent: 90,
    rankPointsThreshold: 30,
  },
  rivalry: {
    closeDeltaPoints: 20,
    urgentDeltaPoints: 12,
    previewLimit: 8,
  },
  streaks: {
    urgentAtDays: 3,
    maxLookbackDays: 45,
    maxLookbackWeeks: 16,
  },
  weeklyTargets: {
    fallbackWorkouts: 4,
    riskStartWeekday: 4,
  },
  missionChains: {
    defaultBonusXp: 40,
    defaultBonusPoints: 20,
  },
  points: {
    blogPostUpload: 20,
  },
};

export const XP_RULES = Object.freeze({
  workout: 40,
  planned_workout: 60,
  sleep: 8,
  hydration: 8,
  nutrition: 10,
  mission_complete: 50,
  challenge_complete: 50,
  challenge_win: 80,
  program_week: 75,
  program_complete: 250,
  badge_unlock: 0,
  achievement_unlock: 0,
  level_up: 0,
  progress_photo: 20,
  share: 10,
  referral: 100,
  pr: 35,
  manual_adjustment: 0,
});

export const POINT_RULES = Object.freeze({
  workout_completed: 0,
  planned_workout_completed: 0,
  recovery_checkin: 0,
  mission_complete: 0,
  challenge_complete: 0,
  challenge_win: 0,
});

export const STREAK_MULTIPLIERS = Object.freeze([
  { minDays: 30, multiplier: 1.35 },
  { minDays: 7, multiplier: 1.2 },
  { minDays: 3, multiplier: 1.1 },
]);

export const RANK_TIERS = Object.freeze([
  { name: 'Bronze', minPoints: 0 },
  { name: 'Silver', minPoints: 150 },
  { name: 'Gold', minPoints: 400 },
  { name: 'Platinum', minPoints: 800 },
  { name: 'Diamond', minPoints: 1400 },
  { name: 'Elite', minPoints: 2200 },
]);

export const REWARD_RARITY_BY_TYPE = Object.freeze({
  xp_boost: 'rare',
  profile_frame: 'rare',
  title: 'epic',
  avatar_item: 'common',
  challenge_ticket: 'rare',
  discount: 'common',
  premium_days: 'epic',
  coach_message: 'rare',
  feature_unlock: 'epic',
  cosmetic: 'common',
});

export const NOTIFICATION_TRIGGER_TYPES = Object.freeze([
  'streak_risk',
  'mission_near_complete',
  'rank_almost_reached',
  'rivalry_pressure',
  'weekly_summary',
]);

export const REASON_CODES = Object.freeze([
  'save_streak',
  'complete_daily_mission',
  'stay_on_plan',
  'rank_up_close',
  'beat_next_player',
  'high_recovery_opportunity',
  'weekly_target_at_risk',
]);

export const toFiniteNumber = (value, fallback = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value || 0)));

export const formatDateISO = (date) => {
  const normalized = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(normalized.getTime())) return '';
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const day = String(normalized.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getStartOfDay = (date = new Date()) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export const getEndOfDay = (date = new Date()) => {
  const normalized = new Date(date);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
};

export const getStartOfWeek = (date = new Date()) => {
  const normalized = getStartOfDay(date);
  const day = (normalized.getDay() + 6) % 7;
  normalized.setDate(normalized.getDate() - day);
  return normalized;
};

export const getEndOfWeek = (date = new Date()) => {
  const normalized = getStartOfWeek(date);
  normalized.setDate(normalized.getDate() + 6);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
};

export const getPreviousWeekRange = (date = new Date()) => {
  const currentWeekStart = getStartOfWeek(date);
  const previousWeekEnd = new Date(currentWeekStart);
  previousWeekEnd.setMilliseconds(previousWeekEnd.getMilliseconds() - 1);
  const previousWeekStart = getStartOfWeek(previousWeekEnd);
  return {
    start: previousWeekStart,
    end: previousWeekEnd,
  };
};

export const getRankFromPoints = (points = 0) => {
  const normalized = Math.max(0, Math.round(toFiniteNumber(points, 0)));
  const matched = [...RANK_TIERS].reverse().find((tier) => normalized >= tier.minPoints);
  return matched?.name || RANK_TIERS[0].name;
};

export const getCurrentRankTier = (points = 0) => {
  const normalized = Math.max(0, Math.round(toFiniteNumber(points, 0)));
  return [...RANK_TIERS].reverse().find((tier) => normalized >= tier.minPoints) || RANK_TIERS[0];
};

export const getNextRankInfo = (points = 0) => {
  const normalized = Math.max(0, Math.round(toFiniteNumber(points, 0)));
  const current = getCurrentRankTier(normalized);
  const next = RANK_TIERS.find((tier) => tier.minPoints > current.minPoints && normalized < tier.minPoints);
  if (!next) {
    return {
      name: null,
      minPoints: null,
      pointsNeeded: 0,
      progressPercent: 100,
    };
  }

  const denominator = Math.max(1, next.minPoints - current.minPoints);
  const progressPercent = clamp(((normalized - current.minPoints) / denominator) * 100, 0, 100);
  return {
    name: next.name,
    minPoints: next.minPoints,
    pointsNeeded: Math.max(0, next.minPoints - normalized),
    progressPercent,
  };
};

export const getRankProgress = (points = 0) => {
  const normalized = Math.max(0, Math.round(toFiniteNumber(points, 0)));
  const current = getCurrentRankTier(normalized);
  const next = getNextRankInfo(normalized);
  return {
    current: current.name,
    currentThreshold: current.minPoints,
    totalPoints: normalized,
    next: next.name,
    nextThreshold: next.minPoints,
    pointsToNext: next.pointsNeeded,
    progressPercent: next.progressPercent,
    isCloseToNext: next.name != null && next.pointsNeeded <= GAMIFICATION_CONFIG.nearCompletion.rankPointsThreshold,
  };
};

export const getLevelProgress = (summary) => {
  const totalXp = Math.max(0, Math.round(toFiniteNumber(summary?.totalXp, 0)));
  const currentLevel = summary?.currentLevel || null;
  const nextLevel = summary?.nextLevel || null;
  const currentFloor = Math.max(0, Math.round(toFiniteNumber(currentLevel?.xpRequired, 0)));
  const nextTarget = nextLevel?.xpRequired == null
    ? null
    : Math.max(currentFloor, Math.round(toFiniteNumber(nextLevel?.xpRequired, currentFloor)));

  if (nextTarget == null || nextTarget <= currentFloor) {
    return {
      totalXp,
      currentLevel,
      nextLevel,
      currentXp: Math.max(0, totalXp - currentFloor),
      nextLevelXp: null,
      progressPercent: 100,
      xpToNextLevel: 0,
    };
  }

  const denominator = Math.max(1, nextTarget - currentFloor);
  return {
    totalXp,
    currentLevel,
    nextLevel,
    currentXp: Math.max(0, totalXp - currentFloor),
    nextLevelXp: nextTarget - currentFloor,
    progressPercent: clamp(((totalXp - currentFloor) / denominator) * 100, 0, 100),
    xpToNextLevel: Math.max(0, nextTarget - totalXp),
  };
};

export const getWeekdayIndex = (date = new Date()) => {
  const normalized = new Date(date);
  if (Number.isNaN(normalized.getTime())) return 0;
  return (normalized.getDay() + 6) % 7;
};

export const buildWeeklyTargetState = ({
  completed = 0,
  target = GAMIFICATION_CONFIG.weeklyTargets.fallbackWorkouts,
  date = new Date(),
} = {}) => {
  const normalizedCompleted = Math.max(0, Math.round(toFiniteNumber(completed, 0)));
  const normalizedTarget = Math.max(1, Math.round(toFiniteNumber(target, GAMIFICATION_CONFIG.weeklyTargets.fallbackWorkouts)));
  const completionPercent = clamp((normalizedCompleted / normalizedTarget) * 100, 0, 100);
  const weekdayIndex = getWeekdayIndex(date);
  const remaining = Math.max(0, normalizedTarget - normalizedCompleted);

  return {
    target: normalizedTarget,
    completed: normalizedCompleted,
    remaining,
    completionPercent,
    almostDone: completionPercent >= GAMIFICATION_CONFIG.nearCompletion.weeklyAlmostDonePercent,
    targetAtRisk:
      weekdayIndex >= GAMIFICATION_CONFIG.weeklyTargets.riskStartWeekday
      && completionPercent < GAMIFICATION_CONFIG.nearCompletion.weeklyTargetPercent,
  };
};
