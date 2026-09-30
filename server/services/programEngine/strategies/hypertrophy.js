import { selectBodybuildingSplit } from '../scheduling/splitSelector.js';

export const hypertrophyStrategy = (profile) => ({
  strategyId: 'hypertrophy',
  split: selectBodybuildingSplit(profile),
  workloadBias: 'balanced_muscle_development',
});
