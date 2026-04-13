export type GamificationReasonCode =
  | 'save_streak'
  | 'complete_daily_mission'
  | 'stay_on_plan'
  | 'rank_up_close'
  | 'beat_next_player'
  | 'high_recovery_opportunity'
  | 'weekly_target_at_risk';

export interface GamificationNextAction {
  type: string;
  title: string;
  description: string;
  ctaLabel: string;
  priorityScore: number;
  reasonCode: GamificationReasonCode;
  accent?: string;
  context?: Record<string, unknown>;
}

export interface GamificationReward {
  id: number;
  userRewardId?: number | null;
  name: string;
  rewardType: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  description?: string | null;
  identityKey?: string | null;
  visualVariant?: string | null;
  source: {
    type: string;
    id: number | null;
  };
  status?: string;
  grantedAt?: string | null;
}

export interface GamificationSummaryInsight {
  type?: string;
  tone?: string;
  title: string;
  detail: string;
  value?: string | number | null;
  accent?: string | null;
}

export interface GamificationNotificationTrigger {
  type: string;
  active: boolean;
  priority: number;
  title: string;
  body: string;
  cta?: string | null;
}

export interface GamificationMissionChain {
  chainId: string;
  title: string;
  chainStep: number;
  chainLength: number;
  completedSteps: number;
  percentComplete: number;
  bonusReward?: GamificationReward | null;
}

export interface GamificationMission {
  id: number;
  title: string;
  description?: string | null;
  mission_type?: string | null;
  category?: string | null;
  metric_key?: string | null;
  progress: number;
  target: number;
  remaining: number;
  percentComplete: number;
  nearComplete: boolean;
  status?: string | null;
  xp_reward?: number;
  points_reward?: number;
  chainId?: string | null;
  chainStep?: number | null;
  chainLength?: number | null;
}

export interface GamificationRankProgress {
  current: string;
  next?: string | null;
  currentThreshold: number;
  nextThreshold?: number | null;
  totalPoints: number;
  pointsToNext: number;
  progressPercent: number;
  isCloseToNext?: boolean;
}

export interface GamificationLevelProgress {
  current: string;
  number: number;
  totalXp: number;
  currentXp: number;
  currentThreshold: number;
  nextThreshold?: number | null;
  xpToNext: number;
  progressPercent: number;
}

export interface GamificationRivalry {
  currentRankPosition?: number | null;
  nextPlayerName?: string | null;
  nextPlayerRank?: number | null;
  nextPlayerPoints?: number | null;
  deltaToNextPlayer?: number | null;
  behindPlayerName?: string | null;
  deltaAheadOfBehind?: number | null;
}

export interface GamificationStreakRisk {
  active: boolean;
  title: string;
  description: string;
  recommendedAction?: string | null;
  dailyActivityStreak?: number;
  freezeTokens?: number;
}

export interface GamificationStreaks {
  dailyActivity: number;
  workout: number;
  recovery: number;
  weeklyConsistency: number;
  freezeTokens: number;
  protectedToday: boolean;
  lastActivityDate?: string | null;
  risk?: GamificationStreakRisk | null;
}

export interface GamificationWeeklyProgress {
  periodLabel?: string | null;
  points: number;
  workoutsCompleted: number;
  recoveryLogs?: number;
  target: number;
  remaining: number;
  targetAtRisk: boolean;
  nearComplete: boolean;
  completionPercent: number;
}

export interface GamificationSummaryProgress {
  totalXp: number;
  totalPoints: number;
  level: GamificationLevelProgress | null;
  rank: GamificationRankProgress | null;
  streaks: GamificationStreaks | null;
  weekly: GamificationWeeklyProgress | null;
  nextAction: GamificationNextAction | null;
  rivalry: GamificationRivalry | null;
  summaryInsights: GamificationSummaryInsight[];
  notificationTriggers: GamificationNotificationTrigger[];
}

export interface GamificationLeaderboardEntry {
  userId: number;
  name: string;
  points: number;
  rank: number;
  level: number;
  profilePicture?: string | null;
  rankName?: string | null;
  deltaToNext?: number | null;
  isCurrentUser?: boolean;
}

export interface GamificationSummaryResponse {
  userId?: number;
  progress: GamificationSummaryProgress;
  activeMissionList: GamificationMission[];
  missionChains: GamificationMissionChain[];
  rewardsAvailable: GamificationReward[];
  leaderboardPreview: GamificationLeaderboardEntry[];
  nextAction: GamificationNextAction | null;
  weeklyNarrative: GamificationSummaryInsight[];
  notificationTriggers: GamificationNotificationTrigger[];
  leaderboard?: {
    period?: string;
    currentUser?: GamificationLeaderboardEntry | null;
    rivalry?: GamificationRivalry | null;
    preview?: GamificationLeaderboardEntry[];
  };
}

export interface GamificationDelta {
  eventType?: string | null;
  awarded: boolean;
  xpGained: number;
  pointsGained: number;
  eventXpGained: number;
  missionXpGained: number;
  challengeXpGained: number;
  badgeXpGained: number;
  achievementXpGained: number;
  leveledUp: boolean;
  rankedUp?: boolean;
  previousLevel?: Record<string, unknown> | null;
  currentLevel?: Record<string, unknown> | null;
  nextLevel?: Record<string, unknown> | null;
  previousRank?: string | null;
  currentRank?: string | null;
  streakBonusPercent?: number;
  completedMissions?: Array<Record<string, unknown>>;
  completedChallenges?: Array<Record<string, unknown>>;
  unlockedBadges?: Array<Record<string, unknown>>;
  unlockedAchievements?: Array<Record<string, unknown>>;
  unlockedRewards?: GamificationReward[];
  nextAction?: GamificationNextAction | null;
  notificationTriggers?: Array<Record<string, unknown>>;
  progress?: Record<string, unknown> | null;
}
