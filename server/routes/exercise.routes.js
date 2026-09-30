import express from 'express';
import {
  getExerciseMuscles,
  listExerciseFilters,
  listExercises,
  resolveExerciseMusclesByName,
} from '../controllers/exercise.controller.js';

const router = express.Router();

router.get('/exercises/catalog/filters', listExerciseFilters);
router.get('/exercises/catalog/muscles/resolve', resolveExerciseMusclesByName);
router.get('/exercises/catalog/:exerciseId/muscles', getExerciseMuscles);
router.get('/exercises/catalog', listExercises);

export default router;
