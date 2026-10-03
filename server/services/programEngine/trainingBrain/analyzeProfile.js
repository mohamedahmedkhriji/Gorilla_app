import { buildTrainingStrategy } from './buildTrainingStrategy.js';

export const analyzeTrainingProfile = (profileOrInput = {}, options = {}) =>
  buildTrainingStrategy(profileOrInput, options);
