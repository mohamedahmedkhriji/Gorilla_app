import { selectEnduranceSplit } from '../scheduling/splitSelector.js';

export const enduranceStrategy = (profile) => ({
  strategyId: 'endurance',
  split: selectEnduranceSplit(profile),
  workloadBias: 'aerobic_development_with_limited_hard_sessions',
});
