import express from 'express';
import {
  addHydration,
  getDailyNutritionPlan,
  getNutritionProfile,
  saveNutritionProfile,
} from '../controllers/nutrition.controller.js';

export const createNutritionRoutes = ({ authMutationRateLimit, requireAuth }) => {
  const router = express.Router();

  router.get('/nutrition/profile', requireAuth('user'), getNutritionProfile);
  router.put('/nutrition/profile', authMutationRateLimit, requireAuth('user'), saveNutritionProfile);
  router.post('/nutrition/hydration', authMutationRateLimit, requireAuth('user'), addHydration);
  router.post('/nutrition/daily-plan', requireAuth('user'), getDailyNutritionPlan);

  return router;
};

export default createNutritionRoutes;
