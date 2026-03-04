export interface Mission {
  id: string;
  title: string;
  description: string;
  level: 'beginner' | 'medium' | 'advanced';
  points: number;
  progress: number;
  target: number;
  completed: boolean;
  type: 'streak' | 'workouts' | 'weight' | 'volume' | 'consistency';
}

export const MISSIONS_BY_LEVEL = {
  beginner: [
    {
      id: 'beginner_gym_month',
      title: 'First Month Warrior',
      description: 'Go to the gym for 1 month straight',
      level: 'beginner' as const,
      points: 100,
      target: 30,
      type: 'streak' as const,
    },
    {
      id: 'beginner_10_workouts',
      title: 'Getting Started',
      description: 'Complete 10 workouts',
      level: 'beginner' as const,
      points: 50,
      target: 10,
      type: 'workouts' as const,
    },
    {
      id: 'beginner_stick_plan',
      title: 'Plan Follower',
      description: 'Follow your workout plan for 2 weeks',
      level: 'beginner' as const,
      points: 75,
      target: 14,
      type: 'consistency' as const,
    },
  ],
  medium: [
    {
      id: 'medium_50_workouts',
      title: 'Consistent Lifter',
      description: 'Complete 50 workouts',
      level: 'medium' as const,
      points: 100,
      target: 50,
      type: 'workouts' as const,
    },
    {
      id: 'medium_progressive',
      title: 'Progressive Overload Master',
      description: 'Increase weight 20 times',
      level: 'medium' as const,
      points: 150,
      target: 20,
      type: 'weight' as const,
    },
    {
      id: 'medium_volume',
      title: 'Volume King',
      description: 'Lift 100,000 lbs total',
      level: 'medium' as const,
      points: 100,
      target: 100000,
      type: 'volume' as const,
    },
  ],
  advanced: [
    {
      id: 'advanced_100_workouts',
      title: 'Gym Legend',
      description: 'Complete 100 workouts',
      level: 'advanced' as const,
      points: 200,
      target: 100,
      type: 'workouts' as const,
    },
    {
      id: 'advanced_heavy',
      title: 'Heavy Lifter',
      description: 'Lift 500 lbs in a single exercise',
      level: 'advanced' as const,
      points: 150,
      target: 500,
      type: 'weight' as const,
    },
    {
      id: 'advanced_volume',
      title: 'Volume Beast',
      description: 'Lift 500,000 lbs total',
      level: 'advanced' as const,
      points: 200,
      target: 500000,
      type: 'volume' as const,
    },
  ],
};

export const SUBSCRIPTION_POINTS = {
  '1 Month': { monthly: 5, bonus: 0, total: 5 },
  '3 Months': { monthly: 5, bonus: 20, total: 35 },
  '6 Months': { monthly: 5, bonus: 50, total: 80 },
  '1 Year': { monthly: 5, bonus: 100, total: 160 },
};

// Keep rank tiers consistent with backend (server/routes.js).
export const RANK_BADGES = {
  0: { name: 'Bronze', emoji: 'B', minPoints: 0 },
  150: { name: 'Silver', emoji: 'S', minPoints: 150 },
  400: { name: 'Gold', emoji: 'G', minPoints: 400 },
  800: { name: 'Platinum', emoji: 'P', minPoints: 800 },
  1400: { name: 'Diamond', emoji: 'D', minPoints: 1400 },
  2200: { name: 'Elite', emoji: 'E', minPoints: 2200 },
};

export function getUserRankBadge(points: number) {
  const ranks = Object.entries(RANK_BADGES).reverse();
  for (const [threshold, badge] of ranks) {
    if (points >= parseInt(threshold, 10)) {
      return badge;
    }
  }
  return RANK_BADGES[0];
}

export function getUserMissions(userLevel: 'beginner' | 'medium' | 'advanced', userStats: any): Mission[] {
  const missions = MISSIONS_BY_LEVEL[userLevel];

  return missions.map((mission) => {
    let progress = 0;

    switch (mission.type) {
      case 'workouts':
        progress = userStats.totalWorkouts || 0;
        break;
      case 'streak':
        progress = userStats.currentStreak || 0;
        break;
      case 'weight':
        progress = userStats.progressiveOverloads || 0;
        break;
      case 'volume':
        progress = userStats.totalVolume || 0;
        break;
      case 'consistency':
        progress = userStats.planFollowDays || 0;
        break;
      default:
        progress = 0;
        break;
    }

    return {
      ...mission,
      progress,
      completed: progress >= mission.target,
    };
  });
}
