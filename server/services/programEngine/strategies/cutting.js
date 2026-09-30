import { selectBodybuildingSplit } from '../scheduling/splitSelector.js';

export const cuttingStrategy = (profile) => ({
  strategyId: 'cutting',
  split: selectBodybuildingSplit(profile),
  workloadBias: 'muscle_and_performance_retention_with_fatigue_control',
});
