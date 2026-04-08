import benchPressImage from '../../assets/Workout/Bench Press.png';
import challengeHeroImage from '../../assets/Workout/CHALLENGE.png';
import deadliftImage from '../../assets/Workout/Deadlift.png';
import pushUpDuelImage from '../../assets/Workout/Push-Up Duel.png';
import squatRepRaceImage from '../../assets/Workout/Squat Rep Race.png';

export type FriendChallengeKey =
  | 'push_until_failure'
  | 'plank_survivor'
  | 'rep_madness'
  | 'volume_destroyer'
  | 'upper_body_war'
  | 'fast_grinder'
  | 'perfect_athlete'
  | 'bench_press_king'
  | 'deadlift_monster'
  | 'squat_titan'
  | 'squat_rep_race';

export type FriendChallengeSessionType = 'numeric' | 'weight';
export type FriendChallengeComparison = 'higher' | 'lower';
export type FriendChallengeUnit = 'reps' | 'seconds' | 'score' | 'kg';

export type FriendChallengeDefinition = {
  key: FriendChallengeKey;
  id: string;
  title: string;
  image: string;
  accentClassName: string;
  available: boolean;
  sessionType: FriendChallengeSessionType;
  comparison: FriendChallengeComparison;
  unit: FriendChallengeUnit;
  step: number;
  min: number;
  heroSubtitle: string;
  valueLabel: string;
  totalLabel: string;
  entryLabel: string;
  resultLabel: string;
  availableInCards?: boolean;
  legacy?: boolean;
};

const FRIEND_CHALLENGE_ALIASES: Record<string, FriendChallengeKey> = {
  push_up_duel: 'push_until_failure',
  bench_press: 'bench_press_king',
  deadlift_one: 'deadlift_monster',
};

export const FRIEND_CHALLENGE_DEFINITIONS: Record<FriendChallengeKey, FriendChallengeDefinition> = {
  push_until_failure: {
    key: 'push_until_failure',
    id: 'push-until-failure',
    title: 'Push Until Failure',
    image: pushUpDuelImage,
    accentClassName: 'from-[#bbff5c]/30 via-[#bbff5c]/10 to-transparent',
    available: true,
    sessionType: 'numeric',
    comparison: 'higher',
    unit: 'reps',
    step: 1,
    min: 0,
    heroSubtitle: 'Each player submits their best push-up set. Higher reps wins the round.',
    valueLabel: 'Reps',
    totalLabel: 'Total reps',
    entryLabel: 'Round reps',
    resultLabel: 'Push-up score',
    availableInCards: true,
  },
  plank_survivor: {
    key: 'plank_survivor',
    id: 'plank-survivor',
    title: 'Plank Survivor',
    image: challengeHeroImage,
    accentClassName: 'from-[#38bdf8]/28 via-[#38bdf8]/8 to-transparent',
    available: true,
    sessionType: 'numeric',
    comparison: 'higher',
    unit: 'seconds',
    step: 5,
    min: 0,
    heroSubtitle: 'Hold the plank longer. Higher total seconds wins the round.',
    valueLabel: 'Seconds',
    totalLabel: 'Total seconds',
    entryLabel: 'Round time',
    resultLabel: 'Hold time',
    availableInCards: true,
  },
  rep_madness: {
    key: 'rep_madness',
    id: 'rep-madness',
    title: 'Rep Madness',
    image: pushUpDuelImage,
    accentClassName: 'from-[#f97316]/28 via-[#f97316]/8 to-transparent',
    available: true,
    sessionType: 'numeric',
    comparison: 'higher',
    unit: 'reps',
    step: 1,
    min: 0,
    heroSubtitle: 'Submit your best rep total for the round. More reps wins.',
    valueLabel: 'Reps',
    totalLabel: 'Total reps',
    entryLabel: 'Round reps',
    resultLabel: 'Rep score',
    availableInCards: true,
  },
  volume_destroyer: {
    key: 'volume_destroyer',
    id: 'volume-destroyer',
    title: 'Volume Destroyer',
    image: squatRepRaceImage,
    accentClassName: 'from-[#22d3ee]/28 via-[#22d3ee]/8 to-transparent',
    available: true,
    sessionType: 'numeric',
    comparison: 'higher',
    unit: 'score',
    step: 10,
    min: 0,
    heroSubtitle: 'Enter total training volume for the round. Higher score wins.',
    valueLabel: 'Volume',
    totalLabel: 'Total volume',
    entryLabel: 'Round volume',
    resultLabel: 'Volume score',
    availableInCards: true,
  },
  upper_body_war: {
    key: 'upper_body_war',
    id: 'upper-body-war',
    title: 'Upper Body War',
    image: squatRepRaceImage,
    accentClassName: 'from-[#a78bfa]/28 via-[#a78bfa]/8 to-transparent',
    available: true,
    sessionType: 'numeric',
    comparison: 'higher',
    unit: 'reps',
    step: 1,
    min: 0,
    heroSubtitle: 'Count total upper-body reps for the round. Higher reps wins.',
    valueLabel: 'Reps',
    totalLabel: 'Total reps',
    entryLabel: 'Round reps',
    resultLabel: 'Upper-body score',
    availableInCards: true,
  },
  fast_grinder: {
    key: 'fast_grinder',
    id: 'fast-grinder',
    title: 'Fast Grinder',
    image: challengeHeroImage,
    accentClassName: 'from-[#f59e0b]/28 via-[#f59e0b]/8 to-transparent',
    available: true,
    sessionType: 'numeric',
    comparison: 'lower',
    unit: 'seconds',
    step: 5,
    min: 0,
    heroSubtitle: 'Finish faster with valid reps. Lower time wins the round.',
    valueLabel: 'Seconds',
    totalLabel: 'Total time',
    entryLabel: 'Round time',
    resultLabel: 'Completion time',
    availableInCards: true,
  },
  perfect_athlete: {
    key: 'perfect_athlete',
    id: 'perfect-athlete',
    title: 'Perfect Athlete',
    image: challengeHeroImage,
    accentClassName: 'from-[#10b981]/28 via-[#10b981]/8 to-transparent',
    available: true,
    sessionType: 'numeric',
    comparison: 'higher',
    unit: 'score',
    step: 5,
    min: 0,
    heroSubtitle: 'Submit the combined score for strength, volume, recovery, and consistency.',
    valueLabel: 'Score',
    totalLabel: 'Total score',
    entryLabel: 'Round score',
    resultLabel: 'Athlete score',
    availableInCards: true,
  },
  bench_press_king: {
    key: 'bench_press_king',
    id: 'bench-press-king',
    title: 'Bench Press King',
    image: benchPressImage,
    accentClassName: 'from-[#f59e0b]/28 via-[#f59e0b]/8 to-transparent',
    available: true,
    sessionType: 'weight',
    comparison: 'higher',
    unit: 'kg',
    step: 2.5,
    min: 0,
    heroSubtitle: 'Climb to the heaviest successful bench press. Higher weight wins.',
    valueLabel: 'Weight',
    totalLabel: 'Best weight',
    entryLabel: 'Target weight',
    resultLabel: 'Weight result',
    availableInCards: true,
  },
  deadlift_monster: {
    key: 'deadlift_monster',
    id: 'deadlift-monster',
    title: 'Deadlift Monster',
    image: deadliftImage,
    accentClassName: 'from-[#f87171]/28 via-[#f87171]/8 to-transparent',
    available: true,
    sessionType: 'weight',
    comparison: 'higher',
    unit: 'kg',
    step: 2.5,
    min: 0,
    heroSubtitle: 'Climb to the heaviest successful deadlift. Higher weight wins.',
    valueLabel: 'Weight',
    totalLabel: 'Best weight',
    entryLabel: 'Target weight',
    resultLabel: 'Weight result',
    availableInCards: true,
  },
  squat_titan: {
    key: 'squat_titan',
    id: 'squat-titan',
    title: 'Squat Titan',
    image: squatRepRaceImage,
    accentClassName: 'from-[#22d3ee]/28 via-[#22d3ee]/8 to-transparent',
    available: true,
    sessionType: 'weight',
    comparison: 'higher',
    unit: 'kg',
    step: 2.5,
    min: 0,
    heroSubtitle: 'Climb to the heaviest successful squat. Higher weight wins.',
    valueLabel: 'Weight',
    totalLabel: 'Best weight',
    entryLabel: 'Target weight',
    resultLabel: 'Weight result',
    availableInCards: true,
  },
  squat_rep_race: {
    key: 'squat_rep_race',
    id: 'squat-rep-race',
    title: 'Squat Rep Race',
    image: squatRepRaceImage,
    accentClassName: 'from-[#22d3ee]/28 via-[#22d3ee]/8 to-transparent',
    available: true,
    sessionType: 'numeric',
    comparison: 'higher',
    unit: 'reps',
    step: 1,
    min: 0,
    heroSubtitle: 'Legacy challenge. More squat reps wins the round.',
    valueLabel: 'Reps',
    totalLabel: 'Total reps',
    entryLabel: 'Round reps',
    resultLabel: 'Rep score',
    availableInCards: false,
    legacy: true,
  },
};

const slugifyChallengeValue = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const resolveFriendChallengeKey = (value: string | null | undefined): FriendChallengeKey | null => {
  const normalized = slugifyChallengeValue(value || '');
  if (!normalized) return null;
  const fromAlias = FRIEND_CHALLENGE_ALIASES[normalized];
  if (fromAlias) return fromAlias;
  if (normalized in FRIEND_CHALLENGE_DEFINITIONS) {
    return normalized as FriendChallengeKey;
  }
  return null;
};

export const getFriendChallengeByKey = (value: string | null | undefined): FriendChallengeDefinition | null => {
  const resolved = resolveFriendChallengeKey(value);
  return resolved ? FRIEND_CHALLENGE_DEFINITIONS[resolved] : null;
};

export const getFriendChallengeByCardId = (cardId: string | null | undefined): FriendChallengeDefinition | null => {
  const normalized = String(cardId || '').trim().toLowerCase();
  const match = Object.values(FRIEND_CHALLENGE_DEFINITIONS).find((definition) => definition.id === normalized);
  return match || null;
};

export const toFriendChallengeKey = (cardId: string | null | undefined): FriendChallengeKey | null =>
  getFriendChallengeByCardId(cardId)?.key || resolveFriendChallengeKey(cardId);

export const toFriendChallengeCardId = (challengeKey: string | null | undefined): string => {
  const challenge = getFriendChallengeByKey(challengeKey);
  return challenge?.id || FRIEND_CHALLENGE_DEFINITIONS.push_until_failure.id;
};

export const isStrengthFriendChallenge = (challengeKey: string | null | undefined) =>
  getFriendChallengeByKey(challengeKey)?.sessionType === 'weight';

export const compareFriendChallengeValues = (
  leftValue: number,
  rightValue: number,
  challengeKey: string | null | undefined,
) => {
  const challenge = getFriendChallengeByKey(challengeKey);
  if (!challenge) {
    if (leftValue === rightValue) return 0;
    return leftValue > rightValue ? 1 : -1;
  }
  if (leftValue === rightValue) return 0;
  if (challenge.comparison === 'lower') {
    return leftValue < rightValue ? 1 : -1;
  }
  return leftValue > rightValue ? 1 : -1;
};

export const getVisibleFriendChallengeCards = () =>
  Object.values(FRIEND_CHALLENGE_DEFINITIONS).filter((definition) => definition.availableInCards !== false);

export const FRIEND_CHALLENGE_BADGE_KEYS = [
  'push_until_failure',
  'plank_survivor',
  'rep_madness',
  'volume_destroyer',
  'upper_body_war',
  'fast_grinder',
  'perfect_athlete',
  'bench_press_king',
  'deadlift_monster',
  'squat_titan',
] satisfies FriendChallengeKey[];
