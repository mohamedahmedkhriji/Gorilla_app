import { getSupabaseClient } from './supabase.js';
import { selectPrimaryMedia, normalizeMediaAudience } from './exerciseMediaService.js';

const CATALOG_CACHE_TTL_MS = 2 * 60 * 1000;
const SUPABASE_PAGE_SIZE = 1000;
const EXERCISE_PREVIEW_BUCKET = 'exercise-previews';

let catalogCache = null;

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const normalizeSlug = (value) =>
  normalizeText(value)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeMediaType = (value) => {
  const key = normalizeText(value);
  if (key === 'gif' || key === 'video' || key === 'image') return key;
  return key || 'video';
};

const compareMediaOrder = (left, right) => (
  (Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
  || (Number(left.id || 0) - Number(right.id || 0))
);

const getMediaUrlBuilder = (client) => ({ storageBucket, storagePath }) => {
  if (!client || !storageBucket || !storagePath) return null;
  try {
    return client.storage.from(storageBucket).getPublicUrl(storagePath)?.data?.publicUrl || null;
  } catch {
    return null;
  }
};

const fetchAll = async (client, table, select, buildQuery = (query) => query) => {
  const rows = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const query = buildQuery(client.from(table).select(select).range(from, to));
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(Array.isArray(data) ? data : []));
    if (!Array.isArray(data) || data.length < SUPABASE_PAGE_SIZE) break;
  }
  return rows;
};

const normalizeMediaRecord = (record, getMediaUrl) => {
  const storageBucket = String(record?.storage_bucket || '').trim();
  const storagePath = String(record?.storage_path || '').trim();
  return {
    id: Number(record?.id || 0) || record?.id || null,
    mediaType: normalizeMediaType(record?.media_type),
    audience: normalizeMediaAudience(record?.audience),
    url: getMediaUrl({ storageBucket, storagePath }),
    storageBucket,
    storagePath,
    accessLevel: normalizeText(record?.access_level) || 'free',
    sortOrder: Number.isFinite(Number(record?.sort_order)) ? Number(record.sort_order) : 0,
  };
};

const buildMuscleResponse = (exercise) => {
  const muscles = Array.isArray(exercise?.muscles) ? exercise.muscles : [];
  const primaryMuscles = muscles
    .filter((muscle) => muscle.role === 'primary')
    .map((muscle) => ({ name: muscle.name, loadFactor: 1, role: muscle.role }));
  const secondaryMuscles = muscles
    .filter((muscle) => muscle.role !== 'primary')
    .map((muscle) => ({ name: muscle.name, loadFactor: 1, role: muscle.role }));

  return {
    muscles: muscles.map((muscle) => ({ name: muscle.name, loadFactor: 1, role: muscle.role })),
    primaryMuscles: primaryMuscles.length ? primaryMuscles : muscles.slice(0, 1).map((muscle) => ({ name: muscle.name, loadFactor: 1, role: muscle.role })),
    secondaryMuscles,
  };
};

const readCanonicalCatalog = async (client = getSupabaseClient()) => {
  if (!client) throw new Error('Supabase is not configured');

  const now = Date.now();
  if (catalogCache && now - catalogCache.loadedAt < CATALOG_CACHE_TTL_MS) {
    return catalogCache;
  }

  const [
    exercises,
    mediaRows,
    categoryRows,
    categoryLinks,
    muscles,
    muscleLinks,
  ] = await Promise.all([
    fetchAll(client, 'exercises', 'id,name,slug,description,equipment,difficulty,difficulty_level,preparation,execution,mechanics,force_type,is_active', (query) =>
      query.eq('is_active', true).order('name', { ascending: true })),
    fetchAll(client, 'exercise_media', 'id,exercise_id,media_type,audience,storage_bucket,storage_path,access_level,sort_order,is_active', (query) =>
      query.eq('is_active', true).order('sort_order', { ascending: true }).order('id', { ascending: true })),
    fetchAll(client, 'muscle_categories', 'id,name,slug,sort_order,is_active', (query) =>
      query.eq('is_active', true).order('sort_order', { ascending: true })),
    fetchAll(client, 'exercise_categories', 'exercise_id,category_id,is_primary'),
    fetchAll(client, 'muscles', 'id,name,slug,muscle_group,is_active', (query) =>
      query.eq('is_active', true).order('name', { ascending: true })),
    fetchAll(client, 'exercise_muscles', 'exercise_id,muscle_id,role'),
  ]);

  const getMediaUrl = getMediaUrlBuilder(client);
  const categoriesById = new Map(categoryRows.map((category) => [Number(category.id), {
    id: Number(category.id),
    name: category.name,
    slug: category.slug,
    sortOrder: Number(category.sort_order || 0),
  }]));
  const musclesById = new Map(muscles.map((muscle) => [Number(muscle.id), {
    id: Number(muscle.id),
    name: muscle.name,
    slug: muscle.slug,
    muscleGroup: muscle.muscle_group || null,
  }]));

  const mediaByExerciseId = new Map();
  mediaRows.forEach((row) => {
    if (row.storage_bucket !== EXERCISE_PREVIEW_BUCKET) return;
    const exerciseId = Number(row.exercise_id || 0);
    if (!exerciseId) return;
    const media = normalizeMediaRecord(row, getMediaUrl);
    if (!media.url) return;
    if (!mediaByExerciseId.has(exerciseId)) mediaByExerciseId.set(exerciseId, []);
    mediaByExerciseId.get(exerciseId).push(media);
  });

  const categoriesByExerciseId = new Map();
  categoryLinks.forEach((link) => {
    const exerciseId = Number(link.exercise_id || 0);
    const category = categoriesById.get(Number(link.category_id || 0));
    if (!exerciseId || !category) return;
    if (!categoriesByExerciseId.has(exerciseId)) categoriesByExerciseId.set(exerciseId, []);
    categoriesByExerciseId.get(exerciseId).push({ ...category, isPrimary: Boolean(link.is_primary) });
  });

  const musclesByExerciseId = new Map();
  muscleLinks.forEach((link) => {
    const exerciseId = Number(link.exercise_id || 0);
    const muscle = musclesById.get(Number(link.muscle_id || 0));
    if (!exerciseId || !muscle) return;
    if (!musclesByExerciseId.has(exerciseId)) musclesByExerciseId.set(exerciseId, []);
    musclesByExerciseId.get(exerciseId).push({ ...muscle, role: normalizeText(link.role) || 'secondary' });
  });

  const rows = exercises.map((exercise) => {
    const id = Number(exercise.id || 0);
    const categories = (categoriesByExerciseId.get(id) || [])
      .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary) || left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
    const exerciseMuscles = (musclesByExerciseId.get(id) || [])
      .sort((left, right) => (left.role === 'primary' ? -1 : 1) - (right.role === 'primary' ? -1 : 1) || left.name.localeCompare(right.name));
    const media = (mediaByExerciseId.get(id) || []).sort(compareMediaOrder);
    const primaryCategory = categories[0] || null;

    return {
      id,
      name: exercise.name,
      slug: exercise.slug || normalizeSlug(exercise.name),
      description: exercise.description || null,
      equipment: exercise.equipment || null,
      difficultyLevel: Number(exercise.difficulty_level ?? exercise.difficulty ?? 0) || null,
      difficulty: Number(exercise.difficulty_level ?? exercise.difficulty ?? 0) || null,
      preparation: exercise.preparation || null,
      execution: exercise.execution || null,
      mechanics: exercise.mechanics || null,
      forceType: exercise.force_type || null,
      categories,
      muscles: exerciseMuscles,
      muscle: primaryCategory?.name || exerciseMuscles[0]?.name || null,
      bodyPart: primaryCategory?.name || null,
      type: primaryCategory?.name || null,
      level: exercise.difficulty_level ? `Level ${exercise.difficulty_level}` : null,
      hasLinkedVideo: false,
      linkedVideoAsset: null,
      linkedVideoMatchType: null,
      media,
      normalizedSearch: normalizeText([
        exercise.name,
        exercise.slug,
        exercise.description,
        exercise.equipment,
        exercise.mechanics,
        exercise.force_type,
        ...categories.map((category) => category.name),
        ...categories.map((category) => category.slug),
        ...exerciseMuscles.map((muscle) => muscle.name),
      ].filter(Boolean).join(' ')),
      categorySlugs: new Set(categories.map((category) => normalizeSlug(category.slug || category.name))),
      categoryNames: new Set(categories.map((category) => normalizeText(category.name))),
    };
  });

  catalogCache = {
    loadedAt: now,
    rows,
    filters: ['All', ...categoryRows.map((category) => category.name)],
    filterDetails: categoryRows.map((category) => ({
      id: Number(category.id),
      name: category.name,
      slug: category.slug,
      sortOrder: Number(category.sort_order || 0),
    })),
    stats: {
      exercises: rows.length,
      mediaRows: mediaRows.length,
    },
  };
  return catalogCache;
};

export const clearSupabaseCatalogCacheForTests = () => {
  catalogCache = null;
};

export const listSupabaseExerciseFilters = async (options = {}) => {
  const catalog = await readCanonicalCatalog(options.client);
  return {
    filters: catalog.filters,
    filterDetails: catalog.filterDetails,
  };
};

export const listSupabaseExercises = async ({
  filter = 'All',
  search = '',
  limit = 1000,
  offset = 0,
  gender = null,
  client = getSupabaseClient(),
} = {}) => {
  const catalog = await readCanonicalCatalog(client);
  const filterKey = normalizeSlug(filter);
  const searchKey = normalizeText(search);
  const safeLimit = Math.min(1000, Math.max(1, Number(limit) || 1000));
  const safeOffset = Math.max(0, Number(offset) || 0);

  const filtered = catalog.rows.filter((exercise) => {
    const filterMatches = !filterKey || filterKey === 'all'
      || exercise.categorySlugs.has(filterKey)
      || exercise.categoryNames.has(normalizeText(filter));
    const searchMatches = !searchKey || exercise.normalizedSearch.includes(searchKey);
    return filterMatches && searchMatches;
  });

  const exercises = filtered
    .slice(safeOffset, safeOffset + safeLimit)
    .map((exercise) => {
      const primaryMedia = selectPrimaryMedia(exercise.media, gender);
      const publicExercise = { ...exercise };
      delete publicExercise.normalizedSearch;
      delete publicExercise.categorySlugs;
      delete publicExercise.categoryNames;
      return {
        ...publicExercise,
        primaryMedia,
      };
    });

  return {
    exercises,
    total: filtered.length,
    available: catalog.rows.length,
    mediaRows: catalog.stats.mediaRows,
  };
};

export const getSupabaseExerciseMuscles = async (exerciseId, options = {}) => {
  const catalog = await readCanonicalCatalog(options.client);
  const exercise = catalog.rows.find((entry) => Number(entry.id) === Number(exerciseId));
  if (!exercise) return null;

  return {
    exercise: {
      id: exercise.id,
      name: exercise.name,
      bodyPart: exercise.bodyPart,
    },
    ...buildMuscleResponse(exercise),
  };
};

export const getSupabaseExercisesByIds = async (exerciseIds = [], {
  gender = null,
  client = getSupabaseClient(),
} = {}) => {
  const ids = [...new Set(
    (Array.isArray(exerciseIds) ? exerciseIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0),
  )];
  if (!ids.length) return new Map();

  const catalog = await readCanonicalCatalog(client);
  const requested = new Set(ids);
  const result = new Map();
  catalog.rows.forEach((exercise) => {
    if (!requested.has(Number(exercise.id))) return;
    const publicExercise = { ...exercise };
    delete publicExercise.normalizedSearch;
    delete publicExercise.categorySlugs;
    delete publicExercise.categoryNames;
    result.set(Number(exercise.id), {
      ...publicExercise,
      primaryMedia: selectPrimaryMedia(exercise.media, gender),
    });
  });
  return result;
};

export const resolveSupabaseExerciseMusclesByName = async ({ name, muscleHint = null, client = getSupabaseClient() } = {}) => {
  const catalog = await readCanonicalCatalog(client);
  const normalizedName = normalizeText(name);
  const slug = normalizeSlug(name);
  const hint = normalizeSlug(muscleHint);
  const exercise = catalog.rows.find((entry) =>
    normalizeText(entry.name) === normalizedName
    || entry.slug === slug
    || (hint && entry.categorySlugs.has(hint) && entry.normalizedSearch.includes(normalizedName)));
  if (!exercise) return null;

  return {
    exercise: {
      id: exercise.id,
      name: exercise.name,
      bodyPart: exercise.bodyPart,
    },
    ...buildMuscleResponse(exercise),
  };
};
