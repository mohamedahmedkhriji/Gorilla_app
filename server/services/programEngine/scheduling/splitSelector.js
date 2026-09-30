const split = (id, name, sessionSequence) => ({ id, name, sessionSequence });

const BODYBUILDING_SPLITS = Object.freeze({
  2: split('full_body_ab', 'Full Body A / Full Body B', [
    { sessionType: 'full_body_a', dayPurpose: 'full_body_strength_balance' },
    { sessionType: 'full_body_b', dayPurpose: 'full_body_posterior_pull_balance' },
  ]),
  3: {
    beginner: split('full_body_abc', 'Full Body A / B / C', [
      { sessionType: 'full_body_a', dayPurpose: 'full_body_squat_press_pull' },
      { sessionType: 'full_body_b', dayPurpose: 'full_body_hinge_press_pull' },
      { sessionType: 'full_body_c', dayPurpose: 'full_body_balanced_accessory' },
    ]),
    intermediate: split('full_body_abc', 'Full Body A / B / C', [
      { sessionType: 'full_body_a', dayPurpose: 'full_body_squat_press_pull' },
      { sessionType: 'full_body_b', dayPurpose: 'full_body_hinge_press_pull' },
      { sessionType: 'full_body_c', dayPurpose: 'full_body_balanced_accessory' },
    ]),
    advanced: split('full_body_abc', 'Full Body A / B / C', [
      { sessionType: 'full_body_a', dayPurpose: 'full_body_squat_press_pull' },
      { sessionType: 'full_body_b', dayPurpose: 'full_body_hinge_press_pull' },
      { sessionType: 'full_body_c', dayPurpose: 'full_body_balanced_accessory' },
    ]),
  },
  4: split('upper_lower', 'Upper / Lower / Upper / Lower', [
    { sessionType: 'upper', dayPurpose: 'upper_body_balanced' },
    { sessionType: 'lower', dayPurpose: 'lower_body_balanced' },
    { sessionType: 'upper', dayPurpose: 'upper_body_balanced' },
    { sessionType: 'lower', dayPurpose: 'lower_body_balanced' },
  ]),
  5: split('ppl_upper_lower', 'Push / Pull / Legs / Upper / Lower', [
    { sessionType: 'push', dayPurpose: 'push_muscles' },
    { sessionType: 'pull', dayPurpose: 'pull_muscles' },
    { sessionType: 'legs', dayPurpose: 'lower_body_full' },
    { sessionType: 'upper', dayPurpose: 'upper_body_balanced' },
    { sessionType: 'lower', dayPurpose: 'lower_body_balanced' },
  ]),
  6: split('ppl_x2', 'Push / Pull / Legs x2', [
    { sessionType: 'push', dayPurpose: 'push_muscles' },
    { sessionType: 'pull', dayPurpose: 'pull_muscles' },
    { sessionType: 'legs', dayPurpose: 'lower_body_full' },
    { sessionType: 'push', dayPurpose: 'push_muscles' },
    { sessionType: 'pull', dayPurpose: 'pull_muscles' },
    { sessionType: 'legs', dayPurpose: 'lower_body_full' },
  ]),
});

const POWERLIFTING_SPLITS = Object.freeze({
  2: split('powerlifting_2_day', 'Powerlifting Full Body A / B', [
    { sessionType: 'pl_squat_bench', dayPurpose: 'squat_and_bench_exposure' },
    { sessionType: 'pl_deadlift_bench', dayPurpose: 'deadlift_and_bench_exposure' },
  ]),
  3: split('powerlifting_3_day', 'Squat / Bench / Deadlift Emphasis', [
    { sessionType: 'pl_squat_bench', dayPurpose: 'squat_primary_bench_secondary' },
    { sessionType: 'pl_bench_upper', dayPurpose: 'bench_primary_upper_support' },
    { sessionType: 'pl_deadlift_bench', dayPurpose: 'deadlift_primary_bench_secondary' },
  ]),
  4: split('powerlifting_4_day', 'Squat Bench / Upper / Deadlift Bench / Lower', [
    { sessionType: 'pl_squat_bench', dayPurpose: 'squat_and_bench_exposure' },
    { sessionType: 'pl_bench_upper', dayPurpose: 'bench_volume_upper_back' },
    { sessionType: 'pl_deadlift_bench', dayPurpose: 'deadlift_and_bench_exposure' },
    { sessionType: 'pl_lower', dayPurpose: 'lower_accessory_strength' },
  ]),
  5: split('powerlifting_5_day', 'Powerlifting Strength Five-Day', [
    { sessionType: 'pl_squat_bench', dayPurpose: 'squat_and_bench_exposure' },
    { sessionType: 'pl_bench_upper', dayPurpose: 'bench_volume_upper_back' },
    { sessionType: 'pl_deadlift_bench', dayPurpose: 'deadlift_and_bench_exposure' },
    { sessionType: 'pl_bench_upper', dayPurpose: 'bench_technique_upper_support' },
    { sessionType: 'pl_lower', dayPurpose: 'squat_deadlift_accessory' },
  ]),
  6: split('powerlifting_6_day', 'Powerlifting Strength Six-Day', [
    { sessionType: 'pl_squat_bench', dayPurpose: 'squat_and_bench_exposure' },
    { sessionType: 'pl_bench_upper', dayPurpose: 'bench_volume_upper_back' },
    { sessionType: 'pl_deadlift_bench', dayPurpose: 'deadlift_and_bench_exposure' },
    { sessionType: 'pl_bench_upper', dayPurpose: 'bench_technique_upper_support' },
    { sessionType: 'pl_lower', dayPurpose: 'squat_deadlift_accessory' },
    { sessionType: 'pl_bench_upper', dayPurpose: 'bench_accessory_upper_back' },
  ]),
});

const FAT_LOSS_SPLITS = Object.freeze({
  2: split('fat_loss_2_day', 'Resistance + Conditioning A / B', [
    { sessionType: 'fat_loss_resistance', dayPurpose: 'resistance_body_composition' },
    { sessionType: 'fat_loss_cardio', dayPurpose: 'cardio_conditioning_support' },
  ]),
  3: split('fat_loss_3_day', 'Resistance / Cardio / Resistance', [
    { sessionType: 'fat_loss_resistance', dayPurpose: 'resistance_body_composition' },
    { sessionType: 'fat_loss_cardio', dayPurpose: 'cardio_conditioning_support' },
    { sessionType: 'fat_loss_resistance', dayPurpose: 'resistance_body_composition' },
  ]),
  4: split('fat_loss_4_day', 'Upper / Lower / Conditioning / Full Body', [
    { sessionType: 'upper', dayPurpose: 'upper_body_resistance' },
    { sessionType: 'lower', dayPurpose: 'lower_body_resistance' },
    { sessionType: 'fat_loss_cardio', dayPurpose: 'cardio_conditioning_support' },
    { sessionType: 'fat_loss_resistance', dayPurpose: 'full_body_resistance' },
  ]),
  5: split('fat_loss_5_day', 'Push / Pull / Legs / Cardio / Full Body', [
    { sessionType: 'push', dayPurpose: 'push_resistance' },
    { sessionType: 'pull', dayPurpose: 'pull_resistance' },
    { sessionType: 'legs', dayPurpose: 'lower_body_resistance' },
    { sessionType: 'fat_loss_cardio', dayPurpose: 'cardio_conditioning_support' },
    { sessionType: 'fat_loss_resistance', dayPurpose: 'full_body_resistance' },
  ]),
});

const ENDURANCE_SPLITS = Object.freeze({
  2: split('endurance_2_day', 'Easy Aerobic / Long Aerobic', [
    { sessionType: 'easy_aerobic', dayPurpose: 'easy_aerobic_base' },
    { sessionType: 'long_aerobic', dayPurpose: 'long_aerobic_base' },
  ]),
  3: split('endurance_3_day', 'Easy / Tempo / Long', [
    { sessionType: 'easy_aerobic', dayPurpose: 'easy_aerobic_base' },
    { sessionType: 'tempo', dayPurpose: 'controlled_threshold_work' },
    { sessionType: 'long_aerobic', dayPurpose: 'long_aerobic_base' },
  ]),
  4: split('endurance_4_day', 'Easy / Tempo / Recovery / Long', [
    { sessionType: 'easy_aerobic', dayPurpose: 'easy_aerobic_base' },
    { sessionType: 'tempo', dayPurpose: 'controlled_threshold_work' },
    { sessionType: 'recovery', dayPurpose: 'low_stress_recovery' },
    { sessionType: 'long_aerobic', dayPurpose: 'long_aerobic_base' },
  ]),
  5: split('endurance_5_day', 'Easy / Tempo / Recovery / Interval / Long', [
    { sessionType: 'easy_aerobic', dayPurpose: 'easy_aerobic_base' },
    { sessionType: 'tempo', dayPurpose: 'controlled_threshold_work' },
    { sessionType: 'recovery', dayPurpose: 'low_stress_recovery' },
    { sessionType: 'interval', dayPurpose: 'high_intensity_interval' },
    { sessionType: 'long_aerobic', dayPurpose: 'long_aerobic_base' },
  ]),
  6: split('endurance_6_day', 'Easy / Tempo / Recovery / Easy / Interval / Long', [
    { sessionType: 'easy_aerobic', dayPurpose: 'easy_aerobic_base' },
    { sessionType: 'tempo', dayPurpose: 'controlled_threshold_work' },
    { sessionType: 'recovery', dayPurpose: 'low_stress_recovery' },
    { sessionType: 'easy_aerobic', dayPurpose: 'easy_aerobic_base' },
    { sessionType: 'interval', dayPurpose: 'high_intensity_interval' },
    { sessionType: 'long_aerobic', dayPurpose: 'long_aerobic_base' },
  ]),
});

const SPLITS_BY_ID = Object.freeze([
  ...Object.values(BODYBUILDING_SPLITS).flatMap((entry) => (entry?.id ? [entry] : Object.values(entry || {}))),
  ...Object.values(POWERLIFTING_SPLITS),
  ...Object.values(FAT_LOSS_SPLITS),
  ...Object.values(ENDURANCE_SPLITS),
].reduce((acc, entry) => {
  if (entry?.id) acc[entry.id] = entry;
  return acc;
}, {}));

const normalizeSplitOverrideKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s-]+/g, '_');

const splitIdForOverride = ({ splitPreference, profile }) => {
  const key = normalizeSplitOverrideKey(splitPreference);
  if (!key || key === 'auto' || key === 'ai_coach' || key === 'ai_coach_plan') return null;

  const daysPerWeek = Number(profile?.daysPerWeek);
  const goal = String(profile?.goal || '').trim().toLowerCase();

  if (goal === 'powerlifting') {
    if (['full_body', 'full_body_ab', 'full_body_abc'].includes(key) && [2, 3].includes(daysPerWeek)) {
      return `powerlifting_${daysPerWeek}_day`;
    }
    if (['upper_lower', 'strength_split'].includes(key) && daysPerWeek === 4) return 'powerlifting_4_day';
    return null;
  }

  if (goal === 'fat_loss') {
    if (key === 'full_body' && [2, 3].includes(daysPerWeek)) return `fat_loss_${daysPerWeek}_day`;
    if (key === 'upper_lower' && daysPerWeek === 4) return 'fat_loss_4_day';
    if (['hybrid', 'ppl_upper_lower', 'split_push'].includes(key) && daysPerWeek === 5) return 'fat_loss_5_day';
    return null;
  }

  if (goal === 'endurance') {
    return key.startsWith('endurance') && SPLITS_BY_ID[`endurance_${daysPerWeek}_day`]
      ? `endurance_${daysPerWeek}_day`
      : null;
  }

  if (key === 'full_body') {
    if (daysPerWeek === 2) return 'full_body_ab';
    if (daysPerWeek === 3) return 'full_body_abc';
  }
  if (key === 'upper_lower' && daysPerWeek === 4) return 'upper_lower';
  if (key === 'push_pull_legs' && daysPerWeek === 6) return 'ppl_x2';
  if (['hybrid', 'ppl_upper_lower', 'split_push'].includes(key) && daysPerWeek === 5) return 'ppl_upper_lower';
  if (SPLITS_BY_ID[key]?.sessionSequence?.length === daysPerWeek) return key;
  return null;
};

export const selectBodybuildingSplit = ({ experience, daysPerWeek }) => {
  const rule = BODYBUILDING_SPLITS[daysPerWeek];
  return rule?.id ? rule : rule?.[experience] ?? rule?.intermediate ?? null;
};

export const selectPowerliftingSplit = ({ daysPerWeek }) => POWERLIFTING_SPLITS[daysPerWeek] ?? null;

export const selectFatLossSplit = ({ daysPerWeek }) => FAT_LOSS_SPLITS[daysPerWeek] ?? null;

export const selectEnduranceSplit = ({ daysPerWeek, experience }) => {
  if (experience === 'beginner' && daysPerWeek >= 5) return ENDURANCE_SPLITS[4];
  return ENDURANCE_SPLITS[daysPerWeek] ?? null;
};

export const getProgramEngineSplitById = (splitId) => SPLITS_BY_ID[splitId] ?? null;

export const resolveProgramEngineSplitOverride = ({ splitPreference, profile, recommendedSplit }) => {
  const normalized = normalizeSplitOverrideKey(splitPreference);
  if (!normalized || normalized === 'auto' || normalized === 'ai_coach' || normalized === 'ai_coach_plan') {
    return {
      split: recommendedSplit,
      applied: false,
      requestedSplitPreference: normalized || 'auto',
    };
  }

  const splitId = splitIdForOverride({ splitPreference: normalized, profile });
  const split = splitId ? getProgramEngineSplitById(splitId) : null;
  if (!split) {
    return {
      split: null,
      applied: false,
      requestedSplitPreference: normalized,
      error: {
        code: 'INCOMPATIBLE_SPLIT_OVERRIDE',
        message: `Split preference ${normalized} is not compatible with ${profile?.goal || 'this goal'} at ${profile?.daysPerWeek || '?'} days/week.`,
      },
    };
  }

  return {
    split,
    applied: split.id !== recommendedSplit?.id,
    requestedSplitPreference: normalized,
  };
};
