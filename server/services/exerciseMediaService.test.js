import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearExerciseMediaCacheForTests,
  getExerciseMediaForExercises,
  normalizeMediaAudience,
  selectPrimaryMedia,
} from './exerciseMediaService.js';

const media = (overrides = {}) => ({
  id: 1,
  mediaType: 'video',
  audience: 'unisex',
  url: 'https://example.test/video.mp4',
  accessLevel: 'free',
  sortOrder: 0,
  ...overrides,
});

const createFakeClient = ({
  exercises = [],
  mediaRows = [],
  failExercises = false,
  failMedia = false,
} = {}) => {
  const calls = { exercises: 0, media: 0 };
  const client = {
    calls,
    storage: {
      from: (bucket) => ({
        getPublicUrl: (path) => ({
          data: { publicUrl: `https://cdn.example.test/${bucket}/${path}` },
        }),
      }),
    },
    from: (table) => {
      if (table === 'exercises') {
        return {
          select: () => ({
            limit: async () => {
              calls.exercises += 1;
              if (failExercises) return { data: null, error: new Error('exercise lookup failed') };
              return { data: exercises, error: null };
            },
          }),
        };
      }

      if (table === 'exercise_media') {
        return {
          select: () => ({
            in: (_column, ids) => ({
              eq: async () => {
                calls.media += 1;
                if (failMedia) return { data: null, error: new Error('media lookup failed') };
                const idSet = new Set(ids.map(String));
                return {
                  data: mediaRows.filter((row) => idSet.has(String(row.exercise_id)) && row.is_active !== false),
                  error: null,
                };
              },
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
  return client;
};

test('normalizes man to male', () => {
  assert.equal(normalizeMediaAudience('man'), 'male');
  assert.equal(normalizeMediaAudience('male'), 'male');
});

test('normalizes woman to female', () => {
  assert.equal(normalizeMediaAudience('woman'), 'female');
  assert.equal(normalizeMediaAudience('female'), 'female');
});

test('female media preference beats unisex and male', () => {
  const selected = selectPrimaryMedia([
    media({ id: 1, audience: 'male' }),
    media({ id: 2, audience: 'unisex' }),
    media({ id: 3, audience: 'female' }),
  ], 'woman');
  assert.equal(selected.id, 3);
});

test('male media preference beats unisex and female', () => {
  const selected = selectPrimaryMedia([
    media({ id: 1, audience: 'female' }),
    media({ id: 2, audience: 'unisex' }),
    media({ id: 3, audience: 'male' }),
  ], 'man');
  assert.equal(selected.id, 3);
});

test('unknown audience prefers unisex fallback', () => {
  const selected = selectPrimaryMedia([
    media({ id: 1, audience: 'female' }),
    media({ id: 2, audience: 'unisex' }),
  ], null);
  assert.equal(selected.id, 2);
});

test('opposite-gender media is final free fallback', () => {
  const selected = selectPrimaryMedia([
    media({ id: 1, audience: 'male' }),
    media({ id: 2, audience: 'female' }),
  ], 'woman');
  assert.equal(selected.id, 2);
});

test('sort_order then id decide within the same priority', () => {
  const selected = selectPrimaryMedia([
    media({ id: 5, audience: 'female', sortOrder: 3 }),
    media({ id: 2, audience: 'female', sortOrder: 1 }),
    media({ id: 1, audience: 'female', sortOrder: 1 }),
  ], 'woman');
  assert.equal(selected.id, 1);
});

test('premium media is excluded while matching free media exists', () => {
  const selected = selectPrimaryMedia([
    media({ id: 1, audience: 'male', accessLevel: 'premium', sortOrder: 0 }),
    media({ id: 2, audience: 'male', accessLevel: 'free', sortOrder: 4 }),
  ], 'man');
  assert.equal(selected.id, 2);
});

test('inactive media is excluded by the batched lookup', async () => {
  clearExerciseMediaCacheForTests();
  const client = createFakeClient({
    exercises: [{ id: 10, name: 'Bench Press', is_active: true }],
    mediaRows: [
      { id: 1, exercise_id: 10, media_type: 'video', audience: 'male', storage_bucket: 'exercise-previews', storage_path: 'inactive.mp4', access_level: 'free', sort_order: 0, is_active: false },
      { id: 2, exercise_id: 10, media_type: 'video', audience: 'male', storage_bucket: 'exercise-previews', storage_path: 'active.mp4', access_level: 'free', sort_order: 1, is_active: true },
    ],
  });
  const result = await getExerciseMediaForExercises([{ id: 1, name: 'Bench Press' }], { gender: 'man', client });
  assert.equal(result.byKey.get('1').primaryMedia.id, 2);
});

test('GIF media is returned correctly', async () => {
  clearExerciseMediaCacheForTests();
  const client = createFakeClient({
    exercises: [{ id: 10, name: 'Curl', is_active: true }],
    mediaRows: [{ id: 1, exercise_id: 10, media_type: 'gif', audience: 'unisex', storage_bucket: 'exercise-previews', storage_path: 'curl.gif', access_level: 'free', sort_order: 0, is_active: true }],
  });
  const result = await getExerciseMediaForExercises([{ id: 1, name: 'Curl' }], { client });
  assert.equal(result.byKey.get('1').primaryMedia.mediaType, 'gif');
});

test('MP4/video media is returned correctly', async () => {
  clearExerciseMediaCacheForTests();
  const client = createFakeClient({
    exercises: [{ id: 10, name: 'Squat', is_active: true }],
    mediaRows: [{ id: 1, exercise_id: 10, media_type: 'video', audience: 'unisex', storage_bucket: 'exercise-previews', storage_path: 'squat.mp4', access_level: 'free', sort_order: 0, is_active: true }],
  });
  const result = await getExerciseMediaForExercises([{ id: 1, name: 'Squat' }], { client });
  assert.equal(result.byKey.get('1').primaryMedia.mediaType, 'video');
  assert.match(result.byKey.get('1').primaryMedia.url, /squat\.mp4$/);
});

test('image media is returned correctly', async () => {
  clearExerciseMediaCacheForTests();
  const client = createFakeClient({
    exercises: [{ id: 10, name: 'Plank', is_active: true }],
    mediaRows: [{ id: 1, exercise_id: 10, media_type: 'image', audience: 'unisex', storage_bucket: 'exercise-previews', storage_path: 'plank.jpg', access_level: 'free', sort_order: 0, is_active: true }],
  });
  const result = await getExerciseMediaForExercises([{ id: 1, name: 'Plank' }], { client });
  assert.equal(result.byKey.get('1').primaryMedia.mediaType, 'image');
});

test('Supabase failure returns local fallback stats instead of throwing', async () => {
  clearExerciseMediaCacheForTests();
  const client = createFakeClient({ failExercises: true });
  const result = await getExerciseMediaForExercises([{ id: 1, name: 'Bench Press' }], { client });
  assert.equal(result.stats.reason, 'supabase_error');
  assert.equal(result.stats.localFallback, 1);
});

test('unknown exercise preserves existing fallback behavior', async () => {
  clearExerciseMediaCacheForTests();
  const client = createFakeClient({
    exercises: [{ id: 10, name: 'Known Exercise', is_active: true }],
    mediaRows: [],
  });
  const result = await getExerciseMediaForExercises([{ id: 1, name: 'Unknown Exercise' }], { client });
  assert.equal(result.stats.reason, 'no_deterministic_mapping');
  assert.equal(result.stats.localFallback, 1);
});

test('media lookup is batched and avoids N+1 queries', async () => {
  clearExerciseMediaCacheForTests();
  const client = createFakeClient({
    exercises: [
      { id: 10, name: 'Bench Press', is_active: true },
      { id: 11, name: 'Squat', is_active: true },
      { id: 12, name: 'Curl', is_active: true },
    ],
    mediaRows: [
      { id: 1, exercise_id: 10, media_type: 'video', audience: 'unisex', storage_bucket: 'exercise-previews', storage_path: 'bench.mp4', access_level: 'free', sort_order: 0, is_active: true },
      { id: 2, exercise_id: 11, media_type: 'video', audience: 'unisex', storage_bucket: 'exercise-previews', storage_path: 'squat.mp4', access_level: 'free', sort_order: 0, is_active: true },
      { id: 3, exercise_id: 12, media_type: 'gif', audience: 'unisex', storage_bucket: 'exercise-previews', storage_path: 'curl.gif', access_level: 'free', sort_order: 0, is_active: true },
    ],
  });
  const result = await getExerciseMediaForExercises([
    { id: 1, name: 'Bench Press' },
    { id: 2, name: 'Squat' },
    { id: 3, name: 'Curl' },
  ], { client });
  assert.equal(result.stats.supabaseMatched, 3);
  assert.equal(result.stats.mediaQueryCount, 1);
  assert.equal(client.calls.media, 1);
});
