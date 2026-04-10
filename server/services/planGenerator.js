/* eslint-env node */
import { resolveExerciseVideoManifest } from '../../src/shared/exerciseVideoManifest.js';

const GOAL_PRESETS = {
  hypertrophy: { repRange: [8, 12], restSeconds: 90, rpeBase: 7.5, setBase: 3 },
  strength: { repRange: [4, 7], restSeconds: 180, rpeBase: 8.0, setBase: 4 },
  fat_loss: { repRange: [10, 15], restSeconds: 60, rpeBase: 7.0, setBase: 3 },
  recomposition: { repRange: [6, 12], restSeconds: 90, rpeBase: 7.5, setBase: 3 },
  endurance: { repRange: [12, 18], restSeconds: 45, rpeBase: 6.5, setBase: 2 },
  general_fitness: { repRange: [8, 14], restSeconds: 75, rpeBase: 7.0, setBase: 3 },
};

const LEVEL_CONFIG = {
  beginner: { exercisesPerDay: 5, volumeFactor: 0.9 },
  intermediate: { exercisesPerDay: 6, volumeFactor: 1.0 },
  advanced: { exercisesPerDay: 7, volumeFactor: 1.1 },
};

const BLOCK_MULTIPLIERS = [1.0, 1.1, 1.2, 0.9, 1.15, 1.25];

const WEEKDAY_BY_DAYS_PER_WEEK = {
  2: ['monday', 'thursday'],
  3: ['monday', 'wednesday', 'friday'],
  4: ['monday', 'tuesday', 'thursday', 'friday'],
  5: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
};

const WEEKLY_ADAPTATION_EXPERIMENT_KEY = 'weekly_adaptation_thresholds_v1';

const WEEKLY_ADJUSTMENT_THRESHOLDS = {
  criticalRiskMin: 80,
  criticalReadinessMax: 35,
  highRiskMin: 65,
  highReadinessMax: 50,
  highRecoveryMax: 55,
  progressionReadinessMin: 78,
  progressionRecoveryMin: 75,
  progressionRiskMax: 40,
  progressionConfidenceMin: 60,
  progressionGuardConfidenceMin: 45,
};

const DEFAULT_WEEKLY_THRESHOLD_VARIANTS = [
  {
    variantKey: 'control',
    allocationPct: 50,
    thresholds: { ...WEEKLY_ADJUSTMENT_THRESHOLDS },
  },
  {
    variantKey: 'conservative_guard',
    allocationPct: 25,
    thresholds: {
      criticalRiskMin: 78,
      criticalReadinessMax: 38,
      highRiskMin: 60,
      highReadinessMax: 55,
      highRecoveryMax: 58,
      progressionReadinessMin: 82,
      progressionRecoveryMin: 78,
      progressionRiskMax: 35,
      progressionConfidenceMin: 65,
      progressionGuardConfidenceMin: 50,
    },
  },
  {
    variantKey: 'progressive_load',
    allocationPct: 25,
    thresholds: {
      criticalRiskMin: 85,
      criticalReadinessMax: 30,
      highRiskMin: 70,
      highReadinessMax: 45,
      highRecoveryMax: 50,
      progressionReadinessMin: 74,
      progressionRecoveryMin: 70,
      progressionRiskMax: 45,
      progressionConfidenceMin: 55,
      progressionGuardConfidenceMin: 40,
    },
  },
];

const normalizeMuscleGroup = (raw) => {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return 'Other';
  if (/(chest|pector)/.test(key)) return 'Chest';
  if (/(back|lat|trap|rhomboid|erector)/.test(key)) return 'Back';
  if (/(quad|hamstring|glute|calf|leg)/.test(key)) return 'Legs';
  if (/(shoulder|delt)/.test(key)) return 'Shoulders';
  if (/(bicep|tricep|forearm|arm)/.test(key)) return 'Arms';
  if (/(abs|abdom|core|oblique)/.test(key)) return 'Abs';
  return 'Other';
};

const normalizeEquipment = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeName = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeAthleteIdentity = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const normalizeAthleteIdentityCategory = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const CARDIO_EXERCISE_KEYWORDS = new RegExp(
  'cardio|conditioning|aerobic|metcon|hiit|interval|circuit|endurance|run|running|jog|cycling|bike|row|rowing|elliptical|jump rope|skipping|shadow boxing|battle ropes|burpee|sprawl|high knees|mountain climber|agility ladder|shuttle run|bear crawl|carioca|skater|jumping jack|lunge high knee',
  'i',
);

const CARDIO_MODE_KEYWORDS = {
  interval: /(burpee|sprawl|high knees|mountain climber|battle ropes|shuttle run|jump rope|agility ladder|skater|sprint|jumping jack|carioca)/i,
  circuit: /(burpee|sprawl|battle ropes|shadow boxing|mountain climber|jump rope|bear crawl|agility ladder|high knees|skater)/i,
  tempo: /(run|running|row|rowing|cycle|cycling|shadow boxing|jump rope|battle ropes)/i,
  zone2: /(run|running|walk|walking|cycle|cycling|row|rowing|elliptical|shadow boxing|jump rope)/i,
  recovery: /(walking|shadow boxing|cycle|cycling|row|rowing|mobility|easy|light)/i,
  long: /(run|running|walk|walking|cycle|cycling|row|rowing|elliptical)/i,
};

const CARDIO_LEVEL_ADJUSTMENTS = {
  beginner: -1,
  intermediate: 0,
  advanced: 1,
};

const CARDIO_SESSION_LIBRARY = {
  2: [
    { name: 'Interval Conditioning', workoutType: 'Cardio Intervals', mode: 'interval', primary: ['Legs', 'Shoulders', 'Abs'], secondary: ['Back'], exerciseCount: 4 },
    { name: 'Aerobic Base', workoutType: 'Zone 2 Cardio', mode: 'zone2', primary: ['Legs', 'Back'], secondary: ['Shoulders', 'Abs'], exerciseCount: 3 },
  ],
  3: [
    { name: 'Speed Intervals', workoutType: 'Cardio Intervals', mode: 'interval', primary: ['Legs', 'Shoulders', 'Abs'], secondary: ['Back'], exerciseCount: 4 },
    { name: 'Tempo Conditioning', workoutType: 'Tempo Cardio', mode: 'tempo', primary: ['Legs', 'Back', 'Shoulders'], secondary: ['Abs'], exerciseCount: 4 },
    { name: 'Long Aerobic Base', workoutType: 'Zone 2 Cardio', mode: 'long', primary: ['Legs', 'Back'], secondary: ['Shoulders', 'Abs'], exerciseCount: 3 },
  ],
  4: [
    { name: 'Speed Intervals', workoutType: 'Cardio Intervals', mode: 'interval', primary: ['Legs', 'Shoulders', 'Abs'], secondary: ['Back'], exerciseCount: 5 },
    { name: 'Cardio Circuit', workoutType: 'Cardio Circuit', mode: 'circuit', primary: ['Legs', 'Shoulders', 'Abs'], secondary: ['Back'], exerciseCount: 5 },
    { name: 'Aerobic Base', workoutType: 'Zone 2 Cardio', mode: 'zone2', primary: ['Legs', 'Back'], secondary: ['Shoulders', 'Abs'], exerciseCount: 3 },
    { name: 'Recovery Cardio', workoutType: 'Recovery Cardio', mode: 'recovery', primary: ['Abs', 'Shoulders', 'Legs'], secondary: ['Back'], exerciseCount: 3 },
  ],
  5: [
    { name: 'Speed Intervals', workoutType: 'Cardio Intervals', mode: 'interval', primary: ['Legs', 'Shoulders', 'Abs'], secondary: ['Back'], exerciseCount: 5 },
    { name: 'Tempo Conditioning', workoutType: 'Tempo Cardio', mode: 'tempo', primary: ['Legs', 'Back', 'Shoulders'], secondary: ['Abs'], exerciseCount: 4 },
    { name: 'Zone 2 Base', workoutType: 'Zone 2 Cardio', mode: 'zone2', primary: ['Legs', 'Back'], secondary: ['Shoulders', 'Abs'], exerciseCount: 3 },
    { name: 'Cardio Circuit', workoutType: 'Cardio Circuit', mode: 'circuit', primary: ['Legs', 'Shoulders', 'Abs'], secondary: ['Back'], exerciseCount: 5 },
    { name: 'Long Aerobic Base', workoutType: 'Zone 2 Cardio', mode: 'long', primary: ['Legs', 'Back'], secondary: ['Shoulders', 'Abs'], exerciseCount: 3 },
  ],
  6: [
    { name: 'Speed Intervals', workoutType: 'Cardio Intervals', mode: 'interval', primary: ['Legs', 'Shoulders', 'Abs'], secondary: ['Back'], exerciseCount: 5 },
    { name: 'Zone 2 Base', workoutType: 'Zone 2 Cardio', mode: 'zone2', primary: ['Legs', 'Back'], secondary: ['Shoulders', 'Abs'], exerciseCount: 3 },
    { name: 'Cardio Circuit', workoutType: 'Cardio Circuit', mode: 'circuit', primary: ['Legs', 'Shoulders', 'Abs'], secondary: ['Back'], exerciseCount: 5 },
    { name: 'Tempo Conditioning', workoutType: 'Tempo Cardio', mode: 'tempo', primary: ['Legs', 'Back', 'Shoulders'], secondary: ['Abs'], exerciseCount: 4 },
    { name: 'Recovery Cardio', workoutType: 'Recovery Cardio', mode: 'recovery', primary: ['Abs', 'Shoulders', 'Legs'], secondary: ['Back'], exerciseCount: 3 },
    { name: 'Long Aerobic Base', workoutType: 'Zone 2 Cardio', mode: 'long', primary: ['Legs', 'Back'], secondary: ['Shoulders', 'Abs'], exerciseCount: 3 },
  ],
};

const CARDIO_MODE_PROGRAMMING = {
  interval: { sets: 4, reps: '30-45 sec', restSeconds: 30, rpeBase: 7.2, durationMinutes: 30 },
  circuit: { sets: 4, reps: '40-60 sec', restSeconds: 20, rpeBase: 7.1, durationMinutes: 35 },
  tempo: { sets: 3, reps: '6-10 min', restSeconds: 45, rpeBase: 6.8, durationMinutes: 40 },
  zone2: { sets: 1, reps: '20-35 min', restSeconds: 0, rpeBase: 6.0, durationMinutes: 45 },
  recovery: { sets: 2, reps: '15-25 min', restSeconds: 45, rpeBase: 5.5, durationMinutes: 30 },
  long: { sets: 1, reps: '30-50 min', restSeconds: 0, rpeBase: 6.1, durationMinutes: 50 },
};

const isCardioExercise = ({ exerciseType = '', name = '', description = '' }) => {
  const merged = `${exerciseType} ${name} ${description}`.toLowerCase();
  return CARDIO_EXERCISE_KEYWORDS.test(merged);
};

const buildCardioSplitByDays = (daysPerWeek) => {
  if (daysPerWeek <= 2) return CARDIO_SESSION_LIBRARY[2];
  if (daysPerWeek === 3) return CARDIO_SESSION_LIBRARY[3];
  if (daysPerWeek === 4) return CARDIO_SESSION_LIBRARY[4];
  if (daysPerWeek === 5) return CARDIO_SESSION_LIBRARY[5];
  return CARDIO_SESSION_LIBRARY[6];
};

const selectCardioModePool = (pool, mode) => {
  const matcher = CARDIO_MODE_KEYWORDS[mode] || CARDIO_EXERCISE_KEYWORDS;
  const preferred = pool.filter((exercise) => matcher.test(`${exercise.name} ${exercise.exerciseType || ''} ${exercise.description || ''}`));
  return preferred.length ? preferred : pool;
};

const getCardioProgression = ({ week, level, mode }) => {
  const base = CARDIO_MODE_PROGRAMMING[mode] || CARDIO_MODE_PROGRAMMING.circuit;
  const levelDelta = CARDIO_LEVEL_ADJUSTMENTS[level] || 0;
  const blockBoost = Math.min(2, Math.floor((week - 1) / 3));
  const sets = Math.max(1, base.sets + levelDelta + (mode === 'zone2' || mode === 'long' || mode === 'recovery' ? 0 : blockBoost > 0 ? 1 : 0));
  const restSeconds = Math.max(0, base.restSeconds - (blockBoost * 2));
  const rpe = Math.max(5.0, Math.min(9.2, Number((base.rpeBase + (blockBoost * 0.1)).toFixed(1))));

  return {
    sets,
    reps: base.reps,
    restSeconds,
    rpe,
    durationMinutes: base.durationMinutes + (blockBoost * 2),
  };
};

const isExplosiveExercise = ({ exerciseType = '', name = '', description = '' }) => {
  const merged = `${exerciseType} ${name} ${description}`.toLowerCase();
  return /(plyometric|plyometrics|explosive|jump|bound|throw|sprint|agility|sprawl|snatch|clean and jerk|power clean|push press|medicine ball)/.test(merged);
};

const isIsometricExercise = ({ exerciseType = '', name = '', description = '' }) => {
  const merged = `${exerciseType} ${name} ${description}`.toLowerCase();
  return /(isometric|isometrics|hold|plank|wall sit|pallof|anti-rotation|hollow[-\s]?body)/.test(merged);
};

const resolveAthleteMovementBias = ({ goal, athleteIdentity, athleteIdentityCategory }) => {
  const normalizedGoal = String(goal || '').trim().toLowerCase();
  const normalizedIdentity = normalizeAthleteIdentity(athleteIdentity);
  const normalizedCategory = normalizeAthleteIdentityCategory(athleteIdentityCategory);

  const isSportAthlete =
    normalizedCategory === 'athlete_sports'
    || ['football', 'basketball', 'handball', 'swimming', 'combat_sports'].includes(normalizedIdentity);

  if (!isSportAthlete || normalizedIdentity === 'bodybuilding') {
    return {
      enabled: false,
      explosivePerDay: 0,
      isometricPerDay: 0,
    };
  }

  if (normalizedGoal === 'endurance') {
    return {
      enabled: true,
      explosivePerDay: 1,
      isometricPerDay: 1,
    };
  }

  return {
    enabled: true,
    explosivePerDay: 2,
    isometricPerDay: 1,
  };
};

const levelRank = (level) => {
  if (level === 'beginner') return 1;
  if (level === 'intermediate') return 2;
  if (level === 'advanced') return 3;
  return 2;
};

const normalizeSplitPreference = (value) => {
  const key = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (['auto', 'full_body', 'upper_lower', 'push_pull_legs', 'hybrid', 'custom'].includes(key)) {
    return key;
  }
  return 'auto';
};

const toProgramType = (daysPerWeek, splitPreference = 'auto') => {
  const normalizedSplit = normalizeSplitPreference(splitPreference);
  if (normalizedSplit === 'full_body') return 'full_body';
  if (normalizedSplit === 'upper_lower') return 'upper_lower';
  if (normalizedSplit === 'push_pull_legs') return 'push_pull_legs';
  if (daysPerWeek <= 3) return 'full_body';
  if (daysPerWeek === 4) return 'upper_lower';
  if (daysPerWeek >= 6) return 'push_pull_legs';
  return 'custom';
};

const WEEKLY_DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const WEEKLY_FATIGUE_WEIGHTS = {
  upper: 2,
  lower: 4,
  glutes: 5,
  liss: 1,
  endurance: 2,
  hiit: 3,
};

const WEEKLY_CAPACITY_BY_LEVEL = {
  beginner: 14,
  intermediate: 18,
  advanced: 22,
};

const normalizeRecoveryPriority = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'performance') return 'performance';
  if (key === 'recovery') return 'recovery';
  return 'balanced';
};

const resolveWeeklyCapacity = (level, recoveryPriority) => {
  const base = WEEKLY_CAPACITY_BY_LEVEL[level] || WEEKLY_CAPACITY_BY_LEVEL.intermediate;
  const normalizedPriority = normalizeRecoveryPriority(recoveryPriority);
  if (normalizedPriority === 'performance') return base + 2;
  if (normalizedPriority === 'recovery') return Math.max(10, base - 2);
  return base;
};

const normalizeCardioGoal = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;
  if (['fat_loss', 'fat loss'].includes(key) || /(fat|loss|burn|cut)/.test(key)) return 'fat_loss';
  if (['endurance', 'conditioning'].includes(key) || /(endurance|aerobic|stamina|conditioning)/.test(key)) return 'endurance';
  if (['hiit_fast_burn', 'hiit'].includes(key) || /(hiit|interval|rapid)/.test(key)) return 'hiit';
  if (['wellness', 'health', 'wellbeing', 'well-being'].includes(key) || /(wellness|health|well|recovery|mobility)/.test(key)) return 'wellness';
  return null;
};

const resolveCardioGoals = ({
  goal,
  athleteSubCategoryId,
  athleteSubCategoryIds,
  athleteSubCategoryLabel,
  athleteGoal,
}) => {
  const candidates = [
    goal,
    athleteSubCategoryId,
    athleteSubCategoryLabel,
    athleteGoal,
    ...(Array.isArray(athleteSubCategoryIds) ? athleteSubCategoryIds : []),
  ];

  const resolved = [];
  for (const candidate of candidates) {
    const normalized = normalizeCardioGoal(candidate);
    if (normalized && !resolved.includes(normalized)) {
      resolved.push(normalized);
    }
  }

  return resolved.slice(0, 2);
};

const resolveStrengthScheduleKind = ({ splitPreference, femaleProfile, daysPerWeek }) => {
  if (femaleProfile?.usesWowSplit) return 'sp';
  if (femaleProfile?.usesDefaultUl) return 'ul';
  if (femaleProfile?.usesHybridBalance) return 'ppl_ul';
  if (femaleProfile?.usesPremiumPpl) return 'ppl';

  const normalizedSplit = normalizeSplitPreference(splitPreference);
  if (normalizedSplit === 'upper_lower') return 'ul';
  if (normalizedSplit === 'push_pull_legs') return 'ppl';
  if (normalizedSplit === 'hybrid') return Number(daysPerWeek || 0) >= 5 ? 'ppl_ul' : 'hybrid';
  if (normalizedSplit === 'full_body') return 'full_body';
  if (Number(daysPerWeek || 0) <= 3) return 'full_body';
  if (Number(daysPerWeek || 0) === 4) return 'ul';
  if (Number(daysPerWeek || 0) >= 6) return 'ppl';
  return 'hybrid';
};

const classifyStrengthDay = (day) => {
  const label = `${day?.name || ''} ${day?.focusLabel || ''} ${day?.workoutType || ''}`.toLowerCase();
  const primary = Array.isArray(day?.primary) ? day.primary : [];
  const hasLegs = primary.includes('Legs');
  const isGluteFocused =
    /(glute|hamstring|lower full|lower balanced|legs glutes|glutes pump|glutes strength)/.test(label)
    || ['strength', 'pump', 'mixed_lower', 'strength_glutes', 'volume_lower'].includes(day?.progressionStyle);

  if (isGluteFocused) {
    return {
      sessionType: 'glutes',
      fatigueScore: WEEKLY_FATIGUE_WEIGHTS.glutes,
      isUpper: false,
      isLower: true,
      isHeavyLower: true,
      isGluteFocused: true,
    };
  }

  if (hasLegs) {
    return {
      sessionType: 'lower',
      fatigueScore: WEEKLY_FATIGUE_WEIGHTS.lower,
      isUpper: false,
      isLower: true,
      isHeavyLower: true,
      isGluteFocused: false,
    };
  }

  return {
    sessionType: 'upper',
    fatigueScore: WEEKLY_FATIGUE_WEIGHTS.upper,
    isUpper: true,
    isLower: false,
    isHeavyLower: false,
    isGluteFocused: false,
  };
};

const buildStrengthCalendar = (strengthDays, scheduleKind) => {
  const count = strengthDays.length;
  let positions;

  if (count <= 2) positions = [0, 3];
  else if (count === 3) positions = [0, 2, 4];
  else if (count === 4) positions = [0, 1, 3, 4];
  else if (count === 5) positions = scheduleKind === 'ppl_ul' || scheduleKind === 'ppl' ? [0, 1, 2, 4, 5] : [0, 1, 3, 4, 5];
  else positions = scheduleKind === 'ppl' ? [0, 1, 2, 4, 5, 6] : [0, 1, 2, 3, 4, 5];

  const calendar = Array(7).fill(null);
  strengthDays.forEach((day, index) => {
    const slot = positions[index] ?? index;
    const profile = classifyStrengthDay(day);
    calendar[slot] = {
      ...day,
      source: 'strength',
      dayName: WEEKLY_DAY_NAMES[slot],
      sessionType: profile.sessionType,
      fatigueScore: profile.fatigueScore,
      isUpper: profile.isUpper,
      isLower: profile.isLower,
      isHeavyLower: profile.isHeavyLower,
      isGluteFocused: profile.isGluteFocused,
      cardioAddOns: [],
    };
  });

  return calendar;
};

const buildCardioBlueprint = ({ mode, goalType, level }) => {
  const presetsByMode = {
    zone2: {
      name: 'Incline Walk',
      workoutType: 'Zone 2 Cardio',
      focusLabel: 'Low-Intensity Fat Loss',
      fatigueScore: WEEKLY_FATIGUE_WEIGHTS.liss,
      allowFinisher: true,
      preferredPlacement: 'rest_or_upper',
      targetDurationMinutes: level === 'beginner' ? 25 : level === 'advanced' ? 35 : 30,
    },
    recovery: {
      name: 'Recovery Walk + Mobility',
      workoutType: 'Recovery Cardio',
      focusLabel: 'Recovery-Friendly Cardio',
      fatigueScore: WEEKLY_FATIGUE_WEIGHTS.liss,
      allowFinisher: true,
      preferredPlacement: 'rest_or_any',
      targetDurationMinutes: level === 'advanced' ? 30 : 25,
    },
    tempo: {
      name: 'Endurance Conditioning',
      workoutType: 'Tempo Cardio',
      focusLabel: 'Endurance Build',
      fatigueScore: WEEKLY_FATIGUE_WEIGHTS.endurance,
      allowFinisher: false,
      preferredPlacement: 'rest_or_upper',
      targetDurationMinutes: level === 'beginner' ? 25 : level === 'advanced' ? 45 : 35,
    },
    long: {
      name: 'Long Endurance Base',
      workoutType: 'Zone 2 Cardio',
      focusLabel: 'Long Aerobic Base',
      fatigueScore: WEEKLY_FATIGUE_WEIGHTS.endurance,
      allowFinisher: false,
      preferredPlacement: 'rest_day',
      targetDurationMinutes: level === 'beginner' ? 25 : level === 'advanced' ? 50 : 40,
    },
    interval: {
      name: 'HIIT Conditioning',
      workoutType: 'Cardio Intervals',
      focusLabel: 'Fast Burn Intervals',
      fatigueScore: WEEKLY_FATIGUE_WEIGHTS.hiit,
      allowFinisher: true,
      preferredPlacement: 'upper_only',
      targetDurationMinutes: level === 'beginner' ? 10 : level === 'advanced' ? 15 : 12,
    },
    circuit: {
      name: 'Cardio Circuit',
      workoutType: 'Cardio Circuit',
      focusLabel: 'Mixed HIIT Conditioning',
      fatigueScore: WEEKLY_FATIGUE_WEIGHTS.hiit,
      allowFinisher: true,
      preferredPlacement: 'upper_only',
      targetDurationMinutes: level === 'beginner' ? 10 : level === 'advanced' ? 15 : 12,
    },
  };

  const preset = presetsByMode[mode] || presetsByMode.zone2;
  return {
    ...preset,
    mode,
    goalType,
    exerciseTarget: mode === 'zone2' || mode === 'recovery' || mode === 'long' ? 3 : 4,
  };
};

const buildCardioBlueprints = ({ cardioGoals, level, scheduleKind }) => {
  const goals = Array.isArray(cardioGoals) ? cardioGoals.slice(0, 2) : [];
  if (!goals.length) return [];

  const has = (goal) => goals.includes(goal);
  let modes = [];

  if (has('fat_loss') && has('hiit')) {
    modes = level === 'advanced' ? ['zone2', 'zone2', 'interval', 'circuit'] : ['zone2', 'zone2', 'interval'];
  } else if (has('fat_loss') && has('endurance')) {
    modes = ['zone2', 'tempo', 'long'];
  } else if (has('fat_loss') && has('wellness')) {
    modes = ['zone2', 'recovery', 'recovery'];
  } else if (has('endurance') && has('hiit')) {
    modes = ['interval', 'tempo', 'long'];
  } else if (has('endurance') && has('wellness')) {
    modes = ['tempo', 'zone2', 'recovery'];
  } else if (has('fat_loss')) {
    modes = level === 'beginner'
      ? ['zone2', 'zone2', 'recovery']
      : level === 'advanced'
        ? ['zone2', 'zone2', 'tempo', 'interval']
        : ['zone2', 'zone2', 'interval'];
  } else if (has('endurance')) {
    modes = level === 'beginner' ? ['tempo', 'zone2'] : ['tempo', 'zone2', 'long'];
  } else if (has('hiit')) {
    modes = level === 'beginner' ? ['interval'] : level === 'advanced' ? ['interval', 'circuit', 'interval'] : ['interval', 'circuit'];
  } else if (has('wellness')) {
    modes = level === 'advanced' ? ['recovery', 'zone2', 'recovery', 'zone2'] : level === 'beginner' ? ['recovery', 'recovery'] : ['recovery', 'zone2', 'recovery'];
  }

  if (scheduleKind === 'sp') {
    modes = modes.map((mode) => (mode === 'circuit' || mode === 'interval' ? 'interval' : mode));
  }
  if (scheduleKind === 'ppl' || scheduleKind === 'ppl_ul') {
    const highFatigueModes = modes.filter((mode) => mode === 'interval' || mode === 'circuit').length;
    if (highFatigueModes > 1) {
      let downgraded = 0;
      modes = modes.map((mode) => {
        if ((mode === 'interval' || mode === 'circuit') && downgraded < highFatigueModes - 1) {
          downgraded += 1;
          return 'zone2';
        }
        return mode;
      });
    }
  }

  return modes.map((mode) => buildCardioBlueprint({ mode, goalType: goals[0], level }));
};

const canAttachFinisher = (day, blueprint, calendar, dayIndex) => {
  if (!day || day.source !== 'strength') return false;
  if (!blueprint.allowFinisher) return false;
  if (blueprint.mode === 'interval' || blueprint.mode === 'circuit') {
    if (!day.isUpper) return false;
    const nextDay = calendar[dayIndex + 1];
    if (nextDay?.isHeavyLower) return false;
  }
  if ((blueprint.mode === 'tempo' || blueprint.mode === 'long') && !day.isUpper) return false;
  if ((blueprint.mode === 'zone2' || blueprint.mode === 'recovery') && day.isGluteFocused) return false;
  return true;
};

const attachCardioFinisher = (day, blueprint) => {
  const nextAddOns = [...(Array.isArray(day.cardioAddOns) ? day.cardioAddOns : []), {
    ...blueprint,
    placement: 'finisher',
  }];
  return {
    ...day,
    cardioAddOns: nextAddOns,
    cardioFinisher: nextAddOns
      .map((item) => `${item.name} ${item.targetDurationMinutes} min`)
      .join(' + '),
  };
};

const canPlaceDedicatedCardio = (calendar, slotIndex, blueprint, level) => {
  if (calendar[slotIndex]) return false;

  const previous = calendar[slotIndex - 1];
  const next = calendar[slotIndex + 1];
  const adjacentModes = [previous?.mode, next?.mode].filter(Boolean);

  if ((blueprint.mode === 'interval' || blueprint.mode === 'circuit')) {
    if (level === 'beginner' && (previous?.isHeavyLower || next?.isHeavyLower)) return false;
    if (next?.isHeavyLower) return false;
    if (adjacentModes.includes('interval') || adjacentModes.includes('circuit')) return false;
  }

  if ((blueprint.mode === 'tempo' || blueprint.mode === 'long') && previous?.isGluteFocused) {
    return false;
  }

  return true;
};

const createDedicatedCardioDay = (blueprint, slotIndex) => ({
  name: blueprint.name,
  workoutType: blueprint.workoutType,
  primary: ['Legs', 'Abs'],
  secondary: ['Back', 'Shoulders'],
  focusLabel: blueprint.focusLabel,
  progressionStyle: 'cardio',
  mode: blueprint.mode,
  exerciseTarget: blueprint.exerciseTarget,
  cardioGoalType: blueprint.goalType,
  targetDurationMinutes: blueprint.targetDurationMinutes,
  cardioFinisher: `Target duration ${blueprint.targetDurationMinutes} min.`,
  source: 'cardio',
  dayName: WEEKLY_DAY_NAMES[slotIndex],
  sessionType: blueprint.mode === 'interval' || blueprint.mode === 'circuit' ? 'hiit' : blueprint.mode === 'tempo' || blueprint.mode === 'long' ? 'endurance' : 'liss',
  fatigueScore: blueprint.fatigueScore,
  cardioAddOns: [],
});

const scoreDedicatedCardioSlot = (calendar, slotIndex, blueprint) => {
  const previous = calendar[slotIndex - 1];
  const next = calendar[slotIndex + 1];
  let score = 0;

  if (!previous && !next) score += 1;
  if (blueprint.mode === 'zone2' || blueprint.mode === 'recovery') {
    if (previous?.isUpper || next?.isUpper) score += 5;
    if (!previous || !next) score += 3;
    if (previous?.isLower || next?.isLower) score += 1;
  } else if (blueprint.mode === 'interval' || blueprint.mode === 'circuit') {
    if (previous?.isUpper || next?.isUpper) score += 5;
    if (previous?.isHeavyLower || next?.isHeavyLower) score -= 10;
    if (slotIndex >= 5) score += 2;
  } else {
    if (previous?.isUpper || next?.isUpper) score += 4;
    if (previous?.isGluteFocused) score -= 8;
    if (!previous || !next) score += 2;
  }

  return score;
};

const tryPlaceDedicatedCardio = (calendar, blueprint, level, maxActiveDays) => {
  const activeCount = calendar.filter(Boolean).length;
  if (activeCount >= maxActiveDays) return null;

  const candidates = [];
  for (let slotIndex = 0; slotIndex < calendar.length; slotIndex += 1) {
    if (!canPlaceDedicatedCardio(calendar, slotIndex, blueprint, level)) continue;
    candidates.push({
      slotIndex,
      score: scoreDedicatedCardioSlot(calendar, slotIndex, blueprint),
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.slotIndex ?? null;
};

const findFinisherTarget = (calendar, blueprint) => {
  const candidates = calendar
    .map((day, index) => ({ day, index }))
    .filter(({ day, index }) => canAttachFinisher(day, blueprint, calendar, index))
    .map(({ day, index }) => ({
      index,
      score:
        (day?.isUpper ? 6 : 0)
        + (!day?.isHeavyLower ? 2 : 0)
        + ((blueprint.mode === 'zone2' || blueprint.mode === 'recovery') && day?.isLower ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.index ?? null;
};

const resolveCardioDowngrade = (blueprint, level) => {
  if (!blueprint) return null;
  if (blueprint.mode === 'interval' || blueprint.mode === 'circuit') {
    return buildCardioBlueprint({ mode: 'zone2', goalType: blueprint.goalType, level });
  }
  if (blueprint.mode === 'long' || blueprint.mode === 'tempo') {
    return buildCardioBlueprint({ mode: 'recovery', goalType: blueprint.goalType, level });
  }
  if (blueprint.mode === 'zone2') {
    return buildCardioBlueprint({ mode: 'recovery', goalType: blueprint.goalType, level });
  }
  return null;
};

const computeWeeklyFatigueScore = (calendar) =>
  calendar.reduce((sum, day) => {
    if (!day) return sum;
    const addOnScore = Array.isArray(day.cardioAddOns)
      ? day.cardioAddOns.reduce((cardioSum, item) => cardioSum + Number(item?.fatigueScore || 0), 0)
      : 0;
    return sum + Number(day.fatigueScore || 0) + addOnScore;
  }, 0);

const buildWeeklySchedule = ({
  strengthDays,
  splitPreference,
  femaleProfile,
  goal,
  athleteSubCategoryId,
  athleteSubCategoryIds,
  athleteSubCategoryLabel,
  athleteGoal,
  level,
  recoveryPriority,
}) => {
  const scheduleKind = resolveStrengthScheduleKind({
    splitPreference,
    femaleProfile,
    daysPerWeek: strengthDays.length,
  });
  const calendar = buildStrengthCalendar(strengthDays, scheduleKind);
  const cardioGoals = resolveCardioGoals({
    goal,
    athleteSubCategoryId,
    athleteSubCategoryIds,
    athleteSubCategoryLabel,
    athleteGoal,
  });

  const blueprints = buildCardioBlueprints({
    cardioGoals,
    level,
    scheduleKind,
  });

  const maxActiveDays = Math.min(6, strengthDays.length + (strengthDays.length >= 5 ? 1 : 2));

  for (const blueprint of blueprints) {
    const dedicatedIndex = tryPlaceDedicatedCardio(calendar, blueprint, level, maxActiveDays);
    if (dedicatedIndex != null) {
      calendar[dedicatedIndex] = createDedicatedCardioDay(blueprint, dedicatedIndex);
      continue;
    }

    const finisherIndex = findFinisherTarget(calendar, blueprint);
    if (finisherIndex != null) {
      calendar[finisherIndex] = attachCardioFinisher(calendar[finisherIndex], blueprint);
    }
  }

  const capacity = resolveWeeklyCapacity(level, recoveryPriority);
  let fatigueScore = computeWeeklyFatigueScore(calendar);

  while (fatigueScore > capacity) {
    let changed = false;

    for (let slotIndex = 0; slotIndex < calendar.length; slotIndex += 1) {
      const day = calendar[slotIndex];
      if (!day) continue;

      if (day.source === 'cardio') {
        const downgraded = resolveCardioDowngrade(day, level);
        if (downgraded) {
          calendar[slotIndex] = createDedicatedCardioDay(downgraded, slotIndex);
        } else {
          calendar[slotIndex] = null;
        }
        changed = true;
        break;
      }

      if (Array.isArray(day.cardioAddOns) && day.cardioAddOns.length) {
        const lastAddOn = day.cardioAddOns[day.cardioAddOns.length - 1];
        const downgraded = resolveCardioDowngrade(lastAddOn, level);
        if (downgraded) {
          const nextAddOns = [...day.cardioAddOns];
          nextAddOns[nextAddOns.length - 1] = { ...downgraded, placement: 'finisher' };
          calendar[slotIndex] = {
            ...day,
            cardioAddOns: nextAddOns,
            cardioFinisher: nextAddOns.map((item) => `${item.name} ${item.targetDurationMinutes} min`).join(' + '),
          };
        } else {
          const nextAddOns = day.cardioAddOns.slice(0, -1);
          calendar[slotIndex] = {
            ...day,
            cardioAddOns: nextAddOns,
            cardioFinisher: nextAddOns.length
              ? nextAddOns.map((item) => `${item.name} ${item.targetDurationMinutes} min`).join(' + ')
              : '',
          };
        }
        changed = true;
        break;
      }
    }

    if (!changed) break;
    fatigueScore = computeWeeklyFatigueScore(calendar);
  }

  return {
    activeDays: calendar.filter(Boolean),
    weeklyFatigueScore: fatigueScore,
    weeklyCapacity: capacity,
    cardioGoals,
    scheduleKind,
  };
};

const splitLibraryByDays = (daysPerWeek) => {
  if (daysPerWeek <= 2) {
    return {
      full_body: [
        { name: 'Full Body A', workoutType: 'Full Body', primary: ['Legs', 'Chest', 'Back'], secondary: ['Shoulders', 'Arms', 'Abs'] },
        { name: 'Full Body B', workoutType: 'Full Body', primary: ['Legs', 'Back', 'Shoulders'], secondary: ['Chest', 'Arms', 'Abs'] },
      ],
      upper_lower: [
        { name: 'Upper', workoutType: 'Upper Body', primary: ['Chest', 'Back', 'Shoulders'], secondary: ['Arms', 'Abs'] },
        { name: 'Lower', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs', 'Back'] },
      ],
      custom: [
        { name: 'Custom Day 1', workoutType: 'Full Body', primary: ['Legs', 'Chest', 'Back'], secondary: ['Shoulders', 'Arms', 'Abs'] },
        { name: 'Custom Day 2', workoutType: 'Full Body', primary: ['Legs', 'Back', 'Shoulders'], secondary: ['Chest', 'Arms', 'Abs'] },
      ],
    };
  }

  if (daysPerWeek === 3) {
    return {
      full_body: [
        { name: 'Full Body A', workoutType: 'Full Body', primary: ['Legs', 'Chest', 'Back'], secondary: ['Shoulders', 'Arms', 'Abs'] },
        { name: 'Full Body B', workoutType: 'Full Body', primary: ['Legs', 'Back', 'Shoulders'], secondary: ['Chest', 'Arms', 'Abs'] },
        { name: 'Full Body C', workoutType: 'Full Body', primary: ['Legs', 'Chest', 'Arms'], secondary: ['Back', 'Shoulders', 'Abs'] },
      ],
      upper_lower: [
        { name: 'Upper A', workoutType: 'Upper Body', primary: ['Chest', 'Back', 'Shoulders'], secondary: ['Arms', 'Abs'] },
        { name: 'Lower', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs'] },
        { name: 'Upper B', workoutType: 'Upper Body', primary: ['Back', 'Shoulders', 'Arms'], secondary: ['Chest', 'Abs'] },
      ],
      push_pull_legs: [
        { name: 'Push', workoutType: 'Push', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
        { name: 'Pull', workoutType: 'Pull', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
        { name: 'Legs', workoutType: 'Legs', primary: ['Legs'], secondary: ['Abs'] },
      ],
      custom: [
        { name: 'Custom Day 1', workoutType: 'Full Body', primary: ['Legs', 'Chest', 'Back'], secondary: ['Shoulders', 'Arms', 'Abs'] },
        { name: 'Custom Day 2', workoutType: 'Upper Body', primary: ['Back', 'Shoulders', 'Arms'], secondary: ['Chest', 'Abs'] },
        { name: 'Custom Day 3', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs'] },
      ],
    };
  }

  if (daysPerWeek === 4) {
    return {
      full_body: [
        { name: 'Full Body A', workoutType: 'Full Body', primary: ['Legs', 'Chest', 'Back'], secondary: ['Shoulders', 'Arms', 'Abs'] },
        { name: 'Full Body B', workoutType: 'Full Body', primary: ['Legs', 'Back', 'Shoulders'], secondary: ['Chest', 'Arms', 'Abs'] },
        { name: 'Full Body C', workoutType: 'Full Body', primary: ['Legs', 'Chest', 'Arms'], secondary: ['Back', 'Shoulders', 'Abs'] },
        { name: 'Full Body D', workoutType: 'Full Body', primary: ['Legs', 'Back', 'Chest'], secondary: ['Shoulders', 'Arms', 'Abs'] },
      ],
      upper_lower: [
        { name: 'Upper Push', workoutType: 'Upper Body', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
        { name: 'Lower A', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs', 'Back'] },
        { name: 'Upper Pull', workoutType: 'Upper Body', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
        { name: 'Lower B', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs', 'Chest'] },
      ],
      push_pull_legs: [
        { name: 'Push', workoutType: 'Push', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
        { name: 'Pull', workoutType: 'Pull', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
        { name: 'Legs', workoutType: 'Legs', primary: ['Legs'], secondary: ['Abs'] },
        { name: 'Full Body', workoutType: 'Full Body', primary: ['Legs', 'Chest', 'Back'], secondary: ['Shoulders', 'Arms', 'Abs'] },
      ],
      hybrid: [
        { name: 'Push', workoutType: 'Push', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
        { name: 'Lower', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs'] },
        { name: 'Pull', workoutType: 'Pull', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
        { name: 'Full Body', workoutType: 'Full Body', primary: ['Legs', 'Chest', 'Back'], secondary: ['Shoulders', 'Arms', 'Abs'] },
      ],
      custom: [
        { name: 'Custom Day 1', workoutType: 'Upper Body', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
        { name: 'Custom Day 2', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs'] },
        { name: 'Custom Day 3', workoutType: 'Upper Body', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
        { name: 'Custom Day 4', workoutType: 'Full Body', primary: ['Legs', 'Chest', 'Back'], secondary: ['Shoulders', 'Arms', 'Abs'] },
      ],
    };
  }

  if (daysPerWeek === 5) {
    return {
      upper_lower: [
        { name: 'Upper A', workoutType: 'Upper Body', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
        { name: 'Lower A', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs'] },
        { name: 'Upper B', workoutType: 'Upper Body', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
        { name: 'Lower B', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs'] },
        { name: 'Upper Mix', workoutType: 'Upper Body', primary: ['Chest', 'Back', 'Shoulders'], secondary: ['Arms', 'Abs'] },
      ],
      push_pull_legs: [
        { name: 'Push A', workoutType: 'Push', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
        { name: 'Pull A', workoutType: 'Pull', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
        { name: 'Legs', workoutType: 'Legs', primary: ['Legs'], secondary: ['Abs'] },
        { name: 'Push B', workoutType: 'Push', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
        { name: 'Pull B', workoutType: 'Pull', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
      ],
      hybrid: [
        { name: 'Push', workoutType: 'Push', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
        { name: 'Lower A', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs'] },
        { name: 'Pull', workoutType: 'Pull', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
        { name: 'Lower B', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs'] },
        { name: 'Full Body', workoutType: 'Full Body', primary: ['Chest', 'Back', 'Legs'], secondary: ['Shoulders', 'Arms', 'Abs'] },
      ],
      custom: [
        { name: 'Custom Day 1', workoutType: 'Upper Body', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
        { name: 'Custom Day 2', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs'] },
        { name: 'Custom Day 3', workoutType: 'Pull', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
        { name: 'Custom Day 4', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs'] },
        { name: 'Custom Day 5', workoutType: 'Full Body', primary: ['Chest', 'Back', 'Legs'], secondary: ['Shoulders', 'Arms', 'Abs'] },
      ],
    };
  }

  return {
    upper_lower: [
      { name: 'Upper A', workoutType: 'Upper Body', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
      { name: 'Lower A', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs'] },
      { name: 'Upper B', workoutType: 'Upper Body', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
      { name: 'Lower B', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs'] },
      { name: 'Upper C', workoutType: 'Upper Body', primary: ['Chest', 'Back', 'Shoulders'], secondary: ['Arms', 'Abs'] },
      { name: 'Lower C', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs'] },
    ],
    push_pull_legs: [
      { name: 'Push A', workoutType: 'Push', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
      { name: 'Pull A', workoutType: 'Pull', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
      { name: 'Legs A', workoutType: 'Legs', primary: ['Legs'], secondary: ['Abs'] },
      { name: 'Push B', workoutType: 'Push', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
      { name: 'Pull B', workoutType: 'Pull', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
      { name: 'Legs B', workoutType: 'Legs', primary: ['Legs'], secondary: ['Abs'] },
    ],
    hybrid: [
      { name: 'Push', workoutType: 'Push', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
      { name: 'Pull', workoutType: 'Pull', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
      { name: 'Legs', workoutType: 'Legs', primary: ['Legs'], secondary: ['Abs'] },
      { name: 'Upper Mix', workoutType: 'Upper Body', primary: ['Chest', 'Back', 'Shoulders'], secondary: ['Arms', 'Abs'] },
      { name: 'Lower Mix', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs'] },
      { name: 'Full Body', workoutType: 'Full Body', primary: ['Chest', 'Back', 'Legs'], secondary: ['Shoulders', 'Arms', 'Abs'] },
    ],
    custom: [
      { name: 'Custom Day 1', workoutType: 'Upper Body', primary: ['Chest', 'Shoulders'], secondary: ['Arms', 'Abs'] },
      { name: 'Custom Day 2', workoutType: 'Pull', primary: ['Back', 'Arms'], secondary: ['Shoulders', 'Abs'] },
      { name: 'Custom Day 3', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs'] },
      { name: 'Custom Day 4', workoutType: 'Upper Body', primary: ['Chest', 'Back'], secondary: ['Shoulders', 'Arms', 'Abs'] },
      { name: 'Custom Day 5', workoutType: 'Lower Body', primary: ['Legs'], secondary: ['Abs'] },
      { name: 'Custom Day 6', workoutType: 'Full Body', primary: ['Chest', 'Back', 'Legs'], secondary: ['Shoulders', 'Arms', 'Abs'] },
    ],
  };
};

const splitByDays = (daysPerWeek, splitPreference = 'auto') => {
  const normalizedSplit = normalizeSplitPreference(splitPreference);
  const library = splitLibraryByDays(daysPerWeek);

  if (normalizedSplit !== 'auto' && library[normalizedSplit]) {
    return library[normalizedSplit];
  }
  if (daysPerWeek <= 3 && library.full_body) return library.full_body;
  if (daysPerWeek === 4 && library.upper_lower) return library.upper_lower;
  if (daysPerWeek === 5 && library.hybrid) return library.hybrid;
  if (daysPerWeek >= 6 && library.push_pull_legs) return library.push_pull_legs;

  return library.custom || library.full_body || library.upper_lower || library.push_pull_legs || library.hybrid || [];
};

const normalizeGender = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'female' || key === 'woman' || key === 'f') return 'female';
  if (key === 'male' || key === 'man' || key === 'm') return 'male';
  return '';
};

const normalizeGoalTokens = (...values) =>
  values
    .flatMap((value) => String(value || '').toLowerCase().split(/[^a-z0-9]+/))
    .map((token) => token.trim())
    .filter(Boolean);

const includesAnyGoalToken = (tokens, expected) => expected.some((entry) => tokens.includes(entry));

const FEMALE_PREMIUM_PATTERN_LIBRARY = {
  push_a: [
    /(incline.*(dumbbell|db).*(press)|(?:dumbbell|db).*incline.*press)/i,
    /(shoulder press|overhead press)/i,
    /(lateral raise|side raise)/i,
    /(triceps pushdown|pushdown)/i,
    /(cable fly|chest fly|pec deck)/i,
  ],
  push_b: [
    /(chest press|machine press)/i,
    /(arnold press)/i,
    /(lateral raise|side raise)/i,
    /(overhead triceps extension|triceps extension)/i,
    /(cable fly|chest fly|pec deck)/i,
  ],
  pull_a: [
    /(lat pulldown|pull[-\s]?down)/i,
    /(seated row|cable row)/i,
    /(face pull)/i,
    /(biceps curl|dumbbell curl|ez curl)/i,
    /(rear delt fly|reverse pec deck|rear delt raise)/i,
  ],
  pull_b: [
    /(assisted pull[-\s]?up|pull[-\s]?up|lat pulldown|pull[-\s]?down)/i,
    /(row machine|seated row|machine row|cable row)/i,
    /(face pull)/i,
    /(hammer curl)/i,
    /(rear delt cable|rear delt fly|reverse pec deck)/i,
  ],
  legs_glutes: [
    /(hip thrust|glute bridge)/i,
    /(romanian deadlift|rdl)/i,
    /(bulgarian split squat|split squat)/i,
    /(kickback)/i,
    /(abduction|abductor)/i,
    /(glute bridge|back extension|step up)/i,
  ],
  legs_glutes_quads: [
    /(hip thrust|glute bridge)/i,
    /(hack squat|back squat|front squat|smith squat|squat)/i,
    /(leg press)/i,
    /(walking lunge|lunge)/i,
    /(abduction|abductor)/i,
    /(romanian deadlift|rdl|split squat)/i,
  ],
};

const matchesExercisePattern = (exercise, pattern) =>
  pattern.test(`${exercise.name} ${exercise.exerciseType || ''} ${exercise.description || ''}`);

const pickPatternAnchors = ({
  pools,
  patterns,
  usedNames,
  preferVideoLinkedBackExercises = false,
}) => {
  const selected = [];
  const localUsed = new Set(usedNames);
  const mergedPool = pools.flat();

  for (const pattern of patterns) {
    const match = sortSelectionPool(
      mergedPool.filter((exercise) => !localUsed.has(exercise.normalizedName) && matchesExercisePattern(exercise, pattern)),
      { preferVideoLinkedBackExercises },
    )[0];
    if (!match) continue;
    selected.push(match);
    localUsed.add(match.normalizedName);
  }

  return selected;
};

const resolveFemaleTrainingGoal = ({
  goal,
  athleteSubCategoryId,
  athleteSubCategoryLabel,
  athleteGoal,
}) => {
  const tokens = normalizeGoalTokens(goal, athleteSubCategoryId, athleteSubCategoryLabel, athleteGoal);
  const normalizedSubCategoryId = String(athleteSubCategoryId || '').trim().toLowerCase();

  if (
    normalizedSubCategoryId === 'glutes_focus'
    || includesAnyGoalToken(tokens, ['glutes', 'glute', 'booty'])
  ) {
    return 'glutes';
  }

  if (
    ['fat_loss', 'hiit_fast_burn', 'wellness'].includes(normalizedSubCategoryId)
    || includesAnyGoalToken(tokens, ['fat', 'loss', 'hiit', 'burn', 'wellness'])
  ) {
    return 'fat_loss';
  }

  if (
    ['toning', 'silhouette_posture', 'beginner_fitness'].includes(normalizedSubCategoryId)
    || includesAnyGoalToken(tokens, ['tone', 'toning', 'silhouette', 'posture', 'beginner'])
  ) {
    return 'tone';
  }

  if (
    normalizedSubCategoryId === 'muscle_strengthening'
    || includesAnyGoalToken(tokens, ['muscle', 'strength', 'strengthening'])
  ) {
    return 'muscle';
  }

  if (String(goal || '').trim().toLowerCase() === 'fat_loss') {
    return 'fat_loss';
  }

  return 'tone';
};

const resolveFemalePremiumProfile = ({
  gender,
  goal,
  experienceLevel,
  splitPreference,
  athleteIdentity,
  athleteIdentityCategory,
  athleteSubCategoryId,
  athleteSubCategoryLabel,
  athleteGoal,
  daysPerWeek,
}) => {
  const normalizedGender = normalizeGender(gender);
  const normalizedIdentity = normalizeAthleteIdentity(athleteIdentity);
  const normalizedCategory = normalizeAthleteIdentityCategory(athleteIdentityCategory);
  const normalizedSplit = normalizeSplitPreference(splitPreference);
  const normalizedLevel = String(experienceLevel || '').trim().toLowerCase();
  const femaleGoal = resolveFemaleTrainingGoal({
    goal,
    athleteSubCategoryId,
    athleteSubCategoryLabel,
    athleteGoal,
  });
  const isFemaleStrengthProfile =
    normalizedGender === 'female'
    && (normalizedIdentity === 'bodybuilding' || normalizedCategory === 'fitness');
  const usesWowSplit =
    isFemaleStrengthProfile
    && ['intermediate', 'advanced'].includes(normalizedLevel)
    && Number(daysPerWeek || 0) === 4
    && ['glutes', 'tone', 'fat_loss'].includes(femaleGoal)
    && ['auto', 'hybrid'].includes(normalizedSplit);
  const usesHybridBalance =
    isFemaleStrengthProfile
    && ['intermediate', 'advanced'].includes(normalizedLevel)
    && Number(daysPerWeek || 0) === 5
    && ['glutes', 'tone', 'fat_loss', 'muscle'].includes(femaleGoal)
    && ['auto', 'hybrid'].includes(normalizedSplit);
  const usesDefaultUl =
    isFemaleStrengthProfile
    && !usesWowSplit
    && !usesHybridBalance
    && Number(daysPerWeek || 0) === 4
    && ['auto', 'upper_lower'].includes(normalizedSplit);
  const usesPremiumPpl =
    isFemaleStrengthProfile
    && !usesWowSplit
    && !usesHybridBalance
    && Number(daysPerWeek || 0) >= 5
    && ['auto', 'push_pull_legs', 'hybrid'].includes(normalizedSplit);

  return {
    enabled: isFemaleStrengthProfile,
    usesWowSplit,
    usesHybridBalance,
    usesDefaultUl,
    usesPremiumPpl,
    goalKey: femaleGoal,
    cardioSessions: femaleGoal === 'fat_loss' ? (Number(daysPerWeek || 0) >= 6 ? 3 : 2) : 0,
  };
};

const buildFemaleHybridBalanceSplit = (femaleProfile) => {
  const cardioNote = femaleProfile.goalKey === 'fat_loss'
    ? 'Cardio add-on: incline walk 20-30 min or HIIT 10-15 min.'
    : '';

  return [
    {
      name: 'Push',
      workoutType: 'Push',
      primary: ['Shoulders', 'Chest'],
      secondary: ['Arms', 'Abs'],
      focusLabel: 'Upper Tone',
      progressionStyle: 'strength_upper',
      patternMatchers: [
        /(incline.*(dumbbell|db).*(press)|(?:dumbbell|db).*incline.*press)/i,
        /(shoulder press|overhead press)/i,
        /(lateral raise|side raise)/i,
        /(triceps pushdown|pushdown)/i,
        /(cable fly|chest fly|pec deck)/i,
      ],
      exerciseTarget: 5,
      cardioFinisher: '',
    },
    {
      name: 'Pull',
      workoutType: 'Pull',
      primary: ['Back', 'Arms'],
      secondary: ['Shoulders', 'Abs'],
      focusLabel: 'Back Shape',
      progressionStyle: 'strength_upper',
      patternMatchers: [
        /(lat pulldown|pull[-\s]?down)/i,
        /(seated row|cable row|machine row)/i,
        /(face pull)/i,
        /(biceps curl|dumbbell curl|ez curl)/i,
        /(rear delt fly|reverse pec deck|rear delt raise|rear delt cable)/i,
      ],
      exerciseTarget: 5,
      cardioFinisher: '',
    },
    {
      name: 'Legs Glutes',
      workoutType: 'Legs',
      primary: ['Legs'],
      secondary: ['Abs', 'Back'],
      focusLabel: 'Glutes Priority',
      progressionStyle: 'strength_glutes',
      patternMatchers: [
        /(hip thrust|glute bridge)/i,
        /(romanian deadlift|rdl)/i,
        /(bulgarian split squat|split squat)/i,
        /(kickback)/i,
        /(abduction|abductor)/i,
        /(back extension|step up)/i,
      ],
      exerciseTarget: femaleProfile.goalKey === 'glutes' ? 6 : 5,
      cardioFinisher: cardioNote,
    },
    {
      name: 'Upper Balanced',
      workoutType: 'Upper Body',
      primary: ['Back', 'Shoulders', 'Arms'],
      secondary: ['Chest', 'Abs'],
      focusLabel: 'Posture + Shape',
      progressionStyle: 'volume_upper',
      patternMatchers: [
        /(assisted pull[-\s]?up|pull[-\s]?up|lat pulldown|pull[-\s]?down)/i,
        /(row machine|seated row|machine row|cable row)/i,
        /(shoulder press|overhead press)/i,
        /(lateral raise|side raise)/i,
        /(triceps pushdown|overhead triceps extension|triceps extension)/i,
        /(biceps curl|hammer curl|dumbbell curl)/i,
      ],
      exerciseTarget: 6,
      cardioFinisher: femaleProfile.goalKey === 'fat_loss' ? cardioNote : '',
    },
    {
      name: 'Lower Balanced',
      workoutType: 'Lower Body',
      primary: ['Legs'],
      secondary: ['Abs', 'Back'],
      focusLabel: 'Glutes + Legs',
      progressionStyle: 'volume_lower',
      patternMatchers: [
        /(hip thrust|glute bridge)/i,
        /(hack squat|back squat|front squat|smith squat|squat)/i,
        /(leg press)/i,
        /(walking lunge|lunge)/i,
        /(abduction|abductor)/i,
        /(hamstring curl|leg curl|lying leg curl|seated leg curl)/i,
      ],
      exerciseTarget: femaleProfile.goalKey === 'glutes' ? 6 : 5,
      cardioFinisher: femaleProfile.goalKey === 'fat_loss' ? 'Optional finisher: incline walk 15-20 min.' : '',
    },
  ];
};

const buildFemaleWowSplit = (daysPerWeek, femaleProfile) => {
  const hasDedicatedCardioDay = Number(daysPerWeek || 0) >= 5;
  const cardioNote = 'Cardio add-on: incline walk 20-30 min.';

  const split = [
    {
      name: 'Glutes Strength',
      workoutType: 'Lower Body',
      primary: ['Legs'],
      secondary: ['Back', 'Abs'],
      focusLabel: 'Glutes + Hamstrings Strength',
      progressionStyle: 'strength',
      patternMatchers: [
        /(hip thrust|glute bridge)/i,
        /(romanian deadlift|rdl)/i,
        /(bulgarian split squat|split squat)/i,
        /(kickback)/i,
        /(abduction|abductor)/i,
        /(back extension|step up)/i,
      ],
      exerciseTarget: femaleProfile.goalKey === 'glutes' ? 6 : 5,
      cardioFinisher: '',
    },
    {
      name: 'Upper Light',
      workoutType: 'Upper Body',
      primary: ['Back', 'Shoulders', 'Arms'],
      secondary: ['Chest', 'Abs'],
      focusLabel: 'Upper Light Tone',
      progressionStyle: 'light_upper',
      patternMatchers: [
        /(lat pulldown|pull[-\s]?down)/i,
        /(seated row|cable row|machine row)/i,
        /(lateral raise|side raise)/i,
        /(triceps pushdown|pushdown)/i,
        /(biceps curl|dumbbell curl|hammer curl|ez curl)/i,
      ],
      exerciseTarget: 5,
      cardioFinisher: femaleProfile.goalKey === 'fat_loss' ? cardioNote : '',
    },
  ];

  if (hasDedicatedCardioDay) {
    split.push({
      name: 'Cardio Conditioning',
      workoutType: 'Cardio',
      primary: ['Legs', 'Abs'],
      secondary: ['Back', 'Shoulders'],
      focusLabel: 'Incline Walk Conditioning',
      progressionStyle: 'cardio',
      mode: femaleProfile.goalKey === 'fat_loss' ? 'interval' : 'zone2',
      exerciseTarget: femaleProfile.goalKey === 'fat_loss' ? 4 : 3,
      cardioFinisher: 'Keep this session low impact and recovery-friendly.',
    });
  }

  split.push(
    {
      name: 'Glutes Pump',
      workoutType: 'Lower Body',
      primary: ['Legs'],
      secondary: ['Abs', 'Back'],
      focusLabel: 'Glutes Pump + Volume',
      progressionStyle: 'pump',
      patternMatchers: [
        /(hip thrust|glute bridge)/i,
        /(glute bridge|bridge)/i,
        /(kickback)/i,
        /(abduction|abductor)/i,
        /(step up|step-up)/i,
        /(back extension|frog pump)/i,
      ],
      exerciseTarget: femaleProfile.goalKey === 'glutes' ? 6 : 5,
      cardioFinisher: femaleProfile.goalKey === 'fat_loss' ? cardioNote : '',
    },
    {
      name: 'Lower Full',
      workoutType: 'Lower Body',
      primary: ['Legs'],
      secondary: ['Back', 'Abs'],
      focusLabel: 'Glutes + Legs Mix',
      progressionStyle: 'mixed_lower',
      patternMatchers: [
        /(hip thrust|glute bridge)/i,
        /(hack squat|back squat|front squat|smith squat|squat)/i,
        /(leg press)/i,
        /(walking lunge|lunge)/i,
        /(hamstring curl|leg curl|lying leg curl|seated leg curl)/i,
        /(abduction|abductor)/i,
      ],
      exerciseTarget: femaleProfile.goalKey === 'glutes' ? 6 : 5,
      cardioFinisher: femaleProfile.goalKey === 'fat_loss' ? 'Optional finisher: incline walk 15-20 min.' : '',
    },
  );

  return split;
};

const buildFemaleDefaultUpperLowerSplit = (femaleProfile) => {
  const cardioFinisher = femaleProfile.goalKey === 'fat_loss'
    ? 'Cardio add-on: incline walk 20-30 min or HIIT 10-15 min.'
    : '';

  return [
    {
      name: 'Upper A',
      workoutType: 'Upper Body',
      primary: ['Back', 'Shoulders', 'Arms'],
      secondary: ['Chest', 'Abs'],
      focusLabel: 'Tone + Shape',
      patternMatchers: [
        /(lat pulldown|pull[-\s]?down)/i,
        /(seated row|cable row|machine row)/i,
        /(shoulder press|overhead press)/i,
        /(lateral raise|side raise)/i,
        /(triceps pushdown|pushdown)/i,
        /(biceps curl|dumbbell curl|ez curl)/i,
      ],
      exerciseTarget: 6,
      cardioFinisher,
    },
    {
      name: 'Lower A',
      workoutType: 'Lower Body',
      primary: ['Legs'],
      secondary: ['Abs', 'Back'],
      focusLabel: 'Glutes Priority',
      patternMatchers: [
        /(hip thrust|glute bridge)/i,
        /(romanian deadlift|rdl)/i,
        /(bulgarian split squat|split squat)/i,
        /(kickback)/i,
        /(abduction|abductor)/i,
        /(back extension|step up)/i,
      ],
      exerciseTarget: femaleProfile.goalKey === 'glutes' ? 6 : 5,
      cardioFinisher: '',
    },
    {
      name: 'Upper B',
      workoutType: 'Upper Body',
      primary: ['Back', 'Shoulders', 'Arms'],
      secondary: ['Chest', 'Abs'],
      focusLabel: 'Back Shape + Shoulders',
      patternMatchers: [
        /(assisted pull[-\s]?up|pull[-\s]?up|lat pulldown|pull[-\s]?down)/i,
        /(row machine|seated row|machine row|cable row)/i,
        /(lateral raise|side raise)/i,
        /(rear delt fly|rear delt cable|reverse pec deck)/i,
        /(overhead triceps extension|triceps extension)/i,
        /(hammer curl)/i,
      ],
      exerciseTarget: 6,
      cardioFinisher,
    },
    {
      name: 'Lower B',
      workoutType: 'Lower Body',
      primary: ['Legs'],
      secondary: ['Abs', 'Back'],
      focusLabel: 'Glutes + Legs',
      patternMatchers: [
        /(hip thrust|glute bridge)/i,
        /(hack squat|back squat|front squat|smith squat|squat)/i,
        /(leg press)/i,
        /(walking lunge|lunge)/i,
        /(abduction|abductor)/i,
        /(romanian deadlift|rdl|split squat)/i,
      ],
      exerciseTarget: femaleProfile.goalKey === 'glutes' ? 6 : 5,
      cardioFinisher: '',
    },
  ];
};

const buildFemalePremiumSplit = (daysPerWeek, femaleProfile) => {
  const dayTemplates = [
    {
      name: 'Push A',
      workoutType: 'Push',
      primary: ['Shoulders', 'Chest'],
      secondary: ['Arms', 'Abs'],
      focusLabel: 'Upper Tone',
      patternKey: 'push_a',
    },
    {
      name: 'Pull A',
      workoutType: 'Pull',
      primary: ['Back', 'Arms'],
      secondary: ['Shoulders', 'Abs'],
      focusLabel: 'Back Shape',
      patternKey: 'pull_a',
    },
    {
      name: 'Legs A',
      workoutType: 'Legs',
      primary: ['Legs'],
      secondary: ['Abs', 'Back'],
      focusLabel: 'Glutes Focus',
      patternKey: 'legs_glutes',
    },
    {
      name: 'Push B',
      workoutType: 'Push',
      primary: ['Shoulders', 'Chest'],
      secondary: ['Arms', 'Abs'],
      focusLabel: 'Upper Tone Variation',
      patternKey: 'push_b',
    },
    {
      name: 'Pull B',
      workoutType: 'Pull',
      primary: ['Back', 'Arms'],
      secondary: ['Shoulders', 'Abs'],
      focusLabel: 'Back Shape Variation',
      patternKey: 'pull_b',
    },
    {
      name: 'Legs B',
      workoutType: 'Legs',
      primary: ['Legs'],
      secondary: ['Abs', 'Back'],
      focusLabel: 'Glutes + Quads',
      patternKey: 'legs_glutes_quads',
    },
  ];

  const split = Number(daysPerWeek || 0) >= 6
    ? dayTemplates
    : [dayTemplates[0], dayTemplates[1], dayTemplates[2], dayTemplates[3], dayTemplates[5]];

  const cardioDayIndexes = femaleProfile.goalKey === 'fat_loss'
    ? (split.length >= 6 ? new Set([0, 2, 4]) : new Set([1, 3]))
    : new Set();

  return split.map((day, index) => ({
    ...day,
    patternMatchers: FEMALE_PREMIUM_PATTERN_LIBRARY[day.patternKey] || [],
    exerciseTarget:
      day.workoutType === 'Legs'
        ? (femaleProfile.goalKey === 'glutes' ? 6 : 5)
        : 5,
    cardioFinisher: cardioDayIndexes.has(index)
      ? 'Cardio add-on: incline walk 20-30 min or HIIT 10-15 min.'
      : '',
  }));
};

const parseEquipmentPreferences = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((e) => normalizeEquipment(e)).filter(Boolean);
  if (typeof input === 'string') {
    return input
      .split(/[,;/|]+/)
      .map((e) => normalizeEquipment(e))
      .filter(Boolean);
  }
  return [];
};

const sortSelectionPool = (items, { preferVideoLinkedBackExercises = false } = {}) =>
  [...items].sort((left, right) => {
    const leftPriority = preferVideoLinkedBackExercises ? Number(left.selectionPriority || 0) : 0;
    const rightPriority = preferVideoLinkedBackExercises ? Number(right.selectionPriority || 0) : 0;
    if (rightPriority !== leftPriority) return rightPriority - leftPriority;
    return String(left.name || '').localeCompare(String(right.name || ''));
  });

const pickUniqueExercises = ({
  pool,
  fallbackPool,
  count,
  usedNames,
  lastDayPrimaryMuscles,
  dayPrimaryMuscles,
  preferVideoLinkedBackExercises = false,
}) => {
  const selected = [];
  const used = new Set(usedNames);
  const preferred = sortSelectionPool(
    pool.filter((ex) => !used.has(ex.normalizedName)),
    { preferVideoLinkedBackExercises },
  );
  const reserve = sortSelectionPool(
    fallbackPool.filter((ex) => !used.has(ex.normalizedName)),
    { preferVideoLinkedBackExercises },
  );

  const candidates = [...preferred, ...reserve];
  for (const ex of candidates) {
    if (selected.length >= count) break;
    const primaryConflict = ex.primaryMuscle && lastDayPrimaryMuscles.has(ex.primaryMuscle) && dayPrimaryMuscles.has(ex.primaryMuscle);
    if (primaryConflict) continue;
    selected.push(ex);
    used.add(ex.normalizedName);
  }

  return selected;
};

const pickAthleteAnchorExercises = ({
  dayPool,
  daySecondaryPool,
  fallbackPool,
  usedNames,
  lastDayPrimaryMuscles,
  dayPrimaryMuscles,
  explosiveTarget = 0,
  isometricTarget = 0,
  preferVideoLinkedBackExercises = false,
}) => {
  const selected = [];
  const selectedNames = new Set(usedNames);

  const appendUniqueSelection = (entries) => {
    entries.forEach((entry) => {
      if (!entry || selectedNames.has(entry.normalizedName)) return;
      selected.push(entry);
      selectedNames.add(entry.normalizedName);
    });
  };

  if (explosiveTarget > 0) {
    const explosiveSelection = pickUniqueExercises({
      pool: [...dayPool, ...daySecondaryPool].filter((ex) => ex.isExplosive),
      fallbackPool: fallbackPool.filter((ex) => ex.isExplosive),
      count: explosiveTarget,
      usedNames: selectedNames,
      lastDayPrimaryMuscles,
      dayPrimaryMuscles,
      preferVideoLinkedBackExercises,
    });
    appendUniqueSelection(explosiveSelection);
  }

  if (isometricTarget > 0) {
    const isometricSelection = pickUniqueExercises({
      pool: [...dayPool, ...daySecondaryPool].filter((ex) => ex.isIsometric),
      fallbackPool: fallbackPool.filter((ex) => ex.isIsometric),
      count: isometricTarget,
      usedNames: selectedNames,
      lastDayPrimaryMuscles,
      dayPrimaryMuscles,
      preferVideoLinkedBackExercises,
    });
    appendUniqueSelection(isometricSelection);
  }

  return selected;
};

const loadCatalogPool = async (conn, { userLevel, equipmentPrefs }) => {
  const [rows] = await conn.execute(
    `SELECT id, canonical_name, normalized_name, body_part, equipment, level, exercise_type, description, is_stretch
     FROM exercise_catalog
     WHERE is_active = 1`,
  );

  const allowedEquipment = new Set(equipmentPrefs);
  const hasEquipmentRestriction = allowedEquipment.size > 0;
  const userLevelRank = levelRank(userLevel);

  return rows
    .map((row) => {
      const videoLink = resolveExerciseVideoManifest({
        name: row.canonical_name,
        bodyPart: row.body_part,
      });

      const exactBackVideoLink = videoLink.bodyPart === 'back' && videoLink.matchType === 'alias';
      const exerciseType = String(row.exercise_type || '');
      const description = String(row.description || '');
      const canonicalName = String(row.canonical_name || '');

      return {
        id: Number(row.id),
        name: canonicalName,
        normalizedName: normalizeName(row.normalized_name || canonicalName),
        primaryMuscle: normalizeMuscleGroup(row.body_part),
        equipment: normalizeEquipment(row.equipment),
        level: String(row.level || '').toLowerCase(),
        exerciseType,
        description,
        isStretch: Number(row.is_stretch || 0) === 1 || /stretch/i.test(exerciseType),
        isExplosive: isExplosiveExercise({ exerciseType, name: canonicalName, description }),
        isIsometric: isIsometricExercise({ exerciseType, name: canonicalName, description }),
        linkedVideoAsset: videoLink.fileName || null,
        linkedVideoMatchType: videoLink.matchType,
        selectionPriority: exactBackVideoLink ? 100 + Number(videoLink.priority || 0) : 0,
      };
    })
    .filter((ex) => !ex.isStretch)
    .filter((ex) => {
      if (!hasEquipmentRestriction) return true;
      if (!ex.equipment) return true;
      if (ex.equipment === 'body only') return true;
      return allowedEquipment.has(ex.equipment);
    })
    .filter((ex) => {
      if (!ex.level) return true;
      return levelRank(ex.level) <= Math.max(userLevelRank + 1, 2);
    });
};

const ensureLegacyExerciseId = async (conn, cache, exerciseName) => {
  const key = normalizeName(exerciseName);
  if (cache.has(key)) return cache.get(key);

  const [rows] = await conn.execute(
    `SELECT id
     FROM exercises
     WHERE LOWER(TRIM(name)) = ?
     LIMIT 1`,
    [key],
  );
  const id = rows[0]?.id ? Number(rows[0].id) : null;
  cache.set(key, id);
  return id;
};

const programProgressionForWeek = ({
  week,
  goal,
  level,
  adjustment,
  day = null,
  femaleProfile = null,
}) => {
  if (femaleProfile?.usesHybridBalance) {
    const blockIndex = Math.floor((week - 1) / 2);
    const style = String(day?.progressionStyle || '').trim().toLowerCase();
    const hybridMap = {
      strength_upper: { reps: '10-12', restSeconds: 75, rpeBase: 7.4, setBase: 3 },
      strength_glutes: { reps: '8-12', restSeconds: 95, rpeBase: 7.8, setBase: 4 },
      volume_upper: { reps: '10-15', restSeconds: 70, rpeBase: 7.0, setBase: 3 },
      volume_lower: { reps: '8-12', restSeconds: 90, rpeBase: 7.4, setBase: 4 },
    };
    const styleConfig = hybridMap[style] || hybridMap.volume_upper;
    const levelBonus = level === 'advanced' ? 1 : 0;
    const sets = Math.max(2, Math.min(6, Math.round((styleConfig.setBase * (BLOCK_MULTIPLIERS[Math.min(blockIndex, BLOCK_MULTIPLIERS.length - 1)] || 1.0)) + (adjustment.setDelta || 0) + (style === 'strength_glutes' ? levelBonus * 0.35 : levelBonus * 0.2))));
    const rpe = Math.max(6.0, Math.min(9.2, Number((styleConfig.rpeBase + (blockIndex * 0.1) + (adjustment.rpeDelta || 0)).toFixed(1))));
    return {
      sets,
      rpe,
      reps: styleConfig.reps,
      restSeconds: styleConfig.restSeconds,
    };
  }

  if (femaleProfile?.usesWowSplit) {
    const blockIndex = Math.floor((week - 1) / 2);
    const style = String(day?.progressionStyle || '').trim().toLowerCase();
    if (style === 'cardio') {
      return {
        sets: 1,
        rpe: femaleProfile.goalKey === 'fat_loss' ? 7.0 : 6.0,
        reps: femaleProfile.goalKey === 'fat_loss' ? '10-15 min intervals' : '20-30 min',
        restSeconds: 0,
      };
    }

    const wowMap = {
      strength: { reps: '6-8', restSeconds: 105, rpeBase: 7.8, setBase: 4 },
      light_upper: { reps: '10-12', restSeconds: 70, rpeBase: 6.9, setBase: 3 },
      pump: { reps: '12-15', restSeconds: 60, rpeBase: 7.1, setBase: 4 },
      mixed_lower: { reps: '8-12', restSeconds: 90, rpeBase: 7.5, setBase: 3 },
    };
    const styleConfig = wowMap[style] || wowMap.light_upper;
    const levelBonus = level === 'advanced' ? 1 : 0;
    const sets = Math.max(2, Math.min(6, Math.round((styleConfig.setBase * (BLOCK_MULTIPLIERS[Math.min(blockIndex, BLOCK_MULTIPLIERS.length - 1)] || 1.0)) + (adjustment.setDelta || 0) + (style === 'strength' ? levelBonus * 0.35 : 0))));
    const rpe = Math.max(6.0, Math.min(9.2, Number((styleConfig.rpeBase + (blockIndex * 0.1) + (adjustment.rpeDelta || 0)).toFixed(1))));
    return {
      sets,
      rpe,
      reps: styleConfig.reps,
      restSeconds: styleConfig.restSeconds,
    };
  }

  if (femaleProfile?.usesPremiumPpl || femaleProfile?.usesDefaultUl) {
    const blockIndex = Math.floor((week - 1) / 2);
    const blockMultiplier = BLOCK_MULTIPLIERS[Math.min(blockIndex, BLOCK_MULTIPLIERS.length - 1)] || 1.0;
    const workoutType = String(day?.workoutType || '').toLowerCase();
    const isLegDay = workoutType === 'legs' || workoutType === 'lower body';
    const levelBonus = level === 'advanced' ? 1 : 0;
    const baseSets = isLegDay
      ? (femaleProfile.goalKey === 'glutes' || femaleProfile.goalKey === 'muscle' ? 4 : 3)
      : 3;
    const scaledSets = Math.round((baseSets * blockMultiplier) + (adjustment.setDelta || 0) + (isLegDay ? levelBonus * 0.35 : levelBonus * 0.2));
    const sets = Math.max(2, Math.min(6, scaledSets));
    const rpeBase = isLegDay ? 7.6 : 7.1;
    const rpe = Math.max(6.0, Math.min(9.2, Number((rpeBase + (blockIndex * 0.1) + (adjustment.rpeDelta || 0)).toFixed(1))));
    return {
      sets,
      rpe,
      reps: '10-15',
      restSeconds: isLegDay ? 90 : 75,
    };
  }

  const preset = GOAL_PRESETS[goal] || GOAL_PRESETS.general_fitness;
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.intermediate;
  const blockIndex = Math.floor((week - 1) / 2);
  const blockMultiplier = BLOCK_MULTIPLIERS[Math.min(blockIndex, BLOCK_MULTIPLIERS.length - 1)] || 1.0;

  const baseSets = preset.setBase * cfg.volumeFactor;
  const sets = Math.max(2, Math.min(6, Math.round((baseSets * blockMultiplier) + (adjustment.setDelta || 0))));
  const rpe = Math.max(6.0, Math.min(9.5, Number((preset.rpeBase + (adjustment.rpeDelta || 0)).toFixed(1))));
  const reps = `${preset.repRange[0]}-${preset.repRange[1]}`;
  return { sets, rpe, reps, restSeconds: preset.restSeconds };
};

const generateCardioProgram = async (
  conn,
  {
    userId,
    gymId = null,
    experienceLevel = 'intermediate',
    daysPerWeek = 4,
    cycleWeeks = 12,
    equipment = null,
    notes = null,
  },
) => {
  const clampedDays = Math.max(2, Math.min(6, Number(daysPerWeek) || 4));
  const clampedWeeks = Math.max(8, Math.min(16, Number(cycleWeeks) || 12));
  const normalizedLevel = String(experienceLevel || 'intermediate');
  const equipmentPrefs = parseEquipmentPreferences(equipment);
  const pool = await loadCatalogPool(conn, { userLevel: normalizedLevel, equipmentPrefs });
  const cardioPool = pool.filter(isCardioExercise);
  const activePool = cardioPool.length >= 8 ? cardioPool : pool;

  if (activePool.length < 12) {
    throw new Error(`Not enough exercises after equipment/level filtering (${activePool.length} found).`);
  }

  const split = buildCardioSplitByDays(clampedDays);
  const weekdays = WEEKDAY_BY_DAYS_PER_WEEK[clampedDays] || WEEKDAY_BY_DAYS_PER_WEEK[4];

  const [insertProgram] = await conn.execute(
    `INSERT INTO programs
      (gym_id, created_by_user_id, target_user_id, name, description, program_type, goal, experience_level, days_per_week, cycle_weeks, is_template, is_active)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
    [
      gymId || null,
      userId,
      `${clampedWeeks}-Week Cardio Conditioning Plan`,
      notes || `Generated from cardio onboarding (goal=endurance, level=${normalizedLevel}, days=${clampedDays}).`,
      'cardio',
      'endurance',
      normalizedLevel,
      clampedDays,
      clampedWeeks,
    ],
  );

  const programId = Number(insertProgram.insertId);
  const legacyExerciseCache = new Map();
  let dayOrder = 0;
  const usedPerWeek = new Set();
  let lastDayPrimaryMuscles = new Set();

  for (let week = 1; week <= clampedWeeks; week += 1) {
    usedPerWeek.clear();

    for (let dayIdx = 0; dayIdx < split.length; dayIdx += 1) {
      const day = split[dayIdx];
      dayOrder += 1;
      const dayName = weekdays[dayIdx % weekdays.length];
      const dayPrimaryMuscles = new Set(day.primary);
      const sessionPool = selectCardioModePool(activePool, day.mode);
      const dayPool = sessionPool.filter((ex) => dayPrimaryMuscles.has(ex.primaryMuscle));
      const daySecondaryPool = sessionPool.filter((ex) => day.secondary.includes(ex.primaryMuscle));
      const sessionPlan = CARDIO_MODE_PROGRAMMING[day.mode] || CARDIO_MODE_PROGRAMMING.circuit;
      const exerciseTarget = Math.max(
        2,
        day.exerciseCount + (CARDIO_LEVEL_ADJUSTMENTS[normalizedLevel] || 0),
      );
      const selection = [
        ...pickUniqueExercises({
          pool: [...dayPool, ...daySecondaryPool],
          fallbackPool: sessionPool,
          count: exerciseTarget,
          usedNames: usedPerWeek,
          lastDayPrimaryMuscles,
          dayPrimaryMuscles,
          preferVideoLinkedBackExercises: false,
        }),
      ];

      if (selection.length < Math.max(2, exerciseTarget - 1)) {
        const fallbackSelection = pickUniqueExercises({
          pool: sessionPool,
          fallbackPool: activePool,
          count: exerciseTarget,
          usedNames: usedPerWeek,
          lastDayPrimaryMuscles,
          dayPrimaryMuscles,
          preferVideoLinkedBackExercises: false,
        });
        selection.length = 0;
        selection.push(...fallbackSelection);
      }

      if (selection.length === 0) {
        throw new Error(`Could not build a valid cardio exercise selection for week ${week}, day ${day.name}.`);
      }

      const [workoutIns] = await conn.execute(
        `INSERT INTO workouts
          (program_id, workout_name, workout_type, day_order, day_name, estimated_duration_minutes, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          programId,
          `Week ${week} - ${day.name}`,
          String(day.workoutType || 'Cardio'),
          dayOrder,
          dayName,
          sessionPlan.durationMinutes + Math.min(6, Math.floor((week - 1) / 2) * 2),
          `${day.mode.toUpperCase()} focus | ${sessionPlan.reps} work / ${sessionPlan.restSeconds || 0}s rest`,
        ],
      );
      const workoutId = Number(workoutIns.insertId);

      const progression = getCardioProgression({
        week,
        level: normalizedLevel,
        mode: day.mode,
      });

      for (let idx = 0; idx < selection.length; idx += 1) {
        const ex = selection[idx];
        usedPerWeek.add(ex.normalizedName);
        const legacyExerciseId = await ensureLegacyExerciseId(conn, legacyExerciseCache, ex.name);

        await conn.execute(
          `INSERT INTO workout_exercises
            (workout_id, exercise_id, order_index, exercise_name_snapshot, muscle_group_snapshot, target_sets, target_reps, target_weight, rest_seconds, tempo, rpe_target, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, NULL)`,
          [
            workoutId,
            legacyExerciseId,
            idx + 1,
            ex.name,
            ex.primaryMuscle,
            progression.sets,
            progression.reps,
            progression.restSeconds,
            progression.rpe,
          ],
        );
      }

      lastDayPrimaryMuscles = dayPrimaryMuscles;
    }
  }

  return {
    programId,
    daysPerWeek: clampedDays,
    cycleWeeks: clampedWeeks,
    name: `${clampedWeeks}-Week Cardio Conditioning Plan`,
    programType: 'cardio',
    goal: 'endurance',
  };
};

export const generatePersonalizedProgram = async (
  conn,
  {
    userId,
    gymId = null,
    goal = 'general_fitness',
    experienceLevel = 'intermediate',
    daysPerWeek = 4,
    cycleWeeks = 12,
    splitPreference = 'auto',
    gender = null,
    athleteIdentity = null,
    athleteIdentityCategory = null,
    athleteSubCategoryId = null,
    athleteSubCategoryIds = [],
    athleteSubCategoryLabel = null,
    athleteGoal = null,
    recoveryPriority = null,
    equipment = null,
    notes = null,
  },
) => {
  const clampedDays = Math.max(2, Math.min(6, Number(daysPerWeek) || 4));
  const clampedWeeks = Math.max(8, Math.min(16, Number(cycleWeeks) || 12));
  const normalizedGoal = String(goal || 'general_fitness');
  const normalizedLevel = String(experienceLevel || 'intermediate');
  const normalizedIdentity = normalizeAthleteIdentity(athleteIdentity);
  const isCardioIdentity = normalizedIdentity === 'cardio';
  const equipmentPrefs = parseEquipmentPreferences(equipment);
  const femaleProfile = resolveFemalePremiumProfile({
    gender,
    goal: normalizedGoal,
    experienceLevel: normalizedLevel,
    splitPreference,
    athleteIdentity,
    athleteIdentityCategory,
    athleteSubCategoryId,
    athleteSubCategoryLabel,
    athleteGoal,
    daysPerWeek: clampedDays,
  });
  const athleteMovementBias = resolveAthleteMovementBias({
    goal: normalizedGoal,
    athleteIdentity,
    athleteIdentityCategory,
  });

  const pool = await loadCatalogPool(conn, { userLevel: normalizedLevel, equipmentPrefs });
  if (!isCardioIdentity && pool.length < 30) {
    throw new Error(`Not enough exercises after equipment/level filtering (${pool.length} found).`);
  }

  if (isCardioIdentity) {
    return generateCardioProgram(conn, {
      userId,
      gymId,
      experienceLevel: normalizedLevel,
      daysPerWeek: clampedDays,
      cycleWeeks: clampedWeeks,
      equipment,
      notes,
    });
  }

  const split = femaleProfile.usesWowSplit
    ? buildFemaleWowSplit(clampedDays, femaleProfile)
    : femaleProfile.usesHybridBalance
      ? buildFemaleHybridBalanceSplit(femaleProfile)
    : femaleProfile.usesPremiumPpl
    ? buildFemalePremiumSplit(clampedDays, femaleProfile)
    : femaleProfile.usesDefaultUl
      ? buildFemaleDefaultUpperLowerSplit(femaleProfile)
      : splitByDays(clampedDays, splitPreference);
  const weeklySchedule = buildWeeklySchedule({
    strengthDays: split,
    splitPreference,
    femaleProfile,
    goal: normalizedGoal,
    athleteSubCategoryId,
    athleteSubCategoryIds,
    athleteSubCategoryLabel,
    athleteGoal,
    level: normalizedLevel,
    recoveryPriority,
  });
  const scheduledDays = weeklySchedule.activeDays;
  const scheduledDayCount = Math.max(2, Math.min(6, scheduledDays.length || clampedDays));
  const cfg = LEVEL_CONFIG[normalizedLevel] || LEVEL_CONFIG.intermediate;
  const cardioPool = pool.filter(isCardioExercise);
  const activeCardioPool = cardioPool.length >= 8 ? cardioPool : pool;

  const [insertProgram] = await conn.execute(
    `INSERT INTO programs
      (gym_id, created_by_user_id, target_user_id, name, description, program_type, goal, experience_level, days_per_week, cycle_weeks, is_template, is_active)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
    [
      gymId || null,
      userId,
      `${clampedWeeks}-Week Personalized Plan`,
      notes || `Generated from onboarding (goal=${normalizedGoal}, level=${normalizedLevel}, days=${clampedDays}).`,
      toProgramType(scheduledDayCount, splitPreference),
      normalizedGoal,
      normalizedLevel,
      scheduledDayCount,
      clampedWeeks,
    ],
  );

  const programId = Number(insertProgram.insertId);
  const legacyExerciseCache = new Map();
  let dayOrder = 0;
  const usedPerWeek = new Set();
  let lastDayPrimaryMuscles = new Set();

  for (let week = 1; week <= clampedWeeks; week += 1) {
    if ((week - 1) % 1 === 0) {
      usedPerWeek.clear();
    }

    for (let dayIdx = 0; dayIdx < scheduledDays.length; dayIdx += 1) {
      const day = scheduledDays[dayIdx];
      dayOrder += 1;
      const dayName = String(day.dayName || WEEKDAY_BY_DAYS_PER_WEEK[scheduledDayCount]?.[dayIdx] || WEEKLY_DAY_NAMES[dayIdx] || 'monday');
      const dayPrimaryMuscles = new Set(day.primary);
      const preferVideoLinkedBackExercises = dayPrimaryMuscles.has('Back')
        && !dayPrimaryMuscles.has('Chest')
        && !dayPrimaryMuscles.has('Legs');

      const dayPool = pool.filter((ex) => dayPrimaryMuscles.has(ex.primaryMuscle));
      const daySecondaryPool = pool.filter((ex) => day.secondary.includes(ex.primaryMuscle));

      const athleteAnchors = day.mode
        ? []
        : athleteMovementBias.enabled
        ? pickAthleteAnchorExercises({
            dayPool,
            daySecondaryPool,
            fallbackPool: pool,
            usedNames: usedPerWeek,
            lastDayPrimaryMuscles,
            dayPrimaryMuscles,
            explosiveTarget: Math.max(0, Math.min(2, athleteMovementBias.explosivePerDay)),
            isometricTarget: Math.max(0, Math.min(2, athleteMovementBias.isometricPerDay)),
            preferVideoLinkedBackExercises,
          })
        : [];

      const premiumAnchors = (femaleProfile.usesWowSplit || femaleProfile.usesHybridBalance || femaleProfile.usesPremiumPpl || femaleProfile.usesDefaultUl) && !day.mode
        ? pickPatternAnchors({
            pools: [dayPool, daySecondaryPool, pool],
            patterns: Array.isArray(day.patternMatchers) ? day.patternMatchers : [],
            usedNames: new Set([...usedPerWeek, ...athleteAnchors.map((exercise) => exercise.normalizedName)]),
            preferVideoLinkedBackExercises,
          })
        : [];

      const exerciseTarget = (femaleProfile.usesWowSplit || femaleProfile.usesHybridBalance || femaleProfile.usesPremiumPpl || femaleProfile.usesDefaultUl)
        ? Math.max(
            normalizedLevel === 'beginner' ? 4 : 5,
            Math.min(6, Number(day.exerciseTarget || 5)),
          )
        : cfg.exercisesPerDay;

      const selection = day.mode
        ? [
            ...pickUniqueExercises({
              pool: selectCardioModePool(activeCardioPool, day.mode).filter((ex) => dayPrimaryMuscles.has(ex.primaryMuscle) || day.secondary.includes(ex.primaryMuscle)),
              fallbackPool: selectCardioModePool(activeCardioPool, day.mode),
              count: exerciseTarget,
              usedNames: usedPerWeek,
              lastDayPrimaryMuscles,
              dayPrimaryMuscles,
              preferVideoLinkedBackExercises: false,
            }),
          ]
        : [
            ...athleteAnchors,
            ...premiumAnchors,
            ...pickUniqueExercises({
              pool: [...dayPool, ...daySecondaryPool],
              fallbackPool: pool,
              count: Math.max(0, exerciseTarget - athleteAnchors.length - premiumAnchors.length),
              usedNames: new Set([
                ...usedPerWeek,
                ...athleteAnchors.map((exercise) => exercise.normalizedName),
                ...premiumAnchors.map((exercise) => exercise.normalizedName),
              ]),
              lastDayPrimaryMuscles,
              dayPrimaryMuscles,
              preferVideoLinkedBackExercises,
            }),
          ];

      if (selection.length > exerciseTarget) {
        selection.length = exerciseTarget;
      }

      if (selection.length === 0) {
        throw new Error(`Could not build a valid exercise selection for week ${week}, day ${day.name}.`);
      }

      if (selection.length < Math.max(day.mode ? 2 : 4, exerciseTarget - 1)) {
        const fallbackSelection = day.mode
          ? [
              ...pickUniqueExercises({
                pool: selectCardioModePool(activeCardioPool, day.mode),
                fallbackPool: activeCardioPool,
                count: exerciseTarget,
                usedNames: usedPerWeek,
                lastDayPrimaryMuscles,
                dayPrimaryMuscles,
                preferVideoLinkedBackExercises: false,
              }),
            ]
          : [
              ...athleteAnchors,
              ...premiumAnchors,
              ...pickUniqueExercises({
                pool: [...dayPool, ...daySecondaryPool],
                fallbackPool: pool,
                count: Math.max(0, exerciseTarget - athleteAnchors.length - premiumAnchors.length),
                usedNames: new Set([
                  ...usedPerWeek,
                  ...athleteAnchors.map((exercise) => exercise.normalizedName),
                  ...premiumAnchors.map((exercise) => exercise.normalizedName),
                ]),
                lastDayPrimaryMuscles,
                dayPrimaryMuscles,
                preferVideoLinkedBackExercises,
              }),
            ];
        selection.length = 0;
        selection.push(...fallbackSelection);
      }

      if (selection.length < Math.max(day.mode ? 2 : 4, exerciseTarget - 1)) {
        throw new Error(`Could not satisfy exercise selection constraints for week ${week}, day ${day.name}.`);
      }

      const [workoutIns] = await conn.execute(
          `INSERT INTO workouts
            (program_id, workout_name, workout_type, day_order, day_name, estimated_duration_minutes, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          programId,
          `Week ${week} - ${day.name}`,
          String(day.workoutType || (day.primary[0] === 'Legs' ? 'Lower Body' : 'Upper Body')),
          dayOrder,
          dayName,
          day.mode
            ? Number(day.targetDurationMinutes || ((CARDIO_MODE_PROGRAMMING[day.mode]?.durationMinutes || 30) + Math.min(6, Math.floor((week - 1) / 2) * 2)))
            : exerciseTarget * 10 + 20 + (Array.isArray(day.cardioAddOns) ? day.cardioAddOns.reduce((sum, item) => sum + Math.max(0, Math.round(Number(item?.targetDurationMinutes || 0) * 0.35)), 0) : 0),
          (femaleProfile.usesWowSplit || femaleProfile.usesHybridBalance || femaleProfile.usesPremiumPpl || femaleProfile.usesDefaultUl)
            ? day.mode
              ? `Focus: ${day.focusLabel || 'Cardio'} | Conditioning support and recovery-friendly work${day.cardioFinisher ? ` | ${day.cardioFinisher}` : ''}`
              : `Focus: ${day.focusLabel || day.primary.join(', ')} | Lower body priority, glute-first execution${day.cardioFinisher ? ` | ${day.cardioFinisher}` : ''}`
            : athleteMovementBias.enabled
              ? `Focus: ${day.primary.join(', ')} | Athletic blend: explosive + isometric${day.cardioFinisher ? ` | ${day.cardioFinisher}` : ''}`
              : `Focus: ${day.primary.join(', ')}${day.cardioFinisher ? ` | ${day.cardioFinisher}` : ''}`,
        ],
      );
      const workoutId = Number(workoutIns.insertId);

      const progression = programProgressionForWeek({
        week,
        goal: normalizedGoal,
        level: normalizedLevel,
        adjustment: { setDelta: 0, rpeDelta: 0 },
        day,
        femaleProfile,
      });

      for (let idx = 0; idx < selection.length; idx += 1) {
        const ex = selection[idx];
        usedPerWeek.add(ex.normalizedName);
        const legacyExerciseId = await ensureLegacyExerciseId(conn, legacyExerciseCache, ex.name);
        const exerciseNote = femaleProfile.usesHybridBalance
          ? (
              day.progressionStyle === 'strength_glutes'
                ? /hip thrust/i.test(ex.name)
                  ? 'Treat this as the main glute strength lift and aim to progress load over time.'
                  : 'Use controlled reps and keep glute tension high throughout the set.'
                : day.progressionStyle === 'strength_upper'
                  ? 'Build posture and upper-body balance without chasing unnecessary fatigue.'
                  : day.progressionStyle === 'volume_upper'
                    ? 'Progress reps first and keep the shoulders and back looking sharp and balanced.'
                    : day.progressionStyle === 'volume_lower'
                      ? 'Use this session to build weekly lower-body volume with clean, controlled reps.'
                      : ''
            )
          : femaleProfile.usesWowSplit
          ? (
              day.mode
                ? 'Keep intensity controlled and use this session to improve conditioning without hurting lower-body recovery.'
                : /hip thrust/i.test(ex.name)
                  ? 'Track hip thrust performance weekly and progress load first on the strength day.'
                  : day.progressionStyle === 'pump'
                    ? 'Prioritize constant tension, glute squeeze, and controlled tempo.'
                    : day.progressionStyle === 'light_upper'
                      ? 'Keep fatigue low and focus on posture, shape, and smooth execution.'
                      : ex.primaryMuscle === 'Legs'
                        ? 'Drive through the glutes and control the eccentric on every rep.'
                        : ''
            )
          : (femaleProfile.usesPremiumPpl || femaleProfile.usesDefaultUl)
          ? (
              ex.primaryMuscle === 'Legs'
                ? 'Control the eccentric and prioritize glute tension on every rep.'
                : ex.primaryMuscle === 'Back'
                  ? 'Lead with posture and shoulder position before increasing load.'
                  : ex.primaryMuscle === 'Chest' || ex.primaryMuscle === 'Shoulders'
                    ? 'Use smooth tempo and keep the upper-body work focused on shape and control.'
                    : ''
            )
          : null;

        await conn.execute(
          `INSERT INTO workout_exercises
            (workout_id, exercise_id, order_index, exercise_name_snapshot, muscle_group_snapshot, target_sets, target_reps, target_weight, rest_seconds, tempo, rpe_target, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?)`,
          [
            workoutId,
            legacyExerciseId,
            idx + 1,
            ex.name,
            ex.primaryMuscle,
            progression.sets,
            progression.reps,
            progression.restSeconds,
            progression.rpe,
            exerciseNote,
          ],
        );
      }

      lastDayPrimaryMuscles = dayPrimaryMuscles;
    }
  }

  return {
    programId,
    daysPerWeek: scheduledDayCount,
    cycleWeeks: clampedWeeks,
    name: `${clampedWeeks}-Week Personalized Plan`,
    programType: toProgramType(scheduledDayCount, splitPreference),
    goal: normalizedGoal,
    weeklySchedule: scheduledDays.map((day) => ({
      dayName: day.dayName,
      name: day.name,
      workoutType: day.workoutType,
      focusLabel: day.focusLabel || '',
      cardioFinisher: day.cardioFinisher || '',
    })),
    weeklyFatigueScore: weeklySchedule.weeklyFatigueScore,
    weeklyCapacity: weeklySchedule.weeklyCapacity,
    cardioGoals: weeklySchedule.cardioGoals,
  };
};

const getCurrentWeek = (startDate, cycleWeeks) => {
  const start = new Date(startDate);
  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const rawWeek = Math.max(1, Math.floor((now - start) / msPerWeek) + 1);
  const maxWeeks = Math.max(1, Number(cycleWeeks || 1));
  return Math.min(rawWeek, maxWeeks);
};

const toFiniteNumber = (value, fallback = null) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const safeParseJson = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
};

const hasTable = async (conn, tableName) => {
  const [rows] = await conn.execute(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?
     LIMIT 1`,
    [String(tableName || '').trim()],
  );
  return rows.length > 0;
};

const toISODate = (value = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const shiftISODate = (isoDate, deltaDays = 0) => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + Number(deltaDays || 0));
  return date.toISOString().slice(0, 10);
};

const stableHash = (input) => {
  const str = String(input || '');
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const normalizeThresholds = (raw = {}) => {
  const normalized = { ...WEEKLY_ADJUSTMENT_THRESHOLDS };
  Object.keys(normalized).forEach((key) => {
    const next = Number(raw?.[key]);
    if (Number.isFinite(next)) normalized[key] = next;
  });
  return normalized;
};

const normalizeVariantConfig = (variant = {}) => {
  const variantKey = String(variant.variantKey || variant.variant_key || '').trim().toLowerCase() || 'control';
  const allocationRaw = Number(variant.allocationPct ?? variant.allocation_pct ?? variant.traffic_allocation_pct ?? 0);
  const allocationPct = Number.isFinite(allocationRaw) && allocationRaw >= 0 ? allocationRaw : 0;
  return {
    variantKey,
    allocationPct,
    thresholds: normalizeThresholds(variant.thresholds || variant.thresholds_json || {}),
  };
};

const getDefaultVariantConfigs = () =>
  DEFAULT_WEEKLY_THRESHOLD_VARIANTS.map((variant) => normalizeVariantConfig(variant));

const pickVariantFromBucket = (variants, bucket0to99) => {
  const normalized = variants.length ? variants : getDefaultVariantConfigs();
  const total = normalized.reduce((sum, item) => sum + Math.max(0, Number(item.allocationPct || 0)), 0);
  const safeTotal = total > 0 ? total : normalized.length;
  const scaledBucket = ((Number(bucket0to99 || 0) % 100) / 100) * safeTotal;

  let acc = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    const weight = total > 0 ? Math.max(0, Number(normalized[i].allocationPct || 0)) : 1;
    acc += weight;
    if (scaledBucket < acc) return normalized[i];
  }
  return normalized[normalized.length - 1];
};

const getExperimentVariants = async (conn, experimentKey) => {
  const normalizedKey = String(experimentKey || '').trim();
  if (!normalizedKey) return getDefaultVariantConfigs();

  const hasExperimentTable = await hasTable(conn, 'scoring_threshold_experiments');
  if (!hasExperimentTable) return getDefaultVariantConfigs();

  try {
    const [rows] = await conn.execute(
      `SELECT variant_key, traffic_allocation_pct, thresholds_json
       FROM scoring_threshold_experiments
       WHERE experiment_key = ?
         AND is_active = 1
       ORDER BY id ASC`,
      [normalizedKey],
    );
    if (!rows.length) return getDefaultVariantConfigs();

    const variants = rows
      .map((row) => normalizeVariantConfig({
        variantKey: row.variant_key,
        allocationPct: row.traffic_allocation_pct,
        thresholds: safeParseJson(row.thresholds_json, {}),
      }))
      .filter((row) => row.variantKey);

    return variants.length ? variants : getDefaultVariantConfigs();
  } catch {
    return getDefaultVariantConfigs();
  }
};

const getWeeklyExperimentForUser = async (conn, userId) => {
  const experimentKey = WEEKLY_ADAPTATION_EXPERIMENT_KEY;
  const variants = await getExperimentVariants(conn, experimentKey);
  const variantByKey = new Map(variants.map((variant) => [variant.variantKey, variant]));
  const bucket = stableHash(`${experimentKey}:${userId}`) % 100;
  const bucketVariant = pickVariantFromBucket(variants, bucket);

  const hasAssignmentTable = await hasTable(conn, 'user_scoring_experiment_assignments');
  if (!hasAssignmentTable) {
    return {
      experimentKey,
      variantKey: bucketVariant.variantKey,
      thresholds: bucketVariant.thresholds,
      assignmentSource: 'hash',
    };
  }

  try {
    const [existingRows] = await conn.execute(
      `SELECT variant_key
       FROM user_scoring_experiment_assignments
       WHERE user_id = ?
         AND experiment_key = ?
       LIMIT 1`,
      [userId, experimentKey],
    );
    if (existingRows.length) {
      const existingKey = String(existingRows[0].variant_key || '').trim().toLowerCase();
      const existingVariant = variantByKey.get(existingKey) || bucketVariant;
      return {
        experimentKey,
        variantKey: existingVariant.variantKey,
        thresholds: existingVariant.thresholds,
        assignmentSource: 'persisted',
      };
    }

    await conn.execute(
      `INSERT INTO user_scoring_experiment_assignments
         (user_id, experiment_key, variant_key, metadata_json)
       VALUES (?, ?, ?, ?)`,
      [userId, experimentKey, bucketVariant.variantKey, JSON.stringify({ bucket })],
    );

    return {
      experimentKey,
      variantKey: bucketVariant.variantKey,
      thresholds: bucketVariant.thresholds,
      assignmentSource: 'persisted',
    };
  } catch {
    return {
      experimentKey,
      variantKey: bucketVariant.variantKey,
      thresholds: bucketVariant.thresholds,
      assignmentSource: 'hash',
    };
  }
};

const clampPercentage = (value) => Math.max(0, Math.min(100, Number(value || 0)));

const toRounded = (value, digits = 2) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(digits));
};

const percentChange = (currentValue, previousValue) => {
  const current = Number(currentValue);
  const previous = Number(previousValue);
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return toRounded(((current - previous) / previous) * 100, 2);
};

const toOutcomeBand = ({ adherencePct, avgRiskScore, performanceDeltaPct }) => {
  const adherence = Number(adherencePct || 0);
  const risk = Number.isFinite(Number(avgRiskScore)) ? Number(avgRiskScore) : null;
  const progress = Number.isFinite(Number(performanceDeltaPct)) ? Number(performanceDeltaPct) : null;

  if (adherence < 55 || (risk != null && risk >= 75)) return 'poor';
  if (adherence >= 85 && (risk == null || risk <= 55) && (progress == null || progress >= 5)) return 'excellent';
  if (adherence >= 70 && (progress == null || progress >= 0) && (risk == null || risk <= 65)) return 'positive';
  return 'stable';
};

const getFuturePlanSummary = async (conn, programId, afterDayOrder) => {
  const [rows] = await conn.execute(
    `SELECT
       COUNT(we.id) AS exercise_count,
       COUNT(DISTINCT w.id) AS workout_count,
       AVG(COALESCE(we.target_sets, 0)) AS avg_sets,
       AVG(COALESCE(we.rpe_target, 0)) AS avg_rpe,
       AVG(COALESCE(we.rest_seconds, 0)) AS avg_rest_seconds,
       AVG(COALESCE(we.target_weight, 0)) AS avg_target_weight
     FROM workouts w
     LEFT JOIN workout_exercises we ON we.workout_id = w.id
     WHERE w.program_id = ?
       AND w.day_order > ?`,
    [programId, afterDayOrder],
  );

  const row = rows[0] || {};
  return {
    exerciseCount: Number(row.exercise_count || 0),
    workoutCount: Number(row.workout_count || 0),
    avgSets: toFiniteNumber(row.avg_sets, 0),
    avgRpe: toFiniteNumber(row.avg_rpe, 0),
    avgRestSeconds: toFiniteNumber(row.avg_rest_seconds, 0),
    avgTargetWeight: toFiniteNumber(row.avg_target_weight, 0),
  };
};

const getLatestInsightBundle = async (conn, userId) => {
  const [rows] = await conn.execute(
    `SELECT score_type, score_value, insight_date, created_at, explanation
     FROM user_insight_scores
     WHERE user_id = ?
       AND score_type IN ('recovery', 'risk', 'readiness', 'confidence')
     ORDER BY created_at DESC
     LIMIT 40`,
    [userId],
  );

  const latestByType = {};
  let safety = null;
  let latestDate = null;

  rows.forEach((row) => {
    const scoreType = String(row.score_type || '').trim();
    if (!scoreType) return;

    if (!latestByType[scoreType]) {
      latestByType[scoreType] = toFiniteNumber(row.score_value, null);
      if (!latestDate) latestDate = row.insight_date || row.created_at || null;
    }

    if (!safety) {
      const explanation = safeParseJson(row.explanation, null);
      if (explanation?.safety) safety = explanation.safety;
    }
  });

  return {
    scores: {
      recovery: toFiniteNumber(latestByType.recovery, null),
      risk: toFiniteNumber(latestByType.risk, null),
      readiness: toFiniteNumber(latestByType.readiness, null),
      confidence: toFiniteNumber(latestByType.confidence, null),
    },
    safety: safety || null,
    scoreDate: latestDate,
  };
};

const buildWeeklyAdjustment = ({ scores, safety, trigger, thresholds = null }) => {
  const recovery = toFiniteNumber(scores?.recovery, null);
  const risk = toFiniteNumber(scores?.risk, null);
  const readiness = toFiniteNumber(scores?.readiness, null);
  const confidence = toFiniteNumber(scores?.confidence, null);
  const thresholdConfig = normalizeThresholds(thresholds || {});

  const trainingMode = String(safety?.trainingMode || '').trim().toLowerCase();
  const criticalFlags = Array.isArray(safety?.flags)
    ? safety.flags.filter((flag) => String(flag?.severity || '').toLowerCase() === 'critical')
    : [];
  const highFlags = Array.isArray(safety?.flags)
    ? safety.flags.filter((flag) => String(flag?.severity || '').toLowerCase() === 'high')
    : [];

  const reasonCodes = [];
  let mode = 'maintain';
  let triggerSource = 'weekly_analysis';
  let setDelta = 0;
  let rpeDelta = 0;
  let restDelta = 0;
  let weightMultiplier = 1.0;
  let frequencyAdjustment = 0;

  const hasCriticalRisk = criticalFlags.length > 0
    || trainingMode === 'hold_and_review'
    || (risk != null && risk >= thresholdConfig.criticalRiskMin)
    || (readiness != null && readiness < thresholdConfig.criticalReadinessMax);
  const hasHighRisk = highFlags.length > 0
    || trainingMode === 'conservative'
    || (risk != null && risk >= thresholdConfig.highRiskMin)
    || (readiness != null && readiness < thresholdConfig.highReadinessMax)
    || (recovery != null && recovery < thresholdConfig.highRecoveryMax);
  const strongReadiness = trainingMode === 'normal'
    && (readiness != null && readiness >= thresholdConfig.progressionReadinessMin)
    && (recovery != null && recovery >= thresholdConfig.progressionRecoveryMin)
    && (risk != null && risk <= thresholdConfig.progressionRiskMax)
    && (confidence != null && confidence >= thresholdConfig.progressionConfidenceMin);

  if (hasCriticalRisk) {
    mode = 'deload';
    triggerSource = 'auto_deload';
    setDelta = -2;
    rpeDelta = -1.0;
    restDelta = 30;
    weightMultiplier = 0.92;
    frequencyAdjustment = -1;
    reasonCodes.push('critical_recovery_risk');
  } else if (hasHighRisk) {
    mode = 'conservative';
    triggerSource = 'weekly_analysis';
    setDelta = -1;
    rpeDelta = -0.5;
    restDelta = 20;
    weightMultiplier = 0.96;
    frequencyAdjustment = -1;
    reasonCodes.push('high_recovery_risk');
  } else if (strongReadiness) {
    mode = 'progression';
    triggerSource = 'progression';
    setDelta = 1;
    rpeDelta = 0.3;
    restDelta = -10;
    weightMultiplier = 1.02;
    frequencyAdjustment = 0;
    reasonCodes.push('progression_window');
  } else {
    reasonCodes.push('metrics_in_target_range');
  }

  if (confidence != null && confidence < thresholdConfig.progressionGuardConfidenceMin && mode === 'progression') {
    mode = 'maintain';
    triggerSource = 'weekly_analysis';
    setDelta = 0;
    rpeDelta = 0;
    restDelta = 0;
    weightMultiplier = 1.0;
    reasonCodes.push('confidence_too_low_for_progression');
  }

  if (trigger && String(trigger).trim()) {
    reasonCodes.push(`trigger:${String(trigger).trim().toLowerCase()}`);
  }

  return {
    mode,
    triggerSource,
    setDelta,
    rpeDelta,
    restDelta,
    weightMultiplier,
    frequencyAdjustment,
    reasonCodes: Array.from(new Set(reasonCodes)),
    inputs: { recovery, risk, readiness, confidence, trainingMode },
    thresholds: thresholdConfig,
  };
};

const getAssignmentForValidation = async (conn, { userId, assignmentId = null, programId = null }) => {
  if (assignmentId) {
    const [rows] = await conn.execute(
      `SELECT pa.id, pa.program_id, p.days_per_week
       FROM program_assignments pa
       JOIN programs p ON p.id = pa.program_id
       WHERE pa.id = ?
         AND pa.user_id = ?
       LIMIT 1`,
      [assignmentId, userId],
    );
    if (rows.length) {
      return {
        assignmentId: Number(rows[0].id),
        programId: Number(rows[0].program_id),
        daysPerWeek: Number(rows[0].days_per_week || 4),
      };
    }
  }

  if (programId) {
    const [programRows] = await conn.execute(
      `SELECT id, days_per_week
       FROM programs
       WHERE id = ?
       LIMIT 1`,
      [programId],
    );
    if (programRows.length) {
      return {
        assignmentId: null,
        programId: Number(programRows[0].id),
        daysPerWeek: Number(programRows[0].days_per_week || 4),
      };
    }
  }

  const [activeRows] = await conn.execute(
    `SELECT pa.id, pa.program_id, p.days_per_week
     FROM program_assignments pa
     JOIN programs p ON p.id = pa.program_id
     WHERE pa.user_id = ?
       AND pa.status = 'active'
     ORDER BY pa.created_at DESC
     LIMIT 1`,
    [userId],
  );

  if (!activeRows.length) {
    return {
      assignmentId: null,
      programId: Number(programId || 0) || null,
      daysPerWeek: 4,
    };
  }

  return {
    assignmentId: Number(activeRows[0].id),
    programId: Number(activeRows[0].program_id),
    daysPerWeek: Number(activeRows[0].days_per_week || 4),
  };
};

const normalizeValidationSource = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['auto_weekly', 'manual', 'backfill'].includes(normalized)) return normalized;
  return 'manual';
};

export const captureWeeklyValidationSnapshot = async (
  conn,
  {
    userId,
    programId = null,
    assignmentId = null,
    adaptationId = null,
    source = 'auto_weekly',
    periodEnd = null,
    experiment = null,
  } = {},
) => {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new Error('Invalid userId');
  }

  const hasOutcomesTable = await hasTable(conn, 'plan_recommendation_outcomes');
  const resolvedAssignment = await getAssignmentForValidation(conn, {
    userId: normalizedUserId,
    assignmentId: Number.isInteger(Number(assignmentId)) ? Number(assignmentId) : null,
    programId: Number.isInteger(Number(programId)) ? Number(programId) : null,
  });

  const periodEndDate = toISODate(periodEnd || new Date()) || toISODate(new Date());
  const periodStartDate = shiftISODate(periodEndDate, -6);
  const previousPeriodEnd = shiftISODate(periodStartDate, -1);
  const previousPeriodStart = shiftISODate(periodStartDate, -7);

  const plannedSessions = Math.max(0, Number(resolvedAssignment.daysPerWeek || 4));
  const [completedRows] = await conn.execute(
    `SELECT COUNT(DISTINCT DATE(created_at)) AS completed_sessions
     FROM workout_sets
     WHERE user_id = ?
       AND completed = 1
       AND DATE(created_at) BETWEEN ? AND ?`,
    [normalizedUserId, periodStartDate, periodEndDate],
  );
  const completedSessions = Number(completedRows[0]?.completed_sessions || 0);
  const adherencePct = plannedSessions > 0
    ? clampPercentage((completedSessions / plannedSessions) * 100)
    : 0;

  const [scoreRows] = await conn.execute(
    `SELECT
       AVG(CASE WHEN score_type = 'recovery' THEN score_value END) AS avg_recovery_score,
       AVG(CASE WHEN score_type = 'risk' THEN score_value END) AS avg_risk_score,
       AVG(CASE WHEN score_type = 'readiness' THEN score_value END) AS avg_readiness_score,
       AVG(CASE WHEN score_type = 'confidence' THEN score_value END) AS confidence_avg
     FROM user_insight_scores
     WHERE user_id = ?
       AND insight_date BETWEEN ? AND ?`,
    [normalizedUserId, periodStartDate, periodEndDate],
  );
  const scoreRow = scoreRows[0] || {};

  const effortQuery = `
    SELECT
      SUM(
        CASE
          WHEN completed = 0 THEN 0
          WHEN weight IS NOT NULL AND reps IS NOT NULL THEN weight * reps
          WHEN reps IS NOT NULL THEN reps
          ELSE 0
        END
      ) AS effort
    FROM workout_sets
    WHERE user_id = ?
      AND DATE(created_at) BETWEEN ? AND ?`;

  const [currentEffortRows] = await conn.execute(effortQuery, [normalizedUserId, periodStartDate, periodEndDate]);
  const [previousEffortRows] = await conn.execute(effortQuery, [normalizedUserId, previousPeriodStart, previousPeriodEnd]);
  const currentEffort = Number(currentEffortRows[0]?.effort || 0);
  const previousEffort = Number(previousEffortRows[0]?.effort || 0);
  const performanceDeltaPct = percentChange(currentEffort, previousEffort);

  const [weightRows] = await conn.execute(
    `SELECT snapshot_date, weight_kg
     FROM user_health_snapshots
     WHERE user_id = ?
       AND snapshot_date BETWEEN ? AND ?
       AND weight_kg IS NOT NULL
     ORDER BY snapshot_date ASC`,
    [normalizedUserId, periodStartDate, periodEndDate],
  );
  let bodyWeightDeltaKg = null;
  if (weightRows.length >= 2) {
    const first = Number(weightRows[0].weight_kg);
    const last = Number(weightRows[weightRows.length - 1].weight_kg);
    if (Number.isFinite(first) && Number.isFinite(last)) {
      bodyWeightDeltaKg = toRounded(last - first, 2);
    }
  }

  const avgRiskScore = toFiniteNumber(scoreRow.avg_risk_score, null);
  const outcomeBand = toOutcomeBand({
    adherencePct,
    avgRiskScore,
    performanceDeltaPct,
  });

  const resolvedExperiment = experiment && experiment.variantKey
    ? experiment
    : await getWeeklyExperimentForUser(conn, normalizedUserId);

  const snapshot = {
    userId: normalizedUserId,
    assignmentId: resolvedAssignment.assignmentId,
    programId: resolvedAssignment.programId,
    adaptationId: Number.isInteger(Number(adaptationId)) && Number(adaptationId) > 0 ? Number(adaptationId) : null,
    experimentKey: resolvedExperiment.experimentKey || WEEKLY_ADAPTATION_EXPERIMENT_KEY,
    variantKey: resolvedExperiment.variantKey || 'control',
    source: normalizeValidationSource(source),
    periodStart: periodStartDate,
    periodEnd: periodEndDate,
    plannedSessions,
    completedSessions,
    adherencePct: toRounded(adherencePct, 2) || 0,
    avgRecoveryScore: toFiniteNumber(scoreRow.avg_recovery_score, null),
    avgRiskScore,
    avgReadinessScore: toFiniteNumber(scoreRow.avg_readiness_score, null),
    confidenceAvg: toFiniteNumber(scoreRow.confidence_avg, null),
    performanceDeltaPct,
    bodyWeightDeltaKg,
    outcomeBand,
    metrics: {
      effort: {
        currentWindow: toRounded(currentEffort, 2) || 0,
        previousWindow: toRounded(previousEffort, 2) || 0,
      },
      period: {
        start: periodStartDate,
        end: periodEndDate,
        previousStart: previousPeriodStart,
        previousEnd: previousPeriodEnd,
      },
      assignmentSource: resolvedExperiment.assignmentSource || 'hash',
    },
  };

  if (!hasOutcomesTable) {
    return {
      available: false,
      persisted: false,
      snapshot,
    };
  }

  const [writeResult] = await conn.execute(
    `INSERT INTO plan_recommendation_outcomes
       (user_id, program_id, assignment_id, adaptation_id, experiment_key, variant_key, source, period_start, period_end,
        planned_sessions, completed_sessions, adherence_pct, avg_recovery_score, avg_risk_score, avg_readiness_score,
        confidence_avg, performance_delta_pct, body_weight_delta_kg, outcome_band, metrics_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       program_id = VALUES(program_id),
       assignment_id = VALUES(assignment_id),
       adaptation_id = VALUES(adaptation_id),
       experiment_key = VALUES(experiment_key),
       variant_key = VALUES(variant_key),
       planned_sessions = VALUES(planned_sessions),
       completed_sessions = VALUES(completed_sessions),
       adherence_pct = VALUES(adherence_pct),
       avg_recovery_score = VALUES(avg_recovery_score),
       avg_risk_score = VALUES(avg_risk_score),
       avg_readiness_score = VALUES(avg_readiness_score),
       confidence_avg = VALUES(confidence_avg),
       performance_delta_pct = VALUES(performance_delta_pct),
       body_weight_delta_kg = VALUES(body_weight_delta_kg),
       outcome_band = VALUES(outcome_band),
       metrics_json = VALUES(metrics_json),
       id = LAST_INSERT_ID(id),
       updated_at = CURRENT_TIMESTAMP`,
    [
      snapshot.userId,
      snapshot.programId,
      snapshot.assignmentId,
      snapshot.adaptationId,
      snapshot.experimentKey,
      snapshot.variantKey,
      snapshot.source,
      snapshot.periodStart,
      snapshot.periodEnd,
      snapshot.plannedSessions,
      snapshot.completedSessions,
      snapshot.adherencePct,
      snapshot.avgRecoveryScore,
      snapshot.avgRiskScore,
      snapshot.avgReadinessScore,
      snapshot.confidenceAvg,
      snapshot.performanceDeltaPct,
      snapshot.bodyWeightDeltaKg,
      snapshot.outcomeBand,
      JSON.stringify(snapshot.metrics),
    ],
  );

  return {
    available: true,
    persisted: true,
    snapshotId: Number(writeResult.insertId || 0),
    snapshot,
  };
};

export const getUserPlanValidationHistory = async (conn, { userId, limit = 24 } = {}) => {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new Error('Invalid userId');
  }

  const hasOutcomesTable = await hasTable(conn, 'plan_recommendation_outcomes');
  if (!hasOutcomesTable) {
    return {
      available: false,
      userId: normalizedUserId,
      outcomes: [],
    };
  }

  const normalizedLimit = Math.max(1, Math.min(260, Number(limit) || 24));
  const [rows] = await conn.query(
    `SELECT
       id,
       program_id,
       assignment_id,
       adaptation_id,
       experiment_key,
       variant_key,
       source,
       period_start,
       period_end,
       planned_sessions,
       completed_sessions,
       adherence_pct,
       avg_recovery_score,
       avg_risk_score,
       avg_readiness_score,
       confidence_avg,
       performance_delta_pct,
       body_weight_delta_kg,
       outcome_band,
       metrics_json,
       created_at,
       updated_at
     FROM plan_recommendation_outcomes
     WHERE user_id = ?
     ORDER BY period_end DESC, id DESC
     LIMIT ${normalizedLimit}`,
    [normalizedUserId],
  );

  return {
    available: true,
    userId: normalizedUserId,
    outcomes: rows.map((row) => ({
      id: Number(row.id),
      programId: toFiniteNumber(row.program_id, null),
      assignmentId: toFiniteNumber(row.assignment_id, null),
      adaptationId: toFiniteNumber(row.adaptation_id, null),
      experimentKey: row.experiment_key || null,
      variantKey: row.variant_key || null,
      source: row.source || null,
      periodStart: toISODate(row.period_start),
      periodEnd: toISODate(row.period_end),
      plannedSessions: Number(row.planned_sessions || 0),
      completedSessions: Number(row.completed_sessions || 0),
      adherencePct: toFiniteNumber(row.adherence_pct, 0),
      avgRecoveryScore: toFiniteNumber(row.avg_recovery_score, null),
      avgRiskScore: toFiniteNumber(row.avg_risk_score, null),
      avgReadinessScore: toFiniteNumber(row.avg_readiness_score, null),
      confidenceAvg: toFiniteNumber(row.confidence_avg, null),
      performanceDeltaPct: toFiniteNumber(row.performance_delta_pct, null),
      bodyWeightDeltaKg: toFiniteNumber(row.body_weight_delta_kg, null),
      outcomeBand: row.outcome_band || 'stable',
      metrics: safeParseJson(row.metrics_json, null),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
};

export const getMonthlyValidationCalibration = async (conn, { months = 6 } = {}) => {
  const hasOutcomesTable = await hasTable(conn, 'plan_recommendation_outcomes');
  if (!hasOutcomesTable) {
    return {
      available: false,
      months: Math.max(1, Math.min(24, Number(months) || 6)),
      byMonth: [],
      byVariant: [],
      tuningHints: ['Run migration 2026-02-27_plan_validation_loop.sql to enable validation calibration reports.'],
    };
  }

  const normalizedMonths = Math.max(1, Math.min(24, Number(months) || 6));

  const [byMonthRows] = await conn.execute(
    `SELECT
       DATE_FORMAT(period_end, '%Y-%m') AS month_key,
       COALESCE(variant_key, 'unassigned') AS variant_key,
       COUNT(*) AS sample_size,
       AVG(adherence_pct) AS avg_adherence_pct,
       AVG(COALESCE(performance_delta_pct, 0)) AS avg_performance_delta_pct,
       AVG(COALESCE(avg_risk_score, 0)) AS avg_risk_score,
       AVG(COALESCE(confidence_avg, 0)) AS avg_confidence,
       AVG(CASE WHEN outcome_band IN ('positive', 'excellent') THEN 1 ELSE 0 END) AS success_rate
     FROM plan_recommendation_outcomes
     WHERE period_end >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     GROUP BY month_key, COALESCE(variant_key, 'unassigned')
     ORDER BY month_key DESC, variant_key ASC`,
    [normalizedMonths],
  );

  const [byVariantRows] = await conn.execute(
    `SELECT
       COALESCE(variant_key, 'unassigned') AS variant_key,
       COUNT(*) AS sample_size,
       AVG(adherence_pct) AS avg_adherence_pct,
       AVG(COALESCE(performance_delta_pct, 0)) AS avg_performance_delta_pct,
       AVG(COALESCE(avg_risk_score, 0)) AS avg_risk_score,
       AVG(COALESCE(confidence_avg, 0)) AS avg_confidence,
       AVG(CASE WHEN outcome_band IN ('positive', 'excellent') THEN 1 ELSE 0 END) AS success_rate
     FROM plan_recommendation_outcomes
     WHERE period_end >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     GROUP BY COALESCE(variant_key, 'unassigned')
     ORDER BY success_rate DESC, sample_size DESC`,
    [normalizedMonths],
  );

  const normalizedByVariant = byVariantRows.map((row) => ({
    variantKey: String(row.variant_key || 'unassigned'),
    sampleSize: Number(row.sample_size || 0),
    avgAdherencePct: toRounded(row.avg_adherence_pct, 2) || 0,
    avgPerformanceDeltaPct: toRounded(row.avg_performance_delta_pct, 2) || 0,
    avgRiskScore: toRounded(row.avg_risk_score, 2) || 0,
    avgConfidence: toRounded(row.avg_confidence, 2) || 0,
    successRate: toRounded(Number(row.success_rate || 0) * 100, 2) || 0,
  }));

  const tuningHints = [];
  const stableVariants = normalizedByVariant.filter((row) => row.sampleSize >= 8);

  if (stableVariants.length >= 2) {
    const best = stableVariants[0];
    const worst = stableVariants[stableVariants.length - 1];
    if (best.successRate - worst.successRate >= 8) {
      tuningHints.push(
        `Promote variant '${best.variantKey}' (success ${best.successRate}%) and down-weight '${worst.variantKey}' (success ${worst.successRate}%).`,
      );
    }
  }

  stableVariants.forEach((variant) => {
    if (variant.avgRiskScore >= 68) {
      tuningHints.push(`Variant '${variant.variantKey}' shows high fatigue risk (${variant.avgRiskScore}). Tighten progression thresholds.`);
    }
    if (variant.avgAdherencePct < 65) {
      tuningHints.push(`Variant '${variant.variantKey}' has low adherence (${variant.avgAdherencePct}%). Reduce load jumps or frequency.`);
    }
  });

  if (!tuningHints.length) {
    tuningHints.push('Current thresholds are stable. Keep collecting weekly outcomes and review again next month.');
  }

  return {
    available: true,
    months: normalizedMonths,
    generatedAt: new Date().toISOString(),
    byMonth: byMonthRows.map((row) => ({
      month: row.month_key,
      variantKey: String(row.variant_key || 'unassigned'),
      sampleSize: Number(row.sample_size || 0),
      avgAdherencePct: toRounded(row.avg_adherence_pct, 2) || 0,
      avgPerformanceDeltaPct: toRounded(row.avg_performance_delta_pct, 2) || 0,
      avgRiskScore: toRounded(row.avg_risk_score, 2) || 0,
      avgConfidence: toRounded(row.avg_confidence, 2) || 0,
      successRate: toRounded(Number(row.success_rate || 0) * 100, 2) || 0,
    })),
    byVariant: normalizedByVariant,
    tuningHints: Array.from(new Set(tuningHints)),
  };
};

export const adaptProgramBiWeekly = async (conn, { userId, trigger = 'manual' }) => {
  const [assignmentRows] = await conn.execute(
    `SELECT pa.id, pa.program_id, pa.start_date, pa.status, p.days_per_week, p.cycle_weeks
     FROM program_assignments pa
     JOIN programs p ON p.id = pa.program_id
     WHERE pa.user_id = ? AND pa.status = 'active'
     ORDER BY pa.created_at DESC
     LIMIT 1`,
    [userId],
  );

  if (!assignmentRows.length) {
    return { adapted: false, reason: 'No active assignment' };
  }

  const assignment = assignmentRows[0];
  const currentWeek = getCurrentWeek(assignment.start_date, assignment.cycle_weeks);
  const biWeeklyBlock = Math.max(1, Math.ceil(currentWeek / 2));

  const [existingLogRows] = await conn.execute(
    `SELECT id
     FROM program_change_log
     WHERE assignment_id = ?
       AND change_reason = 'user_request'
       AND notes = ?
     LIMIT 1`,
    [assignment.id, `biweekly_auto:block=${biWeeklyBlock}`],
  );
  if (existingLogRows.length) {
    return {
      adapted: false,
      reason: `Block ${biWeeklyBlock} already adapted`,
      block: biWeeklyBlock,
    };
  }
  const pastTwoWeeksStart = new Date();
  pastTwoWeeksStart.setDate(pastTwoWeeksStart.getDate() - 14);

  const [plannedRows] = await conn.execute(
    `SELECT COUNT(*) AS c
     FROM workouts
     WHERE program_id = ?
       AND day_order BETWEEN ? AND ?`,
    [assignment.program_id, Math.max(1, (currentWeek - 2) * Number(assignment.days_per_week || 4) + 1), currentWeek * Number(assignment.days_per_week || 4)],
  );
  const plannedSessions = Number(plannedRows[0]?.c || 0);

  const [completedRows] = await conn.execute(
    `SELECT COUNT(DISTINCT DATE(created_at)) AS c
     FROM workout_sets
     WHERE user_id = ?
       AND completed = 1
       AND created_at >= ?`,
    [userId, pastTwoWeeksStart],
  );
  const completedSessions = Number(completedRows[0]?.c || 0);
  const completionRate = plannedSessions > 0 ? completedSessions / plannedSessions : 0;

  const [rpeRows] = await conn.execute(
    `SELECT AVG(rpe) AS avg_rpe
     FROM workout_sets
     WHERE user_id = ?
       AND completed = 1
       AND rpe IS NOT NULL
       AND created_at >= ?`,
    [userId, pastTwoWeeksStart],
  );
  const avgRpe = Number(rpeRows[0]?.avg_rpe || 7.5);

  const [recoveryRows] = await conn.execute(
    `SELECT AVG(recovery_percentage) AS avg_recovery
     FROM muscle_recovery_status
     WHERE user_id = ?`,
    [userId],
  );
  const avgRecovery = Number(recoveryRows[0]?.avg_recovery || 75);

  let setDelta = 0;
  let rpeDelta = 0;
  if (completionRate < 0.6 || avgRecovery < 65 || avgRpe >= 8.8) {
    setDelta = -1;
    rpeDelta = -0.4;
  } else if (completionRate > 0.85 && avgRecovery > 80 && avgRpe <= 7.6) {
    setDelta = 1;
    rpeDelta = 0.3;
  }

  if (!setDelta && !rpeDelta) {
    try {
      await conn.execute(
        `INSERT INTO program_change_log
          (assignment_id, user_id, old_program_id, new_program_id, changed_by_user_id, change_reason, notes)
         VALUES (?, ?, ?, ?, NULL, 'user_request', ?)`,
        [assignment.id, userId, assignment.program_id, assignment.program_id, `biweekly_auto:block=${biWeeklyBlock}`],
      );
    } catch {
      // If change-log insert is unavailable, adaptation remains a no-op.
    }
    return {
      adapted: false,
      reason: 'Metrics in target range',
      block: biWeeklyBlock,
      metrics: { completionRate, avgRpe, avgRecovery },
    };
  }

  await conn.execute(
    `UPDATE workout_exercises we
     JOIN workouts w ON w.id = we.workout_id
     SET
       we.target_sets = LEAST(8, GREATEST(1, COALESCE(we.target_sets, 3) + ?)),
       we.rpe_target = LEAST(9.5, GREATEST(6.0, COALESCE(we.rpe_target, 7.5) + ?))
     WHERE w.program_id = ?
       AND w.day_order > ?`,
    [setDelta, rpeDelta, assignment.program_id, currentWeek * Number(assignment.days_per_week || 4)],
  );

  try {
    await conn.execute(
      `INSERT INTO program_change_log
        (assignment_id, user_id, old_program_id, new_program_id, changed_by_user_id, change_reason, notes)
       VALUES (?, ?, ?, ?, NULL, 'user_request', ?)`,
      [assignment.id, userId, assignment.program_id, assignment.program_id, `biweekly_auto:block=${biWeeklyBlock};trigger=${trigger};setDelta=${setDelta};rpeDelta=${rpeDelta}`],
    );
  } catch {
    // Non-fatal: adaptation already persisted in workout_exercises.
  }

  return {
    adapted: true,
    block: biWeeklyBlock,
    metrics: { completionRate, avgRpe, avgRecovery },
    adjustment: { setDelta, rpeDelta },
    assignmentId: Number(assignment.id),
    programId: Number(assignment.program_id),
  };
};

export const adaptProgramWeeklyByInsights = async (conn, { userId, trigger = 'weekly_analysis', force = false }) => {
  const [assignmentRows] = await conn.execute(
    `SELECT pa.id, pa.program_id, pa.start_date, pa.status, p.days_per_week, p.cycle_weeks
     FROM program_assignments pa
     JOIN programs p ON p.id = pa.program_id
     WHERE pa.user_id = ? AND pa.status = 'active'
     ORDER BY pa.created_at DESC
     LIMIT 1`,
    [userId],
  );

  if (!assignmentRows.length) {
    return { adapted: false, reason: 'No active assignment' };
  }

  const assignment = assignmentRows[0];
  const assignmentId = Number(assignment.id);
  const programId = Number(assignment.program_id);
  const daysPerWeek = Number(assignment.days_per_week || 4);
  const currentWeek = getCurrentWeek(assignment.start_date, assignment.cycle_weeks);
  const afterDayOrder = currentWeek * daysPerWeek;
  const experiment = await getWeeklyExperimentForUser(conn, userId);

  if (!force) {
    const [existingRows] = await conn.execute(
      `SELECT id, adaptation_date, trigger_source
       FROM plan_adaptations
       WHERE user_id = ?
         AND program_id = ?
         AND YEARWEEK(adaptation_date, 1) = YEARWEEK(CURDATE(), 1)
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, programId],
    );
    if (existingRows.length) {
      return {
        adapted: false,
        reason: 'Already adapted this week',
        weeklyBlock: currentWeek,
        adaptationId: Number(existingRows[0].id),
      };
    }
  }

  const insightBundle = await getLatestInsightBundle(conn, userId);
  const adjustment = buildWeeklyAdjustment({
    scores: insightBundle.scores,
    safety: insightBundle.safety,
    trigger,
    thresholds: experiment.thresholds,
  });

  const beforeSummary = await getFuturePlanSummary(conn, programId, afterDayOrder);
  if (!beforeSummary.exerciseCount) {
    const noFutureReasonCodes = ['no_future_workouts', `week:${currentWeek}`, `variant:${experiment.variantKey}`];
    const [adaptLog] = await conn.execute(
      `INSERT INTO plan_adaptations
         (user_id, program_id, adaptation_date, trigger_source, confidence_score, previous_plan_json, adapted_plan_json, change_summary_json, reason_codes_json, reviewed_by_coach)
       VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, 0)`,
      [
        userId,
        programId,
        'weekly_analysis',
        adjustment.inputs.confidence,
        JSON.stringify({ week: currentWeek, afterDayOrder, summary: beforeSummary }),
        JSON.stringify({ week: currentWeek, afterDayOrder, summary: beforeSummary }),
        JSON.stringify({
          mode: 'maintain',
          adjusted: false,
          reason: 'No future workouts available for adaptation',
          experiment: {
            key: experiment.experimentKey,
            variant: experiment.variantKey,
            assignmentSource: experiment.assignmentSource,
          },
        }),
        JSON.stringify(noFutureReasonCodes),
      ],
    );

    let validationSnapshot = null;
    try {
      validationSnapshot = await captureWeeklyValidationSnapshot(conn, {
        userId,
        programId,
        assignmentId,
        adaptationId: Number(adaptLog.insertId || 0),
        source: 'auto_weekly',
        experiment,
      });
    } catch {
      validationSnapshot = null;
    }

    return {
      adapted: false,
      reason: 'No future workouts available for adaptation',
      weeklyBlock: currentWeek,
      adaptationId: Number(adaptLog.insertId || 0),
      scores: insightBundle.scores,
      experiment: {
        key: experiment.experimentKey,
        variant: experiment.variantKey,
        assignmentSource: experiment.assignmentSource,
      },
      validationSnapshot,
    };
  }

  let affectedExercises = 0;
  if (adjustment.mode !== 'maintain') {
    const [updateResult] = await conn.execute(
      `UPDATE workout_exercises we
       JOIN workouts w ON w.id = we.workout_id
       SET
         we.target_sets = LEAST(8, GREATEST(1, COALESCE(we.target_sets, 3) + ?)),
         we.rpe_target = LEAST(9.5, GREATEST(5.5, COALESCE(we.rpe_target, 7.5) + ?)),
         we.rest_seconds = LEAST(300, GREATEST(30, COALESCE(we.rest_seconds, 90) + ?)),
         we.target_weight = CASE
           WHEN we.target_weight IS NULL THEN NULL
           ELSE ROUND(GREATEST(0, we.target_weight * ?), 2)
         END
       WHERE w.program_id = ?
         AND w.day_order > ?`,
      [
        adjustment.setDelta,
        adjustment.rpeDelta,
        adjustment.restDelta,
        adjustment.weightMultiplier,
        programId,
        afterDayOrder,
      ],
    );

    affectedExercises = Number(updateResult.affectedRows || 0);
  }

  const afterSummary = await getFuturePlanSummary(conn, programId, afterDayOrder);
  const adjusted = adjustment.mode !== 'maintain' && affectedExercises > 0;
  const reasonCodes = [...adjustment.reasonCodes, `week:${currentWeek}`, `variant:${experiment.variantKey}`];

  const [adaptLog] = await conn.execute(
    `INSERT INTO plan_adaptations
       (user_id, program_id, adaptation_date, trigger_source, confidence_score, previous_plan_json, adapted_plan_json, change_summary_json, reason_codes_json, reviewed_by_coach)
     VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, 0)`,
    [
      userId,
      programId,
      adjustment.triggerSource,
      adjustment.inputs.confidence,
      JSON.stringify({ week: currentWeek, afterDayOrder, summary: beforeSummary }),
      JSON.stringify({ week: currentWeek, afterDayOrder, summary: afterSummary }),
      JSON.stringify({
        mode: adjustment.mode,
        adjusted,
        affectedExercises,
        deltas: {
          setDelta: adjustment.setDelta,
          rpeDelta: adjustment.rpeDelta,
          restDeltaSeconds: adjustment.restDelta,
          weightMultiplier: adjustment.weightMultiplier,
        },
        frequencyAdjustmentRecommendation: adjustment.frequencyAdjustment,
        scores: insightBundle.scores,
        safety: insightBundle.safety || null,
        experiment: {
          key: experiment.experimentKey,
          variant: experiment.variantKey,
          assignmentSource: experiment.assignmentSource,
          thresholds: adjustment.thresholds,
        },
      }),
      JSON.stringify(reasonCodes),
    ],
  );

  if (adjusted) {
    const changeReason = adjustment.mode === 'deload' ? 'injury_adjustment' : 'user_request';
    const notes = `weekly_auto:week=${currentWeek};mode=${adjustment.mode};setDelta=${adjustment.setDelta};rpeDelta=${adjustment.rpeDelta};restDelta=${adjustment.restDelta};trigger=${String(trigger || 'weekly_analysis').toLowerCase()}`;
    try {
      await conn.execute(
        `INSERT INTO program_change_log
          (assignment_id, user_id, old_program_id, new_program_id, changed_by_user_id, change_reason, notes)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`,
        [assignmentId, userId, programId, programId, changeReason, notes],
      );
    } catch {
      // Non-fatal: workout_exercises + plan_adaptations already persisted.
    }
  }

  let validationSnapshot = null;
  try {
    validationSnapshot = await captureWeeklyValidationSnapshot(conn, {
      userId,
      programId,
      assignmentId,
      adaptationId: Number(adaptLog.insertId || 0),
      source: 'auto_weekly',
      experiment,
    });
  } catch {
    validationSnapshot = null;
  }

  return {
    adapted: adjusted,
    weeklyBlock: currentWeek,
    assignmentId,
    programId,
    adaptationId: Number(adaptLog.insertId || 0),
    mode: adjustment.mode,
    triggerSource: adjustment.triggerSource,
    affectedExercises,
    scores: insightBundle.scores,
    experiment: {
      key: experiment.experimentKey,
      variant: experiment.variantKey,
      assignmentSource: experiment.assignmentSource,
    },
    validationSnapshot,
    summary: {
      before: beforeSummary,
      after: afterSummary,
    },
    deltas: {
      setDelta: adjustment.setDelta,
      rpeDelta: adjustment.rpeDelta,
      restDeltaSeconds: adjustment.restDelta,
      weightMultiplier: adjustment.weightMultiplier,
      frequencyAdjustmentRecommendation: adjustment.frequencyAdjustment,
    },
    reasonCodes,
  };
};
