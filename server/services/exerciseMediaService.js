import { getSupabaseClient } from './supabase.js';

const EXERCISE_CACHE_TTL_MS = 5 * 60 * 1000;
const MEDIA_QUERY_CHUNK_SIZE = 400;
const EXERCISE_SELECT_VARIANTS = [
  'id,name,slug,is_active',
  'id,name,is_active',
  'id,canonical_name,slug,is_active',
  'id,canonical_name,is_active',
  'id,name,slug',
  'id,name',
  'id,canonical_name,slug',
  'id,canonical_name',
];

let exerciseCache = null;

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

export const slugifyExerciseIdentity = (value) =>
  normalizeText(value)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const singularizeLookupToken = (token) => {
  if (token.length <= 3 || !token.endsWith('s')) return token;
  if (/(ss|us|is)$/.test(token)) return token;
  return token.slice(0, -1);
};

const getExerciseLookupVariants = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  const singularized = normalized
    .split(' ')
    .map(singularizeLookupToken)
    .join(' ');

  return [...new Set([
    normalized,
    slugifyExerciseIdentity(normalized),
    singularized,
    slugifyExerciseIdentity(singularized),
  ].filter(Boolean))];
};

export const normalizeMediaAudience = (gender) => {
  const key = normalizeText(gender);
  if (key === 'man' || key === 'male' || key === 'm') return 'male';
  if (key === 'woman' || key === 'female' || key === 'f') return 'female';
  return 'unisex';
};

const normalizeMediaType = (value) => {
  const key = normalizeText(value);
  if (key === 'gif' || key === 'video' || key === 'image') return key;
  return key || 'video';
};

const isActiveValue = (value) => value === true || value === 1 || value === '1' || value == null;

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

const compareMediaOrder = (left, right) => (
  (Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
  || (Number(left.id || 0) - Number(right.id || 0))
);

const mediaPriority = (media, audience) => {
  const mediaAudience = normalizeMediaAudience(media?.audience);
  const accessLevel = normalizeText(media?.accessLevel);
  const isFree = accessLevel === 'free';

  if (audience === 'female') {
    if (isFree && mediaAudience === 'female') return 0;
    if (isFree && mediaAudience === 'unisex') return 1;
    if (isFree && mediaAudience === 'male') return 2;
    return 3;
  }

  if (audience === 'male') {
    if (isFree && mediaAudience === 'male') return 0;
    if (isFree && mediaAudience === 'unisex') return 1;
    if (isFree && mediaAudience === 'female') return 2;
    return 3;
  }

  if (isFree && mediaAudience === 'unisex') return 0;
  if (isFree) return 1;
  return 2;
};

export const selectPrimaryMedia = (mediaRecords = [], gender = null) => {
  const audience = normalizeMediaAudience(gender);
  return [...mediaRecords]
    .filter((media) => media && media.url)
    .sort((left, right) => (
      mediaPriority(left, audience) - mediaPriority(right, audience)
      || compareMediaOrder(left, right)
    ))[0] || null;
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const getMediaUrlBuilder = (client) => ({ storageBucket, storagePath }) => {
  if (!client || !storageBucket || !storagePath) return null;

  try {
    const result = client.storage.from(storageBucket).getPublicUrl(storagePath);
    return result?.data?.publicUrl || null;
  } catch {
    return null;
  }
};

const readSupabaseExercises = async (client) => {
  const now = Date.now();
  if (exerciseCache && now - exerciseCache.loadedAt < EXERCISE_CACHE_TTL_MS) {
    return exerciseCache;
  }

  let lastError = null;
  for (const selectColumns of EXERCISE_SELECT_VARIANTS) {
    const { data, error } = await client
      .from('exercises')
      .select(selectColumns)
      .limit(2000);

    if (error) {
      lastError = error;
      continue;
    }

    const rows = Array.isArray(data) ? data.filter((row) => isActiveValue(row?.is_active)) : [];
    const bySlug = new Map();
    const byName = new Map();

    rows.forEach((row) => {
      const name = String(row?.name || row?.canonical_name || '').trim();
      const slug = String(row?.slug || '').trim();
      if (slug) bySlug.set(normalizeText(slug), row);
      if (name) {
        byName.set(normalizeText(name), row);
        bySlug.set(slugifyExerciseIdentity(name), row);
      }
    });

    exerciseCache = {
      loadedAt: now,
      rows,
      bySlug,
      byName,
      selectColumns,
    };
    return exerciseCache;
  }

  throw lastError || new Error('Unable to load Supabase exercises');
};

const resolveSupabaseExercise = (exercise, cache) => {
  for (const key of getExerciseLookupVariants(exercise?.slug || exercise?.exerciseSlug || exercise?.exercise_slug)) {
    if (cache.bySlug.has(key)) return cache.bySlug.get(key);
  }

  for (const key of getExerciseLookupVariants(exercise?.canonicalName || exercise?.canonical_name || exercise?.name || exercise?.exerciseName)) {
    if (cache.byName.has(key)) return cache.byName.get(key);
    if (cache.bySlug.has(key)) return cache.bySlug.get(key);
  }

  return null;
};

const emptyResult = (reason = 'unavailable') => ({
  byKey: new Map(),
  stats: {
    supabaseMatched: 0,
    localFallback: 0,
    missingMedia: 0,
    requested: 0,
    mediaQueryCount: 0,
    reason,
  },
});

export const getExerciseMediaForExercises = async (exercises = [], {
  gender = null,
  client = getSupabaseClient(),
} = {}) => {
  const requested = Array.isArray(exercises) ? exercises.filter(Boolean) : [];
  if (!requested.length) return emptyResult('empty');
  if (!client) {
    return {
      ...emptyResult('not_configured'),
      stats: { ...emptyResult('not_configured').stats, requested: requested.length, localFallback: requested.length },
    };
  }

  try {
    const exerciseLookup = await readSupabaseExercises(client);
    const matched = [];
    const matchedIds = new Set();

    requested.forEach((exercise, index) => {
      const supabaseExercise = resolveSupabaseExercise(exercise, exerciseLookup);
      if (!supabaseExercise?.id) return;

      const key = String(exercise?.mediaKey || exercise?.id || exercise?.exerciseCatalogId || exercise?.exerciseName || exercise?.name || index);
      const exerciseId = String(supabaseExercise.id);
      matched.push({ key, exerciseId });
      matchedIds.add(exerciseId);
    });

    if (!matched.length) {
      return {
        ...emptyResult('no_deterministic_mapping'),
        stats: {
          ...emptyResult('no_deterministic_mapping').stats,
          requested: requested.length,
          localFallback: requested.length,
        },
      };
    }

    const getMediaUrl = getMediaUrlBuilder(client);
    const mediaByExerciseId = new Map();
    let mediaQueryCount = 0;

    for (const chunk of chunkArray([...matchedIds], MEDIA_QUERY_CHUNK_SIZE)) {
      mediaQueryCount += 1;
      const { data, error } = await client
        .from('exercise_media')
        .select('id,exercise_id,media_type,audience,storage_bucket,storage_path,access_level,sort_order,is_active')
        .in('exercise_id', chunk)
        .eq('is_active', true);

      if (error) throw error;

      (Array.isArray(data) ? data : []).forEach((row) => {
        const exerciseId = String(row?.exercise_id || '');
        if (!exerciseId) return;
        const normalized = normalizeMediaRecord(row, getMediaUrl);
        if (!normalized.url) return;
        if (!mediaByExerciseId.has(exerciseId)) mediaByExerciseId.set(exerciseId, []);
        mediaByExerciseId.get(exerciseId).push(normalized);
      });
    }

    const byKey = new Map();
    matched.forEach(({ key, exerciseId }) => {
      const media = (mediaByExerciseId.get(exerciseId) || []).sort(compareMediaOrder);
      byKey.set(key, {
        primaryMedia: selectPrimaryMedia(media, gender),
        media,
        supabaseExerciseId: exerciseId,
      });
    });

    const supabaseMatched = [...byKey.values()].filter((entry) => entry.primaryMedia).length;
    const missingMedia = requested.length - supabaseMatched;

    return {
      byKey,
      stats: {
        supabaseMatched,
        localFallback: missingMedia,
        missingMedia,
        requested: requested.length,
        mediaQueryCount,
        reason: null,
      },
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[ExerciseMedia] Supabase media lookup failed:', error?.message || error);
    }
    return {
      ...emptyResult('supabase_error'),
      stats: {
        ...emptyResult('supabase_error').stats,
        requested: requested.length,
        localFallback: requested.length,
      },
    };
  }
};

export const getExerciseMedia = async (exercise, options = {}) => {
  const result = await getExerciseMediaForExercises([exercise], options);
  const key = String(exercise?.mediaKey || exercise?.id || exercise?.exerciseCatalogId || exercise?.exerciseName || exercise?.name || 0);
  return result.byKey.get(key) || { primaryMedia: null, media: [] };
};

export const clearExerciseMediaCacheForTests = () => {
  exerciseCache = null;
};
