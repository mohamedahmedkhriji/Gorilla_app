export type SelectOption = {
  value: string;
  label: string;
};

export type SimpleOption = {
  value: string;
  label: string;
};

export type MotivationOption = {
  id: string;
  title: string;
  description: string;
};

export type AthleteSubItem = {
  id: string;
  label: string;
};

export type AthleteSubGroup = {
  id: string;
  title: string;
  items: AthleteSubItem[];
};

export type AthleteOption = {
  id: string;
  label: string;
  description: string;
  iconKey?: string;
  iconUrl?: string;
  category: 'fitness' | 'athlete_sports';
  subGroups: AthleteSubGroup[];
};

export type GoalOption = {
  id: string;
  title: string;
  description: string;
  tag?: string;
  goalValue: 'Build Muscle' | 'General Fitness' | 'Endurance' | 'Strength';
};

export type SplitOption = {
  id: string;
  title: string;
  summary: string;
  detail: string;
  days: number[];
};

export type PlanOption = {
  id: string;
  title: string;
  description: string;
};

export type WorkoutDaysRange = {
  min: number;
  max: number;
  defaultValue?: number;
  labels?: number[];
};

export const ONBOARDING_STEP_IDS = [
  'welcome',
  'language',
  'first_name',
  'app_motivation',
  'athlete_identity',
  'personal_info',
  'fitness_background',
  'fitness_goals',
  'body_type',
  'goals_availability',
  'workout_split',
  'ai_plan_tuning',
  'body_image_upload',
  'ai_analysis',
  'body_results',
  'custom_plan',
  'custom_plan_builder',
  'custom_plan_templates',
  'custom_plan_advice',
  'sport_age_gender',
  'sport_experience',
  'sport_plan_choice',
] as const;

export type OnboardingStepId = typeof ONBOARDING_STEP_IDS[number];

export type OnboardingTrack = 'bodybuilding' | 'sport';

export type OnboardingStepMeta = {
  title?: string;
  showBack?: boolean;
  showHeader?: boolean;
  showProgress?: boolean;
};

export type OnboardingConfig = {
  version: number;
  trackMap: {
    bodybuilding: string[];
    defaultTrack?: OnboardingTrack;
  };
  steps: {
    intro: OnboardingStepId[];
    bodybuilding: OnboardingStepId[];
    sport: OnboardingStepId[];
    branchBySplit: {
      custom: OnboardingStepId[];
      aiBodybuilding: OnboardingStepId[];
      aiSport: OnboardingStepId[];
    };
  };
  stepMeta: Record<OnboardingStepId, OnboardingStepMeta>;
  stepMetaByTrack?: Partial<Record<OnboardingTrack, Partial<Record<OnboardingStepId, OnboardingStepMeta>>>>;
  splitRecommendations?: Record<string, string>;
  options: {
    appMotivation: MotivationOption[];
    athleteIdentity: AthleteOption[];
    athleteIdentityGroupLimits: Record<string, number>;
    fitnessGoals: GoalOption[];
    workoutSplit: SplitOption[];
    sportPlan: PlanOption[];
    aiTrainingFocus: SimpleOption[];
    aiRecoveryPriority: SimpleOption[];
    genders: SelectOption[];
    sessionDurations: SelectOption[];
    preferredTimes: SelectOption[];
    workoutDaysRange: WorkoutDaysRange;
  };
};

export const DEFAULT_ONBOARDING_CONFIG: OnboardingConfig = {
  version: 1,
  trackMap: {
    bodybuilding: ['bodybuilding', 'cardio'],
    defaultTrack: 'sport',
  },
  steps: {
    intro: ['welcome', 'language', 'first_name', 'personal_info', 'app_motivation', 'athlete_identity'],
    bodybuilding: [
      'fitness_background',
      'goals_availability',
      'workout_split',
    ],
    sport: ['sport_age_gender', 'sport_experience', 'sport_plan_choice'],
    branchBySplit: {
      custom: ['custom_plan', 'custom_plan_builder'],
      aiBodybuilding: ['ai_plan_tuning', 'body_image_upload', 'ai_analysis', 'body_results'],
      aiSport: ['ai_analysis', 'body_results'],
    },
  },
  stepMeta: {
    welcome: { title: '', showBack: false, showProgress: false },
    language: { title: 'Choose Language' },
    first_name: { title: 'Your Name' },
    app_motivation: { title: 'Your Goal' },
    athlete_identity: { title: 'Training Identity' },
    personal_info: { title: 'Body Basics' },
    fitness_background: { title: 'Current Level' },
    fitness_goals: { title: 'Training Goal' },
    body_type: { title: 'Body Type' },
    goals_availability: { title: 'Your Schedule' },
    workout_split: { title: 'Your Program' },
    ai_plan_tuning: { title: 'AI Preferences' },
    body_image_upload: { title: 'Body Scan (Optional)' },
    ai_analysis: { title: 'Building Your Plan', showBack: false },
    body_results: { title: 'Your Program', showBack: false, showHeader: false, showProgress: false },
    custom_plan: { title: 'Customize Plan' },
    custom_plan_builder: { title: 'Plan Templates' },
    custom_plan_templates: { title: 'Plan Templates', showBack: false },
    custom_plan_advice: { title: 'AI Advice', showBack: false },
    sport_age_gender: { title: 'Age & Gender' },
    sport_experience: { title: 'Sports Experience' },
    sport_plan_choice: { title: 'Plan Selection' },
  },
  stepMetaByTrack: {
    sport: {
      custom_plan: { title: 'Generate Plan' },
    },
  },
  splitRecommendations: {
    '2': 'full_body',
    '3': 'full_body',
    '4': 'upper_lower',
    '5': 'push_pull_legs',
    '6': 'push_pull_legs',
  },
  options: {
    appMotivation: [
      {
        id: 'guided_start',
        title: 'I want a clear plan',
        description: 'Tell me exactly what to do each session.',
      },
      {
        id: 'consistency',
        title: 'I want consistency',
        description: 'Build a routine I can stick to.',
      },
      {
        id: 'progress_plateau',
        title: 'I want better progress',
        description: 'Break plateaus with smarter programming.',
      },
      {
        id: 'time_efficiency',
        title: 'I need efficient sessions',
        description: 'Short, focused workouts that fit my time.',
      },
      {
        id: 'accountability',
        title: 'I want accountability',
        description: 'Keep me on track week to week.',
      },
    ],
    athleteIdentity: [
      {
        id: 'bodybuilding',
        label: 'Bodybuilding',
        description: 'Build muscle size, symmetry, and physique-focused strength.',
        iconKey: 'bodybuilding',
        category: 'fitness',
        subGroups: [
          {
            id: 'bodybuilding_category',
            title: 'By Category',
            items: [
              { id: 'hypertrophy', label: 'Hypertrophy' },
              { id: 'powerlifting', label: 'Powerlifting' },
              { id: 'cutting', label: 'Cutting' },
              { id: 'bulking', label: 'Bulking' },
              { id: 'beginner_gym', label: 'Beginner gym' },
              { id: 'natural_athlete', label: 'Natural athlete' },
              { id: 'classic_physique', label: 'Classic physique' },
            ],
          },
        ],
      },
      {
        id: 'cardio',
        label: 'Cardio',
        description: 'Improve endurance, calorie burn, and overall conditioning.',
        iconKey: 'cardio',
        category: 'fitness',
        subGroups: [
          {
            id: 'cardio_goal',
            title: 'By Focus',
            items: [
              { id: 'fat_loss', label: 'Fat loss' },
              { id: 'endurance', label: 'Endurance' },
              { id: 'conditioning', label: 'Conditioning' },
              { id: 'heart_health', label: 'Heart health' },
            ],
          },
        ],
      },
      {
        id: 'football',
        label: 'Football',
        description: 'Improve speed, agility, power, and match endurance.',
        iconKey: 'football',
        category: 'athlete_sports',
        subGroups: [
          {
            id: 'football_position',
            title: 'By Position',
            items: [
              { id: 'striker', label: 'Striker' },
              { id: 'winger', label: 'Winger' },
              { id: 'midfielder', label: 'Midfielder' },
              { id: 'defender', label: 'Defender' },
              { id: 'goalkeeper', label: 'Goalkeeper' },
            ],
          },
          {
            id: 'football_goal',
            title: 'By Training Goal',
            items: [
              { id: 'speed_acceleration', label: 'Speed & acceleration' },
              { id: 'match_endurance', label: 'Match endurance' },
              { id: 'shooting_power', label: 'Shooting power' },
              { id: 'injury_prevention', label: 'Injury prevention' },
              { id: 'strength_duels', label: 'Strength & duels' },
            ],
          },
          {
            id: 'football_phase',
            title: 'By Season Phase (VERY PRO FEATURE)',
            items: [
              { id: 'pre_season', label: 'Pre-season' },
              { id: 'in_season', label: 'In-season' },
              { id: 'off_season', label: 'Off-season' },
            ],
          },
        ],
      },
      {
        id: 'basketball',
        label: 'Basketball',
        description: 'Train explosiveness, vertical power, and court conditioning.',
        iconKey: 'basketball',
        category: 'athlete_sports',
        subGroups: [
          {
            id: 'basketball_role',
            title: 'By Role',
            items: [
              { id: 'guard', label: 'Guard' },
              { id: 'forward', label: 'Forward' },
              { id: 'center', label: 'Center' },
            ],
          },
          {
            id: 'basketball_goal',
            title: 'By Goal',
            items: [
              { id: 'vertical_jump', label: 'Vertical jump' },
              { id: 'explosive_speed', label: 'Explosive speed' },
              { id: 'lateral_agility', label: 'Lateral agility' },
              { id: 'knee_injury_prevention', label: 'Knee injury prevention' },
              { id: 'core_stability', label: 'Core stability' },
            ],
          },
          {
            id: 'basketball_phase',
            title: 'By Phase',
            items: [
              { id: 'pre_season', label: 'Pre-season' },
              { id: 'in_season', label: 'In-season' },
              { id: 'off_season', label: 'Off-season' },
            ],
          },
        ],
      },
      {
        id: 'handball',
        label: 'Handball',
        description: 'Boost rotational power, acceleration, and repeat stamina.',
        iconKey: 'handball',
        category: 'athlete_sports',
        subGroups: [
          {
            id: 'handball_position',
            title: 'By Position',
            items: [
              { id: 'wing', label: 'Wing' },
              { id: 'backcourt', label: 'Backcourt' },
              { id: 'pivot', label: 'Pivot' },
              { id: 'goalkeeper', label: 'Goalkeeper' },
            ],
          },
          {
            id: 'handball_goal',
            title: 'By Goal',
            items: [
              { id: 'throwing_power', label: 'Throwing power' },
              { id: 'jump_explosiveness', label: 'Jump explosiveness' },
              { id: 'shoulder_strength', label: 'Shoulder strength' },
              { id: 'sprint_endurance', label: 'Sprint endurance' },
            ],
          },
          {
            id: 'handball_phase',
            title: 'By Phase',
            items: [
              { id: 'pre_season', label: 'Pre-season' },
              { id: 'in_season', label: 'In-season' },
              { id: 'off_season', label: 'Off-season' },
            ],
          },
        ],
      },
      {
        id: 'swimming',
        label: 'Swimming',
        description: 'Develop full-body endurance, lung capacity, and control.',
        iconKey: 'swimming',
        category: 'athlete_sports',
        subGroups: [
          {
            id: 'swimming_stroke',
            title: 'By Stroke',
            items: [
              { id: 'freestyle', label: 'Freestyle' },
              { id: 'breaststroke', label: 'Breaststroke' },
              { id: 'butterfly', label: 'Butterfly' },
              { id: 'backstroke', label: 'Backstroke' },
            ],
          },
          {
            id: 'swimming_goal',
            title: 'By Goal',
            items: [
              { id: 'shoulder_mobility', label: 'Shoulder mobility' },
              { id: 'core_endurance', label: 'Core endurance' },
              { id: 'breathing_capacity', label: 'Breathing capacity' },
              { id: 'technique_strength', label: 'Technique strength' },
            ],
          },
          {
            id: 'swimming_phase',
            title: 'By Phase',
            items: [
              { id: 'conditioning_phase', label: 'Conditioning phase' },
              { id: 'competition_phase', label: 'Competition phase' },
              { id: 'recovery_phase', label: 'Recovery phase' },
            ],
          },
        ],
      },
      {
        id: 'combat_sports',
        label: 'Combat sports',
        description: 'Build conditioning, reaction speed, and functional power.',
        iconKey: 'combat_sports',
        category: 'athlete_sports',
        subGroups: [
          {
            id: 'combat_sport_type',
            title: 'By Sport Type',
            items: [
              { id: 'boxing', label: 'Boxing' },
              { id: 'mma', label: 'MMA' },
              { id: 'muay_thai', label: 'Muay Thai' },
              { id: 'wrestling', label: 'Wrestling' },
              { id: 'judo', label: 'Judo' },
            ],
          },
          {
            id: 'combat_goal',
            title: 'By Goal',
            items: [
              { id: 'power_endurance', label: 'Power endurance' },
              { id: 'speed_reaction', label: 'Speed & reaction' },
              { id: 'weight_cut_conditioning', label: 'Weight cut conditioning' },
              { id: 'neck_core_strength', label: 'Neck & core strength' },
            ],
          },
          {
            id: 'combat_phase',
            title: 'By Phase',
            items: [
              { id: 'fight_camp', label: 'Fight camp' },
              { id: 'off_camp', label: 'Off-camp' },
              { id: 'recovery', label: 'Recovery' },
            ],
          },
        ],
      },
    ],
    athleteIdentityGroupLimits: {
      football_position: 2,
      football_goal: 2,
      football_phase: 1,
      basketball_role: 2,
      basketball_goal: 2,
      basketball_phase: 1,
      handball_position: 2,
      handball_goal: 2,
      handball_phase: 1,
      swimming_stroke: 2,
      swimming_goal: 2,
      swimming_phase: 1,
      combat_sport_type: 2,
      combat_goal: 2,
      combat_phase: 1,
    },
    fitnessGoals: [
      {
        id: 'build_muscle_toned',
        title: 'Build muscle and get toned',
        description:
          'Focus on muscle development and tone your body. Perform pyramid sets to improve your weights in every workout.',
        tag: 'Popular',
        goalValue: 'Build Muscle',
      },
      {
        id: 'general_fitness',
        title: 'Enhance general fitness',
        description:
          'Improve your overall fitness by lifting consistent weights and learning new exercises.',
        goalValue: 'General Fitness',
      },
      {
        id: 'conditioning',
        title: 'Improve conditioning',
        description:
          'Focus on higher reps and lower weights through fast-paced supersets to boost your overall conditioning.',
        goalValue: 'Endurance',
      },
      {
        id: 'get_stronger',
        title: 'Get stronger',
        description:
          'Focus on compound exercises. Train fewer muscles per workout and lift heavier weights in lower rep ranges.',
        tag: 'Powerlifting',
        goalValue: 'Strength',
      },
    ],
    workoutSplit: [
      {
        id: 'auto',
        title: 'AI Coach Plan',
        summary: 'Generate a fully personalized plan with Claude AI',
        detail: 'Uses your onboarding profile and preferences to build a structured 8-week plan.',
        days: [2, 3, 4, 5, 6],
      },
      {
        id: 'full_body',
        title: 'Full Body Focus',
        summary: 'Train all major muscle groups each session',
        detail: 'Great for fewer days and steady weekly progress.',
        days: [2, 3, 4],
      },
      {
        id: 'upper_lower',
        title: 'Upper / Lower',
        summary: 'Alternate upper-body and lower-body days',
        detail: 'Balanced structure with good recovery between sessions.',
        days: [3, 4, 5, 6],
      },
      {
        id: 'push_pull_legs',
        title: 'Push / Pull / Legs',
        summary: 'Movement-based split with focused training days',
        detail: 'Best for moderate-to-high frequency training weeks.',
        days: [3, 4, 5, 6],
      },
      {
        id: 'hybrid',
        title: 'Push / Pull / Legs + Upper / Lower',
        summary: 'Blend PPL and upper/lower for more total volume',
        detail: 'Great when you want extra variety and balanced weekly workload.',
        days: [4, 5, 6],
      },
      {
        id: 'custom',
        title: 'Customized Plan',
        summary: 'Build a tailored split around your own priorities',
        detail: 'Designed for advanced lifters who want maximum control over structure and volume.',
        days: [2, 3, 4, 5, 6],
      },
    ],
    sportPlan: [
      {
        id: 'auto',
        title: 'Generate Workout Plan With AI',
        description: 'AI builds your training plan based on your onboarding profile and sport goals.',
      },
      {
        id: 'custom',
        title: 'Customized Personal Plan',
        description: 'You define your own plan structure, then continue to generate and refine it.',
      },
    ],
    aiTrainingFocus: [
      { value: 'balanced', label: 'Balanced' },
      { value: 'hypertrophy', label: 'Muscle growth focus' },
      { value: 'strength', label: 'Strength focus' },
      { value: 'fat_loss', label: 'Fat-loss support' },
    ],
    aiRecoveryPriority: [
      { value: 'balanced', label: 'Balanced' },
      { value: 'performance', label: 'Push progression' },
      { value: 'recovery', label: 'Conservative recovery-first' },
    ],
    genders: [
      { value: '', label: 'Select gender' },
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
    ],
    sessionDurations: [
      { value: '30', label: '30 minutes' },
      { value: '45', label: '45 minutes' },
      { value: '60', label: '60 minutes' },
      { value: '90', label: '90 minutes' },
    ],
    preferredTimes: [
      { value: 'morning', label: 'Morning' },
      { value: 'afternoon', label: 'Afternoon' },
      { value: 'evening', label: 'Evening' },
    ],
    workoutDaysRange: {
      min: 2,
      max: 6,
      defaultValue: 4,
      labels: [2, 3, 4, 5, 6],
    },
  },
};

export const isOnboardingStepId = (value: unknown): value is OnboardingStepId =>
  ONBOARDING_STEP_IDS.includes(value as OnboardingStepId);

const mergeOptionList = <T>(fallback: T[], candidate: unknown) =>
  Array.isArray(candidate) && candidate.length ? (candidate as T[]) : fallback;

const mergeStepMeta = (
  base: Record<OnboardingStepId, OnboardingStepMeta>,
  override: unknown,
) => {
  if (!override || typeof override !== 'object') return base;
  const merged = { ...base };
  Object.entries(override as Record<string, OnboardingStepMeta>).forEach(([key, value]) => {
    if (!isOnboardingStepId(key)) return;
    merged[key] = { ...merged[key], ...(value || {}) };
  });
  return merged;
};

const mergeStepMetaByTrack = (
  base: OnboardingConfig['stepMetaByTrack'],
  override: unknown,
) => {
  if (!override || typeof override !== 'object') return base;
  const merged: OnboardingConfig['stepMetaByTrack'] = { ...(base || {}) };
  Object.entries(override as Record<string, Record<string, OnboardingStepMeta>>).forEach(([track, meta]) => {
    if (track !== 'bodybuilding' && track !== 'sport') return;
    const existing = merged?.[track] || {};
    const next: Partial<Record<OnboardingStepId, OnboardingStepMeta>> = { ...existing };
    Object.entries(meta || {}).forEach(([key, value]) => {
      if (!isOnboardingStepId(key)) return;
      next[key] = { ...(next[key] || {}), ...(value || {}) };
    });
    merged[track] = next;
  });
  return merged;
};

const mergeStepList = (fallback: OnboardingStepId[], candidate: unknown) => {
  if (!Array.isArray(candidate)) return fallback;
  const filtered = candidate.filter(isOnboardingStepId);
  return filtered.length ? filtered : fallback;
};

export const mergeOnboardingConfig = (
  base: OnboardingConfig,
  override?: Partial<OnboardingConfig> | null,
): OnboardingConfig => {
  if (!override || typeof override !== 'object') return base;

  const merged: OnboardingConfig = {
    ...base,
    version: typeof override.version === 'number' ? override.version : base.version,
    trackMap: {
      ...base.trackMap,
      ...(override.trackMap || {}),
    },
    steps: {
      intro: mergeStepList(base.steps.intro, override.steps?.intro),
      bodybuilding: mergeStepList(base.steps.bodybuilding, override.steps?.bodybuilding),
      sport: mergeStepList(base.steps.sport, override.steps?.sport),
      branchBySplit: {
        custom: mergeStepList(base.steps.branchBySplit.custom, override.steps?.branchBySplit?.custom),
        aiBodybuilding: mergeStepList(
          base.steps.branchBySplit.aiBodybuilding,
          override.steps?.branchBySplit?.aiBodybuilding,
        ),
        aiSport: mergeStepList(base.steps.branchBySplit.aiSport, override.steps?.branchBySplit?.aiSport),
      },
    },
    stepMeta: mergeStepMeta(base.stepMeta, override.stepMeta),
    stepMetaByTrack: mergeStepMetaByTrack(base.stepMetaByTrack, override.stepMetaByTrack),
    splitRecommendations: override.splitRecommendations || base.splitRecommendations,
    options: {
      appMotivation: mergeOptionList(base.options.appMotivation, override.options?.appMotivation),
      athleteIdentity: mergeOptionList(base.options.athleteIdentity, override.options?.athleteIdentity),
      athleteIdentityGroupLimits: {
        ...base.options.athleteIdentityGroupLimits,
        ...(override.options?.athleteIdentityGroupLimits || {}),
      },
      fitnessGoals: mergeOptionList(base.options.fitnessGoals, override.options?.fitnessGoals),
      workoutSplit: mergeOptionList(base.options.workoutSplit, override.options?.workoutSplit),
      sportPlan: mergeOptionList(base.options.sportPlan, override.options?.sportPlan),
      aiTrainingFocus: mergeOptionList(base.options.aiTrainingFocus, override.options?.aiTrainingFocus),
      aiRecoveryPriority: mergeOptionList(base.options.aiRecoveryPriority, override.options?.aiRecoveryPriority),
      genders: mergeOptionList(base.options.genders, override.options?.genders),
      sessionDurations: mergeOptionList(base.options.sessionDurations, override.options?.sessionDurations),
      preferredTimes: mergeOptionList(base.options.preferredTimes, override.options?.preferredTimes),
      workoutDaysRange: {
        ...base.options.workoutDaysRange,
        ...(override.options?.workoutDaysRange || {}),
      },
    },
  };

  return merged;
};
