const firstRecordBadge = new URL('../../assets/badges/firstRecord.webp', import.meta.url).href;
const firstRecordBadgeOff = new URL('../../assets/badges/firstRecord_off.webp', import.meta.url).href;
const firstRoutineBadge = new URL('../../assets/badges/firstRoutine.webp', import.meta.url).href;
const firstRoutineBadgeOff = new URL('../../assets/badges/firstRoutine_off.webp', import.meta.url).href;
const firstStepBadge = new URL('../../assets/badges/firstStep.webp', import.meta.url).href;
const firstStepBadgeOff = new URL('../../assets/badges/firstStep_off.webp', import.meta.url).href;
const firstWorkoutBadge = new URL('../../assets/badges/firstWorkout.webp', import.meta.url).href;
const firstWorkoutBadgeOff = new URL('../../assets/badges/firstWorkout_off.webp', import.meta.url).href;
const hours10Badge = new URL('../../assets/badges/hours10.webp', import.meta.url).href;
const hours10BadgeOff = new URL('../../assets/badges/hours10_off.webp', import.meta.url).href;
const hours50Badge = new URL('../../assets/badges/hours50.webp', import.meta.url).href;
const hours50BadgeOff = new URL('../../assets/badges/hours50_off.webp', import.meta.url).href;
const hours100Badge = new URL('../../assets/badges/hours100.webp', import.meta.url).href;
const hours100BadgeOff = new URL('../../assets/badges/hours100_off.webp', import.meta.url).href;
const sets100Badge = new URL('../../assets/badges/sets100.webp', import.meta.url).href;
const sets100BadgeOff = new URL('../../assets/badges/sets100_off.webp', import.meta.url).href;
const sets1000Badge = new URL('../../assets/badges/sets1000.webp', import.meta.url).href;
const sets1000BadgeOff = new URL('../../assets/badges/sets1000_off.webp', import.meta.url).href;
const streak3Badge = new URL('../../assets/badges/streak3.webp', import.meta.url).href;
const streak3BadgeOff = new URL('../../assets/badges/streak3_off.webp', import.meta.url).href;
const streak7Badge = new URL('../../assets/badges/streak7.webp', import.meta.url).href;
const streak7BadgeOff = new URL('../../assets/badges/streak7_off.webp', import.meta.url).href;
const streak30Badge = new URL('../../assets/badges/streak30.webp', import.meta.url).href;
const streak30BadgeOff = new URL('../../assets/badges/streak30_off.webp', import.meta.url).href;
const streak100Badge = new URL('../../assets/badges/streak100.webp', import.meta.url).href;
const streak100BadgeOff = new URL('../../assets/badges/streak100_off.webp', import.meta.url).href;
const tonne1Badge = new URL('../../assets/badges/tonne1.webp', import.meta.url).href;
const tonne1BadgeOff = new URL('../../assets/badges/tonne1_off.webp', import.meta.url).href;
const tonnes10Badge = new URL('../../assets/badges/tonnes10.webp', import.meta.url).href;
const tonnes10BadgeOff = new URL('../../assets/badges/tonnes10_off.webp', import.meta.url).href;
const tonnes100Badge = new URL('../../assets/badges/tonnes100.webp', import.meta.url).href;
const tonnes100BadgeOff = new URL('../../assets/badges/tonnes100_off.webp', import.meta.url).href;
const workouts10Badge = new URL('../../assets/badges/workouts10.webp', import.meta.url).href;
const workouts10BadgeOff = new URL('../../assets/badges/workouts10_off.webp', import.meta.url).href;
const workouts50Badge = new URL('../../assets/badges/workouts50.webp', import.meta.url).href;
const workouts50BadgeOff = new URL('../../assets/badges/workouts50_off.webp', import.meta.url).href;
const workouts100Badge = new URL('../../assets/badges/workouts100.webp', import.meta.url).href;
const workouts100BadgeOff = new URL('../../assets/badges/workouts100_off.webp', import.meta.url).href;
const workouts365Badge = new URL('../../assets/badges/workouts365.webp', import.meta.url).href;
const workouts365BadgeOff = new URL('../../assets/badges/workouts365_off.webp', import.meta.url).href;

type BadgePair = {
  active: string;
  locked: string;
};

type MissionBadgeInput = {
  title?: unknown;
  description?: unknown;
  metricKey?: unknown;
  target?: unknown;
  completed?: unknown;
  type?: unknown;
  category?: unknown;
};

const BADGES = {
  firstRecord: { active: firstRecordBadge, locked: firstRecordBadgeOff },
  firstRoutine: { active: firstRoutineBadge, locked: firstRoutineBadgeOff },
  firstStep: { active: firstStepBadge, locked: firstStepBadgeOff },
  firstWorkout: { active: firstWorkoutBadge, locked: firstWorkoutBadgeOff },
  hours10: { active: hours10Badge, locked: hours10BadgeOff },
  hours50: { active: hours50Badge, locked: hours50BadgeOff },
  hours100: { active: hours100Badge, locked: hours100BadgeOff },
  sets100: { active: sets100Badge, locked: sets100BadgeOff },
  sets1000: { active: sets1000Badge, locked: sets1000BadgeOff },
  streak3: { active: streak3Badge, locked: streak3BadgeOff },
  streak7: { active: streak7Badge, locked: streak7BadgeOff },
  streak30: { active: streak30Badge, locked: streak30BadgeOff },
  streak100: { active: streak100Badge, locked: streak100BadgeOff },
  tonne1: { active: tonne1Badge, locked: tonne1BadgeOff },
  tonnes10: { active: tonnes10Badge, locked: tonnes10BadgeOff },
  tonnes100: { active: tonnes100Badge, locked: tonnes100BadgeOff },
  workouts10: { active: workouts10Badge, locked: workouts10BadgeOff },
  workouts50: { active: workouts50Badge, locked: workouts50BadgeOff },
  workouts100: { active: workouts100Badge, locked: workouts100BadgeOff },
  workouts365: { active: workouts365Badge, locked: workouts365BadgeOff },
} satisfies Record<string, BadgePair>;

const normalize = (value: unknown) => String(value || '').trim().toLowerCase();

const byTarget = (target: number, tiers: Array<[number, BadgePair]>, fallback: BadgePair) => {
  for (const [minimum, badge] of tiers) {
    if (target >= minimum) return badge;
  }
  return fallback;
};

export const getMissionBadgeImage = (input: MissionBadgeInput) => {
  const title = normalize(input.title);
  const description = normalize(input.description);
  const metricKey = normalize(input.metricKey);
  const type = normalize(input.type);
  const category = normalize(input.category);
  const target = Math.max(0, Number(input.target || 0));
  const haystack = `${title} ${description} ${metricKey} ${type} ${category}`;

  let badge: BadgePair = BADGES.firstStep;

  if (haystack.includes('workout') || haystack.includes('logged_exercises') || haystack.includes('exercise')) {
    badge = target <= 1 || haystack.includes('first') || haystack.includes('starter')
      ? BADGES.firstWorkout
      : byTarget(target, [[365, BADGES.workouts365], [100, BADGES.workouts100], [50, BADGES.workouts50], [10, BADGES.workouts10]], BADGES.workouts10);
  } else if (haystack.includes('streak') || haystack.includes('consistency') || haystack.includes('routine') || haystack.includes('plan')) {
    badge = haystack.includes('routine')
      ? BADGES.firstRoutine
      : byTarget(target, [[100, BADGES.streak100], [30, BADGES.streak30], [7, BADGES.streak7], [3, BADGES.streak3]], BADGES.streak3);
  } else if (haystack.includes('volume') || haystack.includes('tonne') || haystack.includes('lifted_weight') || haystack.includes('load')) {
    badge = byTarget(target, [[100000, BADGES.tonnes100], [10000, BADGES.tonnes10], [1000, BADGES.tonne1]], BADGES.tonne1);
  } else if (haystack.includes('set')) {
    badge = byTarget(target, [[1000, BADGES.sets1000], [100, BADGES.sets100]], BADGES.sets100);
  } else if (haystack.includes('hour') || haystack.includes('duration') || haystack.includes('time')) {
    badge = byTarget(target, [[100, BADGES.hours100], [50, BADGES.hours50], [10, BADGES.hours10]], BADGES.hours10);
  } else if (haystack.includes('record') || haystack.includes('progress') || haystack.includes('weight') || haystack.includes('rep')) {
    badge = BADGES.firstRecord;
  } else if (haystack.includes('challenge') || haystack.includes('friend') || haystack.includes('post') || haystack.includes('blog') || haystack.includes('social') || haystack.includes('coach') || haystack.includes('recovery')) {
    badge = BADGES.firstStep;
  }

  return input.completed ? badge.active : badge.locked;
};
