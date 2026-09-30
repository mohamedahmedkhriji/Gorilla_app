import { selectBodybuildingSplit } from '../scheduling/splitSelector.js';

export const bulkingStrategy = (profile) => ({
  strategyId: 'bulking',
  split: selectBodybuildingSplit(profile),
  workloadBias: 'productive_resistance_training_without_automatic_volume_inflation',
});
