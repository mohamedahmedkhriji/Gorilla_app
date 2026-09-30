import { selectFatLossSplit } from '../scheduling/splitSelector.js';

export const fatLossStrategy = (profile) => ({
  strategyId: 'fat_loss',
  split: selectFatLossSplit(profile),
  workloadBias: 'resistance_training_plus_cardiovascular_work',
});
