import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearSupabaseCatalogCacheForTests,
  getSupabaseExerciseMuscles,
  listSupabaseExerciseFilters,
  listSupabaseExercises,
  resolveSupabaseExerciseMusclesByName,
} from './supabaseExerciseCatalogService.js';

const makeRows = () => ({
  exercises: [
    {
      id: 1,
      name: 'Cable Lateral Raise',
      slug: 'cable-lateral-raise',
      description: 'Shoulder isolation',
      equipment: 'Cable',
      difficulty_level: 2,
      preparation: 'Stand beside cable stack',
      execution: 'Raise arm to shoulder height',
      mechanics: 'isolation',
      force_type: 'pull',
      is_active: true,
    },
    {
      id: 2,
      name: 'Bench Press',
      slug: 'bench-press',
      description: 'Press from bench',
      equipment: 'Barbell',
      difficulty_level: 3,
      preparation: 'Lie on bench',
      execution: 'Press the bar',
      mechanics: 'compound',
      force_type: 'push',
      is_active: true,
    },
    {
      id: 3,
      name: 'Inactive Curl',
      slug: 'inactive-curl',
      is_active: false,
    },
  ],
  exercise_media: [
    {
      id: 20,
      exercise_id: 1,
      media_type: 'video',
      audience: 'female',
      storage_bucket: 'exercise-previews',
      storage_path: 'video/shoulders/female-raise.mp4',
      access_level: 'free',
      sort_order: 2,
      is_active: true,
    },
    {
      id: 21,
      exercise_id: 1,
      media_type: 'gif',
      audience: 'male',
      storage_bucket: 'exercise-previews',
      storage_path: 'video/shoulders/male-raise.gif',
      access_level: 'free',
      sort_order: 1,
      is_active: true,
    },
    {
      id: 22,
      exercise_id: 2,
      media_type: 'image',
      audience: 'unisex',
      storage_bucket: 'exercise-previews',
      storage_path: 'images/chest/bench.webp',
      access_level: 'free',
      sort_order: 1,
      is_active: true,
    },
    {
      id: 23,
      exercise_id: 2,
      media_type: 'video',
      audience: 'unisex',
      storage_bucket: 'other-bucket',
      storage_path: 'ignored.mp4',
      access_level: 'free',
      sort_order: 0,
      is_active: true,
    },
  ],
  muscle_categories: [
    { id: 100, name: 'Shoulders', slug: 'shoulders', sort_order: 1, is_active: true },
    { id: 101, name: 'Chest', slug: 'chest', sort_order: 2, is_active: true },
  ],
  exercise_categories: [
    { exercise_id: 1, category_id: 100, is_primary: true },
    { exercise_id: 2, category_id: 101, is_primary: true },
  ],
  muscles: [
    { id: 200, name: 'Side Delts', slug: 'side-delts', muscle_group: 'Shoulders', is_active: true },
    { id: 201, name: 'Front Delts', slug: 'front-delts', muscle_group: 'Shoulders', is_active: true },
    { id: 202, name: 'Chest', slug: 'chest', muscle_group: 'Chest', is_active: true },
    { id: 203, name: 'Triceps', slug: 'triceps', muscle_group: 'Arms', is_active: true },
  ],
  exercise_muscles: [
    { exercise_id: 1, muscle_id: 200, role: 'primary' },
    { exercise_id: 1, muscle_id: 201, role: 'secondary' },
    { exercise_id: 2, muscle_id: 202, role: 'primary' },
    { exercise_id: 2, muscle_id: 203, role: 'secondary' },
  ],
});

class FakeQuery {
  constructor(rows, table) {
    this.rows = rows;
    this.table = table;
    this.filters = [];
    this.fromIndex = 0;
    this.toIndex = rows.length - 1;
    this.error = null;
  }

  select() {
    return this;
  }

  range(from, to) {
    this.fromIndex = from;
    this.toIndex = to;
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, value });
    return this;
  }

  order() {
    return this;
  }

  then(resolve) {
    if (this.error) return Promise.resolve(resolve({ data: null, error: this.error }));
    let data = [...this.rows];
    this.filters.forEach(({ column, value }) => {
      data = data.filter((row) => row[column] === value);
    });
    return Promise.resolve(resolve({ data: data.slice(this.fromIndex, this.toIndex + 1), error: null }));
  }
}

const makeClient = (rows = makeRows()) => ({
  from(table) {
    return new FakeQuery(rows[table] || [], table);
  },
  storage: {
    from(bucket) {
      return {
        getPublicUrl(path) {
          return { data: { publicUrl: `https://cdn.example.test/${bucket}/${path}` } };
        },
      };
    },
  },
});

test('Supabase exercise filters preserve current response shape', async () => {
  clearSupabaseCatalogCacheForTests();

  const result = await listSupabaseExerciseFilters({ client: makeClient() });

  assert.deepEqual(result.filters, ['All', 'Shoulders', 'Chest']);
  assert.deepEqual(result.filterDetails, [
    { id: 100, name: 'Shoulders', slug: 'shoulders', sortOrder: 1 },
    { id: 101, name: 'Chest', slug: 'chest', sortOrder: 2 },
  ]);
});

test('Supabase exercise catalog filters, searches, paginates, and selects gender media', async () => {
  clearSupabaseCatalogCacheForTests();

  const result = await listSupabaseExercises({
    client: makeClient(),
    filter: 'Shoulders',
    search: 'lateral',
    limit: 10,
    offset: 0,
    gender: 'woman',
  });

  assert.equal(result.total, 1);
  assert.equal(result.available, 2);
  assert.equal(result.mediaRows, 4);
  assert.equal(result.exercises.length, 1);
  assert.equal(result.exercises[0].name, 'Cable Lateral Raise');
  assert.equal(result.exercises[0].primaryMedia.url, 'https://cdn.example.test/exercise-previews/video/shoulders/female-raise.mp4');
  assert.equal(result.exercises[0].primaryMedia.audience, 'female');
  assert.equal(Object.hasOwn(result.exercises[0], 'normalizedSearch'), false);
  assert.equal(Object.hasOwn(result.exercises[0], 'categorySlugs'), false);
  assert.equal(Object.hasOwn(result.exercises[0], 'categoryNames'), false);
});

test('Supabase exercise muscle lookup returns exercise, primary muscles, secondary muscles, and all muscles', async () => {
  clearSupabaseCatalogCacheForTests();

  const result = await getSupabaseExerciseMuscles(2, { client: makeClient() });

  assert.deepEqual(result.exercise, { id: 2, name: 'Bench Press', bodyPart: 'Chest' });
  assert.deepEqual(result.primaryMuscles, [{ name: 'Chest', loadFactor: 1, role: 'primary' }]);
  assert.deepEqual(result.secondaryMuscles, [{ name: 'Triceps', loadFactor: 1, role: 'secondary' }]);
  assert.deepEqual(result.muscles, [
    { name: 'Chest', loadFactor: 1, role: 'primary' },
    { name: 'Triceps', loadFactor: 1, role: 'secondary' },
  ]);
});

test('Supabase exercise name resolution supports category hint matching and missing exercises return null', async () => {
  clearSupabaseCatalogCacheForTests();

  const resolved = await resolveSupabaseExerciseMusclesByName({
    client: makeClient(),
    name: 'Cable Lateral Raise',
    muscleHint: 'Shoulders',
  });
  const missing = await resolveSupabaseExerciseMusclesByName({
    client: makeClient(),
    name: 'Imaginary Exercise',
    muscleHint: 'Back',
  });

  assert.equal(resolved.exercise.id, 1);
  assert.equal(resolved.exercise.bodyPart, 'Shoulders');
  assert.equal(missing, null);
});

test('Supabase exercise service propagates catalog read failures to route handlers', async () => {
  clearSupabaseCatalogCacheForTests();
  const client = {
    from() {
      const query = new FakeQuery([], 'exercises');
      query.error = new Error('catalog unavailable');
      return query;
    },
  };

  await assert.rejects(
    () => listSupabaseExercises({ client }),
    /catalog unavailable/,
  );
});
