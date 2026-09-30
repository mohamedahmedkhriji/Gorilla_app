import { selectPowerliftingSplit } from '../scheduling/splitSelector.js';

export const powerliftingStrategy = (profile) => ({
  strategyId: 'powerlifting',
  split: selectPowerliftingSplit(profile),
  workloadBias: 'squat_bench_deadlift_exposure',
});
