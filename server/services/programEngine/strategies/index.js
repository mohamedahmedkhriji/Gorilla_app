import { bulkingStrategy } from './bulking.js';
import { cuttingStrategy } from './cutting.js';
import { enduranceStrategy } from './endurance.js';
import { fatLossStrategy } from './fatLoss.js';
import { hypertrophyStrategy } from './hypertrophy.js';
import { powerliftingStrategy } from './powerlifting.js';

const STRATEGIES = Object.freeze({
  hypertrophy: hypertrophyStrategy,
  powerlifting: powerliftingStrategy,
  cutting: cuttingStrategy,
  bulking: bulkingStrategy,
  fat_loss: fatLossStrategy,
  endurance: enduranceStrategy,
});

export const getGoalStrategy = (goal) => STRATEGIES[goal] ?? null;
