import pool from '../../../database.js';
import { listSupabaseExercises } from '../../supabaseExerciseCatalogService.js';

const normalizeSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const normalizeEquipment = (value) => {
  const text = String(value || '').trim();
  if (/body only/i.test(text)) return 'Bodyweight';
  if (/lever/i.test(text)) return 'Machine';
  return text || null;
};

const mysqlExerciseRowToCatalogExercise = (row) => {
  const muscle = row.body_part || 'Full Body';
  return {
    id: Number(row.id),
    name: row.canonical_name,
    slug: normalizeSlug(row.canonical_name),
    description: row.description || null,
    equipment: normalizeEquipment(row.equipment),
    difficultyLevel: Number(row.difficulty_tier || 2) || 2,
    difficulty: Number(row.difficulty_tier || 2) || 2,
    mechanics: row.mechanics || null,
    forceType: row.force_type || null,
    muscle,
    bodyPart: muscle,
    categories: [{ name: muscle, slug: normalizeSlug(muscle) }],
    muscles: [{ name: muscle, muscleGroup: muscle, role: 'primary' }],
    primaryMedia: null,
  };
};

export const loadMysqlProgramEngineCatalog = async ({ limit = 5000 } = {}) => {
  const safeLimit = Math.max(1, Math.min(5000, Number(limit) || 5000));
  const [rows] = await pool.execute(
    `SELECT id, canonical_name, description, exercise_type, body_part, equipment,
            level, mechanics, force_type, difficulty_tier
     FROM exercise_catalog
     WHERE is_active = 1
       AND canonical_name IS NOT NULL
       AND canonical_name <> ''
     ORDER BY id ASC
     LIMIT ${safeLimit}`,
  );

  return rows.map(mysqlExerciseRowToCatalogExercise);
};

export const loadSupabaseProgramEngineCatalog = async ({
  gender = null,
  client,
  limit = 1000,
} = {}) => {
  try {
    const result = await listSupabaseExercises({
      gender,
      client,
      limit,
      offset: 0,
    });

    return Array.isArray(result?.exercises) ? result.exercises : [];
  } catch (error) {
    if (!/supabase is not configured/i.test(error?.message || '')) {
      throw error;
    }
    return loadMysqlProgramEngineCatalog({ limit: Math.max(limit, 5000) });
  }
};

export const createStaticCatalogProvider = (exercises = []) => async () => exercises;
