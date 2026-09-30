import { listSupabaseExercises } from '../../supabaseExerciseCatalogService.js';

export const loadSupabaseProgramEngineCatalog = async ({
  gender = null,
  client,
  limit = 1000,
} = {}) => {
  const result = await listSupabaseExercises({
    gender,
    client,
    limit,
    offset: 0,
  });

  return Array.isArray(result?.exercises) ? result.exercises : [];
};

export const createStaticCatalogProvider = (exercises = []) => async () => exercises;
